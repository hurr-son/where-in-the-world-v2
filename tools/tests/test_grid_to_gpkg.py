import numpy as np

from grid_to_gpkg import cell_bounds, grid_to_frame

GRID = {"west": -10.0, "north": 50.0, "cellSize": 0.5, "cols": 4, "rows": 3}


def test_cell_bounds():
    # Cell 0 is the top-left; cell 6 is row 1, column 2.
    west, south, east, north = cell_bounds(np.array([0, 6]), GRID)
    np.testing.assert_allclose(west, [-10.0, -9.0])
    np.testing.assert_allclose(east, [-9.5, -8.5])
    np.testing.assert_allclose(north, [50.0, 49.5])
    np.testing.assert_allclose(south, [49.5, 49.0])


def test_grid_to_frame():
    data = {
        "grid": GRID,
        "countries": [
            {"code": "AAA", "name": "A", "pop": 5000, "cells": [1, 4], "cellPops": [1000, 3000]},
            {"code": "BBB", "name": "B", "pop": 2000, "cells": [11], "cellPops": [2000]},
        ],
    }
    cells = grid_to_frame(data)

    assert list(cells["code"]) == ["AAA", "AAA", "BBB"]
    assert list(cells["cell"]) == [1, 5, 11]  # deltas decoded
    assert list(cells["pop"]) == [1000, 3000, 2000]
    assert cells.crs == "EPSG:4326"
    # Cell 11 is row 2, column 3.
    assert cells.geometry[2].bounds == (-8.5, 48.5, -8.0, 49.0)
