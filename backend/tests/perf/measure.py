"""Standalone measurement run in a fresh process by test_memory.py."""

from __future__ import annotations

import resource
import time
from datetime import date, timedelta
from pathlib import Path

import numpy as np

from app.analysis.climate import analyse_climate
from app.analysis.water import WaterIndex
from app.main import create_app

INDEX = Path(__file__).resolve().parents[2] / "app" / "data" / "water_index.gpkg"


def main() -> None:
    create_app()
    t0 = time.time()
    if INDEX.exists():
        WaterIndex.load(INDEX)
    load_s = time.time() - t0
    days = [
        date(1950, 1, 1) + timedelta(days=i)
        for i in range((date(2025, 12, 31) - date(1950, 1, 1)).days + 1)
    ]
    rng = np.random.default_rng(0)
    doy = np.array([min(d.timetuple().tm_yday, 365) for d in days])
    vals = (10 + 8 * np.cos(2 * np.pi * doy / 365) + rng.normal(0, 2, len(days))).tolist()
    iso = [d.isoformat() for d in days]
    cut = next(i for i, d in enumerate(iso) if d >= "1996-01-01")
    tail = vals[cut:]
    b = {
        "temperature_2m_max": [v + 4 for v in tail],
        "temperature_2m_min": [v - 4 for v in tail],
        "precipitation_sum": [2.0] * len(tail),
        "sunshine_duration": [20000.0] * len(tail),
    }
    t1 = time.time()
    analyse_climate(iso, vals, iso[cut:], b, 2025, 40.0, 1)
    print(
        f"{resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024:.0f} {load_s:.2f} {time.time() - t1:.2f}"
    )


if __name__ == "__main__":
    main()
