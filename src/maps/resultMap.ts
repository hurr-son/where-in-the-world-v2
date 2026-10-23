import { LngLatBounds, MapLibreMap, Marker, type GeoJSONSource } from 'maplibre-gl'
import { config } from '../config'
import { greatCirclePoints, type LatLon } from '../geo'
import './setup'

const GUESS_COLOR = '#2a7fd4'
const ANSWER_COLOR = '#d33'
/** Don't zoom in further than this, even when the guess was very close. */
const MAX_FIT_ZOOM = 10

export interface ResultMap {
  map: MapLibreMap
  /** Show the guess, the answer and the shortest route between them. */
  show(guess: LatLon, answer: LatLon): void
}

/** The map on the round-result screen. Created once, reused every round. */
export function createResultMap(container: HTMLElement): ResultMap {
  const { styleUrl, center, zoom } = config.guessMap
  const map = new MapLibreMap({
    container,
    style: styleUrl,
    center: [center.lon, center.lat],
    zoom,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  })
  map.touchZoomRotate.disableRotation()

  // The line layer can only be added once the style has loaded.
  const styleReady = new Promise<void>((resolve) => {
    map.once('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#333', 'line-width': 2, 'line-dasharray': [2, 2] },
      })
      resolve()
    })
  })

  const guessMarker = new Marker({ color: GUESS_COLOR })
  const answerMarker = new Marker({ color: ANSWER_COLOR })

  return {
    map,
    show(guess, answer) {
      // The container was hidden until now, so let the map measure its size.
      map.resize()
      const points = greatCirclePoints(guess, answer)
      // Put the markers on the ends of the line (whose longitudes may run
      // past +-180) so they stay attached to it.
      guessMarker.setLngLat(points[0]).addTo(map)
      answerMarker.setLngLat(points[points.length - 1]).addTo(map)

      const bounds = new LngLatBounds()
      for (const point of points) bounds.extend(point)
      map.fitBounds(bounds, { padding: 60, maxZoom: MAX_FIT_ZOOM, animate: false })

      void styleReady.then(() => {
        map.getSource<GeoJSONSource>('route')?.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: points },
        })
      })
    },
  }
}
