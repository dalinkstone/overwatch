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

## Prompt 8: Filter Bar

```
Create src/components/FilterBar.tsx:
- A horizontal bar below the StatusBar with filter controls
- Filters:
  1. Search box — filters by callsign, registration, hex code, or type (case-insensitive substring match)
  2. Altitude filter — dropdown with options: "All altitudes", "Ground only", "Below 10,000 ft", "10,000–30,000 ft", "Above 30,000 ft"
  3. Aircraft count display showing "Showing X of Y military aircraft"
- Style: dark background (zinc-800), compact, single row, inputs have dark styling to match

Add filter state to page.tsx (searchQuery: string, altitudeFilter: string) and pass them down. Apply filters to the aircraft array before passing to the Map component. The filtering should happen in page.tsx, not inside the hook or the map.

The StatusBar and FilterBar should be visually connected — StatusBar on top, FilterBar directly below, then the map fills the rest.

Test all filter combinations. Verify that:
- Typing a callsign narrows the displayed aircraft
- The altitude dropdown works correctly
- The "Showing X of Y" count updates in real time
- Clearing filters brings back all aircraft
```

---

## Prompt 9: Polish and Error States

```
Do a full review of the app and address these items:

1. Loading state: When the app first loads and hasn't fetched data yet, show a centered loading spinner or "Loading aircraft data..." message over the map area.

2. Error state: If the API is completely unreachable, show a non-blocking banner below the filter bar: "Unable to reach aircraft data source. Retrying..." with the last successful update time. The map should still show the last known aircraft positions.

3. Empty state: If the API returns 0 military aircraft (unlikely but possible), show "No military aircraft currently broadcasting" centered on the map.

4. Map attribution: Verify OpenStreetMap attribution is visible. Add "Data: ADSB.lol contributors (ODbL)" to the attribution string.

5. Favicon: Create a simple favicon. Use the aircraft SVG as a 32x32 favicon.ico or use a simple emoji-based SVG favicon.

6. Page metadata: In layout.tsx, set the page title to "Overwatch — Military Aircraft Tracker" and add a meta description.

7. Responsive: The app should be usable on mobile. On screens narrower than 768px, make the AircraftPanel full-width instead of a side panel (slide up from bottom). The FilterBar search input should be full width on mobile.

8. Verify there are no TypeScript errors (`npm run type-check`), no ESLint errors (`npm run lint`), and the production build succeeds (`npm run build`).

Fix everything and confirm the app runs cleanly.
```

---

## Prompt 10: Final Verification

```
Do a final end-to-end check of the entire application:

1. Delete node_modules and .next, run npm install, then npm run build — it should succeed with no errors or warnings.

2. Run npm run dev and verify:
   - Map loads with OpenStreetMap tiles
   - Military aircraft appear within 10 seconds as colored plane icons
   - Icons are rotated to match their heading
   - Clicking an aircraft shows the detail panel with correct information
   - The status bar shows accurate counts and updates every 10 seconds
   - The search filter works (try filtering by "C17" or a visible callsign)
   - The altitude filter works
   - The error state works (temporarily change the API URL to something invalid in .env.local, verify the error banner appears, then change it back)

3. Run npm run lint and npm run type-check — both should pass with zero errors.

4. Verify the README.md accurately describes the current state of the project.

If anything is broken, fix it. The app should be fully functional and clean.
```

---

## Notes for the Operator

- **Run prompts sequentially.** Each prompt assumes the previous one completed successfully.
- **Verify after each prompt.** Don't move to the next step until the current one is working. Claude Code sometimes introduces subtle issues that compound.
- **If ADSB.lol is temporarily down:** swap `NEXT_PUBLIC_API_BASE_URL` to `https://api.adsb.one` in `.env.local`. Same endpoints, same format.
- **Expected result after all prompts:** A fully functional single-page app that shows military aircraft on a live map, with filtering, detail panels, and auto-refresh. No accounts, no API keys, no billing.
