# CLAUDE.md — Overwatch Project Conventions

## Project Overview

Overwatch is a real-time military movement intelligence dashboard using publicly available data sources. The primary layer is aircraft tracking via ADSB.lol's free public API on a Leaflet.js map. Additional planned layers include maritime vessel tracking (AIS), satellite orbit tracking, conflict event data, and airspace restriction overlays.

It is a Next.js 16 App Router project in TypeScript with Tailwind CSS.

## Current Implementation Status

- **Phase 1 (Scaffold):** Complete — project structure, dependencies, configuration
- **Phase 2 (Types & API Utility Layer):** Complete — TypeScript interfaces, helper functions, API client
- **Phase 3 (API Proxy Route):** Complete — full upstream proxy with caching, timeout, error handling
- **Phase 5 (Map Components):** Complete — AircraftMarker, Map, MapWrapper with dynamic import (no SSR)
- **Phase 6 (Polling + Integration):** Complete — useAircraftData hook, StatusBar, page wiring, live data on map
- **Phase 7 (Detail Panel):** Complete — AircraftPanel slide-in, aircraft selection, signal lost tracking, isMilitary filtering
- **Phase 8 (Aircraft Icons):** Complete — AircraftCategory type system, ICAO type code mapping, category-specific SVG silhouettes, icon size rules, AircraftMarker + AircraftPanel integration
- **Phase 9 (Filter Bar):** Complete — search by callsign/reg/hex/type, altitude band filter, category filter, aircraft count display
- **Phase 10 (Polish):** Complete — loading/error/empty states, favicon, page metadata, ADSB.lol attribution, responsive mobile layout, ESLint flat config migration
- **Phase 12 (Maritime Vessel Tracking):** In progress — rebuilding with aisstream.io WebSocket API (previous Digitraffic implementation removed)

### What's Implemented

| File | Status | Description |
|---|---|---|
| `src/lib/types.ts` | Done | `AircraftState`, `AircraftResponse` interfaces; `hasPosition`, `isMilitary` guards |
| `src/lib/utils.ts` | Done | `formatAltitude`, `formatSpeed`, `formatCallsign`, `getAircraftLabel` helpers |
| `src/lib/api.ts` | Done | `fetchMilitaryAircraft` — fetches from local proxy with validation |
| `src/app/api/aircraft/route.ts` | Done | Proxies to ADSB.lol `/v2/mil` with 15s timeout, cache headers, structured 502 errors |
| `src/app/layout.tsx` | Done | Root layout with metadata ("Overwatch — Military Movement Tracker"), favicon, globals.css import |
| `src/app/icon.svg` | Done | SVG favicon — amber aircraft silhouette on dark background |
| `src/app/page.tsx` | Done | Client component with useAircraftData, StatusBar, FilterBar, MapWrapper, AircraftPanel, loading/error/empty overlays |
| `src/lib/aircraftIcons.ts` | Done | `AircraftCategory` type, `AIRCRAFT_TYPE_MAP`, `getAircraftCategory()`, `ICON_SIZES`, `getAircraftIconSvg()`, `getCategoryLabel()` — SVG icons sourced from ADS-B Radar |
| `src/lib/countryLookup.ts` | Done | ICAO hex-to-country lookup (170+ ranges), `getCountryFromHex()`, `countryCodeToFlag()` emoji converter |
| `src/components/AircraftMarker.tsx` | Done | `React.memo`'d marker with category-specific DivIcon SVG silhouettes, altitude-based coloring, track rotation, popup with country flag + category badge |
| `src/components/Map.tsx` | Done | Client component using vanilla Leaflet `L.map` + `L.tileLayer`, renders `AircraftMarker` for each positioned aircraft, viewport-filtered vessel rendering with zoom gate (zoom >= 4), includes ADSB.lol + ADS-B Radar + aisstream.io attribution |
| `src/components/MapWrapper.tsx` | Done | Dynamically imports Map with `{ ssr: false }`, shows loading placeholder |
| `src/components/AircraftPanel.tsx` | Done | Slide-in detail panel — right sidebar on desktop, bottom sheet on mobile (<768px), signal lost indicator, country flag badge, category badge |
| `src/components/StatusBar.tsx` | Done | Shows total/tracked counts, vessel count (when layer active), last updated time, connection status with colored indicator |
| `src/hooks/useAircraftData.ts` | Done | Polls `/api/aircraft` every 10s, filters by hasPosition, preserves data on failure |
| `src/components/FilterBar.tsx` | Done | Search (callsign/reg/hex/type), altitude band filter, category filter, aircraft count — responsive (full-width search on mobile) |
| `eslint.config.mjs` | Done | ESLint 10 flat config with `@eslint/js` + `typescript-eslint` |
| `src/lib/env.ts` | Done | `getAisStreamApiKey()`, `isVesselTrackingEnabled()` — server-side only environment helpers |
| `src/lib/vesselTypes.ts` | Done | `VesselData` interface, `VesselCategory` type, `getVesselCategory()`, `getMIDFromMMSI()`, `getCountryFromMID()` (MID lookup for 60+ nations), `identifyMilitaryVessel()` (type code + name pattern + MMSI heuristics), `VESSEL_COLORS`, `VESSEL_CATEGORY_LABELS` |
| `src/lib/aisStreamManager.ts` | Done | Singleton server-side WebSocket manager for aisstream.io — `initAisStream()`, `getVessels()`, `getConnectionStatus()`; handles reconnection, staleness cleanup, message parsing |
| `src/components/VesselFilterBar.tsx` | Done | Vessel layer filter bar — country/flag dropdown (dynamically populated), vessel type/category dropdown, vessel count display, blue accent styling |

### What's Planned

| File | Status | Description |
|---|---|---|
| `src/lib/dataLayers.ts` | Planned | Unified data layer toggle system |
| `src/app/api/satellites/route.ts` | Planned | Satellite TLE/position proxy route |
| `src/app/api/conflicts/route.ts` | Planned | Conflict event data proxy route |
| `src/app/api/notams/route.ts` | Planned | NOTAM/TFR proxy route |
| `src/components/SatelliteMarker.tsx` | Planned | Satellite orbit/position marker |
| `src/components/ConflictMarker.tsx` | Planned | Conflict event marker |
| `src/components/LayerControl.tsx` | Planned | Data layer toggle panel (currently a simple button in FilterBar) |

## Commands

- `npm run dev` — Start dev server on port 3000
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint (uses `eslint src/` with flat config)
- `npm run type-check` — Run `tsc --noEmit`

## Architecture Rules

- **Next.js App Router only.** No Pages Router. All routes go in `src/app/`.
- **Server Components by default.** Only add `"use client"` when the component needs browser APIs, hooks, or event handlers.
- **Leaflet must be dynamically imported** with `{ ssr: false }` via `next/dynamic`. Leaflet accesses `window` and will crash during SSR.
- **API proxy pattern.** The client never calls external APIs directly. All data flows through proxy routes under `src/app/api/`, which handle caching, error handling, and rate limiting.
- **API keys.** ADSB.lol requires no authentication. The vessel tracking layer requires a free API key from aisstream.io, stored in `AISSTREAM_API_KEY` in `.env.local`. The key is server-side only — never prefix it with `NEXT_PUBLIC_`.
- **One proxy route per data source.** Each external API gets its own route handler under `src/app/api/`.

## Code Style

- TypeScript strict mode. No `any` types — use `unknown` and narrow.
- Prefer `interface` over `type` for object shapes.
- Prefer named exports over default exports (except for Next.js page/layout components which require default exports).
- Use `const` arrow functions for components: `const MyComponent = () => { ... }`.
- Use native `fetch` — do not add axios or other HTTP libraries.
- CSS via Tailwind utility classes. No CSS modules, no styled-components.

## File Conventions

- Components: `src/components/ComponentName.tsx` (PascalCase)
- Hooks: `src/hooks/useHookName.ts` (camelCase with `use` prefix)
- Library/utils: `src/lib/filename.ts` (camelCase)
- API routes: `src/app/api/resource/route.ts`
- Types: `src/lib/types.ts` (centralized for aircraft; new type files per data layer)

## Key Technical Details

### ADSB.lol API

- Base URL: `https://api.adsb.lol`
- Military endpoint: `GET /v2/mil` — returns `{ ac: AircraftState[], msg: string, now: number, total: number, ctime: number, ptime: number }`
- Each aircraft object has: `hex`, `flight`, `lat`, `lon`, `alt_baro`, `alt_geom`, `gs`, `track`, `t` (type code), `r` (registration), `dbFlags`, `squawk`, `seen`, `seen_pos`, `category`
- Military flag: `(aircraft.dbFlags & 1) !== 0`
- No auth required. No rate limit currently enforced, but poll no faster than every 10 seconds.
- Fallback: `https://api.adsb.one` uses identical endpoints.

### Aircraft Icon Classification System (Phase 8)

Aircraft are categorized by ICAO type code (`t` field) into visual categories, each with a distinct SVG silhouette icon sourced from the [ADS-B Radar](https://adsb-radar.com) icon set (free for personal/commercial use with attribution).

#### Aircraft Categories

| Category | ADS-B Radar Icon | Icon Shape | Example Types | Color Scheme |
|---|---|---|---|---|
| `fighter` | `a6` | Delta-wing high-performance jet | F16, F15, F22, F35, A10, FA18, EF2K, TORN, SU27, F14, RFAL | Altitude-based coloring |
| `tanker-transport` | `c130` | 4-engine military transport | KC135, K35R, KC46, C17, C5M, C130, C30J, A400, AN124, C145 | Altitude-based coloring |
| `helicopter` | `a7` | Rotorcraft with rotor disc blades | UH60, AH64, CH47, V22, H60, H64, EC45, EC35, S70, A109 | Altitude-based coloring |
| `surveillance` | `a5` | Heavy 4-engine aircraft | E3, E8, E6, RC135, P8, U2, E2, EA18G, JSTAR, MC12, E11A | Altitude-based coloring |
| `trainer` | `cessna` | Small general aviation prop | T38, T6, T45, PC12, T7, PC21, PC7, PC9 | Altitude-based coloring |
| `bomber` | `b747` | Large 4-engine heavy aircraft | B52, B1, B2, B21 | Altitude-based coloring |
| `uav` | `a1` | Light aircraft silhouette | RQ4, MQ9, MQ1, MQ4, HRON, MQ25, XQ58 | Altitude-based coloring |
| `unknown` | `a3` | Generic jet airliner | Anything not matched | Altitude-based coloring |

#### Type Code Mapping (`src/lib/aircraftIcons.ts`)

The mapping function `getAircraftCategory(typeCode: string | undefined): AircraftCategory` uses a lookup table of 90+ known ICAO type codes. The lookup is case-insensitive, checks exact match first, then tries prefix matches from longest to shortest (minimum 2 characters). For example, "F15E" → exact match fighter; "H53S" → prefix "H53" → helicopter; "C27J" → prefix "C2" → tanker-transport. Also exports `getCategoryLabel(category)` for human-readable display names.

Each category maps to a distinct SVG string via `getAircraftIconSvg(category: AircraftCategory, color: string): string` which returns inline SVG markup (same pattern as the current DivIcon approach).

#### Icon Size Rules

Intentionally large for instant visual recognition at map zoom levels 4-8. Each SVG includes a thin semi-transparent black stroke (`stroke="#000" stroke-opacity="0.3" stroke-width="0.5"`) for visibility against both light and dark map backgrounds.

| Category | Icon Size | Anchor |
|---|---|---|
| `fighter` | 36×36 | 18×18 |
| `tanker-transport` | 42×42 | 21×21 |
| `helicopter` | 38×38 | 19×19 |
| `surveillance` | 42×42 | 21×21 |
| `trainer` | 30×30 | 15×15 |
| `bomber` | 44×44 | 22×22 |
| `uav` | 32×32 | 16×16 |
| `unknown` | 34×34 | 17×17 |

### Country Identification (src/lib/countryLookup.ts)

Aircraft country of registration is determined from the ICAO 24-bit hex address (`hex` field). The ICAO address space is divided into country-specific ranges by ICAO Annex 10 Vol III. The lookup table contains 170+ ranges covering all ICAO member states (sourced from the tar1090 project, MIT license).

- `getCountryFromHex(hex: string): { country: string; code: string } | null` — returns the most specific match (narrowest range) when sub-ranges overlap (e.g., Hong Kong within China, Bermuda within UK)
- `countryCodeToFlag(code: string): string` — converts ISO 3166-1 alpha-2 code to emoji flag using Unicode Regional Indicator Symbols

Country flags are displayed in the AircraftMarker popup and AircraftPanel detail view. The flag is derived entirely from the hex code — no additional API calls needed.

### Attribution

| Resource | Usage | License/Terms |
|---|---|---|
| OpenStreetMap | Map tiles | ODbL |
| ADSB.lol | Aircraft ADS-B data | ODbL |
| ADS-B Radar | Aircraft SVG icon silhouettes | Free with attribution — [adsb-radar.com](https://adsb-radar.com) |
| tar1090 | ICAO hex-to-country range data | MIT |
| aisstream.io | AIS vessel tracking data | Free API key |

Attribution is displayed in the map tile layer: `© OpenStreetMap contributors | Data: ADSB.lol (ODbL) | Icons: ADS-B Radar | Vessel data: aisstream.io`

### TypeScript Types (src/lib/types.ts)

- `AircraftState` — interface for a single aircraft with all fields from `/v2/mil`. Position/telemetry fields are optional since not all aircraft broadcast all fields.
- `AircraftResponse` — interface for the top-level API response containing `ac[]`, `msg`, `now`, `total`, `ctime`, `ptime`.
- `hasPosition(aircraft)` — returns `true` only when both `lat` and `lon` are defined numbers.
- `isMilitary(aircraft)` — returns `true` when `(dbFlags & 1) !== 0`.

### Utility Functions (src/lib/utils.ts)

- `formatAltitude(alt)` — `"Ground"` | `"N/A"` | `"12,500 ft"`
- `formatSpeed(gs)` — `"N/A"` | `"450 kts"`
- `formatCallsign(flight)` — trims whitespace, returns `"UNKNOWN"` if empty
- `getAircraftLabel(ac)` — callsign > registration > hex code

### API Client (src/lib/api.ts)

- `fetchMilitaryAircraft()` — fetches from `/api/aircraft` (local proxy), validates the response shape, throws on HTTP errors or malformed data.

### API Proxy Route (src/app/api/aircraft/route.ts)

- Exports an async `GET` handler using Next.js App Router route handler conventions
- Reads upstream base URL from `process.env.NEXT_PUBLIC_API_BASE_URL`, defaulting to `"https://api.adsb.lol"`
- Fetches `GET {baseUrl}/v2/mil` with a 15-second timeout via `AbortController`
- On success: forwards JSON with `Cache-Control: public, s-maxage=5, stale-while-revalidate=10`
- On fetch error (network/timeout): returns 502 `{ error: "Upstream API unavailable", details: error.message }`
- On non-200 upstream: returns 502 with upstream status code in details

### Leaflet Map

- Tile URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Attribution: `© OpenStreetMap contributors | Data: ADSB.lol (ODbL) | Icons: ADS-B Radar | Vessel data: aisstream.io`
- Map is created using vanilla Leaflet (`L.map`, `L.tileLayer`) — not react-leaflet components
- Leaflet CSS must be imported: `import 'leaflet/dist/leaflet.css'`
- Custom plane icon using Leaflet's `DivIcon` with inline SVG rotated by the aircraft's `track` heading

### Map Components (src/components/)

- **AircraftMarker.tsx** — `React.memo`'d client component receiving `AircraftState` + `onClick` callback
  - Returns `null` if `hasPosition()` is false
  - Uses `L.DivIcon` with inline SVG — icon shape determined by `getAircraftCategory(aircraft.t)`
  - SVG rotated by `aircraft.track` degrees via CSS `transform: rotate()`
  - Icon size varies by category (see Icon Size Rules above)
  - Altitude-based coloring: green (`#22c55e`) for ground, blue (`#3b82f6`) for < 10,000 ft, red (`#ef4444`) for >= 10,000 ft
  - Popup displays: formatted callsign, country flag emoji + country name, type code, registration, altitude, speed, category badge
- **Map.tsx** — `"use client"` component importing Leaflet CSS, creates map via `L.map` + `L.tileLayer`, renders `AircraftMarker` per positioned aircraft (keyed by `hex`)
  - Map center/zoom read from env vars with defaults (38.9, -77.0, zoom 5)
  - Attribution includes OpenStreetMap, ADSB.lol, ADS-B Radar, and aisstream.io
  - Viewport filtering: tracks map bounds via `moveend`/`zoomend` events, only renders vessels within the current viewport for performance with 2000+ markers
  - Zoom gate: vessel markers only render at zoom >= 4; shows "Zoom in to see vessels" notice when zoomed out
- **MapWrapper.tsx** — uses `next/dynamic` to import `Map` with `{ ssr: false }`, shows "Loading map..." placeholder
  - This is what `page.tsx` renders — never import `Map.tsx` directly from a server component

### Polling Hook (src/hooks/useAircraftData.ts)

- `useAircraftData()` — custom hook that polls `/api/aircraft` every 10 seconds
- Returns `{ aircraft, loading, error, lastUpdated, totalCount }`
- `aircraft` is pre-filtered to only include confirmed military aircraft with valid positions (via `isMilitary` + `hasPosition`)
- On mount: fetches immediately, then sets up `setInterval` with `POLL_INTERVAL_MS` (default 10000, reads `NEXT_PUBLIC_POLL_INTERVAL_MS`)
- On success: replaces full aircraft state, updates `totalCount` from `response.total`, sets `lastUpdated`, clears error
- On failure: sets error message string, preserves previous aircraft data on map, continues polling
- Cleanup: clears interval on unmount

### StatusBar (src/components/StatusBar.tsx)

- Fixed to top of viewport, dark background (`zinc-900`), white text, small font
- Left side: total count (from API response) and tracked count (aircraft with positions)
- Right side: last updated time (HH:MM:SS), connection status (green/red dot + message)
- Props: `totalCount`, `positionCount`, `lastUpdated`, `error`

### AircraftPanel (src/components/AircraftPanel.tsx)

- **Desktop (>=768px):** Slide-in panel from right side (320px wide, rounded left corners)
- **Mobile (<768px):** Slide-up bottom sheet (full width, 60vh height, rounded top corners)
- Props: `aircraft` (AircraftState | null), `onClose` callback, `signalLost` boolean
- When `aircraft` is null, panel slides off-screen via CSS transition
- Displays: callsign (bold header), ICAO hex, registration, type code, altitude, speed, heading, squawk, lat/lon (4 decimal places), last seen time, military badge, **country flag badge** (flag emoji + country name from ICAO hex lookup), **aircraft category badge**
- Close button (X) in top-right corner
- "Signal lost" indicator (red badge with pulse animation) when aircraft disappears from data
- Absolutely positioned overlaying the map at `z-[1000]`

### FilterBar (src/components/FilterBar.tsx)

- Dark background (`zinc-800`), below StatusBar
- **Search:** text input matching callsign, registration, hex, or type code (case-insensitive)
- **Altitude filter:** All / Ground / Below 10k / 10k-30k / Above 30k
- **Category filter:** All / Fighter / Tanker-Transport / Helicopter / Surveillance / Trainer / Bomber / UAV / Unknown
- **Count display:** "Showing X of Y military aircraft" (hidden on mobile)
- **Responsive:** search input full-width on mobile (<768px), dropdowns flex to fill row

### VesselFilterBar (src/components/VesselFilterBar.tsx)

- Dark background (`zinc-800`), appears below aircraft FilterBar when vessel layer is enabled
- Blue accent color (`blue-400`) with ship icon + "Vessels" label to distinguish from aircraft filters
- **Country/flag filter:** dynamically populated dropdown from live vessel data (only countries with currently tracked vessels)
- **Category filter:** All types / Military / Cargo / Tanker / Passenger / Fishing / Tug/Pilot / High-Speed Craft / Pleasure Craft / Other
- **Count display:** "Showing X of Y vessels" (hidden on mobile)
- Props: `countryFilter`, `onCountryFilterChange`, `categoryFilter`, `onCategoryFilterChange`, `filteredCount`, `totalCount`, `countries: string[]`

### Aircraft Selection (src/app/page.tsx)

- `selectedAircraft` state tracks the currently selected aircraft
- `signalLost` state tracks whether the selected aircraft has disappeared from polling data
- On each poll refresh, updates selected aircraft data by matching `hex` code
- If the selected aircraft disappears from the data, keeps showing last known state with "Signal lost" indicator
- Close handler clears selection and resets signal lost state

### Loading / Error / Empty States (src/app/page.tsx)

- **Loading:** Semi-transparent dark overlay with spinning icon + "Loading aircraft data..." (shown while initial fetch is in progress)
- **Error:** Red banner below FilterBar — "Unable to reach aircraft data source. Retrying..." with last successful update time. Map still shows last known positions.
- **Empty:** Centered message on map — "No military aircraft currently broadcasting" (when API returns 0 aircraft and no error)

### Vessel Types & Utilities (src/lib/vesselTypes.ts)

- `VesselData` — interface for a single AIS vessel: `mmsi`, `name`, `lat`, `lon`, `cog`, `sog`, `heading`, `shipType`, `destination`, `flag`, `isMilitary`, `militaryCategory`, `lastUpdate`
- `VesselCategory` — display category union: `'military' | 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'tug' | 'highspeed' | 'pleasure' | 'other'`
- `getVesselCategory(shipType)` — maps AIS type code (0-99) to `VesselCategory`
- `getMIDFromMMSI(mmsi)` — extracts first 3 digits (Maritime Identification Digits) from MMSI
- `getCountryFromMID(mid)` — looks up country name from MID code (60+ nations including flag-of-convenience states)
- `identifyMilitaryVessel(mmsi, shipType, name)` — returns `{ isMilitary, category }` using three signal checks: AIS type codes 35/55, name pattern matching (USS, HMS, USCG, etc.), and MMSI prefix 3669 (US federal)
- `VESSEL_CATEGORY_LABELS` — canonical `Record<VesselCategory, string>` for human-readable category names (shared by VesselMarker, VesselPanel, VesselFilterBar)
- `VESSEL_COLORS` — display color per `VesselCategory` (military red, cargo blue, tanker orange, etc.)

### AIS Stream Manager (src/lib/aisStreamManager.ts)

Server-side singleton module that maintains a persistent WebSocket connection to aisstream.io and accumulates vessel data in memory. Uses the `ws` npm package (NOT browser WebSocket). Imported only by API route handlers.

**Exported functions:**
- `initAisStream()` — starts WebSocket connection (no-op if already connected or API key missing). Subscribes to global bounding box `[[-90,-180],[90,180]]` for `PositionReport` and `ShipStaticData` message types.
- `getVessels()` — returns `VesselData[]` snapshot of all currently tracked vessels
- `getConnectionStatus()` — returns `{ state, vesselCount, lastMessage }` where state is `'disabled' | 'disconnected' | 'connecting' | 'connected' | 'error'`

**Internal behavior:**
- Processes two aisstream.io message types: `PositionReport` (lat, lon, cog, sog, heading) and `ShipStaticData` (ship type, destination, name)
- All messages are validated via type narrowing — no `any` types
- Vessels stored in a `Map<string, VesselData>` keyed by MMSI
- On each message: computes flag via MID lookup, runs military identification, updates vessel entry
- Automatic reconnection: 5s delay for first 10 attempts, then 60s backoff reset
- Staleness cleanup: every 60s removes vessels not updated in 10 minutes

**Data flow for vessel layer:**
```
aisstream.io WSS → aisStreamManager (server singleton) → /api/vessels GET → useVesselData hook → Map
```

---

## Additional Data Layers (Planned)

### Layer 1: Maritime Vessel Tracking (AIS) — In Progress (Phase 12)

**Data Source:** aisstream.io WebSocket API (free API key, global coverage)

| Source | URL | Auth | Notes |
|---|---|---|---|
| **aisstream.io (active)** | `wss://stream.aisstream.io/v0/stream` | Free API key | Global coverage, WebSocket, real-time |

**Implementation:** Server-side WebSocket connection via `ws` package managed by `aisStreamManager.ts` singleton. API key stored in `AISSTREAM_API_KEY` env var (server-side only). Previous Digitraffic REST implementation was removed in favor of aisstream.io for global coverage. Types and military identification logic in `vesselTypes.ts`. API route and client-side components still to come.

**Military vessel identification:** AIS type code 35 (military ops), type code 55 (law enforcement), warship name patterns (USS, HMS, USCG, etc.), coast guard name patterns, and MMSI prefix 3669 (US federal NTIA assignment). Implemented in `identifyMilitaryVessel()` in `vesselTypes.ts`.

### Layer 2: Satellite Tracking

**Data Source Options:**

| Source | URL | Auth | Notes |
|---|---|---|---|
| **CelesTrak** | `https://celestrak.org/NORAD/elements/` | None | Free TLE data, no account needed |
| Space-Track.org | `https://www.space-track.org/` | Free account | Official DoD catalog, requires registration |
| N2YO | `https://www.n2yo.com/rest/v1/satellite/` | Free API key | Real-time positions, easy REST API |
| **Wheretheiss.at** | `https://api.wheretheiss.at/v1/satellites/` | None | Limited to a few satellites |

**Implementation:** Use CelesTrak for TLE (Two-Line Element) data. Parse TLEs with a JavaScript SGP4 propagator library (e.g., `satellite.js`) to compute real-time lat/lon/altitude from orbital elements. Focus on military-relevant satellites: GPS constellation, reconnaissance (KH-series), SIGINT, early warning (SBIRS/DSP), communications (MUOS, AEHF, Milstar).

**CelesTrak military-relevant catalogs:**
- `https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=json` — Military satellites
- `https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=json` — GPS constellation
- `https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json` — All active satellites

### Layer 3: Conflict/Event Data

**Data Source Options:**

| Source | URL | Auth | Notes |
|---|---|---|---|
| **GDELT Project** | `https://api.gdeltproject.org/api/v2/` | None | Real-time global event data, free, massive |
| ACLED | `https://acleddata.com/` | Free registration | Armed conflict events, academic-grade |
| Uppsala UCDP | `https://ucdp.uu.se/apidocs/` | None | Conflict data, updated annually |
| Crisis24 | N/A | Paid | Commercial threat intelligence |

**Implementation:** GDELT is the most accessible — fully free, no auth, real-time. Use the GDELT GEO 2.0 API to query events with military/conflict themes. Filter by CAMEO event codes related to military action (codes 17-20: coerce, assault, fight, mass violence). Render as heat map overlay or point markers with event type badges.

**GDELT query example:**
```
https://api.gdeltproject.org/api/v2/geo/geo?query=military&mode=pointdata&format=geojson&timespan=24h
```

### Layer 4: Airspace Restrictions (NOTAMs/TFRs)

**Data Source:**

| Source | URL | Auth | Notes |
|---|---|---|---|
| **FAA NOTAM API** | `https://external-api.faa.gov/notamapi/v1/notams` | Free API key | US NOTAMs including TFRs |
| FAA TFR Feed | `https://tfr.faa.gov/tfr2/list.html` | None | Scrapeable TFR list |
| ICAO API | Paid | Paid | Global NOTAMs |

**Implementation:** Render TFRs (Temporary Flight Restrictions) as shaded polygon/circle overlays on the map. TFRs often correlate with VIP movement, military exercises, or security events. The FAA API requires a free registration for an API key.

### Layer 5: Nuclear Detonation / Seismic Monitoring

**Data Source:**

| Source | URL | Auth | Notes |
|---|---|---|---|
| **USGS Earthquake API** | `https://earthquake.usgs.gov/fdsnws/event/1/` | None | Real-time seismic data, free |
| CTBTO | Limited public | Varies | Nuclear test ban monitoring |

**Implementation:** USGS provides real-time earthquake data as GeoJSON. While primarily for natural events, large seismic events in known test sites (e.g., North Korea's Punggye-ri) can indicate nuclear testing. Render as circle markers with magnitude-based sizing. This is a supplementary awareness layer.

---

## Data Layer Architecture

All data layers follow the same pattern:

```
Browser → useLayerData hook → fetch("/api/{layer}") → Proxy Route → External API
                                                          ↓
                                                    Cache + Error handling
```

### Layer Toggle System

A `LayerControl` component allows users to enable/disable each data layer independently. Layer state is managed in `page.tsx` and persisted to `localStorage`.

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

Each disabled layer stops polling (clears its interval) to conserve bandwidth and API calls.

---

## Allowed Dependencies

Only install these packages. Do not add others without explicit approval:

```
next@16
react@18
react-dom@18
leaflet@1
@types/leaflet
tailwindcss@3
postcss
autoprefixer
typescript@5
eslint@10
@eslint/js
typescript-eslint
@types/react
@types/react-dom
@types/node
prettier
ws
@types/ws
```

### Approved for future phases (install only when implementing that phase):

```
satellite.js           # SGP4 propagator for satellite position calculation (Layer 2)
```

## Testing Approach

- Manual testing via the browser for this MVP
- Type checking via `tsc --noEmit` is the primary automated check
- ESLint catches common issues

## Error Handling

- API proxy routes: return structured JSON errors with appropriate HTTP status codes
- Client polling hooks: catch fetch errors, set an error state, show in StatusBar, continue polling
- Never crash the app on a failed API request — show "Connection lost" in the status bar and retry on the next interval
- Each data layer fails independently — one layer going down should not affect others

## Performance

- The `/v2/mil` endpoint typically returns 200-800 aircraft. This is small enough that no virtualization is needed for markers.
- Use `React.memo` on all marker components to prevent unnecessary re-renders when state hasn't changed.
- Do not store historical positions in this MVP — each poll replaces state entirely.
- Each data layer has independent polling intervals appropriate to its data freshness needs.
- Disabled layers do not poll at all.
