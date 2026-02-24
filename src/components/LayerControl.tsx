"use client";

import { useCallback } from "react";

interface VesselStatus {
  state: string;
  vesselCount: number;
  lastMessage: number;
}

interface LayerControlProps {
  aircraftCount: number;
  vesselEnabled: boolean;
  onVesselToggle: (enabled: boolean) => void;
  vesselCount: number;
  vesselStatus: VesselStatus;
}

const getVesselStatusDot = (
  enabled: boolean,
  state: string,
): { color: string; label: string } => {
  if (!enabled) return { color: "#6b7280", label: "Off" };
  switch (state) {
    case "connected":
      return { color: "#22c55e", label: "Connected" };
    case "connecting":
      return { color: "#eab308", label: "Connecting..." };
    case "error":
      return { color: "#ef4444", label: "Error" };
    case "disabled":
      return { color: "#6b7280", label: "API key required" };
    case "disconnected":
      return { color: "#eab308", label: "Connecting..." };
    default:
      return { color: "#6b7280", label: state };
  }
};

export const LayerControl = ({
  aircraftCount,
  vesselEnabled,
  onVesselToggle,
  vesselCount,
  vesselStatus,
}: LayerControlProps) => {
  const isDisabled = vesselStatus.state === "disabled";
  const statusDot = getVesselStatusDot(vesselEnabled, vesselStatus.state);

  const handleToggle = useCallback(() => {
    if (isDisabled) return;
    onVesselToggle(!vesselEnabled);
  }, [isDisabled, vesselEnabled, onVesselToggle]);

  return (
    <div className="absolute bottom-8 left-3 z-[800] rounded-lg bg-zinc-800/90 px-3 py-2 shadow-lg backdrop-blur-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
        Layers
      </div>

      {/* Aircraft row — always on */}
      <div className="flex items-center gap-2 py-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" className="shrink-0">
          <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
        <span className="text-xs text-zinc-200">
          Aircraft ({aircraftCount.toLocaleString()})
        </span>
        <span
          className="ml-auto h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: "#22c55e" }}
        />
      </div>

      {/* Vessel row — toggleable */}
      <div
        className={`flex items-center gap-2 py-1 ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        onClick={handleToggle}
        title={isDisabled ? "API key required — set AISSTREAM_API_KEY in .env.local" : `Vessels: ${statusDot.label}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 32" className="shrink-0">
          <path
            d="M12 1 L4 20 L4 28 L12 25 L20 28 L20 20 Z"
            fill={vesselEnabled && !isDisabled ? "#4a9eff" : "#6b7280"}
          />
        </svg>
        <span className="text-xs text-zinc-200">
          {vesselEnabled && !isDisabled
            ? `Vessels (${vesselCount.toLocaleString()})`
            : "Vessels"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={vesselEnabled && !isDisabled}
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className={`ml-auto relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
            vesselEnabled && !isDisabled ? "bg-blue-500" : "bg-zinc-600"
          } ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              vesselEnabled && !isDisabled ? "translate-x-3.5 ml-0" : "translate-x-0.5"
            }`}
          />
        </button>
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: statusDot.color }}
          title={statusDot.label}
        />
      </div>

      {isDisabled && (
        <div className="text-[9px] text-zinc-500 mt-0.5 pl-5">
          API key required
        </div>
      )}
    </div>
  );
};
