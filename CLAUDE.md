# Satellite guessing game (prototype)

## What this is
A static browser game: show satellite imagery of a random populated place,
player clicks a guess on a map, points decay with distance, 5 rounds per game.
Hobby + portfolio project. Plan: `docs/PROTOTYPE_PLAN.md`.

Don't copy any other game's code, UI artwork, names or branding.

## Who you're working with
Harrison is a geospatial analyst (QGIS, ArcGIS Pro, spatial Python), newer to
frontend. He wants to understand every line he keeps. So:
- Work in small steps. One step = one focused change he can review.
- Before writing code for a step, give a short plan (files, functions, why).
- After each step, explain what you did in plain words, including any web or
  geospatial concept involved (tile pyramids, Web Mercator, great circles, etc.).
- Ask before adding a new dependency.
- Never add features beyond the current step. Note ideas in `docs/IDEAS.md`.

## Stack
- Vite + TypeScript (no framework), MapLibre GL JS, Vitest
- Data pipeline: Python 3.11, rasterio, geopandas, shapely, pyproj, numpy, pytest (in `tools/`)
- Hosting: GitHub Pages via GitHub Actions

## Rules
- The game is always global: no country/continent-restricted modes.
- Imagery is Mapbox Satellite at zoom 16 (its global-coverage limit). Provider
  details live in `src/config.ts` so it can be swapped later.
- The Mapbox token comes from `VITE_MAPBOX_TOKEN`; it must be a URL-restricted
  public token.
- Game constants (rounds, zoom, scoring scale, tile URLs) live in `src/config.ts`.
- API keys/tokens only via `VITE_*` env vars; never commit `.env`.
- Asset paths must work under the Pages base path (`vite.config.ts` `base`).
- Buffer/measure in a metric CRS in the pipeline; output WGS84 (EPSG:4326).
- Distances in the game are great-circle (haversine), in km.
- Every map shows its provider's required attribution.
- Add or update tests for every logic function (scoring, geo, game state, pipeline).
- Pipeline output is reproducible and committed to `public/data/`.
- Locations are sampled two-stage (country by `pop^β`, cell by `pop^α`, point
  in cell). Never pick uniformly from a list of places.
- Population is a count: aggregate rasters by sum, never mean.

## Commands
- Dev server: `npm run dev`
- Tests: `npm test` / `pytest tools/tests`
- Build: `npm run build`
- Rebuild grid: `python tools/build_grid.py`
