"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { StatusBar } from "@/components/StatusBar";
import { FilterBar } from "@/components/FilterBar";
import { AircraftPanel } from "@/components/AircraftPanel";
import { useAircraftData } from "@/hooks/useAircraftData";
import { AircraftState } from "@/lib/types";

const matchesSearch = (ac: AircraftState, query: string): boolean => {
  const q = query.toLowerCase();
  if (ac.flight?.toLowerCase().includes(q)) return true;
  if (ac.r?.toLowerCase().includes(q)) return true;
  if (ac.hex.toLowerCase().includes(q)) return true;
  if (ac.t?.toLowerCase().includes(q)) return true;
  return false;
};

const matchesAltitude = (ac: AircraftState, filter: string): boolean => {
  if (filter === "all") return true;

  const alt = ac.alt_baro;

  if (filter === "ground") {
    return alt === "ground";
  }
  if (filter === "below10000") {
    return typeof alt === "number" && alt < 10000;
  }
  if (filter === "10000-30000") {
    return typeof alt === "number" && alt >= 10000 && alt <= 30000;
  }
  if (filter === "above30000") {
    return typeof alt === "number" && alt > 30000;
  }

  return true;
};

export default function Home() {
  const { aircraft, error, lastUpdated, totalCount } = useAircraftData();
  const [selectedAircraft, setSelectedAircraft] =
    useState<AircraftState | null>(null);
  const [signalLost, setSignalLost] = useState(false);
  const selectedHexRef = useRef<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [altitudeFilter, setAltitudeFilter] = useState("all");

  const filteredAircraft = useMemo(() => {
    let result = aircraft;

    if (searchQuery.trim()) {
      result = result.filter((ac) => matchesSearch(ac, searchQuery.trim()));
    }

    if (altitudeFilter !== "all") {
      result = result.filter((ac) => matchesAltitude(ac, altitudeFilter));
    }

    return result;
  }, [aircraft, searchQuery, altitudeFilter]);

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
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        altitudeFilter={altitudeFilter}
        onAltitudeFilterChange={setAltitudeFilter}
        filteredCount={filteredAircraft.length}
        totalCount={aircraft.length}
      />
      <div className="relative flex-1">
        <MapWrapper
          aircraft={filteredAircraft}
          onAircraftClick={handleAircraftClick}
        />
        <AircraftPanel
          aircraft={selectedAircraft}
          onClose={handleClosePanel}
          signalLost={signalLost}
        />
      </div>
    </main>
  );
}
