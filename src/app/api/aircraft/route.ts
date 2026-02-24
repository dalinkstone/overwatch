import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.adsb.lol";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(`${baseUrl}/v2/mil`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error: "Upstream API unavailable",
          details: `Upstream returned status ${upstreamResponse.status}`,
        },
        { status: 502 }
      );
    }

    const data: unknown = await upstreamResponse.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
        "Content-Type": "application/json",
      },
    });
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
