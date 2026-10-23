import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GridFile } from '../src/sampler'

const GRID: GridFile = {
  grid: { west: -10, north: 50, cellSize: 0.5, cols: 4, rows: 3 },
  countries: [{ code: 'AAA', name: 'A', pop: 100, cells: [5], cellPops: [1000] }],
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

// locations.ts caches the grid in a module variable, so each test imports a
// fresh copy of the module.
async function freshModule() {
  vi.resetModules()
  return import('../src/locations')
}

describe('locations', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(GRID)))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('downloads grid.json from under the base path', async () => {
    const { loadGrid } = await freshModule()
    expect(await loadGrid()).toEqual(GRID)
    // Vitest runs with BASE_URL "/"; the production build uses vite.config.ts's base.
    expect(fetch).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/grid.json`)
  })

  it('downloads only once', async () => {
    const { loadGrid } = await freshModule()
    await loadGrid()
    await loadGrid()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports a failed download and allows a retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    const { loadGrid } = await freshModule()
    await expect(loadGrid()).rejects.toThrow('HTTP 404')
    expect(await loadGrid()).toEqual(GRID) // second call fetches again and succeeds
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
