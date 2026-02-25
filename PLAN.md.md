# Overwatch — Layer 6: Humanitarian Context — Claude Code Implementation Prompts

## Overview

This document contains copy-paste-ready prompts for Claude Code to implement the Humanitarian Context layer (Layer 6) in the Overwatch project. The implementation is divided into 5 phases. Each phase ends with documentation updates. Execute them in order.

**Key architectural decision:** Unlike Layers 1–5 which use point markers, the Humanitarian layer renders as **choropleth country shading** and **country-level badge markers**. This requires fetching country boundary GeoJSON and joining it with ReliefWeb crisis data.

---

## Phase 1: Types, API Route, and Data Hook

> Copy everything below the line into Claude Code.

---

```
Read CLAUDE.md and README.md to understand the project conventions, architecture, and file structure. You are implementing Layer 6: Humanitarian Context.

## Context

Overwatch is a real-time military intelligence dashboard (Next.js 16, TypeScript strict, Leaflet 1.9 vanilla, Tailwind CSS 3). It has 5 active layers (aircraft, vessels, satellites, airspace, conflicts). Each layer follows the same architecture pattern:

1. Types file in `src/lib/` defining interfaces
2. API proxy route in `src/app/api/{layer}/route.ts`
3. Custom hook in `src/hooks/`
4. Components (marker/overlay, panel, filter bar)
5. Integration in page.tsx, LayerControl, StatusBar

The Humanitarian layer is DIFFERENT from other layers:
- It does NOT use point markers. It renders as **choropleth country-level polygon shading** on the Leaflet map.
- Data source is the ReliefWeb API (UN OCHA): `https://api.reliefweb.int/v1/`
- No API key required. Only an `appname` query parameter for identification (use `appname=overwatch`).
- Polling interval: 30 minutes (humanitarian data changes slowly).
- Server cache: 30 minutes.

## Task — Create these 3 files:

### File 1: `src/lib/humanitarianTypes.ts`

Create the types file following the exact conventions in `src/lib/conflictTypes.ts` and `src/lib/satelliteTypes.ts` (named exports, `interface` over `type`, no `any`).

Define these interfaces:

**`HumanitarianCrisis`** — the primary data object the frontend works with:
- `id: string` — ReliefWeb disaster ID
- `name: string` — crisis/disaster name (e.g., "Syria: Complex Emergency")
- `status: 'ongoing' | 'past' | 'alert'`
- `glideNumber: string | null` — GLIDE disaster tracking number
- `type: HumanitarianCrisisType` — enum-like union of disaster types
- `country: string` — primary country name
- `countryIso3: string` — ISO 3166-1 alpha-3 code (used for choropleth join)
- `lat: number` — country centroid latitude (for badge placement)
- `lon: number` — country centroid longitude
- `severity: 'critical' | 'major' | 'moderate' | 'minor'` — derived from report count + disaster type
- `disasterCount: number` — active disasters for this country
- `reportCount: number` — situation reports in last 30 days
- `lastReportDate: string | null` — ISO date of most recent report
- `lastReportTitle: string | null` — title of most recent report
- `lastReportUrl: string | null` — link to most recent report on ReliefWeb
- `disasters: HumanitarianDisaster[]` — active disasters in this country
- `updatedAt: string` — ISO timestamp

**`HumanitarianDisaster`** — individual disaster within a country:
- `id: string`
- `name: string`
- `glideNumber: string | null`
- `type: HumanitarianCrisisType`
- `status: 'ongoing' | 'past' | 'alert'`
- `dateStarted: string | null`
- `url: string` — ReliefWeb disaster page URL

**`HumanitarianCrisisType`** — string union:
`'complex-emergency' | 'conflict' | 'drought' | 'earthquake' | 'epidemic' | 'flood' | 'food-insecurity' | 'cyclone' | 'volcano' | 'wildfire' | 'displacement' | 'other'`

**`HumanitarianApiResponse`** — what the proxy route returns:
- `crises: HumanitarianCrisis[]`
- `totalCountries: number`
- `totalDisasters: number`
- `totalReports: number`
- `timestamp: string`
- `partial: boolean` — true if some ReliefWeb endpoints failed

Define these helper functions (exported, pure, no side effects):

**`getSeverityColor(severity: HumanitarianCrisis['severity']): string`**
Returns hex color strings for choropleth shading:
- critical: `'#991b1b'` (deep red, matching mass-violence from conflicts)
- major: `'#dc2626'` (red)
- moderate: `'#f97316'` (orange)
- minor: `'#eab308'` (yellow)

**`getCrisisTypeLabel(type: HumanitarianCrisisType): string`**
Returns human-readable label for each crisis type.

**`getSeverityFromData(reportCount: number, disasterCount: number, types: HumanitarianCrisisType[]): HumanitarianCrisis['severity']`**
Derives severity:
- critical: reportCount >= 50 OR disasterCount >= 3 OR types includes 'complex-emergency'
- major: reportCount >= 20 OR disasterCount >= 2 OR types includes 'conflict'
- moderate: reportCount >= 5
- minor: everything else

**`getCountryCentroid(iso3: string): { lat: number; lon: number } | null`**
A lookup table mapping ISO3 country codes to approximate centroids. Include at least the 60 most commonly crisis-affected countries (Syria, Yemen, Ukraine, Sudan, Somalia, Ethiopia, DRC, Afghanistan, Myanmar, Haiti, etc., plus all countries with ongoing UN humanitarian response plans). Return null for unknown codes.

### File 2: `src/app/api/humanitarian/route.ts`

Create the API proxy route following the exact pattern of `src/app/api/conflicts/route.ts`:
- Named export `GET` function
- Server-side caching (module-level variables: `cachedData`, `cacheTimestamp`, `CACHE_DURATION = 30 * 60 * 1000`)
- Returns `NextResponse.json()` with proper error handling
- On error, return stale cache if available, else structured error JSON with appropriate HTTP status

The route should make 2 parallel requests to ReliefWeb using `Promise.allSettled`:

**Request 1: Active disasters**
```
GET https://api.reliefweb.int/v1/disasters?appname=overwatch&filter[field]=status&filter[value]=ongoing&fields[include][]=name&fields[include][]=glide&fields[include][]=primary_country.iso3&fields[include][]=primary_country.name&fields[include][]=primary_country.location&fields[include][]=type&fields[include][]=status&fields[include][]=date.created&fields[include][]=url&limit=500&sort[]=date.created:desc
```

**Request 2: Recent reports (last 30 days)**
```
GET https://api.reliefweb.int/v1/reports?appname=overwatch&filter[field]=date.created&filter[value][from]=<30_DAYS_AGO_ISO>&fields[include][]=title&fields[include][]=url&fields[include][]=primary_country.iso3&fields[include][]=primary_country.name&fields[include][]=date.created&fields[include][]=disaster.name&limit=1000&sort[]=date.created:desc
```

Processing logic:
1. Group disasters by `primary_country.iso3`
2. Group reports by `primary_country.iso3`, count per country, get latest report per country
3. For each country that has disasters OR reports, create a `HumanitarianCrisis` object:
   - Use `getCountryCentroid()` for lat/lon. Skip countries with no centroid.
   - Use `getSeverityFromData()` to derive severity
   - Attach the country's disasters as `HumanitarianDisaster[]`
4. Return `HumanitarianApiResponse` with the array sorted by severity (critical first) then reportCount descending

If one request fails, set `partial: true` and use whatever data succeeded. If both fail and no cache, return 502.

Important: Follow the code style rules — TypeScript strict, no `any` (use `unknown` and narrow), native `fetch` only, `interface` for object shapes.

### File 3: `src/hooks/useHumanitarianData.ts`

Create the data hook following the exact pattern of `src/hooks/useConflictData.ts`:
- Takes `enabled: boolean` parameter
- Uses `useState` for `crises: HumanitarianCrisis[]`, `loading: boolean`, `error: string | null`
- Also track and return: `totalCountries: number`, `totalDisasters: number`, `partial: boolean`
- Polls `GET /api/humanitarian` every 30 minutes (1800000ms) when enabled
- Clears interval when disabled (disabled layers don't poll — architecture rule 8)
- Preserves previous data on error (continue showing stale data)
- Returns `{ crises, loading, error, totalCountries, totalDisasters, partial }`

## After implementation:

1. Run `npm run type-check` and fix any TypeScript errors.
2. Run `npm run lint` and fix any lint errors.
3. Verify the API route works by running `npm run dev` and curling `http://localhost:3000/api/humanitarian`. Confirm the response contains crisis data with country ISO3 codes.

## Documentation update:

Update `CLAUDE.md` with the following additions:
- In the "Status" section, add "Humanitarian (ReliefWeb)" to the active layers list — but mark it as "(in progress — types, route, and hook complete; UI pending)"
- In the "Layer Toggle System" table, add a row: Humanitarian | `overwatch-humanitarian-layer` | off | 30min
- Add a new "### Humanitarian — ReliefWeb" subsection under "## Data Sources" in the same format as the other data source sections. Include: endpoint URLs, appname param, no auth, 30min server cache, the two requests (disasters + reports), processing logic summary, severity classification, and the `partial: true` degradation behavior.
- In the "Allowed Dependencies" section, confirm no new dependencies were added.

Do NOT update README.md yet — that happens in the final phase.
```

---

## Phase 2: Country Boundary GeoJSON and Choropleth Overlay Component

> Copy everything below the line into Claude Code.

---

```
Read CLAUDE.md and README.md. You are continuing the implementation of Layer 6: Humanitarian Context. Phase 1 (types, API route, hook) is complete.

## Context

The Humanitarian layer renders as **choropleth country shading** — not point markers. We need:
1. A source of country boundary GeoJSON polygons
2. A Leaflet overlay component that joins crisis data to country polygons by ISO3 code and renders colored fills

## Task — Create these 2 files:

### File 1: `src/lib/countryBoundaries.ts`

This file provides a function to fetch and cache simplified world country boundary GeoJSON. 

**Approach:** Fetch a simplified (~1MB) Natural Earth countries GeoJSON from a public CDN at runtime. Do NOT bundle a large GeoJSON file in the repo. Use this URL:

```
https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
```

This is a TopoJSON file. We need to convert it to GeoJSON. However, we cannot add `topojson-client` as a dependency (no new deps without approval). Instead, use this alternative source which serves GeoJSON directly:

```
https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson
```

This is ~23MB and too large. Instead, use this lighter alternative:

```
https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json
```

Actually — to avoid adding a TopoJSON dependency, use this approach instead:

Create a **server-side route** `src/app/api/humanitarian/boundaries/route.ts` that:
1. Fetches `https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json` (simplified country polygons, ~800KB)
2. OR alternatively, fetches from `https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/data/countries-50m.json` 

Actually, the simplest approach that avoids new deps: have the client fetch a well-known lightweight GeoJSON. Use this proven source:

**Final approach — use the API route to serve boundaries:**

Create `src/app/api/humanitarian/boundaries/route.ts`:
- On first request, fetch `https://r2.datahub.io/clvyjaryy0000la0fi7rnm0ft/main/raw/data/countries.geojson` (datahub.io simplified countries, ~1.5MB)
- Cache the response in a module-level variable (it never changes). Cache duration: 24 hours.
- Parse the GeoJSON, and for each Feature, extract the `ISO_A3` property (or `ISO3` — check what field exists) and pass it through.
- Return the GeoJSON with only the geometry and ISO3 code per feature (strip other properties to reduce payload).
- If fetch fails, return 502.

Then in `src/lib/countryBoundaries.ts`, export:

```typescript
export interface CountryFeature {
  type: 'Feature';
  properties: { iso3: string; name: string };
  geometry: GeoJSON.Geometry;  // Use inline type — don't import GeoJSON types
}

export interface CountryBoundaryCollection {
  type: 'FeatureCollection';
  features: CountryFeature[];
}
```

The actual fetching will be done in the hook or overlay component via `/api/humanitarian/boundaries`.

### File 2: `src/components/HumanitarianOverlay.tsx`

Create the choropleth overlay component. This is a `"use client"` component that renders Leaflet polygon layers.

**Props:**
```typescript
interface HumanitarianOverlayProps {
  map: L.Map | null;
  crises: HumanitarianCrisis[];
  visible: boolean;
  onSelectCrisis: (crisis: HumanitarianCrisis | null) => void;
  selectedCrisisId: string | null;
}
```

**Behavior:**

1. On mount (when `map` is available and `visible` is true), fetch `/api/humanitarian/boundaries` once and cache in a `useRef`. This is boundary data that doesn't change.

2. Create a custom Leaflet pane `'humanitarianPane'` with z-index 410 (below airspace at 420, so humanitarian shading sits behind all other layers). Add this pane to the map if it doesn't exist.

3. For each crisis in `crises`, find the matching country boundary feature by ISO3 code. If found, create an `L.geoJSON` layer for that country with:
   - Fill color from `getSeverityColor(crisis.severity)`
   - Fill opacity: critical=0.35, major=0.25, moderate=0.2, minor=0.15
   - Stroke: white, weight 1, opacity 0.6
   - If this crisis is selected (`crisis.id === selectedCrisisId`), increase stroke weight to 3 and opacity to 1.0
   - Pane: `'humanitarianPane'`
   - Click handler: call `onSelectCrisis(crisis)`

4. Also place a small **badge marker** at each crisis's centroid (lat/lon from the crisis object) using `L.divIcon`. The badge should show a small colored circle with the disaster count inside it. Style: 24px circle, white text, background = severity color, border-radius 50%, font-size 11px, font-weight bold, center-aligned. Use the same pane.

5. When `visible` becomes false, remove all layers from the map. When `crises` or `visible` changes, clear old layers and redraw. Use `useEffect` cleanup to remove layers on unmount.

6. Use `React.memo` with a custom comparator that checks: `crises` length, `visible`, `selectedCrisisId`, and a hash of crisis IDs + severities.

**Important conventions from the codebase:**
- Use vanilla Leaflet (not react-leaflet). See how `AirspaceOverlay.tsx` does polygon rendering — follow that pattern.
- `"use client"` directive at top.
- `import L from 'leaflet'` — Leaflet is already a project dependency.
- No viewport filtering needed (country polygons are large and few — typically <40 countries with active crises).
- No zoom gate needed — choropleth shading is useful at all zoom levels.

## After implementation:

1. Run `npm run type-check` and fix any TypeScript errors.
2. Run `npm run lint` and fix any lint errors.
3. Manually test: start `npm run dev`, open browser console, navigate to `/api/humanitarian/boundaries` to verify boundary GeoJSON loads. You don't need to test the visual overlay yet — that happens when we integrate into Map.tsx in Phase 3.

## Documentation update:

Update `CLAUDE.md`:
- Add the boundaries route to the file listing under the `api/` section.
- Under the Humanitarian data source section you created in Phase 1, add a note about the country boundary GeoJSON source, cache duration (24h), and the choropleth rendering approach (pane z-410, severity-based fill colors and opacity).
- Add `HumanitarianOverlay.tsx` to the Components section, noting it uses `L.geoJSON` polygon layers + `L.divIcon` badge markers, similar to `AirspaceOverlay.tsx` but for country-level choropleth shading.
```

---

## Phase 3: Panel, Filter Bar, and Map Integration

> Copy everything below the line into Claude Code.

---

```
Read CLAUDE.md and README.md. You are continuing the implementation of Layer 6: Humanitarian Context. Phase 1 (types, route, hook) and Phase 2 (boundaries, overlay component) are complete.

## Task — Create 2 new files and modify 1 existing file:

### File 1: `src/components/HumanitarianPanel.tsx`

Create the detail panel following the EXACT layout pattern of the other panels (AirspacePanel.tsx is the best reference since it also deals with zone/area data rather than point entities).

**Props:**
```typescript
interface HumanitarianPanelProps {
  crisis: HumanitarianCrisis;
  onClose: () => void;
}
```

**Accent color:** Teal (`bg-teal-500/600/700` variants, `text-teal-400`, `border-teal-500`). This is distinct from all other layers (amber=aircraft, blue=vessels, purple=satellites, orange=airspace, red=conflicts).

**Layout (follows existing panel conventions — right sidebar 320px on desktop ≥768px, bottom sheet 60vh on mobile, absolutely positioned z-[1000], close button top-right):**

1. **Header:** Country name (large), severity badge (colored pill with label: "Critical", "Major", "Moderate", "Minor")
2. **Stats row:** Disaster count, report count in last 30 days — displayed as small stat cards
3. **Active Disasters section:** List each disaster with:
   - Name
   - Type badge (using `getCrisisTypeLabel`)
   - Status badge (ongoing/alert)
   - GLIDE number if present
   - Start date if present
   - Link to ReliefWeb disaster page (external link icon)
4. **Latest Report section (if available):**
   - Report title
   - Date
   - Link to full report on ReliefWeb
5. **Footer:** "Data: UN OCHA / ReliefWeb" attribution text, small and muted

### File 2: `src/components/HumanitarianFilterBar.tsx`

Create the filter bar following the pattern of `ConflictFilterBar.tsx`.

**Props:**
```typescript
interface HumanitarianFilterBarProps {
  crises: HumanitarianCrisis[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  severityFilter: HumanitarianCrisis['severity'] | 'all';
  onSeverityChange: (severity: HumanitarianCrisis['severity'] | 'all') => void;
  typeFilter: HumanitarianCrisisType | 'all';
  onTypeChange: (type: HumanitarianCrisisType | 'all') => void;
}
```

**Accent color:** Teal (matching the panel).

**Filters:**
1. **Search** — text input filtering by country name or disaster name (case-insensitive substring match)
2. **Severity** — dropdown/button group: All, Critical, Major, Moderate, Minor
3. **Crisis Type** — dropdown: All, Complex Emergency, Conflict, Drought, Earthquake, Epidemic, Flood, Food Insecurity, Cyclone, Volcano, Wildfire, Displacement, Other

### File 3: Modify `src/components/Map.tsx`

Integrate the HumanitarianOverlay into the map. Follow the exact pattern used for other overlays. Specifically:

1. Import `HumanitarianOverlay` at the top of the file.
2. Add new props to the Map component:
   - `humanitarianCrises: HumanitarianCrisis[]`
   - `humanitarianVisible: boolean`
   - `selectedHumanitarianCrisis: HumanitarianCrisis | null`
   - `onSelectHumanitarianCrisis: (crisis: HumanitarianCrisis | null) => void`
3. Render `<HumanitarianOverlay>` inside the Map component, passing the map instance ref, crises, visibility, selection state, and selection handler.
4. The humanitarian pane (z-410) is BELOW the airspace pane (z-420), which is below conflicts (z-430), satellites (z-440), vessels (z-450), and aircraft (z-600). This is correct — humanitarian context is the broadest/lowest layer.

Do NOT modify `page.tsx`, `LayerControl.tsx`, or `StatusBar.tsx` yet — that is Phase 4.

## After implementation:

1. Run `npm run type-check` and fix any TypeScript errors.
2. Run `npm run lint` and fix any lint errors.

## Documentation update:

Update `CLAUDE.md`:
- Add HumanitarianPanel to the Panels table with accent=teal and key info description.
- Add HumanitarianFilterBar to the Filter Bars table with accent=teal and filters description.
- Update the Map.tsx component details to note the humanitarian pane at z-410 and the new props.
- Update the Markers section to note that humanitarian uses `L.geoJSON` polygons + `L.divIcon` badge markers (not a traditional marker component).
```

---

## Phase 4: Page Integration (Layer Control, Status Bar, State Management)

> Copy everything below the line into Claude Code.

---

```
Read CLAUDE.md and README.md. You are continuing the implementation of Layer 6: Humanitarian Context. Phases 1-3 are complete (types, route, hook, boundaries, overlay, panel, filter bar, Map.tsx integration).

## Task — Modify 3 existing files:

### File 1: Modify `src/app/page.tsx`

Follow the EXACT pattern used for the conflict layer integration. Add:

1. **State variables:**
   - `humanitarianEnabled: boolean` (default false, hydrate from localStorage key `overwatch-humanitarian-layer`)
   - `selectedHumanitarianCrisis: HumanitarianCrisis | null`
   - `humanitarianSearchQuery: string`
   - `humanitarianSeverityFilter: HumanitarianCrisis['severity'] | 'all'`
   - `humanitarianTypeFilter: HumanitarianCrisisType | 'all'`

2. **Hook call:**
   ```typescript
   const { crises: humanitarianCrises, loading: humanitarianLoading, error: humanitarianError, totalCountries: humanitarianTotalCountries, totalDisasters: humanitarianTotalDisasters, partial: humanitarianPartial } = useHumanitarianData(humanitarianEnabled);
   ```

3. **Filter chain (useMemo):**
   Filter `humanitarianCrises` by search query (country name or disaster name substring match), severity filter, and type filter (check if any disaster in the crisis matches the type). Name it `filteredHumanitarianCrises`.

4. **Mutual exclusivity:** When `selectedHumanitarianCrisis` is set, clear all other selected entities (aircraft, vessel, satellite, airspace zone, conflict event). When any other entity is selected, clear `selectedHumanitarianCrisis`. Follow the existing pattern.

5. **Layer toggle handler:** `handleHumanitarianToggle` — same pattern as other toggles. Persist to localStorage. When disabling, clear selectedHumanitarianCrisis.

6. **Pass props to Map component:** Add the humanitarian props that Map.tsx now expects.

7. **Render HumanitarianFilterBar** when `humanitarianEnabled` is true, below the other filter bars (or conditionally showing only the active layer's filter bar — follow the existing pattern).

8. **Render HumanitarianPanel** when `selectedHumanitarianCrisis` is not null.

### File 2: Modify `src/components/LayerControl.tsx`

Add a Humanitarian row to the layer control panel following the exact pattern of the existing rows:
- Label: "Humanitarian"
- Color accent: teal (teal dot when active, teal text)
- Toggleable (same as vessels, satellites, airspace, conflicts)
- Position: LAST row (below Conflicts)
- Show count when active: "{totalCountries} countries" or similar
- No "API key required" disabled state (no key needed)

**Props to add:**
- `humanitarianEnabled: boolean`
- `onHumanitarianToggle: () => void`
- `humanitarianCount: number` (total countries with active crises)

### File 3: Modify `src/components/StatusBar.tsx`

Add humanitarian count display following the pattern of conflict count:
- Show when humanitarian layer is enabled
- Teal color accent
- Format: "{count} crises" or "{count} countries"
- If `partial` is true, show an amber warning indicator (same pattern as satellite error indicator)

**Props to add:**
- `humanitarianEnabled: boolean`
- `humanitarianCount: number`
- `humanitarianPartial: boolean`

## After implementation:

1. Run `npm run type-check` and fix any TypeScript errors.
2. Run `npm run lint` and fix any lint errors.
3. Run `npm run build` to verify the production build succeeds.
4. Manual test: Run `npm run dev`, open browser, click the Humanitarian toggle in the layer control panel. Verify:
   - Choropleth shading appears on countries with active crises
   - Badge markers show disaster counts at country centroids
   - Clicking a country opens the HumanitarianPanel
   - Filter bar appears and filters work
   - StatusBar shows humanitarian count
   - Toggling off removes all humanitarian layers
   - Selecting a humanitarian crisis clears other selected entities and vice versa

## Documentation update:

Update `CLAUDE.md`:
- In the Status section, change Humanitarian from "(in progress)" to active.
- Update the Page Integration section to include humanitarian state variables, mutual exclusivity with humanitarian, and filter chain.
- Update the LayerControl section to include the Humanitarian row.
- Update the StatusBar section to include humanitarian count (teal).
- Verify all component, hook, and route files are listed in the project structure or file conventions sections.
```

---

## Phase 5: Final Documentation and Cleanup

> Copy everything below the line into Claude Code.

---

```
Read CLAUDE.md and README.md. The Humanitarian Context layer (Layer 6) implementation is complete. This final phase is documentation-only.

## Task — Update both CLAUDE.md and README.md to reflect the completed implementation.

### CLAUDE.md updates:

Do a complete review of CLAUDE.md and ensure ALL of the following are accurate and present:

1. **Status section:** Humanitarian (ReliefWeb) is listed as an active layer.
2. **Layer Toggle System table:** Has a Humanitarian row with toggle key `overwatch-humanitarian-layer`, default off, polling interval 30min.
3. **Data Sources → Humanitarian section:** Complete documentation including:
   - ReliefWeb API base URL, appname param, no auth
   - Both endpoints (disasters + reports) with query parameters
   - Processing: group by country ISO3, severity derivation logic
   - Server cache: 30min, stale fallback on error
   - Country boundaries: source URL, 24h cache, stripped to ISO3 + geometry
   - `partial: true` degradation behavior
4. **Component Details:** HumanitarianOverlay (choropleth + badges, pane z-410), HumanitarianPanel (teal accent), HumanitarianFilterBar (teal accent) are all documented.
5. **Map.tsx section:** Humanitarian pane z-410 is listed in the pane order.
6. **Markers section:** Note that humanitarian uses L.geoJSON polygons + L.divIcon badges (not a traditional marker component).
7. **Panels table:** Humanitarian row with teal accent and key info.
8. **Filter Bars table:** Humanitarian row with teal accent and filters listed.
9. **Page Integration section:** Humanitarian state, mutual exclusivity, filter chain.
10. **StatusBar section:** Humanitarian count (teal) with partial indicator.
11. **LayerControl section:** Humanitarian row (teal, toggleable).
12. **Performance section:** Humanitarian note — ~30-40 country polygons, no viewport filtering needed, boundary GeoJSON cached in ref after first load (~1.5MB one-time fetch).
13. **Error Handling section:** Humanitarian route degradation — `Promise.allSettled` for disasters+reports, stale cache fallback, `partial: true` when one source fails, 502 when both fail and no cache.
14. **Attribution table:** Add ReliefWeb (UN OCHA) | Free, no auth, appname param.
15. **Planned Layers section:** Remove any mention of Humanitarian from planned (it's now active). Keep Seismic (USGS) as planned.

### README.md updates:

1. **"What It Does" section:** The Humanitarian Context paragraph already exists. Review it and ensure it accurately describes the implementation (choropleth shading, country-level badges, ReliefWeb API, crisis types, severity levels, panel with disaster details and report links).

2. **Data Sources section:** The "Layer 6: Humanitarian Context" section already exists but is marked as "Planned". Update:
   - Change status from "Planned" to "Active" in the source table
   - Update the description to reflect actual implementation (not planned)
   - Ensure key endpoints are listed
   - Describe the choropleth rendering approach
   - Add the severity classification logic summary

3. **Project Structure:** Add the new files to the tree:
   - `src/app/api/humanitarian/route.ts`
   - `src/app/api/humanitarian/boundaries/route.ts`
   - `src/components/HumanitarianOverlay.tsx`
   - `src/components/HumanitarianPanel.tsx`
   - `src/components/HumanitarianFilterBar.tsx`
   - `src/hooks/useHumanitarianData.ts`
   - `src/lib/humanitarianTypes.ts`
   Add brief descriptions for each following the existing comment style.

4. **"Humanitarian Context" usage section:** Add a new section under "Conflict Event Tracking" (before Environment Variables) describing how to use the humanitarian layer:
   - No API key needed
   - Toggle in layer control
   - Choropleth shading with severity colors
   - Click country for crisis details
   - Filter by severity, crisis type, or search
   - Data from UN OCHA / ReliefWeb, updated every 30 minutes

5. **Legal section:** Ensure ReliefWeb / UN OCHA is mentioned.

6. **Map attribution:** Note that the Leaflet attribution string should include "Humanitarian data: UN OCHA / ReliefWeb" (if not already updated in Map.tsx, add it now).

### Final verification:

1. Run `npm run type-check` — zero errors.
2. Run `npm run lint` — zero errors.
3. Run `npm run build` — succeeds.
4. Scan both CLAUDE.md and README.md for any remaining "Planned" references to humanitarian data and change them to reflect the active implementation.
5. Ensure the CLAUDE.md "Planned Layers" section only lists Seismic (USGS).
```

---

## Summary of Phases

| Phase | Files Created | Files Modified | Focus |
|-------|--------------|----------------|-------|
| 1 | `humanitarianTypes.ts`, `api/humanitarian/route.ts`, `useHumanitarianData.ts` | `CLAUDE.md` | Data foundation |
| 2 | `api/humanitarian/boundaries/route.ts`, `HumanitarianOverlay.tsx` | `CLAUDE.md` | Choropleth rendering |
| 3 | `HumanitarianPanel.tsx`, `HumanitarianFilterBar.tsx` | `Map.tsx`, `CLAUDE.md` | UI components |
| 4 | *(none)* | `page.tsx`, `LayerControl.tsx`, `StatusBar.tsx`, `CLAUDE.md` | Full integration |
| 5 | *(none)* | `CLAUDE.md`, `README.md`, possibly `Map.tsx` (attribution) | Documentation |

**Total new files:** 7  
**Total modified files:** 6  
**New dependencies:** 0  
