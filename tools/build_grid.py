"""Build the game's population grid from GHS-POP.

Run from the repo root:  python tools/build_grid.py
Settings are in tools/grid.toml.
"""

import math
import tomllib
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import Affine
from rasterio.windows import Window

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parent
CONFIG_PATH = TOOLS_DIR / "grid.toml"


def load_config(path: Path = CONFIG_PATH) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def aggregation_factor(pixel_size: float, cell_size: float) -> int:
    """How many source pixels fit along one side of an output cell."""
    factor = round(cell_size / pixel_size)
    if factor < 1 or not math.isclose(factor * pixel_size, cell_size, rel_tol=1e-6):
        raise ValueError(
            f"cell size {cell_size} is not a whole multiple of pixel size {pixel_size}"
        )
    return factor


def block_sum(array: np.ndarray, factor: int) -> np.ndarray:
    """Sum non-overlapping factor x factor blocks of a 2D array.

    Population is a count, so blocks are summed, never averaged. Rows/columns
    at the bottom/right edge that don't fill a whole block are padded with
    zeros, so no population is lost.
    """
    rows, cols = array.shape
    padded = np.pad(array, ((0, -rows % factor), (0, -cols % factor)))
    out_rows, out_cols = padded.shape[0] // factor, padded.shape[1] // factor
    # Split each axis into (block index, position within block), then sum
    # over the within-block axes.
    return padded.reshape(out_rows, factor, out_cols, factor).sum(axis=(1, 3))


def aggregate_raster(
    path: Path, cell_size_deg: float, strip_cells: int = 16
) -> tuple[np.ndarray, Affine]:
    """Block-sum a population raster to cell_size_deg cells.

    Reads strip_cells rows of output cells at a time, so the full-resolution
    raster never has to fit in memory. Returns the coarse array and its
    transform (same origin as the source, bigger pixels).
    """
    with rasterio.open(path) as src:
        x_res, y_res = src.res
        if not math.isclose(x_res, y_res, rel_tol=1e-9):
            raise ValueError(f"pixels are not square: {src.res}")
        factor = aggregation_factor(x_res, cell_size_deg)

        strip_rows = factor * strip_cells  # a multiple of factor, so blocks never straddle strips
        strips = []
        for row in range(0, src.height, strip_rows):
            window = Window(0, row, src.width, min(strip_rows, src.height - row))
            data = src.read(1, window=window, masked=True).filled(0).astype(np.float64)
            strips.append(block_sum(data, factor))

        transform = src.transform @ Affine.scale(factor)
    return np.vstack(strips), transform


def main() -> None:
    config = load_config()
    pop, transform = aggregate_raster(
        REPO_ROOT / config["inputs"]["population"], config["grid"]["cell_size_deg"]
    )
    print(f"Grid: {pop.shape[0]} rows x {pop.shape[1]} cols, cell size {transform.a:.6f} deg")
    print(f"Origin (top-left): lon {transform.c:.6f}, lat {transform.f:.6f}")
    print(f"Total population: {pop.sum():,.0f}")


if __name__ == "__main__":
    main()
