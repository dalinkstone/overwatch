import { AircraftResponse } from "./types";

/**
 * Fetch military aircraft data from our local API proxy route.
 * The proxy route forwards requests to the upstream ADSB.lol API.
 *
 * @throws Error if the response is not ok or the data is malformed.
 */
export const fetchMilitaryAircraft = async (): Promise<AircraftResponse> => {
  const response = await fetch("/api/aircraft");

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "details" in body &&
        typeof (body as { details: unknown }).details === "string"
      ) {
        detail = (body as { details: string }).details;
      }
    } catch {
      // response body wasn't JSON — use the status line
    }
    throw new Error(`Aircraft API request failed: ${detail}`);
  }

  const data: unknown = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as AircraftResponse).ac)
  ) {
    throw new Error("Malformed aircraft API response: missing 'ac' array");
  }

  return data as AircraftResponse;
};
