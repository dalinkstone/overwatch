import { NextResponse } from "next/server";
import {
  type AirspaceZone,
  type AirspaceType,
  mapSuaTypeCode,
  classifyTfr,
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
    "NAME,TYPE_CODE,LOCAL_TYPE,UPPER_VAL,UPPER_UOM,LOWER_VAL,LOWER_UOM,CITY,STATE,COUNTRY,SCHEDULE",
  f: "geojson",
  outSR: "4326",
});

const TFR_LIST_URL = "https://tfr.faa.gov/tfr2/list.html";
const TFR_DETAIL_BASE = "https://tfr.faa.gov/save_pages/detail_";

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

/**
 * Generate a GeoJSON polygon ring approximating a circle.
 * Uses the Haversine-based destination point formula.
 * @param lat  Center latitude in degrees
 * @param lon  Center longitude in degrees
 * @param radiusNm  Radius in nautical miles
 * @param numPoints  Number of polygon vertices (default 64)
 * @returns Array of [lon, lat] coordinate pairs forming a closed ring
 */
const circleToPolygon = (
  lat: number,
  lon: number,
  radiusNm: number,
  numPoints: number = 64
): [number, number][] => {
  const radiusKm = radiusNm * 1.852;
  const earthRadiusKm = 6371;
  const angularDistance = radiusKm / earthRadiusKm;

  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  const points: [number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    const bearing = (2 * Math.PI * i) / numPoints;

    const destLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    const destLon =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLat)
      );

    points.push([(destLon * 180) / Math.PI, (destLat * 180) / Math.PI]);
  }

  return points;
};

/**
 * Extract text content of the first matching XML element.
 * Simple regex-based parser — avoids adding an XML library dependency.
 */
const xmlText = (xml: string, tag: string): string | undefined => {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
};

/** Extract all matches of a tag's text content. */
const xmlTextAll = (xml: string, tag: string): string[] => {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
};

/** Extract all XML blocks matching a given element name. */
const xmlBlocks = (xml: string, tag: string): string[] => {
  const regex = new RegExp(
    `<${tag}[^>]*>[\\s\\S]*?</${tag}>`,
    "gi"
  );
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[0]);
  }
  return results;
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
      props.UPPER_UOM as string | undefined
    ),
    lowerAltitude: formatAirspaceAltitude(
      props.LOWER_VAL as string | undefined,
      props.LOWER_UOM as string | undefined
    ),
    schedule: (props.SCHEDULE as string | undefined) ?? undefined,
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
// TFR Fetch (FAA)
// ---------------------------------------------------------------------------

/** Parse the TFR list HTML to extract NOTAM IDs. */
const parseTfrList = (html: string): string[] => {
  // The TFR list page contains links with NOTAM IDs in various formats.
  // Look for patterns like detail_X_XXXX.html or NOTAM IDs in the format X/XXXX.
  const ids: string[] = [];
  const seen = new Set<string>();

  // Match detail page links: detail_X_XXXX.html
  const linkRegex = /detail_(\d+_\d+)\.html/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  // Also try matching the NOTAM ID format directly (X/XXXX) and convert to X_XXXX
  if (ids.length === 0) {
    const notamRegex = /(\d+)\/(\d+)/g;
    while ((match = notamRegex.exec(html)) !== null) {
      const id = `${match[1]}_${match[2]}`;
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }

  return ids;
};

/** Parse a TFR detail XML into AirspaceZone(s). */
const parseTfrDetail = (xml: string, notamId: string): AirspaceZone[] => {
  const zones: AirspaceZone[] = [];

  // Extract top-level metadata
  const txtName = xmlText(xml, "txtName") ?? notamId.replace("_", "/");
  const dateEffective = xmlText(xml, "dateEffective");
  const dateExpire = xmlText(xml, "dateExpire");

  // Gather description text from multiple possible elements
  const descriptions = xmlTextAll(xml, "txtDescrUSNS");
  const codeType = xmlText(xml, "codeType");
  const descriptionText =
    descriptions.join(" ").trim() ||
    xmlText(xml, "txtDescrTraditional") ||
    xmlText(xml, "txtLocalName") ||
    "";

  // Classify the TFR type from combined text sources
  const classificationInput = [
    codeType ?? "",
    descriptionText,
    txtName,
  ].join(" ");
  const tfrType = classifyTfr(classificationInput);

  // Parse effective times to ISO strings
  const effectiveStart = dateEffective
    ? parseFaaDateTime(dateEffective)
    : undefined;
  const effectiveEnd = dateExpire ? parseFaaDateTime(dateExpire) : undefined;

  // Extract TFR areas — each area may have its own geometry
  const areaBlocks = xmlBlocks(xml, "TFRArea");

  // If no TFRArea blocks found, try parsing the whole document as a single area
  const blocksToProcess = areaBlocks.length > 0 ? areaBlocks : [xml];

  for (let i = 0; i < blocksToProcess.length; i++) {
    const block = blocksToProcess[i];
    const geometry = extractTfrGeometry(block);

    if (!geometry) continue;

    const suffix = blocksToProcess.length > 1 ? `-${i}` : "";
    const displayId = notamId.replace("_", "/");

    const zone: AirspaceZone = {
      id: `tfr-${notamId}${suffix}`,
      name: `TFR ${displayId}`,
      type: "tfr" as AirspaceType,
      tfrType,
      geometry: geometry.geojson,
      description: descriptionText || undefined,
      effectiveStart,
      effectiveEnd,
      isActive: true,
      source: "tfr",
    };

    if (geometry.center) {
      zone.center = geometry.center;
      zone.radiusNm = geometry.radiusNm;
    }

    // Extract altitude from the area block
    const upperVal = xmlText(block, "valDistVerUpper") ?? xmlText(block, "codeDistVerUpper");
    const upperUom = xmlText(block, "uomDistVerUpper");
    const lowerVal = xmlText(block, "valDistVerLower") ?? xmlText(block, "codeDistVerLower");
    const lowerUom = xmlText(block, "uomDistVerLower");

    if (upperVal) zone.upperAltitude = formatAirspaceAltitude(upperVal, upperUom);
    if (lowerVal) zone.lowerAltitude = formatAirspaceAltitude(lowerVal, lowerUom);

    zone.isActive = isZoneActive(zone);
    zones.push(zone);
  }

  return zones;
};

interface TfrGeometry {
  geojson: GeoJSON.Geometry;
  center?: { lat: number; lon: number };
  radiusNm?: number;
}

/** Extract geometry from a TFR area XML block. */
const extractTfrGeometry = (xml: string): TfrGeometry | null => {
  // Try circular TFR first (most common)
  const circleBlock = xmlBlocks(xml, "avxCircle")[0];
  if (circleBlock) {
    return parseCircleGeometry(circleBlock);
  }

  // Try polygon points
  const polyPoints = extractPolygonPoints(xml);
  if (polyPoints && polyPoints.length >= 3) {
    // Close the ring if not already closed
    const first = polyPoints[0];
    const last = polyPoints[polyPoints.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      polyPoints.push([...first]);
    }
    return {
      geojson: {
        type: "Polygon",
        coordinates: [polyPoints],
      },
    };
  }

  return null;
};

/** Parse circular TFR geometry from avxCircle element. */
const parseCircleGeometry = (circleXml: string): TfrGeometry | null => {
  // Extract latitude — look for geoLat or latitude in various formats
  const latStr =
    xmlText(circleXml, "geoLat") ??
    xmlText(circleXml, "geoLatCtr") ??
    xmlText(circleXml, "latitude");
  const lonStr =
    xmlText(circleXml, "geoLong") ??
    xmlText(circleXml, "geoLongCtr") ??
    xmlText(circleXml, "longitude");
  const radiusStr =
    xmlText(circleXml, "valRadius") ??
    xmlText(circleXml, "codeDistDim");
  const uom = xmlText(circleXml, "uomRadius") ?? "NM";

  if (!latStr || !lonStr || !radiusStr) return null;

  const lat = parseFaaCoordinate(latStr);
  const lon = parseFaaCoordinate(lonStr);
  const radiusRaw = parseFloat(radiusStr);

  if (isNaN(lat) || isNaN(lon) || isNaN(radiusRaw)) return null;

  // Convert to nautical miles if needed
  const radiusNm = uom.toUpperCase() === "NM" ? radiusRaw : radiusRaw / 1.852;

  // Generate polygon approximation
  const ring = circleToPolygon(lat, lon, radiusNm);

  return {
    geojson: {
      type: "Polygon",
      coordinates: [ring],
    },
    center: { lat, lon },
    radiusNm,
  };
};

/** Extract polygon coordinate points from avxPoly/avxArc elements. */
const extractPolygonPoints = (xml: string): [number, number][] | null => {
  const points: [number, number][] = [];

  // Look for individual coordinate pairs in various AIXM element forms
  const coordBlocks = [
    ...xmlBlocks(xml, "avxPoly"),
    ...xmlBlocks(xml, "Avx"),
  ];

  for (const block of coordBlocks) {
    const latStr = xmlText(block, "geoLat") ?? xmlText(block, "geoLatArc");
    const lonStr = xmlText(block, "geoLong") ?? xmlText(block, "geoLongArc");

    if (!latStr || !lonStr) continue;

    const lat = parseFaaCoordinate(latStr);
    const lon = parseFaaCoordinate(lonStr);

    if (!isNaN(lat) && !isNaN(lon)) {
      points.push([lon, lat]); // GeoJSON is [lon, lat]
    }
  }

  return points.length >= 3 ? points : null;
};

/**
 * Parse FAA coordinate strings.
 * Supports decimal degrees (e.g., "38.8977") and DMS formats
 * (e.g., "38°53'51.66\"N", "38-53-51.66N", "385351.66N").
 */
const parseFaaCoordinate = (coord: string): number => {
  const trimmed = coord.trim();

  // Try decimal degrees first
  const decimal = parseFloat(trimmed);
  if (!isNaN(decimal) && /^-?\d+\.?\d*$/.test(trimmed)) {
    return decimal;
  }

  // Try DMS format: various separators and hemisphere suffixes
  // Patterns: "385351.66N", "38-53-51.66N", "38°53'51.66"N"
  const dmsRegex =
    /(-?\d{1,3})[°\u002D]?\s*(\d{1,2})['′\u002D]?\s*(\d{1,2}(?:\.\d+)?)[""″]?\s*([NSEW])?/i;
  const dmsMatch = trimmed.match(dmsRegex);
  if (dmsMatch) {
    const deg = parseInt(dmsMatch[1], 10);
    const min = parseInt(dmsMatch[2], 10);
    const sec = parseFloat(dmsMatch[3]);
    const dir = dmsMatch[4]?.toUpperCase();

    let value = Math.abs(deg) + min / 60 + sec / 3600;
    if (dir === "S" || dir === "W" || deg < 0) value = -value;
    return value;
  }

  // Try packed DMS format without separators: "DDMMSS.ssH" or "DDDMMSS.ssH"
  const packedRegex = /^(-?\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])?$/i;
  const packedMatch = trimmed.match(packedRegex);
  if (packedMatch) {
    const deg = parseInt(packedMatch[1], 10);
    const min = parseInt(packedMatch[2], 10);
    const sec = parseFloat(packedMatch[3]);
    const dir = packedMatch[4]?.toUpperCase();

    let value = Math.abs(deg) + min / 60 + sec / 3600;
    if (dir === "S" || dir === "W" || deg < 0) value = -value;
    return value;
  }

  return parseFloat(trimmed);
};

/** Parse FAA datetime strings to ISO format. Handles "YYYY-MM-DDTHH:MM:SS" and other FAA formats. */
const parseFaaDateTime = (dateStr: string): string | undefined => {
  const trimmed = dateStr.trim();
  if (!trimmed) return undefined;

  // Already ISO-ish — just ensure it parses
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }

  // Try FAA format: "MM/DD/YYYY HH:MM"
  const faaRegex = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/;
  const faaMatch = trimmed.match(faaRegex);
  if (faaMatch) {
    const isoStr = `${faaMatch[3]}-${faaMatch[1]}-${faaMatch[2]}T${faaMatch[4]}:${faaMatch[5]}:00Z`;
    const parsed = new Date(isoStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return undefined;
};

/** Fetch all TFR zones from the FAA TFR feed. */
const fetchTfrZones = async (): Promise<AirspaceZone[]> => {
  // Step 1: Fetch the TFR list page
  const listResponse = await fetchWithTimeout(TFR_LIST_URL);
  if (!listResponse.ok) {
    throw new Error(`TFR list returned status ${listResponse.status}`);
  }

  const listHtml = await listResponse.text();
  const notamIds = parseTfrList(listHtml);

  if (notamIds.length === 0) {
    return [];
  }

  // Step 2: Fetch detail XMLs in parallel (with allSettled for resilience)
  const detailResults = await Promise.allSettled(
    notamIds.map(async (id) => {
      const url = `${TFR_DETAIL_BASE}${id}.xml`;
      const response = await fetchWithTimeout(url, 15_000);
      if (!response.ok) {
        throw new Error(`TFR detail ${id} returned status ${response.status}`);
      }
      const xml = await response.text();
      return { id, xml };
    })
  );

  // Step 3: Parse each detail XML into AirspaceZone(s)
  const zones: AirspaceZone[] = [];

  for (const result of detailResults) {
    if (result.status === "fulfilled") {
      try {
        const parsed = parseTfrDetail(result.value.xml, result.value.id);
        zones.push(...parsed);
      } catch {
        // Individual TFR parse failure — skip silently
      }
    }
    // Rejected fetches are silently skipped (allSettled handles them)
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
