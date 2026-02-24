# PLAN.md — Satellite Tracking Layer Implementation

## Overview

Add a real-time military satellite tracking layer to Overwatch. Satellites are rendered as a third map layer alongside aircraft and vessels. Orbital data is fetched from CelesTrak (free, no auth) as OMM JSON, and positions are computed client-side using the `satellite.js` SGP4 propagator library.

**No API key is required.** CelesTrak provides free, unauthenticated access to GP (General Perturbations) data.

## Architecture

```
CelesTrak (OMM JSON) → /api/satellites (proxy + cache) → useSatelliteData hook → satellite.js (SGP4 client-side) → Map
```

Key design decisions:
- **Server-side proxy** fetches OMM JSON from CelesTrak and caches it aggressively (TLE data updates ~3x/day)
- **Client-side propagation** — the hook receives raw OMM records, then uses `satellite.js` to compute lat/lon/altitude every 30 seconds without re-fetching. TLE data is re-fetched from the proxy every 30 minutes.
- **Two CelesTrak catalogs** are merged: `military` (dedicated military sats) and `gps-ops` (GPS constellation). This gives us reconnaissance, SIGINT, comms, early warning, navigation, and weather satellites.
- **Satellite categories** — satellites are classified by name pattern matching into: Reconnaissance, SIGINT, Communications, Navigation (GPS), Early Warning, Weather, and Other Military.
- **Purple accent color** for the satellite layer (aircraft = amber/green, vessels = blue, satellites = purple) to maintain visual distinction.

## CelesTrak API Details

**Endpoints (no auth):**
- `https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=json` — Military satellites (~200 objects)
- `https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=json` — GPS constellation (~31 objects)

**Response format (OMM JSON array):**
```json
[
  {
    "OBJECT_NAME": "USA 224 (NROL-49)",
    "OBJECT_ID": "2011-002A",
    "EPOCH": "2025-03-26T05:19:34.116960",
    "MEAN_MOTION": 15.00555103,
    "ECCENTRICITY": 0.000583,
    "INCLINATION": 98.3164,
    "RA_OF_ASC_NODE": 103.8411,
    "ARG_OF_PERICENTER": 20.5667,
    "MEAN_ANOMALY": 339.5789,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": 37348,
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 8655,
    "BSTAR": 0.00048021,
    "MEAN_MOTION_DOT": 0.00005995,
    "MEAN_MOTION_DDOT": 0
  }
]
```

**satellite.js usage:**
```typescript
import { json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js';

const satrec = json2satrec(ommRecord);
const now = new Date();
const positionAndVelocity = propagate(satrec, now);
const gmst = gstime(now);
const geodetic = eciToGeodetic(positionAndVelocity.position, gmst);
// geodetic.latitude (radians), geodetic.longitude (radians), geodetic.height (km)
const latDeg = satellite.radiansToDegrees(geodetic.latitude);
const lonDeg = satellite.radiansToDegrees(geodetic.longitude);
```

## Satellite Categories

| Category | Color | Name Patterns | Examples |
|---|---|---|---|
| `reconnaissance` | `#ef4444` (red) | USA (with recon NORAD ranges), KH-, NROL, LACROSSE, ONYX, MISTY, TOPAZ | USA 224, USA 314 |
| `sigint` | `#f97316` (orange) | MENTOR, ORION, TRUMPET, MERCURY, INTRUDER, NEMESIS | USA 202 |
| `communications` | `#3b82f6` (blue) | MUOS, AEHF, MILSTAR, DSCS, WGS, UFO, FLTSATCOM, SDS | MUOS 5, AEHF 6 |
| `navigation` | `#22c55e` (green) | NAVSTAR, GPS, USA (GPS block ranges) | NAVSTAR 79 (USA 309) |
| `early-warning` | `#eab308` (yellow) | SBIRS, DSP, STSS | SBIRS GEO 6 |
| `weather` | `#06b6d4` (cyan) | DMSP, NPOESS, JPSS (military weather) | DMSP 5D-3 F19 |
| `other-military` | `#a855f7` (purple) | Everything else in the military catalog | — |

## Phases

---

## Phase 1 — Types, Utilities, and Dependency

### Prompt

```
We are adding a satellite tracking layer to the Overwatch project (Phase 13). Read CLAUDE.md fully before starting.

IMPORTANT: Do NOT modify any existing files related to aircraft or vessel tracking. This phase only creates new files.

1. Install satellite.js:
   npm install satellite.js

2. Create `src/lib/satelliteTypes.ts` with:

   - Interface `SatelliteOMM` matching the CelesTrak OMM JSON fields:
     OBJECT_NAME (string), OBJECT_ID (string), EPOCH (string), MEAN_MOTION (number), ECCENTRICITY (number), INCLINATION (number), RA_OF_ASC_NODE (number), ARG_OF_PERICENTER (number), MEAN_ANOMALY (number), EPHEMERIS_TYPE (number), CLASSIFICATION_TYPE (string), NORAD_CAT_ID (number), ELEMENT_SET_NO (number), REV_AT_EPOCH (number), BSTAR (number), MEAN_MOTION_DOT (number), MEAN_MOTION_DDOT (number)

   - Interface `SatellitePosition` for a computed satellite state:
     noradId (number), name (string), objectId (string), lat (number), lon (number), altitude (number — in km), velocity (number — km/s magnitude), category (SatelliteCategory), epoch (string), inclination (number), period (number — minutes, computed as 1440/MEAN_MOTION)

   - Type `SatelliteCategory` as a union:
     'reconnaissance' | 'sigint' | 'communications' | 'navigation' | 'early-warning' | 'weather' | 'other-military'

   - Constant `SATELLITE_COLORS: Record<SatelliteCategory, string>`:
     reconnaissance: '#ef4444', sigint: '#f97316', communications: '#3b82f6', navigation: '#22c55e', early-warning: '#eab308', weather: '#06b6d4', other-military: '#a855f7'

   - Constant `SATELLITE_CATEGORY_LABELS: Record<SatelliteCategory, string>`:
     reconnaissance: 'Reconnaissance', sigint: 'SIGINT/ELINT', communications: 'Communications', navigation: 'Navigation (GPS)', early-warning: 'Early Warning', weather: 'Weather', other-military: 'Other Military'

   - Function `getSatelliteCategory(name: string, noradId: number): SatelliteCategory` that classifies by name pattern matching (case-insensitive):
     - navigation: name contains 'NAVSTAR' or 'GPS' (but not 'GPS ') followed by non-letter
     - communications: name contains 'MUOS', 'AEHF', 'MILSTAR', 'DSCS', 'WGS', 'UFO', 'FLTSATCOM', 'SDS', 'TDRS' (note: be careful to not match partial words)
     - early-warning: name contains 'SBIRS', 'DSP', 'STSS'
     - weather: name contains 'DMSP'
     - sigint: name contains 'MENTOR', 'ORION', 'TRUMPET', 'MERCURY', 'INTRUDER', 'NEMESIS', 'PROWLER'
     - reconnaissance: name contains 'LACROSSE', 'ONYX', 'TOPAZ', 'MISTY', 'CRYSTAL', 'NROL'
     - Fallback: 'other-military'

   - Function `formatAltitude(altitudeKm: number): string` — returns formatted altitude:
     - < 2000: `"XXX km (LEO)"`
     - 2000-35000: `"X,XXX km (MEO)"`
     - >= 35000: `"XX,XXX km (GEO)"`

   - Function `formatPeriod(periodMinutes: number): string` — returns `"XX min"` or `"Xh XXm"` for periods > 60 min

   - Function `getOrbitType(periodMinutes: number): string` — returns 'LEO' | 'MEO' | 'GEO' | 'HEO' based on period ranges

3. Create `src/lib/satellitePropagator.ts` with:

   - Import from 'satellite.js': json2satrec, propagate, gstime, eciToGeodetic, radiansToDegrees
   - Import SatelliteOMM, SatellitePosition, getSatelliteCategory from satelliteTypes

   - Function `propagateSatellites(ommRecords: SatelliteOMM[]): SatellitePosition[]`
     - Takes an array of OMM records
     - For each record:
       - Call json2satrec(record) to get a satrec
       - Call propagate(satrec, new Date()) to get ECI position/velocity
       - If position is false/undefined (propagation error), skip this satellite
       - Call gstime(new Date()) for GMST
       - Call eciToGeodetic(position, gmst) to get geodetic coords
       - Convert lat/lon from radians to degrees using radiansToDegrees
       - Compute velocity magnitude: sqrt(vx² + vy² + vz²) from velocity vector
       - Compute period: 1440 / MEAN_MOTION
       - Call getSatelliteCategory(OBJECT_NAME, NORAD_CAT_ID)
       - Return a SatellitePosition object
     - Filter out any satellites where propagation failed
     - This function is pure and called on the client side

4. Run `npm run type-check` and `npm run lint` to verify everything compiles. Fix any issues.
```

---

## Phase 2 — API Proxy Route

### Prompt

```
We are continuing the satellite tracking layer (Phase 13). Read CLAUDE.md fully before starting.

IMPORTANT: Do NOT modify any existing files. Only create the new file below.

Create `src/app/api/satellites/route.ts`:

This is the proxy route that fetches OMM JSON from CelesTrak and serves it to the client.

Requirements:
- Export an async GET handler following Next.js App Router conventions
- Fetch from two CelesTrak endpoints in parallel using Promise.allSettled:
  - `https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=json`
  - `https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=json`
- Each fetch should have a 30-second timeout via AbortController (CelesTrak can be slow)
- Merge the results into a single array, deduplicating by NORAD_CAT_ID (military catalog takes priority if duplicates exist)
- If both fetches fail, return 502 with `{ error: "CelesTrak unavailable", details: string }`
- If one fails and one succeeds, return the successful data with a partial: true flag
- On success, return `{ satellites: SatelliteOMM[], count: number, partial: boolean, timestamp: number }`
- Set `Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600` (cache 30 min, stale OK for 1 hour — TLE data updates only ~3x/day, CelesTrak asks users not to poll more than every 2 hours)
- Validate that each response is a JSON array before merging
- Use native fetch, no axios
- TypeScript strict mode, no `any` types

Run `npm run type-check` and `npm run lint` to verify.
```

---

## Phase 3 — Polling Hook

### Prompt

```
We are continuing the satellite tracking layer (Phase 13). Read CLAUDE.md fully before starting.

IMPORTANT: Do NOT modify any existing files. Only create the new file below.

Create `src/hooks/useSatelliteData.ts`:

This hook manages satellite data fetching and client-side position propagation.

Requirements:
- Accept a single parameter: `enabled: boolean`
- Maintain two pieces of state:
  1. `ommData: SatelliteOMM[]` — the raw OMM records from the API (refreshed every 30 minutes)
  2. `positions: SatellitePosition[]` — the computed positions (re-propagated every 30 seconds)
- Also track: `loading: boolean`, `error: string | null`, `lastUpdated: Date | null`

- **TLE fetch interval: 30 minutes (1800000ms)**
  - Fetch from `/api/satellites`
  - Parse the response JSON, extract the `satellites` array
  - Store in `ommData` state
  - On error, set error state but preserve existing ommData (same pattern as useAircraftData)
  - Clear interval when `enabled` becomes false

- **Propagation interval: 30 seconds (30000ms)**
  - When ommData is non-empty, call `propagateSatellites(ommData)` from satellitePropagator.ts
  - Store result in `positions` state
  - This is a pure client-side computation, no network request
  - Also clear this interval when `enabled` becomes false

- On initial mount (when enabled=true), fetch immediately and propagate immediately after fetch completes
- When `enabled` transitions from true to false: clear both intervals, but preserve last known positions
- When `enabled` transitions from false to true: re-fetch immediately

- Return: `{ satellites: SatellitePosition[], loading, error, lastUpdated, totalCount: number }`
  - `totalCount` is ommData.length (total satellites in catalog)
  - `satellites` is the positions array (propagated positions)

- Use useEffect, useCallback, useRef for intervals, useState for state
- Follow the same defensive patterns as useAircraftData and useVesselData

Run `npm run type-check` and `npm run lint` to verify.
```

---

## Phase 4 — Satellite Marker Component

### Prompt

```
We are continuing the satellite tracking layer (Phase 13). Read CLAUDE.md fully before starting.

IMPORTANT: Do NOT modify any existing files. Only create the new file below.

Create `src/components/SatelliteMarker.tsx`:

A React.memo'd client component that renders a single satellite on the Leaflet map.

Requirements:
- Props: `satellite: SatellitePosition`, `onClick: (sat: SatellitePosition) => void`, `map: L.Map`, `pane: string`
- Use Leaflet L.marker with L.divIcon (same pattern as AircraftMarker and VesselMarker)

- **Icon design:**
  - Small diamond/rhombus shape for all satellites (distinct from aircraft silhouettes and ship shapes)
  - Size: 16×16 for regular satellites, 20×20 for GEO satellites (period > 1400 min)
  - Color determined by `SATELLITE_COLORS[satellite.category]`
  - SVG: a diamond shape (rotated square) with a small dot in the center
  - Thin semi-transparent black stroke for visibility: `stroke="#000" stroke-opacity="0.3" stroke-width="0.5"`
  - The diamond shape clearly distinguishes satellites from the existing aircraft (plane silhouettes) and vessel (ship silhouettes) markers

- **Popup** (on hover/click, same pattern as other markers):
  - Satellite name (bold)
  - Category label (from SATELLITE_CATEGORY_LABELS) with colored badge
  - NORAD ID
  - Altitude (formatted with orbit type)
  - Period
  - Inclination (rounded to 1 decimal + °)

- Custom memo comparator: only re-render if lat, lon, altitude, or category changes

- Create the marker using L.marker and add to the specified pane on mount
- Remove marker on unmount
- Update marker position when lat/lon changes
- Return null (markers managed imperatively via Leaflet, not React DOM)

Run `npm run type-check` and `npm run lint` to verify.
```

---

## Phase 5 — Satellite Detail Panel

### Prompt

```
We are continuing the satellite tracking layer (Phase 13). Read CLAUDE.md fully before starting.

IMPORTANT: Do NOT modify any existing files. Only create the new file below.

Create `src/components/SatellitePanel.tsx`:

A slide-in detail panel for a selected satellite, following the exact same layout and behavior as AircraftPanel and VesselPanel.

Requirements:
- Props: `satellite: SatellitePosition | null`, `signalLost: boolean`, `onClose: () => void`
- When satellite is null, render nothing
- Layout:
  - Right sidebar on desktop (w-80, right-0), bottom sheet on mobile (< 768px: full-width, bottom-0, max-h-[60vh])
  - Dark background (zinc-900), rounded corners, shadow, z-[600]
  - Close button (X) in top-right corner
  - Smooth slide-in animation (same as AircraftPanel)

- **Content sections:**
  1. **Header:** Satellite name (large, bold), NORAD ID subtitle, category badge (colored pill using SATELLITE_COLORS)
  2. **Signal lost indicator** (if signalLost=true): amber warning bar "Signal lost — showing last known position"
  3. **Orbit Info section:**
     - Altitude (formatted with LEO/MEO/GEO/HEO label)
     - Period (formatted)
     - Inclination (XX.X°)
     - Orbit type (LEO/MEO/GEO/HEO)
     - Velocity (X.XX km/s)
  4. **Identification section:**
     - NORAD Catalog ID
     - International Designator (OBJECT_ID)
     - Epoch (formatted date from the OMM EPOCH field)
  5. **Position section:**
     - Latitude (XX.XXXX°)
     - Longitude (XX.XXXX°)
     - Altitude in km

- Purple accent color for section headers and dividers (#a855f7) to match the satellite layer branding
- Same font sizes, spacing, and responsive behavior as VesselPanel

Run `npm run type-check` and `npm run lint` to verify.
```

---

## Phase 6 — Satellite Filter Bar

### Prompt

```
We are continuing the satellite tracking layer (Phase 13). Read CLAUDE.md fully before starting.

IMPORTANT: Do NOT modify any existing files. Only create the new file below.

Create `src/components/SatelliteFilterBar.tsx`:

A filter bar for the satellite layer, following the same pattern as VesselFilterBar.

Requirements:
- Props:
  - categoryFilter: SatelliteCategory | 'all'
  - onCategoryFilterChange: (value: SatelliteCategory | 'all') => void
  - orbitFilter: 'all' | 'leo' | 'meo' | 'geo'
  - onOrbitFilterChange: (value: 'all' | 'leo' | 'meo' | 'geo') => void
  - searchQuery: string
  - onSearchQueryChange: (value: string) => void
  - filteredCount: number
  - totalCount: number

- Dark background (zinc-800), appears below the vessel filter bar (when satellite layer is enabled)
- **Purple accent** (#a855f7) with satellite icon (use a simple ◆ diamond character or inline SVG) + "Satellites" label to distinguish from aircraft/vessel filter bars

- **Filters:**
  1. **Search:** text input matching satellite name or NORAD ID (same pattern as aircraft search), purple focus ring
  2. **Category dropdown:** All types / Reconnaissance / SIGINT/ELINT / Communications / Navigation (GPS) / Early Warning / Weather / Other Military
  3. **Orbit dropdown:** All orbits / LEO (< 2h period) / MEO (2-12h) / GEO (> 12h)

- **Count display:** "Showing X of Y satellites" (hidden on mobile, same as VesselFilterBar)

- Responsive: search input full-width on mobile, dropdowns flex to fill row

Run `npm run type-check` and `npm run lint` to verify.
```

---

## Phase 7 — Map Integration

### Prompt

```
We are continuing the satellite tracking layer (Phase 13). Read CLAUDE.md fully before starting.

In this phase we integrate satellite markers into the existing Map component. We also need to wire up the satellite layer in page.tsx and update LayerControl and StatusBar.

IMPORTANT: Be very careful not to break aircraft or vessel functionality. Only ADD satellite support — do not refactor or change any existing aircraft/vessel logic.

### 1. Update `src/components/Map.tsx`:

- Add a new prop: `satellites: SatellitePosition[]` (import SatellitePosition from satelliteTypes)
- Add a new prop: `onSatelliteClick: (satellite: SatellitePosition) => void`
- Add a new prop: `satelliteLayerEnabled: boolean`
- Create a custom Leaflet pane for satellites: `map.createPane('satellites')` with z-index 440 (below vessels at 450, above tile layer)
- When satelliteLayerEnabled is true and satellites array is non-empty:
  - Render SatelliteMarker for each satellite in the array
  - Use the same viewport filtering pattern as vessels: only render satellites within the current map bounds
  - Apply a zoom gate: only render satellite markers at zoom >= 3 (satellites are global, visible at wider zoom than vessels)
- Add CelesTrak to the attribution string: append ` | Satellite data: CelesTrak`
- Do NOT change any aircraft or vessel rendering logic

### 2. Update `src/app/page.tsx`:

- Import useSatelliteData, SatellitePosition, SatelliteCategory, SatelliteFilterBar, SatellitePanel
- Add satellite layer state:
  - `satelliteEnabled` boolean, hydrated from localStorage key `'overwatch-satellite-layer'` (same pattern as vessel toggle)
  - `selectedSatellite: SatellitePosition | null`
  - `satelliteSignalLost: boolean`
  - Satellite filter state: `satCategoryFilter`, `satOrbitFilter`, `satSearchQuery`
- Call `useSatelliteData(satelliteEnabled)`
- Implement satellite filtering via useMemo (same pattern as vessel filtering):
  - Search: match name or noradId.toString() against satSearchQuery (case-insensitive)
  - Category: filter by satellite.category if satCategoryFilter !== 'all'
  - Orbit: filter by period ranges if satOrbitFilter !== 'all' (leo: period < 128, meo: 128-720, geo: > 720)
- Selection logic:
  - `onSatelliteClick`: set selectedSatellite, clear selectedAircraft and selectedVessel (mutual exclusivity)
  - On each propagation cycle, update selectedSatellite by matching noradId (same as aircraft hex match pattern)
  - If selected satellite disappears from positions array, set satelliteSignalLost = true
- Pass satellite data and handlers to MapWrapper/Map
- Render SatelliteFilterBar when satelliteEnabled is true (below VesselFilterBar if vessel layer also enabled)
- Render SatellitePanel when selectedSatellite is not null
- When satellite layer is toggled off: clear selection, clear filters

### 3. Update `src/components/LayerControl.tsx`:

- Add new props: `satelliteEnabled: boolean`, `onSatelliteToggle: () => void`, `satelliteCount: number`, `satelliteTotalCount?: number`
- Add a satellite row below the vessel row:
  - Diamond icon (◆), "Satellites (count)" or "Satellites (filtered of total)" label
  - Toggle switch (purple accent when enabled)
  - Status dot: green when data loaded, yellow when loading, gray when off
  - Layer always available (no API key needed), never shows "API key required"
- Persist satellite toggle to localStorage key `'overwatch-satellite-layer'`

### 4. Update `src/components/StatusBar.tsx`:

- Add new props: `satelliteCount?: number`, `satelliteEnabled?: boolean`
- When satellite layer is enabled, show satellite count: "X satellites" alongside existing aircraft/vessel counts

### 5. Update `src/components/MapWrapper.tsx`:

- Pass through the new satellite-related props to Map

Run `npm run type-check`, `npm run lint`, and `npm run dev` to verify everything works. Open the browser, enable the satellite layer via the toggle, and confirm:
- Satellite markers appear on the map as colored diamonds
- Clicking a satellite opens the detail panel
- Filters work correctly
- Toggling the layer on/off works
- Aircraft and vessel functionality is completely unaffected
```

---

## Phase 8 — Polish and Documentation

### Prompt

```
We are finishing the satellite tracking layer (Phase 13). Read CLAUDE.md fully before starting.

IMPORTANT: Do not break aircraft or vessel functionality.

### 1. Visual polish in Map.tsx:

- Ensure satellite markers at GEO altitude (period > 1400 min) are slightly larger and have a subtle glow/ring effect to indicate they're geostationary
- Ensure the satellite pane z-index (440) doesn't cause satellites to render on top of aircraft or vessel markers

### 2. Error and empty states in page.tsx:

- If satellite layer is enabled but loading: no special overlay needed (satellites load quickly, just show the count incrementing in StatusBar)
- If satellite layer is enabled but error: show a subtle amber text note in StatusBar like "Satellite data unavailable" (do NOT show a full-screen overlay — satellites are a secondary layer)
- If satellite layer is enabled but 0 satellites after loading: show count as 0 in LayerControl (this would be unusual and likely indicates a CelesTrak outage)

### 3. Update CLAUDE.md:

Add Phase 13 to the implementation status section. Document all new files:
- `src/lib/satelliteTypes.ts` — Done — SatelliteOMM, SatellitePosition, SatelliteCategory interfaces; getSatelliteCategory(), formatAltitude(), formatPeriod(), getOrbitType(), SATELLITE_COLORS, SATELLITE_CATEGORY_LABELS
- `src/lib/satellitePropagator.ts` — Done — propagateSatellites() using satellite.js SGP4
- `src/app/api/satellites/route.ts` — Done — Proxy to CelesTrak GP endpoints, 30-min cache, merges military + GPS catalogs
- `src/hooks/useSatelliteData.ts` — Done — TLE fetch (30min) + client-side propagation (30s), toggleable
- `src/components/SatelliteMarker.tsx` — Done — Diamond icon markers, category-colored, memo'd
- `src/components/SatellitePanel.tsx` — Done — Slide-in detail panel, orbit info, purple accent
- `src/components/SatelliteFilterBar.tsx` — Done — Category, orbit type, search filters, purple accent

Update the planned files table (remove satellite entries, they're now implemented).

Add satellite.js to the allowed dependencies list.

Update the attribution section to include CelesTrak.

Add a "Satellite Tracking" subsection to the Key Technical Details with:
- CelesTrak endpoints and response format
- satellite.js propagation pipeline (json2satrec → propagate → eciToGeodetic)
- Polling intervals (TLE refresh: 30 min, position propagation: 30s)
- Category classification logic
- Note that CelesTrak updates data ~3x/day and asks users to not poll more than every 2 hours

Update the LayerControl section to include the satellite row.

### 4. Update README.md:

Add a "Satellite Tracking" section under "Running Locally" explaining:
- No API key needed — satellite tracking works out of the box
- Click the "Satellites" toggle in the layer control panel
- Satellites appear as colored diamond markers
- Categories include reconnaissance, SIGINT, comms, navigation (GPS), early warning, weather
- Position data is computed client-side from orbital elements (TLEs) using the SGP4 algorithm
- Data source: CelesTrak (free, no auth)
- Update the data sources table to mark Layer 3 as Active

### 5. Final verification:

Run `npm run type-check`, `npm run lint`, and `npm run build` to ensure everything compiles cleanly for production. Then run `npm run dev` and verify:
- Aircraft layer still works perfectly
- Vessel layer still works perfectly (if API key configured)
- Satellite layer toggle appears in LayerControl
- Enabling satellites shows diamond markers globally
- Satellite detail panel opens on click
- Filters work correctly
- StatusBar shows satellite count when layer is enabled
- No console errors or TypeScript warnings
```

---

## File Summary

| File | Phase | Description |
|---|---|---|
| `src/lib/satelliteTypes.ts` | 1 | Interfaces, categories, colors, classification, formatting |
| `src/lib/satellitePropagator.ts` | 1 | SGP4 propagation wrapper using satellite.js |
| `src/app/api/satellites/route.ts` | 2 | CelesTrak proxy with caching and deduplication |
| `src/hooks/useSatelliteData.ts` | 3 | Dual-interval hook (TLE fetch + propagation) |
| `src/components/SatelliteMarker.tsx` | 4 | Diamond-shaped map markers |
| `src/components/SatellitePanel.tsx` | 5 | Slide-in detail panel |
| `src/components/SatelliteFilterBar.tsx` | 6 | Category, orbit, search filters |
| `src/components/Map.tsx` | 7 | Modified — satellite pane + marker rendering |
| `src/components/MapWrapper.tsx` | 7 | Modified — pass-through satellite props |
| `src/components/LayerControl.tsx` | 7 | Modified — satellite toggle row |
| `src/components/StatusBar.tsx` | 7 | Modified — satellite count display |
| `src/app/page.tsx` | 7 | Modified — satellite state, selection, filtering |
| `CLAUDE.md` | 8 | Updated documentation |
| `README.md` | 8 | Updated documentation |

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `satellite.js` | latest (^5.x or ^6.x) | SGP4/SDP4 orbital propagation, OMM parsing, coordinate transforms |

**No API keys required.** CelesTrak is completely free and unauthenticated.
