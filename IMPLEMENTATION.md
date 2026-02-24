# IMPLEMENTATION.md — Overwatch Technical Implementation Guide

Comprehensive technical documentation for the Overwatch military movement tracker. This document covers architecture decisions, data flow, every implemented module, planned data layers, and instructions for local development.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Flow](#data-flow)
3. [Project Structure](#project-structure)
4. [Phase 1: Project Scaffold](#phase-1-project-scaffold)
5. [Phase 2: TypeScript Types and API Utility Layer](#phase-2-typescript-types-and-api-utility-layer)
6. [Module Reference](#module-reference)
7. [Environment Configuration](#environment-configuration)
8. [Local Development Setup](#local-development-setup)
9. [Toolchain and Build Pipeline](#toolchain-and-build-pipeline)
10. [Data Source: ADSB.lol API](#data-source-adsblol-api)
11. [Phase 8: Aircraft-Type-Specific Icons](#phase-8-aircraft-type-specific-icons)
12. [Additional Data Layers](#additional-data-layers)
13. [Remaining Phases](#remaining-phases)

---

## System Architecture

Overwatch follows a multi-layer architecture with independent data pipelines:

```
┌───────────────────────────────────────────────────────────────┐
│                        Browser Client                         │
│  ┌───────────┐  ┌──────────┐  ┌────────────────────────────┐ │
│  │ Leaflet   │  │ React    │  │ Data Layer Hooks           │ │
│  │ Map + OSM │  │ UI Layer │  │ • useAircraftData (10s)    │ │
│  │ + Markers │  │          │  │ • useVesselData (30s)      │ │
│  │ + Overlays│  │          │  │ • useSatelliteData (5min)  │ │
│  └───────────┘  └──────────┘  │ • useConflictData (15min)  │ │
│                               └─────────┬──────────────────┘ │
│                                         │                     │
│                              fetch("/api/{layer}")            │
│                                         │                     │
└─────────────────────────────────────────┼─────────────────────┘
                                          │
┌─────────────────────────────────────────┼─────────────────────┐
│               Next.js Server            │                     │
│  ┌──────────────────────────────────────▼──────────────────┐  │
│  │  Proxy Routes (one per data source)                     │  │
│  │  /api/aircraft    → api.adsb.lol/v2/mil                │  │
│  │  /api/vessels     → AIS data source                     │  │
│  │  /api/satellites  → celestrak.org                       │  │
│  │  /api/conflicts   → api.gdeltproject.org                │  │
│  │  /api/notams      → external-api.faa.gov                │  │
│  │                                                         │  │
│  │  Each route: caching headers, timeout, error handling   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ api.adsb.lol │  │ celestrak.org│  │ GDELT API    │  ...
   │ (ADS-B data) │  │ (TLE data)  │  │ (events)     │
   │ No auth      │  │ No auth     │  │ No auth      │
   └──────────────┘  └──────────────┘  └──────────────┘
```

### Key Architecture Decisions

1. **API Proxy Pattern** — The browser never calls external APIs directly. All requests route through proxy routes on the Next.js server. This provides a single point for caching, error handling, rate limiting, and allows swapping upstream APIs without client changes.

2. **Independent Data Layers** — Each data source has its own proxy route, polling hook, marker component, and type definitions. Layers fail independently — if one API goes down, the others keep working.

3. **Server Components by Default** — Next.js App Router uses React Server Components. Only components that need browser APIs (Leaflet, hooks, event handlers) are marked `"use client"`.

4. **Dynamic Leaflet Import** — Leaflet accesses the `window` object and will crash during server-side rendering. It must be imported via `next/dynamic` with `{ ssr: false }`.

5. **Full State Replacement** — Each poll replaces the entire state array for that layer. The APIs return complete snapshots, so there is no delta/merge logic. This keeps the data model simple and avoids stale ghost entities.

6. **No Paid API Keys** — All data sources are free and either require no authentication or only free registration. The project has zero paid secrets to manage.

7. **Aircraft-Type-Specific Icons** — Aircraft are classified by ICAO type code into categories (fighter, transport, helicopter, etc.) with distinct SVG silhouette icons, making it visually immediate what kind of aircraft is where.

---

## Data Flow

### Aircraft Layer (Primary)

```
1. Browser tab opens
2. useAircraftData hook mounts
3. Immediate fetch → GET /api/aircraft
4. Next.js route handler → GET https://api.adsb.lol/v2/mil
5. ADSB.lol returns JSON: { ac: [...], total: N, ... }
6. Route handler forwards JSON to client (with cache headers)
7. Client parses response, filters for military aircraft with positions
8. Each aircraft classified by type code → category → icon shape
9. React state updates → Leaflet markers re-render on map with type-specific icons
10. setInterval fires after 10 seconds → repeat from step 3
```

### Additional Layers (Same Pattern)

```
1. Layer toggle enabled by user
2. useLayerData hook mounts
3. Immediate fetch → GET /api/{layer}
4. Next.js route handler → GET {upstream API}
5. Response parsed and filtered
6. Layer-specific markers rendered on map
7. setInterval at layer-specific interval → repeat
8. Layer toggle disabled → clearInterval, markers removed
```

### Error Path

```
3. fetch("/api/{layer}") fails OR returns non-200
   → Hook sets error state string
   → Previous data remains displayed on map
   → StatusBar shows layer-specific error
   → Next interval fires → retry from step 3
   → Other layers unaffected
```

---

## Project Structure

```
overwatch/
├── CLAUDE.md                    # Claude Code conventions and rules
├── IMPLEMENTATION.md            # This file — detailed implementation docs
├── README.md                    # Project overview and quick start
├── PLAN.md                      # Sequential build prompts (16 phases)
├── package.json                 # Dependencies and scripts
├── package-lock.json            # Locked dependency tree
├── tsconfig.json                # TypeScript strict config
├── tailwind.config.ts           # Tailwind CSS config (scans src/)
├── postcss.config.mjs           # PostCSS with Tailwind plugin
├── next.config.mjs              # Next.js config (default)
├── .env.example                 # Environment variable template
├── .env.local                   # Local environment (git-ignored)
├── .eslintrc.json               # ESLint with next/core-web-vitals
├── .gitignore                   # Standard Next.js gitignore
├── public/
│   └── icons/                   # Static assets
└── src/
    ├── app/
    │   ├── layout.tsx           # Root HTML layout + metadata
    │   ├── page.tsx             # Main page — multi-layer map dashboard
    │   └── api/
    │       ├── aircraft/
    │       │   └── route.ts     # Proxy to ADSB.lol (active)
    │       ├── vessels/
    │       │   └── route.ts     # Proxy to AIS data (planned)
    │       ├── satellites/
    │       │   └── route.ts     # Proxy to CelesTrak (planned)
    │       ├── conflicts/
    │       │   └── route.ts     # Proxy to GDELT (planned)
    │       └── notams/
    │           └── route.ts     # Proxy to FAA (planned)
    ├── components/
    │   ├── AircraftMarker.tsx   # Type-specific Leaflet marker with SVG icons
    │   ├── AircraftPanel.tsx    # Detail panel (sidebar desktop, bottom sheet mobile)
    │   ├── Map.tsx              # Vanilla Leaflet map with ADSB.lol attribution
    │   ├── MapWrapper.tsx       # Dynamic import wrapper (ssr: false)
    │   ├── StatusBar.tsx        # Top bar: counts, last updated, connection status
    │   └── FilterBar.tsx        # Search + altitude/category filters (responsive)
    ├── hooks/
    │   └── useAircraftData.ts   # Aircraft polling hook (active)
    ├── lib/
    │   ├── types.ts             # AircraftState, AircraftResponse, type guards
    │   ├── api.ts               # fetchMilitaryAircraft client function
    │   ├── utils.ts             # Formatting helpers
    │   └── aircraftIcons.ts     # Type classification + SVG icon mapping (Phase 8)
    └── styles/
        └── globals.css          # Tailwind base/components/utilities directives
```

---

## Phase 1: Project Scaffold

**Commit:** `d46e736`

Phase 1 created the full project skeleton using Next.js 14 with the App Router, TypeScript, Tailwind CSS, and ESLint. It installed Leaflet and react-leaflet as additional dependencies.

### What was created:

- **Root layout** (`src/app/layout.tsx`) — Sets page title to "Overwatch", imports global CSS
- **Home page** (`src/app/page.tsx`) — Renders a centered `<h1>Overwatch</h1>` placeholder
- **API route** (`src/app/api/aircraft/route.ts`) — Returns `{ status: "ok" }` placeholder
- **Empty lib files** — `types.ts`, `api.ts`, `utils.ts` created as empty files for Phase 2
- **Tailwind globals** — `@tailwind base/components/utilities` directives
- **Environment config** — `.env.example` and `.env.local` with API URL, poll interval, and map defaults
- **Empty directories** — `src/components/`, `src/hooks/`, `public/icons/` for later phases

### Configuration details:

- TypeScript strict mode enabled in `tsconfig.json`
- Path alias `@/*` maps to `./src/*`
- Tailwind scans `src/components/**` and `src/app/**`
- ESLint extends `next/core-web-vitals` and `next/typescript`

---

## Phase 2: TypeScript Types and API Utility Layer

Phase 2 implemented the data model, type safety layer, and client-side API function. These modules are the foundation that all UI components will build on.

### Files implemented:

### `src/lib/types.ts` — Data Interfaces and Type Guards

Defines the TypeScript contracts for all aircraft data flowing through the application.

#### `AircraftState` interface

Represents a single aircraft as returned by the ADSB.lol `/v2/mil` endpoint. Only `hex` (the ICAO 24-bit address) is guaranteed present — all other fields are optional because not every aircraft broadcasts every field.

| Field | Type | Description |
|---|---|---|
| `hex` | `string` | ICAO 24-bit hex address (always present, 6 chars) |
| `flight` | `string?` | Callsign (up to 8 chars, may have trailing spaces) |
| `lat` | `number?` | Latitude in decimal degrees (WGS84) |
| `lon` | `number?` | Longitude in decimal degrees (WGS84) |
| `alt_baro` | `number \| "ground"?` | Barometric altitude in feet, or literal `"ground"` |
| `alt_geom` | `number?` | Geometric (GNSS) altitude in feet |
| `gs` | `number?` | Ground speed in knots |
| `track` | `number?` | Track angle (degrees from true north, 0-360) |
| `t` | `string?` | ICAO type code (e.g. `"C17"`, `"F16"`, `"B52"`) |
| `r` | `string?` | Registration / tail number |
| `dbFlags` | `number?` | Bitfield flags — bit 0 indicates military status |
| `squawk` | `string?` | Transponder squawk code (4-digit octal, e.g. `"1200"`) |
| `seen` | `number?` | Seconds since last message of any kind |
| `seen_pos` | `number?` | Seconds since last position update |
| `category` | `string?` | ADS-B emitter category (e.g. `"A1"` through `"A7"`) |

#### `AircraftResponse` interface

The top-level JSON envelope from the API:

| Field | Type | Description |
|---|---|---|
| `ac` | `AircraftState[]` | Array of aircraft state objects |
| `msg` | `string` | Status message from the server |
| `now` | `number` | Server timestamp (seconds since epoch) |
| `total` | `number` | Total aircraft count |
| `ctime` | `number` | Cache time in seconds |
| `ptime` | `number` | Processing time in milliseconds |

#### `hasPosition(aircraft: AircraftState): boolean`

Type guard that returns `true` only when both `lat` and `lon` are present and are numbers. This is used to filter aircraft before rendering map markers — aircraft without position data cannot be plotted.

```typescript
hasPosition({ hex: "abc123", lat: 38.9, lon: -77.0 })  // true
hasPosition({ hex: "abc123", lat: 38.9 })                // false (no lon)
hasPosition({ hex: "abc123" })                            // false (no lat or lon)
```

#### `isMilitary(aircraft: AircraftState): boolean`

Checks the `dbFlags` bitfield. Bit 0 indicates military status in the ADSB.lol database. Returns `false` if `dbFlags` is undefined (defensive, since we query the military endpoint anyway).

```typescript
isMilitary({ hex: "abc123", dbFlags: 1 })   // true  (bit 0 set)
isMilitary({ hex: "abc123", dbFlags: 3 })   // true  (bit 0 set)
isMilitary({ hex: "abc123", dbFlags: 0 })   // false (bit 0 not set)
isMilitary({ hex: "abc123" })                // false (dbFlags undefined)
```

---

### `src/lib/utils.ts` — Formatting Helpers

Pure functions with no side effects. Each takes raw API data and returns a display-ready string.

#### `formatAltitude(alt: number | "ground" | undefined): string`

| Input | Output |
|---|---|
| `undefined` | `"N/A"` |
| `"ground"` | `"Ground"` |
| `35000` | `"35,000 ft"` |
| `0` | `"0 ft"` |

Uses `toLocaleString("en-US")` for comma-separated thousands formatting.

#### `formatSpeed(gs: number | undefined): string`

| Input | Output |
|---|---|
| `undefined` | `"N/A"` |
| `450.7` | `"451 kts"` |
| `0` | `"0 kts"` |

Rounds to the nearest integer with `Math.round()`.

#### `formatCallsign(flight: string | undefined): string`

The API often returns callsigns with trailing whitespace. This function trims and provides a fallback:

| Input | Output |
|---|---|
| `undefined` | `"UNKNOWN"` |
| `""` | `"UNKNOWN"` |
| `"  "` | `"UNKNOWN"` |
| `"RCH403  "` | `"RCH403"` |

#### `getAircraftLabel(ac: AircraftState): string`

Returns the best human-readable identifier for an aircraft, in priority order:

1. Callsign (trimmed, if non-empty)
2. Registration / tail number
3. ICAO hex code (uppercased)

This is used in map marker tooltips and the aircraft list.

---

### `src/lib/api.ts` — API Client

#### `fetchMilitaryAircraft(): Promise<AircraftResponse>`

The client-side function that retrieves aircraft data. It fetches from `/api/aircraft` (the local Next.js proxy route), **not** from the external ADSB.lol API directly.

**Behavior:**

1. Calls `fetch("/api/aircraft")`
2. If the response is not HTTP 2xx, throws an error with the status code and status text
3. Parses the JSON body
4. Validates that the response has an `ac` property that is an array
5. Returns the typed `AircraftResponse`

**Error cases:**

| Condition | Error thrown |
|---|---|
| HTTP 502 from proxy | `"Aircraft API request failed: 502 Bad Gateway"` |
| HTTP 500 from proxy | `"Aircraft API request failed: 500 Internal Server Error"` |
| Response missing `ac` array | `"Malformed aircraft API response: missing 'ac' array"` |
| Network failure | Native `TypeError` from `fetch` (e.g. `"Failed to fetch"`) |

The validation uses `unknown` narrowing (no `any` types) to maintain TypeScript strict mode compliance.

---

## Phase 3: API Proxy Route

Phase 3 implemented the full upstream proxy in `src/app/api/aircraft/route.ts`.

### `src/app/api/aircraft/route.ts` — Upstream Proxy

Exports a single `GET` handler following Next.js App Router route handler conventions.

#### Request flow

```
Browser → GET /api/aircraft
  → Route handler reads NEXT_PUBLIC_API_BASE_URL (default: "https://api.adsb.lol")
  → Fetches GET {baseUrl}/v2/mil with 15-second AbortController timeout
  → On success: forwards JSON body with cache headers
  → On failure: returns structured 502 JSON error
```

#### Implementation details

1. **Upstream URL configuration** — Reads `process.env.NEXT_PUBLIC_API_BASE_URL`, falling back to `"https://api.adsb.lol"`.
2. **15-second timeout** — Uses `AbortController` with `setTimeout`. Cleared in `finally` block.
3. **Success path** — HTTP 200 forwarded with `Cache-Control: public, s-maxage=5, stale-while-revalidate=10`
4. **Non-200 upstream** — Returns HTTP 502 with upstream status in details
5. **Network/timeout errors** — Caught and returned as HTTP 502

#### Error handling summary

| Condition | HTTP Status | Response Body |
|---|---|---|
| Upstream returns 200 | 200 | Forwarded JSON from ADSB.lol |
| Upstream returns non-200 | 502 | `{ error, details: "Upstream returned status {N}" }` |
| Network failure | 502 | `{ error, details: "Failed to fetch" }` |
| Timeout (>15s) | 502 | `{ error, details: "The operation was aborted" }` |

---

## Module Reference

### Exports by file

| Module | Exports | Used by |
|---|---|---|
| `src/lib/types.ts` | `AircraftState`, `AircraftResponse`, `hasPosition`, `isMilitary` | utils.ts, api.ts, all components, hooks |
| `src/lib/utils.ts` | `formatAltitude`, `formatSpeed`, `formatCallsign`, `getAircraftLabel` | AircraftMarker, AircraftPanel |
| `src/lib/api.ts` | `fetchMilitaryAircraft` | useAircraftData hook |
| `src/lib/aircraftIcons.ts` | `AircraftCategory`, `getAircraftCategory`, `getAircraftIconSvg`, `ICON_SIZES`, `AIRCRAFT_TYPE_MAP`, `getCategoryLabel` | AircraftMarker, AircraftPanel, page.tsx |
| `src/hooks/useAircraftData.ts` | `useAircraftData` | page.tsx |
| `src/components/AircraftPanel.tsx` | `AircraftPanel` | page.tsx |
| `src/components/StatusBar.tsx` | `StatusBar` | page.tsx |
| `src/components/FilterBar.tsx` | `FilterBar` | page.tsx |
| `src/components/MapWrapper.tsx` | `MapWrapper` | page.tsx |
| `src/components/Map.tsx` | `default` (Map) | MapWrapper (via dynamic import) |
| `src/components/AircraftMarker.tsx` | `AircraftMarker` | Map.tsx |
| `src/app/api/aircraft/route.ts` | `GET` (route handler) | Next.js server |

### Dependency graph

```
types.ts  ←── utils.ts
    ↑              ↑
    │              │
    ├── api.ts     │
    │    ↑         │
    │    │         │
    │  useAircraftData.ts
    │    ↑
    │    │
    ├── page.tsx ──→ StatusBar.tsx
    │    │    │
    │    │    └──→ FilterBar.tsx
    │    │
    │    └──→ AircraftPanel.tsx ←── aircraftIcons.ts
    │    │                              ↑
    │    └──→ MapWrapper.tsx ──→ Map.tsx ──→ AircraftMarker.tsx ←── aircraftIcons.ts
    │                                            ↑
    │                                            │
    └────────────────────────────────────────────┘

api/aircraft/route.ts  (standalone — imports only NextResponse from next/server)
```

---

## Environment Configuration

| Variable | Default | Used Where | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.adsb.lol` | API route handler (server) | Base URL for the upstream ADS-B API |
| `POLL_INTERVAL_MS` | `10000` | Polling hook (client) | Milliseconds between data refreshes |
| `NEXT_PUBLIC_DEFAULT_LAT` | `38.9` | Map component (client) | Default map center latitude |
| `NEXT_PUBLIC_DEFAULT_LNG` | `-77.0` | Map component (client) | Default map center longitude |
| `NEXT_PUBLIC_DEFAULT_ZOOM` | `5` | Map component (client) | Default map zoom level |

**No paid API keys are needed.** All current and planned data sources are free.

---

## Local Development Setup

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** (comes with Node.js)
- A modern browser (Chrome, Firefox, Safari, Edge)
- No API keys, accounts, or external services required

### Steps

```bash
# 1. Clone the repository
git clone <repo-url> overwatch
cd overwatch

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local

# 4. Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

### Verifying the setup

```bash
# Type-check (should produce zero errors)
npm run type-check

# Lint (should produce zero errors)
npm run lint

# Production build test
npm run build
```

### Current state (after Phase 10)

When you open `http://localhost:3000`, you will see:

1. A dark status bar at the top showing total aircraft count, tracked count, last updated time, and connection indicator
2. A filter bar with search input, altitude band dropdown, and aircraft category dropdown
3. A loading overlay ("Loading aircraft data...") while the initial fetch is in progress
4. A full-screen Leaflet map with type-specific plane icons for military aircraft
5. Plane icons colored by altitude: green (ground), blue (<10,000 ft), red (>=10,000 ft), rotated to match heading
6. Different icon shapes for different aircraft types (fighters, transports, helicopters, etc.)
7. Data refreshes automatically every 10 seconds (only confirmed military aircraft shown)
8. Clicking a plane shows a popup and opens a detail panel (sidebar on desktop, bottom sheet on mobile)
9. If a selected aircraft disappears from data, a "Signal lost" indicator appears
10. If the API is unreachable, a red error banner appears below the filter bar; the map retains last known positions
11. Map attribution includes both OpenStreetMap and ADSB.lol contributors
12. Amber aircraft favicon and proper page metadata

---

## Toolchain and Build Pipeline

| Tool | Version | Purpose |
|---|---|---|
| Next.js | 16.x | App framework, dev server, API routes, production build |
| TypeScript | 5.x | Static type checking (`tsc --noEmit`) |
| Tailwind CSS | 3.4.x | Utility-first CSS (processed via PostCSS) |
| ESLint | 10.x | Code linting with flat config (`@eslint/js` + `typescript-eslint`) |
| Leaflet | 1.9.x | Interactive map rendering (loaded client-side only) |
| react-leaflet | 4.2.x | React bindings for Leaflet components |
| satellite.js | TBD | SGP4 orbit propagator (planned, for satellite layer) |

---

## Data Source: ADSB.lol API

### What is ADS-B?

**ADS-B (Automatic Dependent Surveillance-Broadcast)** is a surveillance technology where aircraft broadcast their GPS position, identity, and flight parameters on **1090 MHz**. This data is unencrypted, public, and legal to receive.

### Military identification

The `dbFlags` bitfield in each aircraft record indicates military status:
- **Bit 0 (value 1):** Military aircraft
- Check: `(aircraft.dbFlags & 1) !== 0`

The `/v2/mil` endpoint pre-filters for military aircraft, but the `isMilitary()` type guard provides an additional client-side check.

### Typical response size

The `/v2/mil` endpoint returns **200-800 aircraft**. This is small enough that no pagination or virtualization is needed.

---

## Phase 5: Map Components

Phase 5 implemented the Leaflet map layer with aircraft markers.

### `src/components/AircraftMarker.tsx`

A `React.memo`'d client component that renders a single aircraft as a Leaflet marker. Uses `L.DivIcon` with inline SVG, altitude-based coloring, and track rotation.

### `src/components/Map.tsx`

Client component with `MapContainer` + `TileLayer` from react-leaflet. Renders `AircraftMarker` for each positioned aircraft, keyed by `hex`.

### `src/components/MapWrapper.tsx`

Dynamic import wrapper using `next/dynamic` with `{ ssr: false }`.

---

## Phase 6: Polling Hook + Integration

### `src/hooks/useAircraftData.ts`

Custom React hook that polls `/api/aircraft` every 10 seconds. Pre-filters for positioned military aircraft. Preserves data on error.

### `src/components/StatusBar.tsx`

Fixed bar at top of viewport showing counts, timestamp, and connection indicator.

---

## Phase 7: Detail Panel + Military Filtering Fix

### `src/components/AircraftPanel.tsx`

Slide-in panel (320px, right side) showing comprehensive aircraft details with signal lost detection.

### Military Filtering Fix

Added `isMilitary` as a secondary filter in `useAircraftData.ts` to catch non-military aircraft that slip through the `/v2/mil` endpoint.

---

## Phase 8: Aircraft-Type-Specific Icons

Phase 8 replaces the single generic aircraft icon with category-specific silhouettes that make it visually obvious what kind of aircraft is where on the map.

### `src/lib/aircraftIcons.ts` — Type Classification and Icon Mapping

#### `AircraftCategory` type

```typescript
type AircraftCategory = 'fighter' | 'tanker-transport' | 'helicopter' | 'surveillance' | 'trainer' | 'bomber' | 'uav' | 'unknown';
```

#### `AIRCRAFT_TYPE_MAP` — ICAO Type Code Lookup

A `Record<string, AircraftCategory>` mapping ~60+ known military ICAO type codes to categories. The mapping is case-insensitive and supports both exact matches and prefix matching.

**Matching strategy:**

1. Normalize input to uppercase
2. Check for exact match in the map
3. If no exact match, try progressively shorter prefixes (e.g., `F15E` → `F15` → match)
4. Return `'unknown'` if nothing matches

**Coverage by category:**

| Category | Type Codes |
|---|---|
| `fighter` | F16, F15, F15C, F15E, FA18, F18, F22, F35, A10, F117, EF2K, TORN, SU27, SU30, MIG29, JF17, J10, R1 |
| `tanker-transport` | KC135, KC46, KC10, KC30, C17, C5, C130, C130J, C12, C37, C40, C2, A400, AN124, IL76 |
| `helicopter` | UH60, AH64, CH47, CH53, V22, HH60, MH60, OH58, AH1, SH60, NH90, H60, S70, EC45, S92 |
| `surveillance` | E3, E8, E6, RC135, EP3, P8, P3, U2, E2, EA18G, E4, JSTAR |
| `trainer` | T38, T6, T45, T1, PC12, T7, PC21 |
| `bomber` | B52, B1, B2, B21 |
| `uav` | RQ4, MQ9, MQ1, RQ7, MQ4, HRON |

#### `ICON_SIZES` — Size Configuration

| Category | Icon Size (px) | Anchor (px) | Rationale |
|---|---|---|---|
| `fighter` | 24×24 | 12×12 | Standard size, agile appearance |
| `tanker-transport` | 32×32 | 16×16 | Larger to convey size |
| `helicopter` | 24×24 | 12×12 | Standard size |
| `surveillance` | 28×28 | 14×14 | Slightly larger, distinct profile |
| `trainer` | 20×20 | 10×10 | Smaller, lightweight aircraft |
| `bomber` | 32×32 | 16×16 | Larger to convey size |
| `uav` | 20×20 | 10×10 | Smaller, unmanned |
| `unknown` | 24×24 | 12×12 | Default fallback |

#### `getAircraftIconSvg(category, color)` — SVG Generation

Returns inline SVG markup for each category as a string. Each SVG:
- Is a top-down silhouette pointing north (0°)
- Uses the `color` parameter as fill
- Has a viewBox sized to its category's icon dimensions
- Is visually distinct at map zoom levels 3-12

**Icon design principles:**
- **Fighter:** Swept delta wings, narrow fuselage, angled tail fins. Think F-16 top-down.
- **Tanker/Transport:** Straight, wide wings (high aspect ratio), fat cylindrical fuselage, T-tail. Think C-17.
- **Helicopter:** Circle for rotor disc, narrow fuselage below, tail boom extending backward. Think UH-60.
- **Surveillance:** Similar to transport but with a visible radome disc (circle) on top of fuselage. Think E-3 AWACS.
- **Trainer:** Small, simple, straight wings, single engine profile. Think T-38.
- **Bomber:** Large swept wings, wide fuselage, no vertical tail (for stealth types). Think B-52 or B-2 blend.
- **UAV:** Small delta/flying wing, no tail assembly, minimal fuselage. Think RQ-4 Global Hawk wing.
- **Unknown:** Generic aircraft shape (same as Phase 4 icon).

### Updated `AircraftMarker.tsx`

Changes from Phase 5:
- Imports `getAircraftCategory`, `getAircraftIconSvg`, `ICON_SIZES` from `aircraftIcons.ts`
- Calls `getAircraftCategory(aircraft.t)` to determine icon type
- Uses `getAircraftIconSvg(category, color)` for the DivIcon HTML
- Uses `ICON_SIZES[category]` for `iconSize` and `iconAnchor`
- Popup and panel now show aircraft category as a badge

### Updated `AircraftPanel.tsx`

- New field: "Category" row showing the human-readable category name (e.g., "Fighter", "Tanker/Transport")
- Category displayed as a colored badge below the type code

---

## Phase 9: Filter Bar

Phase 9 added search and filter controls to narrow the displayed aircraft.

### `src/components/FilterBar.tsx`

A responsive filter bar rendered between the StatusBar and the map area.

**Controls:**

1. **Search input** — Matches callsign, registration, hex code, or ICAO type code (case-insensitive). Full-width on mobile, 256px on desktop.
2. **Altitude filter** — Dropdown: All / Ground only / Below 10,000 ft / 10,000-30,000 ft / Above 30,000 ft
3. **Category filter** — Dropdown: All / Fighter / Tanker-Transport / Helicopter / Surveillance / Trainer / Bomber / UAV / Unknown
4. **Aircraft count** — "Showing X of Y military aircraft" (hidden on mobile for space)

**Filter logic (in `page.tsx`):**

- `matchesSearch(ac, query)` — case-insensitive match on `flight`, `r`, `hex`, `t`
- `matchesAltitude(ac, filter)` — checks `alt_baro` against altitude bands
- `matchesCategory(ac, filter)` — uses `getAircraftCategory(ac.t)` to compare
- Filters are chained via `useMemo` — only recomputed when aircraft data or filter state changes
- Filtered aircraft array is passed to `MapWrapper` for rendering

---

## Phase 10: Polish

Phase 10 addressed UX polish, responsive design, metadata, and build pipeline fixes.

### Loading State

A semi-transparent dark overlay with animated spinner and "Loading aircraft data..." text, displayed while `loading === true` (during initial data fetch). Positioned as an absolute overlay on the map area at `z-[900]`.

### Error Banner

A red banner below the FilterBar, shown when `error` is set and `loading` is false. Displays "Unable to reach aircraft data source. Retrying..." with the last successful update time on the right. The map retains last known aircraft positions (error does not clear data).

### Empty State

A centered message "No military aircraft currently broadcasting" on the map area, shown when `aircraft.length === 0`, not loading, and no error.

### Favicon

An SVG favicon at `src/app/icon.svg` — amber aircraft silhouette on a dark rounded-rect background. Next.js App Router auto-serves it at `/icon.svg`.

### Page Metadata

Updated `layout.tsx` metadata:
- Title: "Overwatch — Military Movement Tracker"
- Description: comprehensive meta description for SEO/social sharing

### Map Attribution

Added ADSB.lol attribution alongside OpenStreetMap:
```
© OpenStreetMap contributors | Data: ADSB.lol contributors (ODbL)
```

### Responsive Design

- **AircraftPanel:** Desktop (>=768px) slides in from right (320px wide). Mobile (<768px) slides up from bottom (full width, 60vh height).
- **FilterBar:** Search input full-width on mobile, fixed 256px on desktop. Dropdowns flex to fill row on mobile. Aircraft count hidden on mobile.
- Both use Tailwind responsive prefixes (`md:`) for breakpoint switching.

### ESLint Migration

Migrated from ESLint 8 legacy config (`.eslintrc.json`) to ESLint 10 flat config (`eslint.config.mjs`):
- Removed broken `eslint-config-next@0.2.4` (third-party, not official Next.js)
- Installed `@eslint/js` and `typescript-eslint`
- Updated `package.json` lint script from `next lint` (removed in Next.js 16) to `eslint src/`
- Fixed unused import of `MapContainer`/`TileLayer` in `Map.tsx` (uses vanilla Leaflet, not react-leaflet components)

---

## Additional Data Layers

### Maritime Vessel Tracking (AIS) — Layer 2

**Data source:** Free AIS aggregators (AISHub, mAIS, or similar)

**Key concepts:**
- AIS is the maritime equivalent of ADS-B — ships broadcast identity and position on VHF
- Military vessels identifiable by MMSI range (US Navy: 338-369 prefix) and vessel type codes (35, 55)
- Data updates less frequently than aircraft (30-second polling interval)

**Architecture:**
- `src/lib/maritimeTypes.ts` — `VesselState`, `VesselResponse`, `hasVesselPosition`, `isMilitaryVessel`
- `src/app/api/vessels/route.ts` — Proxy with 15s timeout, 10s cache
- `src/hooks/useVesselData.ts` — 30s polling, same error resilience pattern
- `src/components/VesselMarker.tsx` — Ship silhouette icon, heading rotation, cyan/teal coloring

### Satellite Tracking — Layer 3

**Data source:** CelesTrak (free, no auth, TLE data in JSON format)

**Key concepts:**
- TLE (Two-Line Element) sets describe satellite orbits compactly
- SGP4 algorithm propagates TLEs to compute position at any time
- Client-side propagation via `satellite.js` for smooth real-time updates
- TLEs fetched every 5 minutes, positions recomputed every 5 seconds

**Architecture:**
- `src/lib/satelliteTypes.ts` — `SatelliteState`, TLE parsing, SGP4 propagation helpers
- `src/app/api/satellites/route.ts` — Proxy to CelesTrak, 5-minute cache
- `src/hooks/useSatelliteData.ts` — TLE fetch (5min) + position propagation (5s)
- `src/components/SatelliteMarker.tsx` — Small diamond icon, category-based coloring

**CelesTrak endpoints:**
- Military: `https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=json`
- GPS: `https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=json`

### Conflict Events (GDELT) — Layer 4

**Data source:** GDELT Project API (free, no auth, real-time)

**Key concepts:**
- GDELT monitors news worldwide and geocodes events
- Filter by CAMEO codes 17-20 for military/conflict events
- GeoJSON output for direct map integration

**Architecture:**
- `src/lib/conflictTypes.ts` — `ConflictEvent`, intensity scoring
- `src/app/api/conflicts/route.ts` — Proxy to GDELT, 15-minute cache
- `src/hooks/useConflictData.ts` — 15-minute polling
- `src/components/ConflictMarker.tsx` — Circle markers, intensity-based sizing/coloring

### Airspace Restrictions (NOTAMs/TFRs) — Layer 5

**Data source:** FAA NOTAM API (free API key) or FAA TFR web feed

**Architecture:**
- `src/app/api/notams/route.ts` — Proxy to FAA, 30-minute cache
- `src/components/NotamOverlay.tsx` — Semi-transparent polygon overlays for TFR boundaries

### Seismic Monitoring — Layer 6

**Data source:** USGS Earthquake API (free, no auth)

**Endpoint:** `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4&limit=50`

Supplementary layer showing large seismic events. Circle markers with magnitude-based sizing.

---

## Layer Toggle System

### `DataLayerState` interface

```typescript
interface DataLayerState {
  aircraft: boolean;    // default: true
  vessels: boolean;     // default: false
  satellites: boolean;  // default: false
  conflicts: boolean;   // default: false
  notams: boolean;      // default: false
  seismic: boolean;     // default: false
}
```

### Behavior

- Layer state managed in `page.tsx`
- Persisted to `localStorage` for cross-session memory
- Disabled layers stop polling (interval cleared) to conserve bandwidth
- Each layer's hook accepts an `enabled` boolean parameter
- `LayerControl` component provides UI toggles with item counts

---

## Remaining Phases

| Phase | Description | Key Deliverables |
|---|---|---|
| ~~1~~ | ~~Scaffold~~ | ~~Done~~ |
| ~~2~~ | ~~Types & API~~ | ~~Done~~ |
| ~~3~~ | ~~API Proxy~~ | ~~Done~~ |
| ~~4~~ | ~~Aircraft Icon~~ | ~~Done (inline SVG in AircraftMarker)~~ |
| ~~5~~ | ~~Map Components~~ | ~~Done~~ |
| ~~6~~ | ~~Polling + Integration~~ | ~~Done~~ |
| ~~7~~ | ~~Detail Panel~~ | ~~Done — AircraftPanel, selection state, signal lost, isMilitary filter~~ |
| ~~8~~ | ~~Aircraft-Type Icons~~ | ~~Done — Type classification, category-specific SVGs, updated markers + panel~~ |
| ~~9~~ | ~~Filter Bar~~ | ~~Done — Search, altitude filter, category filter, aircraft count display~~ |
| ~~10~~ | ~~Polish~~ | ~~Done — Loading/error/empty states, favicon, metadata, responsive, attribution, ESLint migration~~ |
| 11 | Final Verification | End-to-end testing, build validation, documentation review |
| 12 | Maritime Layer | AIS vessel tracking, ship markers, vessel detail |
| 13 | Satellite Layer | CelesTrak TLEs, SGP4 propagation, satellite markers |
| 14 | Conflict Layer | GDELT events, conflict markers, intensity visualization |
| 15 | Layer Control + NOTAMs | Layer toggle panel, TFR polygon overlays, unified filter system |
| 16 | Final Polish | Performance, mobile, multi-layer error handling, deployment prep |

---

## License

MIT
