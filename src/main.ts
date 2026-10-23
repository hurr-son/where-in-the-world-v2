// MapLibre's CSS first, so our styles.css can override it.
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import { config } from './config'
import { nextLocation } from './locations'
import { createImageryMap, showLocation } from './maps/imageryMap'

const imageryMap = createImageryMap(document.querySelector<HTMLElement>('#imagery')!)

if (!config.imagery.token) {
  console.warn('VITE_MAPBOX_TOKEN is not set: copy .env.example to .env and add your token.')
}

nextLocation().then((location) => showLocation(imageryMap, location.lat, location.lon))
