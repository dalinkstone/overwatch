/**
 * Vessel type definitions and military identification logic for AIS vessel tracking.
 * Pure types-and-functions file with no side effects.
 */

/** A single vessel from AIS data. */
export interface VesselData {
  /** 9-digit Maritime Mobile Service Identity — the unique vessel ID */
  mmsi: string;
  /** Vessel name from AIS broadcast, may be empty */
  name: string;
  /** Latitude in decimal degrees */
  lat: number;
  /** Longitude in decimal degrees */
  lon: number;
  /** Course over ground in degrees, 0-360 */
  cog: number;
  /** Speed over ground in knots */
  sog: number;
  /** True heading in degrees — value 511 means "not available" */
  heading: number;
  /** AIS ship type code, 0-99 */
  shipType: number;
  /** Self-reported destination, may be empty */
  destination: string;
  /** Country name derived from MMSI's MID digits */
  flag: string;
  /** Whether this vessel is identified as military */
  isMilitary: boolean;
  /** Military vessel sub-category: 'warship' | 'coast-guard' | 'military-support' | 'law-enforcement' | '' */
  militaryCategory: string;
  /** Unix timestamp in milliseconds */
  lastUpdate: number;
}

/** Visual category for vessel display. */
export type VesselCategory =
  | 'military'
  | 'cargo'
  | 'tanker'
  | 'passenger'
  | 'fishing'
  | 'tug'
  | 'highspeed'
  | 'pleasure'
  | 'other';

/** Map AIS ship type code to a display category. */
export const getVesselCategory = (shipType: number): VesselCategory => {
  if (shipType === 35 || shipType === 55) return 'military';
  if (shipType === 30) return 'fishing';
  if (shipType === 31 || shipType === 32 || shipType === 52) return 'tug';
  if (shipType === 36 || shipType === 37) return 'pleasure';
  if (shipType >= 40 && shipType <= 49) return 'highspeed';
  if (shipType >= 60 && shipType <= 69) return 'passenger';
  if (shipType >= 70 && shipType <= 79) return 'cargo';
  if (shipType >= 80 && shipType <= 89) return 'tanker';
  return 'other';
};

/** Extract the Maritime Identification Digits (first 3 digits) from an MMSI. */
export const getMIDFromMMSI = (mmsi: string): string => {
  return mmsi.substring(0, 3);
};

/** MID → country name lookup for major maritime and naval nations. */
const MID_TO_COUNTRY: Record<string, string> = {
  // United States
  '303': 'United States',
  '338': 'United States',
  '339': 'United States',
  '366': 'United States',
  '367': 'United States',
  '368': 'United States',
  '369': 'United States',
  // United Kingdom
  '232': 'United Kingdom',
  '233': 'United Kingdom',
  '234': 'United Kingdom',
  '235': 'United Kingdom',
  // France
  '226': 'France',
  '227': 'France',
  '228': 'France',
  // Germany
  '211': 'Germany',
  '218': 'Germany',
  // Italy
  '247': 'Italy',
  // Spain
  '224': 'Spain',
  '225': 'Spain',
  // Netherlands
  '244': 'Netherlands',
  '245': 'Netherlands',
  '246': 'Netherlands',
  // Norway
  '257': 'Norway',
  '258': 'Norway',
  '259': 'Norway',
  // Sweden
  '265': 'Sweden',
  '266': 'Sweden',
  // Denmark
  '219': 'Denmark',
  '220': 'Denmark',
  // Finland
  '230': 'Finland',
  // Poland
  '261': 'Poland',
  // Greece
  '237': 'Greece',
  '239': 'Greece',
  '240': 'Greece',
  '241': 'Greece',
  // Turkey
  '271': 'Turkey',
  // Russia
  '273': 'Russia',
  // Ukraine
  '272': 'Ukraine',
  // China
  '412': 'China',
  '413': 'China',
  '414': 'China',
  '453': 'China',
  // Hong Kong
  '477': 'Hong Kong',
  // Japan
  '431': 'Japan',
  '432': 'Japan',
  // South Korea
  '440': 'South Korea',
  '441': 'South Korea',
  // North Korea
  '445': 'North Korea',
  // Taiwan
  '416': 'Taiwan',
  // India
  '419': 'India',
  // Pakistan
  '463': 'Pakistan',
  // Iran
  '422': 'Iran',
  // Israel
  '428': 'Israel',
  // Saudi Arabia
  '403': 'Saudi Arabia',
  // UAE
  '470': 'UAE',
  '471': 'UAE',
  // Egypt
  '622': 'Egypt',
  // Australia
  '503': 'Australia',
  '504': 'Australia',
  // New Zealand
  '512': 'New Zealand',
  // Canada
  '316': 'Canada',
  // Brazil
  '710': 'Brazil',
  // Singapore
  '563': 'Singapore',
  '564': 'Singapore',
  '565': 'Singapore',
  '566': 'Singapore',
  // Malaysia
  '533': 'Malaysia',
  // Philippines
  '548': 'Philippines',
  // Indonesia
  '525': 'Indonesia',
  // Thailand
  '567': 'Thailand',
  // Vietnam
  '574': 'Vietnam',
  // Portugal
  '255': 'Portugal',
  '263': 'Portugal',
  // Malta
  '215': 'Malta',
  '229': 'Malta',
  '249': 'Malta',
  '256': 'Malta',
  // Panama
  '351': 'Panama',
  '352': 'Panama',
  '353': 'Panama',
  '354': 'Panama',
  '355': 'Panama',
  '356': 'Panama',
  '357': 'Panama',
  '370': 'Panama',
  '371': 'Panama',
  '372': 'Panama',
  // Liberia
  '636': 'Liberia',
  '637': 'Liberia',
  // Marshall Islands
  '538': 'Marshall Islands',
  // Bahamas
  '308': 'Bahamas',
  '309': 'Bahamas',
  '311': 'Bahamas',
};

/** Look up country name from a Maritime Identification Digits code. */
export const getCountryFromMID = (mid: string): string => {
  return MID_TO_COUNTRY[mid] ?? 'Unknown';
};

/** Military vessel name prefixes/keywords indicating warships. */
const WARSHIP_PATTERNS = [
  'WARSHIP',
  'USS ',
  ' USN ',
  'USCG',
  'USCGC',
  'HMS ',
  'HMCS ',
  'HMAS ',
  'HMNZS',
  'FGS ',
  'ITS ',
  'ESPS ',
  'TCG ',
];

/** Coast guard name patterns. */
const COAST_GUARD_PATTERNS = ['COAST GUARD', 'COASTGUARD'];

/**
 * Identify whether a vessel is military based on AIS type code, name, and MMSI.
 * Checks signals in priority order — first match wins.
 */
export const identifyMilitaryVessel = (
  mmsi: string,
  shipType: number,
  name: string
): { isMilitary: boolean; category: string } => {
  // a) AIS type code 35 → warship
  if (shipType === 35) {
    return { isMilitary: true, category: 'warship' };
  }

  // b) AIS type code 55 → law enforcement
  if (shipType === 55) {
    return { isMilitary: true, category: 'law-enforcement' };
  }

  const upperName = name.toUpperCase();

  // c) Name contains warship patterns
  for (const pattern of WARSHIP_PATTERNS) {
    if (upperName.includes(pattern)) {
      return { isMilitary: true, category: 'warship' };
    }
  }

  // d) Name contains coast guard patterns
  for (const pattern of COAST_GUARD_PATTERNS) {
    if (upperName.includes(pattern)) {
      return { isMilitary: true, category: 'coast-guard' };
    }
  }

  // e) MMSI starts with '3669' (US federal NTIA assignment)
  if (mmsi.startsWith('3669')) {
    return { isMilitary: true, category: 'military-support' };
  }

  // f) No match
  return { isMilitary: false, category: '' };
};

/** Display colors for each vessel category. */
export const VESSEL_COLORS: Record<VesselCategory, string> = {
  military: '#ff4444',
  cargo: '#4a9eff',
  tanker: '#ff8c00',
  passenger: '#22c55e',
  fishing: '#a855f7',
  tug: '#eab308',
  highspeed: '#06b6d4',
  pleasure: '#ec4899',
  other: '#9ca3af',
};
