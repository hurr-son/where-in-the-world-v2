import type { Rng } from './rng'

/** Running totals of weights: [1, 2, 3] -> [1, 3, 6]. */
export function cumulativeWeights(weights: number[]): Float64Array {
  const cumulative = new Float64Array(weights.length)
  let total = 0
  for (let i = 0; i < weights.length; i++) {
    total += weights[i]
    cumulative[i] = total
  }
  return cumulative
}

/**
 * Pick an index with probability proportional to its weight, given the
 * running totals from cumulativeWeights. Zero weights are never picked.
 */
export function weightedIndex(cumulative: Float64Array, rng: Rng): number {
  const target = rng() * cumulative[cumulative.length - 1]
  // Binary search for the first running total above the target.
  let low = 0
  let high = cumulative.length - 1
  while (low < high) {
    const mid = (low + high) >>> 1
    if (cumulative[mid] > target) {
      high = mid
    } else {
      low = mid + 1
    }
  }
  return low
}

/** The layout of public/data/grid.json, written by tools/build_grid.py. */
export interface GridFile {
  grid: {
    /** Longitude of the grid's west edge, in degrees. */
    west: number
    /** Latitude of the grid's north edge, in degrees. */
    north: number
    /** Width and height of one cell, in degrees. */
    cellSize: number
    cols: number
    rows: number
  }
  countries: CountryCells[]
}

export interface CountryCells {
  /** Natural Earth ADM0_A3 code, e.g. "FRA". */
  code: string
  name: string
  /** Total population of the country. */
  pop: number
  /** Cell indices (row * cols + col, rows counted from the north), ascending
   *  and delta-encoded: the first is the index, the rest are gaps. */
  cells: number[]
  /** Population of each cell, in the same order as cells. */
  cellPops: number[]
}

export interface SamplingConfig {
  /** beta: a country is picked with weight pop^beta. */
  countryExponent: number
  /** alpha: within the country, a cell is picked with weight pop^alpha. */
  cellExponent: number
}

export interface Location {
  lat: number
  lon: number
  countryCode: string
  countryName: string
  /** The grid cell the point is in. */
  cellIndex: number
}

/**
 * Pick a random place to show: a country by pop^beta, then a cell in that
 * country by pop^alpha, then a uniformly random point inside the cell.
 */
export function pickLocation(grid: GridFile, sampling: SamplingConfig, rng: Rng): Location {
  const countryWeights = grid.countries.map((c) => c.pop ** sampling.countryExponent)
  const country = grid.countries[weightedIndex(cumulativeWeights(countryWeights), rng)]

  const cellWeights = country.cellPops.map((p) => p ** sampling.cellExponent)
  const position = weightedIndex(cumulativeWeights(cellWeights), rng)
  const cellIndex = decodeCellIndex(country.cells, position)

  const { west, north, cellSize, cols } = grid.grid
  const row = Math.floor(cellIndex / cols)
  const col = cellIndex % cols
  return {
    lon: normalizeLon(west + (col + rng()) * cellSize),
    lat: north - (row + rng()) * cellSize,
    countryCode: country.code,
    countryName: country.name,
    cellIndex,
  }
}

/** The absolute cell index at `position` in a delta-encoded list. */
export function decodeCellIndex(deltas: number[], position: number): number {
  let index = 0
  for (let i = 0; i <= position; i++) index += deltas[i]
  return index
}

/** Wrap a longitude into [-180, 180). Cells on the antimeridian reach
 *  slightly past +-180. */
export function normalizeLon(lon: number): number {
  // JavaScript's % keeps the sign of the left side, hence the + 360.
  return ((((lon + 180) % 360) + 360) % 360) - 180
}
