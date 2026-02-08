/**
 * Shared contract for satellite position data from the simulator API.
 * The simulator uses real orbital mechanics and returns:
 * - latitude, longitude: subsatellite point in RADIANS (geodetic)
 * - height: altitude in METERS
 */

export type SatellitePosition = {
  latitude: number
  longitude: number
  height: number
}

/** Map of satellite id -> position (JSON from /status/all). */
export type SatellitePositionData = Record<string, SatellitePosition>

const RAD_TO_DEG = 180 / Math.PI

export function radiansToDegrees(rad: number): number {
  return rad * RAD_TO_DEG
}

/** Convert API position (radians, meters) to degrees and height in km. */
export function positionToDegrees(pos: SatellitePosition): {
  latDeg: number
  lonDeg: number
  heightKm: number
} {
  return {
    latDeg: radiansToDegrees(pos.latitude),
    lonDeg: radiansToDegrees(pos.longitude),
    heightKm: pos.height / 1000,
  }
}
