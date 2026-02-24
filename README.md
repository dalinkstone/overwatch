# Overwatch — Open Source Military Movement Tracker

A real-time military movement intelligence dashboard built with TypeScript, using publicly available data sources and an interactive map interface. Track military aircraft, naval vessels, satellites, and global conflict events — all from open, free data.

## What It Does

Overwatch aggregates multiple publicly available data sources to create a comprehensive picture of military movement worldwide. The primary layer polls the [ADSB.lol](https://www.adsb.lol/) public API for aircraft flagged as military, then renders their positions, headings, altitudes, and callsigns on a live Leaflet.js map with aircraft-type-specific icons. Users can click any aircraft to see detail (type, registration, speed, altitude, squawk code) and optionally follow its movement over time.

Additional planned data layers include maritime vessel tracking via AIS, satellite orbit visualization, conflict event mapping, and airspace restriction overlays.

All aircraft data comes from **ADS-B (Automatic Dependent Surveillance-Broadcast)** — a technology where aircraft broadcast their GPS position, identity, and flight parameters on 1090 MHz. Volunteer-run ground receivers collect these signals and feed them to aggregators like ADSB.lol. This data is inherently public; it is broadcast unencrypted over open radio frequencies.

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

### Layer 2: Maritime Vessels via AIS (Planned)

**What is AIS?** The Automatic Identification System is the maritime equivalent of ADS-B. Ships broadcast their identity, position, course, and speed on VHF frequencies. Like ADS-B, this data is publicly receivable.

| Source | URL | Auth | Status |
|---|---|---|---|
| AISHub | `http://data.aishub.net/ws.php` | Free registration | Candidate |
| mAIS | `https://mais.herokuapp.com/` | None | Candidate |

**Military vessel identification:** US Navy vessels use MMSI numbers in the 338-369 range. Vessel type codes 35 (military ops) and 55 (law enforcement) are also indicators.

### Layer 3: Military Satellites (Planned)

**What is TLE data?** Two-Line Element sets are compact orbital parameter descriptions that allow computing a satellite's position at any point in time using the SGP4 propagation algorithm.

| Source | URL | Auth | Status |
|---|---|---|---|
| CelesTrak | `https://celestrak.org/NORAD/elements/` | None | Primary candidate |
| Space-Track.org | `https://www.space-track.org/` | Free account | Backup |
| N2YO | `https://www.n2yo.com/rest/v1/satellite/` | Free API key | Backup |

**CelesTrak provides free, no-auth access** to military satellite TLE catalogs, GPS constellation data, and the full active satellite catalog. Position computation is done client-side using the `satellite.js` library (JavaScript SGP4 propagator).

### Layer 4: Conflict Events (Planned)

| Source | URL | Auth | Status |
|---|---|---|---|
| GDELT Project | `https://api.gdeltproject.org/api/v2/` | None | Primary candidate |
| ACLED | `https://acleddata.com/` | Free registration | Backup |

**GDELT** provides real-time global event data as GeoJSON, including military/conflict events, with no authentication required. Events can be filtered by CAMEO codes related to military action.

### Layer 5: Airspace Restrictions / NOTAMs (Planned)

| Source | URL | Auth | Status |
|---|---|---|---|
| FAA NOTAM API | `https://external-api.faa.gov/notamapi/v1/notams` | Free API key | Primary |
| FAA TFR Feed | `https://tfr.faa.gov/tfr2/list.html` | None | Backup |

Temporary Flight Restrictions (TFRs) often correlate with VIP movement, military exercises, or security events.

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
| **Map** | Leaflet 1.9 + react-leaflet 4 | Free, no API key, OSM tiles |
| **Tiles** | OpenStreetMap via `tile.openstreetmap.org` | Free, open, reliable |
| **Styling** | Tailwind CSS 3 | Utility-first, minimal config |
| **HTTP** | Native `fetch` | No extra dependencies |
| **Linting** | ESLint 10 (flat config) + typescript-eslint | Consistent code |
| **Satellites** | satellite.js (planned) | SGP4 orbit propagation |

### Why These Choices

- **Leaflet + OpenStreetMap** over Mapbox/Google Maps: Completely free with no API key, token, or billing account. Mapbox requires a token and has usage limits. Google Maps requires billing. OSM tiles are served free under a fair-use tile policy.
- **Next.js API routes as a proxy**: Each external API gets its own proxy route, giving us centralized caching, rate limiting, and response shaping without exposing upstream API structures to the client.
- **ADSB.lol** over OpenSky Network: OpenSky requires OAuth2 credentials (since March 2025), has stricter rate limits, and does not have a dedicated military endpoint. ADSB.lol has `/v2/mil` built in and requires no authentication.
- **Multiple independent data layers**: Each layer has its own polling hook, proxy route, and marker component. Layers fail independently — if one API goes down, the others keep working.

## Project Structure

```
overwatch/
├── CLAUDE.md                    # Claude Code conventions
├── README.md                    # This file
├── PLAN.md                      # Build prompts for Claude Code
├── IMPLEMENTATION.md            # Detailed technical implementation docs
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── eslint.config.mjs            # ESLint 10 flat config
├── .env.example                 # NEXT_PUBLIC_API_BASE_URL etc.
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout + metadata
│   │   ├── page.tsx             # Main page (map + filters + panel + overlays)
│   │   ├── icon.svg             # Favicon (amber aircraft silhouette)
│   │   └── api/
│   │       └── aircraft/
│   │           └── route.ts     # Proxy to ADSB.lol
│   ├── components/
│   │   ├── Map.tsx              # Leaflet map (client component, no SSR)
│   │   ├── MapWrapper.tsx       # Dynamic import wrapper for Map (ssr: false)
│   │   ├── AircraftMarker.tsx   # Aircraft marker with type-specific icons
│   │   ├── AircraftPanel.tsx    # Detail panel (sidebar on desktop, bottom sheet on mobile)
│   │   ├── FilterBar.tsx        # Search + altitude/category filters (responsive)
│   │   └── StatusBar.tsx        # Connection status + counts
│   ├── hooks/
│   │   └── useAircraftData.ts   # Aircraft polling hook (10s interval)
│   ├── lib/
│   │   ├── api.ts               # Aircraft fetch wrapper
│   │   ├── types.ts             # Aircraft TypeScript interfaces
│   │   ├── utils.ts             # Formatting helpers
│   │   └── aircraftIcons.ts     # Type classification + SVG icon mapping
│   └── styles/
│       └── globals.css          # Tailwind directives
└── public/
    └── favicon.svg              # Favicon (also served from src/app/icon.svg)
```

Planned files for future data layers (vessels, satellites, conflicts, NOTAMs) are documented in IMPLEMENTATION.md.

## Running Locally

```bash
git clone <repo-url> overwatch
cd overwatch
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. No API keys needed. You should see a status bar, filter bar, and a map with military aircraft updating every 10 seconds, rendered with type-specific icons. Click any aircraft for details. Use the search and filters to narrow results. The app is responsive and works on mobile.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.adsb.lol` | Upstream ADS-B API base |
| `POLL_INTERVAL_MS` | `10000` | How often to refresh aircraft data |
| `NEXT_PUBLIC_DEFAULT_LAT` | `38.9` | Default map center latitude |
| `NEXT_PUBLIC_DEFAULT_LNG` | `-77.0` | Default map center longitude |
| `NEXT_PUBLIC_DEFAULT_ZOOM` | `5` | Default map zoom level |

## Legal

ADS-B data is broadcast unencrypted on open radio frequencies (1090 MHz). AIS data is broadcast unencrypted on VHF marine frequencies. Receiving, aggregating, and displaying this data is legal in the United States and most jurisdictions. This project uses only publicly available, community-aggregated data through open APIs.

Satellite TLE data from CelesTrak is derived from the US Space Command public catalog. Conflict event data from GDELT is derived from open news sources. NOTAM/TFR data is published by the FAA for public consumption.

The ADSB.lol data is licensed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Attribution: Data from ADSB.lol contributors.

## License

MIT
