import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS_KM, greatCirclePoints, haversineKm, type LatLon } from '../src/geo'

const LONDON: LatLon = { lat: 51.5074, lon: -0.1278 }
const PARIS: LatLon = { lat: 48.8566, lon: 2.3522 }
const NEW_YORK: LatLon = { lat: 40.7128, lon: -74.006 }

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(LONDON, LONDON)).toBe(0)
  })

  it('matches a known distance', () => {
    expect(haversineKm(LONDON, PARIS)).toBeCloseTo(343.6, 0) // within 0.5 km
  })

  it('is the same in both directions', () => {
    expect(haversineKm(PARIS, NEW_YORK)).toBeCloseTo(haversineKm(NEW_YORK, PARIS), 9)
  })

  it('gives a quarter and half of the circumference', () => {
    const quarter = (Math.PI / 2) * EARTH_RADIUS_KM // ~10 008 km
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 90, lon: 0 })).toBeCloseTo(quarter, 6)
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(2 * quarter, 6)
  })

  it('takes the short way across the antimeridian', () => {
    const oneDegree = (Math.PI / 180) * EARTH_RADIUS_KM // ~111 km
    expect(haversineKm({ lat: 0, lon: 179.5 }, { lat: 0, lon: -179.5 })).toBeCloseTo(oneDegree, 6)
  })
})

describe('greatCirclePoints', () => {
  it('starts at a and ends at b', () => {
    const points = greatCirclePoints(LONDON, NEW_YORK, 10)
    expect(points).toHaveLength(11)
    expect(points[0][0]).toBeCloseTo(LONDON.lon, 9)
    expect(points[0][1]).toBeCloseTo(LONDON.lat, 9)
    expect(points[10][0]).toBeCloseTo(NEW_YORK.lon, 9)
    expect(points[10][1]).toBeCloseTo(NEW_YORK.lat, 9)
  })

  it('stays on the shortest route', () => {
    const total = haversineKm(LONDON, NEW_YORK)
    for (const [lon, lat] of greatCirclePoints(LONDON, NEW_YORK, 16)) {
      const via = haversineKm(LONDON, { lat, lon }) + haversineKm({ lat, lon }, NEW_YORK)
      expect(via).toBeCloseTo(total, 6)
    }
  })

  it('bends towards the pole on a flat map', () => {
    // The great circle from London to New York passes north of both cities.
    const middle = greatCirclePoints(LONDON, NEW_YORK, 2)[1]
    expect(middle[1]).toBeGreaterThan(LONDON.lat)
  })

  it('keeps longitudes continuous across the antimeridian', () => {
    const points = greatCirclePoints({ lat: -18, lon: 178 }, { lat: -14, lon: -171 }, 20) // Fiji to Samoa
    for (let i = 1; i < points.length; i++) {
      expect(Math.abs(points[i][0] - points[i - 1][0])).toBeLessThan(180)
    }
    expect(points[20][0]).toBeCloseTo(-171 + 360, 9) // ends at 189, east of 180
  })

  it('handles identical points', () => {
    expect(greatCirclePoints(PARIS, PARIS)).toEqual([[PARIS.lon, PARIS.lat], [PARIS.lon, PARIS.lat]])
  })
})
