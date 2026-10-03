from __future__ import annotations

import time
from pathlib import Path

import numpy as np
import pytest
from pyproj import Geod, Transformer
from shapely.geometry import LineString, Point

from app.analysis.water import WaterIndex

INDEX = Path(__file__).resolve().parents[2] / "app" / "data" / "water_index.gpkg"
GEOD = Geod(ellps="WGS84")


def test_synthetic_antimeridian_and_pole() -> None:
    coast = [
        (LineString([(179.9, -10), (179.9, 10)]), "East"),
        (LineString([(-120, 0), (-119, 0)]), "Far"),
    ]
    idx = WaterIndex.from_lines({"coast": coast})
    hit = idx.nearest("coast", 0.0, -179.9)  # 0.2 degrees away across the antimeridian
    assert hit and hit["name"] == "East" and hit["km"] < 25
    assert idx.nearest("lake", 0, 0) is None
    pole = WaterIndex.from_lines({"coast": [(LineString([(0, 80), (90, 80)]), "Arctic")]})
    h = pole.nearest("coast", 89.9, 10)
    assert h and h["km"] < 1200


def test_bound_matches_brute_force() -> None:
    rng = np.random.default_rng(7)
    lines = []
    for _ in range(300):
        x, y = rng.uniform(-179, 179), rng.uniform(-80, 80)
        lines.append((LineString([(x, y), (x + rng.uniform(-2, 2), y + rng.uniform(-2, 2))]), None))
    idx = WaterIndex.from_lines({"coast": lines})
    for _ in range(40):
        lat, lon = rng.uniform(-80, 80), rng.uniform(-179, 179)
        got = idx.nearest("coast", lat, lon)
        assert got is not None
        tr = Transformer.from_crs(
            "EPSG:4326",
            f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m",
            always_xy=True,
        )
        brute = (
            min(
                LineString(np.column_stack(tr.transform(*np.asarray(g.coords).T))).distance(
                    Point(0, 0)
                )
                for g, _ in lines
            )
            / 1000
        )
        assert got["km"] == pytest.approx(brute, rel=0.01, abs=0.5)


@pytest.mark.skipif(not INDEX.exists(), reason="water index has not been built")
def test_real_index() -> None:
    t = time.time()
    idx = WaterIndex.load(INDEX)
    assert time.time() - t < 10
    cairo = idx.payload(30.0444, 31.2357)
    assert cairo["coastClass"] == "inland" and cairo["coast"]["km"] > 100
    assert cairo["river"] and cairo["river"]["km"] < 5  # the Nile
    sg = idx.payload(1.3521, 103.8198)
    assert sg["coastClass"] == "coastal"
    sydney = idx.payload(-33.8688, 151.2093)
    assert sydney["coastClass"] == "coastal" and sydney["coast"]["bearingDeg"] is not None
    moscow = idx.payload(55.7558, 37.6173)
    assert moscow["coastClass"] == "inland" and moscow["coast"]["km"] > 500
    assert moscow["river"] is not None
