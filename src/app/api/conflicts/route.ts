import { NextResponse } from "next/server";
import {
  type ConflictEvent,
  type ConflictApiResponse,
  classifyConflictEvent,
} from "@/lib/conflictTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GDELT_BASE_URL = "https://api.gdeltproject.org/api/v2/geo/geo";
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 600_000; // 10 minutes

const GDELT_PARAMS = new URLSearchParams({
  query: "military+conflict",
  mode: "pointdata",
  format: "geojson",
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
const makeEventId = (lat: number, lon: number, name: string, domain: string): string =>
  `${lat.toFixed(2)}_${lon.toFixed(2)}_${name}_${domain}`;

/** Safely parse a comma-separated tone string; return the first value or 0. */
const parseTone = (raw: unknown): number => {
  if (typeof raw !== "string" && typeof raw !== "number") return 0;
  const str = String(raw);
  const first = str.split(",")[0];
  const parsed = parseFloat(first);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Parse a single GeoJSON feature into a ConflictEvent, or return null if invalid. */
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

  // Extract properties
  const props = (f.properties ?? {}) as Record<string, unknown>;
  const name = String(props.name ?? props.Name ?? props.title ?? "Unknown event");
  const url = String(props.url ?? props.URL ?? "");
  const domain = String(props.domain ?? props.Domain ?? "");
  const sharingImage = String(props.sharingimage ?? props.sharingImage ?? "");

  // Tone
  const tone = parseTone(props.tone ?? props.Tone);

  // Goldstein scale — may not be present in GEO v2
  const rawGoldstein = props.goldsteinscale ?? props.GoldsteinScale ?? props.goldstein;
  const goldsteinScale =
    rawGoldstein !== undefined && rawGoldstein !== null
      ? (Number.isFinite(Number(rawGoldstein)) ? Number(rawGoldstein) : null)
      : null;

  // Number of articles
  const rawArticles = props.numarticles ?? props.numArticles ?? props.NumArticles;
  const numArticles =
    rawArticles !== undefined ? Math.max(1, Math.floor(Number(rawArticles) || 1)) : 1;

  // Date
  const dateAdded = String(
    props.dateadded ?? props.dateAdded ?? props.date ?? new Date().toISOString()
  );

  // CAMEO classification — use if present, otherwise default to 'other'
  const cameoRaw = props.EventCode ?? props.eventcode ?? props.cameocode ?? props.CAMEOCode;
  const category =
    typeof cameoRaw === "string" || typeof cameoRaw === "number"
      ? classifyConflictEvent(String(cameoRaw))
      : "other";

  const id = makeEventId(geoLat, geoLon, name, domain);

  return {
    id,
    lat: geoLat,
    lon: geoLon,
    name,
    url,
    domain,
    sharingImage,
    dateAdded,
    tone,
    goldsteinScale,
    numArticles,
    category,
  };
};

/** Deduplicate events by id — keep the one with highest numArticles or most recent dateAdded. */
const deduplicateEvents = (events: ConflictEvent[]): ConflictEvent[] => {
  const map = new Map<string, ConflictEvent>();

  for (const event of events) {
    const existing = map.get(event.id);
    if (!existing) {
      map.set(event.id, event);
      continue;
    }
    // Prefer more articles, then more recent date
    if (
      event.numArticles > existing.numArticles ||
      (event.numArticles === existing.numArticles && event.dateAdded > existing.dateAdded)
    ) {
      map.set(event.id, event);
    }
  }

  return Array.from(map.values());
};

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET() {
  // Cache check
  if (cachedResponse && Date.now() - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedResponse, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=300",
        "Content-Type": "application/json",
      },
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

    const result: ConflictApiResponse = {
      events: deduplicated,
      total: deduplicated.length,
      timestamp: new Date().toISOString(),
      partial: false,
    };

    // Update cache
    cachedResponse = result;
    cachedAt = Date.now();

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=300",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[conflicts] GDELT fetch failed:", error);

    // Return stale cache if available
    if (cachedResponse) {
      const staleResult: ConflictApiResponse = {
        ...cachedResponse,
        partial: true,
      };
      return NextResponse.json(staleResult, {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=600, stale-while-revalidate=300",
          "Content-Type": "application/json",
        },
      });
    }

    // No cache — return empty degraded response
    const emptyResult: ConflictApiResponse = {
      events: [],
      total: 0,
      timestamp: new Date().toISOString(),
      partial: true,
    };

    return NextResponse.json(emptyResult, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
        "Content-Type": "application/json",
      },
    });
  }
}
