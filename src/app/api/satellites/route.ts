import { NextResponse } from "next/server";
import type { SatelliteOMM } from "@/lib/satelliteTypes";

const CELESTRAK_MILITARY =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=json";
const CELESTRAK_GPS =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=json";
const FETCH_TIMEOUT_MS = 30_000;

/** Fetch a CelesTrak endpoint with timeout. */
const fetchCatalog = async (url: string): Promise<unknown[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`CelesTrak returned status ${response.status}`);
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Response is not a JSON array");
    }

    return data as unknown[];
  } finally {
    clearTimeout(timeoutId);
  }
};

/** Type guard to validate a single OMM record has required fields. */
const isValidOMM = (record: unknown): record is SatelliteOMM => {
  if (typeof record !== "object" || record === null) return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.OBJECT_NAME === "string" &&
    typeof r.OBJECT_ID === "string" &&
    typeof r.EPOCH === "string" &&
    typeof r.NORAD_CAT_ID === "number" &&
    typeof r.MEAN_MOTION === "number" &&
    typeof r.ECCENTRICITY === "number" &&
    typeof r.INCLINATION === "number" &&
    typeof r.RA_OF_ASC_NODE === "number" &&
    typeof r.ARG_OF_PERICENTER === "number" &&
    typeof r.MEAN_ANOMALY === "number" &&
    typeof r.EPHEMERIS_TYPE === "number" &&
    typeof r.CLASSIFICATION_TYPE === "string" &&
    typeof r.ELEMENT_SET_NO === "number" &&
    typeof r.REV_AT_EPOCH === "number" &&
    typeof r.BSTAR === "number" &&
    typeof r.MEAN_MOTION_DOT === "number" &&
    typeof r.MEAN_MOTION_DDOT === "number"
  );
};

/**
 * Merge two OMM arrays, deduplicating by NORAD_CAT_ID.
 * Military catalog entries take priority over GPS entries.
 */
const mergeAndDeduplicate = (
  military: SatelliteOMM[],
  gps: SatelliteOMM[]
): SatelliteOMM[] => {
  const seen = new Map<number, SatelliteOMM>();

  // Military first — takes priority on duplicates
  for (const sat of military) {
    seen.set(sat.NORAD_CAT_ID, sat);
  }
  for (const sat of gps) {
    if (!seen.has(sat.NORAD_CAT_ID)) {
      seen.set(sat.NORAD_CAT_ID, sat);
    }
  }

  return Array.from(seen.values());
};

export async function GET() {
  const [militaryResult, gpsResult] = await Promise.allSettled([
    fetchCatalog(CELESTRAK_MILITARY),
    fetchCatalog(CELESTRAK_GPS),
  ]);

  const militaryOk = militaryResult.status === "fulfilled";
  const gpsOk = gpsResult.status === "fulfilled";

  // Both failed
  if (!militaryOk && !gpsOk) {
    const militaryError =
      militaryResult.status === "rejected"
        ? String(militaryResult.reason)
        : "unknown";
    const gpsError =
      gpsResult.status === "rejected"
        ? String(gpsResult.reason)
        : "unknown";

    return NextResponse.json(
      {
        error: "CelesTrak unavailable",
        details: `Military: ${militaryError}; GPS: ${gpsError}`,
      },
      { status: 502 }
    );
  }

  // Validate and filter OMM records
  const militaryData: SatelliteOMM[] = militaryOk
    ? (militaryResult.value as unknown[]).filter(isValidOMM)
    : [];
  const gpsData: SatelliteOMM[] = gpsOk
    ? (gpsResult.value as unknown[]).filter(isValidOMM)
    : [];

  const satellites = mergeAndDeduplicate(militaryData, gpsData);
  const partial = !militaryOk || !gpsOk;

  return NextResponse.json(
    {
      satellites,
      count: satellites.length,
      partial,
      timestamp: Date.now(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, s-maxage=1800, stale-while-revalidate=3600",
        "Content-Type": "application/json",
      },
    }
  );
}
