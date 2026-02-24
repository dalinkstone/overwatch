"use client";

import dynamic from "next/dynamic";
import { AircraftState } from "@/lib/types";
import { VesselData } from "@/lib/vesselTypes";
import { SatellitePosition } from "@/lib/satelliteTypes";

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
  vessels?: VesselData[];
  onVesselClick?: (vessel: VesselData) => void;
  satellites?: SatellitePosition[];
  onSatelliteClick?: (satellite: SatellitePosition) => void;
  satelliteLayerEnabled?: boolean;
}

export const MapWrapper = ({
  aircraft,
  onAircraftClick,
  vessels,
  onVesselClick,
  satellites,
  onSatelliteClick,
  satelliteLayerEnabled,
}: MapWrapperProps) => {
  return (
    <Map
      aircraft={aircraft}
      onAircraftClick={onAircraftClick}
      vessels={vessels}
      onVesselClick={onVesselClick}
      satellites={satellites}
      onSatelliteClick={onSatelliteClick}
      satelliteLayerEnabled={satelliteLayerEnabled}
    />
  );
};
