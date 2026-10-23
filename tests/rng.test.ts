import { describe, expect, it } from 'vitest'
import { seededRng } from '../src/rng'

describe('seededRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    const seqA = Array.from({ length: 5 }, a)
    const seqB = Array.from({ length: 5 }, b)
    expect(seqA).toEqual(seqB)
  })

  it('gives different sequences for different seeds', () => {
    expect(seededRng(1)()).not.toEqual(seededRng(2)())
  })

  it('returns floats in [0, 1) with a mean near 0.5', () => {
    const rng = seededRng(7)
    const values = Array.from({ length: 10_000 }, rng)
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThan(1)
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    expect(mean).toBeCloseTo(0.5, 1)
  })
})
