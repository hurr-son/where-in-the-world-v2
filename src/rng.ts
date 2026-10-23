/** A random number source: returns a float in [0, 1), like Math.random. */
export type Rng = () => number

/**
 * A seeded random number generator (mulberry32). The same seed always gives
 * the same sequence, which makes tests repeatable. Not for cryptography.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0 // force to an unsigned 32-bit integer
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}
