"use client";

import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import { VesselState, hasVesselPosition } from "@/lib/maritimeTypes";

interface VesselMarkerProps {
  vessel: VesselState;
  map: L.Map;
}

const VESSEL_COLOR = "#06b6d4";
const VESSEL_ICON_SIZE: [number, number] = [28, 36];
const VESSEL_ICON_ANCHOR: [number, number] = [14, 18];

const getVesselIconSvg = (color: string): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 32" width="${VESSEL_ICON_SIZE[0]}" height="${VESSEL_ICON_SIZE[1]}">
    <path d="M10 1 L5 9 L4 16 L4 26 L6 30 L14 30 L16 26 L16 16 L15 9 Z"
      fill="${color}" stroke="#000" stroke-opacity="0.3" stroke-width="0.5"/>
    <rect x="7" y="13" width="6" height="5" rx="0.5"
      fill="${color}" opacity="0.6" stroke="#000" stroke-opacity="0.2" stroke-width="0.3"/>
  </svg>`;
};

const createVesselIcon = (heading: number, color: string): L.DivIcon => {
  const svg = getVesselIconSvg(color);
  return L.divIcon({
    html: `<div style="transform: rotate(${heading}deg); width: ${VESSEL_ICON_SIZE[0]}px; height: ${VESSEL_ICON_SIZE[1]}px">${svg}</div>`,
    className: "",
    iconSize: VESSEL_ICON_SIZE,
    iconAnchor: VESSEL_ICON_ANCHOR,
  });
};

const formatVesselSpeed = (sog: number | undefined): string => {
  if (sog === undefined) return "N/A";
  return `${sog.toFixed(1)} kts`;
};

const VesselMarkerComponent = ({ vessel, map }: VesselMarkerProps) => {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!hasVesselPosition(vessel)) return;

    const lat = vessel.lat as number;
    const lon = vessel.lon as number;
    const heading = vessel.heading ?? vessel.cog ?? 0;
    const icon = createVesselIcon(heading, VESSEL_COLOR);

    const popupContent = `<div style="font-size:13px;line-height:1.5">
      <div style="font-weight:bold;font-size:14px;color:#06b6d4">${vessel.name ?? "Unknown Vessel"}</div>
      <div>MMSI: ${vessel.mmsi}</div>
      ${vessel.vesselType !== undefined ? `<div>Type: ${vessel.vesselType}</div>` : ""}
      <div>Speed: ${formatVesselSpeed(vessel.sog)}</div>
      ${vessel.destination ? `<div>Dest: ${vessel.destination}</div>` : ""}
      ${vessel.callSign ? `<div>Call: ${vessel.callSign}</div>` : ""}
    </div>`;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
      markerRef.current.setIcon(icon);
      markerRef.current.getPopup()?.setContent(popupContent);
    } else {
      const marker = L.marker([lat, lon], { icon })
        .addTo(map)
        .bindPopup(popupContent);

      markerRef.current = marker;
    }
  }, [vessel, map]);

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

export const VesselMarker = memo(VesselMarkerComponent);
