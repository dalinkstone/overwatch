"use client";

import { VesselCategory } from "@/lib/vesselTypes";

interface VesselFilterBarProps {
  countryFilter: string;
  onCountryFilterChange: (filter: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (filter: string) => void;
  speedFilter: string;
  onSpeedFilterChange: (filter: string) => void;
  destSearch: string;
  onDestSearchChange: (query: string) => void;
  filteredCount: number;
  totalCount: number;
  countries: string[];
}

const VESSEL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "military", label: "Military" },
  { value: "cargo", label: "Cargo" },
  { value: "tanker", label: "Tanker" },
  { value: "passenger", label: "Passenger" },
  { value: "fishing", label: "Fishing" },
  { value: "tug", label: "Tug/Pilot" },
  { value: "highspeed", label: "High-Speed Craft" },
  { value: "pleasure", label: "Pleasure Craft" },
  { value: "other", label: "Other" },
];

export const VesselFilterBar = ({
  countryFilter,
  onCountryFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  speedFilter,
  onSpeedFilterChange,
  destSearch,
  onDestSearchChange,
  filteredCount,
  totalCount,
  countries,
}: VesselFilterBarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 bg-zinc-800 px-3 py-2 text-xs text-white border-t border-zinc-700/50 md:gap-3 md:px-4">
      {/* Vessel label */}
      <div className="flex items-center gap-1.5 text-blue-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 32" className="shrink-0">
          <path d="M12 1 L4 20 L4 28 L12 25 L20 28 L20 20 Z" fill="currentColor" />
        </svg>
        <span className="font-semibold text-[11px] uppercase tracking-wider">Vessels</span>
      </div>

      <span className="text-zinc-600">|</span>

      {/* Country filter */}
      <select
        value={countryFilter}
        onChange={(e) => onCountryFilterChange(e.target.value)}
        className="h-7 flex-1 rounded bg-zinc-900 px-2 text-xs text-white outline-none ring-1 ring-zinc-700 transition-colors focus:ring-blue-500/50 cursor-pointer md:flex-none"
      >
        <option value="all">All countries</option>
        {countries.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Category filter */}
      <select
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value as VesselCategory | "all")}
        className="h-7 flex-1 rounded bg-zinc-900 px-2 text-xs text-white outline-none ring-1 ring-zinc-700 transition-colors focus:ring-blue-500/50 cursor-pointer md:flex-none"
      >
        {VESSEL_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Speed filter */}
      <select
        value={speedFilter}
        onChange={(e) => onSpeedFilterChange(e.target.value)}
        className="h-7 flex-1 rounded bg-zinc-900 px-2 text-xs text-white outline-none ring-1 ring-zinc-700 transition-colors focus:ring-blue-500/50 cursor-pointer md:flex-none"
      >
        <option value="all">All speeds</option>
        <option value="anchored">Anchored (&lt; 1 kt)</option>
        <option value="slow">Slow (1–10 kts)</option>
        <option value="cruising">Cruising (10–20 kts)</option>
        <option value="fast">Fast (&gt; 20 kts)</option>
      </select>

      {/* Destination search */}
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
          placeholder="Search destination..."
          value={destSearch}
          onChange={(e) => onDestSearchChange(e.target.value)}
          className="h-7 w-full rounded bg-zinc-900 pl-7 pr-7 text-xs text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-colors focus:ring-blue-500/50 md:w-48"
        />
        {destSearch && (
          <button
            onClick={() => onDestSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            aria-label="Clear destination search"
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

      {/* Vessel count */}
      <div className="hidden text-zinc-400 md:ml-auto md:block">
        Showing{" "}
        <span className="font-medium text-white">{filteredCount}</span>{" "}
        of{" "}
        <span className="font-medium text-white">{totalCount}</span>{" "}
        vessels
      </div>
    </div>
  );
};
