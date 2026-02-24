import { NextResponse } from "next/server";

/**
 * Upstream Digitraffic API response types.
 * Source: https://meri.digitraffic.fi/api/ais/v1/locations
 */
interface DigitrafficLocationFeature {
  mmsi: number;
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude] per GeoJSON spec
  };
  properties: {
    mmsi: number;
    sog: number;
    cog: number;
    navStat: number;
    rot: number;
    posAcc: boolean;
    raim: boolean;
    heading: number;
    timestamp: number;
    timestampExternal: number;
  };
}

interface DigitrafficLocationsResponse {
  type: "FeatureCollection";
  dataUpdatedTime: string;
  features: DigitrafficLocationFeature[];
}

/**
 * Upstream Digitraffic API vessel metadata type.
 * Source: https://meri.digitraffic.fi/api/ais/v1/vessels
 */
interface DigitrafficVessel {
  mmsi: number;
  name?: string;
  shipType?: number;
  destination?: string;
  callSign?: string;
  timestamp?: number;
  draught?: number;
  imo?: number;
  eta?: number;
  posType?: number;
  referencePointA?: number;
  referencePointB?: number;
  referencePointC?: number;
  referencePointD?: number;
}

export async function GET() {
  const baseUrl =
    process.env.AIS_BASE_URL || "https://meri.digitraffic.fi";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const headers: HeadersInit = {
      "Accept-Encoding": "gzip",
      "Digitraffic-User": "Overwatch/1.0",
    };

    let locationsRes: Response;
    let vesselsRes: Response;

    try {
      [locationsRes, vesselsRes] = await Promise.all([
        fetch(`${baseUrl}/api/ais/v1/locations`, {
          signal: controller.signal,
          headers,
        }),
        fetch(`${baseUrl}/api/ais/v1/vessels`, {
          signal: controller.signal,
          headers,
        }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!locationsRes.ok) {
      return NextResponse.json(
        {
          error: "Upstream API unavailable",
          details: `Upstream returned status ${locationsRes.status}`,
        },
        { status: 502 }
      );
    }

    const locationsData =
      (await locationsRes.json()) as DigitrafficLocationsResponse;

    // Build vessel metadata lookup by MMSI
    const vesselMeta = new Map<number, DigitrafficVessel>();
    if (vesselsRes.ok) {
      const vesselsData = (await vesselsRes.json()) as DigitrafficVessel[];
      for (const v of vesselsData) {
        vesselMeta.set(v.mmsi, v);
      }
    }

    // Merge location data with vessel metadata
    const vessels = locationsData.features.map((f) => {
      const meta = vesselMeta.get(f.mmsi);
      // AIS heading 511 means "not available"
      const heading =
        f.properties.heading === 511 ? undefined : f.properties.heading;

      return {
        mmsi: String(f.mmsi),
        name: meta?.name,
        lat: f.geometry.coordinates[1], // GeoJSON: [longitude, latitude]
        lon: f.geometry.coordinates[0],
        cog: f.properties.cog,
        sog: f.properties.sog,
        heading,
        vesselType: meta?.shipType,
        destination: meta?.destination,
        lastUpdate: f.properties.timestampExternal,
        callSign: meta?.callSign,
        navStat: f.properties.navStat,
      };
    });

    return NextResponse.json(
      {
        vessels,
        total: vessels.length,
        dataUpdatedTime: locationsData.dataUpdatedTime,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Upstream API unavailable",
        details: message,
      },
      { status: 502 }
    );
  }
}
