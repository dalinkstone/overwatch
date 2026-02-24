"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer } from "react-leaflet";
import { AircraftState, hasPosition } from "@/lib/types";
import { AircraftMarker } from "./AircraftMarker";

interface MapProps {
  aircraft: AircraftState[];
  onAircraftClick: (aircraft: AircraftState) => void;
}

const DEFAULT_CENTER: [number, number] = [
  parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? "38.9"),
  parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? "-77.0"),
];
const DEFAULT_ZOOM = parseInt(
  process.env.NEXT_PUBLIC_DEFAULT_ZOOM ?? "5",
  10
);

const Map = ({ aircraft, onAircraftClick }: MapProps) => {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {aircraft.filter(hasPosition).map((ac) => (
        <AircraftMarker
          key={ac.hex}
          aircraft={ac}
          onClick={onAircraftClick}
        />
      ))}
    </MapContainer>
  );
};

export default Map;
