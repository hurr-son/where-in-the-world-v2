import { MapLibreMap, type IControl } from 'maplibre-gl'
import { config } from '../config'
import { kmToDegrees } from '../geo'
import './setup'

/** The id of the imagery source in the map's style. */
export const IMAGERY_SOURCE_ID = 'imagery'

/** The full-screen satellite view. Created once and reused every round. */
export function createImageryMap(container: HTMLElement): MapLibreMap {
  const { imagery } = config
  const map = new MapLibreMap({
    container,
    // A minimal style: one raster source and one layer showing it.
    style: {
      version: 8,
      sources: {
        [IMAGERY_SOURCE_ID]: {
          type: 'raster',
          tiles: [imagery.tileUrl],
          tileSize: imagery.tileSize,
          // Past this zoom MapLibre enlarges the maxZoom tiles instead of
          // requesting new ones.
          maxzoom: imagery.maxZoom,
          attribution: imagery.attribution,
        },
      },
      layers: [{ id: 'imagery', type: 'raster', source: IMAGERY_SOURCE_ID }],
    },
    center: [0, 0],
    zoom: config.imageryZoom,
    // Zooming in past imageryZoom would only enlarge the same tiles.
    maxZoom: config.imageryZoom,
    interactive: config.panRadiusKm > 0,
    // Keep north up: no rotating or tilting.
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  })
  map.touchZoomRotate.disableRotation()
  map.keyboard.disableRotation()
  map.addControl(new LogoControl(imagery.logo), 'bottom-left')
  return map
}

/** Move the imagery to a round's location. The player can then pan and
 *  zoom out up to config.panRadiusKm beyond the starting view. */
export function showLocation(map: MapLibreMap, lat: number, lon: number): void {
  map.setMaxBounds(null) // last round's limits would block the jump
  map.jumpTo({ center: [lon, lat], zoom: config.imageryZoom })
  if (config.panRadiusKm <= 0) return

  const view = map.getBounds()
  const { dLat, dLon } = kmToDegrees(config.panRadiusKm, lat)
  map.setMaxBounds([
    [view.getWest() - dLon, view.getSouth() - dLat],
    [view.getEast() + dLon, view.getNorth() + dLat],
  ])
}

interface Logo {
  href: string
  imageUrl: string
  alt: string
}

/** A map control (a box in a map corner) showing the provider's logo. */
class LogoControl implements IControl {
  private logo: Logo
  private element: HTMLElement | null = null

  constructor(logo: Logo) {
    this.logo = logo
  }

  onAdd(): HTMLElement {
    const link = document.createElement('a')
    link.className = 'maplibregl-ctrl provider-logo'
    link.href = this.logo.href
    link.target = '_blank'
    link.rel = 'noopener'
    const image = document.createElement('img')
    image.src = this.logo.imageUrl
    image.alt = this.logo.alt
    link.append(image)
    this.element = link
    return link
  }

  onRemove(): void {
    this.element?.remove()
    this.element = null
  }
}
