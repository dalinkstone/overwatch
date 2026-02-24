"use client";

import {
  SatellitePosition,
  SATELLITE_COLORS,
  SATELLITE_CATEGORY_LABELS,
  formatAltitude,
  formatPeriod,
  getOrbitType,
} from "@/lib/satelliteTypes";

interface SatellitePanelProps {
  satellite: SatellitePosition | null;
  onClose: () => void;
  signalLost: boolean;
}

const formatCoordinate = (value: number): string => {
  return value.toFixed(4) + "°";
};

const formatEpoch = (epoch: string): string => {
  const date = new Date(epoch);
  if (isNaN(date.getTime())) return epoch;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const SatellitePanel = ({
  satellite,
  onClose,
  signalLost,
}: SatellitePanelProps) => {
  return (
    <div
      className={`absolute z-[600] transform bg-zinc-900 text-white transition-transform duration-300 ease-in-out
        bottom-0 left-0 right-0 max-h-[60vh] rounded-t-lg shadow-[0_-4px_16px_rgba(0,0,0,0.4)]
        md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:max-h-full md:w-80 md:rounded-t-none md:rounded-l-lg md:shadow-[-4px_0_16px_rgba(0,0,0,0.4)]
        ${satellite ? "translate-y-0 md:translate-x-0 md:translate-y-0" : "translate-y-full md:translate-x-full md:translate-y-0"}`}
    >
      {satellite && (
        <div className="flex h-full flex-col overflow-y-auto p-4">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{satellite.name}</h2>
              <div className="mt-1 text-xs text-zinc-400">
                NORAD ID: {satellite.noradId}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
              aria-label="Close panel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Category badge */}
          <div className="mb-4">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: SATELLITE_COLORS[satellite.category] + "33",
                color: SATELLITE_COLORS[satellite.category],
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zm-6.25-5a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm13 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM7.111 4.868a.75.75 0 011.06 0l1.06 1.06a.75.75 0 01-1.06 1.061l-1.06-1.06a.75.75 0 010-1.06zm5.788 5.788a.75.75 0 011.06 0l1.06 1.06a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM4.868 12.889a.75.75 0 011.06-1.06l1.061 1.06a.75.75 0 01-1.06 1.06l-1.06-1.06zm5.788-5.788a.75.75 0 011.06-1.06l1.06 1.06a.75.75 0 11-1.06 1.06l-1.06-1.06z" />
              </svg>
              {SATELLITE_CATEGORY_LABELS[satellite.category]}
            </span>
          </div>

          {/* Signal lost indicator */}
          {signalLost && (
            <div className="mb-4 flex items-center gap-2 rounded bg-amber-900/40 px-3 py-2 text-xs text-amber-300">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Signal lost — showing last known position
            </div>
          )}

          {/* Orbit Info section */}
          <div className="mb-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
              Orbit Info
            </div>
            <div className="space-y-3">
              <DetailRow
                label="Altitude"
                value={formatAltitude(satellite.altitude)}
              />
              <DetailRow
                label="Period"
                value={formatPeriod(satellite.period)}
              />
              <DetailRow
                label="Inclination"
                value={`${satellite.inclination.toFixed(1)}°`}
              />
              <DetailRow
                label="Orbit Type"
                value={getOrbitType(satellite.period)}
              />
              <DetailRow
                label="Velocity"
                value={`${satellite.velocity.toFixed(2)} km/s`}
              />
            </div>
          </div>

          <div className="border-t border-purple-400/20" />

          {/* Identification section */}
          <div className="mb-3 mt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
              Identification
            </div>
            <div className="space-y-3">
              <DetailRow
                label="NORAD Catalog ID"
                value={String(satellite.noradId)}
              />
              <DetailRow
                label="Intl Designator"
                value={satellite.objectId}
              />
              <DetailRow
                label="Epoch"
                value={formatEpoch(satellite.epoch)}
              />
            </div>
          </div>

          <div className="border-t border-purple-400/20" />

          {/* Position section */}
          <div className="mt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
              Position
            </div>
            <div className="space-y-3">
              <DetailRow
                label="Latitude"
                value={formatCoordinate(satellite.lat)}
              />
              <DetailRow
                label="Longitude"
                value={formatCoordinate(satellite.lon)}
              />
              <DetailRow
                label="Altitude"
                value={`${Math.round(satellite.altitude).toLocaleString()} km`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-zinc-400">{label}</span>
    <span className="font-mono text-sm">{value}</span>
  </div>
);
