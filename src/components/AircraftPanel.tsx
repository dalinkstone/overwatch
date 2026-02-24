"use client";

import { AircraftState } from "@/lib/types";
import { formatAltitude, formatSpeed, formatCallsign } from "@/lib/utils";
import { getAircraftCategory, getCategoryLabel } from "@/lib/aircraftIcons";

interface AircraftPanelProps {
  aircraft: AircraftState | null;
  onClose: () => void;
  signalLost: boolean;
}

const formatCoordinate = (value: number | undefined): string => {
  if (value === undefined) return "N/A";
  return value.toFixed(4);
};

const formatHeading = (track: number | undefined): string => {
  if (track === undefined) return "N/A";
  return `${Math.round(track)}°`;
};

const formatLastSeen = (seen: number | undefined): string => {
  if (seen === undefined) return "N/A";
  if (seen < 1) return "Just now";
  if (seen < 60) return `${Math.round(seen)}s ago`;
  return `${Math.floor(seen / 60)}m ${Math.round(seen % 60)}s ago`;
};

export const AircraftPanel = ({
  aircraft,
  onClose,
  signalLost,
}: AircraftPanelProps) => {
  return (
    <div
      className={`absolute right-0 top-0 z-[1000] h-full w-80 transform bg-zinc-800 text-white shadow-[-4px_0_16px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-in-out ${
        aircraft ? "translate-x-0" : "translate-x-full"
      } rounded-l-lg`}
    >
      {aircraft && (
        <div className="flex h-full flex-col overflow-y-auto p-4">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {formatCallsign(aircraft.flight)}
              </h2>
              {signalLost && (
                <span className="mt-1 inline-flex items-center gap-1 rounded bg-red-900/60 px-2 py-0.5 text-xs text-red-300">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                  Signal lost
                </span>
              )}
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

          {/* Military badge */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-900/50 px-3 py-1 text-xs font-medium text-amber-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M10 1a.75.75 0 01.65.38l1.95 3.4 3.81.66a.75.75 0 01.4 1.26L14.08 9.5l.6 3.76a.75.75 0 01-1.07.8L10 12.13l-3.6 1.93a.75.75 0 01-1.08-.8l.6-3.76L3.18 6.7a.75.75 0 01.4-1.26l3.82-.66 1.95-3.4A.75.75 0 0110 1z"
                  clipRule="evenodd"
                />
              </svg>
              Military
            </span>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <DetailRow label="ICAO Hex" value={aircraft.hex.toUpperCase()} />
            <DetailRow label="Registration" value={aircraft.r ?? "N/A"} />
            <DetailRow label="Type" value={aircraft.t ?? "N/A"} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Category</span>
              <span className="rounded-full bg-cyan-900/50 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
                {getCategoryLabel(getAircraftCategory(aircraft.t))}
              </span>
            </div>
            <div className="border-t border-zinc-700" />
            <DetailRow
              label="Altitude"
              value={formatAltitude(aircraft.alt_baro)}
            />
            <DetailRow label="Speed" value={formatSpeed(aircraft.gs)} />
            <DetailRow label="Heading" value={formatHeading(aircraft.track)} />
            <div className="border-t border-zinc-700" />
            <DetailRow label="Squawk" value={aircraft.squawk ?? "N/A"} />
            <DetailRow
              label="Latitude"
              value={formatCoordinate(aircraft.lat)}
            />
            <DetailRow
              label="Longitude"
              value={formatCoordinate(aircraft.lon)}
            />
            <div className="border-t border-zinc-700" />
            <DetailRow
              label="Last Seen"
              value={formatLastSeen(aircraft.seen)}
            />
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
