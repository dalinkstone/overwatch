"use client";

import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import { HumanitarianCrisis, getSeverityColor } from "@/lib/humanitarianTypes";
import { CountryBoundaryCollection, CountryFeature } from "@/lib/countryBoundaries";

interface HumanitarianOverlayProps {
  map: L.Map | null;
  crises: HumanitarianCrisis[];
  visible: boolean;
  onSelectCrisis: (crisis: HumanitarianCrisis | null) => void;
  selectedCrisisId: string | null;
}

const PANE_NAME = "humanitarianPane";
const PANE_Z_INDEX = 410;

/** Fill opacity by severity level. */
const SEVERITY_FILL_OPACITY: Record<HumanitarianCrisis["severity"], number> = {
  critical: 0.35,
  major: 0.25,
  moderate: 0.2,
  minor: 0.15,
};

/** Build Leaflet path options for a country polygon. */
const getCountryStyle = (
  severity: HumanitarianCrisis["severity"],
  isSelected: boolean,
): L.PathOptions => ({
  fillColor: getSeverityColor(severity),
  fillOpacity: isSelected
    ? Math.min(SEVERITY_FILL_OPACITY[severity] + 0.15, 0.5)
    : SEVERITY_FILL_OPACITY[severity],
  color: isSelected ? "#ffffff" : "#ffffff",
  weight: isSelected ? 3 : 1,
  opacity: isSelected ? 1.0 : 0.6,
  pane: PANE_NAME,
});

/** Build tooltip HTML for country hover. */
const buildTooltip = (crisis: HumanitarianCrisis): string => {
  const severityLabel =
    crisis.severity.charAt(0).toUpperCase() + crisis.severity.slice(1);
  return `<div style="font-size:12px;line-height:1.4">
    <strong>${crisis.country}</strong>
    <div>${severityLabel} &mdash; ${crisis.disasterCount} disaster${crisis.disasterCount !== 1 ? "s" : ""}, ${crisis.reportCount} report${crisis.reportCount !== 1 ? "s" : ""}</div>
  </div>`;
};

/** Create a badge div icon for the crisis centroid. */
const createBadgeIcon = (crisis: HumanitarianCrisis): L.DivIcon => {
  const color = getSeverityColor(crisis.severity);
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="
      width:24px;height:24px;
      border-radius:50%;
      background:${color};
      color:#fff;
      font-size:11px;
      font-weight:bold;
      display:flex;
      align-items:center;
      justify-content:center;
      border:1px solid rgba(255,255,255,0.6);
      line-height:1;
      pointer-events:none;
    ">${crisis.disasterCount}</div>`,
  });
};

/** Convert GeoJSON coordinates to Leaflet polygon coordinates. */
const createPolygonLayer = (
  feature: CountryFeature,
  style: L.PathOptions,
): L.Polygon | null => {
  const geom = feature.geometry;

  if (geom.type === "Polygon") {
    const coords = (geom.coordinates as number[][][]).map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
    );
    return L.polygon(coords, style);
  }

  if (geom.type === "MultiPolygon") {
    const coords = (geom.coordinates as number[][][][]).map((poly) =>
      poly.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
      ),
    );
    return L.polygon(coords as L.LatLngExpression[][][], style);
  }

  return null;
};

const HumanitarianOverlayComponent = ({
  map,
  crises,
  visible,
  onSelectCrisis,
  selectedCrisisId,
}: HumanitarianOverlayProps) => {
  const boundariesRef = useRef<CountryBoundaryCollection | null>(null);
  const boundariesLoadingRef = useRef(false);
  const polygonLayersRef = useRef<L.Polygon[]>([]);
  const badgeLayersRef = useRef<L.Marker[]>([]);
  const onSelectRef = useRef(onSelectCrisis);
  onSelectRef.current = onSelectCrisis;

  // Ensure the custom pane exists
  useEffect(() => {
    if (!map) return;
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = String(PANE_Z_INDEX);
    }
  }, [map]);

  // Fetch boundaries once
  useEffect(() => {
    if (boundariesRef.current || boundariesLoadingRef.current) return;
    if (!visible || !map) return;

    boundariesLoadingRef.current = true;

    fetch("/api/humanitarian/boundaries")
      .then((res) => {
        if (!res.ok) throw new Error(`Boundaries fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        const collection = data as CountryBoundaryCollection;
        if (
          collection.type === "FeatureCollection" &&
          Array.isArray(collection.features)
        ) {
          boundariesRef.current = collection;
        }
      })
      .catch((err: unknown) => {
        console.error(
          "[HumanitarianOverlay] Failed to load boundaries:",
          err instanceof Error ? err.message : err,
        );
      })
      .finally(() => {
        boundariesLoadingRef.current = false;
      });
  }, [visible, map]);

  // Render / update layers
  useEffect(() => {
    if (!map) return;

    // Clear existing layers
    const clearLayers = () => {
      for (const layer of polygonLayersRef.current) {
        layer.remove();
      }
      polygonLayersRef.current = [];
      for (const layer of badgeLayersRef.current) {
        layer.remove();
      }
      badgeLayersRef.current = [];
    };

    clearLayers();

    if (!visible || crises.length === 0 || !boundariesRef.current) {
      return clearLayers;
    }

    // Build ISO3 → crisis lookup
    const crisisByIso3 = new Map<string, HumanitarianCrisis>();
    for (const crisis of crises) {
      crisisByIso3.set(crisis.countryIso3, crisis);
    }

    // Build ISO3 → feature lookup
    const featureByIso3 = new Map<string, CountryFeature>();
    for (const feature of boundariesRef.current.features) {
      featureByIso3.set(feature.properties.iso3, feature);
    }

    // Render country polygons and badges
    for (const crisis of crises) {
      const feature = featureByIso3.get(crisis.countryIso3);
      if (!feature) continue;

      const isSelected = crisis.id === selectedCrisisId;
      const style = getCountryStyle(crisis.severity, isSelected);
      const polygon = createPolygonLayer(feature, style);

      if (polygon) {
        polygon.addTo(map);
        polygon.bindTooltip(buildTooltip(crisis), {
          sticky: true,
          direction: "top",
        });

        const c = crisis;
        polygon.on("click", () => onSelectRef.current(c));

        if (isSelected) {
          polygon.bringToFront();
        }

        polygonLayersRef.current.push(polygon);
      }

      // Badge marker at centroid
      const badge = L.marker([crisis.lat, crisis.lon], {
        icon: createBadgeIcon(crisis),
        pane: PANE_NAME,
        interactive: false,
      });
      badge.addTo(map);
      badgeLayersRef.current.push(badge);
    }

    return clearLayers;
  }, [map, crises, visible, selectedCrisisId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const layer of polygonLayersRef.current) {
        layer.remove();
      }
      polygonLayersRef.current = [];
      for (const layer of badgeLayersRef.current) {
        layer.remove();
      }
      badgeLayersRef.current = [];
    };
  }, []);

  return null;
};

/** Compute a simple hash of crisis IDs and severities for memo comparison. */
const crisesHash = (crises: HumanitarianCrisis[]): string => {
  let hash = "";
  for (const c of crises) {
    hash += c.id + c.severity;
  }
  return hash;
};

export const HumanitarianOverlay = memo(
  HumanitarianOverlayComponent,
  (prev, next) =>
    prev.visible === next.visible &&
    prev.selectedCrisisId === next.selectedCrisisId &&
    prev.crises.length === next.crises.length &&
    crisesHash(prev.crises) === crisesHash(next.crises),
);
