// Game settings. Keep numbers here rather than scattered through the code.

import mapboxLogoUrl from './assets/mapbox-logo.svg'

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

export const config = {
  roundsPerGame: 5,

  scoring: {
    /** Points for a perfect guess. */
    maxPoints: 5000,
    /** Points fall to ~37 % (1/e) of maxPoints at this distance, ~14 % at
     *  twice it, and so on. */
    scaleKm: 2000,
  },

  sampling: {
    /** beta: a country is picked with weight pop^beta. 0 = all countries
     *  equal, 1 = by population. Keep in sync with tools/grid.toml. */
    countryExponent: 0.3,
    /** alpha: within the country, a cell is picked with weight pop^alpha. */
    cellExponent: 0.8,
  },

  /** Map zoom of the imagery view. With 512 px tiles, map zoom = tile zoom. */
  imageryZoom: 16,
  /** How far beyond the starting view the player can pan the imagery, in km.
   *  0 turns panning and zooming off. */
  panRadiusKm: 1,

  /** The satellite imagery provider. Swap this block to change provider. */
  imagery: {
    /** Empty when VITE_MAPBOX_TOKEN isn't set. */
    token: mapboxToken,
    // Static Tiles API from the label-free satellite-v9 style (the v4 Raster
    // Tiles API returns 429 for this account). 512 px tiles, @2x for sharp
    // screens. Free tier: 200k tile requests a month.
    tileUrl: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/{z}/{x}/{y}@2x?access_token=${mapboxToken}`,
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

  /** The map the player clicks to guess. OpenFreeMap: free OpenStreetMap
   *  vector tiles, no API key; MapLibre shows its attribution automatically. */
  guessMap: {
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    center: { lat: 20, lon: 0 },
    zoom: 0,
  },
}
