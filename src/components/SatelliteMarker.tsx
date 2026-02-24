"use client";

import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import {
  SatellitePosition,
  SATELLITE_COLORS,
  SATELLITE_CATEGORY_LABELS,
  formatAltitude,
  formatPeriod,
} from "@/lib/satelliteTypes";

interface SatelliteMarkerProps {
  satellite: SatellitePosition;
  onClick: (satellite: SatellitePosition) => void;
  map: L.Map;
  pane: string;
}

const isGeo = (period: number): boolean => period > 1400;

const createSatelliteIcon = (
  satellite: SatellitePosition,
  pane: string,
): L.DivIcon => {
  const color = SATELLITE_COLORS[satellite.category];
  const size = isGeo(satellite.period) ? 20 : 16;
  const anchor = size / 2;

  const geo = isGeo(satellite.period);
  const glow = geo
    ? `<circle cx="8" cy="8" r="7" fill="none" stroke="${color}" stroke-opacity="0.25" stroke-width="0.8" />
       <circle cx="8" cy="8" r="5.5" fill="none" stroke="${color}" stroke-opacity="0.15" stroke-width="0.5" />`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16">
    ${glow}
    <rect x="4" y="4" width="8" height="8" rx="1"
      transform="rotate(45 8 8)"
      fill="${color}" stroke="#000" stroke-opacity="0.3" stroke-width="0.5" />
    <circle cx="8" cy="8" r="1.5" fill="#000" fill-opacity="0.4" />
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    pane,
  });
};

const buildPopupContent = (satellite: SatellitePosition): string => {
  const categoryLabel = SATELLITE_CATEGORY_LABELS[satellite.category];
  const color = SATELLITE_COLORS[satellite.category];

  return `<div style="font-size:13px;line-height:1.5">
    <div style="font-weight:bold;font-size:14px">${satellite.name}</div>
    <div><span style="background:${color};color:white;padding:1px 6px;border-radius:4px;font-size:11px">${categoryLabel}</span></div>
    <div>NORAD: ${satellite.noradId}</div>
    <div>Alt: ${formatAltitude(satellite.altitude)}</div>
    <div>Period: ${formatPeriod(satellite.period)}</div>
    <div>Incl: ${satellite.inclination.toFixed(1)}°</div>
  </div>`;
};

const SatelliteMarkerComponent = ({ satellite, onClick, map, pane }: SatelliteMarkerProps) => {
  const markerRef = useRef<L.Marker | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    const icon = createSatelliteIcon(satellite, pane);
    const popupContent = buildPopupContent(satellite);

    if (markerRef.current) {
      markerRef.current.setLatLng([satellite.lat, satellite.lon]);
      markerRef.current.setIcon(icon);
      markerRef.current.getPopup()?.setContent(popupContent);
    } else {
      const marker = L.marker([satellite.lat, satellite.lon], { icon, pane })
        .addTo(map)
        .bindPopup(popupContent);

      marker.on("click", () => onClickRef.current(satellite));
      markerRef.current = marker;
    }
  }, [satellite, map, pane]);

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

export const SatelliteMarker = memo(SatelliteMarkerComponent, (prev, next) => {
  return (
    prev.satellite.lat === next.satellite.lat &&
    prev.satellite.lon === next.satellite.lon &&
    prev.satellite.altitude === next.satellite.altitude &&
    prev.satellite.category === next.satellite.category
  );
});
