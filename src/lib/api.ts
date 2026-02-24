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
    throw new Error(
      `Aircraft API request failed: ${response.status} ${response.statusText}`
    );
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
