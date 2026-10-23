import { config } from './config'
import type { Rng } from './rng'
import { pickLocation, type GridFile, type Location } from './sampler'

// BASE_URL is vite.config.ts's `base`, so this works locally and on Pages.
const GRID_URL = `${import.meta.env.BASE_URL}data/grid.json`

let gridPromise: Promise<GridFile> | null = null

/** Download grid.json once; later calls reuse the same download. */
export function loadGrid(): Promise<GridFile> {
  gridPromise ??= fetch(GRID_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load ${GRID_URL} (HTTP ${response.status})`)
      return response.json() as Promise<GridFile>
    })
    .catch((error) => {
      gridPromise = null // let a later call try again
      throw error
    })
  return gridPromise
}

/** A random location for the next round. */
export async function nextLocation(rng: Rng = Math.random): Promise<Location> {
  return pickLocation(await loadGrid(), config.sampling, rng)
}
