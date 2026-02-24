"use client";

import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import {
  AirspaceZone,
  AirspaceType,
  AIRSPACE_COLORS,
  AIRSPACE_FILL_OPACITY,
  AIRSPACE_STROKE_OPACITY,
  AIRSPACE_TYPE_LABELS,
  TFR_TYPE_LABELS,
} from "@/lib/airspaceTypes";

interface AirspaceOverlayProps {
  zones: AirspaceZone[];
  selectedZoneId: string | null;
  onZoneClick: (zone: AirspaceZone) => void;
  map: L.Map;
  pane: string;
}

/** Nautical miles to meters conversion factor. */
const NM_TO_M = 1852;

/** Build Leaflet path options for a zone based on type, source, active status, and selection state. */
const getZoneStyle = (
  type: AirspaceType,
  source: "sua" | "tfr",
  isSelected: boolean,
  isActive: boolean = true,
): L.PathOptions => {
  const color = AIRSPACE_COLORS[type];
  // Inactive SUA zones: stroke-only, no fill (reduces map clutter)
  const inactiveStrokeOnly = !isActive && source === "sua";
  return {
    color: isSelected ? "#ffffff" : color,
    weight: isSelected ? 3 : inactiveStrokeOnly ? 1 : 1.5,
    opacity: isSelected ? 1 : inactiveStrokeOnly ? 0.4 : AIRSPACE_STROKE_OPACITY[type],
    fillColor: color,
    fillOpacity: isSelected
      ? Math.min(AIRSPACE_FILL_OPACITY[type] + 0.15, 0.5)
      : inactiveStrokeOnly
        ? 0
        : AIRSPACE_FILL_OPACITY[type],
    ...(source === "tfr" ? { dashArray: "8 4" } : {}),
  };
};

/** Build HTML tooltip content for zone hover. */
const buildTooltip = (zone: AirspaceZone): string => {
  const typeLabel = AIRSPACE_TYPE_LABELS[zone.type];
  const tfrLabel =
    zone.tfrType ? ` — ${TFR_TYPE_LABELS[zone.tfrType]}` : "";
  const altRange =
    zone.lowerAltitude && zone.upperAltitude
      ? `${zone.lowerAltitude} – ${zone.upperAltitude}`
      : (zone.upperAltitude ?? "");

  return `<div style="font-size:12px;line-height:1.4">
    <strong>${zone.name}</strong>
    <div>${typeLabel}${tfrLabel}</div>
    ${altRange ? `<div>${altRange}</div>` : ""}
  </div>`;
};

/** Create a Leaflet path layer (polygon or circle) for a zone. */
const createZoneLayer = (
  zone: AirspaceZone,
  pane: string,
  isSelected: boolean,
): L.Path | null => {
  const style: L.PathOptions = {
    ...getZoneStyle(zone.type, zone.source, isSelected, zone.isActive),
    pane,
  };

  // Circular TFR: center + radius
  if (zone.center && zone.radiusNm) {
    return L.circle([zone.center.lat, zone.center.lon], {
      ...style,
      radius: zone.radiusNm * NM_TO_M,
    });
  }

  const geom = zone.geometry;
  if (!geom) return null;

  if (geom.type === "Polygon") {
    const coords = (geom as GeoJSON.Polygon).coordinates.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
    );
    return L.polygon(coords, style);
  }

  if (geom.type === "MultiPolygon") {
    const coords = (geom as GeoJSON.MultiPolygon).coordinates.map((poly) =>
      poly.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
      ),
    );
    return L.polygon(coords as L.LatLngExpression[][][], style);
  }

  return null;
};

/** Compute bounding box for a zone's geometry (for viewport filtering in Map.tsx). */
export const getZoneBounds = (zone: AirspaceZone): L.LatLngBounds | null => {
  // Circular TFR: approximate bounds from center ± radius (1 NM ≈ 1/60°)
  if (zone.center && zone.radiusNm) {
    const deg = zone.radiusNm / 60;
    return L.latLngBounds(
      [zone.center.lat - deg, zone.center.lon - deg],
      [zone.center.lat + deg, zone.center.lon + deg],
    );
  }

  const geom = zone.geometry;
  if (!geom) return null;

  const positions: number[][] = [];

  if (geom.type === "Polygon") {
    for (const ring of (geom as GeoJSON.Polygon).coordinates) {
      for (const pos of ring) positions.push(pos);
    }
  } else if (geom.type === "MultiPolygon") {
    for (const poly of (geom as GeoJSON.MultiPolygon).coordinates) {
      for (const ring of poly) {
        for (const pos of ring) positions.push(pos);
      }
    }
  }

  if (positions.length === 0) return null;

  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;

  for (const [lng, lat] of positions) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
};

const AirspaceOverlayComponent = ({
  zones,
  selectedZoneId,
  onZoneClick,
  map,
  pane,
}: AirspaceOverlayProps) => {
  const layersRef = useRef<Map<string, L.Path>>(new Map());
  const zoneDataRef = useRef<Map<string, AirspaceZone>>(new Map());
  const onClickRef = useRef(onZoneClick);
  onClickRef.current = onZoneClick;
  const prevSelectedRef = useRef<string | null>(selectedZoneId);

  // Sync Leaflet layers with the zones array — add new, remove stale
  useEffect(() => {
    const currentIds = new Set(zones.map((z) => z.id));
    const layers = layersRef.current;
    const zoneMap = zoneDataRef.current;

    // Remove layers for zones no longer in the visible set
    for (const [id, layer] of layers) {
      if (!currentIds.has(id)) {
        layer.remove();
        layers.delete(id);
        zoneMap.delete(id);
      }
    }

    // Add layers for new zones (existing ones are kept as-is)
    for (const zone of zones) {
      zoneMap.set(zone.id, zone);
      if (!layers.has(zone.id)) {
        const isSelected = zone.id === selectedZoneId;
        const layer = createZoneLayer(zone, pane, isSelected);
        if (layer) {
          layer.addTo(map);
          layer.bindTooltip(buildTooltip(zone), {
            sticky: true,
            direction: "top",
          });
          const z = zone;
          layer.on("click", () => onClickRef.current(z));
          layers.set(zone.id, layer);
        }
      }
    }
  }, [zones, map, pane, selectedZoneId]);

  // Handle selection changes — restyle previous and new selected zones
  useEffect(() => {
    const prevId = prevSelectedRef.current;
    prevSelectedRef.current = selectedZoneId;

    // Deselect previous
    if (prevId && prevId !== selectedZoneId) {
      const prevLayer = layersRef.current.get(prevId);
      const prevZone = zoneDataRef.current.get(prevId);
      if (prevLayer && prevZone) {
        prevLayer.setStyle(getZoneStyle(prevZone.type, prevZone.source, false, prevZone.isActive));
      }
    }

    // Highlight newly selected
    if (selectedZoneId) {
      const layer = layersRef.current.get(selectedZoneId);
      const zone = zoneDataRef.current.get(selectedZoneId);
      if (layer && zone) {
        layer.setStyle(getZoneStyle(zone.type, zone.source, true, zone.isActive));
        layer.bringToFront();
      }
    }
  }, [selectedZoneId]);

  // Cleanup all layers on unmount
  useEffect(() => {
    return () => {
      for (const layer of layersRef.current.values()) {
        layer.remove();
      }
      layersRef.current.clear();
      zoneDataRef.current.clear();
    };
  }, []);

  return null;
};

export const AirspaceOverlay = memo(
  AirspaceOverlayComponent,
  (prev, next) =>
    prev.zones === next.zones &&
    prev.selectedZoneId === next.selectedZoneId &&
    prev.pane === next.pane,
);
