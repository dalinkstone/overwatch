# Overwatch — Open Source Military Aircraft Tracker

A real-time military aircraft tracking application built with TypeScript, using publicly available ADS-B data and an interactive map interface.

## What It Does

Overwatch polls the [ADSB.lol](https://www.adsb.lol/) public API for aircraft flagged as military, then renders their positions, headings, altitudes, and callsigns on a live Leaflet.js map. Users can click any aircraft to see detail (type, registration, speed, altitude, squawk code) and optionally follow its movement over time.

All data comes from **ADS-B (Automatic Dependent Surveillance-Broadcast)** — a technology where aircraft broadcast their GPS position, identity, and flight parameters on 1090 MHz. Volunteer-run ground receivers collect these signals and feed them to aggregators like ADSB.lol. This data is inherently public; it is broadcast unencrypted over open radio frequencies.

## Data Source

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

### How Military Aircraft Are Identified

Each aircraft record includes a `dbFlags` bitfield. The first bit indicates military status:

```
military = (dbFlags & 1) !== 0
```

This flag is maintained by community-curated databases that map ICAO 24-bit hex addresses to aircraft metadata (operator, type, registration, military/civilian status).

### Key Fields in the API Response

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

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Runtime** | Node.js 20+ | LTS, stable |
| **Language** | TypeScript 5 | Type safety |
| **Framework** | Next.js 14 (App Router) | Simple fullstack, API routes as proxy |
| **Map** | Leaflet 1.9 + react-leaflet 4 | Free, no API key, OSM tiles |
| **Tiles** | OpenStreetMap via `tile.openstreetmap.org` | Free, open, reliable |
| **Styling** | Tailwind CSS 3 | Utility-first, minimal config |
| **HTTP** | Native `fetch` | No extra dependencies |
| **Linting** | ESLint + Prettier | Consistent code |

### Why These Choices

- **Leaflet + OpenStreetMap** over Mapbox/Google Maps: Completely free with no API key, token, or billing account. Mapbox requires a token and has usage limits. Google Maps requires billing. OSM tiles are served free under a fair-use tile policy.
- **Next.js API routes as a proxy**: The ADSB.lol API returns CORS headers, but routing through our own API route gives us a place to add caching, rate limiting, and response shaping without exposing the upstream API structure directly to the client.
- **ADSB.lol** over OpenSky Network: OpenSky requires OAuth2 credentials (since March 2025), has stricter rate limits, and does not have a dedicated military endpoint. ADSB.lol has `/v2/mil` built in and requires no authentication.

## Project Structure

```
overwatch/
├── CLAUDE.md                    # Claude Code conventions
├── README.md                    # This file
├── PLAN.md                      # Build prompts for Claude Code
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── .env.example                 # NEXT_PUBLIC_API_BASE_URL etc.
├── .eslintrc.json
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Main page (map + sidebar)
│   │   └── api/
│   │       └── aircraft/
│   │           └── route.ts     # Proxy to ADSB.lol
│   ├── components/
│   │   ├── Map.tsx              # Leaflet map (client component, no SSR)
│   │   ├── MapWrapper.tsx       # Dynamic import wrapper for Map (ssr: false)
│   │   ├── AircraftMarker.tsx   # Individual plane marker (React.memo'd)
│   │   ├── StatusBar.tsx        # Connection status + aircraft count
│   │   ├── AircraftPanel.tsx    # Detail sidebar/panel (planned)
│   │   └── FilterBar.tsx        # Type/altitude/callsign filters (planned)
│   ├── hooks/
│   │   └── useAircraftData.ts   # Polling hook (10s interval, error-resilient)
│   ├── lib/
│   │   ├── api.ts               # Fetch wrapper for our proxy
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── utils.ts             # Helpers (altitude formatting, etc.)
│   └── styles/
│       └── globals.css          # Tailwind directives
└── public/
    └── icons/
        └── aircraft.svg         # Plane icon for map markers
```

## Running Locally

```bash
git clone <repo-url> overwatch
cd overwatch
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. No API keys needed. You should see a status bar at the top and a map with military aircraft updating every 10 seconds.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.adsb.lol` | Upstream ADS-B API base |
| `POLL_INTERVAL_MS` | `10000` | How often to refresh aircraft data |
| `NEXT_PUBLIC_DEFAULT_LAT` | `38.9` | Default map center latitude |
| `NEXT_PUBLIC_DEFAULT_LNG` | `-77.0` | Default map center longitude |
| `NEXT_PUBLIC_DEFAULT_ZOOM` | `5` | Default map zoom level |

## Legal

ADS-B data is broadcast unencrypted on open radio frequencies (1090 MHz). Receiving, aggregating, and displaying this data is legal in the United States and most jurisdictions. This project uses only publicly available, community-aggregated data through open APIs.

The ADSB.lol data is licensed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Attribution: Data from ADSB.lol contributors.

## License

MIT
