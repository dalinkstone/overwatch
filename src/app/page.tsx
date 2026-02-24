"use client";

import { useCallback, useState } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { AircraftState } from "@/lib/types";

export default function Home() {
  const [aircraft] = useState<AircraftState[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftState | null>(null);

  const handleAircraftClick = useCallback((ac: AircraftState) => {
    setSelectedAircraft(ac);
  }, []);

  return (
    <main className="h-screen w-screen">
      <MapWrapper aircraft={aircraft} onAircraftClick={handleAircraftClick} />
    </main>
  );
}
