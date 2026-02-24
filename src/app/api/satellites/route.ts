import { NextResponse } from "next/server";
import type { SatelliteOMM } from "@/lib/satelliteTypes";

/**
 * CelesTrak catalog groups to fetch.
 * Each group is fetched in parallel; results are merged and deduplicated by NORAD_CAT_ID.
 * Military catalog entries take priority on duplicates.
 */
const CELESTRAK_BASE =
  "https://celestrak.org/NORAD/elements/gp.php?FORMAT=json&GROUP=";

const CATALOG_GROUPS = [
  "military",    // ~100 — Miscellaneous military satellites
  "gps-ops",     // ~31  — US GPS constellation
  "glonass",     // ~24  — Russian GLONASS navigation
  "beidou",      // ~50+ — Chinese BeiDou navigation
  "galileo",     // ~30  — European Galileo navigation
  "geo",         // ~500 — Active geosynchronous (includes comms, SIGINT, early-warning)
  "weather",     // ~50  — Weather satellites (includes military DMSP)
] as const;

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
 * Merge multiple OMM arrays, deduplicating by NORAD_CAT_ID.
 * Earlier arrays in the list take priority on duplicates (military first).
 */
const mergeAndDeduplicate = (
  catalogs: SatelliteOMM[][]
): SatelliteOMM[] => {
  const seen = new Map<number, SatelliteOMM>();

  for (const catalog of catalogs) {
    for (const sat of catalog) {
      if (!seen.has(sat.NORAD_CAT_ID)) {
        seen.set(sat.NORAD_CAT_ID, sat);
      }
    }
  }

  return Array.from(seen.values());
};

export async function GET() {
  const results = await Promise.allSettled(
    CATALOG_GROUPS.map((group) => fetchCatalog(`${CELESTRAK_BASE}${group}`))
  );

  // Collect successfully fetched and validated catalogs
  const validatedCatalogs: SatelliteOMM[][] = [];
  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      const validated = (result.value as unknown[]).filter(isValidOMM);
      validatedCatalogs.push(validated);
      successCount++;
    } else {
      errors.push(`${CATALOG_GROUPS[i]}: ${String(result.reason)}`);
    }
  }

  // All catalogs failed
  if (successCount === 0) {
    return NextResponse.json(
      {
        error: "CelesTrak unavailable",
        details: errors.join("; "),
      },
      { status: 502 }
    );
  }

  const satellites = mergeAndDeduplicate(validatedCatalogs);
  const partial = successCount < CATALOG_GROUPS.length;

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
