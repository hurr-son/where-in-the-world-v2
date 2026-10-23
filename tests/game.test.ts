import { describe, expect, it } from 'vitest'
import { Game } from '../src/game'
import type { Location } from '../src/sampler'

const SETTINGS = { roundsPerGame: 3, scoring: { maxPoints: 5000, scaleKm: 2000 } }

function place(cellIndex: number, lat = 0, lon = 0): Location {
  return { lat, lon, countryCode: 'AAA', countryName: 'A', cellIndex }
}

/** A picker that returns the given locations in order. */
function scripted(...locations: Location[]) {
  let i = 0
  return () => locations[i++ % locations.length]
}

describe('Game', () => {
  it('scores a round and adds up the total', () => {
    const game = new Game(SETTINGS, scripted(place(1, 0, 0), place(2, 0, 10)))

    expect(game.startRound()).toEqual(place(1, 0, 0))
    const perfect = game.submitGuess({ lat: 0, lon: 0 })
    expect(perfect.distanceKm).toBe(0)
    expect(perfect.points).toBe(5000)

    game.startRound()
    const off = game.submitGuess({ lat: 0, lon: 0 }) // 10 degrees, ~1112 km
    expect(off.distanceKm).toBeCloseTo(1111.95, 1)
    expect(off.points).toBe(2868) // 5000 * e^(-1111.95 / 2000) = 2867.6

    expect(game.results).toEqual([perfect, off])
    expect(game.totalPoints).toBe(5000 + 2868)
  })

  it('is over after roundsPerGame rounds', () => {
    const game = new Game(SETTINGS, scripted(place(1), place(2), place(3)))
    for (let round = 0; round < 3; round++) {
      expect(game.isOver).toBe(false)
      game.startRound()
      game.submitGuess({ lat: 0, lon: 0 })
    }
    expect(game.isOver).toBe(true)
    expect(() => game.startRound()).toThrow('over')
  })

  it('does not repeat a cell within a game', () => {
    const game = new Game(SETTINGS, scripted(place(1), place(1), place(1), place(2)))
    expect(game.startRound().cellIndex).toBe(1)
    game.submitGuess({ lat: 0, lon: 0 })
    expect(game.startRound().cellIndex).toBe(2) // two repeats of cell 1 skipped
  })

  it('gives up if it keeps getting used cells', () => {
    const game = new Game(SETTINGS, scripted(place(1)))
    game.startRound()
    game.submitGuess({ lat: 0, lon: 0 })
    expect(() => game.startRound()).toThrow('not already used')
  })

  it('rejects out-of-order calls', () => {
    const game = new Game(SETTINGS, scripted(place(1), place(2)))
    expect(() => game.submitGuess({ lat: 0, lon: 0 })).toThrow('No round')
    game.startRound()
    expect(() => game.startRound()).toThrow('already in progress')
  })

  it('starts fresh for a new game', () => {
    const pick = scripted(place(1), place(2))
    const first = new Game(SETTINGS, pick)
    first.startRound()
    first.submitGuess({ lat: 0, lon: 0 })
    const second = new Game(SETTINGS, pick)
    expect(second.results).toEqual([])
    expect(second.totalPoints).toBe(0)
  })
})
