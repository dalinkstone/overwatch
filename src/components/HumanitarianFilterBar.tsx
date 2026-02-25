"use client";

import {
  HumanitarianCrisis,
  HumanitarianCrisisType,
  getSeverityColor,
} from "@/lib/humanitarianTypes";

interface HumanitarianFilterBarProps {
  crises: HumanitarianCrisis[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  severityFilter: HumanitarianCrisis["severity"] | "all";
  onSeverityChange: (severity: HumanitarianCrisis["severity"] | "all") => void;
  typeFilter: HumanitarianCrisisType | "all";
  onTypeChange: (type: HumanitarianCrisisType | "all") => void;
}

const SEVERITY_OPTIONS: {
  value: HumanitarianCrisis["severity"] | "all";
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "major", label: "Major" },
  { value: "moderate", label: "Moderate" },
  { value: "minor", label: "Minor" },
];

const CRISIS_TYPES: { value: HumanitarianCrisisType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "complex-emergency", label: "Complex Emergency" },
  { value: "conflict", label: "Conflict" },
  { value: "drought", label: "Drought" },
  { value: "earthquake", label: "Earthquake" },
  { value: "epidemic", label: "Epidemic" },
  { value: "flood", label: "Flood" },
  { value: "food-insecurity", label: "Food Insecurity" },
  { value: "cyclone", label: "Cyclone" },
  { value: "volcano", label: "Volcano" },
  { value: "wildfire", label: "Wildfire" },
  { value: "displacement", label: "Displacement" },
  { value: "other", label: "Other" },
];

export const HumanitarianFilterBar = ({
  crises,
  searchQuery,
  onSearchChange,
  severityFilter,
  onSeverityChange,
  typeFilter,
  onTypeChange,
}: HumanitarianFilterBarProps) => {
  const filteredCount = crises.length;

  return (
    <div className="flex flex-wrap items-center gap-2 bg-zinc-800 px-3 py-2 text-xs text-white border-t border-zinc-700/50 md:gap-3 md:px-4">
      {/* Humanitarian label */}
      <div className="flex items-center gap-1.5 text-teal-500">
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
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
        <span className="font-semibold text-[11px] uppercase tracking-wider">
          Humanitarian
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
          placeholder="Search countries or disasters..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 w-full rounded bg-zinc-900 pl-7 pr-7 text-xs text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-colors focus:ring-teal-500/50 md:w-48"
        />
        {searchQuery && (
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

      {/* Severity pills (single-select) */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {SEVERITY_OPTIONS.map((opt) => {
          const active = severityFilter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSeverityChange(opt.value)}
              className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-teal-600 text-white"
                  : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-700"
              }`}
            >
              {opt.value !== "all" && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getSeverityColor(opt.value) }}
                />
              )}
              {opt.label}
            </button>
          );
        })}
      </div>

      <span className="hidden text-zinc-600 md:inline">|</span>

      {/* Crisis type dropdown */}
      <select
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value as HumanitarianCrisisType | "all")}
        className="h-7 rounded bg-zinc-900 px-2 text-xs text-white outline-none ring-1 ring-zinc-700 transition-colors focus:ring-teal-500/50"
      >
        {CRISIS_TYPES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Crisis count */}
      <div className="hidden text-zinc-400 md:ml-auto md:block">
        <span className="font-medium text-white">{filteredCount}</span>{" "}
        {filteredCount === 1 ? "country" : "countries"}
      </div>
    </div>
  );
};
