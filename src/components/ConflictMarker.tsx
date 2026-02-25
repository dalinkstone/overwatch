"use client";

import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import { ConflictEvent, getConflictCategoryColor } from "@/lib/conflictTypes";

interface ConflictMarkerProps {
  event: ConflictEvent;
  isSelected: boolean;
  onClick: () => void;
  map: L.Map;
  pane: string;
}

const createConflictIcon = (
  event: ConflictEvent,
  isSelected: boolean,
  pane: string,
): L.DivIcon => {
  const color = getConflictCategoryColor(event.category);
  const size = isSelected ? 24 : 18;
  const center = size / 2;

  // 6-pointed starburst: alternating outer/inner points around center
  const outerR = center - 1;
  const innerR = outerR * 0.45;
  const points: string[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push(`${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`);
  }
  const starPath = points.join(" ");

  const glow = isSelected
    ? `<circle cx="${center}" cy="${center}" r="${center}" fill="${color}" opacity="0.25"/>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${glow}
    <polygon points="${starPath}" fill="${color}" stroke="#000" stroke-width="0.8" opacity="0.9"/>
    <circle cx="${center}" cy="${center}" r="2" fill="#fff" opacity="0.9"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size],
    iconAnchor: [center, center],
    pane,
  });
};

const truncateName = (name: string): string => {
  if (name.length <= 80) return name;
  return name.slice(0, 77) + "...";
};

const ConflictMarkerComponent = ({ event, isSelected, onClick, map, pane }: ConflictMarkerProps) => {
  const markerRef = useRef<L.Marker | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    const icon = createConflictIcon(event, isSelected, pane);

    if (markerRef.current) {
      markerRef.current.setLatLng([event.lat, event.lon]);
      markerRef.current.setIcon(icon);
      markerRef.current.unbindTooltip();
      markerRef.current.bindTooltip(truncateName(event.name), { pane: "tooltipPane" });
    } else {
      const marker = L.marker([event.lat, event.lon], { icon, pane })
        .addTo(map)
        .bindTooltip(truncateName(event.name), { pane: "tooltipPane" });

      marker.on("click", () => onClickRef.current());
      markerRef.current = marker;
    }
  }, [event, isSelected, map, pane]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, []);

  return null;
};

export const ConflictMarker = memo(ConflictMarkerComponent, (prev, next) => {
  return (
    prev.event.lat === next.event.lat &&
    prev.event.lon === next.event.lon &&
    prev.event.category === next.event.category &&
    prev.event.name === next.event.name &&
    prev.isSelected === next.isSelected
  );
});
