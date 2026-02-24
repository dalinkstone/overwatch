"use client";

import { SatelliteCategory, SATELLITE_CATEGORY_LABELS } from "@/lib/satelliteTypes";

interface SatelliteFilterBarProps {
  categoryFilter: SatelliteCategory | "all";
  onCategoryFilterChange: (value: SatelliteCategory | "all") => void;
  orbitFilter: "all" | "leo" | "meo" | "geo";
  onOrbitFilterChange: (value: "all" | "leo" | "meo" | "geo") => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
}

const CATEGORY_OPTIONS: { value: SatelliteCategory | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  ...Object.entries(SATELLITE_CATEGORY_LABELS).map(([value, label]) => ({
    value: value as SatelliteCategory,
    label,
  })),
];

const ORBIT_OPTIONS: { value: "all" | "leo" | "meo" | "geo"; label: string }[] = [
  { value: "all", label: "All orbits" },
  { value: "leo", label: "LEO (< 2h period)" },
  { value: "meo", label: "MEO (2–12h)" },
  { value: "geo", label: "GEO (> 12h)" },
];

export const SatelliteFilterBar = ({
  categoryFilter,
  onCategoryFilterChange,
  orbitFilter,
  onOrbitFilterChange,
  searchQuery,
  onSearchQueryChange,
  filteredCount,
  totalCount,
}: SatelliteFilterBarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 bg-zinc-800 px-3 py-2 text-xs text-white border-t border-zinc-700/50 md:gap-3 md:px-4">
      {/* Satellite label */}
      <div className="flex items-center gap-1.5" style={{ color: "#a855f7" }}>
        <span className="text-sm shrink-0">◆</span>
        <span className="font-semibold text-[11px] uppercase tracking-wider">Satellites</span>
      </div>

      <span className="text-zinc-600">|</span>

      {/* Search */}
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
          placeholder="Search name or NORAD ID..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="h-7 w-full rounded bg-zinc-900 pl-7 pr-7 text-xs text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-colors md:w-48"
          style={{ boxShadow: "none" }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = "0 0 0 1px rgba(168, 85, 247, 0.5)";
            e.currentTarget.style.borderColor = "transparent";
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchQueryChange("")}
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

      {/* Category filter */}
      <select
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value as SatelliteCategory | "all")}
        className="h-7 flex-1 rounded bg-zinc-900 px-2 text-xs text-white outline-none ring-1 ring-zinc-700 transition-colors cursor-pointer md:flex-none"
        style={{ boxShadow: "none" }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = "0 0 0 1px rgba(168, 85, 247, 0.5)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {CATEGORY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Orbit filter */}
      <select
        value={orbitFilter}
        onChange={(e) => onOrbitFilterChange(e.target.value as "all" | "leo" | "meo" | "geo")}
        className="h-7 flex-1 rounded bg-zinc-900 px-2 text-xs text-white outline-none ring-1 ring-zinc-700 transition-colors cursor-pointer md:flex-none"
        style={{ boxShadow: "none" }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = "0 0 0 1px rgba(168, 85, 247, 0.5)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {ORBIT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Satellite count */}
      <div className="hidden text-zinc-400 md:ml-auto md:block">
        Showing{" "}
        <span className="font-medium text-white">{filteredCount}</span>{" "}
        of{" "}
        <span className="font-medium text-white">{totalCount}</span>{" "}
        satellites
      </div>
    </div>
  );
};
