# IMPLEMENTATION.md — Overwatch Technical Implementation Guide

Comprehensive technical documentation for the Overwatch military aircraft tracker. This document covers architecture decisions, data flow, every implemented module, and instructions for local development.

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
11. [Remaining Phases](#remaining-phases)

---

## System Architecture

Overwatch follows a three-layer architecture:

```
┌─────────────────────────────────────────────────┐
│                   Browser Client                 │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Leaflet   │  │ React    │  │ Polling Hook │  │
│  │ Map + OSM │  │ UI Layer │  │ (10s interval)│  │
│  └───────────┘  └──────────┘  └──────┬───────┘  │
│                                      │           │
│                              fetch("/api/aircraft")
│                                      │           │
└──────────────────────────────────────┼───────────┘
                                       │
┌──────────────────────────────────────┼───────────┐
│              Next.js Server          │           │
│  ┌───────────────────────────────────▼────────┐  │
│  │  /api/aircraft  (Route Handler)            │  │
│  │  - Proxies to upstream API                 │  │
│  │  - Adds caching headers                    │  │
│  │  - Returns structured error JSON on failure│  │
│  └───────────────────────────────────┬────────┘  │
│                                      │           │
└──────────────────────────────────────┼───────────┘
                                       │
                              GET /v2/mil
                                       │
                                       ▼
                          ┌────────────────────┐
                          │   api.adsb.lol     │
                          │  (Public ADS-B API)│
                          │  No auth required  │
                          └────────────────────┘
```

### Key Architecture Decisions

1. **API Proxy Pattern** — The browser never calls `api.adsb.lol` directly. All requests route through `/api/aircraft` on the Next.js server. This provides a single point for caching, error handling, rate limiting, and allows swapping the upstream API without client changes.

2. **Server Components by Default** — Next.js App Router uses React Server Components. Only components that need browser APIs (Leaflet, hooks, event handlers) are marked `"use client"`.

3. **Dynamic Leaflet Import** — Leaflet accesses the `window` object and will crash during server-side rendering. It must be imported via `next/dynamic` with `{ ssr: false }`.

4. **Full State Replacement** — Each poll replaces the entire aircraft state array. The API returns a complete snapshot, so there is no delta/merge logic. This keeps the data model simple and avoids stale ghost aircraft.

5. **No API Keys** — ADSB.lol is a free, open-source API that requires no authentication. The project has zero secrets to manage.

---

## Data Flow

```
1. Browser tab opens
2. useAircraftData hook mounts
3. Immediate fetch → GET /api/aircraft
4. Next.js route handler → GET https://api.adsb.lol/v2/mil
5. ADSB.lol returns JSON: { ac: [...], total: N, ... }
6. Route handler forwards JSON to client (with cache headers)
7. Client parses response, filters for aircraft with positions
8. React state updates → Leaflet markers re-render on map
9. setInterval fires after 10 seconds → repeat from step 3
```

### Error Path

```
3. fetch("/api/aircraft") fails OR returns non-200
   → Hook sets error state string
   → Previous aircraft remain displayed on map
   → StatusBar shows "Connection lost" with red indicator
   → Next interval fires → retry from step 3
```

---

## Project Structure

```
overwatch/
├── CLAUDE.md                    # Claude Code conventions and rules
├── IMPLEMENTATION.md            # This file — detailed implementation docs
├── README.md                    # Project overview and quick start
├── PLAN.md                      # Sequential build prompts (10 phases)
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
│   └── icons/                   # Static assets (aircraft.svg planned)
└── src/
    ├── app/
    │   ├── layout.tsx           # Root HTML layout + metadata
    │   ├── page.tsx             # Home page (placeholder)
    │   └── api/
    │       └── aircraft/
    │           └── route.ts     # API proxy route (proxies to ADSB.lol)
    ├── components/              # React components (empty, Phase 5+)
    ├── hooks/                   # Custom hooks (empty, Phase 6)
    ├── lib/
    │   ├── types.ts             # AircraftState, AircraftResponse, type guards
    │   ├── api.ts               # fetchMilitaryAircraft client function
    │   └── utils.ts             # Formatting helpers
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

Handles the three possible states of barometric altitude:

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

The validation uses `unknown` narrowing (no `any` types) to maintain TypeScript strict mode compliance. The response is cast to `AircraftResponse` only after confirming the `ac` array exists.

---

## Phase 3: API Proxy Route

Phase 3 implemented the full upstream proxy in `src/app/api/aircraft/route.ts`, replacing the placeholder that previously returned `{ status: "ok" }`. This is the critical server-side bridge between the browser client and the ADSB.lol API.

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

1. **Upstream URL configuration** — Reads `process.env.NEXT_PUBLIC_API_BASE_URL`, falling back to `"https://api.adsb.lol"`. This allows switching to `https://api.adsb.one` (identical API) if the primary is down.

2. **15-second timeout** — Uses `AbortController` with `setTimeout`. The timeout is cleared in a `finally` block to prevent timer leaks regardless of success or failure.

3. **Success path** — When the upstream returns HTTP 200, the JSON body is forwarded to the client with:
   - `Cache-Control: public, s-maxage=5, stale-while-revalidate=10` — allows CDN/proxy caching for 5 seconds, serves stale for up to 10 seconds while revalidating
   - `Content-Type: application/json`

4. **Non-200 upstream** — If the upstream returns a non-200 status (e.g. 500, 503), the route returns HTTP 502 with:
   ```json
   { "error": "Upstream API unavailable", "details": "Upstream returned status 503" }
   ```

5. **Network/timeout errors** — If the fetch throws (network failure, DNS error, abort from timeout), the route catches the error and returns HTTP 502 with:
   ```json
   { "error": "Upstream API unavailable", "details": "The operation was aborted" }
   ```

6. **Type safety** — The upstream response is typed as `unknown` and forwarded as-is via `NextResponse.json()`. Validation of the response shape is the client's responsibility (handled by `fetchMilitaryAircraft` in `src/lib/api.ts`).

#### Error handling summary

| Condition | HTTP Status | Response Body |
|---|---|---|
| Upstream returns 200 | 200 | Forwarded JSON from ADSB.lol |
| Upstream returns non-200 (e.g. 503) | 502 | `{ error, details: "Upstream returned status 503" }` |
| Network failure | 502 | `{ error, details: "Failed to fetch" }` |
| Timeout (>15s) | 502 | `{ error, details: "The operation was aborted" }` |
| DNS resolution failure | 502 | `{ error, details: <system error message> }` |

#### Verified behavior

Tested with `npm run dev` and `curl http://localhost:3000/api/aircraft`:
- Returns ~200-800 military aircraft in the `ac` array
- Response headers include `Cache-Control: public, s-maxage=5, stale-while-revalidate=10`
- Aircraft objects include `hex`, `lat`, `lon`, `alt_baro`, `gs`, `track`, `t`, `r`, `dbFlags`, etc.
- TypeScript type-check passes with zero errors

---

## Module Reference

### Exports by file

| Module | Exports | Used by |
|---|---|---|
| `src/lib/types.ts` | `AircraftState`, `AircraftResponse`, `hasPosition`, `isMilitary` | utils.ts, api.ts, all components, hooks |
| `src/lib/utils.ts` | `formatAltitude`, `formatSpeed`, `formatCallsign`, `getAircraftLabel` | AircraftMarker, AircraftPanel, StatusBar |
| `src/lib/api.ts` | `fetchMilitaryAircraft` | useAircraftData hook |
| `src/app/api/aircraft/route.ts` | `GET` (route handler) | Next.js server (handles `/api/aircraft` requests) |

### Dependency graph

```
types.ts  ←── utils.ts
    ↑          ↑
    │          │
    ├── api.ts │
    │          │
    └── [future components and hooks will import from all three]

api/aircraft/route.ts  (standalone — imports only NextResponse from next/server)
```

`types.ts` is the leaf dependency — it imports nothing from the project. `utils.ts` imports only `AircraftState` from `types.ts`. `api.ts` imports only `AircraftResponse` from `types.ts`. The route handler (`api/aircraft/route.ts`) is standalone — it imports only `NextResponse` from `next/server` and has no project-internal dependencies.

---

## Environment Configuration

All environment variables are defined in `.env.example` and should be copied to `.env.local` for local development.

| Variable | Default | Used Where | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.adsb.lol` | API route handler (server) | Base URL for the upstream ADS-B API |
| `POLL_INTERVAL_MS` | `10000` | Polling hook (client) | Milliseconds between data refreshes |
| `NEXT_PUBLIC_DEFAULT_LAT` | `38.9` | Map component (client) | Default map center latitude (Washington DC area) |
| `NEXT_PUBLIC_DEFAULT_LNG` | `-77.0` | Map component (client) | Default map center longitude |
| `NEXT_PUBLIC_DEFAULT_ZOOM` | `5` | Map component (client) | Default map zoom level (continental US view) |

Variables prefixed with `NEXT_PUBLIC_` are available in both server and client code. `POLL_INTERVAL_MS` (without the prefix) is server-only by default.

**No API keys are needed.** ADSB.lol is a free, open-source API with no authentication.

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

### Current state (after Phase 3)

When you open `http://localhost:3000`, you will see a centered "Overwatch" heading. This is the placeholder page — the map, aircraft markers, and live data will be added in Phases 4-6.

The API proxy route at `http://localhost:3000/api/aircraft` returns live military aircraft data proxied from ADSB.lol. Expect a JSON response with 200-800 aircraft in the `ac` array.

### Switching the upstream API

If `api.adsb.lol` is down, edit `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=https://api.adsb.one
```

The fallback API uses identical endpoints and response format.

---

## Toolchain and Build Pipeline

| Tool | Version | Purpose |
|---|---|---|
| Next.js | 14.2.x | App framework, dev server, API routes, production build |
| TypeScript | 5.x | Static type checking (`tsc --noEmit`) |
| Tailwind CSS | 3.4.x | Utility-first CSS (processed via PostCSS) |
| ESLint | 8.x | Code linting with `next/core-web-vitals` rules |
| Leaflet | 1.9.x | Interactive map rendering (loaded client-side only) |
| react-leaflet | 4.2.x | React bindings for Leaflet components |

### Build process

1. `next build` runs TypeScript compilation, tree-shaking, and bundles the app
2. Server components are rendered at build time or request time
3. Client components (map, hooks) are bundled into browser JavaScript
4. Tailwind CSS is purged to include only used utility classes
5. Static assets in `public/` are copied to the output

---

## Data Source: ADSB.lol API

### What is ADS-B?

**ADS-B (Automatic Dependent Surveillance-Broadcast)** is a surveillance technology where aircraft broadcast their GPS position, identity, and flight parameters on **1090 MHz**. This data is:

- **Unencrypted** — broadcast in the clear over open radio frequencies
- **Public** — anyone with a receiver can pick up these signals
- **Legal to receive** — in the US and most jurisdictions

Volunteer-run ground stations around the world receive these signals and feed them to aggregators like ADSB.lol.

### Military identification

The ADSB.lol database maintains a community-curated mapping of ICAO hex addresses to aircraft metadata. The `dbFlags` bitfield in each aircraft record indicates special statuses:

- **Bit 0 (value 1):** Military aircraft
- Check: `(aircraft.dbFlags & 1) !== 0`

The `/v2/mil` endpoint pre-filters for military aircraft, but the `isMilitary()` type guard provides an additional client-side check.

### API endpoints used

| Endpoint | Method | Description |
|---|---|---|
| `/v2/mil` | GET | All aircraft flagged as military |

Additional endpoints available (not currently used):

| Endpoint | Description |
|---|---|
| `/v2/hex/{icao}` | Single aircraft by ICAO hex address |
| `/v2/callsign/{cs}` | Aircraft by callsign |
| `/v2/type/{type}` | Aircraft by ICAO type code |
| `/v2/squawk/{squawk}` | Aircraft by squawk code |

### Typical response size

The `/v2/mil` endpoint returns **200-800 aircraft** depending on time of day and global military activity. This is small enough that:

- No pagination is needed
- No virtualization is needed for map markers
- Full state replacement on each poll is efficient

### Rate limiting

No rate limits are currently enforced by ADSB.lol. Overwatch polls at a **10-second interval** as a good-faith limit to avoid unnecessary load.

---

## Remaining Phases

| Phase | Description | Key Deliverables |
|---|---|---|
| ~~3~~ | ~~API Proxy Route~~ | ~~Full `/api/aircraft` proxy with upstream fetch, caching, error handling~~ **Done** |
| 4 | Aircraft Icon | SVG plane silhouette for map markers |
| 5 | Map Components | `Map.tsx`, `AircraftMarker.tsx`, `MapWrapper.tsx` with Leaflet |
| 6 | Polling + Integration | `useAircraftData` hook, `StatusBar`, main page wiring |
| 7 | Detail Panel | `AircraftPanel.tsx` slide-in panel for selected aircraft |
| 8 | Filter Bar | Search, altitude filter, aircraft count display |
| 9 | Polish | Loading/error/empty states, responsive design, metadata |
| 10 | Final Verification | End-to-end testing, build validation, documentation review |

---

## License

MIT
