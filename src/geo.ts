export interface LatLon {
  lat: number
  lon: number
}

/** Mean Earth radius (IUGG), in km. */
export const EARTH_RADIUS_KM = 6371.0088

const toRadians = (degrees: number) => (degrees * Math.PI) / 180
const toDegrees = (radians: number) => (radians * 180) / Math.PI

/** Great-circle distance between two points on a spherical Earth, in km
 *  (the haversine formula). */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2
  // min() guards against rounding pushing h a hair above 1.
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** How many degrees of latitude and longitude span `km` around latitude
 *  `lat`. For short distances only. Longitude degrees get narrower towards
 *  the poles (by cos(lat)), so the same km needs more of them. */
export function kmToDegrees(km: number, lat: number): { dLat: number; dLon: number } {
  const dLat = toDegrees(km / EARTH_RADIUS_KM)
  return { dLat, dLon: dLat / Math.cos(toRadians(lat)) }
}

/**
 * Points along the great circle from a to b, as [lon, lat] pairs (GeoJSON
 * order), for drawing the shortest route on a map. Longitudes are unwrapped
 * (they may go past +-180) so a line crossing the antimeridian stays
 * continuous instead of jumping across the map.
 */
export function greatCirclePoints(a: LatLon, b: LatLon, segments = 64): [number, number][] {
  const start = toVector(a)
  const end = toVector(b)
  // Angle between the two points, seen from the Earth's centre.
  const angle = Math.acos(Math.min(1, Math.max(-1, dot(start, end))))
  if (Math.sin(angle) < 1e-12) {
    // Same point (or exactly opposite, where every great circle works).
    return [[a.lon, a.lat], [b.lon, b.lat]]
  }

  const points: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    // Spherical linear interpolation: walk along the arc at a steady angle.
    const t = i / segments
    const wStart = Math.sin((1 - t) * angle) / Math.sin(angle)
    const wEnd = Math.sin(t * angle) / Math.sin(angle)
    const point = fromVector([
      wStart * start[0] + wEnd * end[0],
      wStart * start[1] + wEnd * end[1],
      wStart * start[2] + wEnd * end[2],
    ])
    points.push([point.lon, point.lat])
  }

  // Unwrap: shift each longitude by 360 if it jumped more than 180 from the
  // previous point.
  for (let i = 1; i < points.length; i++) {
    const jump = points[i][0] - points[i - 1][0]
    if (jump > 180) points[i][0] -= 360
    else if (jump < -180) points[i][0] += 360
  }
  return points
}

type Vector = [number, number, number]

/** A point as a unit vector from the Earth's centre. */
function toVector({ lat, lon }: LatLon): Vector {
  const phi = toRadians(lat)
  const lambda = toRadians(lon)
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)]
}

function fromVector([x, y, z]: Vector): LatLon {
  return { lat: toDegrees(Math.atan2(z, Math.hypot(x, y))), lon: toDegrees(Math.atan2(y, x)) }
}

function dot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
