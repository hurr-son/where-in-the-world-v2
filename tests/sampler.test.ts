import { describe, expect, it } from 'vitest'
import { seededRng } from '../src/rng'
import { cumulativeWeights, weightedIndex } from '../src/sampler'

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
