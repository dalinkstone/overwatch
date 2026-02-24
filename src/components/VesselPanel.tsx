"use client";

import { VesselData, getVesselCategory, VESSEL_CATEGORY_LABELS } from "@/lib/vesselTypes";
import { countryCodeToFlag } from "@/lib/countryLookup";

interface VesselPanelProps {
  vessel: VesselData | null;
  onClose: () => void;
  signalLost: boolean;
}


const MILITARY_CATEGORY_LABELS: Record<string, string> = {
  warship: "Warship",
  "coast-guard": "Coast Guard",
  "law-enforcement": "Law Enforcement",
  "military-support": "Military Support",
};

const formatCoordinate = (value: number): string => {
  return value.toFixed(4);
};

const formatHeading = (heading: number): string => {
  if (heading === 511) return "N/A";
  return `${Math.round(heading)}°`;
};

const formatLastUpdate = (timestamp: number): string => {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const VesselPanel = ({
  vessel,
  onClose,
  signalLost,
}: VesselPanelProps) => {
  return (
    <div
      className={`absolute z-[1000] transform bg-zinc-800 text-white transition-transform duration-300 ease-in-out
        bottom-0 left-0 right-0 h-[60vh] rounded-t-lg shadow-[0_-4px_16px_rgba(0,0,0,0.4)]
        md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:w-80 md:rounded-t-none md:rounded-l-lg md:shadow-[-4px_0_16px_rgba(0,0,0,0.4)]
        ${vessel ? "translate-y-0 md:translate-x-0 md:translate-y-0" : "translate-y-full md:translate-x-full md:translate-y-0"}`}
    >
      {vessel && (
        <div className="flex h-full flex-col overflow-y-auto p-4">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {vessel.name.trim() || "Unknown Vessel"}
              </h2>
              <div className="mt-1 text-xs text-zinc-400">
                MMSI: {vessel.mmsi}
              </div>
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

          {/* Country flag badge */}
          {vessel.flagCode && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-700/50 px-3 py-1 text-sm">
                <span className="text-base leading-none">{countryCodeToFlag(vessel.flagCode)}</span>
                <span className="text-zinc-200">{vessel.flag}</span>
              </span>
            </div>
          )}

          {/* Military badge */}
          {vessel.isMilitary && vessel.militaryCategory && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/50 px-3 py-1 text-xs font-medium text-red-300">
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
                {MILITARY_CATEGORY_LABELS[vessel.militaryCategory] ?? vessel.militaryCategory}
              </span>
            </div>
          )}

          {/* Details */}
          <div className="space-y-3">
            <DetailRow
              label="Type"
              value={`${VESSEL_CATEGORY_LABELS[getVesselCategory(vessel.shipType)] ?? "Other"} (${vessel.shipType})`}
            />
            <DetailRow
              label="Speed"
              value={`${vessel.sog.toFixed(1)} kts`}
            />
            <DetailRow
              label="Course"
              value={`${Math.round(vessel.cog)}°`}
            />
            <DetailRow
              label="Heading"
              value={formatHeading(vessel.heading)}
            />
            <div className="border-t border-zinc-700" />
            <DetailRow
              label="Destination"
              value={vessel.destination.trim() || "Not reported"}
            />
            <div className="border-t border-zinc-700" />
            <DetailRow
              label="Latitude"
              value={formatCoordinate(vessel.lat)}
            />
            <DetailRow
              label="Longitude"
              value={formatCoordinate(vessel.lon)}
            />
            <div className="border-t border-zinc-700" />
            <DetailRow
              label="Last Update"
              value={formatLastUpdate(vessel.lastUpdate)}
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
