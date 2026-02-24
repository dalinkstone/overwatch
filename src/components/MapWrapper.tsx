"use client";

import dynamic from "next/dynamic";
import { AircraftState } from "@/lib/types";

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
}

export const MapWrapper = ({ aircraft, onAircraftClick }: MapWrapperProps) => {
  return (
    <Map aircraft={aircraft} onAircraftClick={onAircraftClick} />
  );
};
