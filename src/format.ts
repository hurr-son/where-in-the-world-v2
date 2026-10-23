/** A distance for display: metres under 1 km, one decimal under 10 km,
 *  whole kilometres (with thousands separators) above. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString('en-US')} km`
}

/** Points with thousands separators: 12345 -> "12,345". */
export function formatPoints(points: number): string {
  return points.toLocaleString('en-US')
}
