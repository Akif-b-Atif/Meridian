"""Annual harmonic fit, seasonal lag and bootstrap uncertainty (SDS 8.3.4)."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from numpy.typing import NDArray

from .calendar365 import DOY_SOLSTICE_DEC, DOY_SOLSTICE_JUN, circular_mean_filter

P = 365.2425
D = np.arange(1, 366, dtype=float)
_ANGLE = 2 * math.pi * D / P
DESIGN = np.column_stack([np.ones(365), np.cos(_ANGLE), np.sin(_ANGLE)])
PINV = np.linalg.pinv(DESIGN)


def wrap(x: float | NDArray[np.float64]) -> Any:
    """Map a day offset into the interval [-P/2, +P/2)."""
    return (x + P / 2) % P - P / 2


def _wrap_doy(x: float) -> float:
    return 1 + ((x - 1) % P)


def fit(clim: NDArray[np.float64]) -> tuple[float, float, float, float]:
    """Return (mean, a, b, amplitude) for T(d) = M + a cos + b sin."""
    m, a, b = PINV @ clim
    return float(m), float(a), float(b), float(math.hypot(a, b))


def peak_day(a: float, b: float) -> float:
    return _wrap_doy((P / (2 * math.pi)) * math.atan2(b, a))


def analyse_cycle(
    window: NDArray[np.float64], hemisphere: str, seed: int, n_boot: int = 500
) -> dict[str, Any]:
    """window: (30, 365) daily mean temperature for the normals window."""
    clim = np.nanmean(window, axis=0)
    _, a, b, amp = fit(clim)
    out: dict[str, Any] = {
        "mode": "ok",
        "amplitude": round(amp, 1),
        "peakDoy": None,
        "troughDoy": None,
        "peakLagDays": None,
        "troughLagDays": None,
        "peakLagCi": None,
        "lagCheck": None,
    }
    if amp < 2.0:
        out["mode"] = "weak"
        return out
    peak = peak_day(a, b)
    trough = _wrap_doy(peak + P / 2)
    warm, cold = (
        (DOY_SOLSTICE_JUN, DOY_SOLSTICE_DEC)
        if hemisphere == "N"
        else (DOY_SOLSTICE_DEC, DOY_SOLSTICE_JUN)
    )
    peak_lag = float(wrap(peak - warm))
    trough_lag = float(wrap(trough - cold))

    smooth = circular_mean_filter(clim, 31)
    emp_peak = float(np.argmax(smooth) + 1)
    check = "disagree" if abs(float(wrap(emp_peak - peak))) > 10 else "ok"

    # Bootstrap over years, all fits in one matrix product.
    rng = np.random.default_rng(seed)
    filled = np.where(np.isnan(window), clim[None, :], window)
    idx = rng.integers(0, filled.shape[0], size=(n_boot, filled.shape[0]))
    boot_clim = filled[idx].mean(axis=1)  # (n_boot, 365)
    coefs = boot_clim @ PINV.T  # (n_boot, 3)
    boot_peaks = np.array([peak_day(c[1], c[2]) for c in coefs])
    offsets = wrap(boot_peaks - peak)
    lo, hi = np.percentile(offsets, [5, 95])
    out.update(
        peakDoy=round(peak),
        troughDoy=round(trough),
        peakLagDays=round(peak_lag),
        troughLagDays=round(trough_lag),
        peakLagCi=[round(peak_lag + lo), round(peak_lag + hi)],
        lagCheck=check,
    )
    return out
