"""Export public/data/grid.json as cell polygons, for checking in QGIS.

Run from the repo root:  python tools/grid_to_gpkg.py
Writes data/debug/grid_cells.gpkg (gitignored), one polygon per kept cell
with its country code, name, cell index and population.
"""

import json

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

from build_grid import REPO_ROOT, decode_cells, load_config

OUTPUT_PATH = REPO_ROOT / "data" / "debug" / "grid_cells.gpkg"


def cell_bounds(
    indices: np.ndarray, grid: dict
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """West, south, east, north edges of cells, from grid.json's grid block."""
    rows, cols = np.divmod(indices, grid["cols"])
    size = grid["cellSize"]
    west = grid["west"] + cols * size
    north = grid["north"] - rows * size
    return west, north - size, west + size, north


def grid_to_frame(data: dict) -> gpd.GeoDataFrame:
    """One row per cell in grid.json: code, name, cell, pop, polygon."""
    frames = []
    for country in data["countries"]:
        indices = decode_cells(country["cells"])
        frames.append(gpd.GeoDataFrame(
            {"code": country["code"], "name": country["name"],
             "cell": indices, "pop": country["cellPops"]},
            geometry=shapely.box(*cell_bounds(indices, data["grid"])),
            crs="EPSG:4326",
        ))
    return pd.concat(frames, ignore_index=True)


def main() -> None:
    grid_path = REPO_ROOT / load_config()["output"]["path"]
    cells = grid_to_frame(json.loads(grid_path.read_text(encoding="utf-8")))
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    cells.to_file(OUTPUT_PATH, layer="cells", driver="GPKG")
    print(f"Wrote {len(cells):,} cells to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
