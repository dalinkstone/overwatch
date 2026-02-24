import { AircraftState } from "./types";

/**
 * Format barometric altitude for display.
 * Returns "Ground" for aircraft on the ground, "N/A" for missing data,
 * or the altitude formatted with commas and " ft" suffix.
 */
export const formatAltitude = (alt: number | "ground" | undefined): string => {
  if (alt === undefined) return "N/A";
  if (alt === "ground") return "Ground";
  return `${alt.toLocaleString("en-US")} ft`;
};

/**
 * Format ground speed for display.
 * Returns "N/A" for missing data, or the speed with " kts" suffix.
 */
export const formatSpeed = (gs: number | undefined): string => {
  if (gs === undefined) return "N/A";
  return `${Math.round(gs)} kts`;
};

/**
 * Format a callsign for display.
 * Trims whitespace and returns "UNKNOWN" if empty or undefined.
 */
export const formatCallsign = (flight: string | undefined): string => {
  const trimmed = flight?.trim();
  if (!trimmed) return "UNKNOWN";
  return trimmed;
};

/**
 * Get the best available label for an aircraft.
 * Prefers callsign, then registration, then hex code.
 */
export const getAircraftLabel = (ac: AircraftState): string => {
  const callsign = ac.flight?.trim();
  if (callsign) return callsign;
  if (ac.r) return ac.r;
  return ac.hex.toUpperCase();
};
