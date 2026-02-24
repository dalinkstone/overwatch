import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { VesselData } from "@/lib/vesselTypes";

const VESSEL_POLL_INTERVAL_MS = 15000;

interface VesselConnectionStatus {
  state: string;
  vesselCount: number;
  lastMessage: number;
}

interface UseVesselDataReturn {
  vessels: VesselData[];
  militaryVessels: VesselData[];
  loading: boolean;
  error: string | null;
  status: VesselConnectionStatus;
}

const DEFAULT_STATUS: VesselConnectionStatus = {
  state: "disconnected",
  vesselCount: 0,
  lastMessage: 0,
};

export const useVesselData = (enabled: boolean): UseVesselDataReturn => {
  const [vessels, setVessels] = useState<VesselData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VesselConnectionStatus>(DEFAULT_STATUS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/vessels");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("vessels" in data) ||
        !Array.isArray((data as { vessels: unknown }).vessels)
      ) {
        throw new Error("Invalid vessel API response shape");
      }
      const parsed = data as { vessels: VesselData[]; status: VesselConnectionStatus };
      setVessels(parsed.vessels);
      setStatus(parsed.status ?? DEFAULT_STATUS);
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
      return;
    }

    fetchData();
    intervalRef.current = setInterval(fetchData, VESSEL_POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchData]);

  const militaryVessels = useMemo(
    () => vessels.filter((v) => v.isMilitary),
    [vessels]
  );

  return { vessels, militaryVessels, loading, error, status };
};
