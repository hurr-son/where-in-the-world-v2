import { MapLibreMap, type IControl } from 'maplibre-gl'
import { config } from '../config'
import './setup'

/** The full-screen satellite view. Created once and reused every round. */
export function createImageryMap(container: HTMLElement): MapLibreMap {
  const { imagery } = config
  const map = new MapLibreMap({
    container,
    // A minimal style: one raster source and one layer showing it.
    style: {
      version: 8,
      sources: {
        imagery: {
          type: 'raster',
          tiles: [imagery.tileUrl],
          tileSize: imagery.tileSize,
          // Past this zoom MapLibre enlarges the maxZoom tiles instead of
          // requesting new ones.
          maxzoom: imagery.maxZoom,
          attribution: imagery.attribution,
        },
      },
      layers: [{ id: 'imagery', type: 'raster', source: 'imagery' }],
    },
    center: [0, 0],
    zoom: config.imageryZoom,
    interactive: false, // no panning or zooming (for now)
  })
  map.addControl(new LogoControl(imagery.logo), 'bottom-left')
  return map
}

/** Move the imagery to a round's location. */
export function showLocation(map: MapLibreMap, lat: number, lon: number): void {
  map.jumpTo({ center: [lon, lat], zoom: config.imageryZoom })
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
