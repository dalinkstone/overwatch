# CLAUDE.md — Overwatch Project Conventions

## Project Overview

Overwatch is a real-time military aircraft tracker using ADSB.lol's free public API and Leaflet.js maps. It is a Next.js 14 App Router project in TypeScript with Tailwind CSS.

## Commands

- `npm run dev` — Start dev server on port 3000
- `npm run build` — Production build
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
- Each aircraft object has: `hex`, `flight`, `lat`, `lon`, `alt_baro`, `gs`, `track`, `t` (type code), `r` (registration), `dbFlags`, `squawk`, `seen`, `seen_pos`
- Military flag: `(aircraft.dbFlags & 1) !== 0`
- No auth required. No rate limit currently enforced, but poll no faster than every 10 seconds.
- Fallback: `https://api.adsb.one` uses identical endpoints.

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
