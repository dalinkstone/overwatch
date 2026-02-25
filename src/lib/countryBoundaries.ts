/**
 * Country boundary GeoJSON type definitions for choropleth rendering.
 * Boundary data is fetched at runtime from /api/humanitarian/boundaries
 * to avoid bundling large GeoJSON in the client.
 */

/** A single country boundary feature with ISO3 code and geometry. */
export interface CountryFeature {
  type: "Feature";
  properties: { iso3: string; name: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

/** GeoJSON FeatureCollection of country boundaries. */
export interface CountryBoundaryCollection {
  type: "FeatureCollection";
  features: CountryFeature[];
}
