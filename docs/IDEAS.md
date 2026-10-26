# Ideas (not in the prototype)

## Gameplay
- Difficulty: zoom level, Sentinel-2 region mode, and a slider for α/β
  ("world tour" ↔ "where people actually live").
- Hints (pay points to reveal continent).
- Avoid repeating a country within a game (now only the same ~5 km cell is avoided).
- Daily challenge: same 5 locations for everyone, seeded by date (planned in
  [LEADERBOARD_PLAN.md](LEADERBOARD_PLAN.md)).

## Study mode
- Browse or flashcard imagery with the answer shown: see
  [TRAINING_PLAN.md](TRAINING_PLAN.md).

## Layout
- Desktop: enlarge the guess map on hover (it's a fixed 360 x 240 px now).

## Result screen
- Reverse-geocode the answer for a town/region name.
- Share-your-score text, local high scores (localStorage).

## Data and imagery
- Better sampling from GHSL urban-area polygons, or OSM land use.
- Filter out low-resolution / cloudy imagery tiles.

## Tooling
- Run the pipeline's pytest suite in CI too (needs the GDAL-based wheels).

## Needs a backend
- Leaderboards: see [LEADERBOARD_PLAN.md](LEADERBOARD_PLAN.md).
- Accounts, multiplayer.

## Sampling quality
- The point is uniform within a ~5 km cell, so the imagery can show fields or
  water even when the cell's people live in one village. Pick a 1 km pixel
  inside the cell by population instead (needs sub-cell data in grid.json), or
  reject points that fall in water.
