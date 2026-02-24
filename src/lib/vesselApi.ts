import { VesselResponse } from "./maritimeTypes";

/**
 * Fetch vessel data from our local API proxy route.
 * The proxy route forwards requests to the upstream Digitraffic AIS API.
 *
 * @throws Error if the response is not ok or the data is malformed.
 */
export const fetchVessels = async (): Promise<VesselResponse> => {
  const response = await fetch("/api/vessels");

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
    throw new Error(`Vessel API request failed: ${detail}`);
  }

  const data: unknown = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as VesselResponse).vessels)
  ) {
    throw new Error("Malformed vessel API response: missing 'vessels' array");
  }

  return data as VesselResponse;
};
