import { useEffect, useRef, useState, useCallback } from "react";
import { AircraftState, hasPosition } from "@/lib/types";
import { fetchMilitaryAircraft } from "@/lib/api";

const POLL_INTERVAL_MS = parseInt(
  process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "10000",
  10
);

interface UseAircraftDataReturn {
  aircraft: AircraftState[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  totalCount: number;
}

export const useAircraftData = (): UseAircraftDataReturn => {
  const [aircraft, setAircraft] = useState<AircraftState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetchMilitaryAircraft();
      const positioned = response.ac.filter(
        (ac) => hasPosition(ac)
      );
      setAircraft(positioned);
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
    fetchData();

    intervalRef.current = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  return { aircraft, loading, error, lastUpdated, totalCount };
};
