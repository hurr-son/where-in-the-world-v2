export interface ScoringConfig {
  /** Points for a perfect guess. */
  maxPoints: number
  /** Distance at which points fall to 1/e (~37 %) of maxPoints. */
  scaleKm: number
}

/** Points for a guess distanceKm from the answer: maxPoints at 0 km,
 *  shrinking by a factor of e every scaleKm. */
export function scoreGuess(distanceKm: number, scoring: ScoringConfig): number {
  return Math.round(scoring.maxPoints * Math.exp(-distanceKm / scoring.scaleKm))
}
