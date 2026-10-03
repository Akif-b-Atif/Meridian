"""Continentality and rainfall seasonality indices."""

from __future__ import annotations

import math


def gorczynski(dt: float, lat: float) -> float:
    """Gorczynski (1920), Geografiska Annaler 2: 324-331. K = 1.7 dT / sin(|lat| + 10 deg) - 14."""
    s = max(math.sin(math.radians(min(abs(lat) + 10, 90))), 0.17)
    return 1.7 * dt / s - 14


def continentality_class(k: float) -> int:
    return 0 if k < 20 else (1 if k <= 50 else 2)


def seasonality(pm: list[float]) -> tuple[float | None, int | None]:
    """Walsh and Lawler (1981) seasonality index and its class 0 to 6."""
    r = sum(pm)
    if r < 25:
        return None, None
    si = sum(abs(x - r / 12) for x in pm) / r
    bounds = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2]
    return round(si, 2), sum(1 for b in bounds if si >= b)
