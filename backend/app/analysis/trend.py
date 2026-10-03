"""Theil-Sen and Kendall trend statistics, anomalies and decade means (SDS 8.3.6)."""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.typing import NDArray


def annual_means(grid: NDArray[np.float64]) -> list[float | None]:
    out: list[float | None] = []
    for row in grid:
        out.append(float(np.nanmean(row)) if np.sum(~np.isnan(row)) >= 329 else None)
    return out


def season_year_means(
    grid: NDArray[np.float64], months: tuple[int, int, int]
) -> list[float | None]:
    """Mean of three calendar months per year. A December in the tuple belongs to the previous year."""
    from .calendar365 import month_slices

    sl = month_slices()
    out: list[float | None] = []
    for y in range(grid.shape[0]):
        vals: list[float] = []
        ok = True
        for m in months:
            yy = y - 1 if (m == 12 and months[0] == 12) else y
            if yy < 0:
                ok = False
                break
            seg = grid[yy, sl[m - 1]]
            if np.isnan(seg).any():
                ok = False
                break
            vals.extend(seg.tolist())
        out.append(float(np.mean(vals)) if ok and vals else None)
    return out


def trend(years: list[int], values: list[float | None]) -> dict[str, Any] | None:
    from scipy import stats

    xs = np.array([y for y, v in zip(years, values, strict=True) if v is not None], float)
    ys = np.array([v for v in values if v is not None], float)
    if len(xs) < 10:
        return None
    res = stats.theilslopes(ys, xs, alpha=0.95)
    tau, p = stats.kendalltau(xs, ys)
    return {
        "n": len(xs),
        "slopePerYear": round(float(res.slope), 3),
        "slopeLo": round(float(res.low_slope), 3),
        "slopeHi": round(float(res.high_slope), 3),
        "perDecade": round(float(res.slope) * 10, 2),
        "tau": round(float(tau), 3),
        "p": round(float(p), 3),
        "significant": bool(p < 0.05),
        "_intercept_x": float(np.median(xs)),
        "_intercept_y": float(np.median(ys)),
    }


def anomalies(
    years: list[int], means: list[float | None]
) -> tuple[list[float | None], float | None, float]:
    base = [m for y, m in zip(years, means, strict=True) if 1961 <= y <= 1990 and m is not None]
    if len(base) < 25:
        return [None] * len(means), None, 1.0
    b = float(np.mean(base))
    an = [None if m is None else round(m - b, 2) for m in means]
    vals = [abs(a) for a in an if a is not None]
    mx = max(vals) if vals else 0.5
    import math

    return an, round(b, 2), max(1.0, math.ceil(2 * mx) / 2)


def decade_means(years: list[int], means: list[float | None]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for dec in range(years[0] // 10 * 10, years[-1] + 1, 10):
        vals = [
            m for y, m in zip(years, means, strict=True) if dec <= y < dec + 10 and m is not None
        ]
        if len(vals) >= 3:
            out.append({"decade": dec, "mean": round(float(np.mean(vals)), 2), "years": len(vals)})
    return out
