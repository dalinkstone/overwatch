"use client";

import dynamic from "next/dynamic";
import { AircraftState } from "@/lib/types";
import { VesselData } from "@/lib/vesselTypes";
import { SatellitePosition } from "@/lib/satelliteTypes";
import { AirspaceZone } from "@/lib/airspaceTypes";
import { ConflictEventEnriched } from "@/lib/conflictTypes";
import { HumanitarianCrisis } from "@/lib/humanitarianTypes";

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
  airspaceZones?: AirspaceZone[];
  selectedAirspaceZoneId?: string | null;
  onAirspaceZoneClick?: (zone: AirspaceZone) => void;
  airspaceLayerEnabled?: boolean;
  conflicts?: ConflictEventEnriched[];
  selectedConflict?: ConflictEventEnriched | null;
  onConflictSelect?: (event: ConflictEventEnriched | null) => void;
  conflictsEnabled?: boolean;
  humanitarianCrises?: HumanitarianCrisis[];
  humanitarianVisible?: boolean;
  selectedHumanitarianCrisis?: HumanitarianCrisis | null;
  onSelectHumanitarianCrisis?: (crisis: HumanitarianCrisis | null) => void;
}

export const MapWrapper = ({
  aircraft,
  onAircraftClick,
  vessels,
  onVesselClick,
  satellites,
  onSatelliteClick,
  satelliteLayerEnabled,
  airspaceZones,
  selectedAirspaceZoneId,
  onAirspaceZoneClick,
  airspaceLayerEnabled,
  conflicts,
  selectedConflict,
  onConflictSelect,
  conflictsEnabled,
  humanitarianCrises,
  humanitarianVisible,
  selectedHumanitarianCrisis,
  onSelectHumanitarianCrisis,
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
      airspaceZones={airspaceZones}
      selectedAirspaceZoneId={selectedAirspaceZoneId}
      onAirspaceZoneClick={onAirspaceZoneClick}
      airspaceLayerEnabled={airspaceLayerEnabled}
      conflicts={conflicts}
      selectedConflict={selectedConflict}
      onConflictSelect={onConflictSelect}
      conflictsEnabled={conflictsEnabled}
      humanitarianCrises={humanitarianCrises}
      humanitarianVisible={humanitarianVisible}
      selectedHumanitarianCrisis={selectedHumanitarianCrisis}
      onSelectHumanitarianCrisis={onSelectHumanitarianCrisis}
    />
  );
};
