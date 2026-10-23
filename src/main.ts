// MapLibre's CSS first, so our styles.css can override it.
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import { config } from './config'
import { formatDistance } from './format'
import { Game } from './game'
import { loadGrid } from './locations'
import { createGuessMap } from './maps/guessMap'
import { createImageryMap, showLocation } from './maps/imageryMap'
import { createResultMap } from './maps/resultMap'
import { pickLocation } from './sampler'

const element = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!

const guessButton = element<HTMLButtonElement>('#guess-button')
const resultScreen = element('#result')
const resultText = element('#result-text')
const nextButton = element<HTMLButtonElement>('#next-button')

// The maps are created once and reused for every round.
const imageryMap = createImageryMap(element('#imagery'))
const guessMap = createGuessMap(element('#guess-map'), () => {
  guessButton.disabled = false
})
const resultMap = createResultMap(element('#result-map'))

if (!config.imagery.token) {
  console.warn('VITE_MAPBOX_TOKEN is not set: copy .env.example to .env and add your token.')
}

const grid = await loadGrid()
const newGame = () => new Game(config, () => pickLocation(grid, config.sampling, Math.random))
let game = newGame()

function startRound() {
  if (game.isOver) game = newGame()
  resultScreen.hidden = true
  guessMap.reset()
  guessButton.disabled = true
  const location = game.startRound()
  showLocation(imageryMap, location.lat, location.lon)
}

guessButton.addEventListener('click', () => {
  const guess = guessMap.guess()
  if (!guess) return
  const result = game.submitGuess(guess)
  resultText.textContent =
    `Your guess was ${formatDistance(result.distanceKm)} away: ${result.points} points. ` +
    `This place is in ${result.location.countryName}.`
  resultScreen.hidden = false
  resultMap.show(guess, result.location)
})

nextButton.addEventListener('click', startRound)

startRound()
