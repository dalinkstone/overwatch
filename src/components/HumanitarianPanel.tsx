"use client";

import {
  HumanitarianCrisis,
  getSeverityColor,
  getCrisisTypeLabel,
} from "@/lib/humanitarianTypes";

interface HumanitarianPanelProps {
  crisis: HumanitarianCrisis;
  onClose: () => void;
}

/** Severity badge Tailwind classes. */
const SEVERITY_BADGE_CLASSES: Record<HumanitarianCrisis["severity"], string> = {
  critical: "bg-red-900/50 text-red-300",
  major: "bg-red-900/40 text-red-400",
  moderate: "bg-orange-900/50 text-orange-300",
  minor: "bg-yellow-900/50 text-yellow-300",
};

/** Capitalize first letter. */
const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

/** Format an ISO date string for display. */
const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const HumanitarianPanel = ({ crisis, onClose }: HumanitarianPanelProps) => {
  return (
    <div
      className={`absolute z-[1000] transform bg-zinc-900 text-white transition-transform duration-300 ease-in-out
        bottom-0 left-0 right-0 max-h-[60vh] rounded-t-lg shadow-[0_-4px_16px_rgba(0,0,0,0.4)]
        md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:max-h-full md:w-80 md:rounded-t-none md:rounded-l-lg md:shadow-[-4px_0_16px_rgba(0,0,0,0.4)]
        translate-y-0 md:translate-x-0 md:translate-y-0`}
    >
      <div className="flex h-full flex-col overflow-y-auto p-4">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="mr-2 min-w-0">
            <h2 className="text-lg font-bold leading-tight">{crisis.country}</h2>
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

        {/* Severity badge */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${SEVERITY_BADGE_CLASSES[crisis.severity]}`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: getSeverityColor(crisis.severity) }}
            />
            {capitalize(crisis.severity)}
          </span>
          <span className="inline-flex items-center rounded-full bg-zinc-700/60 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
            {crisis.countryIso3}
          </span>
        </div>

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-zinc-800 p-3 text-center">
            <div className="text-xl font-bold text-teal-400">{crisis.disasterCount}</div>
            <div className="text-[11px] text-zinc-400">Active Disasters</div>
          </div>
          <div className="rounded-lg bg-zinc-800 p-3 text-center">
            <div className="text-xl font-bold text-teal-400">{crisis.reportCount}</div>
            <div className="text-[11px] text-zinc-400">Reports (30d)</div>
          </div>
        </div>

        <div className="border-t border-teal-500/20" />

        {/* Active Disasters */}
        {crisis.disasters.length > 0 && (
          <div className="mb-3 mt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-400">
              Active Disasters
            </div>
            <div className="space-y-3">
              {crisis.disasters.map((disaster) => (
                <div
                  key={disaster.id}
                  className="rounded-lg bg-zinc-800/60 p-2.5"
                >
                  <div className="mb-1.5 text-sm font-medium leading-snug">
                    {disaster.name}
                  </div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-teal-900/40 px-2 py-0.5 text-[10px] font-medium text-teal-300">
                      {getCrisisTypeLabel(disaster.type)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        disaster.status === "ongoing"
                          ? "bg-green-900/40 text-green-300"
                          : disaster.status === "alert"
                            ? "bg-amber-900/40 text-amber-300"
                            : "bg-zinc-700/50 text-zinc-400"
                      }`}
                    >
                      {disaster.status === "ongoing" && (
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                      )}
                      {capitalize(disaster.status)}
                    </span>
                  </div>
                  {disaster.glideNumber && (
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">GLIDE</span>
                      <span className="font-mono text-zinc-300">{disaster.glideNumber}</span>
                    </div>
                  )}
                  {disaster.dateStarted && (
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Started</span>
                      <span className="text-zinc-300">{formatDate(disaster.dateStarted)}</span>
                    </div>
                  )}
                  <a
                    href={disaster.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300"
                  >
                    View on ReliefWeb
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path d="M6.22 8.72a.75.75 0 001.06 1.06l5.22-5.22v1.69a.75.75 0 001.5 0v-3.5a.75.75 0 00-.75-.75h-3.5a.75.75 0 000 1.5h1.69L6.22 8.72z" />
                      <path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 007 4H4.75A2.75 2.75 0 002 6.75v4.5A2.75 2.75 0 004.75 14h4.5A2.75 2.75 0 0012 11.25V9a.75.75 0 00-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5z" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest Report */}
        {crisis.lastReportTitle && (
          <>
            <div className="border-t border-teal-500/20" />
            <div className="mb-3 mt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-400">
                Latest Report
              </div>
              <div className="rounded-lg bg-zinc-800/60 p-2.5">
                <div className="mb-1.5 text-sm font-medium leading-snug">
                  {crisis.lastReportTitle}
                </div>
                {crisis.lastReportDate && (
                  <div className="mb-1.5 text-xs text-zinc-400">
                    {formatDate(crisis.lastReportDate)}
                  </div>
                )}
                {crisis.lastReportUrl && (
                  <a
                    href={crisis.lastReportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300"
                  >
                    Read full report
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path d="M6.22 8.72a.75.75 0 001.06 1.06l5.22-5.22v1.69a.75.75 0 001.5 0v-3.5a.75.75 0 00-.75-.75h-3.5a.75.75 0 000 1.5h1.69L6.22 8.72z" />
                      <path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 007 4H4.75A2.75 2.75 0 002 6.75v4.5A2.75 2.75 0 004.75 14h4.5A2.75 2.75 0 0012 11.25V9a.75.75 0 00-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5z" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </>
        )}

        <div className="border-t border-teal-500/20" />

        {/* Location */}
        <div className="mb-3 mt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-400">
            Location
          </div>
          <div className="space-y-3">
            <DetailRow label="Country" value={crisis.country} />
            <DetailRow label="ISO3" value={crisis.countryIso3} />
            <DetailRow label="Centroid Lat" value={crisis.lat.toFixed(4)} />
            <DetailRow label="Centroid Lon" value={crisis.lon.toFixed(4)} />
          </div>
        </div>

        <div className="border-t border-teal-500/20" />

        {/* Timestamp */}
        <div className="mb-3 mt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-400">
            Last Updated
          </div>
          <div className="text-sm text-zinc-300">
            {formatDate(crisis.updatedAt)}
          </div>
        </div>

        <div className="border-t border-teal-500/20" />

        {/* Attribution footer */}
        <div className="mt-3 text-center text-[10px] text-zinc-500">
          Data: UN OCHA / ReliefWeb
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-zinc-400">{label}</span>
    <span className="text-right font-mono text-sm">{value}</span>
  </div>
);
