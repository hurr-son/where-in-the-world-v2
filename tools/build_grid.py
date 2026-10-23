"""Build the game's population grid from GHS-POP.

Run from the repo root:  python tools/build_grid.py
Settings are in tools/grid.toml.
"""

import math
import tomllib
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.transform import Affine
from rasterio.windows import Window

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parent
CONFIG_PATH = TOOLS_DIR / "grid.toml"

# Natural Earth fields. ADM0_A3 is unique per feature (ISO_A3 is "-99" for
# France, Norway and others); ADMIN is the common English name.
CODE_FIELD = "ADM0_A3"
NAME_FIELD = "ADMIN"


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


def load_countries(path: Path) -> gpd.GeoDataFrame:
    """Read country polygons as columns code, name, geometry in EPSG:4326."""
    countries = gpd.read_file(path, columns=[CODE_FIELD, NAME_FIELD])
    countries = countries.rename(columns={CODE_FIELD: "code", NAME_FIELD: "name"})
    return countries.to_crs("EPSG:4326").reset_index(drop=True)


def rasterize_countries(
    countries: gpd.GeoDataFrame, transform: Affine, shape: tuple[int, int]
) -> np.ndarray:
    """Burn country numbers onto the grid: i + 1 for row i of countries, 0 for none.

    A cell gets a country only if the cell's centre is inside the polygon.
    """
    shapes = ((geom, i + 1) for i, geom in enumerate(countries.geometry))
    return rasterize(shapes, out_shape=shape, transform=transform, fill=0, dtype="uint16")


def cell_centres(
    rows: np.ndarray, cols: np.ndarray, transform: Affine
) -> tuple[np.ndarray, np.ndarray]:
    """Lon/lat of cell centres for a north-up grid (no rotation in the transform)."""
    lons = transform.c + (cols + 0.5) * transform.a
    lats = transform.f + (rows + 0.5) * transform.e
    return lons, lats


def nearest_country(
    lons: np.ndarray,
    lats: np.ndarray,
    countries: gpd.GeoDataFrame,
    metric_crs: str,
    max_distance_km: float,
) -> np.ndarray:
    """For each point, the row in countries of the nearest polygon, or -1 if
    none is within max_distance_km. Distances are measured in metric_crs."""
    points = gpd.GeoDataFrame(
        geometry=gpd.points_from_xy(lons, lats), crs="EPSG:4326"
    ).to_crs(metric_crs)
    # Split multipolygons into their parts so the spatial index works on
    # individual islands; each part keeps its country's row as its index.
    parts = countries[["geometry"]].to_crs(metric_crs).explode(index_parts=False)
    joined = gpd.sjoin_nearest(points, parts, how="left", max_distance=max_distance_km * 1000)
    # A point equally close to two parts gets two rows; keep the first.
    joined = joined[~joined.index.duplicated(keep="first")]
    return joined["index_right"].fillna(-1).astype(int).to_numpy()


def fill_orphans(
    country_grid: np.ndarray,
    pop: np.ndarray,
    countries: gpd.GeoDataFrame,
    transform: Affine,
    metric_crs: str,
    max_distance_km: float,
) -> np.ndarray:
    """Give populated cells with no country the nearest country.

    These are mostly coastal cells whose centre falls in the sea. Cells with
    no country within max_distance_km stay 0.
    """
    rows, cols = np.nonzero((country_grid == 0) & (pop > 0))
    lons, lats = cell_centres(rows, cols, transform)
    nearest = nearest_country(lons, lats, countries, metric_crs, max_distance_km)
    filled = country_grid.copy()
    filled[rows, cols] = nearest + 1  # -1 (nothing in range) becomes 0, no country
    return filled


def country_populations(
    country_grid: np.ndarray, pop: np.ndarray, n_countries: int
) -> np.ndarray:
    """Total population of each country; index i is row i of countries.

    Cells with no country (0) are left out.
    """
    # bincount adds up pop for each country number in one pass.
    totals = np.bincount(country_grid.ravel(), weights=pop.ravel(), minlength=n_countries + 1)
    return totals[1:]


def select_cells(
    country_grid: np.ndarray,
    pop: np.ndarray,
    country_pops: np.ndarray,
    min_cell_pop: float,
    min_country_pop: float,
) -> np.ndarray:
    """Mask of cells to keep: at least min_cell_pop people, in a country with
    at least min_country_pop people. Cells with no country are dropped."""
    # Lookup table by country number; index 0 is "no country".
    country_ok = np.concatenate([[False], country_pops >= min_country_pop])
    return country_ok[country_grid] & (pop >= min_cell_pop)


def main() -> None:
    config = load_config()
    pop, transform = aggregate_raster(
        REPO_ROOT / config["inputs"]["population"], config["grid"]["cell_size_deg"]
    )
    print(f"Grid: {pop.shape[0]} rows x {pop.shape[1]} cols, cell size {transform.a:.6f} deg")
    print(f"Origin (top-left): lon {transform.c:.6f}, lat {transform.f:.6f}")
    print(f"Total population: {pop.sum():,.0f}")

    countries = load_countries(REPO_ROOT / config["inputs"]["countries"])
    by_centre = rasterize_countries(countries, transform, pop.shape)
    orphans = (by_centre == 0) & (pop > 0)
    print(f"Populated cells with no country by centre: {orphans.sum():,} ({pop[orphans].sum():,.0f} people)")

    country_grid = fill_orphans(
        by_centre,
        pop,
        countries,
        transform,
        config["countries"]["metric_crs"],
        config["countries"]["max_snap_km"],
    )
    unassigned = (country_grid == 0) & (pop > 0)
    print(f"Still no country within {config['countries']['max_snap_km']} km: "
          f"{unassigned.sum():,} cells ({pop[unassigned].sum():,.0f} people)")

    filters = config["filters"]
    country_pops = country_populations(country_grid, pop, len(countries))
    keep = select_cells(
        country_grid, pop, country_pops, filters["min_cell_pop"], filters["min_country_pop"]
    )
    kept_countries = np.unique(country_grid[keep])
    print(f"Kept {keep.sum():,} cells in {len(kept_countries)} countries, "
          f"holding {pop[keep].sum() / pop.sum():.1%} of the population")


if __name__ == "__main__":
    main()
