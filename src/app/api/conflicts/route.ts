import { NextResponse } from "next/server";
import {
  type ConflictEvent,
  type ConflictApiResponse,
  type ConflictCategory,
} from "@/lib/conflictTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// GDELT HTTPS is unreliable (TLS handshake timeouts); use HTTP.
const GDELT_BASE_URL = "http://api.gdeltproject.org/api/v2/geo/geo";
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 600_000; // 10 minutes

const GDELT_PARAMS = new URLSearchParams({
  query: "military conflict",
  mode: "PointData",
  format: "GeoJSON",
  timespan: "24h",
  maxpoints: "500",
});

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let cachedResponse: ConflictApiResponse | null = null;
let cachedAt = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a deterministic ID from event fields. */
const makeEventId = (lat: number, lon: number, name: string): string =>
  `${lat.toFixed(2)}_${lon.toFixed(2)}_${name}`;

/**
 * Extract the first URL and its title from the GDELT html property.
 * The html field contains anchor tags like: <a href="URL" title="TITLE" ...>TEXT</a>
 */
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

/** Count the number of article links in the html field. */
const countArticleLinks = (html: string): number => {
  const matches = html.match(/<a /g);
  return matches ? matches.length : 1;
};

/**
 * Classify a conflict hotspot based on the event name and article title.
 * Since GDELT GEO v2 pointdata mode doesn't return CAMEO codes, we use
 * keyword-based heuristics on the name/title to approximate category.
 */
const classifyByKeywords = (name: string, title: string): ConflictCategory => {
  const text = `${name} ${title}`.toLowerCase();

  // Mass violence keywords
  if (
    /\b(massacre|genocide|mass\s*(?:killing|murder|violence|casualt)|ethnic\s*cleansing|atrocit)\b/.test(text)
  ) {
    return "mass-violence";
  }

  // Fight / armed conflict keywords
  if (
    /\b(war|battle|combat|airstrike|air\s*strike|bombing|shelling|offensive|invasion|fighting|artillery|missile\s*strike|drone\s*strike|clash(?:es)?)\b/.test(text)
  ) {
    return "fight";
  }

  // Assault keywords
  if (
    /\b(attack|assault|ambush|raid|shoot(?:ing)?|kill(?:ed|ing)?|wound(?:ed)?|explosion|blast|terror(?:ist|ism)?|suicide\s*bomb|insurgent|militant)\b/.test(text)
  ) {
    return "assault";
  }

  // Coercion keywords
  if (
    /\b(sanction|embargo|blockade|threat(?:en)?|ultimatum|coerce|mobiliz|deploy(?:ment)?|escalat|tension|nuclear|military\s*exercis|drill|maneuver)\b/.test(text)
  ) {
    return "coerce";
  }

  return "other";
};

/** Parse a single GeoJSON feature from GDELT GEO v2 pointdata into a ConflictEvent. */
const parseFeature = (feature: unknown): ConflictEvent | null => {
  if (typeof feature !== "object" || feature === null) return null;
  const f = feature as Record<string, unknown>;

  // Validate geometry
  const geometry = f.geometry as Record<string, unknown> | undefined;
  if (!geometry || geometry.type !== "Point") return null;
  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const geoLon = Number(coordinates[0]);
  const geoLat = Number(coordinates[1]);
  if (!Number.isFinite(geoLat) || !Number.isFinite(geoLon)) return null;

  // Reject [0,0] — GDELT uses this for error responses and it's not a real location
  if (geoLat === 0 && geoLon === 0) return null;

  // Extract properties (GDELT GEO v2 pointdata: name, count, shareimage, html)
  const props = (f.properties ?? {}) as Record<string, unknown>;
  const locationName = String(props.name ?? "Unknown");

  // Reject GDELT error messages embedded as features
  if (locationName.startsWith("ERROR:") || locationName.startsWith("ERROR ")) return null;
  const html = String(props.html ?? "");
  const sharingImage = String(props.shareimage ?? props.sharingImage ?? props.shareImage ?? "");
  const articleCount = Math.max(1, Number(props.count) || 1);

  // Extract first article link from the html field
  const firstLink = extractFirstLink(html);
  const numArticleLinks = countArticleLinks(html);

  // Use the article title as the event name if available, otherwise the location name
  const name = firstLink.title || locationName;

  // Classify by keyword analysis
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

/** Deduplicate events by id — keep the one with highest numArticles. */
const deduplicateEvents = (events: ConflictEvent[]): ConflictEvent[] => {
  const map = new Map<string, ConflictEvent>();

  for (const event of events) {
    const existing = map.get(event.id);
    if (!existing) {
      map.set(event.id, event);
      continue;
    }
    if (event.numArticles > existing.numArticles) {
      map.set(event.id, event);
    }
  }

  return Array.from(map.values());
};

// ---------------------------------------------------------------------------
// Cache validation
// ---------------------------------------------------------------------------

/** A cached response is only valid if it has actual events. */
const isCacheValid = (): boolean => {
  if (!cachedResponse) return false;
  if (Date.now() - cachedAt > CACHE_TTL_MS) return false;
  // Never serve a cache with zero events — that was likely a GDELT error
  if (cachedResponse.events.length === 0) return false;
  return true;
};

/** A cached response is usable as stale fallback if it has events. */
const hasStaleFallback = (): boolean => {
  return cachedResponse !== null && cachedResponse.events.length > 0;
};

// ---------------------------------------------------------------------------
// GDELT response detection
// ---------------------------------------------------------------------------

/**
 * GDELT returns rate-limit/error responses as valid 200 GeoJSON with a
 * single feature at [0,0] whose name starts with "ERROR:".
 * This function detects that pattern in the raw features array.
 */
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
  // Serve from cache only if it contains real data
  if (isCacheValid()) {
    return NextResponse.json(cachedResponse, {
      status: 200,
      headers: jsonHeaders(600, 300),
    });
  }

  try {
    const url = `${GDELT_BASE_URL}?${GDELT_PARAMS.toString()}`;
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
      throw new Error(`GDELT returned status ${response.status}`);
    }

    const data: unknown = await response.json();

    if (typeof data !== "object" || data === null) {
      throw new Error("GDELT response is not an object");
    }

    const fc = data as Record<string, unknown>;
    const features = fc.features;

    if (!Array.isArray(features)) {
      throw new Error("GDELT response missing features array");
    }

    // Detect GDELT error-as-data (rate limit / server error)
    const gdeltError = isGdeltErrorResponse(features);
    if (gdeltError) {
      throw new Error(`GDELT rate-limited: ${gdeltError}`);
    }

    // Parse all valid features
    const events: ConflictEvent[] = [];
    for (const feature of features) {
      const parsed = parseFeature(feature);
      if (parsed) {
        events.push(parsed);
      }
    }

    // Deduplicate
    const deduplicated = deduplicateEvents(events);

    // Only cache if we actually got events
    if (deduplicated.length > 0) {
      const result: ConflictApiResponse = {
        events: deduplicated,
        total: deduplicated.length,
        timestamp: new Date().toISOString(),
        partial: false,
      };

      cachedResponse = result;
      cachedAt = Date.now();

      return NextResponse.json(result, {
        status: 200,
        headers: jsonHeaders(600, 300),
      });
    }

    // GDELT returned valid GeoJSON but zero parseable events — don't cache
    throw new Error("GDELT returned no parseable conflict events");
  } catch (error) {
    console.error("[conflicts] GDELT fetch failed:", error);

    // Return stale cache only if it has real data
    if (hasStaleFallback()) {
      return NextResponse.json(
        { ...cachedResponse, partial: true } as ConflictApiResponse,
        { status: 200, headers: jsonHeaders(60, 60) },
      );
    }

    // No usable cache — return empty with partial flag
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
}
