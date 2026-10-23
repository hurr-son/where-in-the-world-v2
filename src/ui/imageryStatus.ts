import type { MapLibreMap } from 'maplibre-gl'
import { IMAGERY_SOURCE_ID } from '../maps/imageryMap'

export interface ImageryStatus {
  /** Call when the imagery moves to a new round's location. */
  loading(): void
}

/**
 * The "Loading imagery…" label over the satellite view. It disappears once
 * the map is idle (everything in view has loaded), or turns into an error
 * message if imagery tiles fail.
 */
export function trackImagery(map: MapLibreMap, status: HTMLElement): ImageryStatus {
  let failed = false

  const show = (text: string, isError: boolean) => {
    status.textContent = text
    status.classList.toggle('error', isError)
    status.hidden = false
  }

  // Tile errors say which source they came from; the basemaps' are ignored.
  map.on('error', (event) => {
    if ((event as { sourceId?: string }).sourceId !== IMAGERY_SOURCE_ID) return
    failed = true
    show("Some satellite imagery couldn't load. Check your connection.", true)
  })

  map.on('idle', () => {
    if (!failed) status.hidden = true
  })

  return {
    loading() {
      failed = false
      show('Loading imagery…', false)
    },
  }
}
