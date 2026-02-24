import { NextResponse } from "next/server";
import {
  initAisStream,
  getVessels,
  getConnectionStatus,
} from "@/lib/aisStreamManager";
import { isVesselTrackingEnabled } from "@/lib/env";

export async function GET() {
  if (!isVesselTrackingEnabled()) {
    return NextResponse.json({
      vessels: [],
      status: { state: "disabled", vesselCount: 0, lastMessage: 0 },
    });
  }

  try {
    initAisStream();

    const vessels = getVessels();
    const status = getConnectionStatus();

    return NextResponse.json(
      { vessels, status },
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to fetch vessel data",
        details: message,
      },
      { status: 500 }
    );
  }
}
