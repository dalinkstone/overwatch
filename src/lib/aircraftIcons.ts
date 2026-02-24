/**
 * Aircraft category classification and SVG icon mapping.
 * Maps ICAO type codes to visual categories, each with a distinct
 * top-down silhouette icon large enough for instant recognition.
 */

export type AircraftCategory =
  | "fighter"
  | "tanker-transport"
  | "helicopter"
  | "surveillance"
  | "trainer"
  | "bomber"
  | "uav"
  | "unknown";

/** Maps known ICAO type codes (uppercase) to aircraft categories. */
export const AIRCRAFT_TYPE_MAP: Record<string, AircraftCategory> = {
  // ── Fighter ──────────────────────────────────────────────────
  F16: "fighter",
  F15: "fighter",
  F15C: "fighter",
  F15E: "fighter",
  FA18: "fighter",
  F18: "fighter",
  F22: "fighter",
  F35: "fighter",
  A10: "fighter",
  F117: "fighter",
  EF2K: "fighter",
  TORN: "fighter",
  SU27: "fighter",
  SU30: "fighter",
  MIG29: "fighter",
  JF17: "fighter",
  J10: "fighter",
  R1: "fighter",
  F14: "fighter",
  MIR2: "fighter",
  RFAL: "fighter",

  // ── Tanker / Transport ──────────────────────────────────────
  KC135: "tanker-transport",
  K35A: "tanker-transport",
  K35R: "tanker-transport",
  KC46: "tanker-transport",
  KC10: "tanker-transport",
  KC30: "tanker-transport",
  C17: "tanker-transport",
  C5: "tanker-transport",
  C5M: "tanker-transport",
  C130: "tanker-transport",
  C130J: "tanker-transport",
  C30J: "tanker-transport",
  C12: "tanker-transport",
  C37: "tanker-transport",
  C40: "tanker-transport",
  C2: "tanker-transport",
  A400: "tanker-transport",
  AN124: "tanker-transport",
  IL76: "tanker-transport",
  L100: "tanker-transport",
  E11: "tanker-transport",
  C26: "tanker-transport",
  C145: "tanker-transport",
  C146: "tanker-transport",
  C21: "tanker-transport",
  C32: "tanker-transport",
  C35: "tanker-transport",
  C38: "tanker-transport",
  DC10: "tanker-transport",

  // ── Helicopter ──────────────────────────────────────────────
  UH60: "helicopter",
  AH64: "helicopter",
  CH47: "helicopter",
  CH53: "helicopter",
  V22: "helicopter",
  HH60: "helicopter",
  MH60: "helicopter",
  OH58: "helicopter",
  AH1: "helicopter",
  SH60: "helicopter",
  NH90: "helicopter",
  H60: "helicopter",
  S70: "helicopter",
  EC45: "helicopter",
  S92: "helicopter",
  B06: "helicopter",
  B212: "helicopter",
  B412: "helicopter",
  H1: "helicopter",
  H47: "helicopter",
  H53: "helicopter",
  H64: "helicopter",
  EC35: "helicopter",
  EC55: "helicopter",
  EC25: "helicopter",
  AS32: "helicopter",
  S61: "helicopter",
  S65: "helicopter",
  S80: "helicopter",
  BK17: "helicopter",
  A109: "helicopter",
  A139: "helicopter",
  A149: "helicopter",
  A189: "helicopter",
  W3: "helicopter",

  // ── Surveillance ────────────────────────────────────────────
  E3: "surveillance",
  E8: "surveillance",
  E6: "surveillance",
  RC135: "surveillance",
  EP3: "surveillance",
  P8: "surveillance",
  P3: "surveillance",
  U2: "surveillance",
  E2: "surveillance",
  EA18G: "surveillance",
  E4: "surveillance",
  JSTAR: "surveillance",
  MC12: "surveillance",
  RC12: "surveillance",
  RC26: "surveillance",
  DHC8: "surveillance",
  RC7: "surveillance",
  EC37: "surveillance",
  E11A: "surveillance",
  E6B: "surveillance",
  MC55: "surveillance",

  // ── Trainer ─────────────────────────────────────────────────
  T38: "trainer",
  T6: "trainer",
  T45: "trainer",
  T1: "trainer",
  PC12: "trainer",
  T7: "trainer",
  PC21: "trainer",
  T44: "trainer",
  T34: "trainer",
  T53: "trainer",
  PC7: "trainer",
  PC9: "trainer",

  // ── Bomber ──────────────────────────────────────────────────
  B52: "bomber",
  B1: "bomber",
  B2: "bomber",
  B21: "bomber",

  // ── UAV ─────────────────────────────────────────────────────
  RQ4: "uav",
  MQ9: "uav",
  MQ1: "uav",
  RQ7: "uav",
  MQ4: "uav",
  HRON: "uav",
  MQ25: "uav",
  XQ58: "uav",
  MQ1C: "uav",
};

interface IconDimensions {
  size: [number, number];
  anchor: [number, number];
}

/** Icon size and anchor — intentionally large for instant recognition. */
export const ICON_SIZES: Record<AircraftCategory, IconDimensions> = {
  fighter: { size: [36, 36], anchor: [18, 18] },
  "tanker-transport": { size: [42, 42], anchor: [21, 21] },
  helicopter: { size: [38, 38], anchor: [19, 19] },
  surveillance: { size: [42, 42], anchor: [21, 21] },
  trainer: { size: [30, 30], anchor: [15, 15] },
  bomber: { size: [44, 44], anchor: [22, 22] },
  uav: { size: [32, 32], anchor: [16, 16] },
  unknown: { size: [34, 34], anchor: [17, 17] },
};

/**
 * Determines the aircraft category from its ICAO type code.
 * Exact match first, then prefix match from longest down to 2 chars.
 */
export const getAircraftCategory = (
  typeCode: string | undefined
): AircraftCategory => {
  if (!typeCode || typeCode.trim() === "") return "unknown";

  const normalized = typeCode.trim().toUpperCase();

  // Exact match
  if (normalized in AIRCRAFT_TYPE_MAP) {
    return AIRCRAFT_TYPE_MAP[normalized];
  }

  // Prefix match — longest prefix first, minimum 2 characters
  for (let len = normalized.length - 1; len >= 2; len--) {
    const prefix = normalized.substring(0, len);
    if (prefix in AIRCRAFT_TYPE_MAP) {
      return AIRCRAFT_TYPE_MAP[prefix];
    }
  }

  return "unknown";
};

/** Returns a human-readable label for the aircraft category. */
export const getCategoryLabel = (category: AircraftCategory): string => {
  const labels: Record<AircraftCategory, string> = {
    fighter: "Fighter",
    "tanker-transport": "Tanker/Transport",
    helicopter: "Helicopter",
    surveillance: "Surveillance",
    trainer: "Trainer",
    bomber: "Bomber",
    uav: "UAV",
    unknown: "Unknown",
  };
  return labels[category];
};

const STROKE = 'stroke="#000" stroke-opacity="0.3" stroke-width="0.5"';

/**
 * Returns inline SVG markup for the given aircraft category.
 * Each SVG is a top-down silhouette pointing north (up) with a thin
 * semi-transparent black outline for visibility on any map background.
 */
export const getAircraftIconSvg = (
  category: AircraftCategory,
  color: string
): string => {
  switch (category) {
    // ── Fighter ──────────────────────────────────────────────
    // Swept-wing jet: narrow pointed nose, thin fuselage, sharply swept
    // wings at ~55° positioned 60% down, two small angled tail fins.
    // Think F-16 planform — fast and aggressive.
    case "fighter":
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="${color}" ${STROKE} width="100%" height="100%"><path d="M18 2 L16 10 L4 22 L5.5 25 L16 20 L16 29 L13 33 L15 34 L18 32 L21 34 L23 33 L20 29 L20 20 L30.5 25 L32 22 L20 10 Z"/></svg>`;

    // ── Tanker / Transport ───────────────────────────────────
    // High-wing transport: blunt nose, WIDE fuselage (6px), STRAIGHT
    // wings spanning nearly full width at 40% down, T-tail.
    // Think C-17 — heavy and large. Straight wings are the key
    // distinguisher from the fighter's swept wings.
    case "tanker-transport":
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42" fill="${color}" ${STROKE} width="100%" height="100%"><path d="M21 3 L18 8 L18 15 L2 15 L2 19 L18 19 L18 33 L12 37 L12 39 L18 36 L21 40 L24 36 L30 39 L30 37 L24 33 L24 19 L40 19 L40 15 L24 15 L24 8 Z"/></svg>`;

    // ── Helicopter ───────────────────────────────────────────
    // LARGE rotor disc circle (~70% of width) in the upper portion,
    // narrow fuselage/tail boom extending down, small horizontal
    // tail rotor bar at bottom. No wings — dominated by the circle.
    // Most distinctive icon of all categories.
    case "helicopter":
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 38" fill="${color}" ${STROKE} width="100%" height="100%"><circle cx="19" cy="14" r="12"/><rect x="17" y="14" width="4" height="18" rx="1"/><rect x="13" y="34" width="12" height="2" rx="1"/></svg>`;

    // ── Surveillance ─────────────────────────────────────────
    // Transport body (wide fuselage, straight wings, T-tail) with
    // a prominent radome disc (12px diameter) sitting on top of the
    // fuselage above the wings. Think E-3 AWACS.
    // Key distinguisher from plain transport: the radar dome circle.
    case "surveillance":
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42" fill="${color}" ${STROKE} width="100%" height="100%"><circle cx="21" cy="12" r="6"/><path d="M21 3 L18 8 L18 15 L2 15 L2 19 L18 19 L18 33 L12 37 L12 39 L18 36 L21 40 L24 36 L30 39 L30 37 L24 33 L24 19 L40 19 L40 15 L24 15 L24 8 Z"/></svg>`;

    // ── Trainer ──────────────────────────────────────────────
    // Small, simple straight-wing aircraft. Narrow fuselage, short
    // straight wings, simple tail. The smallest and lightest icon.
    // Think T-38 or Cessna-proportioned.
    case "trainer":
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="${color}" ${STROKE} width="100%" height="100%"><path d="M15 2 L13.5 7 L13.5 12 L5 12 L5 15 L13.5 15 L13.5 24 L11 27 L11 28 L13.5 26 L15 29 L16.5 26 L19 28 L19 27 L16.5 24 L16.5 15 L25 15 L25 12 L16.5 12 L16.5 7 Z"/></svg>`;

    // ── Bomber ───────────────────────────────────────────────
    // LARGE swept-wing aircraft, much wider and heavier than the
    // fighter. Wide fuselage (7px), huge swept wings with deep chord
    // and long span. Think B-52 planform — wings dominate the shape.
    case "bomber":
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" fill="${color}" ${STROKE} width="100%" height="100%"><path d="M22 3 L18.5 12 L2 24 L4 29 L18.5 22 L18.5 35 L15 39 L17 42 L22 39 L27 42 L29 39 L25.5 35 L25.5 22 L40 29 L42 24 L25.5 12 Z"/></svg>`;

    // ── UAV ──────────────────────────────────────────────────
    // Very long thin straight wings (high aspect ratio, glider-like),
    // tiny fuselage (2px), small V-tail. Think MQ-9 Reaper.
    // Distinguished from fighter (swept wings) and transport (fat body)
    // by the extreme wing length and minimal body.
    case "uav":
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="${color}" ${STROKE} width="100%" height="100%"><path d="M16 4 L15 10 L1 14 L1 16 L15 15 L15 25 L12 28 L13.5 29 L16 27 L18.5 29 L20 28 L17 25 L17 15 L31 16 L31 14 L17 10 Z"/></svg>`;

    // ── Unknown ──────────────────────────────────────────────
    // Generic moderate aircraft: moderate fuselage, moderate straight
    // wings, simple tail. The fallback — "airplane-ish" without
    // committing to any specific type.
    case "unknown":
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" fill="${color}" ${STROKE} width="100%" height="100%"><path d="M17 3 L15 10 L15 14 L4 14 L4 18 L15 18 L15 27 L12 30 L12 32 L15 30 L17 33 L19 30 L22 32 L22 30 L19 27 L19 18 L30 18 L30 14 L19 14 L19 10 Z"/></svg>`;
  }
};
