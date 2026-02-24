import { NextResponse } from "next/server";
import {
  type AirspaceZone,
  type AirspaceType,
  type TfrType,
  mapSuaTypeCode,
  formatAirspaceAltitude,
  isZoneActive,
} from "@/lib/airspaceTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 30_000;

const SUA_ENDPOINT =
  "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0/query";

const SUA_PARAMS = new URLSearchParams({
  where: "TYPE_CODE IN ('R','P','W','A','MOA')",
  outFields:
    "NAME,TYPE_CODE,UPPER_VAL,UPPER_UOM,UPPER_CODE,LOWER_VAL,LOWER_UOM,LOWER_CODE,STATE,COUNTRY,TIMESOFUSE",
  f: "geojson",
  outSR: "4326",
  resultRecordCount: "5000",
});

const TFR_LIST_URL = "https://tfr.faa.gov/tfrapi/getTfrList";
const TFR_GEO_URL =
  "https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=500&outputFormat=application/json&srsname=EPSG:4326";

/** SUA cache — 24-hour TTL (data changes every 28 days). */
let suaCache: { zones: AirspaceZone[]; fetchedAt: number } | null = null;
const SUA_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch with abort timeout. */
const fetchWithTimeout = async (
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

/** Map TFR type string from FAA API to our TfrType enum. */
const mapTfrApiType = (type: string): TfrType => {
  const upper = type.toUpperCase();
  if (upper.includes("VIP")) return "vip";
  if (upper.includes("SECURITY")) return "security";
  if (upper.includes("HAZARD")) return "hazard";
  if (upper.includes("SPACE")) return "space";
  if (upper.includes("AIR SHOW") || upper.includes("SPORT")) return "event";
  if (upper.includes("DEFENSE")) return "national-defense";
  return "other";
};

// ---------------------------------------------------------------------------
// SUA Fetch (ArcGIS)
// ---------------------------------------------------------------------------

/** Validate that a GeoJSON feature has the shape we expect from ArcGIS SUA. */
const isValidSuaFeature = (feature: unknown): boolean => {
  if (typeof feature !== "object" || feature === null) return false;
  const f = feature as Record<string, unknown>;
  if (typeof f.properties !== "object" || f.properties === null) return false;
  if (typeof f.geometry !== "object" || f.geometry === null) return false;
  const props = f.properties as Record<string, unknown>;
  return typeof props.NAME === "string" && typeof props.TYPE_CODE === "string";
};

/** Transform an ArcGIS SUA GeoJSON feature into an AirspaceZone. */
const suaFeatureToZone = (feature: Record<string, unknown>): AirspaceZone => {
  const props = feature.properties as Record<string, unknown>;
  const typeCode = props.TYPE_CODE as string;
  const name = props.NAME as string;
  const airspaceType = mapSuaTypeCode(typeCode);

  const zone: AirspaceZone = {
    id: `sua-${name}`,
    name,
    type: airspaceType,
    geometry: feature.geometry as GeoJSON.Geometry,
    upperAltitude: formatAirspaceAltitude(
      props.UPPER_VAL as string | undefined,
      props.UPPER_CODE as string | undefined
    ),
    lowerAltitude: formatAirspaceAltitude(
      props.LOWER_VAL as string | undefined,
      props.LOWER_CODE as string | undefined
    ),
    schedule: (props.TIMESOFUSE as string | undefined) ?? undefined,
    state: (props.STATE as string | undefined) ?? undefined,
    isActive: true,
    source: "sua",
  };

  zone.isActive = isZoneActive(zone);
  return zone;
};

/** Fetch SUA zones from ArcGIS, using module-level cache. */
const fetchSuaZones = async (): Promise<AirspaceZone[]> => {
  // Return cached data if still fresh
  if (suaCache && Date.now() - suaCache.fetchedAt < SUA_CACHE_TTL_MS) {
    return suaCache.zones;
  }

  const url = `${SUA_ENDPOINT}?${SUA_PARAMS.toString()}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`ArcGIS returned status ${response.status}`);
  }

  const data: unknown = await response.json();

  if (typeof data !== "object" || data === null) {
    throw new Error("ArcGIS response is not an object");
  }

  const fc = data as Record<string, unknown>;
  const features = fc.features;

  if (!Array.isArray(features)) {
    throw new Error("ArcGIS response missing features array");
  }

  const zones: AirspaceZone[] = [];
  for (const feature of features) {
    if (isValidSuaFeature(feature)) {
      zones.push(suaFeatureToZone(feature as Record<string, unknown>));
    }
  }

  // Update cache
  suaCache = { zones, fetchedAt: Date.now() };

  return zones;
};

// ---------------------------------------------------------------------------
// TFR Fetch (FAA API + GeoServer)
// ---------------------------------------------------------------------------

/** Shape of a single TFR entry from the FAA list API. */
interface TfrListItem {
  notam_id: string;
  facility: string;
  state: string;
  type: string;
  description: string;
  mod_date: string;
}

/** Shape of GeoServer TFR feature properties. */
interface TfrGeoProperties {
  GID: number;
  CNS_LOCATION_ID: string;
  NOTAM_KEY: string;
  TITLE: string;
  LAST_MODIFICATION_DATETIME: string;
  STATE: string;
  LEGAL: string;
}

/** Fetch all TFR zones by joining the FAA list API with GeoServer geometry. */
const fetchTfrZones = async (): Promise<AirspaceZone[]> => {
  // Fetch metadata list and geometries in parallel
  const [listResponse, geoResponse] = await Promise.all([
    fetchWithTimeout(TFR_LIST_URL),
    fetchWithTimeout(TFR_GEO_URL),
  ]);

  if (!listResponse.ok) {
    throw new Error(`TFR list API returned status ${listResponse.status}`);
  }
  if (!geoResponse.ok) {
    throw new Error(`TFR GeoServer returned status ${geoResponse.status}`);
  }

  const listData: unknown = await listResponse.json();
  const geoData: unknown = await geoResponse.json();

  if (!Array.isArray(listData)) {
    throw new Error("TFR list API did not return an array");
  }

  if (
    typeof geoData !== "object" ||
    geoData === null ||
    !("features" in geoData) ||
    !Array.isArray((geoData as Record<string, unknown>).features)
  ) {
    throw new Error("TFR GeoServer did not return a valid FeatureCollection");
  }

  const tfrList = listData as TfrListItem[];
  const geoFeatures = (geoData as { features: Array<{
    type: string;
    id: string;
    geometry: GeoJSON.Geometry;
    properties: TfrGeoProperties;
  }> }).features;

  // Build lookup: notam_id -> list metadata
  const listMap = new Map<string, TfrListItem>();
  for (const item of tfrList) {
    listMap.set(item.notam_id, item);
  }

  // Build zones from GeoServer features, enriched with list metadata
  const zones: AirspaceZone[] = [];

  for (const feature of geoFeatures) {
    const props = feature.properties;
    if (!props.NOTAM_KEY || !feature.geometry) continue;

    // Extract base NOTAM ID from key: "6/9526-1-FDC-F" → "6/9526"
    const baseId = props.NOTAM_KEY.split("-")[0];
    const listItem = listMap.get(baseId);

    // Determine type from list API or GeoServer LEGAL field
    const typeStr = listItem?.type || props.LEGAL || "";
    const tfrType = mapTfrApiType(typeStr);

    const title = props.TITLE || listItem?.description || baseId;

    const zone: AirspaceZone = {
      id: `tfr-${props.NOTAM_KEY}`,
      name: `TFR ${baseId} — ${title}`,
      type: "tfr" as AirspaceType,
      tfrType,
      geometry: feature.geometry,
      description: listItem?.description ?? props.TITLE ?? undefined,
      state: props.STATE || listItem?.state || undefined,
      isActive: true,
      source: "tfr",
    };

    zone.isActive = isZoneActive(zone);
    zones.push(zone);
  }

  return zones;
};

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET() {
  // Fetch both sources in parallel
  const [suaResult, tfrResult] = await Promise.allSettled([
    fetchSuaZones(),
    fetchTfrZones(),
  ]);

  const suaOk = suaResult.status === "fulfilled";
  const tfrOk = tfrResult.status === "fulfilled";

  // Both failed → 502
  if (!suaOk && !tfrOk) {
    return NextResponse.json(
      {
        error: "Airspace data unavailable",
        details: [
          `SUA: ${String((suaResult as PromiseRejectedResult).reason)}`,
          `TFR: ${String((tfrResult as PromiseRejectedResult).reason)}`,
        ].join("; "),
      },
      { status: 502 }
    );
  }

  const suaZones = suaOk ? suaResult.value : [];
  const tfrZones = tfrOk ? tfrResult.value : [];
  const allZones = [...suaZones, ...tfrZones];
  const partial = !suaOk || !tfrOk;

  // Compute counts by type
  const counts: Record<AirspaceType, number> = {
    restricted: 0,
    prohibited: 0,
    moa: 0,
    warning: 0,
    alert: 0,
    tfr: 0,
  };

  for (const zone of allZones) {
    counts[zone.type]++;
  }

  // Use TFR cache timing (5 min) since it's the more volatile source.
  // SUA data has its own module-level 24-hour cache.
  return NextResponse.json(
    {
      zones: allZones,
      counts,
      total: allZones.length,
      partial,
      timestamp: Date.now(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=600",
        "Content-Type": "application/json",
      },
    }
  );
}
