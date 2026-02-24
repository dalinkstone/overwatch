/**
 * Singleton module that maintains a persistent WebSocket connection to aisstream.io
 * and accumulates vessel data in memory. Runs server-side only (Next.js API routes).
 */

import WebSocket from 'ws';
import { getAisStreamApiKey, isVesselTrackingEnabled } from './env';
import {
  VesselData,
  getMIDFromMMSI,
  getCountryFromMID,
  identifyMilitaryVessel,
} from './vesselTypes';

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

const vessels: Map<string, VesselData> = new Map();
let ws: WebSocket | null = null;
let connectionState: 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
let lastMessageTime = 0;
let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;

// ---------------------------------------------------------------------------
// Message type narrowing helpers
// ---------------------------------------------------------------------------

interface AisMetaData {
  MMSI: number;
  MMSI_String: string;
  ShipName: string;
  latitude: number;
  longitude: number;
  time_utc: string;
}

interface AisPositionReport {
  Cog: number;
  Sog: number;
  TrueHeading: number;
  NavigationalStatus: number;
}

interface AisShipStaticData {
  Type: number;
  Destination: string;
  Name: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isAisMetaData = (v: unknown): v is AisMetaData => {
  if (!isRecord(v)) return false;
  if (typeof v['MMSI'] !== 'number' && typeof v['MMSI_String'] !== 'string') return false;
  if (typeof v['latitude'] !== 'number' || typeof v['longitude'] !== 'number') return false;
  return true;
};

const isAisPositionReport = (v: unknown): v is AisPositionReport => {
  if (!isRecord(v)) return false;
  return typeof v['Cog'] === 'number' && typeof v['Sog'] === 'number';
};

const isAisShipStaticData = (v: unknown): v is AisShipStaticData => {
  if (!isRecord(v)) return false;
  return typeof v['Type'] === 'number';
};

// ---------------------------------------------------------------------------
// Internal: process a single AIS message
// ---------------------------------------------------------------------------

const processAisMessage = (msg: unknown): void => {
  if (!isRecord(msg)) return;

  const messageType = msg['MessageType'];
  if (messageType !== 'PositionReport' && messageType !== 'ShipStaticData') return;

  const metaData = msg['MetaData'];
  if (!isAisMetaData(metaData)) return;

  const messageBody = msg['Message'];
  if (!isRecord(messageBody)) return;

  // Resolve MMSI
  const mmsi =
    typeof metaData.MMSI_String === 'string' && metaData.MMSI_String.length > 0
      ? metaData.MMSI_String
      : String(metaData.MMSI);

  // Get or create vessel entry
  const existing = vessels.get(mmsi);
  const vessel: VesselData = existing ?? {
    mmsi,
    name: '',
    lat: 0,
    lon: 0,
    cog: 0,
    sog: 0,
    heading: 511,
    shipType: 0,
    destination: '',
    flag: '',
    isMilitary: false,
    militaryCategory: '',
    lastUpdate: 0,
  };

  // Handle PositionReport
  if (messageType === 'PositionReport') {
    const report = messageBody['PositionReport'];
    if (isAisPositionReport(report)) {
      vessel.cog = report.Cog;
      vessel.sog = report.Sog;
      vessel.heading = report.TrueHeading;
    }
    // Use MetaData lat/lon (always present for position reports)
    vessel.lat = metaData.latitude;
    vessel.lon = metaData.longitude;
  }

  // Handle ShipStaticData
  if (messageType === 'ShipStaticData') {
    const staticData = messageBody['ShipStaticData'];
    if (isAisShipStaticData(staticData)) {
      vessel.shipType = staticData.Type;
      if (typeof staticData.Destination === 'string') {
        vessel.destination = staticData.Destination;
      }
      if (typeof staticData.Name === 'string' && staticData.Name.trim().length > 0) {
        vessel.name = staticData.Name.trim();
      }
    }
  }

  // Fill name from MetaData if still empty
  if (
    vessel.name === '' &&
    typeof metaData.ShipName === 'string' &&
    metaData.ShipName.trim().length > 0
  ) {
    vessel.name = metaData.ShipName.trim();
  }

  // Update timestamp
  vessel.lastUpdate = Date.now();

  // Compute flag from MID
  const mid = getMIDFromMMSI(mmsi);
  vessel.flag = getCountryFromMID(mid);

  // Compute military status
  const mil = identifyMilitaryVessel(mmsi, vessel.shipType, vessel.name);
  vessel.isMilitary = mil.isMilitary;
  vessel.militaryCategory = mil.category;

  vessels.set(mmsi, vessel);
};

// ---------------------------------------------------------------------------
// Internal: reconnection logic
// ---------------------------------------------------------------------------

const scheduleReconnect = (): void => {
  if (reconnectTimer !== null) return;

  reconnectAttempts += 1;
  const delay = reconnectAttempts > 10 ? 60_000 : 5_000;

  if (reconnectAttempts > 10) {
    reconnectAttempts = 0;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initAisStream();
  }, delay);
};

// ---------------------------------------------------------------------------
// Internal: staleness cleanup
// ---------------------------------------------------------------------------

const cleanupStaleVessels = (): void => {
  const cutoff = Date.now() - 600_000; // 10 minutes
  for (const [mmsi, vessel] of vessels) {
    if (vessel.lastUpdate < cutoff) {
      vessels.delete(mmsi);
    }
  }
};

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export const initAisStream = (): void => {
  if (!isVesselTrackingEnabled()) {
    connectionState = 'disabled';
    return;
  }

  if (ws !== null && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  connectionState = 'connecting';
  ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  ws.on('open', () => {
    const subscription = {
      APIKey: getAisStreamApiKey(),
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    };
    ws?.send(JSON.stringify(subscription));

    connectionState = 'connected';
    reconnectAttempts = 0;
    console.log('AIS Stream connected');

    if (cleanupTimer === null) {
      cleanupTimer = setInterval(cleanupStaleVessels, 60_000);
    }
  });

  ws.on('message', (data: WebSocket.Data) => {
    lastMessageTime = Date.now();
    try {
      const parsed: unknown = JSON.parse(data.toString());
      processAisMessage(parsed);
    } catch {
      // Ignore malformed JSON
    }
  });

  ws.on('close', () => {
    connectionState = 'disconnected';
    ws = null;
    console.log('AIS Stream disconnected');
    scheduleReconnect();
  });

  ws.on('error', (err: Error) => {
    connectionState = 'error';
    console.error('AIS Stream error:', err.message);
    // close event fires after error, which triggers reconnect
  });
};

export const getVessels = (): VesselData[] => {
  return Array.from(vessels.values());
};

export const getConnectionStatus = (): {
  state: string;
  vesselCount: number;
  lastMessage: number;
} => {
  return {
    state: connectionState,
    vesselCount: vessels.size,
    lastMessage: lastMessageTime,
  };
};
