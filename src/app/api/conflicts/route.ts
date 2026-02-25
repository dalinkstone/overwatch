import { NextResponse } from "next/server";
import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import {
  type ConflictEvent,
  type ConflictEventEnriched,
  type ConflictApiResponse,
  type ConflictCategory,
  type ConflictActor,
  classifyConflictEvent,
  mapActorTypeCode,
  getActorTypeLabel,
  mapQuadClass,
  mapGeoPrecision,
  getCameoDescription,
} from "@/lib/conflictTypes";

const inflateRawAsync = promisify(inflateRaw);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// GDELT HTTPS is unreliable (TLS handshake timeouts); use HTTP.
const GDELT_GEO_BASE_URL = "http://api.gdeltproject.org/api/v2/geo/geo";
const GDELT_LASTUPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt";
const FETCH_TIMEOUT_MS = 15_000;
const EXPORT_FETCH_TIMEOUT_MS = 30_000;
const GEO_CACHE_TTL_MS = 600_000; // 10 minutes
const EXPORT_CACHE_TTL_MS = 900_000; // 15 minutes
const MERGED_CACHE_TTL_MS = 600_000; // 10 minutes
const EVENT_MAX_AGE_MS = 86_400_000; // 24 hours

const GDELT_PARAMS = new URLSearchParams({
  query: "military conflict",
  mode: "PointData",
  format: "GeoJSON",
  timespan: "24h",
  maxpoints: "500",
});

/** CAMEO root codes that represent conflict events. */
const CONFLICT_ROOT_CODES = new Set(["17", "18", "19", "20"]);

/** Geographic proximity threshold for merging (degrees, ~55km). */
const MERGE_GEO_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Module-level caches
// ---------------------------------------------------------------------------

let geoCache: { response: ConflictApiResponse; at: number } | null = null;
let exportCacheAt = 0;

/** Accumulated Events Export records keyed by GlobalEventID with timestamps. */
const accumulatedEvents = new Map<string, { event: ConflictEventEnriched; addedAt: number }>();

/** Merged response cache. */
let mergedCache: { response: ConflictApiResponse; at: number } | null = null;

// ---------------------------------------------------------------------------
// Helpers — GEO v2 parsing (unchanged from original)
// ---------------------------------------------------------------------------

const makeEventId = (lat: number, lon: number, name: string): string =>
  `${lat.toFixed(2)}_${lon.toFixed(2)}_${name}`;

const extractFirstLink = (
  html: string,
): { url: string; title: string; domain: string } => {
  const hrefMatch = html.match(/href="([^"]+)"/);
  const titleMatch = html.match(/title="([^"]+)"/);
  const url = hrefMatch?.[1] ?? "";
  const title = titleMatch?.[1] ?? "";
  let domain = "";
  try {
    if (url) domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // invalid URL
  }
  return { url, title, domain };
};

const countArticleLinks = (html: string): number => {
  const matches = html.match(/<a /g);
  return matches ? matches.length : 1;
};

const classifyByKeywords = (name: string, title: string): ConflictCategory => {
  const text = `${name} ${title}`.toLowerCase();

  if (
    /\b(massacre|genocide|mass\s*(?:killing|murder|violence|casualt)|ethnic\s*cleansing|atrocit)\b/.test(text)
  ) {
    return "mass-violence";
  }

  if (
    /\b(war|battle|combat|airstrike|air\s*strike|bombing|shelling|offensive|invasion|fighting|artillery|missile\s*strike|drone\s*strike|clash(?:es)?)\b/.test(text)
  ) {
    return "fight";
  }

  if (
    /\b(attack|assault|ambush|raid|shoot(?:ing)?|kill(?:ed|ing)?|wound(?:ed)?|explosion|blast|terror(?:ist|ism)?|suicide\s*bomb|insurgent|militant)\b/.test(text)
  ) {
    return "assault";
  }

  if (
    /\b(sanction|embargo|blockade|threat(?:en)?|ultimatum|coerce|mobiliz|deploy(?:ment)?|escalat|tension|nuclear|military\s*exercis|drill|maneuver)\b/.test(text)
  ) {
    return "coerce";
  }

  return "other";
};

const parseFeature = (feature: unknown): ConflictEvent | null => {
  if (typeof feature !== "object" || feature === null) return null;
  const f = feature as Record<string, unknown>;

  const geometry = f.geometry as Record<string, unknown> | undefined;
  if (!geometry || geometry.type !== "Point") return null;
  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const geoLon = Number(coordinates[0]);
  const geoLat = Number(coordinates[1]);
  if (!Number.isFinite(geoLat) || !Number.isFinite(geoLon)) return null;
  if (geoLat === 0 && geoLon === 0) return null;

  const props = (f.properties ?? {}) as Record<string, unknown>;
  const locationName = String(props.name ?? "Unknown");

  if (locationName.startsWith("ERROR:") || locationName.startsWith("ERROR ")) return null;
  const html = String(props.html ?? "");
  const sharingImage = String(props.shareimage ?? props.sharingImage ?? props.shareImage ?? "");
  const articleCount = Math.max(1, Number(props.count) || 1);

  const firstLink = extractFirstLink(html);
  const numArticleLinks = countArticleLinks(html);

  const name = firstLink.title || locationName;
  const category = classifyByKeywords(locationName, firstLink.title);
  const id = makeEventId(geoLat, geoLon, locationName);

  return {
    id,
    lat: geoLat,
    lon: geoLon,
    name,
    url: firstLink.url,
    domain: firstLink.domain,
    sharingImage,
    dateAdded: new Date().toISOString(),
    tone: 0,
    goldsteinScale: null,
    numArticles: numArticleLinks > articleCount ? numArticleLinks : articleCount,
    category,
  };
};

const deduplicateEvents = (events: ConflictEvent[]): ConflictEvent[] => {
  const map = new Map<string, ConflictEvent>();
  for (const event of events) {
    const existing = map.get(event.id);
    if (!existing || event.numArticles > existing.numArticles) {
      map.set(event.id, event);
    }
  }
  return Array.from(map.values());
};

// ---------------------------------------------------------------------------
// Helpers — Events Export parsing
// ---------------------------------------------------------------------------

/**
 * Parse a zip file buffer and extract the first file's contents.
 * Handles zip local file header manually using built-in zlib for decompression.
 */
const extractFirstFileFromZip = async (zipBuffer: Buffer): Promise<Buffer> => {
  // Zip local file header signature: PK\x03\x04
  if (
    zipBuffer.length < 30 ||
    zipBuffer[0] !== 0x50 ||
    zipBuffer[1] !== 0x4b ||
    zipBuffer[2] !== 0x03 ||
    zipBuffer[3] !== 0x04
  ) {
    throw new Error("Not a valid zip file");
  }

  const compressionMethod = zipBuffer.readUInt16LE(8);
  const compressedSize = zipBuffer.readUInt32LE(18);
  const filenameLength = zipBuffer.readUInt16LE(26);
  const extraFieldLength = zipBuffer.readUInt16LE(28);

  const dataOffset = 30 + filenameLength + extraFieldLength;

  if (compressionMethod === 0) {
    // Stored (no compression)
    return zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
  }

  if (compressionMethod === 8) {
    // Deflate
    const compressed = zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
    return await inflateRawAsync(compressed) as Buffer;
  }

  throw new Error(`Unsupported zip compression method: ${compressionMethod}`);
};

/** Build a ConflictActor from GDELT TSV fields, returns null if no actor data. */
const buildActor = (
  name: string,
  countryCode: string,
  type1Code: string,
): ConflictActor | null => {
  if (!name && !countryCode && !type1Code) return null;
  const actorType = type1Code ? mapActorTypeCode(type1Code) : "other";
  return {
    name: name || "Unknown",
    countryCode: countryCode || "",
    type: actorType,
    label: getActorTypeLabel(actorType),
  };
};

/** Parse a GDELT Events Export TSV row into a ConflictEventEnriched (conflict events only). */
const parseExportRow = (columns: string[]): ConflictEventEnriched | null => {
  if (columns.length < 61) return null;

  const eventRootCode = columns[28]?.trim();
  if (!eventRootCode || !CONFLICT_ROOT_CODES.has(eventRootCode)) return null;

  const actionLat = parseFloat(columns[56]);
  const actionLon = parseFloat(columns[57]);
  if (!Number.isFinite(actionLat) || !Number.isFinite(actionLon)) return null;
  if (actionLat === 0 && actionLon === 0) return null;

  const globalEventId = columns[0]?.trim();
  if (!globalEventId) return null;

  const eventCode = columns[26]?.trim() || null;
  const goldstein = parseFloat(columns[30]);
  const numMentions = parseInt(columns[31], 10) || 0;
  const numSources = parseInt(columns[32], 10) || 0;
  const numArticles = parseInt(columns[33], 10) || 1;
  const avgTone = parseFloat(columns[34]) || 0;
  const quadClassCode = parseInt(columns[29], 10);
  const actionGeoType = parseInt(columns[51], 10);
  const dateAdded = columns[59]?.trim() || "";
  const sourceUrl = columns[60]?.trim() || "";

  // Parse date from DATEADDED (YYYYMMDDHHmmss format)
  let eventDate: string | null = null;
  if (dateAdded.length >= 8) {
    const y = dateAdded.slice(0, 4);
    const m = dateAdded.slice(4, 6);
    const d = dateAdded.slice(6, 8);
    const h = dateAdded.length >= 10 ? dateAdded.slice(8, 10) : "00";
    const min = dateAdded.length >= 12 ? dateAdded.slice(10, 12) : "00";
    eventDate = `${y}-${m}-${d}T${h}:${min}:00Z`;
  }

  let domain = "";
  try {
    if (sourceUrl) domain = new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    // invalid URL
  }

  const actor1 = buildActor(
    columns[6]?.trim() || "",
    columns[7]?.trim() || "",
    columns[12]?.trim() || "",
  );

  const actor2 = buildActor(
    columns[16]?.trim() || "",
    columns[17]?.trim() || "",
    columns[22]?.trim() || "",
  );

  const category = classifyConflictEvent(eventCode || "", eventRootCode);
  const cameoDescription = eventCode ? getCameoDescription(eventCode) : null;

  return {
    id: `gdelt-${globalEventId}`,
    lat: actionLat,
    lon: actionLon,
    name: actor1?.name && actor2?.name
      ? `${actor1.name} \u2192 ${actor2.name}`
      : columns[52]?.trim() || "Unknown event",
    url: sourceUrl,
    domain,
    sharingImage: "",
    dateAdded: eventDate || new Date().toISOString(),
    tone: avgTone,
    goldsteinScale: Number.isFinite(goldstein) ? goldstein : null,
    numArticles,
    category,
    actor1,
    actor2,
    cameoCode: eventCode,
    cameoRootCode: eventRootCode,
    cameoDescription,
    quadClass: Number.isFinite(quadClassCode) ? mapQuadClass(quadClassCode) : null,
    geoPrecision: Number.isFinite(actionGeoType) ? mapGeoPrecision(actionGeoType) : "unknown",
    eventDate,
    numSources,
    numMentions,
    isEnriched: true,
  };
};

// ---------------------------------------------------------------------------
// GEO v2 fetch
// ---------------------------------------------------------------------------

const isGdeltErrorResponse = (features: unknown[]): string | null => {
  if (features.length !== 1) return null;
  const f0 = features[0] as Record<string, unknown> | undefined;
  if (!f0) return null;
  const g0 = f0.geometry as Record<string, unknown> | undefined;
  const c0 = g0?.coordinates;
  const p0 = f0.properties as Record<string, unknown> | undefined;
  const name = String(p0?.name ?? "");
  if (
    Array.isArray(c0) &&
    Number(c0[0]) === 0 &&
    Number(c0[1]) === 0 &&
    name.toUpperCase().startsWith("ERROR")
  ) {
    return name;
  }
  return null;
};

const fetchGeoV2 = async (): Promise<ConflictEvent[]> => {
  const url = `${GDELT_GEO_BASE_URL}?${GDELT_PARAMS.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`GDELT GEO returned status ${response.status}`);
  }

  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null) {
    throw new Error("GDELT GEO response is not an object");
  }

  const fc = data as Record<string, unknown>;
  const features = fc.features;
  if (!Array.isArray(features)) {
    throw new Error("GDELT GEO response missing features array");
  }

  const gdeltError = isGdeltErrorResponse(features);
  if (gdeltError) {
    throw new Error(`GDELT rate-limited: ${gdeltError}`);
  }

  const events: ConflictEvent[] = [];
  for (const feature of features) {
    const parsed = parseFeature(feature);
    if (parsed) events.push(parsed);
  }

  return deduplicateEvents(events);
};

// ---------------------------------------------------------------------------
// Events Export fetch
// ---------------------------------------------------------------------------

const fetchEventsExport = async (): Promise<ConflictEventEnriched[]> => {
  // Step 1: Get latest update file list
  const controller1 = new AbortController();
  const timeout1 = setTimeout(() => controller1.abort(), FETCH_TIMEOUT_MS);
  let updateText: string;
  try {
    const resp = await fetch(GDELT_LASTUPDATE_URL, { signal: controller1.signal });
    if (!resp.ok) throw new Error(`lastupdate.txt returned ${resp.status}`);
    updateText = await resp.text();
  } finally {
    clearTimeout(timeout1);
  }

  // Parse first line to find the export CSV zip URL
  // Format: "size hash url" per line, first line is export file
  const lines = updateText.trim().split("\n");
  let exportUrl: string | null = null;
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const url = parts[parts.length - 1];
    if (url && url.endsWith(".export.CSV.zip")) {
      exportUrl = url;
      break;
    }
  }

  if (!exportUrl) {
    throw new Error("Could not find export CSV URL in lastupdate.txt");
  }

  // Step 2: Fetch the zip file
  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), EXPORT_FETCH_TIMEOUT_MS);
  let zipBuffer: Buffer;
  try {
    const resp = await fetch(exportUrl, { signal: controller2.signal });
    if (!resp.ok) throw new Error(`Export zip returned ${resp.status}`);
    const arrayBuf = await resp.arrayBuffer();
    zipBuffer = Buffer.from(arrayBuf);
  } finally {
    clearTimeout(timeout2);
  }

  // Step 3: Extract CSV from zip
  const csvBuffer = await extractFirstFileFromZip(zipBuffer);
  const csvText = csvBuffer.toString("utf-8");

  // Step 4: Parse TSV rows, filter to conflict events
  const rows = csvText.split("\n");
  const events: ConflictEventEnriched[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!row.trim()) continue;
    const columns = row.split("\t");
    try {
      const event = parseExportRow(columns);
      if (event) events.push(event);
    } catch {
      skipped++;
    }
  }

  if (skipped > 0) {
    console.warn(`[conflicts] Skipped ${skipped} malformed export rows`);
  }

  return events;
};

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

/** Convert a GEO v2 ConflictEvent to an unenriched ConflictEventEnriched. */
const toUnenriched = (event: ConflictEvent): ConflictEventEnriched => ({
  ...event,
  actor1: null,
  actor2: null,
  cameoCode: null,
  cameoRootCode: null,
  cameoDescription: null,
  quadClass: null,
  geoPrecision: "unknown",
  eventDate: null,
  numSources: 0,
  numMentions: 0,
  isEnriched: false,
});

/**
 * Merge GEO v2 events with Events Export records.
 * GEO v2 is primary for geolocation; Export provides structured metadata.
 */
const mergeEvents = (
  geoEvents: ConflictEvent[],
  exportEvents: ConflictEventEnriched[],
): ConflictEventEnriched[] => {
  const matchedExportIds = new Set<string>();
  const merged: ConflictEventEnriched[] = [];

  for (const geo of geoEvents) {
    // Find best matching export event by geographic proximity
    let bestMatch: ConflictEventEnriched | null = null;
    let bestDist = Infinity;

    for (const exp of exportEvents) {
      if (matchedExportIds.has(exp.id)) continue;
      const dLat = Math.abs(geo.lat - exp.lat);
      const dLon = Math.abs(geo.lon - exp.lon);
      if (dLat > MERGE_GEO_THRESHOLD || dLon > MERGE_GEO_THRESHOLD) continue;
      const dist = dLat + dLon; // Manhattan distance for speed
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = exp;
      }
    }

    if (bestMatch) {
      matchedExportIds.add(bestMatch.id);
      // Use GEO v2 for position/name/url, Export for structured metadata
      const category = bestMatch.cameoRootCode
        ? classifyConflictEvent(bestMatch.cameoCode || "", bestMatch.cameoRootCode)
        : geo.category;

      merged.push({
        ...geo,
        category,
        goldsteinScale: bestMatch.goldsteinScale ?? geo.goldsteinScale,
        tone: bestMatch.tone !== 0 ? bestMatch.tone : geo.tone,
        actor1: bestMatch.actor1,
        actor2: bestMatch.actor2,
        cameoCode: bestMatch.cameoCode,
        cameoRootCode: bestMatch.cameoRootCode,
        cameoDescription: bestMatch.cameoDescription,
        quadClass: bestMatch.quadClass,
        geoPrecision: bestMatch.geoPrecision,
        eventDate: bestMatch.eventDate,
        numSources: bestMatch.numSources,
        numMentions: bestMatch.numMentions,
        isEnriched: true,
      });
    } else {
      merged.push(toUnenriched(geo));
    }
  }

  // Add unmatched export events as standalone
  for (const exp of exportEvents) {
    if (!matchedExportIds.has(exp.id)) {
      merged.push(exp);
    }
  }

  return merged;
};

// ---------------------------------------------------------------------------
// Accumulated events store management
// ---------------------------------------------------------------------------

const pruneAccumulatedEvents = (): void => {
  const cutoff = Date.now() - EVENT_MAX_AGE_MS;
  for (const [id, entry] of accumulatedEvents) {
    if (entry.addedAt < cutoff) {
      accumulatedEvents.delete(id);
    }
  }
};

const addToAccumulated = (events: ConflictEventEnriched[]): void => {
  const now = Date.now();
  for (const event of events) {
    const existing = accumulatedEvents.get(event.id);
    if (!existing || event.numArticles > existing.event.numArticles) {
      accumulatedEvents.set(event.id, { event, addedAt: now });
    }
  }
};

const getAccumulatedEvents = (): ConflictEventEnriched[] =>
  Array.from(accumulatedEvents.values()).map((e) => e.event);

// ---------------------------------------------------------------------------
// Cache validation
// ---------------------------------------------------------------------------

const isGeoCacheValid = (): boolean => {
  if (!geoCache) return false;
  if (Date.now() - geoCache.at > GEO_CACHE_TTL_MS) return false;
  if (geoCache.response.events.length === 0) return false;
  return true;
};

const isExportCacheValid = (): boolean =>
  Date.now() - exportCacheAt < EXPORT_CACHE_TTL_MS;

const isMergedCacheValid = (): boolean => {
  if (!mergedCache) return false;
  if (Date.now() - mergedCache.at > MERGED_CACHE_TTL_MS) return false;
  if (mergedCache.response.events.length === 0) return false;
  return true;
};

const hasGeoStaleFallback = (): boolean =>
  geoCache !== null && geoCache.response.events.length > 0;

// ---------------------------------------------------------------------------
// JSON response helpers
// ---------------------------------------------------------------------------

const jsonHeaders = (maxAge: number, swr: number) => ({
  "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${swr}`,
  "Content-Type": "application/json",
});

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET() {
  // Serve from merged cache if valid
  if (isMergedCacheValid()) {
    return NextResponse.json(mergedCache!.response, {
      status: 200,
      headers: jsonHeaders(600, 300),
    });
  }

  let geoEvents: ConflictEvent[] = [];
  let partial = false;

  // Fetch GEO v2
  try {
    if (isGeoCacheValid()) {
      geoEvents = geoCache!.response.events as ConflictEvent[];
    } else {
      geoEvents = await fetchGeoV2();
      if (geoEvents.length > 0) {
        geoCache = {
          response: {
            events: geoEvents.map(toUnenriched),
            total: geoEvents.length,
            timestamp: new Date().toISOString(),
            partial: false,
          },
          at: Date.now(),
        };
      }
    }
  } catch (error) {
    console.error("[conflicts] GEO v2 fetch failed:", error);
    // Use stale GEO cache if available
    if (hasGeoStaleFallback()) {
      geoEvents = geoCache!.response.events as ConflictEvent[];
      partial = true;
    }
  }

  // Fetch Events Export (only if cache expired)
  try {
    if (!isExportCacheValid()) {
      const newExportEvents = await fetchEventsExport();
      pruneAccumulatedEvents();
      addToAccumulated(newExportEvents);
      exportCacheAt = Date.now();
    }
  } catch (error) {
    console.error("[conflicts] Events Export fetch failed:", error);
    partial = true;
  }

  const exportEvents = getAccumulatedEvents();

  // Merge
  const merged = mergeEvents(geoEvents, exportEvents);

  if (merged.length === 0 && geoEvents.length === 0) {
    // Both sources empty — return stale if available
    if (hasGeoStaleFallback()) {
      return NextResponse.json(
        { ...geoCache!.response, partial: true } as ConflictApiResponse,
        { status: 200, headers: jsonHeaders(60, 60) },
      );
    }

    return NextResponse.json(
      {
        events: [],
        total: 0,
        timestamp: new Date().toISOString(),
        partial: true,
      } satisfies ConflictApiResponse,
      { status: 200, headers: jsonHeaders(60, 60) },
    );
  }

  const result: ConflictApiResponse = {
    events: merged,
    total: merged.length,
    timestamp: new Date().toISOString(),
    partial,
  };

  mergedCache = { response: result, at: Date.now() };

  return NextResponse.json(result, {
    status: 200,
    headers: jsonHeaders(600, 300),
  });
}
