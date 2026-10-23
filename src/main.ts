// MapLibre's CSS first, so our styles.css can override it.
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import { config } from './config'
import { formatDistance } from './format'
import { haversineKm } from './geo'
import { nextLocation } from './locations'
import { createGuessMap } from './maps/guessMap'
import { createImageryMap, showLocation } from './maps/imageryMap'
import { createResultMap } from './maps/resultMap'
import type { Location } from './sampler'

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

let answer: Location | null = null

async function startRound() {
  resultScreen.hidden = true
  guessMap.reset()
  guessButton.disabled = true
  answer = await nextLocation()
  showLocation(imageryMap, answer.lat, answer.lon)
}

guessButton.addEventListener('click', () => {
  const guess = guessMap.guess()
  if (!guess || !answer) return
  const distance = haversineKm(guess, answer)
  resultText.textContent =
    `Your guess was ${formatDistance(distance)} away. This place is in ${answer.countryName}.`
  resultScreen.hidden = false
  resultMap.show(guess, answer)
})

nextButton.addEventListener('click', () => void startRound())

void startRound()
