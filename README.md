# Where in the World

**[▶ Play it here](https://hurr-son.github.io/where-in-the-world-v2/)** — no sign-up, works on desktop and phone.

A geography guessing game. You're shown satellite imagery of a random place
where people live, somewhere in the world. Click the map where you think it
is. The closer you are, the more points you score. Five rounds per game.

![Round result: the guess (blue), the answer (red) and the great-circle route between them](docs/screenshot-result.png)

## How it works

### Picking places people actually live

A random point on Earth is usually ocean, desert or forest. A random town
from a list tends to land wherever the list has the most rows (the first
version of this game ended up mostly in small Russian villages). This game
samples from a **population grid** instead, in two stages:

1. **Pick a country**, weighted by population^0.3. Big countries come up
   more often, but small ones still appear, so a game feels like a world tour
   rather than five rounds in India and China.
2. **Pick a ~5 km grid cell in that country**, weighted by population^0.8,
   so cities and towns are more likely than empty land. Then pick a random
   point inside the cell.

The grid comes from [GHS-POP](https://human-settlement.emergency.copernicus.eu/),
a 1 km global population raster. A Python pipeline in [tools/](tools/)
turns it into the file the game loads:

- sums the 1 km pixels into 0.05° cells (population is a count, so it's
  summed, never averaged)
- rasterizes Natural Earth country borders onto the same grid, and gives
  coastal cells whose centre falls in the sea the nearest country, measured
  in an equal-area projection
- drops near-empty cells and tiny countries
- writes a compact JSON file: 688,000 cells in 196 countries, holding 96% of
  the world's population, in 1.1 MB gzipped
- prints how many rounds per 10,000 would land in each country and continent,
  so the weights can be tuned before playing

### Scoring

Distance is measured along the great circle (the haversine formula). Each
round scores `5000 × e^(−distance / 2000 km)`: 5,000 for a perfect guess,
about 1,840 at 2,000 km and about 410 at 5,000 km. The result map draws the
great-circle route, which is why long routes curve towards the pole.

### Imagery

Mapbox Satellite at zoom 16 (about 1–2 m per pixel). That's the highest zoom
with worldwide coverage; going further would be sharp only in some regions,
which would give away the answer.

## Built with

- **Game:** TypeScript, [Vite](https://vite.dev/), [MapLibre GL JS](https://maplibre.org/), no framework
- **Data pipeline:** Python with rasterio, GeoPandas, NumPy
- **Tests:** Vitest for the game logic, pytest for the pipeline
- **Hosting:** GitHub Pages, deployed by GitHub Actions on every push

## Run it yourself

You'll need Node.js 22 and a free [Mapbox](https://www.mapbox.com/) public
access token.

```bash
npm install
cp .env.example .env   # put your Mapbox token (pk.…) in .env
npm run dev            # http://localhost:5173/where-in-the-world-v2/
npm test
```

Game settings (rounds, scoring, sampling weights) are in
[src/config.ts](src/config.ts). Rebuilding the population grid needs
Python 3.11 and about 500 MB of downloads:

```bash
pip install -r tools/requirements.txt
python tools/download_data.py   # GHS-POP and Natural Earth into data/raw/
python tools/build_grid.py      # writes public/data/grid.json, prints a report
pytest tools/tests
```

To deploy your own copy to GitHub Pages: set **Settings → Pages → Source** to
GitHub Actions, add the token as a repository secret named
`VITE_MAPBOX_TOKEN`, and add your Pages address to the token's URL
restrictions in Mapbox.

## Project layout

```
src/            the game: sampling, scoring, game state, maps, screens
tests/          Vitest tests for the game logic
tools/          Python pipeline that builds the population grid (+ pytest)
public/data/    grid.json, the pipeline's output
docs/           design plan, decisions and ideas
```

## Data and credits

| What | Source | Licence |
|---|---|---|
| Satellite imagery | [Mapbox Satellite](https://docs.mapbox.com/data/tilesets/reference/mapbox-satellite/), © Mapbox, © Maxar | [Mapbox terms](https://www.mapbox.com/legal/tos) |
| Guess and result maps | [OpenFreeMap](https://openfreemap.org/), [OpenMapTiles](https://www.openmaptiles.org/), © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors | OSM data: ODbL |
| Population | [GHS-POP R2023A](https://human-settlement.emergency.copernicus.eu/), epoch 2025, © European Union | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), aggregated to 0.05° cells |
| Country borders | [Natural Earth](https://www.naturalearthdata.com/) 1:10m | Public domain |

This is a rebuild of [where-in-the-world](https://github.com/hurr-son/where-in-the-world).
The design notes are in [docs/PROTOTYPE_PLAN.md](docs/PROTOTYPE_PLAN.md), and
ideas for later are in [docs/IDEAS.md](docs/IDEAS.md).
