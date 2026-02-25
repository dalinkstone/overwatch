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
  vesselTotalCount?: number;
  vesselStatus: VesselStatus;
  satelliteEnabled: boolean;
  onSatelliteToggle: () => void;
  satelliteCount: number;
  satelliteTotalCount?: number;
  airspaceEnabled: boolean;
  onAirspaceToggle: (enabled: boolean) => void;
  airspaceCount: number;
  airspaceTotalCount?: number;
  conflictsEnabled: boolean;
  onConflictToggle: (enabled: boolean) => void;
  conflictCount: number;
  conflictTotalCount?: number;
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
  vesselTotalCount,
  vesselStatus,
  satelliteEnabled,
  onSatelliteToggle,
  satelliteCount,
  satelliteTotalCount,
  airspaceEnabled,
  onAirspaceToggle,
  airspaceCount,
  airspaceTotalCount,
  conflictsEnabled,
  onConflictToggle,
  conflictCount,
  conflictTotalCount,
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
            ? vesselTotalCount !== undefined && vesselCount !== vesselTotalCount
              ? `Vessels (${vesselCount.toLocaleString()} of ${vesselTotalCount.toLocaleString()})`
              : `Vessels (${vesselCount.toLocaleString()})`
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

      {/* Satellite row — toggleable */}
      <div
        className="flex items-center gap-2 py-1 cursor-pointer"
        onClick={onSatelliteToggle}
        title={satelliteEnabled ? `Satellites: ${satelliteCount} tracked` : "Satellites: Off"}
      >
        <span
          className="text-sm shrink-0 leading-none"
          style={{ color: satelliteEnabled ? "#a855f7" : "#6b7280", width: 14, textAlign: "center" }}
        >
          ◆
        </span>
        <span className="text-xs text-zinc-200">
          {satelliteEnabled
            ? satelliteTotalCount !== undefined && satelliteCount !== satelliteTotalCount
              ? `Satellites (${satelliteCount.toLocaleString()} of ${satelliteTotalCount.toLocaleString()})`
              : `Satellites (${satelliteCount.toLocaleString()})`
            : "Satellites"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={satelliteEnabled}
          onClick={(e) => {
            e.stopPropagation();
            onSatelliteToggle();
          }}
          className={`ml-auto relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors cursor-pointer ${
            satelliteEnabled ? "bg-purple-500" : "bg-zinc-600"
          }`}
        >
          <span
            className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              satelliteEnabled ? "translate-x-3.5 ml-0" : "translate-x-0.5"
            }`}
          />
        </button>
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{
            backgroundColor: satelliteEnabled
              ? (satelliteTotalCount ?? satelliteCount) > 0
                ? "#22c55e"
                : "#eab308"
              : "#6b7280",
          }}
          title={
            satelliteEnabled
              ? (satelliteTotalCount ?? satelliteCount) > 0
                ? "Data loaded"
                : "Loading..."
              : "Off"
          }
        />
      </div>

      {/* Airspace row — toggleable */}
      <div
        className="flex items-center gap-2 py-1 cursor-pointer"
        onClick={() => onAirspaceToggle(!airspaceEnabled)}
        title={airspaceEnabled ? `Airspace: ${airspaceCount} zones` : "Airspace: Off"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={airspaceEnabled ? "#f97316" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M12 9v4" />
          <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 001.636 2.871h16.214a1.914 1.914 0 001.636-2.87L13.637 3.59a1.914 1.914 0 00-3.274 0z" />
          <path d="M12 17h.01" />
        </svg>
        <span className="text-xs text-zinc-200">
          {airspaceEnabled
            ? airspaceTotalCount !== undefined && airspaceCount !== airspaceTotalCount
              ? `Airspace (${airspaceCount.toLocaleString()} of ${airspaceTotalCount.toLocaleString()})`
              : `Airspace (${airspaceCount.toLocaleString()})`
            : "Airspace"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={airspaceEnabled}
          onClick={(e) => {
            e.stopPropagation();
            onAirspaceToggle(!airspaceEnabled);
          }}
          className={`ml-auto relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors cursor-pointer ${
            airspaceEnabled ? "bg-orange-500" : "bg-zinc-600"
          }`}
        >
          <span
            className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              airspaceEnabled ? "translate-x-3.5 ml-0" : "translate-x-0.5"
            }`}
          />
        </button>
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{
            backgroundColor: airspaceEnabled
              ? (airspaceTotalCount ?? airspaceCount) > 0
                ? "#22c55e"
                : "#eab308"
              : "#6b7280",
          }}
          title={
            airspaceEnabled
              ? (airspaceTotalCount ?? airspaceCount) > 0
                ? "Data loaded"
                : "Loading..."
              : "Off"
          }
        />
      </div>

      {/* Conflict row — toggleable */}
      <div
        className="flex items-center gap-2 py-1 cursor-pointer"
        onClick={() => onConflictToggle(!conflictsEnabled)}
        title={conflictsEnabled ? `Conflicts: ${conflictCount} events` : "Conflicts: Off"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={conflictsEnabled ? "#ef4444" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-xs text-zinc-200">
          {conflictsEnabled
            ? conflictTotalCount !== undefined && conflictCount !== conflictTotalCount
              ? `Conflicts (${conflictCount.toLocaleString()} of ${conflictTotalCount.toLocaleString()})`
              : `Conflicts (${conflictCount.toLocaleString()})`
            : "Conflicts"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={conflictsEnabled}
          onClick={(e) => {
            e.stopPropagation();
            onConflictToggle(!conflictsEnabled);
          }}
          className={`ml-auto relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors cursor-pointer ${
            conflictsEnabled ? "bg-red-500" : "bg-zinc-600"
          }`}
        >
          <span
            className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              conflictsEnabled ? "translate-x-3.5 ml-0" : "translate-x-0.5"
            }`}
          />
        </button>
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{
            backgroundColor: conflictsEnabled
              ? (conflictTotalCount ?? conflictCount) > 0
                ? "#22c55e"
                : "#eab308"
              : "#6b7280",
          }}
          title={
            conflictsEnabled
              ? (conflictTotalCount ?? conflictCount) > 0
                ? "Data loaded"
                : "Loading..."
              : "Off"
          }
        />
      </div>
    </div>
  );
};
