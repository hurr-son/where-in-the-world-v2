import { describe, expect, it } from 'vitest'
import { seededRng } from '../src/rng'
import {
  cumulativeWeights,
  decodeCellIndex,
  normalizeLon,
  pickLocation,
  weightedIndex,
  type GridFile,
  type Location,
} from '../src/sampler'

// A 3 x 4 grid of half-degree cells with its top-left corner at (-10, 50).
// Country A has cells 1 and 5 (deltas 1, 4); B has cell 11.
const GRID: GridFile = {
  grid: { west: -10, north: 50, cellSize: 0.5, cols: 4, rows: 3 },
  countries: [
    { code: 'AAA', name: 'A', pop: 100, cells: [1, 4], cellPops: [1000, 4000] },
    { code: 'BBB', name: 'B', pop: 10_000, cells: [11], cellPops: [2000] },
  ],
}
const OWNER: Record<number, string> = { 1: 'AAA', 5: 'AAA', 11: 'BBB' }

function draw(grid: GridFile, countryExponent: number, cellExponent: number, n: number, seed = 1) {
  const rng = seededRng(seed)
  return Array.from({ length: n }, () => pickLocation(grid, { countryExponent, cellExponent }, rng))
}

function share(locations: Location[], test: (l: Location) => boolean) {
  return locations.filter(test).length / locations.length
}

/** An Rng that always returns the same value, for exact tests. */
const fixed = (value: number) => () => value

describe('cumulativeWeights', () => {
  it('returns running totals', () => {
    expect(Array.from(cumulativeWeights([1, 2, 3]))).toEqual([1, 3, 6])
  })
})

describe('weightedIndex', () => {
  const cumulative = cumulativeWeights([1, 2, 3]) // [1, 3, 6]

  it('maps the random number onto the running totals', () => {
    expect(weightedIndex(cumulative, fixed(0))).toBe(0) // target 0
    expect(weightedIndex(cumulative, fixed(0.2))).toBe(1) // target 1.2
    expect(weightedIndex(cumulative, fixed(0.5))).toBe(2) // target 3, not above 3
    expect(weightedIndex(cumulative, fixed(0.9999))).toBe(2)
  })

  it('never picks a zero weight', () => {
    expect(weightedIndex(cumulativeWeights([0, 1, 0]), fixed(0))).toBe(1)
    expect(weightedIndex(cumulativeWeights([0, 1, 0]), fixed(0.9999))).toBe(1)
  })

  it('respects the weights over many draws', () => {
    const rng = seededRng(1)
    const counts = [0, 0]
    const twoWeights = cumulativeWeights([1, 3])
    for (let i = 0; i < 100_000; i++) counts[weightedIndex(twoWeights, rng)]++
    expect(counts[1] / 100_000).toBeCloseTo(0.75, 2)
  })
})

describe('decodeCellIndex', () => {
  it('adds up the gaps up to the position', () => {
    expect(decodeCellIndex([1, 4, 6], 0)).toBe(1)
    expect(decodeCellIndex([1, 4, 6], 1)).toBe(5)
    expect(decodeCellIndex([1, 4, 6], 2)).toBe(11)
  })
})

describe('normalizeLon', () => {
  it('leaves normal longitudes alone', () => {
    expect(normalizeLon(0)).toBe(0)
    expect(normalizeLon(-180)).toBe(-180)
    expect(normalizeLon(179.5)).toBeCloseTo(179.5)
  })

  it('wraps longitudes past the antimeridian', () => {
    expect(normalizeLon(180)).toBe(-180)
    expect(normalizeLon(180.01)).toBeCloseTo(-179.99)
    expect(normalizeLon(-180.004)).toBeCloseTo(179.996)
  })
})

describe('pickLocation', () => {
  it('always puts the point inside the chosen cell, in the right country', () => {
    const { west, north, cellSize, cols } = GRID.grid
    for (const loc of draw(GRID, 0.3, 0.8, 1000)) {
      const col = loc.cellIndex % cols
      const row = Math.floor(loc.cellIndex / cols)
      expect(loc.lon).toBeGreaterThanOrEqual(west + col * cellSize)
      expect(loc.lon).toBeLessThan(west + (col + 1) * cellSize)
      expect(loc.lat).toBeLessThanOrEqual(north - row * cellSize)
      expect(loc.lat).toBeGreaterThan(north - (row + 1) * cellSize)
      expect(loc.countryCode).toBe(OWNER[loc.cellIndex])
      expect(loc.countryName).toBe(loc.countryCode === 'AAA' ? 'A' : 'B')
    }
  })

  it('gives the same locations for the same seed', () => {
    expect(draw(GRID, 0.3, 0.8, 5, 99)).toEqual(draw(GRID, 0.3, 0.8, 5, 99))
    expect(draw(GRID, 0.3, 0.8, 5, 99)).not.toEqual(draw(GRID, 0.3, 0.8, 5, 100))
  })

  it('picks countries by pop^beta', () => {
    const isA = (l: Location) => l.countryCode === 'AAA'
    // beta 0: both countries equal. beta 1: A has 100 of 10 100 people.
    expect(share(draw(GRID, 0, 0.8, 20_000), isA)).toBeCloseTo(0.5, 1)
    expect(share(draw(GRID, 1, 0.8, 20_000), isA)).toBeCloseTo(100 / 10_100, 2)
  })

  it('picks cells within a country by pop^alpha', () => {
    const onlyA: GridFile = { ...GRID, countries: [GRID.countries[0]] }
    const inCell5 = (l: Location) => l.cellIndex === 5
    // Cells of 1000 and 4000 people: alpha 1 -> 80 % in cell 5, alpha 0 -> 50 %.
    expect(share(draw(onlyA, 0.3, 1, 20_000), inCell5)).toBeCloseTo(0.8, 1)
    expect(share(draw(onlyA, 0.3, 0, 20_000), inCell5)).toBeCloseTo(0.5, 1)
  })

  it('wraps points in a cell that crosses the antimeridian', () => {
    const edge: GridFile = {
      grid: { west: 179.9, north: 0, cellSize: 0.5, cols: 1, rows: 1 },
      countries: [{ code: 'FJI', name: 'Fiji', pop: 1, cells: [0], cellPops: [1000] }],
    }
    const lons = draw(edge, 0.3, 0.8, 1000).map((l) => l.lon)
    expect(lons.every((lon) => lon >= -180 && lon < 180)).toBe(true)
    expect(lons.some((lon) => lon < 0)).toBe(true) // some wrapped to the west side
  })
})
