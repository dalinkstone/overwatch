import { useEffect, useRef, useState, useCallback } from "react";
import { HumanitarianCrisis, HumanitarianApiResponse } from "@/lib/humanitarianTypes";

const HUMANITARIAN_POLL_INTERVAL_MS = 1_800_000; // 30 minutes

interface UseHumanitarianDataReturn {
  crises: HumanitarianCrisis[];
  loading: boolean;
  error: string | null;
  totalCountries: number;
  totalDisasters: number;
  partial: boolean;
}

export const useHumanitarianData = (enabled: boolean): UseHumanitarianDataReturn => {
  const [crises, setCrises] = useState<HumanitarianCrisis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCountries, setTotalCountries] = useState(0);
  const [totalDisasters, setTotalDisasters] = useState(0);
  const [partial, setPartial] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/humanitarian");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("crises" in data) ||
        !Array.isArray((data as { crises: unknown }).crises)
      ) {
        throw new Error("Invalid humanitarian API response shape");
      }
      const parsed = data as HumanitarianApiResponse;
      setCrises(parsed.crises);
      setTotalCountries(parsed.totalCountries);
      setTotalDisasters(parsed.totalDisasters);
      setPartial(parsed.partial);
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      // Preserve previous data on error
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
      setCrises([]);
      setTotalCountries(0);
      setTotalDisasters(0);
      setPartial(false);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchData();
    intervalRef.current = setInterval(fetchData, HUMANITARIAN_POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchData]);

  return { crises, loading, error, totalCountries, totalDisasters, partial };
};
