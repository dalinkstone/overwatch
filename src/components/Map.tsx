"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: <a href="https://www.adsb.lol/">ADSB.lol</a> contributors (ODbL)',
    }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ height: "100%", width: "100%" }}>
      {mapReady &&
        mapRef.current &&
        aircraft.filter(hasPosition).map((ac) => (
          <AircraftMarker
            key={ac.hex}
            aircraft={ac}
            onClick={onAircraftClick}
            map={mapRef.current!}
          />
        ))}
    </div>
  );
};

export default Map;
