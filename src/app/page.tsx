"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { StatusBar } from "@/components/StatusBar";
import { AircraftPanel } from "@/components/AircraftPanel";
import { useAircraftData } from "@/hooks/useAircraftData";
import { AircraftState } from "@/lib/types";

export default function Home() {
  const { aircraft, error, lastUpdated, totalCount } = useAircraftData();
  const [selectedAircraft, setSelectedAircraft] =
    useState<AircraftState | null>(null);
  const [signalLost, setSignalLost] = useState(false);
  const selectedHexRef = useRef<string | null>(null);

  const handleAircraftClick = useCallback((ac: AircraftState) => {
    setSelectedAircraft(ac);
    setSignalLost(false);
    selectedHexRef.current = ac.hex;
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedAircraft(null);
    setSignalLost(false);
    selectedHexRef.current = null;
  }, []);

  // Update selected aircraft data when new poll results arrive
  useEffect(() => {
    if (!selectedHexRef.current) return;

    const updated = aircraft.find((ac) => ac.hex === selectedHexRef.current);
    if (updated) {
      setSelectedAircraft(updated);
      setSignalLost(false);
    } else {
      // Aircraft disappeared from data — keep showing last known state
      setSignalLost(true);
    }
  }, [aircraft]);

  return (
    <main className="relative flex h-screen w-screen flex-col">
      <StatusBar
        totalCount={totalCount}
        positionCount={aircraft.length}
        lastUpdated={lastUpdated}
        error={error}
      />
      <div className="relative flex-1">
        <MapWrapper aircraft={aircraft} onAircraftClick={handleAircraftClick} />
        <AircraftPanel
          aircraft={selectedAircraft}
          onClose={handleClosePanel}
          signalLost={signalLost}
        />
      </div>
    </main>
  );
}
