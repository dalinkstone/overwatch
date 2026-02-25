"use client";

import {
  ConflictEventEnriched,
  getConflictCategoryColor,
  getConflictCategoryLabel,
  formatTone,
  formatGoldstein,
  getActorTypeLabel,
  getGeoPrecisionLabel,
  QUAD_CLASS_LABELS,
} from "@/lib/conflictTypes";

interface ConflictPanelProps {
  event: ConflictEventEnriched | null;
  onClose: () => void;
  allEvents: ConflictEventEnriched[];
}

/** Format a Date as relative time (e.g. "3 hours ago"). */
const formatRelativeTime = (date: Date): string => {
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

/** Format an ISO datetime string for display. */
const formatAbsoluteTime = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/** Get Tailwind text color class for a tone value. */
const getToneColorClass = (tone: number): string => {
  if (tone < -5) return "text-red-400";
  if (tone < -1) return "text-red-300";
  if (tone < 1) return "text-zinc-300";
  if (tone < 5) return "text-green-300";
  return "text-green-400";
};

/** Get Tailwind text color class for a Goldstein scale value. */
const getGoldsteinColorClass = (value: number): string => {
  if (value < -5) return "text-red-400";
  if (value < -1) return "text-red-300";
  if (value < 1) return "text-zinc-300";
  if (value < 5) return "text-green-300";
  return "text-green-400";
};

/** Get color for Goldstein bar visualization. */
const getGoldsteinBarColor = (value: number): string => {
  if (value < -5) return "bg-red-500";
  if (value < -1) return "bg-red-400";
  if (value < 1) return "bg-zinc-400";
  if (value < 5) return "bg-green-400";
  return "bg-green-500";
};

/** Get Tailwind color class for quad class badge. */
const getQuadClassColor = (qc: string): string => {
  if (qc === "material-conflict") return "bg-red-600 text-white";
  if (qc === "verbal-conflict") return "bg-orange-600 text-white";
  if (qc === "material-cooperation") return "bg-green-600 text-white";
  return "bg-green-500 text-white";
};

/** Get Tailwind color class for actor type badge. */
const getActorTypeBadgeClass = (type: string): string => {
  switch (type) {
    case "military": return "bg-red-800/60 text-red-200";
    case "government": return "bg-blue-800/60 text-blue-200";
    case "rebel": return "bg-orange-800/60 text-orange-200";
    case "civilian": return "bg-zinc-700 text-zinc-200";
    case "police": return "bg-yellow-800/60 text-yellow-200";
    case "intelligence": return "bg-purple-800/60 text-purple-200";
    default: return "bg-zinc-700 text-zinc-300";
  }
};

export const ConflictPanel = ({
  event,
  onClose,
  allEvents,
}: ConflictPanelProps) => {
  const eventExpired =
    event !== null && !allEvents.some((e) => e.id === event.id);

  const categoryColor = event ? getConflictCategoryColor(event.category) : "";
  const categoryLabel = event ? getConflictCategoryLabel(event.category) : "";

  const badgeTextClass =
    event?.category === "other" ? "text-zinc-900" : "text-white";

  return (
    <div
      className={`absolute z-[1000] transform bg-zinc-900 text-white transition-transform duration-300 ease-in-out
        bottom-0 left-0 right-0 max-h-[60vh] rounded-t-lg shadow-[0_-4px_16px_rgba(0,0,0,0.4)]
        md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:max-h-full md:w-80 md:rounded-t-none md:rounded-l-lg md:shadow-[-4px_0_16px_rgba(0,0,0,0.4)]
        ${event ? "translate-y-0 md:translate-x-0 md:translate-y-0" : "translate-y-full md:translate-x-full md:translate-y-0"}`}
    >
      {event && (
        <div className="flex h-full flex-col overflow-y-auto p-4">
          {/* Header */}
          <div className="mb-3 flex items-start justify-between">
            <div className="mr-2 min-w-0">
              <h2 className="text-sm font-bold leading-tight">{event.name}</h2>
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

          {/* Category badge + enrichment indicator */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${badgeTextClass}`}
              style={{ backgroundColor: categoryColor }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full bg-white/40"
              />
              {categoryLabel}
            </span>
            {event.isEnriched ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-300 ring-1 ring-green-700/50">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                Enriched
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 ring-1 ring-zinc-700">
                Media report only
              </span>
            )}
          </div>

          {/* Event expired badge */}
          {eventExpired && (
            <div className="mb-3 flex items-center gap-2 rounded bg-red-900/50 px-3 py-1.5 text-xs text-red-300">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
              Event expired — no longer in data
            </div>
          )}

          <div className="border-b border-zinc-700" />

          {/* Actors section (enriched only) */}
          {(event.actor1 || event.actor2) && (
            <>
              <div className="mb-3 mt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                  Actors
                </div>
                <div className="space-y-2">
                  {event.actor1 ? (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${getActorTypeBadgeClass(event.actor1.type)}`}>
                        {getActorTypeLabel(event.actor1.type)}
                      </span>
                      <span className="text-sm text-zinc-200 truncate">
                        {event.actor1.name}
                        {event.actor1.countryCode && (
                          <span className="ml-1 text-zinc-500">({event.actor1.countryCode})</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500 italic">Source unknown</div>
                  )}

                  <div className="flex items-center gap-2 pl-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-zinc-500">
                      <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                    </svg>
                  </div>

                  {event.actor2 ? (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${getActorTypeBadgeClass(event.actor2.type)}`}>
                        {getActorTypeLabel(event.actor2.type)}
                      </span>
                      <span className="text-sm text-zinc-200 truncate">
                        {event.actor2.name}
                        {event.actor2.countryCode && (
                          <span className="ml-1 text-zinc-500">({event.actor2.countryCode})</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500 italic">Target unknown</div>
                  )}
                </div>
              </div>
              <div className="border-b border-zinc-700" />
            </>
          )}

          {/* Event Classification section (enriched only) */}
          {event.cameoCode && (
            <>
              <div className="mb-3 mt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                  Classification
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex shrink-0 items-center rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-300 ring-1 ring-zinc-700">
                      {event.cameoCode}
                    </span>
                    <span className="text-sm text-zinc-200">
                      {event.cameoDescription}
                    </span>
                  </div>
                  {event.quadClass && (
                    <div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getQuadClassColor(event.quadClass)}`}>
                        {QUAD_CLASS_LABELS[event.quadClass]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-b border-zinc-700" />
            </>
          )}

          {/* Source section */}
          <div className="mb-3 mt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
              Source
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400"
                >
                  <path d="M16.555 5.412a8.028 8.028 0 00-3.503-2.81 14.899 14.899 0 011.663 4.472 8.547 8.547 0 001.84-1.662zM13.326 7.825a13.43 13.43 0 00-2.413-5.773 8.087 8.087 0 00-1.826 0 13.43 13.43 0 00-2.413 5.773A8.473 8.473 0 0010 8.5c1.18 0 2.304-.24 3.326-.675zM6.514 9.376A9.98 9.98 0 0010 10c1.226 0 2.4-.22 3.486-.624a13.54 13.54 0 01.014 3.428 8.576 8.576 0 01-7 0 13.54 13.54 0 01.014-3.428zM4.75 8.837a14.91 14.91 0 011.663-4.472 8.028 8.028 0 00-3.503 2.81c.529.638 1.149 1.199 1.84 1.662zM3.282 13.04a8.031 8.031 0 003.69 3.134 14.88 14.88 0 01-1.862-4.556 8.536 8.536 0 01-1.828 1.422zm6.218 4.91a13.45 13.45 0 002.5-5.592 8.076 8.076 0 01-5 0 13.45 13.45 0 002.5 5.592zm4.218-4.91a14.88 14.88 0 01-1.862 4.556 8.031 8.031 0 003.69-3.134 8.536 8.536 0 01-1.828-1.422z" />
                </svg>
                <span className="text-sm text-zinc-300">{event.domain}</span>
              </div>
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-red-400 transition-colors hover:text-red-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.5-2a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V5.31l-5.22 5.22a.75.75 0 11-1.06-1.06l5.22-5.22H12.5a.75.75 0 01-.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
                View Source Article
              </a>
              {event.sharingImage && (
                <div className="mt-2">
                  <img
                    src={event.sharingImage}
                    alt="Article thumbnail"
                    className="max-h-[120px] w-full rounded object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-zinc-700" />

          {/* Analysis section */}
          <div className="mb-3 mt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
              Analysis
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Tone</span>
                <span className="text-right">
                  <span className={`font-mono text-sm ${getToneColorClass(event.tone)}`}>
                    {event.tone.toFixed(1)}
                  </span>
                  <span className={`ml-1.5 text-xs ${getToneColorClass(event.tone)}`}>
                    {formatTone(event.tone)}
                  </span>
                </span>
              </div>
              {event.goldsteinScale !== null && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Goldstein Scale</span>
                    <span className="text-right">
                      <span
                        className={`font-mono text-sm ${getGoldsteinColorClass(event.goldsteinScale)}`}
                      >
                        {formatGoldstein(event.goldsteinScale)}
                      </span>
                    </span>
                  </div>
                  {event.isEnriched && (
                    <div className="px-1">
                      <div className="relative h-2 w-full rounded-full bg-zinc-700">
                        <div
                          className={`absolute top-0 h-2 rounded-full ${getGoldsteinBarColor(event.goldsteinScale)}`}
                          style={{
                            left: "0%",
                            width: `${((event.goldsteinScale + 10) / 20) * 100}%`,
                          }}
                        />
                        <div className="absolute top-0 left-1/2 h-2 w-px bg-zinc-500" />
                      </div>
                      <div className="mt-0.5 flex justify-between text-[9px] text-zinc-600">
                        <span>-10</span>
                        <span>0</span>
                        <span>+10</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Sources</span>
                <span className="text-sm text-zinc-200">
                  Covered by {event.numArticles} article{event.numArticles === 1 ? "" : "s"}
                </span>
              </div>
              {event.isEnriched && (event.numSources > 0 || event.numMentions > 0) && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Reach</span>
                  <span className="text-sm text-zinc-300">
                    {event.numSources} source{event.numSources === 1 ? "" : "s"}, {event.numMentions} mention{event.numMentions === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-zinc-700" />

          {/* Location section */}
          <div className="mb-3 mt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
              Location
            </div>
            <div className="space-y-3">
              <DetailRow label="Latitude" value={event.lat.toFixed(4)} />
              <DetailRow label="Longitude" value={event.lon.toFixed(4)} />
              {event.isEnriched && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Precision</span>
                  <span className="text-sm text-zinc-200">
                    {getGeoPrecisionLabel(event.geoPrecision)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-zinc-700" />

          {/* Timestamp section */}
          <div className="mt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
              Timestamp
            </div>
            <div className="space-y-3">
              <DetailRow
                label="Captured"
                value={formatRelativeTime(new Date(event.dateAdded))}
              />
              <DetailRow
                label="Date"
                value={formatAbsoluteTime(event.dateAdded)}
              />
              {event.eventDate && event.eventDate !== event.dateAdded && (
                <DetailRow
                  label="Event Date"
                  value={formatAbsoluteTime(event.eventDate)}
                />
              )}
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
    <span className="text-right font-mono text-sm">{value}</span>
  </div>
);
