# CLAUDE.md — Overwatch

Real-time military movement intelligence dashboard. Next.js 16 App Router, TypeScript strict, Tailwind CSS 3, Leaflet 1.9 (vanilla, not react-leaflet).

## Status

**Active layers:** Aircraft (ADSB.lol), Vessels (aisstream.io), Satellites (CelesTrak), Airspace (FAA ArcGIS + FAA TFR API), Conflicts (GDELT)
**Planned layers:** Seismic (USGS)

All phases complete. Every file listed in the project structure below is implemented and working.

## Commands

```bash
npm run dev          # Dev server :3000
npm run build        # Production build
npm run lint         # ESLint (flat config, `eslint src/`)
npm run type-check   # tsc --noEmit
```

## Architecture Rules

1. **App Router only.** All routes in `src/app/`. No Pages Router.
2. **Server Components by default.** `"use client"` only for browser APIs/hooks/events.
3. **Leaflet: dynamic import with `{ ssr: false }`** via `next/dynamic`. Never import `Map.tsx` directly from a server component — use `MapWrapper.tsx`.
4. **API proxy pattern.** Client never calls external APIs directly. All data flows through `src/app/api/{layer}/route.ts` proxy routes with caching + error handling.
5. **API keys are server-side only.** Never prefix with `NEXT_PUBLIC_`. Currently only `AISSTREAM_API_KEY` required (vessel layer).
6. **One proxy route per data source.** Each external API gets its own route handler.
7. **Independent layers.** Each layer has its own hook, route, and components. One layer failing doesn't affect others.
8. **Disabled layers don't poll.** Toggling off clears the interval to conserve bandwidth.

## Code Style

- TypeScript strict. No `any` — use `unknown` and narrow.
- `interface` over `type` for object shapes. Named exports over default (except Next.js page/layout).
- `const` arrow functions for components.
- Native `fetch` only — no axios.
- Tailwind utility classes only — no CSS modules, no styled-components.
- `React.memo` on all marker components with custom comparators.

## File Conventions

- Components: `src/components/PascalCase.tsx`
- Hooks: `src/hooks/useCamelCase.ts`
- Lib/utils: `src/lib/camelCase.ts`
- API routes: `src/app/api/{resource}/route.ts`
- Types: one type file per data layer in `src/lib/`

## Data Layer Architecture

All layers follow the same pattern:

```
Browser → useLayerData(enabled) → fetch("/api/{layer}") → Proxy Route → External API
                                                              ↓
                                                        Cache + Error handling
```

**Variations:**
- Vessels: proxy reads from server-side WebSocket singleton (`aisStreamManager`) instead of HTTP
- Satellites: server fetches/caches TLE data, client does SGP4 position propagation every 30s

### Layer Toggle System

Managed in `page.tsx`, persisted to `localStorage`. Aircraft always on; vessels/satellites/future layers toggleable.

| Layer | Toggle Key | Default | Polling Interval |
|---|---|---|---|
| Aircraft | *(always on)* | on | 10s |
| Vessels | `overwatch-vessel-layer` | off | 15s |
| Satellites | `overwatch-satellite-layer` | off | TLE: 30min, positions: 30s |
| Airspace | `overwatch-airspace-layer` | off | 5min |
| Conflicts | `overwatch-conflict-layer` | off | 10min |

## Data Sources

### Aircraft — ADSB.lol

- **Endpoint:** `GET {baseUrl}/v2/mil` → `{ ac: AircraftState[], msg, now, total, ctime, ptime }`
- **Military flag:** `(dbFlags & 1) !== 0`
- **No auth.** No enforced rate limit. Poll every 10s. Fallback: `https://api.adsb.one`
- **Key fields:** `hex` (ICAO addr), `flight` (callsign), `lat`/`lon`, `alt_baro`, `gs`, `track`, `t` (type code), `r` (reg), `dbFlags`, `squawk`, `seen`, `seen_pos`

**Icon system:** 8 categories (fighter, tanker-transport, helicopter, surveillance, trainer, bomber, uav, unknown) mapped from ICAO type code via `getAircraftCategory()`. 90+ type codes with exact + prefix matching. SVG silhouettes from ADS-B Radar. Altitude-based coloring: green (ground), blue (<10k ft), red (≥10k ft). Sizes 30–44px.

**Country lookup:** ICAO hex → country via 170+ ranges in `countryLookup.ts`. Flag emoji via Unicode Regional Indicator Symbols.

### Vessels — aisstream.io

- **WebSocket:** `wss://stream.aisstream.io/v0/stream` (server-side only, `ws` package)
- **Auth:** API key in subscription message. Key in `AISSTREAM_API_KEY` env var.
- **Message types:** `PositionReport` (lat/lon/cog/sog/heading), `ShipStaticData` (type/dest/name)
- **Military ID:** AIS type 35 (military) + type 55 (law enforcement) + name patterns (USS/HMS/USCG) + MMSI prefix 3669 (US federal)
- **Coverage:** Terrestrial AIS only (~200km from coast). Open ocean has gaps.
- **Singleton manager** (`aisStreamManager.ts`): one WebSocket serves all clients, auto-reconnect with backoff, staleness cleanup every 60s (removes >10min old)

**Categories (9):** military (red), cargo (blue), tanker (orange), passenger (green), fishing (purple), tug (yellow), highspeed (cyan), pleasure (pink), other (gray).

### Satellites — CelesTrak + satellite.js

- **Endpoint:** `https://celestrak.org/NORAD/elements/gp.php?FORMAT=json&GROUP={group}`
- **10 catalog groups:** military, gps-ops, glo-ops, beidou, galileo, sbas, nnss, musson, tdrss, geo
- **GEO filtered** to military-relevant names (regex). Deduped by `NORAD_CAT_ID`. ~300-400 satellites.
- **No auth.** CelesTrak updates ~3x/day. Server cache: 30min. Don't poll more than every 2hr per their policy.
- **SGP4 pipeline (client):** `json2satrec()` → `propagate(satrec, now)` → `eciToGeodetic(posECI, gmst)` → radians→degrees
- **Invalid propagations silently skipped.**

**Categories (8):** reconnaissance (red), sigint (orange), communications (blue), navigation (green), early-warning (yellow), weather (cyan), foreign-military (purple), other-military (light purple). Classification: NORAD ID lookup (80+ known) → name pattern → default `other-military`.

**Markers:** Diamond SVG. GEO: 20px with glow ring. LEO/MEO: 16px. Pane z-440. Zoom gate ≥ 3.

### Airspace — FAA ArcGIS + FAA TFR API

Two sub-sources merged into one layer:

**SUA (Special Use Airspace) — ArcGIS Feature Service:**
- **Endpoint:** `https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0/query`
- **Types:** R (Restricted), P (Prohibited), MOA, W (Warning), A (Alert). No class B/C/D/E.
- **Fields:** `NAME, TYPE_CODE, UPPER_VAL, UPPER_UOM, UPPER_CODE, LOWER_VAL, LOWER_UOM, LOWER_CODE, STATE, COUNTRY, TIMESOFUSE`
- **No auth.** ~1534 features. Server cache: 24h (data changes every 28 days on FAA NASR cycle).

**TFR (Temporary Flight Restrictions) — FAA JSON + GeoServer:**
- **List API:** `https://tfr.faa.gov/tfrapi/getTfrList` → JSON array of active TFRs with type, description, state
- **Geometry:** `https://tfr.faa.gov/geoserver/TFR/ows` (WFS) → GeoJSON polygons for all active TFRs
- **Joined by NOTAM ID:** List metadata enriches GeoServer geometry features.
- **No auth.** ~70 active TFRs. Server cache: 5min.

**SUA types (6):** restricted (orange `#f97316`), prohibited (red `#ef4444`), moa (yellow `#eab308`), warning (purple `#8b5cf6`), alert (cyan `#06b6d4`), tfr (red `#dc2626`).

**TFR sub-types (7):** vip, security, hazard, space, event, national-defense, other. Classified from FAA API `type` field.

**Rendering:** GeoJSON polygons via `L.polygon()`. Pane z-420 (below satellites). Zoom gate ≥ 4. TFRs use dashed stroke (`dashArray: '8 4'`). Inactive "BY NOTAM" SUA zones render stroke-only (no fill). Opacity decreases with severity: TFR/Prohibited most opaque → Alert least opaque. Viewport filtered.

**Active vs inactive:** `isZoneActive()` checks SUA schedule ("CONT" = active, "BY NOTAM" = inactive) and TFR effective time window. Default filter shows active-only (~330 zones); toggling off shows all ~1600 with inactive zones as outlines.

### Conflicts — GDELT (Dual-Fetch: GEO v2 + Events Export)

Two data sources merged per poll cycle:

**Source 1 — GEO v2 (primary geolocation):**
- **Endpoint:** `http://api.gdeltproject.org/api/v2/geo/geo?query=military+conflict&mode=PointData&format=GeoJSON&timespan=24h&maxpoints=500`
- **No auth.** GeoJSON FeatureCollection with Point features. Server cache: 10min.
- **Key fields:** `name` (headline), `url`, `domain`, `tone`, `goldsteinscale`, `sharingimage`, `numArticles`.
- **Processing:** HTML anchor tag parsing, deduplication by ID, rejects [0,0] and ERROR-prefixed names.

**Source 2 — Events Export (structured enrichment):**
- **Discovery:** `http://data.gdeltproject.org/gdeltv2/lastupdate.txt` → latest `.export.CSV.zip` URL.
- **Format:** Tab-separated CSV in zip. Columns include GlobalEventID, Actor1/2 names+types+countries, EventCode, EventRootCode, QuadClass, GoldsteinScale, NumMentions, NumSources, NumArticles, AvgTone, ActionGeo_Lat/Long/Type, DATEADDED, SOURCEURL.
- **Filtering:** Only CAMEO root codes 17-20 (conflict events). Valid ActionGeo coordinates only.
- **Server cache:** 15min (matches GDELT 15-min export cycle). Accumulated events store: module-level Map keyed by GlobalEventID, 24h TTL per event, pruned on each fetch.
- **Zip parsing:** Manual zip local file header parsing with built-in `node:zlib` `inflateRaw()`. No external deps.

**Merge strategy:** GEO v2 events are primary (reliable geolocation). For each, find nearest Events Export record within 0.5 degrees (~55km) by Manhattan distance. Matched events get enrichment (actors, CAMEO code, Goldstein, quad class, geo precision). Unmatched GEO v2 events keep keyword-based classification with `isEnriched: false`. Unmatched Export events with valid coordinates added as standalone enriched events.

**Enrichment fields on `ConflictEventEnriched`:** `actor1`/`actor2` (name, countryCode, type, label), `cameoCode`, `cameoRootCode`, `cameoDescription`, `quadClass` (verbal/material conflict/cooperation), `geoPrecision` (country/state/city/landmark), `eventDate`, `numSources`, `numMentions`, `isEnriched`.

**CAMEO codes (conflict-relevant):** 17x=Coerce, 18x=Assault, 19x=Fight, 20x=Mass Violence. Sub-codes (e.g., 195=Employ aerial weapons) mapped via `getCameoDescription()`.

**Actor types:** GOV=government, MIL=military, REB=rebel, OPP=opposition, COP=police, SPY=intelligence, CVL=civilian, MED=media, IGO=igo, NGO=ngo.

**Categories (5):** coerce (orange `#f97316`), assault (red `#ef4444`), fight (dark red `#dc2626`), mass-violence (deep red `#991b1b`), other (amber `#f59e0b`). Enriched events use CAMEO root code directly; unenriched fall back to keyword regex.

**Markers:** 6-pointed starburst SVG with white center dot. Enriched events get thin white outer ring. Size by source count: >=10 sources → 22px, >=5 → 20px, default 18px, selected 24px. Category-colored fill, black stroke. Pane z-430. Zoom gate >= 3.

## Component Details

### Map.tsx

Client component. Vanilla Leaflet (`L.map` + `L.tileLayer`). OSM tiles. Custom panes: airspace (z-420), conflicts (z-430), satellites (z-440), vessels (z-450), aircraft (z-600 default marker pane). Viewport filtering via `moveend`/`zoomend` for vessels, satellites, airspace zones, and conflicts. Zoom gates: airspace ≥ 4, conflicts ≥ 3, vessels ≥ 4, satellites ≥ 3.

Attribution: `© OpenStreetMap contributors | Data: ADSB.lol (ODbL) | Icons: ADS-B Radar | Vessel data: aisstream.io | Satellite data: CelesTrak`

### Markers

All are `React.memo`'d with custom comparators.

| Marker | Size | Rotation | Key Comparator Fields |
|---|---|---|---|
| AircraftMarker | 30-44px by category | `track` | *(default memo)* |
| VesselMarker | 28px military / 20px civilian | `heading` (fallback `cog`) | lat, lon, heading, cog, sog, lastUpdate |
| SatelliteMarker | 20px GEO / 16px LEO/MEO | none | lat, lon, altitude, category |
| ConflictMarker | 18-22px / 24px selected | none | lat, lon, category, name, isEnriched, numSources, isSelected |

### Panels

All use identical slide-in layout: right sidebar (320px) on desktop ≥768px, bottom sheet (60vh) on mobile. Absolutely positioned at `z-[1000]`. Close button top-right. "Signal lost" red badge with pulse when entity disappears.

| Panel | Accent | Key Info |
|---|---|---|
| AircraftPanel | amber | callsign, hex, reg, type, altitude, speed, heading, squawk, country flag, category badge |
| VesselPanel | blue | name, MMSI, flag, military category, type, speed, course, heading, destination |
| SatellitePanel | purple | name, NORAD ID, category, altitude, period, inclination, orbit type, velocity, intl designator, epoch |
| AirspacePanel | orange | name, type badge, TFR sub-type, active status, altitude range, schedule/effective period, state, description, source |
| ConflictPanel | red | event name, category badge, enrichment indicator, actors (type badges + names + countries), CAMEO code + description, quad class badge, source link, tone, goldstein scale (with bar for enriched), article count, sources/mentions, geo precision, location, timestamp, event date |

### Filter Bars

Each layer has its own filter bar below StatusBar when active. Different accent colors for visual distinction.

| FilterBar | Accent | Filters |
|---|---|---|
| FilterBar (aircraft) | default | search (callsign/reg/hex/type), altitude band, category, country, speed |
| VesselFilterBar | blue | country, category, speed, destination search |
| SatelliteFilterBar | purple | search (name/NORAD ID), category, orbit type |
| AirspaceFilterBar | orange | type, TFR sub-type, active-only toggle |
| ConflictFilterBar | red | search (name/domain), category, timeframe (24h/6h/1h), verified/enriched toggle, actor type (multi-select: Military/Government/Rebel/Civilian/Police/Other), quad class (All/Material/Verbal) |

### Page Integration (page.tsx)

- All layer states + filters as component state
- Layer toggles hydrated from `localStorage` after mount (avoids SSR mismatch)
- **Mutual exclusivity:** only one detail panel open at a time
- Independent `useMemo` filter chains per layer
- Loading overlay, error banner, empty state — all for aircraft layer (core)

### StatusBar

Fixed top. Dark zinc-900. Shows: brand, total/tracked aircraft count, vessel count (blue, when active), satellite count (purple, when active), satellite error (amber), airspace zone count (orange, when active), conflict count (red, when active) with enrichment ratio (green, when >0 enriched), last updated time, connection status dot.

### LayerControl

Floating bottom-left, z-800, backdrop blur. Aircraft row (always on, green dot), vessel row (toggleable, blue), satellite row (toggleable, purple), airspace row (toggleable, orange), conflict row (toggleable, red). Disabled state for missing API key (vessels only).

## Planned Layers

### Seismic (USGS)
- `https://earthquake.usgs.gov/fdsnws/event/1/` — GeoJSON. No auth. Circle markers with magnitude sizing.

## Performance

- Aircraft: 200-800 markers, no virtualization needed
- Vessels: viewport filtered, zoom gate ≥ 4, supports 2000+ concurrent
- Satellites: viewport filtered, zoom gate ≥ 3, client-side SGP4 (no server round-trip between TLE fetches)
- Airspace: viewport filtered, zoom gate ≥ 4, ~330 active zones (up to ~1600 with inactive). Polygon overlays via `L.polygon()`.
- Conflicts: viewport filtered, zoom gate ≥ 3, ~500 max events (GDELT maxpoints cap). Static markers, no animation overhead.
- All markers `React.memo`'d. No historical positions stored — each poll replaces state entirely.

## Error Handling

- Proxy routes: structured JSON errors with HTTP status codes
- Hooks: catch errors, set error state, preserve previous data, continue polling
- Never crash on failed request — "Connection lost" in StatusBar, retry next interval
- Vessel layer degrades gracefully if no API key (shows "API key required")
- AIS WebSocket: auto-reconnect with exponential backoff (5s × 10, then 60s reset)
- Satellite route: `partial: true` flag when some catalogs fail
- Airspace route: `partial: true` when one source (SUA or TFR) fails; both use `Promise.allSettled`
- Conflict route: dual-fetch degradation. GEO v2 failure uses stale cache; Events Export failure returns GEO-only events with `isEnriched: false`. Zip decompression failure same degradation. TSV parse errors skip individual rows. Both set `partial: true`. Empty export is not an error — uses accumulated events.

## Allowed Dependencies

```
next@16  react@18  react-dom@18  leaflet@1  @types/leaflet
tailwindcss@3  postcss  autoprefixer  typescript@5
eslint@10  @eslint/js  typescript-eslint
@types/react  @types/react-dom  @types/node  prettier
ws  @types/ws  satellite.js
```

Do not add others without explicit approval.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | No (default: `https://api.adsb.lol`) | Upstream ADS-B API |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | No (default: `10000`) | Aircraft poll interval |
| `NEXT_PUBLIC_DEFAULT_LAT` | No (default: `38.9`) | Map center lat |
| `NEXT_PUBLIC_DEFAULT_LNG` | No (default: `-77.0`) | Map center lng |
| `NEXT_PUBLIC_DEFAULT_ZOOM` | No (default: `5`) | Map zoom |
| `AISSTREAM_API_KEY` | No | aisstream.io key (server-side only) |

## Attribution

| Resource | License |
|---|---|
| OpenStreetMap | ODbL |
| ADSB.lol | ODbL |
| ADS-B Radar (icons) | Free with attribution |
| tar1090 (hex→country) | MIT |
| aisstream.io | Free API key |
| CelesTrak | Free, no auth |
| FAA ArcGIS (SUA) | Free, no auth |
| FAA TFR API/GeoServer | Free, no auth |
| GDELT Project | Free, no auth |
