"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { StatusBar } from "@/components/StatusBar";
import { FilterBar } from "@/components/FilterBar";
import { AircraftPanel } from "@/components/AircraftPanel";
import { VesselPanel } from "@/components/VesselPanel";
import { useAircraftData } from "@/hooks/useAircraftData";
import { useVesselData } from "@/hooks/useVesselData";
import { AircraftState } from "@/lib/types";
import { VesselData } from "@/lib/vesselTypes";
import { AircraftCategory, getAircraftCategory } from "@/lib/aircraftIcons";

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

const matchesCategory = (ac: AircraftState, filter: string): boolean => {
  if (filter === "all") return true;
  return getAircraftCategory(ac.t) === (filter as AircraftCategory);
};

export default function Home() {
  const { aircraft, loading, error, lastUpdated, totalCount } = useAircraftData();
  const [vesselEnabled] = useState(true);
  const { vessels } = useVesselData(vesselEnabled);

  const [selectedAircraft, setSelectedAircraft] =
    useState<AircraftState | null>(null);
  const [signalLost, setSignalLost] = useState(false);
  const selectedHexRef = useRef<string | null>(null);

  const [selectedVessel, setSelectedVessel] = useState<VesselData | null>(null);
  const [vesselSignalLost, setVesselSignalLost] = useState(false);
  const selectedMmsiRef = useRef<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [altitudeFilter, setAltitudeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredAircraft = useMemo(() => {
    let result = aircraft;

    if (searchQuery.trim()) {
      result = result.filter((ac) => matchesSearch(ac, searchQuery.trim()));
    }

    if (altitudeFilter !== "all") {
      result = result.filter((ac) => matchesAltitude(ac, altitudeFilter));
    }

    if (categoryFilter !== "all") {
      result = result.filter((ac) => matchesCategory(ac, categoryFilter));
    }

    return result;
  }, [aircraft, searchQuery, altitudeFilter, categoryFilter]);

  const handleAircraftClick = useCallback((ac: AircraftState) => {
    setSelectedAircraft(ac);
    setSignalLost(false);
    selectedHexRef.current = ac.hex;
    // Close vessel panel
    setSelectedVessel(null);
    setVesselSignalLost(false);
    selectedMmsiRef.current = null;
  }, []);

  const handleCloseAircraftPanel = useCallback(() => {
    setSelectedAircraft(null);
    setSignalLost(false);
    selectedHexRef.current = null;
  }, []);

  const handleVesselClick = useCallback((v: VesselData) => {
    setSelectedVessel(v);
    setVesselSignalLost(false);
    selectedMmsiRef.current = v.mmsi;
    // Close aircraft panel
    setSelectedAircraft(null);
    setSignalLost(false);
    selectedHexRef.current = null;
  }, []);

  const handleCloseVesselPanel = useCallback(() => {
    setSelectedVessel(null);
    setVesselSignalLost(false);
    selectedMmsiRef.current = null;
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

  // Update selected vessel data when new poll results arrive
  useEffect(() => {
    if (!selectedMmsiRef.current) return;

    const updated = vessels.find((v) => v.mmsi === selectedMmsiRef.current);
    if (updated) {
      setSelectedVessel(updated);
      setVesselSignalLost(false);
    } else {
      setVesselSignalLost(true);
    }
  }, [vessels]);

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
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        filteredCount={filteredAircraft.length}
        totalCount={aircraft.length}
      />
      {/* Error banner — non-blocking, shows below filter bar */}
      {error && !loading && (
        <div className="flex items-center gap-2 bg-red-900/70 px-4 py-1.5 text-xs text-red-200">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span>Unable to reach aircraft data source. Retrying...</span>
          {lastUpdated && (
            <span className="ml-auto text-red-300/70">
              Last successful update: {lastUpdated.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
      )}
      <div className="relative flex-1">
        <MapWrapper
          aircraft={filteredAircraft}
          onAircraftClick={handleAircraftClick}
          vessels={vessels}
          onVesselClick={handleVesselClick}
        />
        {/* Loading overlay */}
        {loading && (
          <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center bg-black/40">
            <div className="flex items-center gap-3 rounded-lg bg-zinc-800 px-6 py-4 shadow-lg">
              <svg className="h-5 w-5 animate-spin text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-zinc-200">Loading aircraft data...</span>
            </div>
          </div>
        )}
        {/* Empty state */}
        {!loading && aircraft.length === 0 && !error && (
          <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center">
            <div className="rounded-lg bg-zinc-800/90 px-6 py-4 text-center shadow-lg">
              <p className="text-sm text-zinc-300">No military aircraft currently broadcasting</p>
            </div>
          </div>
        )}
        <AircraftPanel
          aircraft={selectedAircraft}
          onClose={handleCloseAircraftPanel}
          signalLost={signalLost}
        />
        <VesselPanel
          vessel={selectedVessel}
          onClose={handleCloseVesselPanel}
          signalLost={vesselSignalLost}
        />
      </div>
    </main>
  );
}
