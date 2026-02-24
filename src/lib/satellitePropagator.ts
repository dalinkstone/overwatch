/**
 * SGP4 orbital propagator using satellite.js.
 * Computes real-time lat/lon/altitude from OMM orbital elements.
 * Pure module — intended for client-side use.
 */

import {
  json2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  radiansToDegrees,
} from 'satellite.js';
import type { OMMJsonObject } from 'satellite.js';
import type { SatelliteOMM, SatellitePosition } from './satelliteTypes';
import { getSatelliteCategory } from './satelliteTypes';

/**
 * Propagate satellite positions from OMM orbital elements using SGP4.
 * Takes an array of OMM records and returns computed positions for the current time.
 * Satellites with failed propagation (invalid/stale TLEs) are silently skipped.
 */
export const propagateSatellites = (ommRecords: SatelliteOMM[]): SatellitePosition[] => {
  const now = new Date();
  const gmst = gstime(now);
  const results: SatellitePosition[] = [];

  for (const record of ommRecords) {
    try {
      const satrec = json2satrec(record as unknown as OMMJsonObject);
      const positionAndVelocity = propagate(satrec, now);

      if (!positionAndVelocity) {
        continue;
      }

      const geodetic = eciToGeodetic(positionAndVelocity.position, gmst);
      const lat = radiansToDegrees(geodetic.latitude);
      const lon = radiansToDegrees(geodetic.longitude);
      const altitude = geodetic.height;

      // SGP4 propagation can fail silently, producing NaN values
      if (isNaN(lat) || isNaN(lon) || isNaN(altitude)) {
        continue;
      }

      const vel = positionAndVelocity.velocity;
      const velocityMagnitude = Math.sqrt(
        vel.x * vel.x + vel.y * vel.y + vel.z * vel.z
      );

      if (isNaN(velocityMagnitude)) {
        continue;
      }

      const period = 1440 / record.MEAN_MOTION;

      results.push({
        noradId: record.NORAD_CAT_ID,
        name: record.OBJECT_NAME,
        objectId: record.OBJECT_ID,
        lat,
        lon,
        altitude,
        velocity: velocityMagnitude,
        category: getSatelliteCategory(record.OBJECT_NAME, record.NORAD_CAT_ID),
        epoch: record.EPOCH,
        inclination: record.INCLINATION,
        period,
      });
    } catch {
      // Skip satellites with invalid orbital elements
      continue;
    }
  }

  return results;
};
