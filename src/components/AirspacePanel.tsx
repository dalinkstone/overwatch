"use client";

import { useState } from "react";
import {
  AirspaceZone,
  AirspaceType,
  AIRSPACE_COLORS,
  AIRSPACE_TYPE_LABELS,
  TFR_TYPE_LABELS,
} from "@/lib/airspaceTypes";

interface AirspacePanelProps {
  zone: AirspaceZone | null;
  onClose: () => void;
  signalLost?: boolean;
}

/** Format an ISO datetime string to both UTC and local display. */
const formatDatetime = (iso: string): { utc: string; local: string } => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return { utc: iso, local: iso };
  const utc = date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }) + " UTC";
  const local = date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " local";
  return { utc, local };
};

/** Tailwind bg classes for each airspace type badge. */
const TYPE_BADGE_CLASSES: Record<AirspaceType, string> = {
  prohibited: "bg-red-900/50 text-red-300",
  restricted: "bg-orange-900/50 text-orange-300",
  moa: "bg-yellow-900/50 text-yellow-300",
  warning: "bg-purple-900/50 text-purple-300",
  alert: "bg-cyan-900/50 text-cyan-300",
  tfr: "bg-red-900/50 text-red-300",
};

const DESCRIPTION_TRUNCATE_LENGTH = 200;

export const AirspacePanel = ({ zone, onClose, signalLost }: AirspacePanelProps) => {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const altitudeRange =
    zone?.lowerAltitude || zone?.upperAltitude
      ? `${zone.lowerAltitude ?? "Unknown"} to ${zone.upperAltitude ?? "Unknown"}`
      : null;

  const needsTruncation =
    zone?.description && zone.description.length > DESCRIPTION_TRUNCATE_LENGTH;

  const displayDescription =
    zone?.description && needsTruncation && !descriptionExpanded
      ? zone.description.slice(0, DESCRIPTION_TRUNCATE_LENGTH) + "..."
      : zone?.description;

  return (
    <div
      className={`absolute z-[1000] transform bg-zinc-900 text-white transition-transform duration-300 ease-in-out
        bottom-0 left-0 right-0 max-h-[60vh] rounded-t-lg shadow-[0_-4px_16px_rgba(0,0,0,0.4)]
        md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:max-h-full md:w-80 md:rounded-t-none md:rounded-l-lg md:shadow-[-4px_0_16px_rgba(0,0,0,0.4)]
        ${zone ? "translate-y-0 md:translate-x-0 md:translate-y-0" : "translate-y-full md:translate-x-full md:translate-y-0"}`}
    >
      {zone && (
        <div className="flex h-full flex-col overflow-y-auto p-4">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div className="mr-2 min-w-0">
              <h2 className="text-lg font-bold leading-tight">{zone.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
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

          {/* Signal lost badge */}
          {signalLost && (
            <div className="mb-3 flex items-center gap-2 rounded bg-red-900/50 px-3 py-1.5 text-xs text-red-300">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
              Signal lost — zone no longer in data
            </div>
          )}

          {/* Type badge + TFR sub-type badge */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${TYPE_BADGE_CLASSES[zone.type]}`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: AIRSPACE_COLORS[zone.type] }}
              />
              {AIRSPACE_TYPE_LABELS[zone.type]}
            </span>
            {zone.type === "tfr" && zone.tfrType && (
              <span className="inline-flex items-center rounded-full bg-zinc-700/60 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                {TFR_TYPE_LABELS[zone.tfrType]}
              </span>
            )}
          </div>

          {/* Active status indicator */}
          <div className="mb-4">
            {zone.isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-900/40 px-3 py-1 text-xs font-medium text-green-300">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                Currently Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-700/50 px-3 py-1 text-xs font-medium text-zinc-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500" />
                Inactive
              </span>
            )}
          </div>

          {/* Altitude */}
          {altitudeRange && (
            <>
              <div className="mb-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-400">
                  Altitude
                </div>
                <div className="space-y-3">
                  <DetailRow label="Range" value={altitudeRange} />
                  <DetailRow
                    label="Lower"
                    value={zone.lowerAltitude ?? "Unknown"}
                  />
                  <DetailRow
                    label="Upper"
                    value={zone.upperAltitude ?? "Unknown"}
                  />
                </div>
              </div>
              <div className="border-t border-orange-400/20" />
            </>
          )}

          {/* Schedule / Effective period */}
          <div className="mb-3 mt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-400">
              {zone.source === "tfr" ? "Effective Period" : "Schedule"}
            </div>
            <div className="space-y-3">
              {zone.source === "sua" && (
                <DetailRow label="Schedule" value={zone.schedule ?? "N/A"} />
              )}
              {zone.source === "tfr" && zone.effectiveStart && (
                <>
                  <DetailRow
                    label="Start (UTC)"
                    value={formatDatetime(zone.effectiveStart).utc}
                  />
                  <DetailRow
                    label="Start (local)"
                    value={formatDatetime(zone.effectiveStart).local}
                  />
                </>
              )}
              {zone.source === "tfr" && zone.effectiveEnd && (
                <>
                  <DetailRow
                    label="End (UTC)"
                    value={formatDatetime(zone.effectiveEnd).utc}
                  />
                  <DetailRow
                    label="End (local)"
                    value={formatDatetime(zone.effectiveEnd).local}
                  />
                </>
              )}
            </div>
          </div>

          <div className="border-t border-orange-400/20" />

          {/* Location */}
          <div className="mb-3 mt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-400">
              Location
            </div>
            <div className="space-y-3">
              {zone.state && <DetailRow label="State" value={zone.state} />}
              {zone.center && (
                <>
                  <DetailRow
                    label="Center Lat"
                    value={zone.center.lat.toFixed(4)}
                  />
                  <DetailRow
                    label="Center Lon"
                    value={zone.center.lon.toFixed(4)}
                  />
                </>
              )}
              {zone.radiusNm !== undefined && (
                <DetailRow label="Radius" value={`${zone.radiusNm} NM`} />
              )}
            </div>
          </div>

          {/* Description */}
          {zone.description && (
            <>
              <div className="border-t border-orange-400/20" />
              <div className="mb-3 mt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-400">
                  Description
                </div>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {displayDescription}
                </p>
                {needsTruncation && (
                  <button
                    onClick={() => setDescriptionExpanded((prev) => !prev)}
                    className="mt-1 text-xs font-medium text-orange-400 hover:text-orange-300"
                  >
                    {descriptionExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            </>
          )}

          <div className="border-t border-orange-400/20" />

          {/* Source badge */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-zinc-400">Source</span>
            <span className="rounded-full bg-orange-900/40 px-2.5 py-0.5 text-xs font-medium text-orange-300">
              {zone.source === "sua" ? "SUA" : "TFR"}
            </span>
          </div>

          {/* Zone ID */}
          <div className="mt-3">
            <DetailRow label="Zone ID" value={zone.id} />
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-zinc-400">{label}</span>
    <span className="text-right font-mono text-sm">{value}</span>
  </div>
);
