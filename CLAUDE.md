# CLAUDE.md — Overwatch Project Conventions

## Project Overview

Overwatch is a real-time military aircraft tracker using ADSB.lol's free public API and Leaflet.js maps. It is a Next.js 14 App Router project in TypeScript with Tailwind CSS.

## Current Implementation Status

- **Phase 1 (Scaffold):** Complete — project structure, dependencies, configuration
- **Phase 2 (Types & API Utility Layer):** Complete — TypeScript interfaces, helper functions, API client
- **Phase 3 (API Proxy Route):** Complete — full upstream proxy with caching, timeout, error handling

### What's Implemented

| File | Status | Description |
|---|---|---|
| `src/lib/types.ts` | Done | `AircraftState`, `AircraftResponse` interfaces; `hasPosition`, `isMilitary` guards |
| `src/lib/utils.ts` | Done | `formatAltitude`, `formatSpeed`, `formatCallsign`, `getAircraftLabel` helpers |
| `src/lib/api.ts` | Done | `fetchMilitaryAircraft` — fetches from local proxy with validation |
| `src/app/api/aircraft/route.ts` | Done | Proxies to ADSB.lol `/v2/mil` with 15s timeout, cache headers, structured 502 errors |
| `src/app/layout.tsx` | Done | Root layout with metadata and globals.css import |
| `src/app/page.tsx` | Placeholder | Renders `<h1>Overwatch</h1>` — needs map integration (Phase 5-6) |
| `src/components/` | Empty | Map, AircraftMarker, StatusBar, etc. not yet created |
| `src/hooks/` | Empty | useAircraftData polling hook not yet created |

## Commands

- `npm run dev` — Start dev server on port 3000
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm run type-check` — Run `tsc --noEmit`

## Architecture Rules

- **Next.js App Router only.** No Pages Router. All routes go in `src/app/`.
- **Server Components by default.** Only add `"use client"` when the component needs browser APIs, hooks, or event handlers.
- **Leaflet must be dynamically imported** with `{ ssr: false }` via `next/dynamic`. Leaflet accesses `window` and will crash during SSR.
- **API proxy pattern.** The client never calls `api.adsb.lol` directly. All aircraft data flows through `src/app/api/aircraft/route.ts`, which proxies to the upstream API. This gives us a single place for caching, error handling, and rate limiting.
- **No API keys are needed.** ADSB.lol requires no authentication. Do not add any `.env` variables for API keys.

## Code Style

- TypeScript strict mode. No `any` types — use `unknown` and narrow.
- Prefer `interface` over `type` for object shapes.
- Prefer named exports over default exports (except for Next.js page/layout components which require default exports).
- Use `const` arrow functions for components: `const MyComponent = () => { ... }`.
- Use native `fetch` — do not add axios or other HTTP libraries.
- CSS via Tailwind utility classes. No CSS modules, no styled-components.

## File Conventions

- Components: `src/components/ComponentName.tsx` (PascalCase)
- Hooks: `src/hooks/useHookName.ts` (camelCase with `use` prefix)
- Library/utils: `src/lib/filename.ts` (camelCase)
- API routes: `src/app/api/resource/route.ts`
- Types: `src/lib/types.ts` (centralized)

## Key Technical Details

### ADSB.lol API

- Base URL: `https://api.adsb.lol`
- Military endpoint: `GET /v2/mil` — returns `{ ac: AircraftState[], msg: string, now: number, total: number, ctime: number, ptime: number }`
- Each aircraft object has: `hex`, `flight`, `lat`, `lon`, `alt_baro`, `alt_geom`, `gs`, `track`, `t` (type code), `r` (registration), `dbFlags`, `squawk`, `seen`, `seen_pos`, `category`
- Military flag: `(aircraft.dbFlags & 1) !== 0`
- No auth required. No rate limit currently enforced, but poll no faster than every 10 seconds.
- Fallback: `https://api.adsb.one` uses identical endpoints.

### TypeScript Types (src/lib/types.ts)

- `AircraftState` — interface for a single aircraft with all fields from `/v2/mil`. Position/telemetry fields are optional since not all aircraft broadcast all fields.
- `AircraftResponse` — interface for the top-level API response containing `ac[]`, `msg`, `now`, `total`, `ctime`, `ptime`.
- `hasPosition(aircraft)` — returns `true` only when both `lat` and `lon` are defined numbers.
- `isMilitary(aircraft)` — returns `true` when `(dbFlags & 1) !== 0`.

### Utility Functions (src/lib/utils.ts)

- `formatAltitude(alt)` — `"Ground"` | `"N/A"` | `"12,500 ft"`
- `formatSpeed(gs)` — `"N/A"` | `"450 kts"`
- `formatCallsign(flight)` — trims whitespace, returns `"UNKNOWN"` if empty
- `getAircraftLabel(ac)` — callsign > registration > hex code

### API Client (src/lib/api.ts)

- `fetchMilitaryAircraft()` — fetches from `/api/aircraft` (local proxy), validates the response shape, throws on HTTP errors or malformed data.

### API Proxy Route (src/app/api/aircraft/route.ts)

- Exports an async `GET` handler using Next.js App Router route handler conventions
- Reads upstream base URL from `process.env.NEXT_PUBLIC_API_BASE_URL`, defaulting to `"https://api.adsb.lol"`
- Fetches `GET {baseUrl}/v2/mil` with a 15-second timeout via `AbortController`
- On success: forwards JSON with `Cache-Control: public, s-maxage=5, stale-while-revalidate=10`
- On fetch error (network/timeout): returns 502 `{ error: "Upstream API unavailable", details: error.message }`
- On non-200 upstream: returns 502 with upstream status code in details

### Leaflet Map

- Tile URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Attribution: `© OpenStreetMap contributors`
- Use `react-leaflet` v4 components: `MapContainer`, `TileLayer`, `Marker`, `Popup`
- Leaflet CSS must be imported: `import 'leaflet/dist/leaflet.css'`
- Custom plane icon using Leaflet's `DivIcon` with inline SVG rotated by the aircraft's `track` heading

### Polling

- Use a `useEffect` + `setInterval` pattern in a custom hook (`useAircraftData`)
- Poll interval: 10 seconds (configurable via env)
- On each poll, replace the full aircraft state (not merge) since the API returns a complete snapshot
- Track `lastUpdated` timestamp for the status bar

## Allowed Dependencies

Only install these packages. Do not add others without explicit approval:

```
next@14
react@18
react-dom@18
leaflet@1
react-leaflet@4
@types/leaflet
tailwindcss@3
postcss
autoprefixer
typescript@5
eslint
eslint-config-next
@types/react
@types/react-dom
@types/node
prettier
```

## Testing Approach

- Manual testing via the browser for this MVP
- Type checking via `tsc --noEmit` is the primary automated check
- ESLint catches common issues

## Error Handling

- API proxy route: return structured JSON errors with appropriate HTTP status codes
- Client polling hook: catch fetch errors, set an error state, show in StatusBar, continue polling
- Never crash the app on a failed API request — show "Connection lost" in the status bar and retry on the next interval

## Performance

- The `/v2/mil` endpoint typically returns 200-800 aircraft. This is small enough that no virtualization is needed for markers.
- Use `React.memo` on `AircraftMarker` to prevent unnecessary re-renders when aircraft state hasn't changed.
- Do not store historical positions in this MVP — each poll replaces state entirely.
