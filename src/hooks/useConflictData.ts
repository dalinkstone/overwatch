import { useEffect, useRef, useState, useCallback } from "react";
import { ConflictEventEnriched, ConflictApiResponse } from "@/lib/conflictTypes";

const CONFLICT_POLL_INTERVAL_MS = 600000; // 10 minutes

interface UseConflictDataReturn {
  events: ConflictEventEnriched[];
  total: number;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export const useConflictData = (enabled: boolean): UseConflictDataReturn => {
  const [events, setEvents] = useState<ConflictEventEnriched[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/conflicts");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("events" in data) ||
        !Array.isArray((data as { events: unknown }).events)
      ) {
        throw new Error("Invalid conflict API response shape");
      }
      const parsed = data as ConflictApiResponse;
      setEvents(parsed.events);
      setTotal(parsed.total);
      setError(null);
      setLastUpdated(new Date());
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
      setEvents([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchData();
    intervalRef.current = setInterval(fetchData, CONFLICT_POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchData]);

  return { events, total, loading, error, lastUpdated };
};
