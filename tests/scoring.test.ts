import { describe, expect, it } from 'vitest'
import { scoreGuess } from '../src/scoring'

const SCORING = { maxPoints: 5000, scaleKm: 2000 }

describe('scoreGuess', () => {
  it('gives full points for a perfect guess', () => {
    expect(scoreGuess(0, SCORING)).toBe(5000)
  })

  it('falls by a factor of e every scaleKm', () => {
    expect(scoreGuess(2000, SCORING)).toBe(Math.round(5000 / Math.E)) // 1839
    expect(scoreGuess(4000, SCORING)).toBe(Math.round(5000 / Math.E ** 2)) // 677
  })

  it('rounds to whole points and reaches 0 on the far side of the world', () => {
    expect(scoreGuess(1234.5, SCORING)).toBe(2697)
    expect(scoreGuess(20_000, SCORING)).toBe(0)
  })

  it('never goes up as the distance grows', () => {
    let previous = Infinity
    for (let km = 0; km <= 20_000; km += 250) {
      const points = scoreGuess(km, SCORING)
      expect(points).toBeLessThanOrEqual(previous)
      previous = points
    }
  })
})
