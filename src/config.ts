// Game settings. Keep numbers here rather than scattered through the code.

export const config = {
  sampling: {
    /** beta: a country is picked with weight pop^beta. 0 = all countries
     *  equal, 1 = by population. Keep in sync with tools/grid.toml. */
    countryExponent: 0.3,
    /** alpha: within the country, a cell is picked with weight pop^alpha. */
    cellExponent: 0.8,
  },
}
