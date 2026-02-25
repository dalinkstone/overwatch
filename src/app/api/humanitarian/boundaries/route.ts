import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Country boundary GeoJSON proxy route
// ---------------------------------------------------------------------------
// Fetches simplified country boundary polygons from datahub.io, strips
// unnecessary properties (keeping only ISO3 + name + geometry), and caches
// in a module-level variable. The data is static — countries don't change.
// ---------------------------------------------------------------------------

const BOUNDARY_SOURCE_URL =
  "https://r2.datahub.io/clvyjaryy0000la0fi7rnm0ft/main/raw/data/countries.geojson";

const FETCH_TIMEOUT_MS = 30_000;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Module-level cache — survives across requests within the same process
let cachedGeoJSON: string | null = null;
let cacheTimestamp = 0;

// ---------------------------------------------------------------------------
// GeoJSON feature property extraction
// ---------------------------------------------------------------------------

interface RawFeatureProperties {
  ISO_A3?: string;
  ADMIN?: string;
  // Fallback field names used by some GeoJSON sources
  iso3?: string;
  ISO3?: string;
  name?: string;
  NAME?: string;
}

/** Extract ISO3 code from feature properties, trying multiple field names. */
const extractIso3 = (props: RawFeatureProperties): string | null => {
  const iso3 = props.ISO_A3 ?? props.iso3 ?? props.ISO3;
  if (!iso3 || iso3 === "-99" || iso3.length !== 3) return null;
  return iso3;
};

/** Extract country name from feature properties. */
const extractName = (props: RawFeatureProperties): string => {
  return props.ADMIN ?? props.name ?? props.NAME ?? "Unknown";
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET() {
  // Serve from cache if valid
  if (cachedGeoJSON && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
    return new NextResponse(cachedGeoJSON, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(BOUNDARY_SOURCE_URL, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Boundary source returned ${response.status}`);
    }

    const raw: unknown = await response.json();

    // Validate structure
    if (
      typeof raw !== "object" ||
      raw === null ||
      !("type" in raw) ||
      (raw as { type: unknown }).type !== "FeatureCollection" ||
      !("features" in raw) ||
      !Array.isArray((raw as { features: unknown }).features)
    ) {
      throw new Error("Invalid GeoJSON structure from boundary source");
    }

    const features = (raw as { features: unknown[] }).features;

    // Strip properties to just iso3 + name, keep geometry intact
    const simplified = [];

    for (const feature of features) {
      if (
        typeof feature !== "object" ||
        feature === null ||
        !("geometry" in feature) ||
        !("properties" in feature)
      ) {
        continue;
      }

      const f = feature as {
        type: string;
        geometry: { type: string; coordinates: unknown };
        properties: RawFeatureProperties;
      };

      // Only keep Polygon and MultiPolygon geometries
      if (f.geometry?.type !== "Polygon" && f.geometry?.type !== "MultiPolygon") {
        continue;
      }

      const iso3 = extractIso3(f.properties);
      if (!iso3) continue;

      simplified.push({
        type: "Feature",
        properties: {
          iso3,
          name: extractName(f.properties),
        },
        geometry: f.geometry,
      });
    }

    const result = JSON.stringify({
      type: "FeatureCollection",
      features: simplified,
    });

    // Update cache
    cachedGeoJSON = result;
    cacheTimestamp = Date.now();

    return new NextResponse(result, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error fetching boundaries";
    console.error("[humanitarian/boundaries]", message);

    // Return stale cache if available
    if (cachedGeoJSON) {
      return new NextResponse(cachedGeoJSON, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
        },
      });
    }

    return NextResponse.json(
      { error: message, timestamp: new Date().toISOString() },
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
