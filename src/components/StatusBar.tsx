"use client";

interface StatusBarProps {
  totalCount: number;
  positionCount: number;
  lastUpdated: Date | null;
  error: string | null;
  vesselEnabled?: boolean;
  vesselCount?: number;
  satelliteEnabled?: boolean;
  satelliteCount?: number;
  satelliteError?: string | null;
}

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const StatusBar = ({
  totalCount,
  positionCount,
  lastUpdated,
  error,
  vesselEnabled,
  vesselCount,
  satelliteEnabled,
  satelliteCount,
  satelliteError,
}: StatusBarProps) => {
  return (
    <div className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 text-xs text-white">
      {/* Left: Brand + counts */}
      <div className="flex items-center gap-4">
        <span className="mr-1 flex items-center gap-2 text-sm font-bold tracking-widest text-amber-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
          OVERWATCH
        </span>
        <span className="text-zinc-600">|</span>
        <span>
          <span className="text-zinc-500">Total:</span>{" "}
          <span className="font-mono">{totalCount}</span>
        </span>
        <span>
          <span className="text-zinc-500">Tracked:</span>{" "}
          <span className="font-mono">{positionCount}</span>
        </span>
        {vesselEnabled && vesselCount !== undefined && (
          <>
            <span className="text-zinc-600">|</span>
            <span>
              <span className="text-zinc-500">Vessels:</span>{" "}
              <span className="font-mono">{vesselCount.toLocaleString()}</span>
            </span>
          </>
        )}
        {satelliteEnabled && satelliteCount !== undefined && (
          <>
            <span className="text-zinc-600">|</span>
            <span>
              <span className="text-zinc-500">Satellites:</span>{" "}
              <span className="font-mono">{satelliteCount.toLocaleString()}</span>
            </span>
          </>
        )}
        {satelliteEnabled && satelliteError && (
          <>
            <span className="text-zinc-600">|</span>
            <span className="text-amber-400">Satellite data unavailable</span>
          </>
        )}
      </div>

      {/* Right: Update time + connection status */}
      <div className="flex items-center gap-4">
        <span className="text-zinc-500">
          {lastUpdated
            ? `Updated ${formatTime(lastUpdated)}`
            : "Connecting..."}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              error ? "bg-red-500" : "bg-emerald-500"
            }`}
          />
          <span className={error ? "text-red-400" : "text-zinc-400"}>
            {error ? error : "Connected"}
          </span>
        </span>
      </div>
    </div>
  );
};
