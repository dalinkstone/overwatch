/**
 * Airspace type definitions, classification, and styling for restricted airspace overlay.
 * Covers FAA Special Use Airspace (SUA) and Temporary Flight Restrictions (TFRs).
 * Pure types-and-functions file with no side effects.
 */

/** Airspace zone types — all are restrictions, no regular class airspace. */
export type AirspaceType = 'restricted' | 'prohibited' | 'moa' | 'warning' | 'alert' | 'tfr';

/** TFR sub-types mapped from 14 CFR sections for intelligence context. */
export type TfrType = 'vip' | 'security' | 'hazard' | 'space' | 'event' | 'national-defense' | 'other';

/** A single normalized airspace zone from either SUA or TFR data. */
export interface AirspaceZone {
  /** Unique ID — SUA name (e.g., "R-2301W") or NOTAM ID (e.g., "4/5272") */
  id: string;
  /** Display name */
  name: string;
  /** Zone classification */
  type: AirspaceType;
  /** TFR sub-classification — only present when type is 'tfr' */
  tfrType?: TfrType;
  /** GeoJSON geometry — Polygon for SUA, Polygon or Point for TFRs */
  geometry: GeoJSON.Geometry;
  /** Center point for circular TFRs */
  center?: { lat: number; lon: number };
  /** Radius in nautical miles for circular TFRs */
  radiusNm?: number;
  /** Upper altitude bound (e.g., "FL180", "18000 MSL", "Unlimited") */
  upperAltitude?: string;
  /** Lower altitude bound (e.g., "SFC", "3000 MSL") */
  lowerAltitude?: string;
  /** Active schedule — SUA only (e.g., "CONT", "BY NOTAM", specific times) */
  schedule?: string;
  /** Human-readable description */
  description?: string;
  /** ISO datetime — effective start (TFRs only) */
  effectiveStart?: string;
  /** ISO datetime — effective end (TFRs only) */
  effectiveEnd?: string;
  /** Whether the zone is currently active */
  isActive: boolean;
  /** US state where the zone is located */
  state?: string;
  /** Data source origin */
  source: 'sua' | 'tfr';
}

/** API response from /api/airspace proxy route. */
export interface AirspaceResponse {
  /** Normalized airspace zones from both SUA and TFR sources */
  zones: AirspaceZone[];
  /** Total count of zones returned */
  total: number;
  /** Whether some sources failed (partial data) */
  partial: boolean;
  /** ISO timestamp of when data was fetched */
  timestamp: string;
}

/** FAA ArcGIS TYPE_CODE values we query for. */
export type SuaTypeCode = 'R' | 'P' | 'MOA' | 'W' | 'A';

/** Map FAA ArcGIS TYPE_CODE to our normalized AirspaceType. */
export const mapSuaTypeCode = (typeCode: string): AirspaceType => {
  switch (typeCode) {
    case 'R': return 'restricted';
    case 'P': return 'prohibited';
    case 'MOA': return 'moa';
    case 'W': return 'warning';
    case 'A': return 'alert';
    default: return 'restricted';
  }
};

/** Map TFR NOTAM text / CFR section to a TfrType. */
export const classifyTfr = (text: string): TfrType => {
  const upper = text.toUpperCase();

  if (upper.includes('91.141') || upper.includes('VIP') || upper.includes('POTUS')
    || upper.includes('PRESIDENT') || upper.includes('VICE PRESIDENT')) return 'vip';
  if (upper.includes('91.139') || upper.includes('SECURITY') || upper.includes('NATIONAL DEFENSE')
    || upper.includes('99.7')) return 'security';
  if (upper.includes('91.137') || upper.includes('HAZARD') || upper.includes('DISASTER')) return 'hazard';
  if (upper.includes('91.143') || upper.includes('SPACE') || upper.includes('ROCKET')
    || upper.includes('LAUNCH') || upper.includes('REENTRY')) return 'space';
  if (upper.includes('91.145') || upper.includes('SPORTING') || upper.includes('AIRSHOW')
    || upper.includes('AERIAL DEMO')) return 'event';
  if (upper.includes('NATIONAL DEF') || upper.includes('DEFENSE')) return 'national-defense';

  return 'other';
};

/** Display colors for each airspace type — fill color. */
export const AIRSPACE_COLORS: Record<AirspaceType, string> = {
  prohibited: '#ef4444',
  restricted: '#f97316',
  moa: '#eab308',
  warning: '#8b5cf6',
  alert: '#06b6d4',
  tfr: '#dc2626',
};

/** Fill opacity for each airspace type. */
export const AIRSPACE_FILL_OPACITY: Record<AirspaceType, number> = {
  prohibited: 0.25,
  restricted: 0.20,
  moa: 0.15,
  warning: 0.15,
  alert: 0.10,
  tfr: 0.30,
};

/** Stroke opacity for each airspace type. */
export const AIRSPACE_STROKE_OPACITY: Record<AirspaceType, number> = {
  prohibited: 0.8,
  restricted: 0.7,
  moa: 0.6,
  warning: 0.6,
  alert: 0.5,
  tfr: 0.9,
};

/** Human-readable labels for each airspace type. */
export const AIRSPACE_TYPE_LABELS: Record<AirspaceType, string> = {
  prohibited: 'Prohibited',
  restricted: 'Restricted',
  moa: 'MOA',
  warning: 'Warning',
  alert: 'Alert',
  tfr: 'TFR',
};

/** Human-readable labels for TFR sub-types. */
export const TFR_TYPE_LABELS: Record<TfrType, string> = {
  vip: 'VIP/Presidential',
  security: 'Security',
  hazard: 'Hazard/Disaster',
  space: 'Space Operations',
  event: 'Sporting Event/Demo',
  'national-defense': 'National Defense',
  other: 'Other',
};

/** Format altitude string from FAA data (value + unit of measure). */
export const formatAirspaceAltitude = (value: string | undefined, uom: string | undefined): string => {
  if (!value) return 'Unknown';
  const num = parseInt(value, 10);
  if (isNaN(num)) return value;
  if (num === 0) return 'SFC';
  if (uom === 'FL' || uom === 'FLIGHT LEVEL') return `FL${num}`;
  if (uom === 'MSL') return `${num.toLocaleString()} MSL`;
  if (uom === 'AGL') return `${num.toLocaleString()} AGL`;
  return `${num.toLocaleString()} ${uom ?? 'ft'}`;
};

/** Check whether an airspace zone is currently active based on schedule and effective times. */
export const isZoneActive = (zone: Pick<AirspaceZone, 'source' | 'schedule' | 'effectiveStart' | 'effectiveEnd'>): boolean => {
  // TFRs: check effective time window
  if (zone.source === 'tfr') {
    const now = Date.now();
    if (zone.effectiveStart && new Date(zone.effectiveStart).getTime() > now) return false;
    if (zone.effectiveEnd && new Date(zone.effectiveEnd).getTime() < now) return false;
    return true;
  }

  // SUA: "CONT" means continuous, always active
  if (zone.schedule?.toUpperCase() === 'CONT') return true;

  // "BY NOTAM" means activation is dynamic — show as potentially active
  if (zone.schedule?.toUpperCase().includes('NOTAM')) return true;

  // If schedule exists but isn't CONT or NOTAM, it's time-based — assume active
  // (full schedule parsing would require day/time parsing which is out of scope)
  return true;
};
