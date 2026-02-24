"use client";

import { AirspaceType, TfrType, AIRSPACE_TYPE_LABELS, TFR_TYPE_LABELS } from "@/lib/airspaceTypes";

interface AirspaceFilterBarProps {
  typeFilter: AirspaceType | "all";
  onTypeFilterChange: (filter: AirspaceType | "all") => void;
  tfrTypeFilter: TfrType | "all";
  onTfrTypeFilterChange: (filter: TfrType | "all") => void;
  activeOnly: boolean;
  onActiveOnlyChange: (active: boolean) => void;
  filteredCount: number;
  totalCount: number;
}

const TYPE_OPTIONS: { value: AirspaceType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "restricted", label: AIRSPACE_TYPE_LABELS.restricted },
  { value: "prohibited", label: AIRSPACE_TYPE_LABELS.prohibited },
  { value: "moa", label: AIRSPACE_TYPE_LABELS.moa },
  { value: "warning", label: AIRSPACE_TYPE_LABELS.warning },
  { value: "alert", label: AIRSPACE_TYPE_LABELS.alert },
  { value: "tfr", label: AIRSPACE_TYPE_LABELS.tfr },
];

const TFR_TYPE_OPTIONS: { value: TfrType | "all"; label: string }[] = [
  { value: "all", label: "All TFR types" },
  { value: "vip", label: TFR_TYPE_LABELS.vip },
  { value: "security", label: TFR_TYPE_LABELS.security },
  { value: "hazard", label: TFR_TYPE_LABELS.hazard },
  { value: "space", label: TFR_TYPE_LABELS.space },
  { value: "event", label: TFR_TYPE_LABELS.event },
  { value: "national-defense", label: TFR_TYPE_LABELS["national-defense"] },
];

export const AirspaceFilterBar = ({
  typeFilter,
  onTypeFilterChange,
  tfrTypeFilter,
  onTfrTypeFilterChange,
  activeOnly,
  onActiveOnlyChange,
  filteredCount,
  totalCount,
}: AirspaceFilterBarProps) => {
  const showTfrFilter = typeFilter === "all" || typeFilter === "tfr";

  return (
    <div className="flex flex-wrap items-center gap-2 bg-zinc-800 px-3 py-2 text-xs text-white border-t border-zinc-700/50 md:gap-3 md:px-4">
      {/* Airspace label */}
      <div className="flex items-center gap-1.5" style={{ color: "#f97316" }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M12 9v4" />
          <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 001.636 2.871h16.214a1.914 1.914 0 001.636-2.87L13.637 3.59a1.914 1.914 0 00-3.274 0z" />
          <path d="M12 17h.01" />
        </svg>
        <span className="font-semibold text-[11px] uppercase tracking-wider">Airspace</span>
      </div>

      <span className="text-zinc-600">|</span>

      {/* Type filter */}
      <select
        value={typeFilter}
        onChange={(e) => onTypeFilterChange(e.target.value as AirspaceType | "all")}
        className="h-7 flex-1 rounded bg-zinc-900 px-2 text-xs text-white outline-none ring-1 ring-zinc-700 transition-colors cursor-pointer md:flex-none"
        style={{ outlineColor: "transparent" }}
        onFocus={(e) => e.currentTarget.style.boxShadow = "0 0 0 1px rgba(249, 115, 22, 0.5)"}
        onBlur={(e) => e.currentTarget.style.boxShadow = ""}
      >
        {TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* TFR sub-type filter — only when relevant */}
      {showTfrFilter && (
        <select
          value={tfrTypeFilter}
          onChange={(e) => onTfrTypeFilterChange(e.target.value as TfrType | "all")}
          className="h-7 flex-1 rounded bg-zinc-900 px-2 text-xs text-white outline-none ring-1 ring-zinc-700 transition-colors cursor-pointer md:flex-none"
          style={{ outlineColor: "transparent" }}
          onFocus={(e) => e.currentTarget.style.boxShadow = "0 0 0 1px rgba(249, 115, 22, 0.5)"}
          onBlur={(e) => e.currentTarget.style.boxShadow = ""}
        >
          {TFR_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {/* Active only toggle */}
      <button
        onClick={() => onActiveOnlyChange(!activeOnly)}
        className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-xs transition-colors ${
          activeOnly
            ? "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40"
            : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:text-zinc-300"
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            activeOnly ? "bg-orange-400 shadow-[0_0_4px_rgba(249,115,22,0.6)]" : "bg-zinc-600"
          }`}
        />
        Active only
      </button>

      {/* Zone count */}
      <div className="hidden text-zinc-400 md:ml-auto md:block">
        Showing{" "}
        <span className="font-medium text-white">{filteredCount}</span>{" "}
        of{" "}
        <span className="font-medium text-white">{totalCount}</span>{" "}
        zones
      </div>
    </div>
  );
};
