import { describe, expect, it } from 'vitest'
import { formatDistance, formatPoints } from '../src/format'

describe('formatDistance', () => {
  it('uses metres under 1 km', () => {
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(0.8504)).toBe('850 m')
  })

  it('uses one decimal under 10 km', () => {
    expect(formatDistance(1)).toBe('1.0 km')
    expect(formatDistance(4.24)).toBe('4.2 km')
  })

  it('uses whole kilometres with separators above', () => {
    expect(formatDistance(10)).toBe('10 km')
    expect(formatDistance(1234.5)).toBe('1,235 km')
    expect(formatDistance(20015.1)).toBe('20,015 km')
  })
})

describe('formatPoints', () => {
  it('adds thousands separators', () => {
    expect(formatPoints(0)).toBe('0')
    expect(formatPoints(950)).toBe('950')
    expect(formatPoints(25_000)).toBe('25,000')
  })
})
