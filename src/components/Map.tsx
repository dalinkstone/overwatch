"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { AircraftState, hasPosition } from "@/lib/types";
import { VesselData } from "@/lib/vesselTypes";
import { SatellitePosition } from "@/lib/satelliteTypes";
import { AirspaceZone } from "@/lib/airspaceTypes";
import { AircraftMarker } from "./AircraftMarker";
import { VesselMarker } from "./VesselMarker";
import { SatelliteMarker } from "./SatelliteMarker";
import { AirspaceOverlay, getZoneBounds } from "./AirspaceOverlay";

interface MapProps {
  aircraft: AircraftState[];
  onAircraftClick: (aircraft: AircraftState) => void;
  vessels?: VesselData[];
  onVesselClick?: (vessel: VesselData) => void;
  satellites?: SatellitePosition[];
  onSatelliteClick?: (satellite: SatellitePosition) => void;
  satelliteLayerEnabled?: boolean;
  airspaceZones?: AirspaceZone[];
  selectedAirspaceZoneId?: string | null;
  onAirspaceZoneClick?: (zone: AirspaceZone) => void;
  airspaceLayerEnabled?: boolean;
}

const DEFAULT_CENTER: [number, number] = [
  parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? "38.9"),
  parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? "-77.0"),
];
const DEFAULT_ZOOM = parseInt(
  process.env.NEXT_PUBLIC_DEFAULT_ZOOM ?? "5",
  10
);

const AIRSPACE_PANE = "airspace";
const VESSEL_PANE = "vessels";
const SATELLITE_PANE = "satellites";
const AIRSPACE_MIN_ZOOM = 4;
const VESSEL_MIN_ZOOM = 4;
const SATELLITE_MIN_ZOOM = 3;

const Map = ({ aircraft, onAircraftClick, vessels, onVesselClick, satellites, onSatelliteClick, satelliteLayerEnabled, airspaceZones, selectedAirspaceZoneId, onAirspaceZoneClick, airspaceLayerEnabled }: MapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const updateViewState = useCallback((map: L.Map) => {
    setBounds(map.getBounds());
    setZoom(map.getZoom());
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: <a href="https://www.adsb.lol/">ADSB.lol</a> (ODbL) | Icons: <a href="https://adsb-radar.com">ADS-B Radar</a> | Vessel data: <a href="https://aisstream.io">aisstream.io</a> | Satellite data: <a href="https://celestrak.org">CelesTrak</a>',
    }).addTo(map);

    map.createPane(AIRSPACE_PANE).style.zIndex = "420";
    map.createPane(SATELLITE_PANE).style.zIndex = "440";
    map.createPane(VESSEL_PANE).style.zIndex = "450";

    map.on("moveend", () => updateViewState(map));
    map.on("zoomend", () => updateViewState(map));

    mapRef.current = map;
    setBounds(map.getBounds());
    setZoom(map.getZoom());
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [updateViewState]);

  const handleVesselClick = onVesselClick ?? (() => {});
  const handleSatelliteClick = onSatelliteClick ?? (() => {});
  const handleAirspaceClick = onAirspaceZoneClick ?? (() => {});

  const showAirspace = airspaceLayerEnabled && zoom >= AIRSPACE_MIN_ZOOM;
  const showVessels = zoom >= VESSEL_MIN_ZOOM;
  const showSatellites = satelliteLayerEnabled && zoom >= SATELLITE_MIN_ZOOM;

  // Cache zone bounding boxes — recomputed only when zones array changes
  const zoneBoundsMap = useMemo(() => {
    const boundsMap: Record<string, L.LatLngBounds> = {};
    for (const zone of airspaceZones ?? []) {
      const b = getZoneBounds(zone);
      if (b) boundsMap[zone.id] = b;
    }
    return boundsMap;
  }, [airspaceZones]);

  const visibleZones = useMemo(() => {
    if (!showAirspace || !bounds || !airspaceZones?.length) return [];
    return airspaceZones.filter((zone) => {
      const zb = zoneBoundsMap[zone.id];
      return zb ? bounds.intersects(zb) : false;
    });
  }, [airspaceZones, bounds, showAirspace, zoneBoundsMap]);

  const visibleVessels = useMemo(() => {
    if (!showVessels || !bounds || !vessels?.length) return [];
    return vessels.filter((v) => bounds.contains([v.lat, v.lon]));
  }, [vessels, bounds, showVessels]);

  const visibleSatellites = useMemo(() => {
    if (!showSatellites || !bounds || !satellites?.length) return [];
    return satellites.filter((s) => bounds.contains([s.lat, s.lon]));
  }, [satellites, bounds, showSatellites]);

  return (
    <div ref={containerRef} style={{ height: "100%", width: "100%" }}>
      {mapReady && mapRef.current && showAirspace && (
        <AirspaceOverlay
          zones={visibleZones}
          selectedZoneId={selectedAirspaceZoneId ?? null}
          onZoneClick={handleAirspaceClick}
          map={mapRef.current}
          pane={AIRSPACE_PANE}
        />
      )}
      {mapReady &&
        mapRef.current &&
        aircraft.filter(hasPosition).map((ac) => (
          <AircraftMarker
            key={ac.hex}
            aircraft={ac}
            onClick={onAircraftClick}
            map={mapRef.current!}
          />
        ))}
      {mapReady &&
        mapRef.current &&
        visibleVessels.map((v) => (
          <VesselMarker
            key={v.mmsi}
            vessel={v}
            onClick={handleVesselClick}
            map={mapRef.current!}
            pane={VESSEL_PANE}
          />
        ))}
      {mapReady &&
        mapRef.current &&
        visibleSatellites.map((s) => (
          <SatelliteMarker
            key={s.noradId}
            satellite={s}
            onClick={handleSatelliteClick}
            map={mapRef.current!}
            pane={SATELLITE_PANE}
          />
        ))}
      {mapReady && airspaceLayerEnabled && airspaceZones && airspaceZones.length > 0 && !showAirspace && (
        <div className="absolute bottom-8 left-1/2 z-[600] -translate-x-1/2 rounded bg-zinc-800/90 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur-sm">
          Zoom in to see airspace (zoom {AIRSPACE_MIN_ZOOM}+)
        </div>
      )}
      {mapReady && vessels && vessels.length > 0 && !showVessels && (
        <div className="absolute bottom-16 left-1/2 z-[600] -translate-x-1/2 rounded bg-zinc-800/90 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur-sm">
          Zoom in to see vessels (zoom {VESSEL_MIN_ZOOM}+)
        </div>
      )}
      {mapReady && satelliteLayerEnabled && satellites && satellites.length > 0 && !showSatellites && (
        <div className="absolute bottom-24 left-1/2 z-[600] -translate-x-1/2 rounded bg-zinc-800/90 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur-sm">
          Zoom in to see satellites (zoom {SATELLITE_MIN_ZOOM}+)
        </div>
      )}
    </div>
  );
};

export default Map;
