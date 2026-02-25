/**
 * Humanitarian crisis type definitions and helpers for the ReliefWeb layer.
 * Covers UN OCHA humanitarian data: active disasters, situation reports, and severity.
 * Pure types-and-functions file with no side effects.
 */

/** Disaster/crisis type classification from ReliefWeb. */
export type HumanitarianCrisisType =
  | 'complex-emergency'
  | 'conflict'
  | 'drought'
  | 'earthquake'
  | 'epidemic'
  | 'flood'
  | 'food-insecurity'
  | 'cyclone'
  | 'volcano'
  | 'wildfire'
  | 'displacement'
  | 'other';

/** A single disaster within a country from ReliefWeb. */
export interface HumanitarianDisaster {
  id: string;
  name: string;
  glideNumber: string | null;
  type: HumanitarianCrisisType;
  status: 'ongoing' | 'past' | 'alert';
  dateStarted: string | null;
  url: string;
}

/** Aggregated humanitarian crisis data for a single country. */
export interface HumanitarianCrisis {
  /** ReliefWeb disaster ID (primary disaster for this country) */
  id: string;
  /** Crisis/disaster name (e.g., "Syria: Complex Emergency") */
  name: string;
  /** Current status */
  status: 'ongoing' | 'past' | 'alert';
  /** GLIDE disaster tracking number */
  glideNumber: string | null;
  /** Primary disaster type */
  type: HumanitarianCrisisType;
  /** Primary country name */
  country: string;
  /** ISO 3166-1 alpha-3 code (used for choropleth join) */
  countryIso3: string;
  /** Country centroid latitude (for badge placement) */
  lat: number;
  /** Country centroid longitude */
  lon: number;
  /** Derived severity from report count + disaster type */
  severity: 'critical' | 'major' | 'moderate' | 'minor';
  /** Number of active disasters for this country */
  disasterCount: number;
  /** Situation reports in last 30 days */
  reportCount: number;
  /** ISO date of most recent report */
  lastReportDate: string | null;
  /** Title of most recent report */
  lastReportTitle: string | null;
  /** Link to most recent report on ReliefWeb */
  lastReportUrl: string | null;
  /** Active disasters in this country */
  disasters: HumanitarianDisaster[];
  /** ISO timestamp */
  updatedAt: string;
}

/** API response from /api/humanitarian proxy route. */
export interface HumanitarianApiResponse {
  /** Country-level humanitarian crisis data */
  crises: HumanitarianCrisis[];
  /** Number of affected countries */
  totalCountries: number;
  /** Total active disasters across all countries */
  totalDisasters: number;
  /** Total situation reports in last 30 days */
  totalReports: number;
  /** ISO datetime of when this response was generated */
  timestamp: string;
  /** True if some ReliefWeb endpoints failed */
  partial: boolean;
}

// ---------------------------------------------------------------------------
// Severity colors (for choropleth shading)
// ---------------------------------------------------------------------------

/** Get hex color for choropleth shading by severity. */
export const getSeverityColor = (severity: HumanitarianCrisis['severity']): string => {
  switch (severity) {
    case 'critical': return '#991b1b';  // deep red (matches mass-violence)
    case 'major': return '#dc2626';     // red
    case 'moderate': return '#f97316';  // orange
    case 'minor': return '#eab308';     // yellow
  }
};

// ---------------------------------------------------------------------------
// Crisis type labels
// ---------------------------------------------------------------------------

/** Get human-readable label for a crisis type. */
export const getCrisisTypeLabel = (type: HumanitarianCrisisType): string => {
  switch (type) {
    case 'complex-emergency': return 'Complex Emergency';
    case 'conflict': return 'Conflict';
    case 'drought': return 'Drought';
    case 'earthquake': return 'Earthquake';
    case 'epidemic': return 'Epidemic';
    case 'flood': return 'Flood';
    case 'food-insecurity': return 'Food Insecurity';
    case 'cyclone': return 'Cyclone';
    case 'volcano': return 'Volcano';
    case 'wildfire': return 'Wildfire';
    case 'displacement': return 'Displacement';
    case 'other': return 'Other';
  }
};

// ---------------------------------------------------------------------------
// Severity derivation
// ---------------------------------------------------------------------------

/** Derive severity from report count, disaster count, and disaster types. */
export const getSeverityFromData = (
  reportCount: number,
  disasterCount: number,
  types: HumanitarianCrisisType[],
): HumanitarianCrisis['severity'] => {
  if (reportCount >= 50 || disasterCount >= 3 || types.includes('complex-emergency')) {
    return 'critical';
  }
  if (reportCount >= 20 || disasterCount >= 2 || types.includes('conflict')) {
    return 'major';
  }
  if (reportCount >= 5) {
    return 'moderate';
  }
  return 'minor';
};

// ---------------------------------------------------------------------------
// Country centroid lookup
// ---------------------------------------------------------------------------

/** Approximate centroids for crisis-affected countries (ISO3 → lat/lon). */
const COUNTRY_CENTROIDS: Readonly<Record<string, { lat: number; lon: number }>> = {
  // Middle East & North Africa
  AFG: { lat: 33.94, lon: 67.71 },
  IRQ: { lat: 33.22, lon: 43.68 },
  IRN: { lat: 32.43, lon: 53.69 },
  SYR: { lat: 34.80, lon: 38.99 },
  YEM: { lat: 15.55, lon: 48.52 },
  LBN: { lat: 33.85, lon: 35.86 },
  JOR: { lat: 30.59, lon: 36.24 },
  PSE: { lat: 31.95, lon: 35.23 },
  LBY: { lat: 26.34, lon: 17.23 },
  TUN: { lat: 33.89, lon: 9.54 },
  DZA: { lat: 28.03, lon: 1.66 },
  MAR: { lat: 31.79, lon: -7.09 },
  EGY: { lat: 26.82, lon: 30.80 },
  SAU: { lat: 23.89, lon: 45.08 },
  TUR: { lat: 38.96, lon: 35.24 },

  // Sub-Saharan Africa
  SDN: { lat: 12.86, lon: 30.22 },
  SSD: { lat: 6.88, lon: 31.31 },
  SOM: { lat: 5.15, lon: 46.20 },
  ETH: { lat: 9.15, lon: 40.49 },
  COD: { lat: -4.04, lon: 21.76 },
  CAF: { lat: 6.61, lon: 20.94 },
  NGA: { lat: 9.08, lon: 8.68 },
  NER: { lat: 17.61, lon: 8.08 },
  MLI: { lat: 17.57, lon: -4.00 },
  BFA: { lat: 12.24, lon: -1.56 },
  TCD: { lat: 15.45, lon: 18.73 },
  CMR: { lat: 7.37, lon: 12.35 },
  MOZ: { lat: -18.67, lon: 35.53 },
  MDG: { lat: -18.77, lon: 46.87 },
  KEN: { lat: -0.02, lon: 37.91 },
  UGA: { lat: 1.37, lon: 32.29 },
  RWA: { lat: -1.94, lon: 29.87 },
  BDI: { lat: -3.37, lon: 29.92 },
  ERI: { lat: 15.18, lon: 39.78 },
  ZWE: { lat: -19.02, lon: 29.15 },
  MWI: { lat: -13.25, lon: 34.30 },
  ZMB: { lat: -13.13, lon: 27.85 },
  AGO: { lat: -11.20, lon: 17.87 },
  COG: { lat: -0.23, lon: 15.83 },
  TZA: { lat: -6.37, lon: 34.89 },
  SLE: { lat: 8.46, lon: -11.78 },
  LBR: { lat: 6.43, lon: -9.43 },
  GIN: { lat: 9.95, lon: -9.70 },
  SEN: { lat: 14.50, lon: -14.45 },
  GHA: { lat: 7.95, lon: -1.02 },
  CIV: { lat: 7.54, lon: -5.55 },
  BEN: { lat: 9.31, lon: 2.32 },
  TGO: { lat: 8.62, lon: 1.21 },
  MRT: { lat: 21.01, lon: -10.94 },
  GMB: { lat: 13.44, lon: -15.31 },
  GNB: { lat: 11.80, lon: -15.18 },
  ZAF: { lat: -30.56, lon: 22.94 },

  // Asia & Pacific
  MMR: { lat: 21.91, lon: 95.96 },
  BGD: { lat: 23.68, lon: 90.36 },
  PAK: { lat: 30.38, lon: 69.35 },
  IND: { lat: 20.59, lon: 78.96 },
  LKA: { lat: 7.87, lon: 80.77 },
  NPL: { lat: 28.39, lon: 84.12 },
  PHL: { lat: 12.88, lon: 121.77 },
  IDN: { lat: -0.79, lon: 113.92 },
  TLS: { lat: -8.87, lon: 125.73 },
  FJI: { lat: -17.71, lon: 178.07 },
  VUT: { lat: -15.38, lon: 166.96 },
  PNG: { lat: -6.31, lon: 143.96 },
  KHM: { lat: 12.57, lon: 104.99 },
  LAO: { lat: 19.86, lon: 102.50 },
  VNM: { lat: 14.06, lon: 108.28 },
  THA: { lat: 15.87, lon: 100.99 },
  MNG: { lat: 46.86, lon: 103.85 },
  PRK: { lat: 40.34, lon: 127.51 },
  CHN: { lat: 35.86, lon: 104.20 },

  // Europe & Central Asia
  UKR: { lat: 48.38, lon: 31.17 },
  GEO: { lat: 42.32, lon: 43.36 },
  ARM: { lat: 40.07, lon: 45.04 },
  AZE: { lat: 40.14, lon: 47.58 },
  TJK: { lat: 38.86, lon: 71.28 },
  KGZ: { lat: 41.20, lon: 74.77 },
  UZB: { lat: 41.38, lon: 64.59 },
  TKM: { lat: 38.97, lon: 59.56 },
  KAZ: { lat: 48.02, lon: 66.92 },
  BIH: { lat: 43.92, lon: 17.68 },
  SRB: { lat: 44.02, lon: 21.01 },
  ALB: { lat: 41.15, lon: 20.17 },
  MDA: { lat: 47.41, lon: 28.37 },
  BLR: { lat: 53.71, lon: 27.95 },

  // Americas
  HTI: { lat: 18.97, lon: -72.29 },
  HND: { lat: 15.20, lon: -86.24 },
  GTM: { lat: 15.78, lon: -90.23 },
  SLV: { lat: 13.79, lon: -88.90 },
  NIC: { lat: 12.87, lon: -85.21 },
  COL: { lat: 4.57, lon: -74.30 },
  VEN: { lat: 6.42, lon: -66.59 },
  PER: { lat: -9.19, lon: -75.02 },
  ECU: { lat: -1.83, lon: -78.18 },
  BRA: { lat: -14.24, lon: -51.93 },
  CHL: { lat: -35.68, lon: -71.54 },
  CUB: { lat: 21.52, lon: -77.78 },
  MEX: { lat: 23.63, lon: -102.55 },
  DOM: { lat: 18.74, lon: -70.16 },
  ARG: { lat: -38.42, lon: -63.62 },
  BOL: { lat: -16.29, lon: -63.59 },
  PRY: { lat: -23.44, lon: -58.44 },
  USA: { lat: 37.09, lon: -95.71 },

  // Island states & other
  TON: { lat: -21.18, lon: -175.20 },
  WSM: { lat: -13.76, lon: -172.10 },
  SLB: { lat: -9.65, lon: 160.16 },
  MHL: { lat: 7.13, lon: 171.18 },
  FSM: { lat: 7.43, lon: 150.55 },
  KIR: { lat: -3.37, lon: -168.73 },
  TUV: { lat: -7.11, lon: 177.65 },
  DJI: { lat: 11.83, lon: 42.59 },
  COM: { lat: -11.88, lon: 43.87 },
  SYC: { lat: -4.68, lon: 55.49 },
  MUS: { lat: -20.35, lon: 57.55 },
  CPV: { lat: 16.00, lon: -24.01 },
  STP: { lat: 0.19, lon: 6.61 },
};

/** Look up approximate centroid for a country by ISO3 code. */
export const getCountryCentroid = (iso3: string): { lat: number; lon: number } | null =>
  COUNTRY_CENTROIDS[iso3] ?? null;
