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
  "military",    // ~54  — Misc military (recon, SIGINT, classified)
  "gps-ops",     // ~31  — US GPS constellation (US Space Force)
  "glo-ops",     // ~24  — Russian GLONASS (Russian military)
  "beidou",      // ~50+ — Chinese BeiDou (PLA Strategic Support Force)
  "galileo",     // ~30  — EU Galileo navigation
  "sbas",        // ~15  — Satellite-Based Augmentation Systems
  "nnss",        // ~10  — US Navy Navigation Satellite System
  "musson",      // ~5   — Russian LEO Navigation
  "tdrss",       // ~10  — Tracking & Data Relay Satellite System
  "geo",         // ~600+ — Active geosynchronous (filtered to military-relevant)
] as const;

/**
 * Known military satellite name patterns for filtering the large GEO catalog.
 * Only satellites matching these patterns are kept from the geo group.
 */
const GEO_MILITARY_PATTERNS: RegExp[] = [
  /\bUSA\s+\d+/i,                      // US classified (USA followed by space + digits)
  /\bMUOS\b/i,                          // Mobile User Objective System (Navy UHF)
  /\bAEHF\b/i,                          // Advanced Extremely High Frequency
  /\bMILSTAR\b/i,                       // Military Strategic & Tactical Relay
  /\bWGS\b/i,                           // Wideband Global SATCOM
  /\bDSCS\b/i,                          // Defense Satellite Communications System
  /\bUFO\b/i,                           // UHF Follow-On
  /\bSBIRS\b/i,                         // Space Based Infrared System
  /\bDSP\b/i,                           // Defense Support Program
  /\bSTSS\b/i,                          // Space Tracking and Surveillance System
  /\bSDS\b/i,                           // Satellite Data System
  /\bTDRS\b/i,                          // Tracking & Data Relay Satellite
  /\bDMSP\b/i,                          // Defense Meteorological Satellite Program
  /\bNROL\b/i,                          // National Reconnaissance Office Launch
  /\bCOSMOS\b/i,                        // Russian military
  /\bBEIDOU\b/i,                        // Chinese BeiDou (GEO component)
  /\bYAOGAN\b/i,                        // Chinese remote sensing / military recon
  /\bSHIYAN\b/i,                        // Chinese experimental military
  /\bSHIJIAN\b/i,                       // Chinese experimental / military
  /\bMERIDIAN\b/i,                      // Russian military comms (Molniya-type)
  /\bLUCH\b/i,                          // Russian data relay
  /\bTUNDRA\b/i,                        // Russian early warning (EKS)
  /\bGARPUN\b/i,                        // Russian military comms (GEO)
  /\bREPEI\b/i,                         // Russian military relay
];

/** Check if a GEO satellite name matches known military patterns. */
const isGeoMilitary = (name: string): boolean =>
  GEO_MILITARY_PATTERNS.some((pattern) => pattern.test(name));

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
      let validated = (result.value as unknown[]).filter(isValidOMM);
      // Filter the large GEO catalog to only military-relevant satellites
      if (CATALOG_GROUPS[i] === "geo") {
        validated = validated.filter((sat) => isGeoMilitary(sat.OBJECT_NAME));
      }
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
