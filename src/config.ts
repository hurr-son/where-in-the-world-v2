// Game settings. Keep numbers here rather than scattered through the code.

import mapboxLogoUrl from './assets/mapbox-logo.svg'

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

export const config = {
  sampling: {
    /** beta: a country is picked with weight pop^beta. 0 = all countries
     *  equal, 1 = by population. Keep in sync with tools/grid.toml. */
    countryExponent: 0.3,
    /** alpha: within the country, a cell is picked with weight pop^alpha. */
    cellExponent: 0.8,
  },

  /** Map zoom of the imagery view. With 512 px tiles, map zoom = tile zoom. */
  imageryZoom: 16,

  /** The satellite imagery provider. Swap this block to change provider. */
  imagery: {
    /** Empty when VITE_MAPBOX_TOKEN isn't set. */
    token: mapboxToken,
    // @2x = 512 px tiles for sharp screens; jpg90 = JPEG at 90 % quality.
    tileUrl: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${mapboxToken}`,
    tileSize: 512,
    /** Highest tile zoom with global coverage. Beyond it, sharpness depends on
     *  the region, which would be a hint. */
    maxZoom: 16,
    // Required by Mapbox. The "Improve this map" link normally carries the
    // map's coordinates; here that would give the answer away, so it doesn't.
    attribution:
      '<a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">© Mapbox</a> ' +
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> ' +
      '<a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener"><strong>Improve this map</strong></a> ' +
      '<a href="https://www.maxar.com/" target="_blank" rel="noopener">© Maxar</a>',
    /** Logo the provider requires on the map. */
    logo: { href: 'https://www.mapbox.com/', imageUrl: mapboxLogoUrl, alt: 'Mapbox' },
  },
}
