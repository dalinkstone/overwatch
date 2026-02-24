"use client";

import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import { AircraftState, hasPosition } from "@/lib/types";
import {
  formatAltitude,
  formatSpeed,
  formatCallsign,
} from "@/lib/utils";
import {
  getAircraftCategory,
  getAircraftIconSvg,
  getCategoryLabel,
  ICON_SIZES,
} from "@/lib/aircraftIcons";

interface AircraftMarkerProps {
  aircraft: AircraftState;
  onClick: (aircraft: AircraftState) => void;
  map: L.Map;
}

const getAltitudeColor = (alt_baro: number | "ground" | undefined): string => {
  if (alt_baro === "ground") return "#22c55e";
  if (typeof alt_baro === "number" && alt_baro < 10000) return "#3b82f6";
  return "#ef4444";
};

const createPlaneIcon = (
  track: number,
  color: string,
  typeCode: string | undefined
): L.DivIcon => {
  const category = getAircraftCategory(typeCode);
  const svg = getAircraftIconSvg(category, color);
  const { size, anchor } = ICON_SIZES[category];

  return L.divIcon({
    html: `<div style="transform: rotate(${track}deg); width: ${size[0]}px; height: ${size[1]}px">${svg}</div>`,
    className: "",
    iconSize: size,
    iconAnchor: anchor,
  });
};

const AircraftMarkerComponent = ({ aircraft, onClick, map }: AircraftMarkerProps) => {
  const markerRef = useRef<L.Marker | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (!hasPosition(aircraft)) return;

    const lat = aircraft.lat as number;
    const lon = aircraft.lon as number;
    const color = getAltitudeColor(aircraft.alt_baro);
    const track = aircraft.track ?? 0;
    const icon = createPlaneIcon(track, color, aircraft.t);
    const category = getAircraftCategory(aircraft.t);
    const categoryLabel = getCategoryLabel(category);

    const popupContent = `<div style="font-size:13px;line-height:1.5">
      <div style="font-weight:bold;font-size:14px">${formatCallsign(aircraft.flight)}</div>
      ${aircraft.t ? `<div>Type: ${aircraft.t}</div>` : ""}
      <div>Category: ${categoryLabel}</div>
      ${aircraft.r ? `<div>Reg: ${aircraft.r}</div>` : ""}
      <div>Alt: ${formatAltitude(aircraft.alt_baro)}</div>
      <div>Speed: ${formatSpeed(aircraft.gs)}</div>
    </div>`;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
      markerRef.current.setIcon(icon);
      markerRef.current.getPopup()?.setContent(popupContent);
    } else {
      const marker = L.marker([lat, lon], { icon })
        .addTo(map)
        .bindPopup(popupContent);

      marker.on("click", () => onClickRef.current(aircraft));
      markerRef.current = marker;
    }
  }, [aircraft, map]);

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

export const AircraftMarker = memo(AircraftMarkerComponent);
