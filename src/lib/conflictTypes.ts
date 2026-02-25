/**
 * Conflict event type definitions, classification, and helpers for the GDELT layer.
 * Covers CAMEO-coded conflict events from the GDELT GEO 2.0 API and Events 2.0 Export.
 * Pure types-and-functions file with no side effects.
 */

/** CAMEO root-code based conflict categories. */
export type ConflictCategory = 'coerce' | 'assault' | 'fight' | 'mass-violence' | 'other';

/** Actor type classification from GDELT Events 2.0. */
export type ConflictActorType =
  | 'government'
  | 'military'
  | 'rebel'
  | 'opposition'
  | 'police'
  | 'intelligence'
  | 'civilian'
  | 'media'
  | 'igo'
  | 'ngo'
  | 'other';

/** GDELT quad class: verbal/material x cooperation/conflict. */
export type QuadClass = 'verbal-cooperation' | 'material-cooperation' | 'verbal-conflict' | 'material-conflict';

/** Geolocation precision from GDELT ActionGeo_Type. */
export type GeoPrecision = 'country' | 'state' | 'city' | 'landmark' | 'unknown';

/** A conflict actor identified by GDELT Events 2.0. */
export interface ConflictActor {
  name: string;
  countryCode: string;
  type: ConflictActorType;
  label: string;
}

/** A single normalized conflict event from GDELT. */
export interface ConflictEvent {
  /** Deterministic unique ID (hash of coordinates + name + domain) */
  id: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lon: number;
  /** Event description/headline from GDELT */
  name: string;
  /** Source article URL */
  url: string;
  /** Source domain (e.g. "reuters.com") */
  domain: string;
  /** Thumbnail URL from GDELT (may be empty) */
  sharingImage: string;
  /** ISO datetime string */
  dateAdded: string;
  /** Average tone score (negative = negative sentiment, typically -10 to +10) */
  tone: number;
  /** Goldstein conflict-cooperation scale (-10 to +10, null if not available) */
  goldsteinScale: number | null;
  /** Number of source articles mentioning this event */
  numArticles: number;
  /** Conflict category based on CAMEO code or default */
  category: ConflictCategory;
}

/** Enriched conflict event with Events 2.0 structured metadata. */
export interface ConflictEventEnriched extends ConflictEvent {
  actor1: ConflictActor | null;
  actor2: ConflictActor | null;
  cameoCode: string | null;
  cameoRootCode: string | null;
  cameoDescription: string | null;
  quadClass: QuadClass | null;
  geoPrecision: GeoPrecision;
  eventDate: string | null;
  numSources: number;
  numMentions: number;
  isEnriched: boolean;
}

/** Filter state for the conflict layer. */
export interface ConflictFilters {
  /** Filters on event name and source domain */
  search: string;
  /** Which categories are visible */
  categories: Set<ConflictCategory>;
  /** Recency filter */
  timeframe: '24h' | '6h' | '1h';
  /** Show only enriched (verified) events */
  enrichedOnly: boolean;
  /** Filter by actor types (empty = all) */
  actorTypes: Set<ConflictActorType>;
  /** Filter by quad class (null = all) */
  quadClass: QuadClass | null;
}

/** API response from /api/conflicts proxy route. */
export interface ConflictApiResponse {
  /** Normalized enriched conflict events */
  events: ConflictEventEnriched[];
  /** Count of events returned */
  total: number;
  /** ISO datetime of when this response was generated */
  timestamp: string;
  /** True if upstream fetch failed and we're returning degraded data */
  partial: boolean;
}

/** All conflict categories for iteration. */
export const CONFLICT_CATEGORIES: ConflictCategory[] = [
  'coerce',
  'assault',
  'fight',
  'mass-violence',
  'other',
];

/** All actor types relevant for filtering. */
export const CONFLICT_ACTOR_TYPES: { value: ConflictActorType; label: string }[] = [
  { value: 'military', label: 'Military' },
  { value: 'government', label: 'Government' },
  { value: 'rebel', label: 'Rebel' },
  { value: 'civilian', label: 'Civilian' },
  { value: 'police', label: 'Police' },
  { value: 'other', label: 'Other' },
];

/**
 * Classify a conflict event by CAMEO root code.
 * If an optional cameoRootCode is provided and matches 17-20, use it directly.
 * Otherwise falls back to extracting root from the full code string.
 * 17 -> coerce, 18 -> assault, 19 -> fight, 20 -> mass-violence, else -> other.
 */
export const classifyConflictEvent = (
  cameoCode: string,
  cameoRootCode?: string,
): ConflictCategory => {
  const root = cameoRootCode ?? cameoCode.slice(0, 2);
  switch (root) {
    case '17': return 'coerce';
    case '18': return 'assault';
    case '19': return 'fight';
    case '20': return 'mass-violence';
    default: return 'other';
  }
};

/** Map GDELT 3-char actor type codes to ConflictActorType. */
export const mapActorTypeCode = (code: string): ConflictActorType => {
  switch (code) {
    case 'GOV': return 'government';
    case 'MIL': return 'military';
    case 'REB': return 'rebel';
    case 'OPP': return 'opposition';
    case 'COP': return 'police';
    case 'SPY': return 'intelligence';
    case 'CVL': return 'civilian';
    case 'MED': return 'media';
    case 'IGO': return 'igo';
    case 'NGO': return 'ngo';
    default: return 'other';
  }
};

/** Get a human-readable label for an actor type. */
export const getActorTypeLabel = (type: ConflictActorType): string => {
  switch (type) {
    case 'government': return 'Government';
    case 'military': return 'Military Forces';
    case 'rebel': return 'Rebel Group';
    case 'opposition': return 'Opposition';
    case 'police': return 'Police/Security';
    case 'intelligence': return 'Intelligence';
    case 'civilian': return 'Civilian';
    case 'media': return 'Media';
    case 'igo': return 'Intl Organization';
    case 'ngo': return 'NGO';
    case 'other': return 'Unknown Actor';
  }
};

/** Map GDELT QuadClass numeric code to typed string. */
export const mapQuadClass = (code: number): QuadClass => {
  switch (code) {
    case 1: return 'verbal-cooperation';
    case 2: return 'material-cooperation';
    case 3: return 'verbal-conflict';
    case 4: return 'material-conflict';
    default: return 'material-conflict';
  }
};

/** Map GDELT ActionGeo_Type numeric code to GeoPrecision. */
export const mapGeoPrecision = (type: number): GeoPrecision => {
  switch (type) {
    case 1: return 'country';
    case 2: return 'state';
    case 3: return 'city';
    case 4: return 'landmark';
    default: return 'unknown';
  }
};

/** Get human-readable label for geo precision. */
export const getGeoPrecisionLabel = (precision: GeoPrecision): string => {
  switch (precision) {
    case 'country': return 'Country-level';
    case 'state': return 'State/Province';
    case 'city': return 'City';
    case 'landmark': return 'Precise Location';
    case 'unknown': return 'Approximate';
  }
};

/** CAMEO event code descriptions for conflict-relevant codes (17x-20x). */
const CAMEO_DESCRIPTIONS: Record<string, string> = {
  '170': 'Coerce',
  '171': 'Seize or damage property',
  '172': 'Impose administrative sanctions',
  '173': 'Arrest, detain',
  '174': 'Expel or deport',
  '175': 'Use coercive tactics',
  '180': 'Use unconventional violence',
  '181': 'Abduct, hijack, take hostage',
  '182': 'Physically assault',
  '183': 'Conduct suicide, car, or other non-military bombing',
  '184': 'Use as human combatants',
  '185': 'Attempt to assassinate',
  '186': 'Assassinate',
  '190': 'Use conventional military force',
  '191': 'Impose blockade',
  '192': 'Occupy territory',
  '193': 'Fight with small arms',
  '194': 'Fight with artillery and tanks',
  '195': 'Employ aerial weapons',
  '196': 'Violate ceasefire',
  '200': 'Use unconventional mass violence',
  '201': 'Engage in mass expulsion',
  '202': 'Engage in mass killing',
  '203': 'Engage in ethnic cleansing',
  '204': 'Use weapons of mass destruction',
};

/** Get human-readable description for a CAMEO event code. */
export const getCameoDescription = (code: string): string =>
  CAMEO_DESCRIPTIONS[code] ?? 'Unknown event';

/** Format a summary of actors involved in a conflict event. */
export const formatActorSummary = (
  actor1: ConflictActor | null,
  actor2: ConflictActor | null,
): string => {
  if (actor1 && actor2) return `${actor1.name} \u2192 ${actor2.name}`;
  if (actor1) return actor1.name;
  if (actor2) return `Unknown \u2192 ${actor2.name}`;
  return 'Unknown actors';
};

/** Human-readable labels for quad class values. */
export const QUAD_CLASS_LABELS: Record<QuadClass, string> = {
  'verbal-cooperation': 'Verbal Cooperation',
  'material-cooperation': 'Material Cooperation',
  'verbal-conflict': 'Verbal Conflict',
  'material-conflict': 'Material Conflict',
};

/** Display colors for each conflict category. */
export const CONFLICT_CATEGORY_COLORS: Record<ConflictCategory, string> = {
  coerce: '#f97316',       // orange-500
  assault: '#ef4444',      // red-500
  fight: '#dc2626',        // red-600
  'mass-violence': '#991b1b', // red-800
  other: '#f59e0b',        // amber-500 — visible on map
};

/** Get the display color for a conflict category. */
export const getConflictCategoryColor = (category: ConflictCategory): string =>
  CONFLICT_CATEGORY_COLORS[category];

/** Human-readable labels for each conflict category. */
export const CONFLICT_CATEGORY_LABELS: Record<ConflictCategory, string> = {
  coerce: 'Coercion',
  assault: 'Assault',
  fight: 'Armed Conflict',
  'mass-violence': 'Mass Violence',
  other: 'Other',
};

/** Get the human-readable label for a conflict category. */
export const getConflictCategoryLabel = (category: ConflictCategory): string =>
  CONFLICT_CATEGORY_LABELS[category];

/**
 * Format a GDELT tone score as a human-readable label.
 * Tone ranges roughly from -10 (very negative) to +10 (very positive).
 */
export const formatTone = (tone: number): string => {
  if (tone < -5) return 'Very Negative';
  if (tone < -1) return 'Negative';
  if (tone < 1) return 'Neutral';
  if (tone < 5) return 'Positive';
  return 'Very Positive';
};

/**
 * Format a Goldstein scale value with +/- prefix.
 * Returns null if the input is null.
 */
export const formatGoldstein = (value: number | null): string | null => {
  if (value === null) return null;
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}`;
};
