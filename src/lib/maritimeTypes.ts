/**
 * TypeScript interfaces for AIS (Automatic Identification System) vessel data.
 * Data source: Finnish Digitraffic Marine AIS API (https://meri.digitraffic.fi)
 */

/** A single vessel state from the AIS data source. */
export interface VesselState {
  /** Maritime Mobile Service Identity (9-digit number as string) */
  mmsi: string;
  /** Vessel name */
  name?: string;
  /** Latitude in decimal degrees (WGS84) */
  lat?: number;
  /** Longitude in decimal degrees (WGS84) */
  lon?: number;
  /** Course over ground in degrees */
  cog?: number;
  /** Speed over ground in knots */
  sog?: number;
  /** True heading in degrees (0-359) */
  heading?: number;
  /** AIS vessel type code */
  vesselType?: number;
  /** Flag state (derived from MMSI MID) */
  flag?: string;
  /** Reported destination */
  destination?: string;
  /** Timestamp of last position update (ms since epoch) */
  lastUpdate?: number;
  /** Radio callsign */
  callSign?: string;
  /** AIS navigation status (0-15) */
  navStat?: number;
}

/** Response wrapper for vessel data from the proxy route. */
export interface VesselResponse {
  /** Array of vessel states */
  vessels: VesselState[];
  /** Total number of vessels in the response */
  total: number;
  /** ISO timestamp of when the data was last updated upstream */
  dataUpdatedTime?: string;
}

/** Returns true only if the vessel has valid lat and lon coordinates. */
export const hasVesselPosition = (vessel: VesselState): boolean => {
  return typeof vessel.lat === "number" && typeof vessel.lon === "number";
};

/**
 * Returns true if the vessel is likely military or law enforcement.
 * Checks AIS vessel type codes (35 = military ops, 55 = law enforcement)
 * and MMSI prefix range (338-369 for US-flagged vessels).
 */
export const isMilitaryVessel = (vessel: VesselState): boolean => {
  if (vessel.vesselType === 35 || vessel.vesselType === 55) {
    return true;
  }

  if (vessel.mmsi.length >= 3) {
    const mid = parseInt(vessel.mmsi.substring(0, 3), 10);
    if (mid >= 338 && mid <= 369) {
      return true;
    }
  }

  return false;
};
