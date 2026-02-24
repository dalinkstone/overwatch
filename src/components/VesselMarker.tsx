"use client";

import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import { VesselData, getVesselCategory, VESSEL_COLORS, VESSEL_CATEGORY_LABELS } from "@/lib/vesselTypes";
import { countryCodeToFlag } from "@/lib/countryLookup";

interface VesselMarkerProps {
  vessel: VesselData;
  onClick: (vessel: VesselData) => void;
  map: L.Map;
  pane: string;
}

const getVesselColor = (vessel: VesselData): string => {
  if (vessel.isMilitary) return "#ff4444";
  return VESSEL_COLORS[getVesselCategory(vessel.shipType)];
};

const getVesselRotation = (vessel: VesselData): number => {
  if (vessel.heading !== 511) return vessel.heading;
  return vessel.cog;
};


const createVesselIcon = (
  vessel: VesselData,
  pane: string,
): L.DivIcon => {
  const color = getVesselColor(vessel);
  const rotation = getVesselRotation(vessel);
  const isMil = vessel.isMilitary;
  const size = isMil ? 28 : 20;
  const anchor = size / 2;
  const strokeWidth = isMil ? 1 : 0.5;
  const strokeOpacity = isMil ? 0.5 : 0.3;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 32">
    <path d="M12 1 L4 20 L4 28 L12 25 L20 28 L20 20 Z"
      fill="${color}" stroke="#000000" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" />
  </svg>`;

  return L.divIcon({
    html: `<div style="transform: rotate(${rotation}deg); width: ${size}px; height: ${size}px">${svg}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    pane,
  });
};

const formatHeading = (heading: number): string => {
  return heading === 511 ? "N/A" : `${Math.round(heading)}°`;
};

const buildPopupContent = (vessel: VesselData): string => {
  const name = vessel.name.trim() || "Unknown Vessel";
  const category = getVesselCategory(vessel.shipType);
  const categoryLabel = VESSEL_CATEGORY_LABELS[category] ?? "Other";
  const speed = `${vessel.sog.toFixed(1)} kts`;
  const course = `${Math.round(vessel.cog)}°`;
  const heading = formatHeading(vessel.heading);
  const destination = vessel.destination.trim() || "Not reported";
  const militaryBadge = vessel.isMilitary && vessel.militaryCategory
    ? `<div style="margin-top:4px"><span style="background:#ff4444;color:white;padding:1px 6px;border-radius:4px;font-size:11px">${vessel.militaryCategory}</span></div>`
    : "";

  return `<div style="font-size:13px;line-height:1.5">
    <div style="font-weight:bold;font-size:14px">${name}</div>
    <div>MMSI: ${vessel.mmsi}</div>
    ${vessel.flagCode ? `<div>${countryCodeToFlag(vessel.flagCode)} ${vessel.flag}</div>` : vessel.flag ? `<div>Flag: ${vessel.flag}</div>` : ""}
    <div>Category: ${categoryLabel}</div>
    <div>Speed: ${speed}</div>
    <div>Course: ${course}</div>
    <div>Heading: ${heading}</div>
    <div>Dest: ${destination}</div>
    ${militaryBadge}
  </div>`;
};

const VesselMarkerComponent = ({ vessel, onClick, map, pane }: VesselMarkerProps) => {
  const markerRef = useRef<L.Marker | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    const icon = createVesselIcon(vessel, pane);
    const popupContent = buildPopupContent(vessel);

    if (markerRef.current) {
      markerRef.current.setLatLng([vessel.lat, vessel.lon]);
      markerRef.current.setIcon(icon);
      markerRef.current.getPopup()?.setContent(popupContent);
    } else {
      const marker = L.marker([vessel.lat, vessel.lon], { icon, pane })
        .addTo(map)
        .bindPopup(popupContent);

      marker.on("click", () => onClickRef.current(vessel));
      markerRef.current = marker;
    }
  }, [vessel, map, pane]);

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

export const VesselMarker = memo(VesselMarkerComponent, (prev, next) => {
  return (
    prev.vessel.lat === next.vessel.lat &&
    prev.vessel.lon === next.vessel.lon &&
    prev.vessel.heading === next.vessel.heading &&
    prev.vessel.cog === next.vessel.cog &&
    prev.vessel.sog === next.vessel.sog &&
    prev.vessel.lastUpdate === next.vessel.lastUpdate
  );
});
