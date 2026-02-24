# PLAN.md — Vessel Tracking Layer (Claude Code Build Prompts)

These prompts are designed to be copied one at a time into Claude Code in sequence. Each prompt builds on the output of the previous one. Wait for each step to complete and verify it works before moving to the next.

**Prerequisites:** The core Overwatch aircraft tracker (Prompts 1–10 from the original PLAN.md plus any subsequent aircraft icon and flag work) must be fully complete and working before starting these prompts.

**Data source:** [aisstream.io](https://aisstream.io) — a free, real-time AIS (Automatic Identification System) WebSocket API that streams vessel positions from a global network of terrestrial AIS stations. Coverage extends ~200km from coastlines. Free API key required.

---

## Pre-Build Setup (Do This Before Running Any Prompts)

Before running Prompt 1, the operator must have an aisstream.io API key ready:

1. Go to https://aisstream.io and create a free account
2. Copy your API key from the dashboard
3. The key will go into `.env.local` during Prompt 1 — just have it on hand

---

## Prompt 1: Environment Configuration and Dependency

```
Read CLAUDE.md in this repo first — it has all the conventions and technical details you need.

We are adding a maritime vessel tracking layer to Overwatch using the aisstream.io WebSocket API. This prompt sets up environment configuration and installs the one new dependency we need.

1. Install the `ws` package for server-side WebSocket connections:
   npm install ws
   npm install -D @types/ws

2. Update `.env.example` — ADD the following lines to the EXISTING file. Do not remove or modify any existing variables. Append this block at the end:

   # --- Vessel Tracking (aisstream.io) ---
   # Required for the maritime vessel tracking layer.
   # Get a free API key at https://aisstream.io
   # 1. Copy this file to .env.local:  cp .env.example .env.local
   # 2. Paste your aisstream.io API key below
   # 3. Restart the dev server (Next.js only reads .env.local at startup)
   AISSTREAM_API_KEY=your_aisstream_api_key_here

3. Copy `.env.example` to `.env.local` (overwriting the existing one so it picks up the new variable). Then fill in the AISSTREAM_API_KEY value from the environment variable that is already set in the shell (check $AISSTREAM_API_KEY from ~/.zshrc). If the env var is not set in the shell, leave the placeholder — the vessel layer will gracefully degrade.

4. Update `.gitignore` — verify `.env.local` is listed. It should already be there for a Next.js project, but confirm.

5. Create `src/lib/env.ts` with two exported functions:
   - `getAisStreamApiKey(): string` — reads `process.env.AISSTREAM_API_KEY`, returns the key string or empty string if missing/undefined
   - `isVesselTrackingEnabled(): boolean` — returns true only if `getAisStreamApiKey()` returns a non-empty string

   These are server-side only functions. They must not be prefixed with NEXT_PUBLIC_ because the API key must never reach the browser.

6. Update the project README.md — add a "Vessel Tracking Setup" section under whatever setup/configuration section exists. Keep it short:

   ### Vessel Tracking Setup
   
   The vessel tracking layer requires a free API key from aisstream.io:
   
   1. Register at https://aisstream.io and copy your API key
   2. Copy the environment template: `cp .env.example .env.local`
   3. Open `.env.local` and set `AISSTREAM_API_KEY=your_key_here`
   4. Restart the dev server — the vessel layer toggle will become active
   
   Without an API key, the vessel layer toggle will appear disabled. All other features work normally.

7. Update CLAUDE.md — in the "Allowed Dependencies" section, add `ws` and `@types/ws` to the list. In the "Architecture Rules" section, update the line that says "No API keys are needed" to instead say:

   - **API keys.** ADSB.lol requires no authentication. The vessel tracking layer requires a free API key from aisstream.io, stored in `AISSTREAM_API_KEY` in `.env.local`. The key is server-side only — never prefix it with `NEXT_PUBLIC_`.

Test: Run `npm run build` — should succeed with no errors even if AISSTREAM_API_KEY is empty or missing. Run `npm run dev` — should start normally. The vessel layer is not wired up yet, so nothing visible changes.
```

---

## Prompt 2: Vessel Types and Military Identification Logic

```
Read CLAUDE.md for project conventions.

Create `src/lib/vesselTypes.ts` with type definitions and military vessel identification logic for the AIS vessel tracking layer. This is a pure types-and-functions file with no side effects.

1. Define a `VesselData` interface:
   - mmsi: string (9-digit Maritime Mobile Service Identity — the unique vessel ID)
   - name: string (vessel name from AIS broadcast, may be empty)
   - lat: number
   - lon: number
   - cog: number (course over ground in degrees, 0-360)
   - sog: number (speed over ground in knots)
   - heading: number (true heading in degrees — value 511 means "not available")
   - shipType: number (AIS ship type code, 0-99)
   - destination: string (self-reported destination, may be empty)
   - flag: string (country name derived from MMSI's MID digits)
   - isMilitary: boolean
   - militaryCategory: string ('warship' | 'coast-guard' | 'military-support' | 'law-enforcement' | '')
   - lastUpdate: number (unix timestamp in milliseconds)

2. Define a `VesselCategory` type union:
   'military' | 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'tug' | 'highspeed' | 'pleasure' | 'other'

3. Create `getVesselCategory(shipType: number): VesselCategory`:
   Map the first digit of the AIS type code to a category:
   - 30 → 'fishing'
   - 31, 32, 52 → 'tug' (towing/tug)
   - 35 → 'military'
   - 36, 37 → 'pleasure'
   - 40-49 → 'highspeed'
   - 55 → 'military' (law enforcement — we group with military for display)
   - 60-69 → 'passenger'
   - 70-79 → 'cargo'
   - 80-89 → 'tanker'
   - Everything else → 'other'

4. Create `getMIDFromMMSI(mmsi: string): string`:
   Standard ship MMSIs have format MIDxxxxxx where MID is the first 3 digits (the Maritime Identification Digits indicating the vessel's flag state). Return the first 3 characters of the MMSI string.

5. Create `getCountryFromMID(mid: string): string` with a lookup object for the major maritime and naval nations. Include at least these MID → country name mappings:
   - '201'-'212': Albania through Cyprus (individually mapped)
   - '226','227': France
   - '230': Finland
   - '231','232': UK
   - '233': UK
   - '234','235': UK
   - '236': Gibraltar
   - '237': Greece
   - '240': Greece
   - '241': Greece
   - '244','245','246': Netherlands
   - '255': Portugal
   - '256': Malta
   - '257','258','259': Norway
   - '261': Poland
   - '263': Portugal
   - '265','266': Sweden
   - '269','270': Czech Republic, Monaco
   - '271','272','273','274': Turkey, Ukraine, Russia, Latvia
   - '275','276','277','278','279': Latvia, Lithuania, Luxembourg, Lithuania, Malta (check ITU assignments)
   - '301': Anguilla
   - '303': Alaska/US
   - '304','305','306','307': Antigua, various
   - '338','339','341': US
   - '351': various
   - '352','353','354','355','356','357': various Caribbean/Central American
   - '366','367','368','369': US (CRITICAL — the main US MIDs)
   - '370','371','372','373': Panama, various, Panama, Cuba
   - '401': Afghanistan
   - '412','413','414': China
   - '416': Taiwan
   - '419': India
   - '422': Iran
   - '423': Israel (Azerbaijan)
   - '425': Israel (Note: actually the correct MID for Israel is 428? Check: 428 = Mongolia. Use the actual ITU table — Israel is typically reached via 428. Actually Israel is 428. Let me correct: use actual ITU MID list)
   - '431','432': Japan
   - '436': Kazakhstan
   - '437': Uzbekistan
   - '438': Thailand (this is not right — Thailand is probably different)
   - '440','441': South Korea
   - '450': multiple
   - '460','461': China (additional MIDs)
   - '466','467': Taiwan, North Korea
   - '470': Bangladesh
   - '472': Tajikistan
   - '473': Russia (far east)
   - '475': UAE
   - '477': Hong Kong
   - '501': France (Adelie Land)
   - '503','504': Australia
   - '510','511','512': New Zealand, various, UK (overseas)
   - '516': Peru
   - '518','520','523','525': various South American/Pacific nations
   - '533': Malaysia
   - '536': various
   - '548': Philippines (actually not quite right — check)
   - '555': various
   - '561': Iceland
   - '563': Singapore
   - '564','565','566','567': various Asian nations

   IMPORTANT: Don't stress about getting every single MID perfect. Cover the top 30-40 naval/maritime nations accurately (US, UK, China, Russia, Japan, South Korea, France, India, Australia, Germany, Norway, Sweden, Netherlands, Turkey, Israel, Iran, Brazil, Canada — wait, Canada is not in the above list. Canada's MID is 316. Add that. Also Italy is 247. Germany is 211,218. Spain is 224,225. Egypt is 622. Saudi Arabia is 403. Pakistan is 463. South Africa is 601. Brazil is 710.) For unknown MIDs, return 'Unknown'.

   Actually, the simplest and most reliable approach: create a `MID_TO_COUNTRY` constant Record<string, string> with the ~60-80 most common MIDs. For any MID not found, return 'Unknown'. Here are the accurate major ones to include:

   US: '303','338','339','366','367','368','369'
   UK: '232','233','234','235'
   France: '226','227','228'
   Germany: '211','218'
   Italy: '247'
   Spain: '224','225'
   Netherlands: '244','245','246'
   Norway: '257','258','259'
   Sweden: '265','266'
   Denmark: '219','220'
   Finland: '230'
   Poland: '261'
   Greece: '237','239','240','241'
   Turkey: '271'
   Russia: '273'
   Ukraine: '272'
   China: '412','413','414','453','477'
   Japan: '431','432'
   South Korea: '440','441'
   North Korea: '445'
   Taiwan: '416'
   India: '419'
   Pakistan: '463'
   Iran: '422'
   Israel: '428'
   Saudi Arabia: '403'
   UAE: '470','471'
   Egypt: '622'
   Australia: '503','504'
   New Zealand: '512'
   Canada: '316'
   Brazil: '710'
   Singapore: '563','564','565','566'
   Malaysia: '533'
   Philippines: '548'
   Indonesia: '525'
   Thailand: '567'
   Vietnam: '574'
   Portugal: '255','263'
   Malta: '215','229','249','256'
   Panama: '351','352','353','354','355','356','357','370','371','372'
   Liberia: '636','637'
   Marshall Islands: '538'
   Bahamas: '308','309','311'
   Hong Kong: '477'

6. Create `identifyMilitaryVessel(mmsi: string, shipType: number, name: string): { isMilitary: boolean; category: string }`:

   Check these signals in order (first match wins):
   
   a) AIS type code 35 → { isMilitary: true, category: 'warship' }
   b) AIS type code 55 → { isMilitary: true, category: 'law-enforcement' }
   c) Name contains (case-insensitive): 'WARSHIP', 'USS ', ' USN ', 'USCG', 'USCGC', 'HMS ', 'HMCS ', 'HMAS ', 'HMNZS', 'FGS ' (German), 'ITS ' (Italian), 'ESPS ' (Spanish), 'TCG ' (Turkish)
      → { isMilitary: true, category: 'warship' }
   d) Name contains (case-insensitive): 'COAST GUARD', 'COASTGUARD'
      → { isMilitary: true, category: 'coast-guard' }
   e) MMSI starts with '3669' (US federal NTIA assignment — often Navy/USCG/NOAA)
      → { isMilitary: true, category: 'military-support' }
   f) None matched → { isMilitary: false, category: '' }

7. Create a `VESSEL_COLORS` constant Record<VesselCategory, string>:
   - military: '#ff4444' (red)
   - cargo: '#4a9eff' (blue)
   - tanker: '#ff8c00' (orange)
   - passenger: '#22c55e' (green)
   - fishing: '#a855f7' (purple)
   - tug: '#eab308' (yellow)
   - highspeed: '#06b6d4' (cyan)
   - pleasure: '#ec4899' (pink)
   - other: '#9ca3af' (gray)

Test: Run `npx tsc --noEmit` — zero errors. This file has no side effects and no imports from other project files except standard TypeScript types.
```

---

## Prompt 3: AIS Stream WebSocket Manager

```
Read CLAUDE.md for project conventions.

Create `src/lib/aisStreamManager.ts` — a singleton module that maintains a persistent WebSocket connection to aisstream.io and accumulates vessel data in memory. This is the most critical file in the vessel layer.

IMPORTANT: This file runs server-side only (inside Next.js API routes). It uses the `ws` npm package, NOT the browser WebSocket API. Import `WebSocket` from 'ws'.

The module must export three functions:
- `initAisStream(): void` — starts the WebSocket connection (no-op if already started or if API key is missing)
- `getVessels(): VesselData[]` — returns a snapshot array of all currently tracked vessels
- `getConnectionStatus(): { state: string; vesselCount: number; lastMessage: number }` — returns current status

Internal implementation:

1. **Singleton state** — module-level variables (not a class):
   - `vessels: Map<string, VesselData>` — keyed by MMSI
   - `ws: WebSocket | null`
   - `connectionState: 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'error'`
   - `lastMessageTime: number` (timestamp of last received message)
   - `reconnectAttempts: number`
   - `reconnectTimer: NodeJS.Timeout | null`
   - `cleanupTimer: NodeJS.Timeout | null`

2. **initAisStream()** implementation:
   - If `isVesselTrackingEnabled()` returns false, set state to 'disabled' and return
   - If ws is already open or connecting, return (no-op)
   - Set state to 'connecting'
   - Create WebSocket: `new WebSocket('wss://stream.aisstream.io/v0/stream')`
   
   On open:
   - Send the subscription message as JSON:
     {
       "APIKey": getAisStreamApiKey(),
       "BoundingBoxes": [[[-90, -180], [90, 180]]],
       "FilterMessageTypes": ["PositionReport", "ShipStaticData"]
     }
   - Set state to 'connected', reset reconnectAttempts to 0
   - Start the cleanup timer if not already running (setInterval every 60 seconds)
   - Console log: "AIS Stream connected"
   
   On message (data):
   - Parse JSON from data.toString()
   - Update lastMessageTime to Date.now()
   - Call processAisMessage() with the parsed message (see below)
   
   On close:
   - Set state to 'disconnected'
   - Console log: "AIS Stream disconnected"
   - Schedule reconnect
   
   On error (err):
   - Set state to 'error'
   - Console error: "AIS Stream error:", err.message
   - The close event will fire after error, which triggers reconnect

3. **processAisMessage(msg: unknown)** — internal function:
   
   The message structure from aisstream.io is:
   {
     "MessageType": "PositionReport" | "ShipStaticData",
     "MetaData": {
       "MMSI": number,
       "MMSI_String": string,
       "ShipName": string,
       "latitude": number,
       "longitude": number,
       "time_utc": string
     },
     "Message": {
       "PositionReport": {  // present when MessageType is PositionReport
         "Cog": number,
         "Sog": number,
         "TrueHeading": number,
         "NavigationalStatus": number
       },
       "ShipStaticData": {  // present when MessageType is ShipStaticData
         "Type": number,
         "Destination": string,
         "Name": string
       }
     }
   }
   
   Safely parse and validate the message (use type narrowing, not `any`). If any required field is missing, skip the message silently.
   
   Get the MMSI string from MetaData.MMSI_String (or convert MetaData.MMSI to string). Look up or create an entry in the vessels Map.
   
   For PositionReport messages: update lat, lon, cog, sog, heading from Message.PositionReport fields. Also update lat/lon from MetaData.latitude/longitude as a fallback.
   
   For ShipStaticData messages: update shipType from Message.ShipStaticData.Type, destination from Message.ShipStaticData.Destination, name from Message.ShipStaticData.Name (prefer this over MetaData.ShipName as it tends to be more accurate/complete).
   
   For both message types: update name from MetaData.ShipName if the vessel entry's name is still empty. Set lastUpdate to Date.now(). Compute flag via getMIDFromMMSI() + getCountryFromMID(). Compute isMilitary and militaryCategory via identifyMilitaryVessel().

4. **Reconnection logic** — internal:
   - Increment reconnectAttempts
   - If reconnectAttempts <= 10, wait 5 seconds then call initAisStream()
   - If reconnectAttempts > 10, wait 60 seconds then reset reconnectAttempts to 0 and call initAisStream()
   - Use setTimeout, store the timer reference in reconnectTimer so it can be cleared

5. **Staleness cleanup** — internal, runs via setInterval every 60 seconds:
   - Iterate the vessels Map
   - Delete any entry whose lastUpdate is older than 10 minutes ago (600,000 ms)

6. **getVessels()** — return `Array.from(vessels.values())`

7. **getConnectionStatus()** — return `{ state: connectionState, vesselCount: vessels.size, lastMessage: lastMessageTime }`

Test: This file cannot be tested in isolation yet — it needs the API route from the next prompt. Run `npx tsc --noEmit` to verify it compiles with zero errors.
```

---

## Prompt 4: Vessels API Route

```
Read CLAUDE.md for project conventions.

Create `src/app/api/vessels/route.ts` — the REST endpoint that the frontend polls for vessel data.

This route serves cached vessel data from the in-memory AIS stream manager. It does NOT make any external API calls itself — the WebSocket manager handles that.

1. Export an async GET handler:
   
   - Import `initAisStream`, `getVessels`, `getConnectionStatus` from `src/lib/aisStreamManager`
   - Import `isVesselTrackingEnabled` from `src/lib/env`
   
   - If vessel tracking is not enabled (no API key), return:
     NextResponse.json({ vessels: [], status: { state: 'disabled', vesselCount: 0, lastMessage: 0 } })
     with status 200 (not an error — the feature is just not configured)
   
   - Call `initAisStream()` — this is idempotent. The first request to this route initializes the WebSocket connection. Subsequent requests are no-ops since it's already running.
   
   - Get the vessels array and connection status
   
   - Return NextResponse.json({ vessels, status }) with headers:
     Cache-Control: no-store (this is real-time data, never cache it)
     Content-Type: application/json

   - Wrap in try/catch. On error, return 500 with { error: "Failed to fetch vessel data", details: error.message }

2. IMPORTANT BEHAVIOR NOTE: The WebSocket manager is a singleton in the Node.js process. The first request to /api/vessels triggers the connection. Data accumulates over 30-60 seconds as the AIS stream populates. The first response will likely have very few vessels. Subsequent responses will have more as data streams in. This is expected and normal — the frontend should handle the gradual population gracefully.

Test:
- Start the dev server with a valid AISSTREAM_API_KEY in .env.local
- Open http://localhost:3000/api/vessels in a browser
- First response: vessels array may be small (0-50), status.state should be 'connecting' or 'connected'
- Wait 10 seconds, refresh: vessels array should be growing (100+)
- Wait 60 seconds, refresh: vessels array should be 500+ depending on global AIS traffic
- Each vessel object should have: mmsi, name, lat, lon, cog, sog, heading, shipType, flag, isMilitary, etc.
- Some vessels should have isMilitary: true (look for shipType 35 or 55)
- Remove AISSTREAM_API_KEY from .env.local, restart dev server
- Response should be: { vessels: [], status: { state: 'disabled', vesselCount: 0, lastMessage: 0 } }
- No errors in the terminal
```

---

## Prompt 5: Vessel Data Hook

```
Read CLAUDE.md for project conventions.

Create `src/hooks/useVesselData.ts` — a React hook that polls the vessel API route and provides vessel data to components. Follow the exact same pattern as the existing useAircraftData hook.

1. The hook signature:
   `useVesselData(enabled: boolean)` — the `enabled` parameter controls whether polling is active (tied to the layer toggle)

2. Return type:
   {
     vessels: VesselData[],
     militaryVessels: VesselData[],
     loading: boolean,
     error: string | null,
     status: { state: string; vesselCount: number; lastMessage: number }
   }
   
   - `militaryVessels` is `vessels.filter(v => v.isMilitary)`

3. Behavior:
   - When `enabled` is true: fetch `GET /api/vessels` immediately, then poll every 15 seconds (vessel data changes slower than aircraft — use 15s not 10s)
   - When `enabled` is false: don't fetch, don't poll, but preserve the last fetched data (don't clear arrays)
   - When `enabled` transitions from false to true: fetch immediately and start polling
   - When `enabled` transitions from true to false: stop polling, keep last data
   - On successful fetch: update vessels, update status, clear error, set loading false
   - On failed fetch: set error message, keep previous vessel data (don't wipe the map), continue polling
   - On first fetch when loading is true: set loading false after first response regardless of success/failure
   - Cleanup: clear interval on unmount

4. Use `useRef` for the interval handle and `useCallback` for the fetch function, matching the pattern in useAircraftData.

Test: Run `npx tsc --noEmit` — zero errors. This hook can't be visually tested yet.
```

---

## Prompt 6: Vessel Map Markers

```
Read CLAUDE.md for project conventions.

Create `src/components/VesselMarker.tsx` — a Leaflet marker component for rendering vessels on the map.

1. Props: `vessel: VesselData` and `onClick: (vessel: VesselData) => void`

2. Create the vessel icon using Leaflet's `DivIcon` with an inline SVG:
   
   The SVG must be a TOP-DOWN SHIP SILHOUETTE — a pointed bow at the top, wider hull in the middle, flat stern at the bottom. It should be immediately distinguishable from the aircraft icons. Suggested approach: an elongated diamond/pentagon shape — like a simple boat hull from above. Something like:
   
   <svg width="W" height="H" viewBox="0 0 24 32">
     <path d="M12 1 L20 22 L12 30 L4 22 Z" />  (example — refine for a good ship shape)
   </svg>
   
   The shape should point UPWARD (north/0°) at rest so CSS rotation works the same as aircraft.
   
   - Size: 28x28 pixels for military vessels, 20x20 for all others
   - Color: Use VESSEL_COLORS[getVesselCategory(vessel.shipType)] from vesselTypes.ts. But if vessel.isMilitary is true, always use the military red color '#ff4444' regardless of the AIS type code.
   - Rotation: Rotate by vessel.heading degrees. If heading is 511 (unavailable), fall back to vessel.cog. Use CSS `transform: rotate(Xdeg)` just like AircraftMarker.
   - Stroke: Add stroke="#000000" stroke-opacity="0.3" stroke-width="0.5" on the path for visibility against any map background.
   - Military vessels: Use a slightly thicker stroke (stroke-width="1") and stroke-opacity="0.5" to make them pop.

3. Add a Leaflet Popup on click showing:
   - Vessel name (or "Unknown Vessel" if empty) — bold
   - MMSI number
   - Flag country
   - Category: human-readable name from getVesselCategory()
   - Speed: formatted to 1 decimal + " kts"
   - Course: formatted to 0 decimals + "°"
   - Heading: formatted to 0 decimals + "°" (or "N/A" if 511)
   - Destination (or "Not reported" if empty)
   - If isMilitary: show militaryCategory in a colored badge

4. Wrap in React.memo with a custom comparator: only re-render when lat, lon, heading, cog, sog, or lastUpdate changes. This prevents thousands of unnecessary re-renders on each poll when most vessels haven't moved.

5. Now update `src/components/Map.tsx`:
   
   - Add a `vessels?: VesselData[]` prop and an `onVesselClick?: (vessel: VesselData) => void` prop
   - Create a Leaflet pane for vessels: in a useEffect or useMap hook, create a custom pane called 'vessels' with zIndex 450 (lower than the default marker pane at 600, so aircraft render on top of ships)
   - Render a VesselMarker for each vessel in the array, inside the vessels pane. Key by MMSI.
   - Existing aircraft rendering must be completely unaffected.

Test: This can't be fully tested yet (no toggle wired up). Run `npx tsc --noEmit` — zero errors.
```

---

## Prompt 7: Vessel Detail Panel and Page Wiring

```
Read CLAUDE.md for project conventions.

1. Create `src/components/VesselPanel.tsx` — a detail panel that appears when a vessel is clicked, styled identically to AircraftPanel:

   - Same slide-in behavior from the right side (320px wide, zinc-800 background, rounded left corners, shadow, z-[1000])
   - Same transition: translate-x-full when hidden, translate-x-0 when shown
   - Props: vessel (VesselData | null), onClose callback
   
   Panel content:
   - Header: vessel name (large bold text) or "Unknown Vessel". Below: MMSI and flag country.
   - If isMilitary: show a badge with the militaryCategory ('Warship', 'Coast Guard', 'Law Enforcement', 'Military Support') — same style as the military badge in AircraftPanel
   - Detail rows (label: value format, matching AircraftPanel layout):
     - Type: human-readable category from getVesselCategory() + raw type code in parentheses, e.g. "Cargo (70)"
     - Speed: X.X kts
     - Course: XXX°
     - Heading: XXX° or "N/A" (when 511)
     - Destination: string or "Not reported"
     - Position: lat, lon to 4 decimal places
     - Last Update: formatted as HH:MM:SS or relative time
   - Close button (X) in the top-right corner

2. Update `src/app/page.tsx` to integrate the full vessel layer:

   - Import and use `useVesselData` hook with an `enabled` state variable (default to `false` for now — we'll add the toggle in the next prompt)
   - Add `selectedVessel` state (VesselData | null)
   - Add `vesselSignalLost` state (boolean) — same pattern as aircraft signal lost tracking
   
   - Pass `vessels` and `onVesselClick` to the Map component
   - When a vessel is clicked: set selectedVessel, clear selectedAircraft (only one panel open at a time)
   - When an aircraft is clicked: clear selectedVessel (only one panel open at a time)
   - Render VesselPanel alongside AircraftPanel
   
   - On each poll update: if there's a selectedVessel, find the matching MMSI in the new vessels array and update selectedVessel with fresh data. If the vessel disappears from the data, keep showing the last known state and set vesselSignalLost to true.
   
   - When either panel's close button is clicked, clear the corresponding selection and reset signal lost.

   For initial testing, temporarily set the vessel `enabled` state to `true` so you can verify everything works. We'll replace this with a proper toggle in the next prompt.

Test:
- Start the dev server with a valid API key
- Wait 30-60 seconds for vessels to accumulate
- Ship icons should appear on the map, concentrated around coastlines and shipping lanes
- Ships should be visually different from aircraft (different shape, different colors)
- Click a vessel — VesselPanel slides in with correct details
- Click an aircraft — VesselPanel closes, AircraftPanel opens
- Click X on either panel — it closes
- Vessels in red should be military (type 35 or 55)
- Zoom to a major port (Long Beach, Rotterdam, Singapore, Norfolk VA) — many vessels visible
- No console errors
- Aircraft continue working perfectly
```

---

## Prompt 8: Layer Toggle

```
Read CLAUDE.md for project conventions.

Add a vessel layer toggle to the UI so users can turn the vessel layer on and off.

1. Check if a layer control or toggle system already exists in the codebase. If yes, add the vessel toggle to it. If no, create a new floating control.

2. Create `src/components/LayerControl.tsx` (or update the existing one):
   
   - Position: bottom-left corner of the map, above the map attribution, with z-index high enough to float over the map but below panels
   - Style: dark semi-transparent background (zinc-800/90), rounded corners, small padding, compact
   
   - Show a toggle row for "Vessels":
     - A ship icon (small inline SVG, same shape as VesselMarker)
     - Label: "Vessels" when off, "Vessels (1,247)" with live count when on
     - A toggle switch or checkbox
     - A small status dot: green when connected, yellow when connecting, red on error, gray when disabled/off
   
   - If vessel tracking is disabled (status.state === 'disabled' — no API key):
     - The toggle should appear grayed out and not be clickable
     - Show small text below or as tooltip: "API key required"
   
   - Persist toggle state to localStorage key 'overwatch-vessel-layer' so it survives page refreshes
   - Default state: OFF (vessels don't load until the user enables them)

3. Update `src/app/page.tsx`:
   - Replace the hardcoded `enabled: true` from the previous prompt with state from the toggle
   - Read initial state from localStorage (default false)
   - Pass toggle state and setter to LayerControl
   - Pass `enabled` to useVesselData
   - When toggle is OFF: stop polling, remove vessel markers from map (pass empty array), close vessel panel if open
   - When toggle is ON: start polling, show vessels

4. Also add a row for "Aircraft" in the LayerControl if it doesn't already have one:
   - Always on (no toggle needed since aircraft is the core feature), but shows the count
   - Format: airplane icon + "Aircraft (342)" with green status dot

5. The LayerControl should not overlap with the existing StatusBar, FilterBar, or any panels. Test different viewport sizes to make sure.

Test:
- Page loads: vessel toggle is OFF, no vessel markers, no API calls to /api/vessels
- Click the vessel toggle ON: "Connecting..." status, then vessels start appearing within 15-30 seconds, count increments
- Click toggle OFF: vessel markers disappear, polling stops, vessel panel closes if open
- Refresh page: toggle state is preserved from localStorage
- Aircraft are completely unaffected by the vessel toggle
- Remove API key from .env.local, restart: vessel toggle is grayed out with "API key required"
```

---

## Prompt 9: Polish and Performance

```
Read CLAUDE.md for project conventions.

Final polish pass for the vessel tracking layer. Address each item:

1. PERFORMANCE — with 2000+ vessels on the map:
   - Verify the map stays responsive when panning and zooming with many vessels
   - If performance is poor, add a zoom-level gate: only render vessel markers when map zoom >= 4. When zoom < 4 and vessels are enabled, show a small notice on the map: "Zoom in to see vessels"
   - Confirm React.memo is properly applied on VesselMarker with the custom comparator
   - If still slow, consider rendering only vessels within the current map viewport (filter by bounds on each render)

2. ERROR HANDLING:
   - If the WebSocket disconnects: frontend should keep showing last known positions (don't clear markers), show yellow status dot on the layer toggle
   - If /api/vessels fails: subtle error indicator (red dot) on the layer toggle, no console spam
   - If the API key is invalid (aisstream.io rejects the connection): surface as 'error' state with the status dot turning red. The toggle should still be clickable so users can turn it off.

3. MAP ATTRIBUTION:
   - Add "Vessel data: aisstream.io" to the map attribution string alongside the existing OpenStreetMap and ADSB.lol attributions

4. STATUSBAR:
   - If the StatusBar exists, consider adding a vessel count to it when the layer is active, e.g. "1,247 vessels" next to the aircraft count. Keep it subtle — don't clutter.

5. TYPESCRIPT:
   - Run `npx tsc --noEmit` — zero errors
   - Run the linter (`npm run lint`) — zero errors

6. BUILD:
   - Run `npm run build` — must succeed cleanly
   - Test build both WITH and WITHOUT AISSTREAM_API_KEY in .env.local

7. UPDATE CLAUDE.md:
   - Add a new "Vessel Tracking Layer" subsection under "Current Implementation Status" listing all the new files and their descriptions (same format as the existing aircraft files table)
   - Update the "What's Implemented" table with the new files:
     - src/lib/env.ts — environment helpers for vessel API key
     - src/lib/vesselTypes.ts — VesselData interface, military identification, type codes, country lookup
     - src/lib/aisStreamManager.ts — singleton WebSocket manager for aisstream.io
     - src/app/api/vessels/route.ts — REST endpoint serving cached vessel data
     - src/hooks/useVesselData.ts — polling hook for vessel data
     - src/components/VesselMarker.tsx — Leaflet marker with ship SVG icon
     - src/components/VesselPanel.tsx — slide-in detail panel for selected vessel
     - src/components/LayerControl.tsx — floating toggle for vessel layer
   - Add a "Vessel Tracking API" section under "Key Technical Details" documenting:
     - WebSocket URL: wss://stream.aisstream.io/v0/stream
     - Auth: API key in subscription message (server-side only, never in browser)
     - Message types: PositionReport, ShipStaticData
     - Coverage: terrestrial AIS only (~200km from coast)
     - Military identification: type code 35/55, MMSI prefix 3669, name pattern matching

8. FULL MANUAL TEST:
   - Load the page, toggle vessels on
   - Wait 60 seconds for data to accumulate
   - Pan to Long Beach / English Channel / Strait of Malacca — should see hundreds of vessels
   - Click several vessels — panels show correct data
   - Look for military vessels near Norfolk VA, San Diego, Pearl Harbor, Portsmouth UK
   - Toggle off and on — works smoothly
   - Aircraft are completely unaffected with vessels enabled
   - No console errors, no TypeScript errors, clean build
```

---

## Architecture Summary

```
                                     aisstream.io
                                    WebSocket API
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  aisStreamManager.ts  │  (Node.js singleton)
                              │  WebSocket client     │
                              │  Map<MMSI, VesselData> │
                              │  cleanup stale: 60s   │
                              └──────────┬───────────┘
                                         │
                                    GET /api/vessels
                                         │
                              ┌──────────┴───────────┐
                              │  vessels/route.ts     │  (Next.js API route)
                              │  Returns JSON snapshot │
                              │  Cache-Control: no-store│
                              └──────────┬───────────┘
                                         │
                                  polls every 15s
                                         │
                              ┌──────────┴───────────┐
                              │  useVesselData.ts     │  (React hook)
                              │  enabled: boolean     │
                              └───┬─────────────┬────┘
                                  │             │
                          ┌───────┴──┐    ┌─────┴──────┐
                          │VesselMarker│   │VesselPanel │
                          │  (map)    │   │ (detail)   │
                          └──────────┘    └────────────┘
```

### Why WebSocket → REST Polling (Not Direct WebSocket to Frontend)

1. **API key security** — aisstream.io API keys must not be exposed to the browser
2. **Connection efficiency** — one server-side WebSocket serves all browser clients, vs. each tab opening its own connection
3. **Consistency** — matches the existing aircraft REST polling pattern
4. **Resilience** — server-side manager handles reconnection independently of browser sessions

### Military Vessel Identification Signals

| Signal | Check | Confidence |
|--------|-------|------------|
| AIS type code 35 | "Engaged in military operations" — set by vessel crew | High |
| AIS type code 55 | "Law enforcement" — Coast Guard, CBP, marine police | High |
| MMSI prefix 3669 | US federal vessel assignment from NTIA | Medium |
| Name keywords | USS, HMS, USCG, WARSHIP, etc. | Medium |

**Important:** Military vessels frequently disable or spoof AIS during operations. A vessel "going dark" near a military area is itself a useful signal.

### AIS Ship Type Code Quick Reference

| Code | Meaning | Display Category |
|------|---------|-----------------|
| 30 | Fishing | fishing |
| 31-32 | Towing | tug |
| **35** | **Military operations** | **military** |
| 36-37 | Sailing / Pleasure | pleasure |
| 40-49 | High-speed craft | highspeed |
| 52 | Tug | tug |
| **55** | **Law enforcement** | **military** |
| 60-69 | Passenger | passenger |
| 70-79 | Cargo | cargo |
| 80-89 | Tanker | tanker |

---

## Notes for the Operator

- **Run prompts sequentially.** Each prompt assumes the previous one completed successfully.
- **Verify after each prompt.** Don't move to the next step until the current one is working.
- **API key must be ready before Prompt 1.** Register at https://aisstream.io — it's free and instant.
- **Warmup period is normal.** The first 30-60 seconds after enabling vessels will show few/no markers as the WebSocket stream populates. This is expected.
- **Coverage gaps are expected.** Vessels in the middle of the ocean won't appear — aisstream.io uses terrestrial AIS stations with ~200km coastal range. Ports, shipping lanes, and chokepoints have excellent coverage.
- **If aisstream.io is down:** The vessel layer will show its last known data and the status dot will turn yellow/red. Aircraft tracking is completely unaffected. The manager will auto-reconnect when aisstream.io comes back.
- **Expected result after all prompts:** The existing aircraft tracker works exactly as before, plus a toggleable vessel layer showing thousands of ships worldwide with military vessel highlighting.
