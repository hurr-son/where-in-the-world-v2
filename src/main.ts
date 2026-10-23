// MapLibre's CSS first, so our styles.css can override it.
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import { config } from './config'
import { formatDistance, formatPoints } from './format'
import { Game } from './game'
import { loadGrid } from './locations'
import { createGuessMap } from './maps/guessMap'
import { createImageryMap, showLocation } from './maps/imageryMap'
import { createResultMap } from './maps/resultMap'
import { pickLocation, type GridFile } from './sampler'
import { setupGuessPanel } from './ui/guessPanel'
import { trackImagery } from './ui/imageryStatus'
import { showScreen } from './ui/screens'
import { renderSummary } from './ui/summary'

const element = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!

const startButton = element<HTMLButtonElement>('#start-button')
const startWarning = element('#start-warning')
const startError = element('#start-error')
const hudRound = element('#hud-round')
const hudScore = element('#hud-score')
const guessButton = element<HTMLButtonElement>('#guess-button')
const resultText = element('#result-text')
const nextButton = element<HTMLButtonElement>('#next-button')
const summaryTotal = element('#summary-total')
const summaryRows = element<HTMLTableSectionElement>('#summary-rows')
const playAgainButton = element<HTMLButtonElement>('#play-again-button')

// The maps are created once and reused for every round and every game.
const imageryMap = createImageryMap(element('#imagery'))
const guessMap = createGuessMap(element('#guess-map'), () => {
  guessButton.disabled = false
})
const resultMap = createResultMap(element('#result-map'))
const guessPanel = setupGuessPanel(element('#guess-panel'))
const imageryStatus = trackImagery(imageryMap, element('#imagery-status'))

if (!config.imagery.token) {
  startWarning.textContent =
    "Satellite imagery isn't set up: the Mapbox token (VITE_MAPBOX_TOKEN) is missing."
  startWarning.hidden = false
}

let grid: GridFile | null = null
let game: Game

/** Download the locations; on failure, offer to try again. */
async function prepare() {
  startButton.disabled = true
  startButton.textContent = 'Loading…'
  startError.hidden = true
  try {
    grid = await loadGrid()
    startButton.textContent = 'Start'
  } catch (error) {
    console.error(error)
    startError.textContent = "Couldn't load the game data. Check your connection and try again."
    startError.hidden = false
    startButton.textContent = 'Try again'
  }
  startButton.disabled = false
}

function startGame() {
  const loaded = grid
  if (!loaded) return
  game = new Game(config, () => pickLocation(loaded, config.sampling, Math.random))
  startRound()
}

function startRound() {
  const location = game.startRound()
  guessMap.reset()
  guessPanel.close()
  guessButton.disabled = true
  showLocation(imageryMap, location.lat, location.lon)
  imageryStatus.loading()
  hudRound.textContent = `Round ${game.results.length + 1} of ${game.roundsPerGame}`
  hudScore.textContent = `${formatPoints(game.totalPoints)} points`
  showScreen('round')
}

function submitGuess() {
  const guess = guessMap.guess()
  if (!guess) return
  const result = game.submitGuess(guess)
  resultText.textContent =
    `${formatDistance(result.distanceKm)} away: ${formatPoints(result.points)} points. ` +
    `This place is in ${result.location.countryName}.`
  nextButton.textContent = game.isOver ? 'See your score' : 'Next round'
  showScreen('result')
  resultMap.show(guess, result.location) // after showScreen, so the map has a size
}

function next() {
  if (!game.isOver) {
    startRound()
    return
  }
  const maxTotal = game.roundsPerGame * config.scoring.maxPoints
  summaryTotal.textContent = `${formatPoints(game.totalPoints)} of ${formatPoints(maxTotal)} points`
  renderSummary(summaryRows, game.results)
  showScreen('summary')
}

startButton.addEventListener('click', () => (grid ? startGame() : void prepare()))
guessButton.addEventListener('click', submitGuess)
nextButton.addEventListener('click', next)
playAgainButton.addEventListener('click', startGame)

showScreen('start')
void prepare()
