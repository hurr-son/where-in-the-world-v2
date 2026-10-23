import { MapLibreMap, Marker } from 'maplibre-gl'
import { config } from '../config'
import type { LatLon } from '../geo'
import './setup'

export interface GuessMap {
  map: MapLibreMap
  /** The player's current guess, or null before they click. */
  guess(): LatLon | null
  /** Clear the guess and zoom back out, ready for a new round. */
  reset(): void
}

/** The small world map the player clicks to guess. Created once, reused
 *  every round. onGuess runs each time the guess is placed or moved. */
export function createGuessMap(container: HTMLElement, onGuess: (guess: LatLon) => void): GuessMap {
  const { styleUrl, center, zoom } = config.guessMap
  const map = new MapLibreMap({
    container,
    style: styleUrl,
    center: [center.lon, center.lat],
    zoom,
    // Keep north up: no rotating or tilting.
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  })
  map.touchZoomRotate.disableRotation()

  let marker: Marker | null = null
  let current: LatLon | null = null

  map.on('click', (event) => {
    // Draw the marker where the player clicked, even on a repeated copy of
    // the world to the left or right...
    marker ??= new Marker()
    marker.setLngLat(event.lngLat).addTo(map)
    // ...but keep the guess's longitude within -180..180.
    const { lng, lat } = event.lngLat.wrap()
    current = { lat, lon: lng }
    onGuess(current)
  })

  return {
    map,
    guess: () => current,
    reset() {
      marker?.remove()
      current = null
      map.jumpTo({ center: [center.lon, center.lat], zoom })
    },
  }
}
