/**
 * Conflict event type definitions, classification, and helpers for the GDELT layer.
 * Covers CAMEO-coded conflict events from the GDELT GEO 2.0 API.
 * Pure types-and-functions file with no side effects.
 */

/** CAMEO root-code based conflict categories. */
export type ConflictCategory = 'coerce' | 'assault' | 'fight' | 'mass-violence' | 'other';

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

/** Filter state for the conflict layer. */
export interface ConflictFilters {
  /** Filters on event name and source domain */
  search: string;
  /** Which categories are visible */
  categories: Set<ConflictCategory>;
  /** Recency filter */
  timeframe: '24h' | '6h' | '1h';
}

/** API response from /api/conflicts proxy route. */
export interface ConflictApiResponse {
  /** Normalized conflict events */
  events: ConflictEvent[];
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

/**
 * Classify a conflict event by CAMEO root code.
 * Extracts the first 2 characters as the root code.
 * 17 → coerce, 18 → assault, 19 → fight, 20 → mass-violence, else → other.
 */
export const classifyConflictEvent = (cameoCode: string): ConflictCategory => {
  const root = cameoCode.slice(0, 2);
  switch (root) {
    case '17': return 'coerce';
    case '18': return 'assault';
    case '19': return 'fight';
    case '20': return 'mass-violence';
    default: return 'other';
  }
};

/** Display colors for each conflict category. */
export const CONFLICT_CATEGORY_COLORS: Record<ConflictCategory, string> = {
  coerce: '#f97316',       // orange-500
  assault: '#ef4444',      // red-500
  fight: '#dc2626',        // red-600
  'mass-violence': '#7f1d1d', // red-900
  other: '#6b7280',        // gray-500
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
