# Satellite guessing game: prototype plan

A browser game: you see a patch of satellite imagery somewhere in the world,
click your guess on a map, and score points by how close you were. Five rounds
per game.

This is a rebuild of `where-in-the-world` (Leaflet + a 20 MB city GeoJSON) as a
new repo with a cleaner structure, a small precomputed locations file and real
scoring.

---

## 1. Goals for the prototype

**In scope**
- A 5-round game: imagery view → guess → per-round result → final summary.
- **Always global**: every round can be anywhere in the world; no regional modes.
- Locations weighted toward places people live, balanced across countries (not uniform per city).
- Imagery: Mapbox Satellite at zoom 16 (1–2 m, the limit of its worldwide coverage).
- A small, precomputed locations file (target: under 1 MB).
- Scoring with exponential decay by distance.
- Works on desktop and phone.
- Deployed as a static site on GitHub Pages.

**Out of scope for now** (goes to `docs/IDEAS.md`)
- Accounts, leaderboards, multiplayer, backend.
- Daily challenge / shared seeds.
- Anti-cheat (the answer will be in the client; fine for a hobby game).
- Multiple imagery providers, time-series imagery, game modes.

---

## 2. Key decisions (proposed defaults)

| Topic | Default | Why | Alternative |
|---|---|---|---|
| Frontend | Vite + TypeScript, no framework | Small app, fast dev server, typed, easy deploy | Add React later only if UI state gets messy |
| Map library | MapLibre GL JS | Same as your GeoAI stack; vector + raster; globe view for the result map | Leaflet (what v1 used) |
| Imagery | **Mapbox Satellite** raster tiles (Raster Tiles API, public access token), zoom 16 | Global 1–2 m coverage up to zoom 16 (Maxar Vivid), generous free tier. Higher zooms are only sharp in some regions, which would leak hints | Esri World Imagery (v1's provider) if we need to pivot; config makes it a swap |
| Guess basemap | CARTO dark or light (no labels needed in imagery view) | Free with attribution | OpenFreeMap / Protomaps |
| Location data | **GHS-POP** population grid (JRC GHSL, ~1 km, CC BY 4.0) + **Natural Earth admin-0** countries (public domain) | No list of named places, so no bias toward whichever country has the most rows (v1's problem: mostly small Russian villages) | WorldPop (similar, per-country downloads) |
| Location sampling | **Two-stage**: pick country by `pop^β`, then cell within it by `pop^α`, then a random point in the cell | Variety across the world, still favours where people live; tunable | Pure population weighting (≈ a third of rounds in India/China) |
| Data pipeline | Python script with rasterio/geopandas/numpy | Your strength; runs once, outputs a compact grid file | — |
| Distance | Haversine (great-circle) in TS | Simple and accurate enough for a game | `@turf/distance` |
| Tests | Vitest (frontend logic), pytest (data pipeline) | Fast, standard | — |
| Hosting | GitHub Pages via GitHub Actions | Free, static | Netlify / Cloudflare Pages |

**Verify before building:** Mapbox's current free-tier limits for the Raster Tiles
API, that its terms allow using those tiles in MapLibre (if not, switch the imagery
map to `mapbox-gl`), and the required attribution (Mapbox wordmark + "© Mapbox
© OpenStreetMap" + imagery credits).

---

## 3. New repo setup (Milestone 0)

Prereqs on Windows: Git for Windows, Node.js LTS, Python 3.11+, GitHub CLI (`gh`).
(`git` isn't on your PATH in the current shell, so install it or fix PATH first.)

```bash
gh repo create where-in-the-world-v2 --public --clone
```

```bash
cd where-in-the-world-v2
```

```bash
npm create vite@latest . -- --template vanilla-ts
```

```bash
npm install maplibre-gl
```

```bash
npm install -D vitest
```

Then:
- Add `CLAUDE.md` (starter in this folder), `docs/PROTOTYPE_PLAN.md` (this file), `docs/IDEAS.md`.
- `.gitignore`: Node + Python defaults, `data/raw/`, `.env`. **Do commit `package-lock.json`**
  (the old repo ignored it, which makes builds unreproducible).
- Create a free Mapbox account and a **public** access token (`pk.…`) with only the
  default public scopes. Add URL restrictions for `localhost` and your Pages domain
  (anything shipped to the browser is visible to everyone, so restriction is the protection).
- `.env.example` with `VITE_MAPBOX_TOKEN=`. The real token goes in `.env` locally and a
  GitHub Actions secret for deploys.
- Set `base: '/where-in-the-world-v2/'` in `vite.config.ts` so asset paths work on Pages
  (this was the root-absolute path bug in v1).
- Archive or link the old repo from the new README.

**Done when:** `npm run dev` shows a blank Vite page, the first commit is pushed.

### Proposed layout
```
where-in-the-world-v2/
  index.html
  src/
    main.ts            entry: wires screens together
    game.ts            game state: rounds, current location, scores
    scoring.ts         distance → points
    geo.ts             haversine, great-circle line
    locations.ts       load grid.json, get a location per round
    sampler.ts         two-stage weighted sampling (country → cell → point)
    maps/
      imageryMap.ts    satellite view
      guessMap.ts      clickable guess map
      resultMap.ts     guess vs actual, line between them
    ui/                screens: start, round, result, summary
    styles.css
  public/
    data/grid.json        generated by the pipeline (committed)
  tools/
    build_grid.py         data pipeline
    grid.toml             pipeline settings
    requirements.txt
    tests/
  data/raw/            downloaded source data (gitignored)
  tests/               vitest specs
  docs/
  .github/workflows/deploy.yml
```

---

## 4. Milestones

Each milestone is several small steps. One step = one reviewable change.

### M1: Population grid pipeline (Python)

Why not a list of places: v1 picked uniformly from a list of city polygons, and that
list was mostly small Russian villages, so most rounds were in Russia. Instead we
sample from *where people live*, balanced across countries.

1. Download into `data/raw/`: GHS-POP (latest release, WGS84 30 arc-second / ~1 km
   version) and Natural Earth 1:10m admin-0 countries.
2. `tools/build_grid.py`:
   - Read GHS-POP with rasterio and aggregate to a coarser grid (start at 0.05°,
     ~5 km) by **summing** blocks of pixels (population is a count, so sum, never average).
   - Rasterize the country polygons onto the **same grid** (same transform, same shape)
     with `rasterio.features.rasterize`, so every cell gets a country code with no
     point-in-polygon tests.
   - Drop cells below a minimum population (`min_cell_pop`) and countries below
     `min_country_pop`.
   - Write `public/data/grid.json`: grid origin + cell size, and per country
     `{iso, name, pop, cells: [[cellIndex, pop], ...]}`. Measure the size; if it's over
     ~2 MB, coarsen the grid or switch to a binary format (separate step).
   - Print a simulated "rounds per continent / top 20 countries" table for 10,000
     draws with the current α/β, so the weights can be tuned before playing.
3. pytest on a tiny synthetic raster + two square "countries": block-sum is correct,
   total population is preserved (before filtering), cell→country assignment is
   correct, filters work, output schema is valid.

**Done when:** `grid.json` exists, is a reasonable size, the simulated distribution looks
like a "world tour", and a sample of cells looks right in QGIS.

### M1b: Sampler (TypeScript)
1. `sampler.ts`: weighted random choice helper (cumulative weights + binary search).
2. `pickLocation(grid, config, rng)`: country by `pop^β` → cell by `pop^α` → uniform
   random lon/lat inside the cell. Returns `{lat, lon, iso, countryName}`.
3. Injectable RNG (seeded in tests; later reusable for a daily challenge).
4. Vitest: weights respected over many draws, points always inside the chosen cell,
   same seed → same location.

### M2: One playable round
1. `locations.ts`: fetch `grid.json` once, call `pickLocation` per round.
2. `imageryMap.ts`: full-screen MapLibre map with a Mapbox Satellite raster source
   (`mapbox.satellite` tileset, @2x tiles for sharp screens), zoom 16, no labels,
   interaction off, Mapbox attribution + wordmark visible.
3. `guessMap.ts`: small map in a corner; click drops/moves a marker; enables "Guess".
4. `geo.ts` + tests: haversine distance.
5. `resultMap.ts`: both markers + great-circle line, fit bounds; show distance and
   the country name (from the sampled cell).

**Done when:** you can play one round end to end locally.

### M3: Game loop and scoring
1. `scoring.ts` + tests: `points = round(5000 * exp(-distance_km / scale_km))`,
   with `scale_km` in a config object (start ~2000 km for whole-world play).
2. `game.ts`: 5 rounds, running total, no repeated location within a game.
3. Screens: start → round → round result → … → final summary (per-round table + total).
4. "Play again" resets state cleanly (no leaked map instances; v1 rebuilt maps each round).

**Done when:** a full 5-round game works and scores look sensible.

### M4: Usability and polish
1. Responsive layout: guess map expands on tap on phones.
2. Optional limited pan/zoom on the imagery (clamped to e.g. 1 km around the point).
3. Loading state while tiles load; error message if data/tiles fail.
4. Attribution shown correctly for every map.
5. Keyboard: Enter to submit, Space for next round.

### M5: Deploy
1. `.github/workflows/deploy.yml`: build with Vite, publish to Pages, inject
   `VITE_MAPBOX_TOKEN` from secrets.
2. Update README: how to play, screenshot, data sources and licences, how to rebuild locations.

**Done when:** the public URL works on desktop and phone.

---

## 5. Config (no magic numbers in code)

One `src/config.ts`:
- `roundsPerGame` (5), `imageryZoom` (16), `panRadiusKm` (1)
- `scoring.maxPoints` (5000), `scoring.scaleKm` (2000)
- `imagery`: tile URL template, tile size, max zoom and attribution for the active
  provider (Mapbox now; an Esri entry can be added later so pivoting is a config change)
- `sampling.countryExponent` β (start 0.3): 0 = every country equal, 1 = by population
- `sampling.cellExponent` α (start 0.8): how strongly dense cells win within a country

Pipeline settings (grid cell size, `min_cell_pop`, `min_country_pop`, and the α/β used
for the simulation report) in a small TOML file in `tools/`.

---

## 6. Ideas parking lot (seed `docs/IDEAS.md`)
- Difficulty: zoom level, Sentinel-2 region mode, and a slider for α/β
  ("world tour" ↔ "where people actually live").
- Reverse-geocode the answer for a town/region name on the result screen.
- Daily challenge: same 5 locations for everyone, seeded by date.
- Better sampling from GHSL urban-area polygons, or OSM land use.
- Filter out low-resolution / cloudy imagery tiles.
- Hints (pay points to reveal continent).
- Share-your-score text, local high scores (localStorage).
- Leaderboard (would need a backend).

---

## 7. Decisions

- Repo name: `where-in-the-world-v2` (new repo; the old one gets archived/linked).
- Locations come from a GHS-POP population grid with two-stage country → cell
  sampling; the old `cities.geojson` is not reused.
- Imagery is Mapbox Satellite at zoom 16; pivot to another provider later if needed.

### Made while building (2026-10-23)

- **GHS-POP epoch 2025** (R2023A, the latest release). It's modelled from census
  data, but it's the epoch closest to the imagery.
- **Country = Natural Earth `ADM0_A3`**, stored as `code` (not `iso`: `ISO_A3` is
  `-99` for France, Norway and others, and `ADM0_A3` isn't always ISO). Display
  name from `ADMIN` ("South Korea", not "Republic of Korea").
- **Coastal cells:** a cell belongs to the country its centre is in; populated
  cells whose centre is in the sea (1.7% of people) get the nearest country
  within 200 km, measured in Equal Earth.
- **`grid.json` is compact JSON**, not `[[cellIndex, pop], ...]`: per country, cell
  indices are delta-encoded and cell populations rounded to 2 significant
  figures. 5.1 MB raw, 1.1 MB gzipped (the plan's layout was 10.8 MB / 3.5 MB).
- **Filters:** `min_cell_pop = 1000`, `min_country_pop = 100000` leave 688k cells
  in 196 countries, 96% of the world's population.
- **The tuning report is exact**, not 10,000 random draws: expected rounds per
  10,000 from pop^β and pop^α, so no sampling noise.
- **Guess and result maps use OpenFreeMap (Positron)**, the plan's alternative:
  CARTO basemaps now need an API key; OpenFreeMap needs none and has no limits.
- **Mapbox in MapLibre** is allowed for third-party libraries with attribution:
  Static Tiles API (satellite-v9 style; the v4 Raster Tiles API returned 429
  for this account; its limited plan has no Raster Tiles API and 20k Static
  Tiles requests a month, about 200-400 games); the Mapbox logo plus
  © Mapbox, © OpenStreetMap, Improve this map, © Maxar. "Improve this map" links
  without coordinates, so it can't reveal the answer.
