# Overwatch — Open Source Military Movement Tracker

A real-time military movement intelligence dashboard built with TypeScript, using publicly available data sources and an interactive map interface. Track military aircraft and naval vessels worldwide — all from open, free data.

## What It Does

Overwatch aggregates multiple publicly available data sources to create a comprehensive picture of military movement worldwide.

**Aircraft Tracking** — The primary layer polls the [ADSB.lol](https://www.adsb.lol/) public API for aircraft flagged as military, then renders their positions, headings, altitudes, and callsigns on a live Leaflet.js map with aircraft-type-specific silhouette icons. Users can click any aircraft to see details (type, registration, speed, altitude, squawk code, country of registration) and filter by search, altitude band, or aircraft category.

**Maritime Vessel Tracking** — The vessel layer connects to [aisstream.io](https://aisstream.io/) via a server-side WebSocket for real-time AIS data. Vessels are rendered with ship-shaped markers color-coded by type (cargo, tanker, military, etc.). Military vessels are identified via AIS type codes, name patterns, and MMSI prefixes. The layer is toggleable and requires a free API key.

**Satellite Tracking** — The satellite layer fetches orbital element data from [CelesTrak](https://celestrak.org/) and computes real-time positions client-side using the SGP4 propagation algorithm via satellite.js. Military-relevant satellites are displayed as colored diamond markers, categorized into reconnaissance, SIGINT, communications, navigation (GPS/GLONASS/BeiDou/Galileo), early warning, weather, and foreign military. No API key required.

**Airspace Restriction Tracking** — The airspace layer overlays restricted airspace zones on the map, including FAA Special Use Airspace (Restricted Areas, Prohibited Areas, MOAs, Warning Areas, Alert Areas) and active Temporary Flight Restrictions (TFRs). SUA data comes from FAA's ArcGIS Feature Service; TFR data comes from the FAA's TFR API and GeoServer. Zones are color-coded by type and rendered as polygon overlays with opacity indicating severity. TFRs use dashed strokes to distinguish them from permanent restrictions. No API key required.

**Conflict Event Tracking** — The conflict layer displays real-time global military and conflict events sourced from the [GDELT Project](https://www.gdeltproject.org/). Events are plotted as starburst markers color-coded by severity category (coercion, assault, armed conflict, mass violence). Each event links back to the source article for full context. Events are filtered by military/conflict keywords and displayed within a rolling 24-hour window. No API key required.

Additional planned data layers include seismic monitoring.

All aircraft data comes from **ADS-B (Automatic Dependent Surveillance-Broadcast)** — a technology where aircraft broadcast their GPS position, identity, and flight parameters on 1090 MHz. Volunteer-run ground receivers collect these signals and feed them to aggregators like ADSB.lol. This data is inherently public; it is broadcast unencrypted over open radio frequencies.

All vessel data comes from **AIS (Automatic Identification System)** — the maritime equivalent of ADS-B. Ships broadcast their identity, position, course, and speed on VHF frequencies. Like ADS-B, this data is publicly receivable.

## Data Sources

### Layer 1: Military Aircraft (Active)

**Primary API:** `https://api.adsb.lol`

| Endpoint | Description |
|---|---|
| `GET /v2/mil` | All aircraft tagged as military |
| `GET /v2/hex/{icao}` | Single aircraft by ICAO 24-bit hex address |
| `GET /v2/callsign/{cs}` | Aircraft by callsign |
| `GET /v2/type/{type}` | Aircraft by ICAO type code (e.g. `C17`, `F16`) |
| `GET /v2/squawk/{squawk}` | Aircraft by transponder squawk code |

**No API key is required.** The API is free, open-source (BSD-3-Clause), and serves ODbL-licensed data. There are currently no enforced rate limits, though the project implements a sensible polling interval (10 seconds) to be a good citizen.

**Fallback API:** `https://api.adsb.one` — uses the identical v2 endpoint format. Can be swapped in via environment variable if ADSB.lol is down.

#### How Military Aircraft Are Identified

Each aircraft record includes a `dbFlags` bitfield. The first bit indicates military status:

```
military = (dbFlags & 1) !== 0
```

This flag is maintained by community-curated databases that map ICAO 24-bit hex addresses to aircraft metadata (operator, type, registration, military/civilian status).

#### Aircraft Icon Classification

Aircraft are rendered with type-specific silhouette icons based on their ICAO type code:

| Category | Example Types | Icon Shape |
|---|---|---|
| Fighter | F-16, F-15, F-22, F-35, A-10 | Swept-wing jet |
| Tanker/Transport | KC-135, KC-46, C-17, C-130, C-5 | Wide-body, straight wings |
| Helicopter | UH-60, AH-64, CH-47, V-22 | Rotor disc + fuselage |
| Surveillance | E-3, RC-135, P-8, U-2, E-8 | Aircraft with radome |
| Trainer | T-38, T-6, T-45 | Small straight-wing |
| Bomber | B-52, B-1, B-2 | Large swept wings |
| UAV | RQ-4, MQ-9, MQ-1 | Small delta/flying wing |
| Unknown | Unrecognized type codes | Generic aircraft |

#### Key Fields in the API Response

| Field | Description |
|---|---|
| `hex` | ICAO 24-bit address (6 hex chars) |
| `flight` | Callsign (up to 8 chars) |
| `lat` / `lon` | Position (WGS84) |
| `alt_baro` | Barometric altitude (feet) or `"ground"` |
| `gs` | Ground speed (knots) |
| `track` | Track angle (degrees from true north) |
| `t` | ICAO aircraft type code |
| `r` | Registration / tail number |
| `dbFlags` | Bitfield: bit 0 = military |
| `squawk` | Transponder squawk code |
| `seen` | Seconds since last message |
| `seen_pos` | Seconds since last position update |

### Layer 2: Maritime Vessels via AIS (Active)

| Source | URL | Auth | Status |
|---|---|---|---|
| aisstream.io | `wss://stream.aisstream.io/v0/stream` | Free API key | Active |

**Data source:** aisstream.io provides global AIS vessel data via WebSocket with a free API key. A server-side singleton WebSocket manager maintains the connection, accumulates vessel data in memory, and serves it to the frontend via a REST polling endpoint.

**Military vessel identification:** AIS type code 35 (military ops), type code 55 (law enforcement), warship name patterns (USS, HMS, USCG, etc.), coast guard name patterns, and MMSI prefix 3669 (US federal NTIA assignment).

**Vessel categories:** Military (red), Cargo (blue), Tanker (orange), Passenger (green), Fishing (purple), Tug/Pilot (yellow), High-Speed Craft (cyan), Pleasure Craft (pink), Other (gray).

**Coverage:** Terrestrial AIS only (~200km from coastlines). Ports, shipping lanes, and chokepoints have excellent coverage. Open ocean has gaps. Vessels in the middle of the ocean won't appear.

### Layer 3: Military Satellites (Active)

| Source | URL | Auth | Status |
|---|---|---|---|
| CelesTrak | `https://celestrak.org/NORAD/elements/gp.php` | None | Active |

**CelesTrak provides free, no-auth access** to military satellite orbital element data in OMM JSON format. The API route fetches 10 catalog groups in parallel (military, GPS, GLONASS, BeiDou, Galileo, SBAS, NNSS, MUSSON, TDRSS, GEO), filters the GEO catalog to military-relevant satellites, and deduplicates by NORAD catalog ID.

Position computation is done **client-side** using the `satellite.js` library (JavaScript SGP4 propagator). Orbital elements are fetched every 30 minutes, and positions are recomputed every 30 seconds from cached TLE data.

#### Satellite Categories

| Category | Color | Examples |
|---|---|---|
| Reconnaissance | Red | KH-11, Topaz, YAOGAN |
| SIGINT/ELINT | Orange | MENTOR/Orion, TRUMPET, NOSS |
| Communications | Blue | AEHF, Milstar, MUOS, WGS |
| Navigation | Green | GPS, GLONASS, BeiDou, Galileo |
| Early Warning | Yellow | SBIRS, DSP, Tundra |
| Weather | Cyan | DMSP, NOAA, GOES |
| Foreign Military | Purple | COSMOS, SHIYAN, SHIJIAN |
| Other Military | Light Purple | Unclassified military |

### Layer 4: Conflict Events (Active)

| Source | URL | Auth | Status |
|---|---|---|---|
| GDELT Project | `https://api.gdeltproject.org/api/v2/geo/geo` | None | Active |

**GDELT GEO v2** provides real-time geocoded news events as GeoJSON. The proxy route fetches military/conflict events (up to 500 points within a 24-hour window), parses HTML source links, classifies events by severity using keyword analysis, and deduplicates by event ID. Server cache: 10 minutes with 5-minute stale fallback.

**Conflict categories:** Coerce (orange), Assault (red), Fight (dark red), Mass Violence (deep red), Other (amber). Classification uses regex patterns matching CAMEO-style conflict terminology in event headlines.

**Rendering:** 6-pointed starburst markers (18px, 24px when selected) with category-colored fill. Pane z-430, zoom gate at level 3+. Viewport filtered.

### Layer 5: Airspace Restrictions (Active)

| Source | URL | Auth | Status |
|---|---|---|---|
| FAA ArcGIS (SUA) | `https://services6.arcgis.com/.../Special_Use_Airspace/FeatureServer/0/query` | None | Active |
| FAA TFR List API | `https://tfr.faa.gov/tfrapi/getTfrList` | None | Active |
| FAA TFR GeoServer | `https://tfr.faa.gov/geoserver/TFR/ows` (WFS) | None | Active |

**Special Use Airspace (SUA):** Restricted Areas, Prohibited Areas, MOAs, Warning Areas, and Alert Areas fetched from FAA's ArcGIS Feature Service as GeoJSON. ~1534 zones, cached server-side for 24 hours (data updates every 28 days on FAA NASR cycle).

**Temporary Flight Restrictions (TFRs):** Active TFRs fetched from FAA's JSON list API (metadata) and GeoServer WFS endpoint (geometry), joined by NOTAM ID. ~70 active TFRs, cached for 5 minutes. TFRs correlate with VIP movement, military exercises, security events, and space launches.

**Zone types:** Restricted (orange), Prohibited (red), MOA (yellow), Warning (purple), Alert (cyan), TFR (red, dashed). TFR sub-types: VIP, Security, Hazard, Space Operations, Event, National Defense.

**Rendering:** Polygon overlays with severity-based opacity. Inactive "BY NOTAM" zones shown as outlines only. Zoom gate at level 4+.

### Layer 6: Seismic Monitoring (Planned)

| Source | URL | Auth | Status |
|---|---|---|---|
| USGS Earthquake API | `https://earthquake.usgs.gov/fdsnws/event/1/` | None | Primary |

Real-time seismic data as GeoJSON. Supplementary awareness layer — large seismic events at known test sites can indicate nuclear testing.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Runtime** | Node.js 20+ | LTS, stable |
| **Language** | TypeScript 5 | Type safety |
| **Framework** | Next.js 16 (App Router) | Simple fullstack, API routes as proxy |
| **Map** | Leaflet 1.9 (vanilla) | Free, no API key, OSM tiles |
| **Tiles** | OpenStreetMap via `tile.openstreetmap.org` | Free, open, reliable |
| **Styling** | Tailwind CSS 3 | Utility-first, minimal config |
| **HTTP** | Native `fetch` | No extra dependencies |
| **WebSocket** | `ws` (server-side) | aisstream.io connection |
| **Linting** | ESLint 10 (flat config) + typescript-eslint | Consistent code |
| **Satellites** | satellite.js | SGP4 orbit propagation from orbital elements |

### Why These Choices

- **Leaflet + OpenStreetMap** over Mapbox/Google Maps: Completely free with no API key, token, or billing account. Mapbox requires a token and has usage limits. Google Maps requires billing. OSM tiles are served free under a fair-use tile policy.
- **Next.js API routes as a proxy**: Each external API gets its own proxy route, giving us centralized caching, rate limiting, and response shaping without exposing upstream API structures to the client.
- **ADSB.lol** over OpenSky Network: OpenSky requires OAuth2 credentials (since March 2025), has stricter rate limits, and does not have a dedicated military endpoint. ADSB.lol has `/v2/mil` built in and requires no authentication.
- **Server-side WebSocket singleton** for vessel data: One connection serves all browser clients (vs. each tab opening its own). API key stays server-side. Reconnection is managed independently of browser sessions.
- **Multiple independent data layers**: Each layer has its own polling hook, proxy route, and marker component. Layers fail independently — if one API goes down, the others keep working.

## Project Structure

```
overwatch/
├── CLAUDE.md                    # Claude Code conventions
├── README.md                    # This file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── eslint.config.mjs            # ESLint 10 flat config
├── .env.example                 # Environment variable template
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout + metadata
│   │   ├── page.tsx             # Main page (map + filters + panels + layer control + overlays)
│   │   ├── icon.svg             # Favicon (amber aircraft silhouette)
│   │   └── api/
│   │       ├── aircraft/
│   │       │   └── route.ts     # Proxy to ADSB.lol /v2/mil
│   │       ├── vessels/
│   │       │   └── route.ts     # Serves cached vessel data from aisStreamManager
│   │       ├── satellites/
│   │       │   └── route.ts     # Proxy to CelesTrak GP endpoints (10 catalogs, 30-min cache)
│   │       ├── airspace/
│   │       │   └── route.ts     # Proxy to FAA ArcGIS (SUA) + TFR API/GeoServer, merged response
│   │       └── conflicts/
│   │           └── route.ts     # Proxy to GDELT GEO v2 API (10-min cache)
│   ├── components/
│   │   ├── Map.tsx              # Leaflet map with aircraft + vessel + satellite rendering (client, no SSR)
│   │   ├── MapWrapper.tsx       # Dynamic import wrapper for Map (ssr: false)
│   │   ├── AircraftMarker.tsx   # Aircraft marker with type-specific icons
│   │   ├── AircraftPanel.tsx    # Aircraft detail panel (sidebar/bottom sheet)
│   │   ├── VesselMarker.tsx     # Vessel marker with ship silhouette icon
│   │   ├── VesselPanel.tsx      # Vessel detail panel (sidebar/bottom sheet)
│   │   ├── SatelliteMarker.tsx  # Satellite diamond marker with category colors + GEO glow
│   │   ├── SatellitePanel.tsx   # Satellite detail panel (sidebar/bottom sheet, purple accent)
│   │   ├── FilterBar.tsx        # Aircraft search + altitude/category filters
│   │   ├── VesselFilterBar.tsx  # Vessel country + category filters
│   │   ├── SatelliteFilterBar.tsx # Satellite search + category/orbit filters (purple accent)
│   │   ├── AirspaceOverlay.tsx  # Airspace polygon overlay renderer (Leaflet L.polygon)
│   │   ├── AirspacePanel.tsx    # Airspace zone detail panel (orange accent)
│   │   ├── AirspaceFilterBar.tsx # Airspace type/TFR-type/active-only filters (orange accent)
│   │   ├── ConflictMarker.tsx   # Conflict starburst marker with category colors
│   │   ├── ConflictPanel.tsx    # Conflict event detail panel (red accent)
│   │   ├── ConflictFilterBar.tsx # Conflict search + category + timeframe filters (red accent)
│   │   ├── LayerControl.tsx     # Floating layer toggle panel (aircraft/vessels/satellites/airspace/conflicts)
│   │   └── StatusBar.tsx        # Connection status + counts + satellite error indicator
│   ├── hooks/
│   │   ├── useAircraftData.ts   # Aircraft polling hook (10s interval)
│   │   ├── useVesselData.ts     # Vessel polling hook (15s interval, toggleable)
│   │   ├── useSatelliteData.ts  # Satellite TLE fetch (30min) + SGP4 propagation (30s), toggleable
│   │   └── useConflictData.ts   # Conflict polling hook (10min interval, toggleable)
│   ├── lib/
│   │   ├── api.ts               # Aircraft fetch wrapper
│   │   ├── types.ts             # Aircraft TypeScript interfaces
│   │   ├── utils.ts             # Formatting helpers
│   │   ├── aircraftIcons.ts     # Type classification + SVG icon mapping
│   │   ├── countryLookup.ts     # ICAO hex-to-country lookup + flag emoji
│   │   ├── env.ts               # Server-side environment helpers (API key access)
│   │   ├── vesselTypes.ts       # Vessel interfaces, MID lookup, military identification
│   │   ├── aisStreamManager.ts  # Server-side WebSocket singleton for aisstream.io
│   │   ├── satelliteTypes.ts    # Satellite interfaces, category classification, formatting
│   │   ├── satellitePropagator.ts # SGP4 propagation via satellite.js
│   │   └── conflictTypes.ts    # Conflict interfaces, category classification, formatting
│   └── styles/
│       └── globals.css          # Tailwind directives
└── public/
    └── favicon.svg              # Favicon
```

## Running Locally

```bash
git clone <repo-url> overwatch
cd overwatch
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. No API keys needed for aircraft tracking. You should see a status bar, filter bar, and a map with military aircraft updating every 10 seconds, rendered with type-specific icons. Click any aircraft for details. Use the search and filters to narrow results. The app is responsive and works on mobile.

### Vessel Tracking Setup

The vessel tracking layer requires a free API key from aisstream.io:

1. Register at https://aisstream.io and copy your API key
2. Copy the environment template: `cp .env.example .env.local`
3. Open `.env.local` and set `AISSTREAM_API_KEY=your_key_here`
4. Restart the dev server — the vessel layer toggle will become active

Without an API key, the vessel layer toggle will appear disabled with an "API key required" message. All other features work normally.

Once enabled, click the "Vessels" toggle in the bottom-left layer control panel. Vessels will start appearing within 30-60 seconds as the WebSocket stream populates. Coverage is best near coastlines, ports, and major shipping lanes.

### Satellite Tracking

No API key needed — satellite tracking works out of the box.

1. Click the "Satellites" toggle in the bottom-left layer control panel
2. Satellites appear as colored diamond markers across the globe
3. Click any satellite for details (orbit info, NORAD ID, altitude, velocity)
4. Use the purple filter bar to search by name/NORAD ID, filter by category or orbit type

**How it works:** Orbital elements (OMM data) are fetched from CelesTrak every 30 minutes. Satellite positions are then computed client-side from these orbital elements using the SGP4 algorithm (via satellite.js) every 30 seconds. This means positions update smoothly without constant server requests.

**Categories:** Reconnaissance, SIGINT/ELINT, Communications, Navigation (GPS/GLONASS/BeiDou/Galileo), Early Warning, Weather, Foreign Military, Other Military.

**Data source:** [CelesTrak](https://celestrak.org/) — free, no authentication required. Derived from the US Space Command public satellite catalog.

### Conflict Event Tracking

No API key needed — conflict tracking works out of the box.

1. Click the "Conflicts" toggle in the bottom-left layer control panel
2. Events appear as colored starburst markers across the globe
3. Click any event for details (headline, source article, severity, location)
4. Use the red filter bar to search by name/domain, filter by category, or narrow by timeframe (24h/6h/1h)

**Categories:** Coercion (orange), Assault (red), Armed Conflict (dark red), Mass Violence (deep red), Other (amber).

**Data source:** [GDELT Project](https://www.gdeltproject.org/) — free, no authentication required. Real-time geocoded news events derived from open news sources worldwide.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.adsb.lol` | Upstream ADS-B API base |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | `10000` | How often to refresh aircraft data (ms) |
| `NEXT_PUBLIC_DEFAULT_LAT` | `38.9` | Default map center latitude |
| `NEXT_PUBLIC_DEFAULT_LNG` | `-77.0` | Default map center longitude |
| `NEXT_PUBLIC_DEFAULT_ZOOM` | `5` | Default map zoom level |
| `AISSTREAM_API_KEY` | *(none)* | aisstream.io API key for vessel tracking (server-side only) |

## Legal

ADS-B data is broadcast unencrypted on open radio frequencies (1090 MHz). AIS data is broadcast unencrypted on VHF marine frequencies. Receiving, aggregating, and displaying this data is legal in the United States and most jurisdictions. This project uses only publicly available, community-aggregated data through open APIs.

Satellite TLE data from CelesTrak is derived from the US Space Command public catalog. Conflict event data from GDELT is derived from open news sources. NOTAM/TFR data is published by the FAA for public consumption.

The ADSB.lol data is licensed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Attribution: Data from ADSB.lol contributors.

## License

MIT
