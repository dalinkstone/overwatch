"use client";

import { memo, useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { AircraftState, hasPosition } from "@/lib/types";
import {
  formatAltitude,
  formatSpeed,
  formatCallsign,
  getAircraftLabel,
} from "@/lib/utils";

interface AircraftMarkerProps {
  aircraft: AircraftState;
  onClick: (aircraft: AircraftState) => void;
}

const getAltitudeColor = (alt_baro: number | "ground" | undefined): string => {
  if (alt_baro === "ground") return "#22c55e";
  if (typeof alt_baro === "number" && alt_baro < 10000) return "#3b82f6";
  return "#ef4444";
};

const createPlaneIcon = (track: number, color: string): L.DivIcon => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="24" height="24" style="transform: rotate(${track}deg)"><path d="M12 1 L10 8 L3 13 L3 15 L10 12 L10 19 L7 21 L7 23 L12 21 L17 23 L17 21 L14 19 L14 12 L21 15 L21 13 L14 8 Z"/></svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const AircraftMarkerComponent = ({ aircraft, onClick }: AircraftMarkerProps) => {
  const icon = useMemo(() => {
    const color = getAltitudeColor(aircraft.alt_baro);
    const track = aircraft.track ?? 0;
    return createPlaneIcon(track, color);
  }, [aircraft.alt_baro, aircraft.track]);

  if (!hasPosition(aircraft)) {
    return null;
  }

  return (
    <Marker
      position={[aircraft.lat as number, aircraft.lon as number]}
      icon={icon}
      eventHandlers={{
        click: () => onClick(aircraft),
      }}
    >
      <Popup>
        <div className="text-sm leading-relaxed">
          <div className="font-bold text-base">
            {formatCallsign(aircraft.flight)}
          </div>
          {aircraft.t && <div>Type: {aircraft.t}</div>}
          {aircraft.r && <div>Reg: {aircraft.r}</div>}
          <div>Alt: {formatAltitude(aircraft.alt_baro)}</div>
          <div>Speed: {formatSpeed(aircraft.gs)}</div>
        </div>
      </Popup>
    </Marker>
  );
};

export const AircraftMarker = memo(AircraftMarkerComponent);
