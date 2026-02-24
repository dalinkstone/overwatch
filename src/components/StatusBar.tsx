"use client";

interface StatusBarProps {
  totalCount: number;
  positionCount: number;
  lastUpdated: Date | null;
  error: string | null;
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
}: StatusBarProps) => {
  return (
    <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 text-xs text-white">
      <div className="flex items-center gap-4">
        <span>
          <span className="text-zinc-400">Total:</span> {totalCount}
        </span>
        <span>
          <span className="text-zinc-400">Tracked:</span> {positionCount}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-zinc-400">
          {lastUpdated ? `Updated ${formatTime(lastUpdated)}` : "Connecting..."}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              error ? "bg-red-500" : "bg-green-500"
            }`}
          />
          {error ? error : "Connected"}
        </span>
      </div>
    </div>
  );
};
