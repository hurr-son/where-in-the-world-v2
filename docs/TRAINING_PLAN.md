# Training (study) mode: plan

A way to *learn* what places look like from above, separate from the game:
browse satellite images with the answer already shown ("Near Recife, Brazil"),
or flip through them like flashcards. Status: **proposal**, nothing built yet.

---

## 1. The key constraint: imagery can't be saved as files

The obvious approach is to take screenshots of the game's imagery and ship
them as image files. **Mapbox's terms don't allow that.** Its Product Terms
(October 2026) say customers must:

- "not export, download, cache or store Licensed Map Content" (§1.9 v)
- "not perform bulk or automated queries" or "scrape or systematically
  download" it (§1.9 ii–iii)
- not redistribute content from the services (§1.10)

Printed and static copies (§1.7) are allowed only in narrow cases, such as
promotional material, not as a dataset served on a website.

So the study mode **stores locations, not pictures**. Each image is requested
from Mapbox live, when someone actually looks at it, exactly like the game
does. (Option B in section 3 covers imagery that *can* be stored.)

## 2. Goals

**In scope**
- A study screen reachable from the start screen ("Study" next to "Start").
- A fixed set of a few hundred study locations, each with country, continent
  and nearest town name, built by the Python pipeline.
- Two ways to use it:
  - **Browse:** a grid of images with their labels.
  - **Flashcards:** one image at a time, think of your guess, press Reveal
    to see the place and a small locator map.
- Mark cards as "know it" (saved in the browser) and skip them next time.

**Out of scope** (to IDEAS.md)
- Written tips per region ("red soil and corrugated roofs: likely East Africa").
- Spaced repetition scheduling.
- Accounts or syncing progress across devices.

## 3. Imagery options

| Option | How | Cost on your Mapbox plan | Notes |
|---|---|---|---|
| **A. Mapbox Static Images API** (proposed) | One `<img>` per card: `…/styles/v1/mapbox/satellite-v9/static/{lon},{lat},16/600x400@2x` | 1 request per image; your plan allows 5,000 a month | Same imagery as the game. Mapbox logo and attribution are drawn on the image by default. Loaded only when a card is on screen |
| A2. The game's tile map | Reuse the imagery map per card | ~6–12 tile requests per card, shared with the game's 20,000 | Worse: eats the game's quota |
| **B. Sentinel-2 (stored)** | The pipeline renders small PNGs from free Copernicus Sentinel-2 imagery and commits them | None | Allowed to store and redistribute with attribution, but 10 m per pixel instead of ~1 m: towns, fields and coastlines are visible, individual buildings aren't. Looks different from the game |

**Proposal: start with A.** It shows exactly what the game shows. Only the
locations file is stored; the images are always fetched live. If the 5,000
images a month becomes a limit, B is the fallback.

**Verify before building:** the Static Images API quota on your account
dashboard (it showed "0 / 5K requests"), and the attribution rules for
static images.

## 4. The study set

`tools/build_study_set.py`, run once like `build_grid.py`, output committed:

- **Picking places:** the same two-stage sampling as the game (country by
  pop^β, cell by pop^α, point in cell), with a fixed seed so the set is
  reproducible. That follows the project rule against picking uniformly from
  a list of places. Maybe a higher minimum cell population than the game, so
  study images more often show something recognisable rather than empty fields.
- **Size:** a few hundred places (e.g. 300), so the file stays small.
- **Labels:** country and continent from Natural Earth (already in the
  pipeline), plus the **nearest town** from
  [GeoNames](https://www.geonames.org/) `cities15000` (CC BY 4.0), found with
  a nearest-neighbour search in a metric CRS. The names are worked out once
  in the pipeline, so there are no geocoding calls and no API limits.
- **Output:** `public/data/study.json`:
  `[{lat, lon, country, continent, town, townDistanceKm}, …]`.

## 5. Milestones

### S1: Study set pipeline
1. Download GeoNames `cities15000` in `download_data.py`.
2. `build_study_set.py` + `study.toml` (size, seed, min cell population).
3. pytest: same seed gives the same set; every place has a country and town;
   nearest town is correct on a synthetic example.

**Done when:** `study.json` exists, and a sample looks right in QGIS.

### S2: Flashcards
1. `src/study.ts`: load `study.json`, shuffle with the seeded random number
   generator, filter out cards marked as known + tests.
2. Study screen: one image (Static Images API), Reveal button, then the label
   ("8 km from Recife, Brazil") and a small OpenFreeMap locator map with a pin.
   Next / Previous, keyboard ← → and Space to reveal.
3. "Know it" button, saved in localStorage.

**Done when:** you can flip through cards on phone and desktop, and each
image costs exactly one Static Images request (check the Network tab).

### S3: Browse grid
1. A grid of cards with labels showing, images lazy-loaded (`loading="lazy"`)
   so only visible cards are requested.
2. Optional filter by continent (see question 3).

### S4: Polish
1. Loading and error states for images, as in the game.
2. Credits: Mapbox / Maxar on the images, GeoNames and Natural Earth on the screen.

## 6. Costs and limits

- Each card viewed costs one Static Images request, at most 5,000 a month on
  your plan. The browse grid must lazy-load, or a single visit could use
  hundreds of requests.
- The game's tile quota (20,000 a month) isn't touched.
- Everything else (OpenFreeMap locator maps, the study set file) is free.

## 7. Questions for you

1. Option A (live Mapbox images, same look as the game) or B (stored
   Sentinel-2 images, coarser but no quota)?
2. Flashcards first, browse grid first, or both?
3. Filtering by continent is useful for studying, but CLAUDE.md says the
   *game* is always global. Is a continent filter OK in study mode only?
4. How many study places: around 300, or more?
