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
  const size = isSelected ? 20 : 16;
  const center = size / 2;
  const radius = isSelected ? 4 : 3;

  const lines = isSelected
    ? `<line x1="10" y1="1" x2="10" y2="5" stroke="${color}" stroke-width="2"/>
       <line x1="15" y1="10" x2="19" y2="10" stroke="${color}" stroke-width="2"/>
       <line x1="10" y1="15" x2="10" y2="19" stroke="${color}" stroke-width="2"/>
       <line x1="1" y1="10" x2="5" y2="10" stroke="${color}" stroke-width="2"/>`
    : `<line x1="8" y1="1" x2="8" y2="4" stroke="${color}" stroke-width="2"/>
       <line x1="12" y1="8" x2="15" y2="8" stroke="${color}" stroke-width="2"/>
       <line x1="8" y1="12" x2="8" y2="15" stroke="${color}" stroke-width="2"/>
       <line x1="1" y1="8" x2="4" y2="8" stroke="${color}" stroke-width="2"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${lines}
    <circle cx="${center}" cy="${center}" r="${radius}" fill="${color}"/>
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
