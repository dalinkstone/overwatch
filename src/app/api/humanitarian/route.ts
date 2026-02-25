import { NextResponse } from "next/server";
import {
  type HumanitarianCrisis,
  type HumanitarianDisaster,
  type HumanitarianCrisisType,
  type HumanitarianApiResponse,
  getSeverityFromData,
  getCountryCentroid,
} from "@/lib/humanitarianTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RELIEFWEB_BASE = "https://api.reliefweb.int/v1";
const APPNAME = process.env.RELIEFWEB_APPNAME ?? "overwatch";
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let cachedData: HumanitarianApiResponse | null = null;
let cacheTimestamp = 0;

// ---------------------------------------------------------------------------
// ReliefWeb disaster type mapping
// ---------------------------------------------------------------------------

const mapDisasterType = (rwType: string): HumanitarianCrisisType => {
  const lower = rwType.toLowerCase();
  if (lower.includes("complex emergency")) return "complex-emergency";
  if (lower.includes("conflict") || lower.includes("war")) return "conflict";
  if (lower.includes("drought")) return "drought";
  if (lower.includes("earthquake")) return "earthquake";
  if (lower.includes("epidemic") || lower.includes("pandemic")) return "epidemic";
  if (lower.includes("flood") || lower.includes("flash flood")) return "flood";
  if (lower.includes("food") || lower.includes("insecurity") || lower.includes("famine")) return "food-insecurity";
  if (lower.includes("cyclone") || lower.includes("hurricane") || lower.includes("typhoon") || lower.includes("storm") || lower.includes("tropical")) return "cyclone";
  if (lower.includes("volcano") || lower.includes("eruption")) return "volcano";
  if (lower.includes("wildfire") || lower.includes("fire")) return "wildfire";
  if (lower.includes("displacement") || lower.includes("refugee") || lower.includes("idp")) return "displacement";
  return "other";
};

const mapDisasterStatus = (rwStatus: string): "ongoing" | "past" | "alert" => {
  const lower = rwStatus.toLowerCase();
  if (lower === "alert") return "alert";
  if (lower === "past") return "past";
  return "ongoing";
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const fetchWithTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

// ---------------------------------------------------------------------------
// ReliefWeb data structures (for narrowing unknown responses)
// ---------------------------------------------------------------------------

interface RWDisasterFields {
  name?: string;
  glide?: string;
  status?: string;
  url?: string;
  date?: { created?: string };
  primary_country?: {
    iso3?: string;
    name?: string;
    location?: { lat?: number; lon?: number };
  };
  type?: Array<{ name?: string }>;
}

interface RWReportFields {
  title?: string;
  url?: string;
  date?: { created?: string };
  primary_country?: {
    iso3?: string;
    name?: string;
  };
  disaster?: Array<{ name?: string }>;
}

interface RWItem<T> {
  id: string;
  fields: T;
}

interface RWResponse<T> {
  data: Array<RWItem<T>>;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

const fetchDisasters = async (): Promise<Array<RWItem<RWDisasterFields>>> => {
  const params = new URLSearchParams({
    appname: APPNAME,
    "filter[field]": "status",
    "filter[value]": "ongoing",
    "fields[include][]": "name",
    limit: "500",
    "sort[]": "date.created:desc",
  });

  // URLSearchParams doesn't support multiple values for the same key via constructor,
  // so append additional fields
  const fieldsToInclude = [
    "glide",
    "primary_country.iso3",
    "primary_country.name",
    "primary_country.location",
    "type",
    "status",
    "date.created",
    "url",
  ];
  for (const field of fieldsToInclude) {
    params.append("fields[include][]", field);
  }

  const url = `${RELIEFWEB_BASE}/disasters?${params.toString()}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`ReliefWeb disasters returned ${response.status}`);
  }

  const raw: unknown = await response.json();
  if (typeof raw !== "object" || raw === null || !("data" in raw)) {
    throw new Error("Invalid ReliefWeb disasters response");
  }

  const typed = raw as RWResponse<RWDisasterFields>;
  if (!Array.isArray(typed.data)) {
    throw new Error("ReliefWeb disasters response missing data array");
  }

  return typed.data;
};

const fetchReports = async (): Promise<Array<RWItem<RWReportFields>>> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    appname: APPNAME,
    "filter[field]": "date.created",
    "filter[value][from]": thirtyDaysAgo,
    "fields[include][]": "title",
    limit: "1000",
    "sort[]": "date.created:desc",
  });

  const fieldsToInclude = [
    "url",
    "primary_country.iso3",
    "primary_country.name",
    "date.created",
    "disaster.name",
  ];
  for (const field of fieldsToInclude) {
    params.append("fields[include][]", field);
  }

  const url = `${RELIEFWEB_BASE}/reports?${params.toString()}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`ReliefWeb reports returned ${response.status}`);
  }

  const raw: unknown = await response.json();
  if (typeof raw !== "object" || raw === null || !("data" in raw)) {
    throw new Error("Invalid ReliefWeb reports response");
  }

  const typed = raw as RWResponse<RWReportFields>;
  if (!Array.isArray(typed.data)) {
    throw new Error("ReliefWeb reports response missing data array");
  }

  return typed.data;
};

// ---------------------------------------------------------------------------
// Processing logic
// ---------------------------------------------------------------------------

interface CountryDisasters {
  iso3: string;
  countryName: string;
  disasters: HumanitarianDisaster[];
  types: HumanitarianCrisisType[];
  primaryStatus: "ongoing" | "past" | "alert";
  primaryName: string;
  primaryId: string;
  primaryGlide: string | null;
  primaryType: HumanitarianCrisisType;
}

interface CountryReports {
  count: number;
  latestDate: string | null;
  latestTitle: string | null;
  latestUrl: string | null;
}

const processData = (
  disasterItems: Array<RWItem<RWDisasterFields>>,
  reportItems: Array<RWItem<RWReportFields>>,
): HumanitarianApiResponse => {
  // Group disasters by country ISO3
  const disastersByCountry = new Map<string, CountryDisasters>();

  for (const item of disasterItems) {
    const fields = item.fields;
    const iso3 = fields.primary_country?.iso3;
    const countryName = fields.primary_country?.name;
    if (!iso3 || !countryName) continue;

    const disasterType = mapDisasterType(
      fields.type?.[0]?.name ?? "other",
    );
    const status = mapDisasterStatus(fields.status ?? "ongoing");

    const disaster: HumanitarianDisaster = {
      id: String(item.id),
      name: fields.name ?? "Unknown disaster",
      glideNumber: fields.glide ?? null,
      type: disasterType,
      status,
      dateStarted: fields.date?.created ?? null,
      url: fields.url ?? `https://reliefweb.int/disaster/${item.id}`,
    };

    const existing = disastersByCountry.get(iso3);
    if (existing) {
      existing.disasters.push(disaster);
      existing.types.push(disasterType);
    } else {
      disastersByCountry.set(iso3, {
        iso3,
        countryName,
        disasters: [disaster],
        types: [disasterType],
        primaryStatus: status,
        primaryName: fields.name ?? "Unknown crisis",
        primaryId: String(item.id),
        primaryGlide: fields.glide ?? null,
        primaryType: disasterType,
      });
    }
  }

  // Group reports by country ISO3
  const reportsByCountry = new Map<string, CountryReports>();

  for (const item of reportItems) {
    const fields = item.fields;
    const iso3 = fields.primary_country?.iso3;
    if (!iso3) continue;

    const existing = reportsByCountry.get(iso3);
    const dateCreated = fields.date?.created ?? null;

    if (existing) {
      existing.count++;
      // Keep latest report (reports are sorted desc, so first seen is latest)
    } else {
      reportsByCountry.set(iso3, {
        count: 1,
        latestDate: dateCreated,
        latestTitle: fields.title ?? null,
        latestUrl: fields.url ?? null,
      });
    }
  }

  // Merge: all countries that have disasters OR reports
  const allIso3 = new Set([
    ...disastersByCountry.keys(),
    ...reportsByCountry.keys(),
  ]);

  const crises: HumanitarianCrisis[] = [];
  let totalDisasters = 0;
  let totalReports = 0;
  const now = new Date().toISOString();

  for (const iso3 of allIso3) {
    const centroid = getCountryCentroid(iso3);
    if (!centroid) continue; // Skip countries with no centroid

    const countryDisasters = disastersByCountry.get(iso3);
    const countryReports = reportsByCountry.get(iso3);

    const disasterCount = countryDisasters?.disasters.length ?? 0;
    const reportCount = countryReports?.count ?? 0;
    const types = countryDisasters?.types ?? [];

    totalDisasters += disasterCount;
    totalReports += reportCount;

    const severity = getSeverityFromData(reportCount, disasterCount, types);

    const crisis: HumanitarianCrisis = {
      id: countryDisasters?.primaryId ?? `report-${iso3}`,
      name: countryDisasters?.primaryName ?? `${iso3}: Humanitarian Situation`,
      status: countryDisasters?.primaryStatus ?? "ongoing",
      glideNumber: countryDisasters?.primaryGlide ?? null,
      type: countryDisasters?.primaryType ?? "other",
      country: countryDisasters?.countryName ?? iso3,
      countryIso3: iso3,
      lat: centroid.lat,
      lon: centroid.lon,
      severity,
      disasterCount,
      reportCount,
      lastReportDate: countryReports?.latestDate ?? null,
      lastReportTitle: countryReports?.latestTitle ?? null,
      lastReportUrl: countryReports?.latestUrl ?? null,
      disasters: countryDisasters?.disasters ?? [],
      updatedAt: now,
    };

    crises.push(crisis);
  }

  // Sort: critical first, then by reportCount descending
  const severityOrder: Record<HumanitarianCrisis["severity"], number> = {
    critical: 0,
    major: 1,
    moderate: 2,
    minor: 3,
  };

  crises.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.reportCount - a.reportCount;
  });

  return {
    crises,
    totalCountries: crises.length,
    totalDisasters,
    totalReports,
    timestamp: now,
    partial: false,
  };
};

// ---------------------------------------------------------------------------
// JSON response helpers
// ---------------------------------------------------------------------------

const jsonHeaders = (maxAge: number, swr: number) => ({
  "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${swr}`,
  "Content-Type": "application/json",
});

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET() {
  // Serve from cache if valid
  if (cachedData && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData, {
      status: 200,
      headers: jsonHeaders(1800, 900),
    });
  }

  let disasterItems: Array<RWItem<RWDisasterFields>> = [];
  let reportItems: Array<RWItem<RWReportFields>> = [];
  let partial = false;

  // Fetch both sources in parallel
  const [disasterResult, reportResult] = await Promise.allSettled([
    fetchDisasters(),
    fetchReports(),
  ]);

  if (disasterResult.status === "fulfilled") {
    disasterItems = disasterResult.value;
  } else {
    console.error("[humanitarian] Disasters fetch failed:", disasterResult.reason);
    partial = true;
  }

  if (reportResult.status === "fulfilled") {
    reportItems = reportResult.value;
  } else {
    console.error("[humanitarian] Reports fetch failed:", reportResult.reason);
    partial = true;
  }

  // Both failed — return stale cache or error
  if (disasterResult.status === "rejected" && reportResult.status === "rejected") {
    if (cachedData) {
      return NextResponse.json(
        { ...cachedData, partial: true } satisfies HumanitarianApiResponse,
        { status: 200, headers: jsonHeaders(60, 60) },
      );
    }

    return NextResponse.json(
      {
        error: "Both ReliefWeb endpoints failed",
        timestamp: new Date().toISOString(),
      },
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  // Process available data
  const result = processData(disasterItems, reportItems);
  if (partial) {
    result.partial = true;
  }

  // Update cache
  cachedData = result;
  cacheTimestamp = Date.now();

  return NextResponse.json(result, {
    status: 200,
    headers: jsonHeaders(1800, 900),
  });
}
