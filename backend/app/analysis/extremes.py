"""Threshold days and heatwaves (SDS 8.3.7)."""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.typing import NDArray


def _yearly_count(mask: NDArray[np.bool_], present: NDArray[np.bool_]) -> list[int | None]:
    out: list[int | None] = []
    for m, p in zip(mask, present, strict=True):
        n = int(p.sum())
        out.append(None if n < 347 else round(int((m & p).sum()) * 365 / n))
    return out


def threshold_counts(
    tmax: NDArray[np.float64], tmin: NDArray[np.float64], precip: NDArray[np.float64]
) -> dict[str, list[int | None]]:
    with np.errstate(invalid="ignore"):
        return {
            "hot30": _yearly_count(tmax >= 30, ~np.isnan(tmax)),
            "hot35": _yearly_count(tmax >= 35, ~np.isnan(tmax)),
            "frost": _yearly_count(tmin < 0, ~np.isnan(tmin)),
            "wet": _yearly_count(precip >= 1, ~np.isnan(precip)),
        }


def heatwave_thresholds(tmax: NDArray[np.float64]) -> NDArray[np.float64]:
    """90th percentile for each calendar day over a circular +-2 day window, all years."""
    n_years = tmax.shape[0]
    thr = np.empty(365)
    for d in range(365):
        cols = [(d + k) % 365 for k in range(-2, 3)]
        vals = tmax[:, cols].ravel()
        vals = vals[~np.isnan(vals)]
        thr[d] = np.percentile(vals, 90) if len(vals) else np.nan
    _ = n_years
    return thr


def heatwaves(tmax: NDArray[np.float64], first_year: int) -> dict[str, Any]:
    n_years = tmax.shape[0]
    thr = heatwave_thresholds(tmax)
    with np.errstate(invalid="ignore"):
        hot = (tmax > thr[None, :]).ravel()  # NaN compares False, ending a run
    events = np.zeros(n_years, int)
    days = np.zeros(n_years, int)
    i, n = 0, hot.size
    while i < n:
        if not hot[i]:
            i += 1
            continue
        j = i
        while j < n and hot[j]:
            j += 1
        if j - i >= 3:
            y = i // 365
            events[y] += 1
            days[y] += j - i
        i = j
    half = min(15, n_years // 2)
    return {
        "events": events.tolist(),
        "days": days.tolist(),
        "first15": {
            "events": round(float(events[:half].mean()), 1),
            "days": round(float(days[:half].mean()), 1),
        },
        "last15": {
            "events": round(float(events[-half:].mean()), 1),
            "days": round(float(days[-half:].mean()), 1),
        },
        "years": list(range(first_year, first_year + n_years)),
    }
