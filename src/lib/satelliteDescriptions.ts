/**
 * Satellite program descriptions and metadata lookups.
 * Descriptions are definitionally true statements sourced from official program documentation.
 * Classified satellites state only that the mission is not publicly disclosed.
 */

export interface SatelliteDescription {
  description: string;
  operator: string;
  constellation?: string;
  manufacturer?: string;
  confidence: 'public' | 'classified';
}

/** Launch site code to human-readable name. */
const LAUNCH_SITES: Record<string, string> = {
  'AFETR': 'Cape Canaveral, USA',
  'AFWTR': 'Vandenberg, USA',
  'TYMSC': 'Plesetsk, Russia',
  'TTMTR': 'Baikonur, Kazakhstan',
  'JSC': 'Jiuquan, China',
  'TSC': 'Taiyuan, China',
  'XSC': 'Xichang, China',
  'WSC': 'Wenchang, China',
  'TANSC': 'Tanegashima, Japan',
  'SRILR': 'Sriharikota, India',
  'CSG': 'Kourou, French Guiana',
  'KSCUT': 'Uchinoura, Japan',
  'SVOB': 'Svobodny, Russia',
  'VOSTO': 'Vostochny, Russia',
  'KWAJ': 'Kwajalein, Marshall Islands',
  'SEAL': 'Sea Launch Platform',
  'SNMLP': 'San Marco, Kenya',
};

/** Format a launch site code to human-readable string. */
export const formatLaunchSite = (code: string): string => {
  const trimmed = code.trim();
  return LAUNCH_SITES[trimmed] ?? trimmed;
};

/** SATCAT owner code to human-readable name. */
const OWNER_CODES: Record<string, string> = {
  'US': 'United States',
  'CIS': 'Russia (CIS)',
  'PRC': "People's Republic of China",
  'ESA': 'European Space Agency',
  'FR': 'France',
  'IN': 'India',
  'ITSO': 'International',
  'JPN': 'Japan',
  'UK': 'United Kingdom',
  'GER': 'Germany',
  'IT': 'Italy',
  'ISR': 'Israel',
  'AUS': 'Australia',
  'CA': 'Canada',
  'BRAZ': 'Brazil',
  'SPN': 'Spain',
  'KOR': 'South Korea',
  'NATO': 'NATO',
  'RP': 'Philippines',
  'TBD': 'Unknown',
};

/** Format an owner code to human-readable string. */
export const formatOwner = (code: string): string => {
  const trimmed = code.trim();
  return OWNER_CODES[trimmed] ?? trimmed;
};

/**
 * Format a launch date string (ISO format) to human-readable format.
 * e.g. "2011-01-20" → "January 20, 2011"
 */
export const formatLaunchDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

/**
 * Pattern-based description entries.
 * Each entry has a test function and the corresponding description.
 * Order matters — more specific patterns should come before general ones.
 */
interface DescriptionEntry {
  test: (name: string, sourceGroup?: string) => boolean;
  description: SatelliteDescription;
}

const DESCRIPTION_ENTRIES: DescriptionEntry[] = [
  // --- US Programs (public) ---
  {
    test: (name) => /NAVSTAR|GPS/i.test(name),
    description: {
      description: 'GPS navigation satellite providing global positioning, navigation, and timing services for military and civilian users worldwide.',
      operator: 'US Space Force',
      constellation: 'GPS',
      manufacturer: 'Lockheed Martin',
      confidence: 'public',
    },
  },
  {
    test: (name) => /MUOS/i.test(name),
    description: {
      description: 'Mobile User Objective System satellite providing narrowband UHF voice, data, and video communications to mobile military forces worldwide.',
      operator: 'US Space Force',
      constellation: 'MUOS',
      manufacturer: 'Lockheed Martin',
      confidence: 'public',
    },
  },
  {
    test: (name) => /AEHF/i.test(name),
    description: {
      description: 'Advanced Extremely High Frequency satellite providing protected, jam-resistant communications for strategic and tactical military operations.',
      operator: 'US Space Force',
      constellation: 'AEHF',
      manufacturer: 'Lockheed Martin',
      confidence: 'public',
    },
  },
  {
    test: (name) => /WGS/i.test(name),
    description: {
      description: 'Wideband Global SATCOM satellite providing high-capacity military communications in X-band and Ka-band frequency ranges.',
      operator: 'US Space Force',
      constellation: 'WGS',
      manufacturer: 'Boeing',
      confidence: 'public',
    },
  },
  {
    test: (name) => /SBIRS/i.test(name),
    description: {
      description: 'Space Based Infrared System satellite providing missile warning and missile defense support using infrared sensors from geosynchronous orbit.',
      operator: 'US Space Force',
      constellation: 'SBIRS',
      manufacturer: 'Lockheed Martin',
      confidence: 'public',
    },
  },
  {
    test: (name) => /\bDSP\b/i.test(name),
    description: {
      description: 'Defense Support Program satellite providing early warning of missile launches, space launches, and nuclear detonations via infrared sensors.',
      operator: 'US Space Force',
      constellation: 'DSP',
      manufacturer: 'Northrop Grumman',
      confidence: 'public',
    },
  },
  {
    test: (name) => /MILSTAR/i.test(name),
    description: {
      description: 'Military Strategic and Tactical Relay satellite providing secure, jam-resistant communications for US strategic and tactical forces.',
      operator: 'US Space Force',
      constellation: 'Milstar',
      manufacturer: 'Lockheed Martin',
      confidence: 'public',
    },
  },
  {
    test: (name) => /DMSP/i.test(name),
    description: {
      description: 'Defense Meteorological Satellite Program satellite providing weather imagery and environmental data for military operations planning.',
      operator: 'US Space Force',
      constellation: 'DMSP',
      manufacturer: 'Lockheed Martin',
      confidence: 'public',
    },
  },
  {
    test: (name) => /TDRS/i.test(name),
    description: {
      description: 'Tracking and Data Relay Satellite providing communications relay services between ground stations and low-orbit spacecraft.',
      operator: 'NASA',
      constellation: 'TDRSS',
      manufacturer: 'Boeing',
      confidence: 'public',
    },
  },
  {
    test: (name) => /UFO\s*F|UFO-/i.test(name),
    description: {
      description: 'Ultra High Frequency Follow-On satellite providing narrowband UHF communications for US and allied military forces.',
      operator: 'US Space Force',
      constellation: 'UFO',
      manufacturer: 'Boeing',
      confidence: 'public',
    },
  },
  {
    test: (name) => /DSCS/i.test(name),
    description: {
      description: 'Defense Satellite Communications System satellite providing super-high frequency wideband communications for military command and control.',
      operator: 'US Space Force',
      constellation: 'DSCS',
      manufacturer: 'Lockheed Martin',
      confidence: 'public',
    },
  },
  {
    test: (name) => /FLTSAT/i.test(name),
    description: {
      description: 'Fleet Satellite Communications satellite providing UHF communications for US Navy ships, submarines, aircraft, and ground forces.',
      operator: 'US Space Force',
      constellation: 'FLTSATCOM',
      manufacturer: 'TRW',
      confidence: 'public',
    },
  },

  // --- GLONASS (match name OR sourceGroup) ---
  {
    test: (name, sourceGroup) => /GLONASS/i.test(name) || sourceGroup === 'glo-ops',
    description: {
      description: 'Russian global navigation satellite providing positioning, navigation, and timing services as part of the GLONASS constellation.',
      operator: 'Russian Aerospace Forces',
      constellation: 'GLONASS',
      manufacturer: 'ISS Reshetnev',
      confidence: 'public',
    },
  },

  // --- BeiDou ---
  {
    test: (name) => /BEIDOU/i.test(name),
    description: {
      description: 'Chinese navigation satellite providing positioning, navigation, and timing services as part of the BeiDou Navigation Satellite System.',
      operator: 'China Satellite Navigation Office',
      constellation: 'BeiDou',
      manufacturer: 'CAST',
      confidence: 'public',
    },
  },

  // --- Galileo ---
  {
    test: (name) => /GALILEO/i.test(name),
    description: {
      description: 'European navigation satellite providing global positioning and timing services. Includes an encrypted Public Regulated Service for government use.',
      operator: 'European Union Agency for the Space Programme',
      constellation: 'Galileo',
      manufacturer: 'Airbus / Thales Alenia Space',
      confidence: 'public',
    },
  },

  // --- Russian programs (public) ---
  {
    test: (name) => /MERIDIAN/i.test(name),
    description: {
      description: 'Russian military communications satellite providing relay services for Russian armed forces in high-latitude regions via highly elliptical orbit.',
      operator: 'Russian Aerospace Forces',
      constellation: 'Meridian',
      manufacturer: 'ISS Reshetnev',
      confidence: 'public',
    },
  },
  {
    test: (name) => /LUCH|OLYMP/i.test(name),
    description: {
      description: 'Russian data relay satellite providing communications relay between ground stations and other Russian spacecraft.',
      operator: 'Russian Aerospace Forces',
      constellation: 'Luch',
      manufacturer: 'ISS Reshetnev',
      confidence: 'public',
    },
  },
  {
    test: (name) => /TUNDRA/i.test(name),
    description: {
      description: 'Russian missile early warning satellite operating in highly elliptical orbit to provide infrared-based launch detection coverage.',
      operator: 'Russian Aerospace Forces',
      constellation: 'EKS (Kupol)',
      manufacturer: 'RKK Energia',
      confidence: 'public',
    },
  },

  // --- Classified programs (must come AFTER known public programs) ---
  {
    test: (name) => /^USA\s+\d{1,3}$/i.test(name.trim()),
    description: {
      description: 'Classified US national security satellite. Mission and capabilities not publicly disclosed.',
      operator: 'US Department of Defense',
      confidence: 'classified',
    },
  },
  {
    test: (name) => /NROL/i.test(name),
    description: {
      description: 'National Reconnaissance Office launch payload. Mission and capabilities not publicly disclosed.',
      operator: 'National Reconnaissance Office',
      confidence: 'classified',
    },
  },
  {
    test: (name) => /YAOGAN/i.test(name),
    description: {
      description: 'Chinese military satellite. Official mission details not publicly disclosed by the operating authority.',
      operator: "People's Republic of China",
      confidence: 'classified',
    },
  },
  {
    test: (name) => /SHIYAN|SHIJIAN/i.test(name),
    description: {
      description: 'Chinese government satellite. Official mission details not publicly disclosed by the operating authority.',
      operator: "People's Republic of China",
      confidence: 'classified',
    },
  },

  // --- COSMOS (non-GLONASS) — must be AFTER GLONASS entry ---
  {
    test: (name, sourceGroup) => /COSMOS/i.test(name) && sourceGroup !== 'glo-ops',
    description: {
      description: 'Russian military satellite. Specific mission not publicly disclosed. COSMOS is a broad designation covering multiple mission types.',
      operator: 'Russian Aerospace Forces',
      confidence: 'classified',
    },
  },
];

/**
 * Look up a satellite description by name and optional source group.
 * Returns null if no match found — the panel should handle this gracefully.
 */
export const getSatelliteDescription = (
  name: string,
  noradId: number,
  sourceGroup?: string,
): SatelliteDescription | null => {
  // noradId is available for future use but not currently used for description matching
  void noradId;

  for (const entry of DESCRIPTION_ENTRIES) {
    if (entry.test(name, sourceGroup)) {
      return entry.description;
    }
  }

  return null;
};
