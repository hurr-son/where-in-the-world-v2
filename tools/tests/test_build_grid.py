import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from build_grid import aggregate_raster, aggregation_factor, block_sum


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
