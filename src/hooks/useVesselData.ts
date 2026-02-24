import { useEffect, useRef, useState, useCallback } from "react";
import { VesselState, hasVesselPosition, isMilitaryVessel } from "@/lib/maritimeTypes";
import { fetchVessels } from "@/lib/vesselApi";

const VESSEL_POLL_INTERVAL_MS = parseInt(
  process.env.NEXT_PUBLIC_VESSEL_POLL_INTERVAL_MS ?? "30000",
  10
);

interface UseVesselDataReturn {
  vessels: VesselState[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  totalCount: number;
}

export const useVesselData = (enabled: boolean): UseVesselDataReturn => {
  const [vessels, setVessels] = useState<VesselState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetchVessels();
      const military = response.vessels.filter(
        (v) => isMilitaryVessel(v) && hasVesselPosition(v)
      );
      setVessels(military);
      setTotalCount(response.total);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
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
      setVessels([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    fetchData();

    intervalRef.current = setInterval(fetchData, VESSEL_POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchData]);

  return { vessels, loading, error, lastUpdated, totalCount };
};
