import json

import geopandas as gpd
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box

from build_grid import (
    aggregate_raster,
    aggregation_factor,
    block_sum,
    build_output,
    cell_centres,
    cell_class_shares,
    country_populations,
    country_shares,
    decode_cells,
    encode_cells,
    fill_orphans,
    nearest_country,
    rasterize_countries,
    round_significant,
    select_cells,
    write_json,
)

# A 4 x 6 grid of 1-degree cells just north of the equator:
# lon 0..6, lat 0..4. Country A covers lon 0-3, B covers lon 3-5,
# and the last column (lon 5-6) is "sea".
GRID_TRANSFORM = from_origin(0, 4, 1, 1)
GRID_SHAPE = (4, 6)
METRIC_CRS = "EPSG:8857"


@pytest.fixture
def two_countries():
    return gpd.GeoDataFrame(
        {"code": ["AAA", "BBB"], "name": ["A", "B"]},
        geometry=[box(0, 0, 3, 4), box(3, 0, 5, 4)],
        crs="EPSG:4326",
    )


def write_geotiff(path, array, west, north, pixel_size):
    """Write a single-band EPSG:4326 GeoTIFF for tests."""
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=array.shape[1],
        height=array.shape[0],
        count=1,
        dtype=array.dtype,
        crs="EPSG:4326",
        transform=from_origin(west, north, pixel_size, pixel_size),
    ) as dst:
        dst.write(array, 1)


def test_block_sum_known_values():
    array = np.arange(16, dtype=float).reshape(4, 4)
    # Top-left block is 0 + 1 + 4 + 5, and so on.
    expected = np.array([[10, 18], [42, 50]], dtype=float)
    np.testing.assert_array_equal(block_sum(array, 2), expected)


def test_block_sum_pads_partial_edge_blocks():
    array = np.ones((5, 7))
    result = block_sum(array, 3)
    assert result.shape == (2, 3)
    assert result[0, 0] == 9  # full 3 x 3 block
    assert result[1, 2] == 2  # bottom-right block holds only 2 x 1 real pixels
    assert result.sum() == array.sum()


def test_aggregation_factor():
    assert aggregation_factor(1 / 120, 0.05) == 6
    # The real raster's pixel size is 1/120 to within ~3e-11.
    assert aggregation_factor(0.008333333300326923, 0.05) == 6


def test_aggregation_factor_rejects_non_multiple():
    with pytest.raises(ValueError):
        aggregation_factor(0.01, 0.025)
    with pytest.raises(ValueError):
        aggregation_factor(0.1, 0.05)  # cell smaller than a pixel


def test_aggregate_raster_matches_whole_array_block_sum(tmp_path):
    rng = np.random.default_rng(0)
    array = rng.uniform(0, 100, size=(10, 13))  # neither side divisible by 3
    path = tmp_path / "pop.tif"
    write_geotiff(path, array, west=-10.0, north=5.0, pixel_size=0.01)

    # strip_cells=1 forces several strips, including a partial last one.
    pop, transform = aggregate_raster(path, cell_size_deg=0.03, strip_cells=1)

    np.testing.assert_allclose(pop, block_sum(array, 3))
    assert pop.sum() == pytest.approx(array.sum())
    assert (transform.c, transform.f) == (-10.0, 5.0)  # origin unchanged
    assert transform.a == pytest.approx(0.03)
    assert transform.e == pytest.approx(-0.03)


def test_rasterize_countries(two_countries):
    grid = rasterize_countries(two_countries, GRID_TRANSFORM, GRID_SHAPE)
    expected_row = [1, 1, 1, 2, 2, 0]  # country row + 1; 0 = no country
    np.testing.assert_array_equal(grid, np.tile(expected_row, (4, 1)))


def test_rasterize_countries_uses_cell_centres():
    # Top-left cell spans lon 0-1, lat 3-4, so its centre is (0.5, 3.5).
    misses_centre = box(0.1, 3.1, 0.4, 3.4)
    covers_centre = box(0.0, 3.0, 0.6, 4.0)
    for geom, expected in [(misses_centre, 0), (covers_centre, 1)]:
        countries = gpd.GeoDataFrame(geometry=[geom], crs="EPSG:4326")
        assert rasterize_countries(countries, GRID_TRANSFORM, GRID_SHAPE)[0, 0] == expected


def test_cell_centres():
    transform = from_origin(-10, 5, 0.5, 0.5)
    lons, lats = cell_centres(np.array([0, 2]), np.array([0, 3]), transform)
    np.testing.assert_allclose(lons, [-9.75, -8.25])
    np.testing.assert_allclose(lats, [4.75, 3.75])


def test_nearest_country(two_countries):
    lons = np.array([5.3, -0.2, 50.0])  # just east of B, just west of A, far away
    lats = np.array([2.0, 2.0, 2.0])
    nearest = nearest_country(lons, lats, two_countries, METRIC_CRS, max_distance_km=100)
    np.testing.assert_array_equal(nearest, [1, 0, -1])


def test_fill_orphans(two_countries):
    grid = rasterize_countries(two_countries, GRID_TRANSFORM, GRID_SHAPE)
    pop = np.zeros(GRID_SHAPE)
    pop[1, 5] = 50  # populated "sea" cell next to B
    pop[2, 0] = 70  # already in A

    filled = fill_orphans(grid, pop, two_countries, GRID_TRANSFORM, METRIC_CRS, max_distance_km=200)

    assert filled[1, 5] == 2  # snapped to B
    assert filled[0, 5] == 0  # unpopulated sea cell is left alone
    unchanged = np.ones(GRID_SHAPE, dtype=bool)
    unchanged[1, 5] = False
    np.testing.assert_array_equal(filled[unchanged], grid[unchanged])
    assert grid[1, 5] == 0  # input not modified


def test_fill_orphans_respects_max_distance(two_countries):
    grid = rasterize_countries(two_countries, GRID_TRANSFORM, GRID_SHAPE)
    pop = np.zeros(GRID_SHAPE)
    pop[1, 5] = 50  # centre is 0.5 degrees (~55 km) east of B
    filled = fill_orphans(grid, pop, two_countries, GRID_TRANSFORM, METRIC_CRS, max_distance_km=20)
    assert filled[1, 5] == 0


def test_country_populations():
    country_grid = np.array([[1, 1, 0], [2, 2, 2]])
    pop = np.array([[10.0, 20.0, 99.0], [1.0, 2.0, 3.0]])
    totals = country_populations(country_grid, pop, n_countries=3)
    np.testing.assert_array_equal(totals, [30, 6, 0])  # cell with no country left out


def test_select_cells():
    country_grid = np.array([[1, 1, 0], [2, 2, 2]])
    pop = np.array([[100.0, 99.0, 500.0], [400.0, 400.0, 400.0]])
    country_pops = np.array([199.0, 1200.0])

    keep = select_cells(country_grid, pop, country_pops, min_cell_pop=100, min_country_pop=1000)

    # Country 1 is too small, so even its 100-person cell goes; the cell with
    # no country goes; all of country 2's cells pass.
    np.testing.assert_array_equal(keep, [[False, False, False], [True, True, True]])


def test_select_cells_thresholds_are_inclusive():
    country_grid = np.array([[1, 1]])
    pop = np.array([[100.0, 99.9]])
    keep = select_cells(country_grid, pop, np.array([500.0]), min_cell_pop=100, min_country_pop=500)
    np.testing.assert_array_equal(keep, [[True, False]])


def test_round_significant():
    values = np.array([1234.0, 1267.0, 99_999.0, 1000.0, 45_678.9])
    np.testing.assert_array_equal(
        round_significant(values, 2), [1200, 1300, 100_000, 1000, 46_000]
    )


def test_encode_cells():
    assert encode_cells(np.array([5, 6, 10, 7210])) == [5, 1, 4, 7200]


def test_decode_cells_round_trip():
    indices = np.array([0, 3, 4, 100, 25_000_000])
    np.testing.assert_array_equal(decode_cells(encode_cells(indices)), indices)


def test_build_output():
    # Countries listed B first, so sorting by code is tested; C has no kept cells.
    countries = gpd.GeoDataFrame(
        {"code": ["BBB", "AAA", "CCC"], "name": ["B", "A", "C"]},
        geometry=[box(0, 0, 1, 1)] * 3,
        crs="EPSG:4326",
    )
    country_grid = np.array([[1, 2, 2], [1, 3, 2]])
    pop = np.array([[1234.0, 2000.0, 5.0], [3456.0, 999.0, 7777.0]])
    keep = pop >= 1000
    country_pops = np.array([4690.0, 9782.0, 999.0])
    transform = from_origin(-10.0, 50.0, 0.05, 0.05)

    out = build_output(country_grid, pop, keep, countries, country_pops, transform)

    assert out["grid"] == {"west": -10.0, "north": 50.0, "cellSize": 0.05, "cols": 3, "rows": 2}
    assert [c["code"] for c in out["countries"]] == ["AAA", "BBB"]
    a, b = out["countries"]
    assert (a["name"], a["pop"]) == ("A", 9782)
    np.testing.assert_array_equal(decode_cells(a["cells"]), [1, 5])  # row 0 col 1, row 1 col 2
    assert a["cellPops"] == [2000, 7800]
    np.testing.assert_array_equal(decode_cells(b["cells"]), [0, 3])
    assert b["cellPops"] == [1200, 3500]


def test_write_json(tmp_path):
    path = tmp_path / "data" / "grid.json"
    data = {"name": "Curaçao", "cells": [1, 2]}
    text = write_json(data, path)
    assert path.read_bytes() == text
    assert json.loads(text) == data
    assert b" " not in text  # compact


def make_output(countries):
    """Minimal grid.json-like dict: countries as (pop, cellPops) pairs."""
    return {"countries": [{"code": f"C{i}", "pop": pop, "cellPops": cell_pops}
                          for i, (pop, cell_pops) in enumerate(countries)]}


def test_country_shares():
    output = make_output([(100, [100]), (10_000, [10_000])])
    np.testing.assert_allclose(country_shares(output, beta=0), [0.5, 0.5])
    np.testing.assert_allclose(country_shares(output, beta=1), [100 / 10_100, 10_000 / 10_100])
    # beta = 0.5: weights 10 and 100
    np.testing.assert_allclose(country_shares(output, beta=0.5), [10 / 110, 100 / 110])


def test_cell_class_shares():
    # Country 0: cells of 1000 and 3000 people. Country 1: one 50 000 cell.
    output = make_output([(4000, [1000, 3000]), (50_000, [50_000])])
    shares = cell_class_shares(output, alpha=1, beta=0, class_edges=[1000, 2000, 20_000])
    # Each country gets half the rounds; country 0 splits its half 1:3.
    np.testing.assert_allclose(shares, [0.125, 0.375, 0.5])


def test_cell_class_shares_sum_to_one():
    output = make_output([(5000, [1000, 4000]), (1e6, [2000, 30_000, 900_000])])
    shares = cell_class_shares(output, alpha=0.8, beta=0.3, class_edges=[1000, 5000, 100_000])
    assert shares.sum() == pytest.approx(1)
