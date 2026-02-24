/**
 * TypeScript interfaces for the ADSB.lol v2 API response.
 * Reference: https://api.adsb.lol/v2/mil
 */

/** A single aircraft state from the /v2/mil endpoint. */
export interface AircraftState {
  /** ICAO 24-bit hex address (always present) */
  hex: string;
  /** Callsign (up to 8 chars, may contain trailing spaces) */
  flight?: string;
  /** Latitude in decimal degrees (WGS84) */
  lat?: number;
  /** Longitude in decimal degrees (WGS84) */
  lon?: number;
  /** Barometric altitude in feet, or "ground" if on the ground */
  alt_baro?: number | "ground";
  /** Geometric (GNSS) altitude in feet */
  alt_geom?: number;
  /** Ground speed in knots */
  gs?: number;
  /** Track angle in degrees from true north */
  track?: number;
  /** ICAO aircraft type code (e.g. "C17", "F16") */
  t?: string;
  /** Registration / tail number */
  r?: string;
  /** Bitfield flags — bit 0 = military */
  dbFlags?: number;
  /** Transponder squawk code (4-digit octal string) */
  squawk?: string;
  /** Seconds since last message of any kind */
  seen?: number;
  /** Seconds since last position update */
  seen_pos?: number;
  /** Emitter category (e.g. "A1" through "A7", "B1", etc.) */
  category?: string;
}

/** Top-level response from the /v2/mil endpoint. */
export interface AircraftResponse {
  /** Array of aircraft states */
  ac: AircraftState[];
  /** Status message from the API */
  msg: string;
  /** Server timestamp (seconds since epoch) */
  now: number;
  /** Total number of aircraft in the response */
  total: number;
  /** Cache time (seconds) */
  ctime: number;
  /** Processing time (milliseconds) */
  ptime: number;
}

/** Returns true only if the aircraft has valid lat and lon coordinates. */
export const hasPosition = (aircraft: AircraftState): boolean => {
  return (
    typeof aircraft.lat === "number" &&
    typeof aircraft.lon === "number"
  );
};

/** Returns true if the aircraft is flagged as military via dbFlags bit 0. */
export const isMilitary = (aircraft: AircraftState): boolean => {
  return typeof aircraft.dbFlags === "number" && (aircraft.dbFlags & 1) !== 0;
};
