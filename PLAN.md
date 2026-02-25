# PLAN.md — Conflict Events Layer (GDELT)

Implementation plan for adding the GDELT conflict events layer to Overwatch. This layer displays real-time global military/conflict events as markers on the map, sourced from the GDELT Project's GEO 2.0 API. It follows the established data layer architecture: independent proxy route, polling hook, marker component, detail panel, filter bar, and page-level integration.

## Overview

**Data Source:** GDELT Project GEO 2.0 API  
**Endpoint:** `https://api.gdeltproject.org/api/v2/geo/geo?query=military&mode=pointdata&format=geojson&timespan=24h`  
**Auth:** None required  
**Filtering:** CAMEO codes 17–20 (coerce, assault, fight, mass violence) when available; keyword-based via query param as primary filter  
**Polling Interval:** 10 minutes (GDELT updates approximately every 15 minutes; 10 min ensures we catch each update within one cycle without redundant fetches)  
**Server Cache:** 10 minutes (matches polling interval)  
**Toggle Key:** `overwatch-conflict-layer`  
**Default State:** Off  
**Accent Color:** Red (`#ef4444` / Tailwind `red-500`)  
**Map Pane:** `conflictPane` at z-index 430 (between airspace at 420 and satellites at 440)  
**Zoom Gate:** ≥ 3  

### Why GDELT

GDELT (Global Database of Events, Language, and Tone) monitors news media worldwide in real time and geocodes events. The GEO 2.0 API returns pre-geocoded event data as standard GeoJSON FeatureCollections, making it straightforward to overlay on Leaflet. No API key, no rate limit enforcement, and the keyword query parameter lets us scope to military/conflict events server-side before the data even reaches the client.

### Marker Design: Static Crosshair

Conflict markers use a **static crosshair icon** — a small filled center dot with four short radiating lines. This was chosen because:

- **Visually distinct** from every other layer: aircraft use silhouettes, vessels use ship shapes, satellites use diamonds, and airspace uses polygon fills. A crosshair reads immediately as "event/incident."
- **No animation** — zero GPU overhead. Hundreds of markers render the same as one. No pulsing, no CSS keyframes, no repaints.
- **Simple SVG** — a handful of `<line>` elements and one `<circle>`, inlined in a `L.divIcon`. Tiny DOM footprint per marker.
- **Category color only** — the crosshair fill/stroke color encodes the conflict category. No additional visual complexity.
- **Two sizes only:** 16px default, 20px selected. Compact enough to not crowd the map at global zoom levels.

---

## Phase 1: Types + API Proxy Route

**Goal:** Define all TypeScript interfaces for conflict event data, the classification/color system, and create the server-side API proxy route with caching, deduplication, and error handling.

### What This Phase Produces
- `src/lib/conflictTypes.ts` — All conflict-layer type definitions, category classification, color mapping, label helpers
- `src/app/api/conflicts/route.ts` — Server-side proxy route that fetches GDELT, caches, deduplicates, normalizes, and returns typed JSON

### GDELT GEO 2.0 Response Shape

The endpoint returns a GeoJSON FeatureCollection. Each Feature looks roughly like:

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [-77.0, 38.9] },
  "properties": {
    "name": "Event headline/description",
    "url": "https://source-article.com/...",
    "domain": "source-article.com",
    "sharingimage": "https://...",
    "tone": "-3.5,2.1,..."  
  }
}
```

Key notes:
- Coordinates are `[lon, lat]` (GeoJSON standard, reversed from Leaflet's `[lat, lon]`)
- `tone` is a comma-separated string; the first value is the average tone score (negative = negative sentiment)
- `goldsteinscale` may **not** be present in GEO v2 (it exists in the Events API but not necessarily in the GEO endpoint). The route must handle its absence gracefully — make it optional and derive severity from tone if missing.
- CAMEO codes may not be directly present in GEO v2 responses. The keyword query (`military+conflict`) is the primary filtering mechanism. If `EventCode` or similar CAMEO fields are present, apply secondary filtering to codes 17–20.

### Claude Code Prompt — Phase 1

```
Read CLAUDE.md for project conventions. Then implement Phase 1 of the GDELT conflict layer.

## File 1: src/lib/conflictTypes.ts

Create this file with ALL of the following. Use `interface` for object shapes, named exports only, no `any`.

### Interfaces

`ConflictEvent`:
- id: string — deterministic unique ID (hash of coordinates + name + dateAdded)
- lat: number
- lon: number
- name: string — event description/headline from GDELT
- url: string — source article URL
- domain: string — source domain (e.g. "reuters.com")
- sharingImage: string — thumbnail URL from GDELT (may be empty)
- dateAdded: string — ISO datetime string
- tone: number — average tone score (first value from GDELT's comma-separated tone field; negative = negative sentiment, typically -10 to +10)
- goldsteinScale: number | null — Goldstein conflict-cooperation scale (-10 to +10, null if not available in response)
- numArticles: number — number of source articles mentioning this event
- category: ConflictCategory

`ConflictFilters`:
- search: string — filters on event name and source domain
- categories: Set<ConflictCategory> — which categories are visible
- timeframe: '24h' | '6h' | '1h' — recency filter

`ConflictApiResponse`:
- events: ConflictEvent[]
- total: number — count of events returned
- timestamp: string — ISO datetime of when this response was generated
- partial: boolean — true if the upstream fetch failed and we're returning degraded data

### Types and Constants

`ConflictCategory` = 'coerce' | 'assault' | 'fight' | 'mass-violence' | 'other'

### Functions

`classifyConflictEvent(cameoCode: string): ConflictCategory`:
Map CAMEO root codes: 17 → coerce, 18 → assault, 19 → fight, 20 → mass-violence, anything else → other. Extract root code by taking first 2 characters of the code string.

`getConflictCategoryColor(category: ConflictCategory): string`:
- coerce: '#f97316' (orange-500)
- assault: '#ef4444' (red-500)
- fight: '#dc2626' (red-600)
- mass-violence: '#7f1d1d' (red-900)
- other: '#6b7280' (gray-500)

`getConflictCategoryLabel(category: ConflictCategory): string`:
- coerce: 'Coercion'
- assault: 'Assault'
- fight: 'Armed Conflict'
- mass-violence: 'Mass Violence'
- other: 'Other'

`formatTone(tone: number): string`:
Return a human-readable label: tone < -5 → "Very Negative", < -1 → "Negative", < 1 → "Neutral", < 5 → "Positive", else → "Very Positive".

`formatGoldstein(value: number | null): string | null`:
If null, return null. Otherwise return the value formatted to 1 decimal place with a +/- prefix.

## File 2: src/app/api/conflicts/route.ts

Create this file as a Next.js App Router GET route handler. Study the existing `src/app/api/airspace/route.ts` and `src/app/api/satellites/route.ts` for the caching and error handling patterns, then follow them.

### Behavior:

1. **Cache check:** Module-level variables for cached response and timestamp. If cache exists and is less than 10 minutes old (600000ms), return it immediately with appropriate headers.

2. **Fetch from GDELT:** 
   - URL: `https://api.gdeltproject.org/api/v2/geo/geo`
   - Query params: `query=military+conflict`, `mode=pointdata`, `format=geojson`, `timespan=24h`, `maxpoints=500`
   - Use native `fetch` with a 15-second timeout (AbortController).
   - Set `Accept: application/json` header.

3. **Parse response:**
   - Expect a GeoJSON FeatureCollection with Point features.
   - For each feature:
     - Extract lat/lon from `geometry.coordinates` (remember: GeoJSON is [lon, lat], swap to [lat, lon]).
     - Extract `name`, `url`, `domain`, `sharingimage` from `properties`.
     - Parse `tone`: split the comma-separated string on commas, take the first value, parseFloat. Default to 0 if parsing fails.
     - Extract `goldsteinscale` from properties if present, otherwise null.
     - Generate a deterministic `id`: create a simple hash string from `${lat.toFixed(2)}_${lon.toFixed(2)}_${name}_${domain}`.
     - If the response includes any CAMEO/EventCode field, use `classifyConflictEvent()`. Otherwise, default all events to 'other' category (the keyword query already filters for military/conflict relevance).
     - Set `dateAdded` to the feature's date field if present, or fall back to current ISO timestamp.
     - Set `numArticles` from properties if available, default to 1.

4. **Deduplicate:** Group events by their `id`. For duplicates, keep the one with the highest `numArticles` or most recent `dateAdded`.

5. **Build response:** Return `ConflictApiResponse` with the events array, total count, current ISO timestamp, and `partial: false`.

6. **Error handling:** On any fetch/parse error, log the error, and return `{ events: [], total: 0, timestamp: new Date().toISOString(), partial: true }` with HTTP 200 (degrade gracefully, never crash). If there's a stale cache, return the stale cache with `partial: true` instead of empty.

7. **Response headers:** Set `Cache-Control: public, max-age=600, stale-while-revalidate=300`.

### Important implementation note:
Before writing the parser, add a temporary `console.log(JSON.stringify(data.features?.[0], null, 2))` to inspect the actual GDELT response shape during development. The GEO v2 API documentation is sparse — the actual property names may differ from what's documented. Adapt field extraction based on what's actually in the response. Remove the console.log before finalizing.

Run `npm run type-check` and `npm run lint` to verify.
```

---

## Phase 2: Data Hook

**Goal:** Create the client-side polling hook that fetches conflict data from the proxy route on a 10-minute interval, following the same pattern as existing layer hooks.

### What This Phase Produces
- `src/hooks/useConflictData.ts` — Polling hook returning events, loading state, error state, and last updated time

### Design Notes
- The hook accepts an `enabled` boolean. When false, polling stops AND events are cleared (consistent with the "disabled layers don't poll" architecture rule).
- On transient fetch errors, the hook preserves previous event data while surfacing the error string — users see stale data with an error indicator rather than a blank map.
- 10-minute interval (600000ms) matches the server cache duration and aligns with GDELT's ~15-minute update cycle.

### Claude Code Prompt — Phase 2

```
Read CLAUDE.md for project conventions. Study `src/hooks/useVesselData.ts` and `src/hooks/useSatelliteData.ts` to understand the exact hook pattern used in this project. Then implement Phase 2 of the GDELT conflict layer.

Create `src/hooks/useConflictData.ts`:

- Named export: `export const useConflictData = (enabled: boolean) => { ... }`
- Return type: `{ events: ConflictEvent[], total: number, loading: boolean, error: string | null, lastUpdated: Date | null }`
- Follow the same pattern as useVesselData:
  - State: events array, total count, loading boolean, error string or null, lastUpdated Date or null.
  - On mount and when `enabled` changes: if enabled, do an immediate fetch, then set up an interval at 600000ms (10 minutes).
  - If not enabled, clear the interval, clear events to empty array, set total to 0, clear error, set loading to false. Do NOT leave stale data in state when the layer is toggled off.
  - Fetch function: `GET /api/conflicts`, parse JSON as `ConflictApiResponse`.
    - On success: set events, total, clear error, set lastUpdated to new Date(), set loading to false.
    - On error: set error message string, but do NOT clear events (preserve previous data for resilience). Set loading to false.
  - Initial loading state should be true only on the very first fetch when enabled.
  - Cleanup: clear interval on unmount or when enabled changes to false.
- Use native `fetch` — no axios.
- No `any` types. Import `ConflictEvent` and `ConflictApiResponse` from `../lib/conflictTypes`.

Run `npm run type-check` and `npm run lint` to verify.
```

---

## Phase 3: Map Marker + Map Integration

**Goal:** Create the static crosshair conflict marker component and integrate it into `Map.tsx` with a dedicated Leaflet pane, viewport filtering, and zoom gating.

### What This Phase Produces
- `src/components/ConflictMarker.tsx` — Static crosshair SVG marker, category-colored, `React.memo`'d
- Modifications to `src/components/Map.tsx` — New `conflictPane`, conflict marker rendering, viewport filtering
- Modifications to `src/components/MapWrapper.tsx` — Pass-through of new conflict props

### Marker Specification

The crosshair icon is a simple inline SVG with:
- A small filled circle at center (4px radius for 16px icon, 5px for 20px)
- Four short lines radiating outward from the circle (top, right, bottom, left)
- Stroke and fill both use the category color from `getConflictCategoryColor()`
- Stroke width: 2px
- Total viewBox: `0 0 16 16` (default) or `0 0 20 20` (selected)
- No animation, no CSS keyframes, no transitions — completely static

This creates a target/crosshair look that is visually distinct from all other layer markers and reads clearly at any zoom level.

### Claude Code Prompt — Phase 3

```
Read CLAUDE.md for project conventions. Review the existing Map.tsx, AircraftMarker.tsx, SatelliteMarker.tsx, and VesselMarker.tsx to understand the marker and map integration patterns. Then implement Phase 3 of the GDELT conflict layer.

## File 1: src/components/ConflictMarker.tsx

Create a client component with these requirements:

- Props interface `ConflictMarkerProps`: `event: ConflictEvent`, `isSelected: boolean`, `onClick: () => void`
- Named export. Wrap in `React.memo` with a custom comparator that compares: `event.lat`, `event.lon`, `event.category`, `event.name`, and `isSelected`.
- Render a Leaflet `L.marker` using `L.divIcon` with an inline SVG crosshair icon.

SVG crosshair icon specification:
- Default size: 16x16px. When `isSelected`: 20x20px.
- viewBox matches size: "0 0 16 16" or "0 0 20 20".
- Center circle: `<circle>` at center coordinates, radius 3px (default) or 4px (selected), filled with category color.
- Four crosshair lines using `<line>`: extending outward from the circle edge toward each edge of the viewBox. Stroke = category color, strokeWidth = 2.
  - For 16px: lines from ~(8,1) to (8,4), (12,8) to (15,8), (8,12) to (8,15), (1,8) to (4,8) — adjust so they don't overlap the circle.
  - For 20px: scale proportionally.
- Background: transparent. No drop shadows, no glow, no animation.
- Get the color from `getConflictCategoryColor(event.category)`.

Use the `conflictPane` pane name on the marker.

Tooltip on hover: show `event.name` truncated to 80 characters (add "..." if truncated). Use Leaflet's `bindTooltip` with `{ pane: 'tooltipPane' }`.

On click: call `onClick` prop.

The icon anchor should be centered: [half-width, half-height].

## File 2: Modify src/components/Map.tsx

Make these additions without changing any existing layer behavior:

1. **New pane:** In the map initialization (where other custom panes are created), add `conflictPane` at z-index 430.

2. **New props:** Add to the component's props interface:
   - `conflicts: ConflictEvent[]`
   - `selectedConflict: ConflictEvent | null`
   - `onConflictSelect: (event: ConflictEvent | null) => void`
   - `conflictsEnabled: boolean`

3. **Viewport filtering:** Follow the same pattern used for vessels and satellites. When the map moves or zooms (`moveend`/`zoomend`), filter `conflicts` to those within the current map bounds. Store visible conflicts in state/ref. Only perform filtering when `conflictsEnabled` is true and zoom >= 3.

4. **Rendering:** Map over the visible conflicts array and render a `<ConflictMarker>` for each, passing `isSelected={selectedConflict?.id === event.id}` and an `onClick` that calls `onConflictSelect(event)`.

5. **Cleanup:** When `conflictsEnabled` toggles to false, clear any conflict marker state.

## File 3: Modify src/components/MapWrapper.tsx

Pass the new conflict-related props through the dynamic import wrapper to Map.tsx. Follow the same pattern used for other layer props.

Run `npm run type-check` and `npm run lint` to verify. Do NOT change any existing marker, pane, or layer behavior.
```

---

## Phase 4: Detail Panel

**Goal:** Create the conflict event detail panel, providing full event context when a user clicks a conflict marker.

### What This Phase Produces
- `src/components/ConflictPanel.tsx` — Slide-in detail panel with red accent, showing event info, source link, severity indicators, and location

### Panel Content Layout

The panel should display enough information to give the user immediate situational awareness about the event without needing to click through to the source article:

1. **Header area:** Event name (full text, wrapping allowed), category badge (colored pill)
2. **Source block:** Domain name + clickable link to full article, sharing image thumbnail if available
3. **Metrics row:** Tone score with label (from `formatTone`), Goldstein scale with value (from `formatGoldstein`, if available), article count
4. **Location:** Lat/lon to 4 decimal places
5. **Timestamp:** When the event was captured, formatted as relative time ("2 hours ago") and absolute time

### Claude Code Prompt — Phase 4

```
Read CLAUDE.md for project conventions. Review AirspacePanel.tsx and SatellitePanel.tsx for the exact panel layout pattern — right sidebar (320px, right-0) on desktop >= 768px, bottom sheet (60vh) on mobile < 768px, absolutely positioned at z-[1000], close button top-right, dark background (zinc-900/zinc-800). Then implement Phase 4.

Create `src/components/ConflictPanel.tsx`:

- Client component. Named export.
- Props: `event: ConflictEvent`, `onClose: () => void`, `allEvents: ConflictEvent[]` (used to detect if event has expired from the data set).
- Red accent color (red-500 / red-400) for header borders, category badges, and section highlights.

Layout (follow the exact structural pattern of existing panels):

1. **Header:**
   - Close button (top-right, × icon).
   - Event name as the title — allow text wrapping, use text-sm or text-base for long headlines.
   - Category badge: small colored pill using `getConflictCategoryColor` background with `getConflictCategoryLabel` text. White text on dark colors, dark text on lighter colors.

2. **"Event expired" badge:** If `event.id` is not found in `allEvents`, show a red badge with pulse animation that says "Event expired" — matching the "Signal lost" pattern from other panels.

3. **Source section:**
   - Row showing the source domain (e.g., "reuters.com") with a globe or link icon.
   - "View Source Article" link that opens `event.url` in a new tab (`target="_blank"` with `rel="noopener noreferrer"`).
   - If `event.sharingImage` is a non-empty string, show it as a small thumbnail (rounded, max-height ~120px, object-cover).

4. **Analysis section:**
   - **Tone:** Display `event.tone` value and the human label from `formatTone()`. Use color coding: red shades for negative, gray for neutral, green shades for positive.
   - **Goldstein Scale:** If `event.goldsteinScale` is not null, display via `formatGoldstein()` with similar color coding. If null, omit this row entirely (don't show "N/A").
   - **Sources:** "Covered by N articles" using `event.numArticles`.

5. **Location section:**
   - Lat/lon to 4 decimal places, in a muted/secondary text style.

6. **Timestamp section:**
   - Show `event.dateAdded` as both relative time (e.g., "3 hours ago") and formatted absolute time. Write a small helper or inline the relative time calculation — do not add a dependency like date-fns.

Styling:
- Same slide-in behavior and responsive layout as existing panels.
- Tailwind utility classes only.
- Section dividers using `border-b border-zinc-700` between sections, matching other panels.
- Text hierarchy: title largest, section headers in red accent, values in white/zinc-200, labels in zinc-400.

Run `npm run type-check` and `npm run lint` to verify.
```

---

## Phase 5: Filter Bar

**Goal:** Create the conflict filter bar with search, category multi-select, and timeframe filter.

### What This Phase Produces
- `src/components/ConflictFilterBar.tsx` — Horizontal filter bar with red accent, matching the layout pattern of other filter bars

### Filter Specifications

| Filter | Type | Options | Default |
|---|---|---|---|
| Search | Text input | Filters on `event.name` and `event.domain` (case-insensitive substring match) | Empty string |
| Category | Multi-select pills | Coercion, Assault, Armed Conflict, Mass Violence, Other | All selected |
| Timeframe | Single-select pills | All (24h), Last 6h, Last 1h | All (24h) |

The actual filtering logic (applying filters to the events array) happens in `page.tsx` via `useMemo`, not in this component. The filter bar only manages and displays the filter UI, calling setter functions passed as props.

### Claude Code Prompt — Phase 5

```
Read CLAUDE.md for project conventions. Review AirspaceFilterBar.tsx and VesselFilterBar.tsx for the filter bar pattern — horizontal bar below StatusBar, accent-colored, horizontally scrollable on mobile, pill-style toggle buttons. Then implement Phase 5.

Create `src/components/ConflictFilterBar.tsx`:

- Client component. Named export.
- Red accent color (red-500/red-600 for active pills, red-900/red-950 for inactive pill backgrounds).
- Props — follow the same pattern as other filter bars, accepting filter values and their setters:
  - `search: string`
  - `onSearchChange: (value: string) => void`
  - `categories: Set<ConflictCategory>`
  - `onCategoriesChange: (categories: Set<ConflictCategory>) => void`
  - `timeframe: '24h' | '6h' | '1h'`
  - `onTimeframeChange: (timeframe: '24h' | '6h' | '1h') => void`
  - `totalCount: number` — total events before filtering (for display)
  - `filteredCount: number` — events after filtering (for display)

Layout:

1. **Search input:** Left side. Placeholder "Search events or sources...". Text input with red accent focus ring. Filters on name and domain.

2. **Category pills:** Row of toggleable pills for each ConflictCategory. Each pill shows the category label from `getConflictCategoryLabel()` with a small colored dot (from `getConflictCategoryColor()`) as a prefix. Clicking a pill toggles it in/out of the categories Set. If all are deselected, treat as all selected (or prevent deselecting the last one — match behavior of existing filter bars).

3. **Timeframe pills:** Row of single-select pills: "24h", "6h", "1h". Only one active at a time.

4. **Count display:** Right side, showing "N / M events" (filteredCount / totalCount) in zinc-400 text.

Styling:
- Same overall bar structure as other filter bars: `bg-zinc-900/95 backdrop-blur`, border-bottom, horizontal overflow scroll on mobile.
- Active pills: red-600 bg, white text. Inactive pills: zinc-800 bg, zinc-300 text.
- Consistent spacing and sizing with other filter bars.
- Tailwind utility classes only.

Also add the `ConflictFilters` interface to `src/lib/conflictTypes.ts` if it wasn't already added in Phase 1 (it should have been — verify it exists with fields: `search: string`, `categories: Set<ConflictCategory>`, `timeframe: '24h' | '6h' | '1h'`).

Run `npm run type-check` and `npm run lint` to verify.
```

---

## Phase 6: Page Integration (Layer Control, StatusBar, page.tsx)

**Goal:** Wire everything together. This is the largest phase — it connects the hook, markers, panel, filters, layer control toggle, and status bar count into the main page component.

### What This Phase Produces
- Modifications to `src/app/page.tsx` — Full conflict layer state management, filter logic, panel mutual exclusivity
- Modifications to `src/components/LayerControl.tsx` — Conflict toggle row
- Modifications to `src/components/StatusBar.tsx` — Conflict event count

### Integration Checklist

In `page.tsx`, the conflict layer needs:
- Toggle state hydrated from `localStorage` key `overwatch-conflict-layer` (default: false)
- `useConflictData(conflictsEnabled)` hook call
- Filter state: `ConflictFilters` with initial values (empty search, all categories, 24h timeframe)
- `useMemo` filter chain applying search → category → timeframe filters to the events array
- `selectedConflict` / `setSelectedConflict` state
- Mutual exclusivity: selecting a conflict event must deselect any selected aircraft, vessel, satellite, or airspace zone — and vice versa
- Props passed down to Map, ConflictPanel, ConflictFilterBar, LayerControl, StatusBar

### Claude Code Prompt — Phase 6

```
Read CLAUDE.md for project conventions. Read `src/app/page.tsx` VERY carefully — understand the full pattern for layer states, localStorage hydration, filter states, useMemo filter chains, panel mutual exclusivity, and how each layer's components are conditionally rendered. Also read `LayerControl.tsx` and `StatusBar.tsx`. Then implement Phase 6.

## File 1: Modify src/app/page.tsx

Add the conflict layer following the exact same integration pattern as the airspace, vessel, and satellite layers:

1. **Layer toggle state:**
   - `const [conflictsEnabled, setConflictsEnabled] = useState(false);`
   - In the `useEffect` that hydrates from localStorage (the one that runs on mount), add: read `overwatch-conflict-layer` from localStorage, set `conflictsEnabled` if 'true'.
   - In the toggle handler (or wherever other layers persist to localStorage), persist `conflictsEnabled` changes to `overwatch-conflict-layer`.

2. **Data hook:**
   - `const { events: conflictEvents, total: conflictTotal, loading: conflictsLoading, error: conflictsError, lastUpdated: conflictsLastUpdated } = useConflictData(conflictsEnabled);`

3. **Filter state:**
   ```typescript
   const [conflictFilters, setConflictFilters] = useState<ConflictFilters>({
     search: '',
     categories: new Set<ConflictCategory>(['coerce', 'assault', 'fight', 'mass-violence', 'other']),
     timeframe: '24h' as const,
   });
   ```

4. **Filter chain (useMemo):**
   ```typescript
   const filteredConflicts = useMemo(() => {
     let filtered = conflictEvents;
     
     // Search filter: case-insensitive substring on name and domain
     if (conflictFilters.search) {
       const q = conflictFilters.search.toLowerCase();
       filtered = filtered.filter(e => 
         e.name.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q)
       );
     }
     
     // Category filter
     if (conflictFilters.categories.size > 0 && conflictFilters.categories.size < 5) {
       filtered = filtered.filter(e => conflictFilters.categories.has(e.category));
     }
     
     // Timeframe filter
     if (conflictFilters.timeframe !== '24h') {
       const now = Date.now();
       const cutoff = conflictFilters.timeframe === '1h' ? 3600000 : 21600000;
       filtered = filtered.filter(e => now - new Date(e.dateAdded).getTime() < cutoff);
     }
     
     return filtered;
   }, [conflictEvents, conflictFilters]);
   ```

5. **Selected event state + mutual exclusivity:**
   - `const [selectedConflict, setSelectedConflict] = useState<ConflictEvent | null>(null);`
   - When `setSelectedConflict` is called with a non-null event, clear ALL other selected entities (aircraft, vessel, satellite, airspace zone) — same pattern used for other layers.
   - When any other entity is selected, clear `selectedConflict` to null.
   - Use a wrapper function or add to the existing mutual exclusivity handler.

6. **Pass props to components:**
   - To `Map` (via `MapWrapper`): `conflicts={filteredConflicts}`, `selectedConflict`, `onConflictSelect={setSelectedConflict}` (with mutual exclusivity wrapper), `conflictsEnabled`.
   - Conditionally render `<ConflictPanel>` when `selectedConflict !== null`: pass `event={selectedConflict}`, `onClose={() => setSelectedConflict(null)}`, `allEvents={conflictEvents}`.
   - Conditionally render `<ConflictFilterBar>` when `conflictsEnabled` is true: pass all filter values, setter functions, `totalCount={conflictEvents.length}`, `filteredCount={filteredConflicts.length}`.
   - To `LayerControl`: `conflictsEnabled`, `onConflictsToggle` (the toggle handler that also persists to localStorage).
   - To `StatusBar`: `conflictCount={filteredConflicts.length}`, `conflictsEnabled`.

## File 2: Modify src/components/LayerControl.tsx

Add a conflict events toggle row:

- Position: after the airspace row (last row before any planned/future layers).
- Red accent: red-500 dot when enabled, zinc-600 dot when disabled.
- Label: "Conflicts"
- Sublabel or count: show event count when enabled (optional, match pattern of other rows).
- No API key gating — conflicts require no key (like satellites and airspace).
- Props: add `conflictsEnabled: boolean` and `onConflictsToggle: () => void` to the component's props.
- Toggle behavior: call `onConflictsToggle` on click, matching the exact toggle UX of other rows.

## File 3: Modify src/components/StatusBar.tsx

Add a conflict event count indicator:

- Position: after the airspace count, before the last-updated time (follow the existing ordering pattern).
- Red accent (red-400 text) for the count number, matching how vessels are blue and satellites are purple.
- Only render when `conflictsEnabled` is true.
- Format: "N events" or match the existing count format pattern.
- Props: add `conflictCount: number` and `conflictsEnabled: boolean`.

## Final verification:

Run `npm run type-check` and `npm run lint` to verify all changes compile and lint cleanly.
Run `npm run build` for a full production build to catch any SSR/hydration issues.
```

---

## Phase 7: Documentation Updates (CLAUDE.md + README.md)

**Goal:** Update both project documentation files to reflect the conflict layer as fully implemented and active, with complete details on the data source, architecture, and component inventory.

### Claude Code Prompt — Phase 7

```
Read the current CLAUDE.md and README.md in their entirety. Update both to document the now-implemented GDELT conflict events layer. Be thorough — every section that references layer inventory, data sources, components, or project structure needs to be updated.

## Update CLAUDE.md:

1. **Status section:** Move "Conflict events (GDELT)" from planned to active layers. The active layers line should now read: "Aircraft (ADSB.lol), Vessels (aisstream.io), Satellites (CelesTrak), Airspace (FAA ArcGIS + FAA TFR API), Conflicts (GDELT)"

2. **Layer Toggle System table:** Add row: Layer=Conflicts, Toggle Key=`overwatch-conflict-layer`, Default=off, Polling Interval=10min.

3. **Data Sources section:** Add a full `### Conflicts — GDELT` subsection:
   - Endpoint: `https://api.gdeltproject.org/api/v2/geo/geo?query=military+conflict&mode=pointdata&format=geojson&timespan=24h&maxpoints=500`
   - No auth. GDELT updates ~every 15 minutes. Server cache: 10 min. Client poll: 10 min.
   - GeoJSON FeatureCollection response with Point features.
   - Key fields: name (headline), url (source), domain, tone, goldsteinscale (if available), sharingimage.
   - Categories (5): coerce (orange #f97316), assault (red #ef4444), fight (dark red #dc2626), mass-violence (deep red #7f1d1d), other (gray #6b7280). Classified by CAMEO root codes 17-20 when available.
   - Markers: Static crosshair SVG. Default 16px, selected 20px. Category-colored. Pane z-430. Zoom gate >= 3.

4. **Component Details — Map.tsx:** Add `conflictPane` (z-430) to the custom panes list.

5. **Markers table:** Add: ConflictMarker, 16px/20px selected, no rotation, key comparator: lat, lon, category, name, isSelected.

6. **Panels table:** Add: ConflictPanel, red accent, event name, category badge, source link, tone, goldstein, article count, location, timestamp.

7. **Filter Bars table:** Add: ConflictFilterBar, red accent, search (name/domain), category, timeframe (24h/6h/1h).

8. **Performance section:** Add: Conflicts: viewport filtered, zoom gate >= 3, ~500 max events (GDELT maxpoints cap). Static markers, no animation overhead.

9. **Error Handling section:** Add: Conflict route degrades gracefully — returns stale cache or empty array on upstream failure. `partial: true` flag when GDELT fetch fails.

10. **Planned Layers section:** Remove the Conflicts (GDELT) entry entirely. Keep Seismic (USGS) as the only planned layer.

11. **Project structure tree:** Add:
    - `src/app/api/conflicts/route.ts` — Proxy to GDELT GEO v2 API (10-min cache)
    - `src/components/ConflictMarker.tsx` — Conflict crosshair marker with category colors
    - `src/components/ConflictPanel.tsx` — Conflict event detail panel (red accent)
    - `src/components/ConflictFilterBar.tsx` — Conflict search + category + timeframe filters
    - `src/hooks/useConflictData.ts` — Conflict polling hook (10min interval, toggleable)
    - `src/lib/conflictTypes.ts` — Conflict interfaces, category classification, formatting

12. **Attribution table:** Add: GDELT Project | Free, no auth.

## Update README.md:

1. **"What It Does" section:** Add a **Conflict Event Tracking** paragraph after the Airspace paragraph, following the same descriptive pattern:
   "**Conflict Event Tracking** — The conflict layer displays real-time global military and conflict events sourced from the [GDELT Project](https://www.gdeltproject.org/). Events are plotted as crosshair markers color-coded by severity category (coercion, assault, armed conflict, mass violence). Each event links back to the source article for full context. Events are filtered by military/conflict keywords and displayed within a rolling 24-hour window. No API key required."

2. **"Additional planned data layers" line:** Update to mention only seismic monitoring (remove conflict mention).

3. **Layer 4 table:** Change status from "Primary candidate" to "Active".

4. **Add a "### Conflict Event Tracking" usage section** (like the Satellite Tracking section):
   - No API key needed.
   - Toggle on via layer control.
   - Events appear as colored crosshair markers.
   - Click for details (headline, source, severity, location).
   - Filter by search, category, or timeframe.
   - Data source: GDELT Project — free, no auth, real-time geocoded news events.

5. **Project structure tree:** Add the 6 new files in their correct locations.

6. **Legal section:** Verify GDELT is already mentioned ("Conflict event data from GDELT is derived from open news sources"). If not, add it.

Run `npm run lint` to verify.
```

---

## File Inventory (New + Modified)

### New Files
| File | Phase | Description |
|---|---|---|
| `src/lib/conflictTypes.ts` | 1 | Interfaces, categories, classification, colors, formatting helpers |
| `src/app/api/conflicts/route.ts` | 1 | API proxy route with 10-min cache, deduplication, error degradation |
| `src/hooks/useConflictData.ts` | 2 | Polling hook (10-min interval), enables/disables with layer toggle |
| `src/components/ConflictMarker.tsx` | 3 | Static crosshair SVG marker, category-colored, 16/20px |
| `src/components/ConflictPanel.tsx` | 4 | Detail panel — event info, source link, tone, goldstein, location |
| `src/components/ConflictFilterBar.tsx` | 5 | Search + category multi-select + timeframe single-select |

### Modified Files
| File | Phase | Changes |
|---|---|---|
| `src/components/Map.tsx` | 3 | Add conflictPane z-430, render ConflictMarkers, viewport filtering |
| `src/components/MapWrapper.tsx` | 3 | Pass conflict props through dynamic import |
| `src/app/page.tsx` | 6 | Full integration: state, hook, filters, panel, mutual exclusivity |
| `src/components/LayerControl.tsx` | 6 | Conflict toggle row (red accent, no API key gate) |
| `src/components/StatusBar.tsx` | 6 | Conflict event count (red accent) |
| `CLAUDE.md` | 7 | Document conflict layer as active across all sections |
| `README.md` | 7 | Document conflict layer as active with usage instructions |

---

## Verification Checklist

After all phases are complete, verify:

- [ ] `npm run type-check` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` produces a successful production build with no SSR/hydration warnings
- [ ] Toggling conflicts on in LayerControl starts polling; toggling off stops polling and clears markers
- [ ] Layer toggle state persists in `localStorage` across page reloads
- [ ] Conflict crosshair markers appear on the map at zoom ≥ 3 with correct category colors
- [ ] Markers are completely static — no animation, no pulsing, no CSS keyframes, no performance degradation with hundreds of markers
- [ ] Clicking a conflict marker opens ConflictPanel and closes any other open panel (aircraft, vessel, satellite, airspace)
- [ ] Selecting any other entity type closes ConflictPanel (mutual exclusivity)
- [ ] ConflictPanel displays event name, category badge, source link, tone, goldstein (if available), article count, location, timestamp
- [ ] ConflictPanel shows "Event expired" badge when the event is no longer in the data set
- [ ] ConflictFilterBar search filters on event name and source domain
- [ ] ConflictFilterBar category pills toggle correctly and filter markers on the map
- [ ] ConflictFilterBar timeframe pills switch between 24h/6h/1h windows and filter accordingly
- [ ] StatusBar shows conflict count in red when layer is active, hidden when inactive
- [ ] LayerControl shows red dot for conflicts when enabled, zinc dot when disabled
- [ ] Conflict layer failing (GDELT down) does not affect aircraft/vessels/satellites/airspace
- [ ] Proxy route returns gracefully degraded response (stale cache or empty) on upstream failure
- [ ] CLAUDE.md and README.md accurately reflect the implemented layer in all relevant sections
