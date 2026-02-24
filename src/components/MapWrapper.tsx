"use client";

import dynamic from "next/dynamic";
import { AircraftState } from "@/lib/types";
import { VesselState } from "@/lib/maritimeTypes";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-900 text-gray-400">
      Loading map...
    </div>
  ),
});

interface MapWrapperProps {
  aircraft: AircraftState[];
  onAircraftClick: (aircraft: AircraftState) => void;
  vessels?: VesselState[];
}

export const MapWrapper = ({ aircraft, onAircraftClick, vessels }: MapWrapperProps) => {
  return (
    <Map aircraft={aircraft} onAircraftClick={onAircraftClick} vessels={vessels} />
  );
};
