// MapLibre's CSS first, so our styles.css can override it.
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import { config } from './config'
import { haversineKm } from './geo'
import { nextLocation } from './locations'
import { createGuessMap } from './maps/guessMap'
import { createImageryMap, showLocation } from './maps/imageryMap'
import type { Location } from './sampler'

const guessButton = document.querySelector<HTMLButtonElement>('#guess-button')!

const imageryMap = createImageryMap(document.querySelector<HTMLElement>('#imagery')!)
const guessMap = createGuessMap(document.querySelector<HTMLElement>('#guess-map')!, () => {
  guessButton.disabled = false
})

if (!config.imagery.token) {
  console.warn('VITE_MAPBOX_TOKEN is not set: copy .env.example to .env and add your token.')
}

let answer: Location | null = null

nextLocation().then((location) => {
  answer = location
  showLocation(imageryMap, location.lat, location.lon)
})

guessButton.addEventListener('click', () => {
  const guess = guessMap.guess()
  if (!guess || !answer) return
  console.log(`${haversineKm(guess, answer).toFixed(0)} km away, in ${answer.countryName}`)
})
