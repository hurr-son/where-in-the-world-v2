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
