import { haversineKm, type LatLon } from './geo'
import type { Location } from './sampler'
import { scoreGuess, type ScoringConfig } from './scoring'

export interface GameSettings {
  roundsPerGame: number
  scoring: ScoringConfig
}

export interface RoundResult {
  location: Location
  guess: LatLon
  distanceKm: number
  points: number
}

/** How often to re-pick when a location repeats one already used. */
const MAX_PICK_ATTEMPTS = 100

/**
 * The state of one game: a fixed number of rounds, each at a new location.
 * "Play again" means creating a new Game, so nothing carries over.
 */
export class Game {
  /** Finished rounds, in order. */
  readonly results: RoundResult[] = []
  private settings: GameSettings
  private pick: () => Location
  private current: Location | null = null
  private usedCells = new Set<number>()

  /** pick returns a random location; it's called at least once per round. */
  constructor(settings: GameSettings, pick: () => Location) {
    this.settings = settings
    this.pick = pick
  }

  get roundsPerGame(): number {
    return this.settings.roundsPerGame
  }

  get isOver(): boolean {
    return this.results.length >= this.settings.roundsPerGame
  }

  get totalPoints(): number {
    return this.results.reduce((sum, result) => sum + result.points, 0)
  }

  /** Begin the next round at a location not yet used in this game. */
  startRound(): Location {
    if (this.isOver) throw new Error('The game is over')
    if (this.current) throw new Error('A round is already in progress')
    for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
      const location = this.pick()
      if (!this.usedCells.has(location.cellIndex)) {
        this.usedCells.add(location.cellIndex)
        this.current = location
        return location
      }
    }
    throw new Error('Could not find a location not already used in this game')
  }

  /** Score the guess for the current round and finish the round. */
  submitGuess(guess: LatLon): RoundResult {
    if (!this.current) throw new Error('No round in progress')
    const distanceKm = haversineKm(guess, this.current)
    const result: RoundResult = {
      location: this.current,
      guess,
      distanceKm,
      points: scoreGuess(distanceKm, this.settings.scoring),
    }
    this.results.push(result)
    this.current = null
    return result
  }
}
