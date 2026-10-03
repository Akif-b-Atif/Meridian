"""Daylight length from the NOAA solar declination series (SDS 8.4)."""

from __future__ import annotations

import math
from typing import Any

import numpy as np


def daylight_hours(lat: float) -> np.ndarray:
    phi = math.radians(max(-89.99, min(89.99, lat)))
    n = np.arange(1, 366)
    g = 2 * math.pi * (n - 1) / 365
    decl = (
        0.006918 - 0.399912 * np.cos(g) + 0.070257 * np.sin(g) - 0.006758 * np.cos(2 * g)
        + 0.000907 * np.sin(2 * g) - 0.002697 * np.cos(3 * g) + 0.00148 * np.sin(3 * g)
    )  # fmt: skip
    cos_h = math.cos(math.radians(90.833)) / (math.cos(phi) * np.cos(decl)) - math.tan(
        phi
    ) * np.tan(decl)
    hours = np.where(
        cos_h > 1,
        0.0,
        np.where(cos_h < -1, 24.0, 2 * np.degrees(np.arccos(np.clip(cos_h, -1, 1))) / 15),
    )
    return np.asarray(hours)


def solar_payload(lat: float) -> dict[str, Any]:
    h = daylight_hours(lat)
    longest, shortest = int(np.argmax(h)) + 1, int(np.argmin(h)) + 1
    return {
        "lat": round(lat, 4),
        "daylight365": [round(float(x), 2) for x in h],
        "reference": [{"doy": d, "hours": round(float(h[d - 1]), 2)} for d in (79, 172, 265, 355)],
        "longestDay": {"doy": longest, "hours": round(float(h[longest - 1]), 2)},
        "shortestDay": {"doy": shortest, "hours": round(float(h[shortest - 1]), 2)},
        "polarDayCount": int(np.sum(h >= 24)),
        "polarNightCount": int(np.sum(h <= 0)),
    }
