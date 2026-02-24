"use client";

import { useCallback, useState } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { StatusBar } from "@/components/StatusBar";
import { useAircraftData } from "@/hooks/useAircraftData";
import { AircraftState } from "@/lib/types";

export default function Home() {
  const { aircraft, error, lastUpdated, totalCount } = useAircraftData();
  const [, setSelectedAircraft] = useState<AircraftState | null>(null);

  const handleAircraftClick = useCallback((ac: AircraftState) => {
    setSelectedAircraft(ac);
  }, []);

  return (
    <main className="flex h-screen w-screen flex-col">
      <StatusBar
        totalCount={totalCount}
        positionCount={aircraft.length}
        lastUpdated={lastUpdated}
        error={error}
      />
      <div className="flex-1">
        <MapWrapper aircraft={aircraft} onAircraftClick={handleAircraftClick} />
      </div>
    </main>
  );
}
