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
  | 'foreign-military'
  | 'other-military';

/** Display colors for each satellite category. */
export const SATELLITE_COLORS: Record<SatelliteCategory, string> = {
  reconnaissance: '#ef4444',
  sigint: '#f97316',
  communications: '#3b82f6',
  navigation: '#22c55e',
  'early-warning': '#eab308',
  weather: '#06b6d4',
  'foreign-military': '#8b5cf6',
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
  'foreign-military': 'Foreign Military',
  'other-military': 'Other Military',
};

/**
 * NORAD catalog ID → category lookup for known military satellites.
 * CelesTrak lists these as "USA XXX" — names alone can't identify their mission.
 * Sources: n2yo.com, heavens-above.com, space.skyrocket.de, Wikipedia satellite articles.
 */
const NORAD_ID_CATEGORIES: ReadonlyMap<number, SatelliteCategory> = new Map<number, SatelliteCategory>([
  // --- SIGINT/ELINT ---
  // MENTOR / Advanced ORION (GEO SIGINT — large antenna, signals collection)
  [27937, 'sigint'],  // USA 171 — Orion 5
  [33490, 'sigint'],  // USA 202 — Orion 6
  [37232, 'sigint'],  // USA 223 — Orion 7
  [38528, 'sigint'],  // USA 237 — Orion 8
  [41584, 'sigint'],  // USA 268 — Orion 9
  [47237, 'sigint'],  // USA 311 — Orion 10
  [57099, 'sigint'],  // USA 345 — Orion 11
  [59453, 'sigint'],  // USA 353 — Orion 12
  // TRUMPET / Trumpet Follow-On (HEO SIGINT, also host SBIRS HEO payloads)
  [23097, 'sigint'],  // USA 103 — Trumpet 1
  [25034, 'sigint'],  // USA 136 — Trumpet 2
  [29249, 'sigint'],  // USA 184 — Trumpet FO 4 (+ SBIRS HEO-1)
  [32699, 'sigint'],  // USA 200 — Trumpet FO 5 (+ SBIRS HEO-2)
  [40344, 'sigint'],  // USA 259 — Trumpet FO 6 (+ SBIRS HEO-3)
  // NOSS / INTRUDER (Naval Ocean Surveillance — LEO SIGINT pairs)
  [26905, 'sigint'],  // USA 160 — NOSS 3-1 A
  [26907, 'sigint'],  // USA 160 — NOSS 3-1 C
  [28095, 'sigint'],  // USA 173 — NOSS 3-2 A
  [28537, 'sigint'],  // USA 181 — NOSS 3-3 A
  [31701, 'sigint'],  // USA 194 — NOSS 3-4 A
  [37386, 'sigint'],  // USA 229 — NOSS 3-5 A
  [38758, 'sigint'],  // USA 238 — NOSS 3-6 A
  [40964, 'sigint'],  // USA 264 — NOSS 3-7 A
  [42058, 'sigint'],  // USA 274 — NOSS 3-8 A
  [52259, 'sigint'],  // USA 327 — NOSS 3-9

  // --- Reconnaissance (imaging/radar) ---
  // KH-11 / CRYSTAL / Evolved Enhanced CRYSTAL (electro-optical LEO)
  [37348, 'reconnaissance'],  // USA 224 — KH-11 Block 4
  [39232, 'reconnaissance'],  // USA 245 — KH-11 Block 4
  [43941, 'reconnaissance'],  // USA 290 — KH-11 Block 5 (probable)
  [48247, 'reconnaissance'],  // USA 314 — NROL-82
  [53883, 'reconnaissance'],  // USA 338 — NROL-91
  // TOPAZ / FIA-Radar (SAR imaging, retrograde ~1100 km orbits)
  [37162, 'reconnaissance'],  // USA 215 — Topaz 1
  [38109, 'reconnaissance'],  // USA 234 — Topaz 2
  [39462, 'reconnaissance'],  // USA 247 — Topaz 3
  [41334, 'reconnaissance'],  // USA 267 — Topaz 4
  [43145, 'reconnaissance'],  // USA 281 — Topaz 5

  // --- Early Warning (missile detection) ---
  // SBIRS GEO (infrared missile warning in GEO)
  [37481, 'early-warning'],  // USA 230 — SBIRS GEO-1
  [39120, 'early-warning'],  // USA 241 — SBIRS GEO-2
  [41937, 'early-warning'],  // USA 273 — SBIRS GEO-3
  [43162, 'early-warning'],  // USA 282 — SBIRS GEO-4
  [48618, 'early-warning'],  // USA 315 — SBIRS GEO-5
  [53355, 'early-warning'],  // USA 336 — SBIRS GEO-6
  // DSP (older infrared early warning in GEO)
  [23435, 'early-warning'],  // USA 107 — DSP 17
  [25669, 'early-warning'],  // USA 142 — DSP 19
  [26356, 'early-warning'],  // USA 149 — DSP 20
  [26880, 'early-warning'],  // USA 159 — DSP 21
  [28158, 'early-warning'],  // USA 176 — DSP 22
  [32287, 'early-warning'],  // USA 197 — DSP 23

  // --- Communications ---
  // AEHF (Advanced Extremely High Frequency — jam-resistant)
  [36868, 'communications'],  // USA 214 — AEHF-1
  [38254, 'communications'],  // USA 235 — AEHF-2
  [39256, 'communications'],  // USA 246 — AEHF-3
  [43651, 'communications'],  // USA 288 — AEHF-4
  [44481, 'communications'],  // USA 292 — AEHF-5
  [45465, 'communications'],  // USA 298 — AEHF-6
  // Milstar (strategic/tactical relay)
  [22988, 'communications'],  // USA 99  — Milstar DFS-1
  [23712, 'communications'],  // USA 115 — Milstar DFS-2
  [26052, 'communications'],  // USA 148 — Milstar DFS-3
  [26715, 'communications'],  // USA 157 — Milstar DFS-4
  [27168, 'communications'],  // USA 164 — Milstar DFS-5
  [27711, 'communications'],  // USA 169 — Milstar DFS-6
  // MUOS (Mobile User Objective System — Navy UHF)
  [38093, 'communications'],  // MUOS-1
  [39206, 'communications'],  // MUOS-2
  [40374, 'communications'],  // MUOS-3
  [40887, 'communications'],  // MUOS-4
  [41622, 'communications'],  // MUOS-5
  // WGS (Wideband Global SATCOM)
  [32258, 'communications'],  // USA 195 — WGS-1
  [34713, 'communications'],  // USA 204 — WGS-2
  [36108, 'communications'],  // USA 211 — WGS-3
  [38070, 'communications'],  // USA 233 — WGS-4
  [39168, 'communications'],  // USA 243 — WGS-5
  [39222, 'communications'],  // USA 244 — WGS-6
  [40746, 'communications'],  // USA 263 — WGS-7
  [41879, 'communications'],  // USA 272 — WGS-8
  [42075, 'communications'],  // USA 275 — WGS-9
  [44071, 'communications'],  // USA 291 — WGS-10
  // SDS / Quasar (Satellite Data System — recon imagery relay)
  [26635, 'communications'],  // USA 155 — SDS-3 1
  [26948, 'communications'],  // USA 162 — SDS-3 2
  [28384, 'communications'],  // USA 179 — SDS-3 3
  [32378, 'communications'],  // USA 198 — SDS-3 4
  [37377, 'communications'],  // USA 227 — SDS-3 5
  [38466, 'communications'],  // USA 236 — SDS-3 6
  [39751, 'communications'],  // USA 252 — SDS-3 7
]);

/**
 * Classify a satellite into a category.
 * 1. Check NORAD ID lookup (highest confidence — known military satellites)
 * 2. Fall back to name pattern matching (case-insensitive)
 * 3. Foreign military patterns (COSMOS, YAOGAN, SHIYAN, SHIJIAN not caught above)
 * 4. Default to other-military
 */
export const getSatelliteCategory = (name: string, noradId: number): SatelliteCategory => {
  // NORAD ID lookup — definitive classification for known satellites
  const idMatch = NORAD_ID_CATEGORIES.get(noradId);
  if (idMatch) return idMatch;

  const upper = name.toUpperCase();

  // Navigation — GPS, GLONASS, BeiDou, Galileo, SBAS, NNSS
  if (upper.includes('NAVSTAR') || /\bGPS\b/.test(upper)) return 'navigation';
  if (upper.includes('GLONASS')) return 'navigation';
  if (upper.includes('BEIDOU') || upper.includes('COMPASS')) return 'navigation';
  if (upper.includes('GALILEO') || upper.includes('GSAT')) return 'navigation';
  // COSMOS 2xxx in NORAD 24000-24999 range are older GLONASS satellites
  if (upper.includes('COSMOS') && (noradId >= 24000 && noradId <= 24999)) return 'navigation';

  // Communications — name patterns
  const commsPatterns = ['MUOS', 'AEHF', 'MILSTAR', 'DSCS', 'WGS', 'FLTSATCOM', 'TDRS', 'SICRAL', 'SKYNET', 'SYRACUSE', 'MERIDIAN', 'LUCH', 'GARPUN'];
  for (const pattern of commsPatterns) {
    if (upper.includes(pattern)) return 'communications';
  }
  if (/\bUFO\b/.test(upper) || /\bSDS\b/.test(upper)) return 'communications';

  // Early warning — name patterns
  if (upper.includes('SBIRS') || /\bDSP\b/.test(upper) || upper.includes('STSS') || upper.includes('TUNDRA')) return 'early-warning';

  // Weather — military and civilian patterns
  if (upper.includes('DMSP') || upper.includes('METEOSAT') || upper.includes('GOES ')
    || upper.includes('NOAA ') || upper.includes('FENGYUN') || upper.includes('HIMAWARI')
    || upper.includes('METEOR-M') || upper.includes('SUOMI') || upper.includes('JPSS')
    || upper.includes('ELEKTRO')) return 'weather';

  // SIGINT — codenames (for any catalogs that use them)
  const sigintPatterns = ['MENTOR', 'ORION', 'TRUMPET', 'MERCURY', 'INTRUDER', 'NEMESIS', 'PROWLER'];
  for (const pattern of sigintPatterns) {
    if (upper.includes(pattern)) return 'sigint';
  }

  // Reconnaissance — codenames and Chinese military recon
  const reconPatterns = ['LACROSSE', 'ONYX', 'TOPAZ', 'MISTY', 'CRYSTAL', 'NROL', 'YAOGAN'];
  for (const pattern of reconPatterns) {
    if (upper.includes(pattern)) return 'reconnaissance';
  }

  // Foreign military — COSMOS (non-navigation), Chinese experimental/military
  if (upper.includes('COSMOS') || upper.includes('SHIYAN') || upper.includes('SHIJIAN')) return 'foreign-military';

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
