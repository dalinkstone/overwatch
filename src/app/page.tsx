"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { StatusBar } from "@/components/StatusBar";
import { FilterBar } from "@/components/FilterBar";
import { AircraftPanel } from "@/components/AircraftPanel";
import { VesselPanel } from "@/components/VesselPanel";
import { VesselFilterBar } from "@/components/VesselFilterBar";
import { SatelliteFilterBar } from "@/components/SatelliteFilterBar";
import { SatellitePanel } from "@/components/SatellitePanel";
import { LayerControl } from "@/components/LayerControl";
import { useAircraftData } from "@/hooks/useAircraftData";
import { useVesselData } from "@/hooks/useVesselData";
import { useSatelliteData } from "@/hooks/useSatelliteData";
import { AircraftState } from "@/lib/types";
import { VesselData, VesselCategory, getVesselCategory } from "@/lib/vesselTypes";
import { SatellitePosition, SatelliteCategory } from "@/lib/satelliteTypes";
import { AircraftCategory, getAircraftCategory } from "@/lib/aircraftIcons";
import { getCountryFromHex } from "@/lib/countryLookup";

const VESSEL_LAYER_KEY = "overwatch-vessel-layer";
const SATELLITE_LAYER_KEY = "overwatch-satellite-layer";

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

const matchesCountry = (ac: AircraftState, filter: string): boolean => {
  if (filter === "all") return true;
  const info = getCountryFromHex(ac.hex);
  return info?.country === filter;
};

const matchesSpeed = (ac: AircraftState, filter: string): boolean => {
  if (filter === "all") return true;
  const gs = ac.gs;
  if (gs === undefined || gs === null) return filter === "stationary";
  if (filter === "stationary") return gs < 50;
  if (filter === "slow") return gs >= 50 && gs <= 200;
  if (filter === "cruise") return gs > 200 && gs <= 500;
  if (filter === "fast") return gs > 500;
  return true;
};

const matchesVesselSpeed = (v: VesselData, filter: string): boolean => {
  if (filter === "all") return true;
  const sog = v.sog;
  if (sog === undefined || sog === null) return filter === "anchored";
  if (filter === "anchored") return sog < 1;
  if (filter === "slow") return sog >= 1 && sog <= 10;
  if (filter === "cruising") return sog > 10 && sog <= 20;
  if (filter === "fast") return sog > 20;
  return true;
};

const matchesVesselDestination = (v: VesselData, query: string): boolean => {
  if (!query.trim()) return true;
  if (!v.destination) return false;
  return v.destination.toLowerCase().includes(query.trim().toLowerCase());
};

export default function Home() {
  const { aircraft, loading, error, lastUpdated, totalCount } = useAircraftData();

  const [vesselEnabled, setVesselEnabled] = useState(false);
  const { vessels, status: vesselStatus } = useVesselData(vesselEnabled);

  const [satelliteEnabled, setSatelliteEnabled] = useState(false);
  const { satellites, error: satelliteError } = useSatelliteData(satelliteEnabled);

  // Hydrate layer toggles from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      if (localStorage.getItem(VESSEL_LAYER_KEY) === "true") {
        setVesselEnabled(true);
      }
      if (localStorage.getItem(SATELLITE_LAYER_KEY) === "true") {
        setSatelliteEnabled(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const handleVesselToggle = useCallback((enabled: boolean) => {
    setVesselEnabled(enabled);
    try {
      localStorage.setItem(VESSEL_LAYER_KEY, String(enabled));
    } catch {
      // localStorage unavailable
    }
    if (!enabled) {
      setSelectedVessel(null);
      setVesselSignalLost(false);
      selectedMmsiRef.current = null;
      setVesselCountryFilter("all");
      setVesselCategoryFilter("all");
      setVesselSpeedFilter("all");
      setVesselDestSearch("");
    }
  }, []);

  const handleSatelliteToggle = useCallback(() => {
    setSatelliteEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SATELLITE_LAYER_KEY, String(next));
      } catch {
        // localStorage unavailable
      }
      if (!next) {
        setSelectedSatellite(null);
        setSatelliteSignalLost(false);
        selectedNoradRef.current = null;
        setSatCategoryFilter("all");
        setSatOrbitFilter("all");
        setSatSearchQuery("");
      }
      return next;
    });
  }, []);

  const [selectedAircraft, setSelectedAircraft] =
    useState<AircraftState | null>(null);
  const [signalLost, setSignalLost] = useState(false);
  const selectedHexRef = useRef<string | null>(null);

  const [selectedVessel, setSelectedVessel] = useState<VesselData | null>(null);
  const [vesselSignalLost, setVesselSignalLost] = useState(false);
  const selectedMmsiRef = useRef<string | null>(null);

  const [selectedSatellite, setSelectedSatellite] = useState<SatellitePosition | null>(null);
  const [satelliteSignalLost, setSatelliteSignalLost] = useState(false);
  const selectedNoradRef = useRef<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [altitudeFilter, setAltitudeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [countryFilter, setCountryFilter] = useState("all");
  const [speedFilter, setSpeedFilter] = useState("all");

  const [vesselCountryFilter, setVesselCountryFilter] = useState("all");
  const [vesselCategoryFilter, setVesselCategoryFilter] = useState("all");
  const [vesselSpeedFilter, setVesselSpeedFilter] = useState("all");
  const [vesselDestSearch, setVesselDestSearch] = useState("");

  const [satCategoryFilter, setSatCategoryFilter] = useState<SatelliteCategory | "all">("all");
  const [satOrbitFilter, setSatOrbitFilter] = useState<"all" | "leo" | "meo" | "geo">("all");
  const [satSearchQuery, setSatSearchQuery] = useState("");

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

    if (countryFilter !== "all") {
      result = result.filter((ac) => matchesCountry(ac, countryFilter));
    }

    if (speedFilter !== "all") {
      result = result.filter((ac) => matchesSpeed(ac, speedFilter));
    }

    return result;
  }, [aircraft, searchQuery, altitudeFilter, categoryFilter, countryFilter, speedFilter]);

  const filteredVessels = useMemo(() => {
    let result = vessels;

    if (vesselCountryFilter !== "all") {
      result = result.filter((v) => v.flag === vesselCountryFilter);
    }

    if (vesselCategoryFilter !== "all") {
      result = result.filter((v) => {
        if (vesselCategoryFilter === "military") return v.isMilitary;
        return getVesselCategory(v.shipType) === (vesselCategoryFilter as VesselCategory);
      });
    }

    if (vesselSpeedFilter !== "all") {
      result = result.filter((v) => matchesVesselSpeed(v, vesselSpeedFilter));
    }

    if (vesselDestSearch.trim()) {
      result = result.filter((v) => matchesVesselDestination(v, vesselDestSearch));
    }

    return result;
  }, [vessels, vesselCountryFilter, vesselCategoryFilter, vesselSpeedFilter, vesselDestSearch]);

  const filteredSatellites = useMemo(() => {
    let result = satellites;

    if (satSearchQuery.trim()) {
      const q = satSearchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.noradId.toString().includes(q)
      );
    }

    if (satCategoryFilter !== "all") {
      result = result.filter((s) => s.category === satCategoryFilter);
    }

    if (satOrbitFilter !== "all") {
      result = result.filter((s) => {
        if (satOrbitFilter === "leo") return s.period < 128;
        if (satOrbitFilter === "meo") return s.period >= 128 && s.period <= 720;
        if (satOrbitFilter === "geo") return s.period > 720;
        return true;
      });
    }

    return result;
  }, [satellites, satSearchQuery, satCategoryFilter, satOrbitFilter]);

  const aircraftCountries = useMemo(() => {
    const countrySet = new Set<string>();
    for (const ac of aircraft) {
      const info = getCountryFromHex(ac.hex);
      if (info) {
        countrySet.add(info.country);
      }
    }
    return Array.from(countrySet).sort();
  }, [aircraft]);

  const vesselCountries = useMemo(() => {
    const countrySet = new Set<string>();
    for (const v of vessels) {
      if (v.flag && v.flag !== "Unknown") {
        countrySet.add(v.flag);
      }
    }
    return Array.from(countrySet).sort();
  }, [vessels]);

  const handleAircraftClick = useCallback((ac: AircraftState) => {
    setSelectedAircraft(ac);
    setSignalLost(false);
    selectedHexRef.current = ac.hex;
    // Close vessel and satellite panels
    setSelectedVessel(null);
    setVesselSignalLost(false);
    selectedMmsiRef.current = null;
    setSelectedSatellite(null);
    setSatelliteSignalLost(false);
    selectedNoradRef.current = null;
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
    // Close aircraft and satellite panels
    setSelectedAircraft(null);
    setSignalLost(false);
    selectedHexRef.current = null;
    setSelectedSatellite(null);
    setSatelliteSignalLost(false);
    selectedNoradRef.current = null;
  }, []);

  const handleCloseVesselPanel = useCallback(() => {
    setSelectedVessel(null);
    setVesselSignalLost(false);
    selectedMmsiRef.current = null;
  }, []);

  const handleSatelliteClick = useCallback((s: SatellitePosition) => {
    setSelectedSatellite(s);
    setSatelliteSignalLost(false);
    selectedNoradRef.current = s.noradId;
    // Close aircraft and vessel panels (mutual exclusivity)
    setSelectedAircraft(null);
    setSignalLost(false);
    selectedHexRef.current = null;
    setSelectedVessel(null);
    setVesselSignalLost(false);
    selectedMmsiRef.current = null;
  }, []);

  const handleCloseSatellitePanel = useCallback(() => {
    setSelectedSatellite(null);
    setSatelliteSignalLost(false);
    selectedNoradRef.current = null;
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

  // Update selected satellite data on each propagation cycle
  useEffect(() => {
    if (selectedNoradRef.current === null) return;

    const updated = satellites.find((s) => s.noradId === selectedNoradRef.current);
    if (updated) {
      setSelectedSatellite(updated);
      setSatelliteSignalLost(false);
    } else {
      setSatelliteSignalLost(true);
    }
  }, [satellites]);

  return (
    <main className="relative flex h-screen w-full flex-col overflow-hidden">
      <StatusBar
        totalCount={totalCount}
        positionCount={aircraft.length}
        lastUpdated={lastUpdated}
        error={error}
        vesselEnabled={vesselEnabled}
        vesselCount={filteredVessels.length}
        satelliteEnabled={satelliteEnabled}
        satelliteCount={filteredSatellites.length}
        satelliteError={satelliteError}
      />
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        altitudeFilter={altitudeFilter}
        onAltitudeFilterChange={setAltitudeFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        countryFilter={countryFilter}
        onCountryFilterChange={setCountryFilter}
        speedFilter={speedFilter}
        onSpeedFilterChange={setSpeedFilter}
        filteredCount={filteredAircraft.length}
        totalCount={aircraft.length}
        countries={aircraftCountries}
      />
      {vesselEnabled && (
        <VesselFilterBar
          countryFilter={vesselCountryFilter}
          onCountryFilterChange={setVesselCountryFilter}
          categoryFilter={vesselCategoryFilter}
          onCategoryFilterChange={setVesselCategoryFilter}
          speedFilter={vesselSpeedFilter}
          onSpeedFilterChange={setVesselSpeedFilter}
          destSearch={vesselDestSearch}
          onDestSearchChange={setVesselDestSearch}
          filteredCount={filteredVessels.length}
          totalCount={vessels.length}
          countries={vesselCountries}
        />
      )}
      {satelliteEnabled && (
        <SatelliteFilterBar
          categoryFilter={satCategoryFilter}
          onCategoryFilterChange={setSatCategoryFilter}
          orbitFilter={satOrbitFilter}
          onOrbitFilterChange={setSatOrbitFilter}
          searchQuery={satSearchQuery}
          onSearchQueryChange={setSatSearchQuery}
          filteredCount={filteredSatellites.length}
          totalCount={satellites.length}
        />
      )}
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
      <div className="relative flex-1 overflow-hidden">
        <MapWrapper
          aircraft={filteredAircraft}
          onAircraftClick={handleAircraftClick}
          vessels={vesselEnabled ? filteredVessels : []}
          onVesselClick={handleVesselClick}
          satellites={satelliteEnabled ? filteredSatellites : []}
          onSatelliteClick={handleSatelliteClick}
          satelliteLayerEnabled={satelliteEnabled}
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
        <SatellitePanel
          satellite={selectedSatellite}
          onClose={handleCloseSatellitePanel}
          signalLost={satelliteSignalLost}
        />
        <LayerControl
          aircraftCount={filteredAircraft.length}
          vesselEnabled={vesselEnabled}
          onVesselToggle={handleVesselToggle}
          vesselCount={filteredVessels.length}
          vesselTotalCount={vessels.length}
          vesselStatus={vesselStatus}
          satelliteEnabled={satelliteEnabled}
          onSatelliteToggle={handleSatelliteToggle}
          satelliteCount={filteredSatellites.length}
          satelliteTotalCount={satellites.length}
        />
      </div>
    </main>
  );
}
