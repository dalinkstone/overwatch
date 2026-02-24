import { useEffect, useRef, useState, useCallback } from "react";
import { SatelliteOMM, SatellitePosition } from "@/lib/satelliteTypes";
import { propagateSatellites } from "@/lib/satellitePropagator";

const TLE_FETCH_INTERVAL_MS = 1800000; // 30 minutes
const PROPAGATION_INTERVAL_MS = 30000; // 30 seconds

interface UseSatelliteDataReturn {
  satellites: SatellitePosition[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  totalCount: number;
}

export const useSatelliteData = (enabled: boolean): UseSatelliteDataReturn => {
  const [ommData, setOmmData] = useState<SatelliteOMM[]>([]);
  const [positions, setPositions] = useState<SatellitePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const propagateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const propagate = useCallback((records: SatelliteOMM[]) => {
    if (records.length === 0) return;
    const computed = propagateSatellites(records);
    setPositions(computed);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/satellites");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("satellites" in data) ||
        !Array.isArray((data as { satellites: unknown }).satellites)
      ) {
        throw new Error("Invalid satellite API response shape");
      }
      const records = (data as { satellites: SatelliteOMM[] }).satellites;
      setOmmData(records);
      setLastUpdated(new Date());
      setError(null);
      propagate(records);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [propagate]);

  useEffect(() => {
    if (!enabled) {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
      }
      if (propagateIntervalRef.current) {
        clearInterval(propagateIntervalRef.current);
        propagateIntervalRef.current = null;
      }
      return;
    }

    fetchData();
    fetchIntervalRef.current = setInterval(fetchData, TLE_FETCH_INTERVAL_MS);
    propagateIntervalRef.current = setInterval(() => {
      setOmmData((current) => {
        propagate(current);
        return current;
      });
    }, PROPAGATION_INTERVAL_MS);

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
      }
      if (propagateIntervalRef.current) {
        clearInterval(propagateIntervalRef.current);
        propagateIntervalRef.current = null;
      }
    };
  }, [enabled, fetchData, propagate]);

  return {
    satellites: positions,
    loading,
    error,
    lastUpdated,
    totalCount: ommData.length,
  };
};
