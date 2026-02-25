"use client";

import {
  ConflictCategory,
  ConflictActorType,
  QuadClass,
  CONFLICT_CATEGORIES,
  CONFLICT_ACTOR_TYPES,
  getConflictCategoryLabel,
  getConflictCategoryColor,
} from "@/lib/conflictTypes";

interface ConflictFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  categories: Set<ConflictCategory>;
  onCategoriesChange: (categories: Set<ConflictCategory>) => void;
  timeframe: "24h" | "6h" | "1h";
  onTimeframeChange: (timeframe: "24h" | "6h" | "1h") => void;
  enrichedOnly: boolean;
  onEnrichedOnlyChange: (value: boolean) => void;
  actorTypes: Set<ConflictActorType>;
  onActorTypesChange: (types: Set<ConflictActorType>) => void;
  quadClass: QuadClass | null;
  onQuadClassChange: (qc: QuadClass | null) => void;
  totalCount: number;
  filteredCount: number;
  enrichedCount: number;
}

const TIMEFRAME_OPTIONS: { value: "24h" | "6h" | "1h"; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "6h", label: "6h" },
  { value: "1h", label: "1h" },
];

const QUAD_CLASS_OPTIONS: { value: QuadClass | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "material-conflict", label: "Material" },
  { value: "verbal-conflict", label: "Verbal" },
];

export const ConflictFilterBar = ({
  search,
  onSearchChange,
  categories,
  onCategoriesChange,
  timeframe,
  onTimeframeChange,
  enrichedOnly,
  onEnrichedOnlyChange,
  actorTypes,
  onActorTypesChange,
  quadClass,
  onQuadClassChange,
  totalCount,
  filteredCount,
  enrichedCount,
}: ConflictFilterBarProps) => {
  const toggleCategory = (cat: ConflictCategory) => {
    const next = new Set(categories);
    if (next.has(cat)) {
      if (next.size > 1) {
        next.delete(cat);
      }
    } else {
      next.add(cat);
    }
    onCategoriesChange(next);
  };

  const toggleActorType = (type: ConflictActorType) => {
    const next = new Set(actorTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onActorTypesChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 bg-zinc-800 px-3 py-2 text-xs text-white border-t border-zinc-700/50 md:gap-3 md:px-4">
      {/* Conflict label */}
      <div className="flex items-center gap-1.5 text-red-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="font-semibold text-[11px] uppercase tracking-wider">
          Conflicts
        </span>
      </div>

      <span className="text-zinc-600">|</span>

      {/* Search input */}
      <div className="relative w-full md:w-auto">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          placeholder="Search events or sources..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 w-full rounded bg-zinc-900 pl-7 pr-7 text-xs text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-colors focus:ring-red-500/50 md:w-48"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            aria-label="Clear search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3 w-3"
            >
              <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
            </svg>
          </button>
        )}
      </div>

      <span className="hidden text-zinc-600 md:inline">|</span>

      {/* Category pills (multi-select) */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {CONFLICT_CATEGORIES.map((cat) => {
          const active = categories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-red-600 text-white"
                  : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-700"
              }`}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: getConflictCategoryColor(cat) }}
              />
              {getConflictCategoryLabel(cat)}
            </button>
          );
        })}
      </div>

      <span className="hidden text-zinc-600 md:inline">|</span>

      {/* Timeframe pills (single-select) */}
      <div className="flex items-center gap-1">
        {TIMEFRAME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onTimeframeChange(opt.value)}
            className={`flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium transition-colors ${
              timeframe === opt.value
                ? "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <span className="hidden text-zinc-600 md:inline">|</span>

      {/* Enriched-only toggle */}
      <button
        onClick={() => onEnrichedOnlyChange(!enrichedOnly)}
        className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors ${
          enrichedOnly
            ? "bg-green-700 text-white"
            : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-700"
        }`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${enrichedOnly ? "bg-green-300" : "bg-zinc-500"}`} />
        Verified
      </button>

      {/* Actor type pills (only when enriched events exist) */}
      {enrichedCount > 0 && (
        <>
          <span className="hidden text-zinc-600 md:inline">|</span>
          <div className="flex items-center gap-1 overflow-x-auto">
            {CONFLICT_ACTOR_TYPES.map((at) => {
              const active = actorTypes.has(at.value);
              return (
                <button
                  key={at.value}
                  onClick={() => toggleActorType(at.value)}
                  className={`flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-red-600 text-white"
                      : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-700"
                  }`}
                >
                  {at.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Quad class pills (only when enriched events exist) */}
      {enrichedCount > 0 && (
        <>
          <span className="hidden text-zinc-600 md:inline">|</span>
          <div className="flex items-center gap-1">
            {QUAD_CLASS_OPTIONS.map((opt) => {
              const active = quadClass === opt.value;
              return (
                <button
                  key={opt.label}
                  onClick={() => onQuadClassChange(opt.value)}
                  className={`flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-red-600 text-white"
                      : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-700"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Event count */}
      <div className="hidden text-zinc-400 md:ml-auto md:block">
        Showing{" "}
        <span className="font-medium text-white">{filteredCount}</span>{" "}
        of{" "}
        <span className="font-medium text-white">{totalCount}</span>{" "}
        events
      </div>
    </div>
  );
};
