"use client";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  altitudeFilter: string;
  onAltitudeFilterChange: (filter: string) => void;
  filteredCount: number;
  totalCount: number;
}

export const FilterBar = ({
  searchQuery,
  onSearchChange,
  altitudeFilter,
  onAltitudeFilterChange,
  filteredCount,
  totalCount,
}: FilterBarProps) => {
  return (
    <div className="flex items-center gap-3 bg-zinc-800 px-4 py-2 text-xs text-white border-t border-zinc-700/50">
      {/* Search box */}
      <div className="relative">
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
          placeholder="Search callsign, reg, hex, type..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 w-64 rounded bg-zinc-900 pl-7 pr-3 text-xs text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-colors focus:ring-amber-500/50"
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

      {/* Altitude filter */}
      <select
        value={altitudeFilter}
        onChange={(e) => onAltitudeFilterChange(e.target.value)}
        className="h-7 rounded bg-zinc-900 px-2 text-xs text-white outline-none ring-1 ring-zinc-700 transition-colors focus:ring-amber-500/50 cursor-pointer"
      >
        <option value="all">All altitudes</option>
        <option value="ground">Ground only</option>
        <option value="below10000">Below 10,000 ft</option>
        <option value="10000-30000">10,000 – 30,000 ft</option>
        <option value="above30000">Above 30,000 ft</option>
      </select>

      {/* Aircraft count */}
      <div className="ml-auto text-zinc-400">
        Showing{" "}
        <span className="font-medium text-white">{filteredCount}</span>{" "}
        of{" "}
        <span className="font-medium text-white">{totalCount}</span>{" "}
        military aircraft
      </div>
    </div>
  );
};
