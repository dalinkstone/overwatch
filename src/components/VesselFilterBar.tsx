"use client";

import { VesselCategory } from "@/lib/vesselTypes";

interface VesselFilterBarProps {
  countryFilter: string;
  onCountryFilterChange: (filter: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (filter: string) => void;
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
