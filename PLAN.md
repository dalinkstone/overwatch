# PLAN.md — Claude Code Build Prompts

These prompts are designed to be copied one at a time into Claude Code in sequence. Each prompt builds on the output of the previous one. Wait for each step to complete and verify it works before moving to the next.

---

## Prompt 1: Project Scaffold

```
Read CLAUDE.md in this repo first — it has all the conventions and technical details you need.

Initialize a Next.js 14 project in this directory with the App Router, TypeScript, Tailwind CSS, and ESLint. Use these exact settings:

- src/ directory: yes
- App Router: yes  
- Tailwind CSS: yes
- ESLint: yes
- Import alias: @/*

Then install these additional dependencies:
- leaflet@1
- react-leaflet@4
- @types/leaflet

Create the following file structure (empty files are fine for now, we'll fill them in subsequent steps):

src/
  app/
    layout.tsx        (root layout with html/body, import globals.css)
    page.tsx           (placeholder: just render <h1>Overwatch</h1>)
    api/
      aircraft/
        route.ts       (placeholder: export async function GET that returns { status: "ok" })
  components/          (empty dir)
  hooks/               (empty dir)
  lib/
    types.ts           (empty file)
    api.ts             (empty file)
    utils.ts           (empty file)
  styles/
    globals.css        (Tailwind directives: @tailwind base/components/utilities)
public/
  icons/               (empty dir)

Create .env.example with these variables:
NEXT_PUBLIC_API_BASE_URL=https://api.adsb.lol
POLL_INTERVAL_MS=10000
NEXT_PUBLIC_DEFAULT_LAT=38.9
NEXT_PUBLIC_DEFAULT_LNG=-77.0
NEXT_PUBLIC_DEFAULT_ZOOM=5

Copy .env.example to .env.local.

Run `npm run dev` to verify the app starts on localhost:3000 without errors. Run `npm run build` to confirm it compiles. Fix any issues.
```

---

## Prompt 2: TypeScript Types and API Utility Layer

```
Read CLAUDE.md for the ADSB.lol API field reference.

Fill in src/lib/types.ts with TypeScript interfaces for the ADSB.lol v2 API response. Define:

1. `AircraftState` interface — all the fields a single aircraft can have from the /v2/mil endpoint. Key fields: hex (string), flight (string, optional), lat (number, optional), lon (number, optional), alt_baro (number | "ground", optional), alt_geom (number, optional), gs (number, optional — ground speed), track (number, optional), t (string, optional — ICAO type code), r (string, optional — registration), dbFlags (number, optional), squawk (string, optional), seen (number, optional), seen_pos (number, optional), category (string, optional). Mark position and telemetry fields as optional because not all aircraft broadcast all fields.

2. `AircraftResponse` interface — the top-level response: ac (AircraftState[]), msg (string), now (number), total (number), ctime (number), ptime (number).

3. A type guard function `hasPosition(aircraft: AircraftState): boolean` that returns true only if lat and lon are both defined and are numbers.

4. A helper `isMilitary(aircraft: AircraftState): boolean` that checks `(aircraft.dbFlags & 1) !== 0`.

Now fill in src/lib/utils.ts with these pure helper functions:
- `formatAltitude(alt: number | "ground" | undefined): string` — returns "Ground" for "ground", "N/A" for undefined, or the number formatted with commas + " ft" suffix
- `formatSpeed(gs: number | undefined): string` — "N/A" for undefined, or number with " kts" suffix
- `formatCallsign(flight: string | undefined): string` — trim whitespace, return "UNKNOWN" if empty/undefined
- `getAircraftLabel(ac: AircraftState): string` — returns the callsign if available, otherwise the registration, otherwise the hex code

Fill in src/lib/api.ts:
- Export `async function fetchMilitaryAircraft(): Promise<AircraftResponse>` that fetches from `/api/aircraft` (our local proxy route, NOT the external API directly). Parse the JSON response, validate it has an `ac` array, and return it. Throw a descriptive error if the response is not ok or malformed.

Run `npm run type-check` to verify everything compiles with no errors. Fix any issues.
```

---

## Prompt 3: API Proxy Route

```
Read CLAUDE.md for API proxy pattern details.

Implement src/app/api/aircraft/route.ts as the proxy between our frontend and ADSB.lol:

- Export an async GET handler using Next.js App Router route handler conventions (import { NextResponse } from 'next/server')
- Read the upstream base URL from process.env.NEXT_PUBLIC_API_BASE_URL, defaulting to "https://api.adsb.lol"
- Fetch GET {baseUrl}/v2/mil with a 15-second timeout using AbortController
- On success: forward the JSON body to the client with these response headers:
  - Cache-Control: public, s-maxage=5, stale-while-revalidate=10
  - Content-Type: application/json
- On fetch error (network failure, timeout): return a 502 JSON response: { error: "Upstream API unavailable", details: error.message }
- On non-200 upstream response: return a 502 JSON response with the upstream status code in the details
- Wrap everything in try/catch

Test by running the dev server and hitting http://localhost:3000/api/aircraft in the browser. You should see a JSON response with an "ac" array containing military aircraft objects. Verify the response contains aircraft with lat/lon coordinates. If the upstream API is temporarily down, verify you get a clean 502 error. Fix any issues.
```

---

## Prompt 4: Aircraft Plane Icon

```
Create a simple SVG aircraft icon at public/icons/aircraft.svg. It should be:
- A top-down silhouette of a fixed-wing aircraft (like a fighter jet or generic military plane)
- Pointing upward (north / 0 degrees) so we can rotate it with CSS transform
- Viewbox 0 0 24 24, solid black fill
- Simple and clean — about 1-2 path elements, no gradients or complex shapes

Keep it minimal. This will be used as a Leaflet DivIcon and rotated via CSS to match the aircraft's heading.
```

---

## Prompt 5: Map Component with Aircraft Markers

```
Read CLAUDE.md for the Leaflet setup requirements (dynamic import, no SSR, react-leaflet v4).

Create src/components/AircraftMarker.tsx:
- A React.memo'd component that receives a single AircraftState and an onClick callback
- Only render if the aircraft has a valid position (use the hasPosition type guard from lib/types.ts)
- Use Leaflet's DivIcon to create a custom marker:
  - The icon should be the aircraft.svg loaded as an inline SVG (use a template string with the SVG markup, not an <img> tag, so we can apply rotation)
  - Rotate the SVG by the aircraft's `track` degrees using CSS transform: rotate({track}deg)
  - Icon size: 24x24, icon anchor: 12x12 (centered)
  - Color the SVG: use a green fill (#22c55e) for aircraft on the ground (alt_baro === "ground"), a blue fill (#3b82f6) for aircraft below 10000 ft, and a default fill (#ef4444 red) for aircraft above 10000 ft
- The Marker's Popup should show: callsign (formatted), type code, registration, altitude, speed
- On click, call the onClick callback with the aircraft

Create src/components/Map.tsx:
- A client component ("use client")
- Import leaflet CSS: import 'leaflet/dist/leaflet.css'
- Use MapContainer from react-leaflet with center from env defaults and zoom from env defaults
- Add a TileLayer using OpenStreetMap: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png with attribution "© OpenStreetMap contributors"
- Accept props: aircraft (AircraftState[]) and onAircraftClick callback
- Render an AircraftMarker for each aircraft that has a position
- Key each marker by its hex code
- The map should fill its container (height: 100%, width: 100%)

Create src/components/MapWrapper.tsx (or use next/dynamic in the parent):
- Dynamically import Map.tsx with { ssr: false } using next/dynamic
- Show a loading placeholder while the map loads ("Loading map...")
- Export this as the component that page.tsx will use

Fix the known Leaflet + Next.js default marker icon issue: Leaflet's default icon paths break with webpack. Since we're using custom DivIcon markers, this shouldn't be a problem, but verify there are no console errors about missing marker images.

Run the dev server and verify the map renders on the page with OpenStreetMap tiles and no console errors. The map won't have aircraft yet — that's the next step.
```

---

## Prompt 6: Polling Hook and Main Page Integration

```
Create src/hooks/useAircraftData.ts:
- A custom hook that polls our /api/aircraft proxy endpoint on an interval
- State: aircraft (AircraftState[]), loading (boolean), error (string | null), lastUpdated (Date | null), totalCount (number)
- On mount: immediately fetch once, then set up setInterval with POLL_INTERVAL_MS (default 10000, read from process.env.NEXT_PUBLIC_POLL_INTERVAL_MS or just hardcode 10000)
- On each successful fetch: update aircraft array with only aircraft that have positions (filter using hasPosition), update totalCount from response.total, set lastUpdated to now, clear any error
- On fetch failure: set error message, keep the previous aircraft data (don't clear the map), continue polling
- Cleanup: clear the interval on unmount
- Return { aircraft, loading, error, lastUpdated, totalCount }

Create src/components/StatusBar.tsx:
- Shows: total aircraft count, aircraft with positions count, last updated time (formatted as HH:MM:SS), connection status (green dot if no error, red dot if error, with error message)
- Fixed to the top of the viewport, full width, dark background (zinc-900), white text, small font
- Use a simple flexbox row layout: left side shows counts, right side shows last updated + status

Now update src/app/page.tsx to bring it all together:
- Make it a client component ("use client")
- Use the useAircraftData hook
- Layout: StatusBar at top, then a flex container filling the remaining viewport height
- The map takes up the full remaining space
- Render MapWrapper (the dynamic import wrapper) passing the aircraft array
- For now, don't worry about the detail panel or filters — just get planes on the map

Run the dev server. You should see:
1. The status bar at the top with aircraft counts updating every 10 seconds
2. A full-screen map with red/blue/green plane icons scattered across the globe
3. Clicking a plane should show a popup with its details
4. No console errors

This is the critical integration step. Make sure everything works end to end. Fix any issues with marker rendering, icon rotation, or data flow.
```

---

## Prompt 7: Aircraft Detail Panel

```
Create src/components/AircraftPanel.tsx:
- A slide-in panel on the right side of the screen that shows when an aircraft is selected
- Props: aircraft (AircraftState | null), onClose callback
- When aircraft is null, don't render (or render hidden)
- Panel content — display these fields in a clean layout:
  - Callsign (large, bold, at top)
  - ICAO Hex code
  - Registration (tail number)
  - Aircraft type code
  - Altitude (formatted)
  - Ground speed (formatted)
  - Heading/track (degrees)
  - Squawk code
  - Coordinates (lat, lon to 4 decimal places)
  - "Last seen" — aircraft.seen seconds ago
  - Military badge (always yes, since we're filtering for military)
- Include a close button (X) in the top right corner
- Style: dark panel (zinc-800), white text, rounded left corners, 320px wide, absolutely positioned on the right side overlaying the map, with a subtle shadow
- Transition: slide in from the right when an aircraft is selected

Update src/app/page.tsx:
- Add selectedAircraft state (AircraftState | null)
- Pass an onAircraftClick handler to the map that sets the selected aircraft
- Render AircraftPanel with the selected aircraft and a close handler
- When the aircraft data refreshes (new poll), if there's a selected aircraft, update its data from the new poll results by matching on hex code. If the aircraft disappears from the data, keep showing the last known state but add a "Signal lost" indicator.

Test: click a plane on the map, verify the panel slides in with correct data. Close it with X. Verify data updates on the next poll cycle.
```

---

## Prompt 8: Aircraft-Type-Specific Icons

```
Read CLAUDE.md for the Aircraft Icon Classification System section — it has the full category list, type code mappings, and icon size rules.

Create src/lib/aircraftIcons.ts with:

1. An `AircraftCategory` type union: 'fighter' | 'tanker-transport' | 'helicopter' | 'surveillance' | 'trainer' | 'bomber' | 'uav' | 'unknown'

2. A `AIRCRAFT_TYPE_MAP` constant — a Record<string, AircraftCategory> mapping known ICAO type codes to categories. Include at least these mappings:
   - fighter: F16, F15, F15C, F15E, FA18, F18, F22, F35, A10, F117, EF2K (Eurofighter), TORN (Tornado), SU27, SU30, MIG29, JF17, J10, R1 (Rafale)
   - tanker-transport: KC135, KC46, KC10, KC30, C17, C5, C130, C130J, C12, C37, C40, C2, A400, AN124, IL76
   - helicopter: UH60, AH64, CH47, CH53, V22, HH60, MH60, OH58, AH1, SH60, NH90, H60, S70 (Blackhawk variant)
   - surveillance: E3, E8, E6, RC135, EP3, P8, P3, U2, E2, AWACS, EA18G, E4
   - trainer: T38, T6, T45, T1, PC12, T7, PC21
   - bomber: B52, B1, B2, B21
   - uav: RQ4, MQ9, MQ1, RQ7, MQ4, HRON (Global Hawk variant)

3. A `getAircraftCategory(typeCode: string | undefined): AircraftCategory` function that:
   - Returns 'unknown' if typeCode is undefined or empty
   - Normalizes the type code to uppercase
   - Checks for exact match in AIRCRAFT_TYPE_MAP first
   - Then checks for prefix matches (e.g., "F15C" matches "F15" → fighter; "C130J" matches "C130" → tanker-transport)
   - Returns 'unknown' if no match

4. An `ICON_SIZES` constant mapping each AircraftCategory to { size: [number, number], anchor: [number, number] }:
   - fighter: size [24,24], anchor [12,12]
   - tanker-transport: size [32,32], anchor [16,16]
   - helicopter: size [24,24], anchor [12,12]
   - surveillance: size [28,28], anchor [14,14]
   - trainer: size [20,20], anchor [10,10]
   - bomber: size [32,32], anchor [16,16]
   - uav: size [20,20], anchor [10,10]
   - unknown: size [24,24], anchor [12,12]

5. A `getAircraftIconSvg(category: AircraftCategory, color: string): string` function that returns inline SVG markup for each category. Each SVG should:
   - Be a top-down silhouette pointing north (up)
   - Use the provided color as fill
   - Be sized to fit within its category's icon dimensions
   - Be visually distinct so users can tell categories apart at a glance:
     - fighter: swept delta wings, narrow fuselage, small tail
     - tanker-transport: straight wide wings, fat fuselage, T-tail
     - helicopter: rotor disc circle on top, narrow fuselage, tail boom
     - surveillance: similar to transport but with a distinctive radome disc on top
     - trainer: small, simple straight-wing aircraft
     - bomber: large swept wings, wide fuselage
     - uav: small delta/flying wing shape, no tail
     - unknown: current generic aircraft shape

Now update src/components/AircraftMarker.tsx:
- Import getAircraftCategory, getAircraftIconSvg, and ICON_SIZES from aircraftIcons.ts
- Determine the aircraft category using getAircraftCategory(aircraft.t)
- Use getAircraftIconSvg(category, color) instead of the hardcoded SVG
- Use ICON_SIZES[category] for the DivIcon iconSize and iconAnchor instead of hardcoded 24x24
- The altitude-based color logic stays the same
- The track rotation stays the same

Update the AircraftPanel to show the aircraft category as a badge (e.g., "Fighter", "Tanker/Transport", "Helicopter") below the type code field.

Update the popup in AircraftMarker to include the category.

Test: Run the dev server. You should see different icon shapes for different aircraft types. Look for:
- KC-135s or C-17s should have the wider transport icon
- Helicopters (UH-60, etc.) should have the rotor disc icon
- F-16s or F-15s should have the fighter silhouette
- Unknown types should fall back to the generic icon
Verify no console errors and icons rotate correctly.
```

---

## Prompt 9: Filter Bar

```
Create src/components/FilterBar.tsx:
- A horizontal bar below the StatusBar with filter controls
- Filters:
  1. Search box — filters by callsign, registration, hex code, or type (case-insensitive substring match)
  2. Altitude filter — dropdown with options: "All altitudes", "Ground only", "Below 10,000 ft", "10,000–30,000 ft", "Above 30,000 ft"
  3. Category filter — dropdown with options: "All types", "Fighter", "Tanker/Transport", "Helicopter", "Surveillance", "Trainer", "Bomber", "UAV", "Unknown"
  4. Aircraft count display showing "Showing X of Y military aircraft"
- Style: dark background (zinc-800), compact, single row, inputs have dark styling to match

Add filter state to page.tsx (searchQuery: string, altitudeFilter: string, categoryFilter: string) and pass them down. Apply filters to the aircraft array before passing to the Map component. The filtering should happen in page.tsx, not inside the hook or the map.

The StatusBar and FilterBar should be visually connected — StatusBar on top, FilterBar directly below, then the map fills the rest.

Test all filter combinations. Verify that:
- Typing a callsign narrows the displayed aircraft
- The altitude dropdown works correctly
- The category filter works correctly
- The "Showing X of Y" count updates in real time
- Clearing filters brings back all aircraft
```

---

## Prompt 10: Polish and Error States

```
Do a full review of the app and address these items:

1. Loading state: When the app first loads and hasn't fetched data yet, show a centered loading spinner or "Loading aircraft data..." message over the map area.

2. Error state: If the API is completely unreachable, show a non-blocking banner below the filter bar: "Unable to reach aircraft data source. Retrying..." with the last successful update time. The map should still show the last known aircraft positions.

3. Empty state: If the API returns 0 military aircraft (unlikely but possible), show "No military aircraft currently broadcasting" centered on the map.

4. Map attribution: Verify OpenStreetMap attribution is visible. Add "Data: ADSB.lol contributors (ODbL)" to the attribution string.

5. Favicon: Create a simple favicon. Use the aircraft SVG as a 32x32 favicon.ico or use a simple emoji-based SVG favicon.

6. Page metadata: In layout.tsx, set the page title to "Overwatch — Military Movement Tracker" and add a meta description.

7. Responsive: The app should be usable on mobile. On screens narrower than 768px, make the AircraftPanel full-width instead of a side panel (slide up from bottom). The FilterBar search input should be full width on mobile.

8. Verify there are no TypeScript errors (`npm run type-check`), no ESLint errors (`npm run lint`), and the production build succeeds (`npm run build`).

Fix everything and confirm the app runs cleanly.
```

---

## Prompt 11: Final Verification

```
Do a final end-to-end check of the entire application:

1. Delete node_modules and .next, run npm install, then npm run build — it should succeed with no errors or warnings.

2. Run npm run dev and verify:
   - Map loads with OpenStreetMap tiles
   - Military aircraft appear within 10 seconds with type-specific icons
   - Fighter jets have a different icon from transports, helicopters, etc.
   - Icons are rotated to match their heading
   - Clicking an aircraft shows the detail panel with correct information and category badge
   - The status bar shows accurate counts and updates every 10 seconds
   - The search filter works (try filtering by "C17" or a visible callsign)
   - The altitude filter works
   - The category filter works (try "Helicopter" or "Fighter")
   - The error state works (temporarily change the API URL to something invalid in .env.local, verify the error banner appears, then change it back)

3. Run npm run lint and npm run type-check — both should pass with zero errors.

4. Verify the README.md accurately describes the current state of the project.

If anything is broken, fix it. The app should be fully functional and clean.
```

---

## Prompt 12: Maritime Vessel Tracking Layer (AIS)

```
Read CLAUDE.md for the Maritime Vessel Tracking section.

This prompt adds the first additional data layer: military vessel tracking via AIS data.

1. Create src/lib/maritimeTypes.ts:
   - `VesselState` interface: mmsi (string), name (string, optional), lat (number, optional), lon (number, optional), cog (number, optional — course over ground), sog (number, optional — speed over ground), heading (number, optional), vesselType (number, optional), flag (string, optional), destination (string, optional), lastUpdate (number, optional)
   - `VesselResponse` interface: appropriate wrapper for whatever API we use
   - `hasVesselPosition(vessel)` type guard
   - `isMilitaryVessel(vessel)` helper — checks MMSI range (338-369 prefix for US Navy) and vesselType codes (35, 55)

2. Create src/app/api/vessels/route.ts:
   - Same proxy pattern as aircraft route
   - Proxy to a free AIS data source
   - 15-second timeout, cache headers, structured error handling

3. Create src/hooks/useVesselData.ts:
   - Same polling pattern as useAircraftData
   - 30-second polling interval (vessel data updates less frequently)
   - Returns { vessels, loading, error, lastUpdated, totalCount }

4. Create src/components/VesselMarker.tsx:
   - Ship silhouette icon (top-down, pointing north)
   - Rotated by heading/cog
   - Distinct color scheme from aircraft (e.g., cyan/teal tones)
   - Popup with vessel name, MMSI, type, speed, destination

5. Update Map.tsx to accept and render vessel markers alongside aircraft markers.

6. Add a "Vessels" toggle to the layer control (we'll build a proper LayerControl component in a later prompt — for now, a simple checkbox in the FilterBar or StatusBar area).

7. Update page.tsx to manage vessel data with the new hook, respecting the layer toggle.

Test: Enable the vessel layer. You should see ship icons on the map, concentrated around coastlines and shipping lanes. Verify they don't interfere with aircraft markers. Verify the vessel layer can be toggled on/off independently.
```

---

## Prompt 13: Satellite Tracking Layer

```
Read CLAUDE.md for the Satellite Tracking section.

Install satellite.js: npm install satellite.js

1. Create src/lib/satelliteTypes.ts:
   - `SatelliteState` interface: noradId (string), name (string), tle1 (string), tle2 (string), lat (number), lon (number), altitude (number — km), velocity (number — km/s), category (string — 'gps' | 'military' | 'comms' | 'recon')
   - Helper to compute current lat/lon/alt from TLE using satellite.js SGP4 propagator

2. Create src/app/api/satellites/route.ts:
   - Proxy to CelesTrak's military satellite catalog: https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=json
   - Also fetch GPS constellation: https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=json
   - Cache for 5 minutes (TLE data changes slowly)
   - Parse the GP (General Perturbations) JSON format from CelesTrak

3. Create src/hooks/useSatelliteData.ts:
   - Fetch TLEs once every 5 minutes (they don't change fast)
   - Propagate positions client-side every 5 seconds using satellite.js for smooth movement
   - Returns { satellites, loading, error }

4. Create src/components/SatelliteMarker.tsx:
   - Small diamond or dot icon
   - Color by category (GPS = green, military = red, comms = blue, recon = yellow)
   - Popup with satellite name, NORAD ID, altitude, velocity
   - Optional: show orbit ground track as a polyline

5. Update Map.tsx and page.tsx for the satellite layer with toggle.

Test: Enable satellite layer. You should see dots representing military satellites moving slowly across the map. GPS satellites should form a recognizable constellation pattern. Verify satellite positions look reasonable (LEO satellites at ~200-2000km altitude should move visibly every few seconds).
```

---

## Prompt 14: Conflict Event Layer (GDELT)

```
Read CLAUDE.md for the Conflict/Event Data section.

1. Create src/lib/conflictTypes.ts:
   - `ConflictEvent` interface: id (string), lat (number), lon (number), date (string), eventType (string), description (string), source (string), url (string, optional), intensity (number — 1-10 scale)

2. Create src/app/api/conflicts/route.ts:
   - Proxy to GDELT GEO 2.0 API: https://api.gdeltproject.org/api/v2/geo/geo?query=military+conflict&mode=pointdata&format=geojson&timespan=24h
   - Parse GeoJSON response into ConflictEvent array
   - Cache for 15 minutes (conflict data doesn't need real-time updates)

3. Create src/hooks/useConflictData.ts:
   - Fetch once on mount, then every 15 minutes
   - Returns { events, loading, error }

4. Create src/components/ConflictMarker.tsx:
   - Small circle marker with intensity-based sizing
   - Red/orange/yellow coloring based on event intensity
   - Popup with event description, date, source, and link to original article
   - Optional: pulse animation for events in the last hour

5. Update Map.tsx and page.tsx for the conflict layer with toggle.

Test: Enable the conflict layer. You should see markers concentrated in active conflict zones. Verify popups show meaningful event descriptions. Verify the layer can be toggled independently.
```

---

## Prompt 15: Layer Control Panel + NOTAM Overlay

```
1. Create src/components/LayerControl.tsx:
   - A floating panel (bottom-left or top-right of map) with toggles for each data layer
   - Each layer shows: name, icon, on/off toggle, count of visible items, last updated time
   - Layers: Aircraft (on by default), Vessels, Satellites, Conflicts, NOTAMs
   - Persist toggle state to localStorage
   - Compact, dark theme (zinc-800), rounded corners, semi-transparent backdrop
   - Collapsible (click to expand/collapse the layer list)

2. Create src/app/api/notams/route.ts:
   - Proxy to FAA TFR data
   - Parse TFR boundaries into GeoJSON polygons/circles
   - Cache for 30 minutes

3. Create src/components/NotamOverlay.tsx:
   - Render TFRs as semi-transparent shaded areas on the map
   - Red/orange coloring
   - Click to see TFR details (reason, altitude range, effective dates)

4. Refactor page.tsx:
   - Centralize all layer state into a single `dataLayers` state object
   - Each layer's hook only runs when enabled
   - LayerControl reads and writes to this state
   - All marker arrays passed to Map based on which layers are active

5. Move individual filter state (search, altitude, category) into a unified filter system that works across relevant layers.

Test: Verify all layers can be toggled independently. Verify disabled layers stop polling. Verify the layer control shows accurate counts. Verify TFR overlays render correctly over the map.
```

---

## Prompt 16: Final Polish and Deployment Prep

```
Do a comprehensive final review:

1. Performance: With multiple data layers active, verify the map remains responsive. Profile rendering performance in Chrome DevTools. Add React.memo where needed.

2. Mobile: All layer controls should be usable on mobile. The LayerControl should collapse to a small button on mobile.

3. Error handling: Each layer should fail independently. If the vessel API is down, aircraft should still work. Verify this by temporarily breaking one API route.

4. Attribution: Update map attribution to credit all data sources: "Map: © OpenStreetMap | Aircraft: ADSB.lol (ODbL) | Vessels: AIS data | Satellites: CelesTrak | Events: GDELT"

5. README: Update README.md to document all data layers, their sources, and how to enable/disable them.

6. Build: Delete node_modules and .next, run npm install, npm run build — should succeed cleanly.

7. Type-check and lint: Both should pass with zero errors.

The app should be a comprehensive military movement dashboard with multiple independent data layers, all using publicly available data, no paid API keys required.
```

---

## Notes for the Operator

- **Run prompts sequentially.** Each prompt assumes the previous one completed successfully.
- **Verify after each prompt.** Don't move to the next step until the current one is working. Claude Code sometimes introduces subtle issues that compound.
- **If ADSB.lol is temporarily down:** swap `NEXT_PUBLIC_API_BASE_URL` to `https://api.adsb.one` in `.env.local`. Same endpoints, same format.
- **Prompts 1-11 are the core aircraft tracker.** This is the MVP and should be completed first.
- **Prompts 12-16 add additional data layers.** These are independent and can be done selectively. Maritime (12) is the highest value addition after aircraft.
- **Expected result after all prompts:** A multi-layer military movement intelligence dashboard showing aircraft, vessels, satellites, conflict events, and airspace restrictions on a live map. No paid accounts, no paid API keys, no billing.
