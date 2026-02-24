# PLAN.md — Layer 5: Restricted Airspace Implementation

## Goal

Add a restricted airspace overlay layer to Overwatch. This layer renders **only** airspace that is restricted, prohibited, or temporarily closed — never regular class airspace (B, C, D, E). Displaying non-restricted airspace would add noise with no intelligence value and degrade map readability.

The layer has two sub-sources:

1. **Static Special Use Airspace (SUA):** Permanent/semi-permanent restricted zones (Restricted Areas, Prohibited Areas, MOAs, Warning Areas) from FAA ArcGIS Open Data.
2. **Dynamic TFRs:** Temporary Flight Restrictions from the FAA TFR feed — these change daily and correlate with VIP movement, military exercises, security events, and space launches.

---

## Data Sources

### Source A: FAA ArcGIS Open Data — Special Use Airspace (Static)

| Field | Value |
|---|---|
| URL | `https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0/query` |
| Auth | None |
| Format | GeoJSON (via `f=geojson` query param) |
| Update frequency | Every 28 days (FAA NASR cycle) |
| Coverage | US, Puerto Rico, Virgin Islands |

**Query parameters for our use case:**

```
?where=TYPE_CODE IN ('R','P','W','A','MOA')
&outFields=NAME,TYPE_CODE,LOCAL_TYPE,UPPER_VAL,UPPER_UOM,LOWER_VAL,LOWER_UOM,CITY,STATE,COUNTRY,SCHEDULE
&f=geojson
&outSR=4326
```

This filters to **only** restricted airspace types:
- `R` — Restricted Area (military weapons testing, artillery, missile ranges)
- `P` — Prohibited Area (e.g., P-56 over the White House/Capitol, Camp David)
- `MOA` — Military Operations Area (active military training)
- `W` — Warning Area (extends over international waters, military exercises)
- `A` — Alert Area (high volume of pilot training or unusual aerial activity)

We explicitly exclude all class airspace (`CLASS_B`, `CLASS_C`, `CLASS_D`, `CLASS_E`) — these represent normal controlled airspace around airports and have zero intelligence relevance.

**Fallback:** The GeoJSON bulk download is also available at:
`https://hub.arcgis.com/api/v3/datasets/dd0d1b726e504137ab3c41b21835d05b_0/downloads/data?format=geojson&spatialRefId=4326`

### Source B: FAA TFR Feed — Temporary Flight Restrictions (Dynamic)

| Field | Value |
|---|---|
| List URL | `https://tfr.faa.gov/tfr2/list.html` |
| Detail XML | `https://tfr.faa.gov/save_pages/detail_{notam_id}.xml` |
| Shapefile | `https://tfr.faa.gov/save_pages/detail_{notam_id}.shp` (zip) |
| AIXM | `https://tfr.faa.gov/save_pages/detail_{notam_id}.xml` (AIXM format) |
| Auth | None |
| Format | HTML (list) → XML/AIXM (detail with geometry) |
| Update frequency | Real-time (TFRs are issued/cancelled continuously) |

**NOTE:** As of TFR Website 3.0+, the URL pattern changed from `save_pages` to `download`. The proxy route must handle both patterns and follow redirects.

The TFR list page at `https://tfr.faa.gov/tfr2/list.html` provides a parseable HTML table of all active TFRs. Each entry includes a NOTAM ID that maps to a detail XML file containing:
- NOTAM text (restriction description, authority, effective times)
- Geometry (center point + radius for circular TFRs, or polygon coordinates)
- TFR type (VIP, HAZARDS, SECURITY, SPACE OPERATIONS, etc.)
- Effective start/end times (UTC)

**TFR types by 14 CFR section (all are restrictions — all get displayed):**

| CFR Section | Code | Description | Intelligence Value |
|---|---|---|---|
| 91.137 | HAZ | Disaster/Hazard | Natural disaster, industrial accident |
| 91.138 | HID | Hawaii Disaster | Hawaii-specific disaster |
| 91.139 | SEC | Emergency/Security | Security event, national defense |
| 91.141 | VIP | Presidential/VIP | VIP movement (POTUS, VP, foreign heads of state) |
| 91.143 | SPC | Space Operations | Rocket launch, reentry |
| 91.145 | EVT | Sporting Events/Demos | Major event airspace closure |
| 99.7 | NATL DEF | National Defense | National defense airspace |

### Source C (Future/Optional): FAA NOTAM API

| Field | Value |
|---|---|
| URL | `https://external-api.faa.gov/notamapi/v1/notams` |
| Auth | Free API key (register at api.faa.gov) |
| Format | JSON |

The FAA NOTAM API provides broader NOTAM data beyond TFRs but requires an API key registration. This is a future enhancement — **Phase 1 uses only Source A + B** which require no API keys, keeping the zero-auth pattern for this layer.

---

## Architecture

Follows the existing Overwatch pattern exactly:

```
Browser → useAirspaceData hook → fetch("/api/airspace") → Proxy Route → FAA ArcGIS + TFR feed
                                                              ↓
                                                        Cache + Error handling + Merge
```

### Why Two Sub-Sources in One Route

SUA and TFR data serve the same visual purpose (restricted airspace polygons on the map) and share the same Leaflet rendering path (GeoJSON polygon overlays). Merging them server-side into a single normalized response keeps the client simple — one hook, one layer toggle, one set of overlays.

---

## File Plan

### New Files

| File | Description |
|---|---|
| `src/app/api/airspace/route.ts` | Proxy route — fetches SUA from ArcGIS + TFR list/details, merges, caches |
| `src/lib/airspaceTypes.ts` | TypeScript interfaces, type classification, colors, labels |
| `src/hooks/useAirspaceData.ts` | Polling hook (5-min interval), toggleable |
| `src/components/AirspaceOverlay.tsx` | Leaflet GeoJSON overlay renderer (polygons + circles) |
| `src/components/AirspacePanel.tsx` | Detail panel for selected airspace zone |
| `src/components/AirspaceFilterBar.tsx` | Filter bar (type filter, active-only toggle) |

### Modified Files

| File | Changes |
|---|---|
| `src/app/page.tsx` | Add airspace layer state, toggle, filter state, selection state, integrate hook + components |
| `src/components/Map.tsx` | Add airspace overlay pane (z-index 420, below satellites), render AirspaceOverlay, viewport filtering |
| `src/components/LayerControl.tsx` | Add airspace row with shield icon, toggle, count, orange accent |
| `src/components/StatusBar.tsx` | Add airspace zone count when layer active |
| `.env.example` | Add `FAA_NOTAM_API_KEY` (optional, for future Phase 2) |

---

## Implementation Phases

### Phase 1: Types & Data Layer (`airspaceTypes.ts`)

Define the normalized data model that both SUA and TFR data get transformed into.

```typescript
// Airspace zone types — ALL are restrictions, no regular airspace
type AirspaceType = 'restricted' | 'prohibited' | 'moa' | 'warning' | 'alert' | 'tfr';

// TFR sub-types for intelligence context
type TfrType = 'vip' | 'security' | 'hazard' | 'space' | 'event' | 'national-defense' | 'other';

interface AirspaceZone {
  id: string;                           // Unique ID (SUA name or NOTAM ID)
  name: string;                         // Display name (e.g., "R-2301W" or "TFR 4/5272")
  type: AirspaceType;                   // Zone classification
  tfrType?: TfrType;                    // Only for TFRs — sub-classification
  geometry: GeoJSON.Geometry;           // Polygon or Point+radius → circle
  center?: { lat: number; lon: number };// Center point (for circular TFRs)
  radiusNm?: number;                    // Radius in nautical miles (circular TFRs)
  upperAltitude?: string;               // Upper bound (e.g., "FL180", "18000 MSL", "Unlimited")
  lowerAltitude?: string;               // Lower bound (e.g., "SFC", "3000 MSL")
  schedule?: string;                    // Active schedule (SUA: "CONT" / "BY NOTAM" / times)
  description?: string;                 // Human-readable description
  effectiveStart?: string;              // ISO datetime (TFRs only)
  effectiveEnd?: string;                // ISO datetime (TFRs only)
  isActive: boolean;                    // Currently active right now
  state?: string;                       // US state
  source: 'sua' | 'tfr';               // Data source origin
}
```

**Color scheme:**

| Type | Color | Opacity | Rationale |
|---|---|---|---|
| Prohibited | Red `#ef4444` | 0.25 fill / 0.8 stroke | Highest restriction, danger |
| Restricted | Orange `#f97316` | 0.20 fill / 0.7 stroke | Active military use |
| MOA | Yellow `#eab308` | 0.15 fill / 0.6 stroke | Military training, less severe |
| Warning | Purple `#8b5cf6` | 0.15 fill / 0.6 stroke | Offshore military |
| Alert | Cyan `#06b6d4` | 0.10 fill / 0.5 stroke | Advisory, least severe |
| TFR | Red `#dc2626` | 0.30 fill / 0.9 stroke | Active temporary restriction — highest visual priority |

TFR overlays use dashed stroke to visually distinguish from permanent SUA zones.

### Phase 2: API Proxy Route (`src/app/api/airspace/route.ts`)

The route handler fetches both data sources in parallel and merges them.

**SUA fetch (ArcGIS):**
1. Query the ArcGIS Feature Service with `TYPE_CODE IN ('R','P','W','A','MOA')` and `f=geojson`
2. The response is already GeoJSON FeatureCollection — extract features
3. Transform each feature into `AirspaceZone` using the `TYPE_CODE` → `AirspaceType` mapping
4. Cache for 24 hours (`s-maxage=86400, stale-while-revalidate=172800`) — this data changes every 28 days

**TFR fetch:**
1. Fetch the TFR list XML from `https://tfr.faa.gov/tfr2/list.html` or the XML feed
2. Parse the HTML/XML to extract active TFR NOTAM IDs
3. For each TFR, fetch the detail XML: `https://tfr.faa.gov/save_pages/detail_{id}.xml`
4. Extract geometry from the AIXM/XML — either center+radius (circular) or polygon coordinates
5. Extract effective times, type classification, description text
6. Transform into `AirspaceZone` objects
7. Cache TFR data for 5 minutes (`s-maxage=300, stale-while-revalidate=600`) — TFRs change frequently

**Merge & respond:**
```json
{
  "zones": [...AirspaceZone[]],
  "counts": {
    "restricted": 42,
    "prohibited": 5,
    "moa": 67,
    "warning": 31,
    "alert": 12,
    "tfr": 8
  },
  "timestamp": 1708819200000,
  "partial": false
}
```

**Error handling:**
- If SUA fetch fails but TFR succeeds → return TFRs only with `partial: true`
- If TFR fetch fails but SUA succeeds → return SUA only with `partial: true`
- If both fail → return 502
- TFR detail fetches use `Promise.allSettled` — individual TFR failures don't block the rest

**TFR XML parsing approach:**

TFR detail XMLs use AIXM-like structure. Key elements to extract:
- `<TFRAreaGroup>` → contains one or more areas
- `<txtName>` → TFR NOTAM ID
- `<codeType>` → maps to TFR type (SEC, VIP, HAZ, etc.)
- `<dateEffective>` / `<dateExpire>` → effective period
- `<TFRArea>` → contains geometry:
  - `<txtDescrUSNS>` → text description
  - `<avxCircle>` → center lat/lon + radius (nautical miles) for circular TFRs
  - `<avxArc>` / `<avxPoly>` → polygon points for complex shapes

For circular TFRs (most common), we generate a GeoJSON polygon by computing points around the center at the given radius. Use a helper function that takes `(lat, lon, radiusNm, numPoints=64)` and returns a polygon ring using the Haversine formula.

### Phase 3: Polling Hook (`src/hooks/useAirspaceData.ts`)

Follows the exact same pattern as `useSatelliteData`:

```typescript
function useAirspaceData(enabled: boolean): {
  zones: AirspaceZone[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  counts: Record<AirspaceType, number>;
}
```

- Poll interval: **5 minutes** (TFRs can change at any time, but 5 min is reasonable)
- When `enabled` is false: stop polling, preserve last data
- On failure: set error, preserve previous zones, continue polling
- Filter to only currently-active zones client-side (check `effectiveStart`/`effectiveEnd` against `Date.now()`)

### Phase 4: Map Overlay (`src/components/AirspaceOverlay.tsx`)

This component is fundamentally different from existing markers — it renders **polygons**, not point markers.

- Uses Leaflet's `L.geoJSON()` or individual `L.polygon()` / `L.circle()` layers
- Each zone gets a polygon overlay with fill color + stroke based on `AirspaceType`
- TFRs use dashed stroke (`dashArray: '8 4'`) to distinguish from permanent SUA
- Click handler on each polygon opens the AirspacePanel
- Selected zone gets highlighted stroke (thicker, brighter)
- Rendered in a custom pane `airspacePane` at z-index 420 (below satellites at 440)
- Viewport filtering: only render zones whose bounding box intersects the current map viewport
- Zoom gate: airspace overlays render at zoom >= 4 (they're area overlays, not useful at world view)

**Performance considerations:**
- SUA data is ~150-200 polygons (after filtering to restricted types only)
- TFRs are typically 30-80 active at any time
- Total ~200-280 polygons — well within Leaflet's capability without virtualization
- Use `React.memo` with a comparator checking zone `id`, `isActive`, and selection state

### Phase 5: Detail Panel (`src/components/AirspacePanel.tsx`)

Same slide-in layout as other panels (right sidebar desktop, bottom sheet mobile).

**Orange accent color** (`orange-400`) to distinguish from aircraft (amber), vessels (blue), and satellites (purple).

Displays:
- Zone name (e.g., "R-2301W Edwards AFB" or "TFR — VIP Movement")
- Type badge (color-coded: "Restricted", "Prohibited", "MOA", "TFR", etc.)
- TFR sub-type badge (for TFRs: "VIP", "Security", "Space Ops", etc.)
- Altitude range (e.g., "SFC to FL180")
- Schedule (SUA: "CONT" / "BY NOTAM" / specific times)
- Effective period (TFRs: start/end datetime in UTC and local)
- Active status indicator (green pulse if currently active)
- State/location
- Description text (TFR NOTAM text summary — truncated with expand)
- Source badge ("SUA" or "TFR")

### Phase 6: Filter Bar (`src/components/AirspaceFilterBar.tsx`)

Orange accent color (`#f97316`) to match the layer's identity.

Filters:
- **Type filter dropdown:** All / Restricted / Prohibited / MOA / Warning / Alert / TFR
- **TFR type filter:** (only shown when TFR selected or "All") All / VIP / Security / Hazard / Space / Event / National Defense
- **Active only toggle:** Show only currently-active zones (default: on)
- **Count display:** "Showing X of Y zones"

### Phase 7: Integration (`page.tsx`, `Map.tsx`, `LayerControl.tsx`, `StatusBar.tsx`)

**page.tsx additions:**
- `airspaceEnabled` state + `localStorage` persistence (`'overwatch-airspace-layer'`)
- `selectedAirspace` + `airspaceSignalLost` state
- Airspace filter state: `airspaceTypeFilter`, `tfrTypeFilter`, `airspaceActiveOnly`
- `useAirspaceData(airspaceEnabled)` hook integration
- `filteredAirspaceZones` via `useMemo`
- Mutual exclusivity: clicking airspace zone closes other panels

**Map.tsx additions:**
- Create `airspacePane` at z-index 420 (`map.createPane('airspacePane')`)
- Render `AirspaceOverlay` when layer enabled, passing filtered zones
- Viewport filtering for airspace zones
- Zoom gate at zoom >= 4

**LayerControl.tsx additions:**
- New airspace row: shield icon (🛡️ or SVG), "Airspace (count)" label, toggle switch
- Orange accent color
- Status dot: green = data loaded, yellow = loading, gray = off
- No API key required

**StatusBar.tsx additions:**
- When airspace layer enabled: show zone count in orange accent text

---

## Rendering Rules

1. **Only restricted airspace.** Never render class B/C/D/E or any non-restricted airspace.
2. **TFRs always on top** within the airspace pane (rendered after SUA polygons).
3. **Opacity decreases with severity:** Prohibited/TFR most opaque → Alert least opaque.
4. **Dashed stroke for TFRs** to visually separate temporal restrictions from permanent zones.
5. **No fill on inactive SUA zones** — stroke-only when `schedule === 'BY NOTAM'` and not currently active, so the map doesn't get cluttered with inactive areas.
6. **Click-to-select** opens panel. Only one zone selected at a time.
7. **Zoom gate at >= 4.** Below zoom 4, show "Zoom in to see airspace" notice (same pattern as vessels/satellites).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FAA_NOTAM_API_KEY` | *(none)* | Optional — for future FAA NOTAM API integration (server-side only) |

No new required environment variables. The SUA ArcGIS endpoint and TFR feed are both free with no auth.

---

## Dependencies

**No new dependencies required.** All parsing is done with:
- Native `fetch` for HTTP requests
- `DOMParser` or regex-based XML parsing server-side (Node.js built-in)
- Leaflet's built-in `L.geoJSON()` for polygon rendering (already a dependency)

If XML parsing proves too brittle with regex, consider adding `fast-xml-parser` (lightweight, zero-dep XML parser) to the allowed dependencies list.

---

## Caching Strategy

| Data | Server Cache | Rationale |
|---|---|---|
| SUA (ArcGIS) | 24 hours (`s-maxage=86400`) | Changes every 28 days on FAA NASR cycle |
| TFR list + details | 5 minutes (`s-maxage=300`) | TFRs issued/cancelled throughout the day |
| Combined response | 5 minutes (limited by TFR freshness) | Client polls every 5 min |

The proxy route should store SUA data in a module-level cache (like the satellite route's approach) and only re-fetch SUA data every 24 hours, while TFR data is always fresh-fetched on each request (with the 5-min HTTP cache layer).

---

## Implementation Order

1. `src/lib/airspaceTypes.ts` — types, colors, labels, helpers
2. `src/app/api/airspace/route.ts` — proxy route (SUA fetch first, then add TFR parsing)
3. `src/hooks/useAirspaceData.ts` — polling hook
4. `src/components/AirspaceOverlay.tsx` — polygon rendering on map
5. `src/components/Map.tsx` — add pane, integrate overlay
6. `src/components/AirspacePanel.tsx` — detail panel
7. `src/components/AirspaceFilterBar.tsx` — filter bar
8. `src/components/LayerControl.tsx` — add airspace row
9. `src/components/StatusBar.tsx` — add airspace count
10. `src/app/page.tsx` — full integration, state management, localStorage toggle

Build SUA support first (simpler, well-structured GeoJSON), then layer on TFR support (requires XML parsing, more complex geometry extraction).

---

## Testing Checklist

- [ ] SUA polygons render on map when layer toggled on
- [ ] Only restricted types appear (no class B/C/D/E airspace)
- [ ] TFR circles and polygons render with dashed stroke
- [ ] Clicking a zone opens the detail panel
- [ ] Type filter correctly filters displayed zones
- [ ] Active-only toggle hides expired/inactive zones
- [ ] Layer toggle persists in localStorage
- [ ] Disabling layer stops polling
- [ ] Partial failure (SUA ok, TFR down) shows SUA with warning
- [ ] Zoom gate hides overlays below zoom 4
- [ ] Viewport filtering works (off-screen zones not rendered)
- [ ] Selecting airspace zone closes any open aircraft/vessel/satellite panel
- [ ] Mobile bottom sheet layout works for AirspacePanel
- [ ] Status bar shows zone count when layer active
