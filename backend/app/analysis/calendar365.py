"""The 365-day calendar used by every climate statistic (Feb 29 merged into Feb 28)."""

from __future__ import annotations

from datetime import date

import numpy as np
from numpy.typing import NDArray

MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTH_START = np.concatenate([[0], np.cumsum(MONTH_DAYS)])  # 0-based start index of each month
DOY_EQUINOX_MAR, DOY_SOLSTICE_JUN, DOY_EQUINOX_SEP, DOY_SOLSTICE_DEC = 79, 172, 265, 355
MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]  # fmt: skip


def window_end_year(today: date) -> int:
    """ERA5 lags by about five days, so 31 December is only complete after 15 January."""
    return today.year - 1 if (today.month, today.day) >= (1, 15) else today.year - 2


def to_grid(
    dates: list[str], values: list[float | None], first_year: int, last_year: int, *, mode: str
) -> NDArray[np.float64]:
    """Reshape a daily series into a (years, 365) matrix. mode: 'mean' or 'sum' for Feb 29."""
    n_years = last_year - first_year + 1
    grid = np.full((n_years, 365), np.nan)
    leap_vals: dict[int, float] = {}
    for d, v in zip(dates, values, strict=True):
        y, m, day = int(d[:4]), int(d[5:7]), int(d[8:10])
        if v is None or not (first_year <= y <= last_year):
            continue
        if m == 2 and day == 29:
            leap_vals[y] = float(v)
            continue
        doy = int(MONTH_START[m - 1]) + day
        grid[y - first_year, doy - 1] = float(v)
    for y, v in leap_vals.items():
        cur = grid[y - first_year, 58]  # Feb 28 is doy 59
        if mode == "sum":
            grid[y - first_year, 58] = v if np.isnan(cur) else cur + v
        else:
            grid[y - first_year, 58] = v if np.isnan(cur) else (cur + v) / 2
    return grid


def doy_to_label(doy: int) -> str:
    m = int(np.searchsorted(MONTH_START[1:], doy - 1, side="right"))
    return f"{MONTH_NAMES[m][:3]} {doy - int(MONTH_START[m])}"


def month_slices() -> list[slice]:
    return [slice(int(MONTH_START[i]), int(MONTH_START[i + 1])) for i in range(12)]


def circular_mean_filter(x: NDArray[np.float64], width: int) -> NDArray[np.float64]:
    half = width // 2
    ext = np.concatenate([x[-half:], x, x[:half]])
    kernel = np.ones(width) / width
    return np.convolve(ext, kernel, mode="valid")
