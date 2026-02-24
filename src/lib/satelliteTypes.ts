/**
 * Satellite type definitions, category classification, and formatting utilities.
 * Pure types-and-functions file with no side effects.
 */

/** CelesTrak OMM (Orbit Mean-Elements Message) JSON record. */
export interface SatelliteOMM {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

/** Computed satellite position and metadata. */
export interface SatellitePosition {
  noradId: number;
  name: string;
  objectId: string;
  lat: number;
  lon: number;
  /** Altitude in kilometers */
  altitude: number;
  /** Velocity magnitude in km/s */
  velocity: number;
  category: SatelliteCategory;
  epoch: string;
  inclination: number;
  /** Orbital period in minutes (1440 / MEAN_MOTION) */
  period: number;
}

/** Satellite classification categories. */
export type SatelliteCategory =
  | 'reconnaissance'
  | 'sigint'
  | 'communications'
  | 'navigation'
  | 'early-warning'
  | 'weather'
  | 'other-military';

/** Display colors for each satellite category. */
export const SATELLITE_COLORS: Record<SatelliteCategory, string> = {
  reconnaissance: '#ef4444',
  sigint: '#f97316',
  communications: '#3b82f6',
  navigation: '#22c55e',
  'early-warning': '#eab308',
  weather: '#06b6d4',
  'other-military': '#a855f7',
};

/** Human-readable labels for each satellite category. */
export const SATELLITE_CATEGORY_LABELS: Record<SatelliteCategory, string> = {
  reconnaissance: 'Reconnaissance',
  sigint: 'SIGINT/ELINT',
  communications: 'Communications',
  navigation: 'Navigation (GPS)',
  'early-warning': 'Early Warning',
  weather: 'Weather',
  'other-military': 'Other Military',
};

/**
 * Classify a satellite into a category by name pattern matching (case-insensitive).
 * Checks categories in priority order — first match wins.
 */
export const getSatelliteCategory = (name: string, _noradId: number): SatelliteCategory => {
  const upper = name.toUpperCase();

  // Navigation — GPS constellation
  if (upper.includes('NAVSTAR') || /\bGPS\b/.test(upper)) {
    return 'navigation';
  }

  // Communications
  const commsPatterns = ['MUOS', 'AEHF', 'MILSTAR', 'DSCS', 'WGS', 'FLTSATCOM', 'TDRS'];
  for (const pattern of commsPatterns) {
    if (upper.includes(pattern)) return 'communications';
  }
  if (/\bUFO\b/.test(upper) || /\bSDS\b/.test(upper)) {
    return 'communications';
  }

  // Early warning
  if (upper.includes('SBIRS') || /\bDSP\b/.test(upper) || upper.includes('STSS')) {
    return 'early-warning';
  }

  // Weather
  if (upper.includes('DMSP')) {
    return 'weather';
  }

  // SIGINT
  const sigintPatterns = ['MENTOR', 'ORION', 'TRUMPET', 'MERCURY', 'INTRUDER', 'NEMESIS', 'PROWLER'];
  for (const pattern of sigintPatterns) {
    if (upper.includes(pattern)) return 'sigint';
  }

  // Reconnaissance
  const reconPatterns = ['LACROSSE', 'ONYX', 'TOPAZ', 'MISTY', 'CRYSTAL', 'NROL'];
  for (const pattern of reconPatterns) {
    if (upper.includes(pattern)) return 'reconnaissance';
  }

  return 'other-military';
};

/** Format satellite altitude with orbit regime label. */
export const formatAltitude = (altitudeKm: number): string => {
  const rounded = Math.round(altitudeKm);
  if (rounded < 2000) {
    return `${rounded.toLocaleString()} km (LEO)`;
  }
  if (rounded < 35000) {
    return `${rounded.toLocaleString()} km (MEO)`;
  }
  return `${rounded.toLocaleString()} km (GEO)`;
};

/** Format orbital period as minutes or hours+minutes. */
export const formatPeriod = (periodMinutes: number): string => {
  const rounded = Math.round(periodMinutes);
  if (rounded <= 60) {
    return `${rounded} min`;
  }
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return `${hours}h ${mins}m`;
};

/** Determine orbit type from orbital period in minutes. */
export const getOrbitType = (periodMinutes: number): string => {
  if (periodMinutes < 128) return 'LEO';
  if (periodMinutes < 1400) return 'MEO';
  if (periodMinutes <= 1500) return 'GEO';
  return 'HEO';
};
