import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { type AirspaceZone, type AirspaceType, isZoneActive } from "@/lib/airspaceTypes";

const POLL_INTERVAL_MS = 300_000; // 5 minutes

interface UseAirspaceDataReturn {
  zones: AirspaceZone[];
  allZones: AirspaceZone[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  counts: Record<AirspaceType, number>;
}

const emptyCounts: Record<AirspaceType, number> = {
  restricted: 0,
  prohibited: 0,
  moa: 0,
  warning: 0,
  alert: 0,
  tfr: 0,
};

export const useAirspaceData = (enabled: boolean): UseAirspaceDataReturn => {
  const [allZones, setAllZones] = useState<AirspaceZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/airspace");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("zones" in data) ||
        !Array.isArray((data as { zones: unknown }).zones)
      ) {
        throw new Error("Invalid airspace API response shape");
      }
      const zones = (data as { zones: AirspaceZone[] }).zones;
      setAllZones(zones);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      // Preserve previous zones on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    fetchData();
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchData]);

  // Filter to only currently-active zones client-side
  const zones = useMemo(() => {
    return allZones.filter((zone) => isZoneActive(zone));
  }, [allZones]);

  // Compute counts from active zones
  const counts = useMemo(() => {
    const result = { ...emptyCounts };
    for (const zone of zones) {
      result[zone.type]++;
    }
    return result;
  }, [zones]);

  return {
    zones,
    allZones,
    loading,
    error,
    lastUpdated,
    counts,
  };
};
