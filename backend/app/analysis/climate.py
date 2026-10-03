"""Assemble the climate payload from daily ERA5 series (SDS 8.3)."""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.typing import NDArray

from . import extremes as ext
from . import harmonic, indices, koppen, trend
from .calendar365 import MONTH_DAYS, circular_mean_filter, month_slices, to_grid
from .solar import daylight_hours

SEASON_MONTHS = {
    "N": {"winter": (12, 1, 2), "spring": (3, 4, 5), "summer": (6, 7, 8), "autumn": (9, 10, 11)},
    "S": {"winter": (6, 7, 8), "spring": (9, 10, 11), "summer": (12, 1, 2), "autumn": (3, 4, 5)},
}
SEASON_ORDER = ["winter", "spring", "summer", "autumn"]


def _r(x: float, n: int = 1) -> float:
    return round(float(x), n)


def _nz(x: float) -> float | None:
    return None if x is None or not np.isfinite(x) else float(x)


def _stats(
    name: str,
    months: list[int],
    tmean_m: NDArray[np.float64],
    tmax_m: NDArray[np.float64],
    tmin_m: NDArray[np.float64],
    pm: NDArray[np.float64],
    sun_m: NDArray[np.float64] | None,
) -> dict[str, Any]:
    idx = [m - 1 for m in months]
    w = np.array([MONTH_DAYS[i] for i in idx], float)
    sun = None if sun_m is None else _nz(np.average(sun_m[idx], weights=w))
    return {
        "name": name,
        "firstMonth": months[0],
        "days": int(w.sum()),
        "tmean": _r(np.average(tmean_m[idx], weights=w)),
        "tmax": _r(np.average(tmax_m[idx], weights=w)),
        "tmin": _r(np.average(tmin_m[idx], weights=w)),
        "precip": _r(pm[idx].sum(), 0),
        "sunHoursPerDay": None if sun is None else _r(sun),
    }


def _circular_run(flags: list[bool]) -> dict[str, int] | None:
    n = len(flags)
    if not any(flags):
        return None
    if all(flags):
        return {"start": 1, "length": n}
    start = next(i for i in range(n) if flags[i] and not flags[i - 1])
    best = (0, 0)
    for s in range(n):
        if flags[s] and not flags[s - 1]:
            ln = 0
            while flags[(s + ln) % n]:
                ln += 1
            if ln > best[1]:
                best = (s, ln)
    start = best[0]
    return {"start": start + 1, "length": best[1]}


def analyse_climate(
    a_dates: list[str],
    a_tmean: list[float | None],
    b_dates: list[str],
    b_vars: dict[str, list[float | None]],
    end_year: int,
    lat: float,
    seed: int,
    n_boot: int = 500,
    trend_start: int = 1950,
    years: int = 30,
) -> dict[str, Any]:
    hemi = "S" if lat < 0 else "N"
    w0 = end_year - years + 1
    gm = to_grid(a_dates, a_tmean, trend_start, end_year, mode="mean")
    gmax = to_grid(b_dates, b_vars["temperature_2m_max"], w0, end_year, mode="mean")
    gmin = to_grid(b_dates, b_vars["temperature_2m_min"], w0, end_year, mode="mean")
    gp = to_grid(b_dates, b_vars["precipitation_sum"], w0, end_year, mode="sum")
    sun_raw = b_vars.get("sunshine_duration")
    gs = to_grid(b_dates, sun_raw, w0, end_year, mode="mean") if sun_raw else None
    if gs is not None and np.isnan(gs).all():
        gs = None
    gm_win = gm[w0 - trend_start :]

    sl = month_slices()
    clim_mean = np.nanmean(gm_win, axis=0)
    clim_max = np.nanmean(gmax, axis=0)
    clim_min = np.nanmean(gmin, axis=0)
    np.nanmean(gp, axis=0)
    clim_s = np.nanmean(gs, axis=0) if gs is not None else None

    tm = np.array([clim_mean[s].mean() for s in sl])
    tmax_m = np.array([clim_max[s].mean() for s in sl])
    tmin_m = np.array([clim_min[s].mean() for s in sl])
    # Monthly precipitation totals: only years where the month is complete.
    pm = np.array(
        [
            np.nanmean(np.where(np.isnan(gp[:, s]).any(axis=1), np.nan, gp[:, s].sum(axis=1)))
            for s in sl
        ]
    )
    wet_days = np.array([np.nanmean(np.nansum(gp[:, s] >= 1, axis=1)) for s in sl])
    sun_m = None if clim_s is None else np.array([clim_s[s].mean() / 3600 for s in sl])

    weights = np.array(MONTH_DAYS, float)
    mat = float(np.average(tm, weights=weights))
    map_ = float(pm.sum())
    dt = float(tm.max() - tm.min())
    smooth = circular_mean_filter(clim_mean, 15)

    # Seasons
    if dt >= 3.0:
        mode = "thermal"
        seasons = [
            _stats(n, list(SEASON_MONTHS[hemi][n]), tm, tmax_m, tmin_m, pm, sun_m)
            for n in SEASON_ORDER
        ]
        wetdry = None
    else:
        mode = "wetdry"
        mean_p = map_ / 12
        wet = [bool(p > mean_p) for p in pm]
        seasons = []
        for name, flag in (("wet", True), ("dry", False)):
            months = [i + 1 for i in range(12) if wet[i] == flag]
            if months:
                seasons.append(_stats(name, months, tm, tmax_m, tmin_m, pm, sun_m))
        wetdry = {
            "wet": wet,
            "wetRun": _circular_run(wet),
            "dryRun": _circular_run([not x for x in wet]),
        }

    # Daylight / sunshine share
    hours = daylight_hours(lat)
    sun_pct_monthly: list[float | None] | None = None
    sun_hours = sun_pct = None
    if clim_s is not None:
        possible = [float(hours[s].sum()) for s in sl]
        actual = [float(clim_s[s].sum() / 3600) for s in sl]
        sun_pct_monthly = [
            None if p <= 0 else _r(100 * a / p) for a, p in zip(actual, possible, strict=True)
        ]
        sun_hours = _r(sum(actual), 0)
        tot_p = sum(possible)
        sun_pct = None if tot_p <= 0 else _r(100 * sum(actual) / tot_p, 0)

    cycle = harmonic.analyse_cycle(gm_win, hemi, seed, n_boot)
    kop = koppen.classify(tm.tolist(), pm.tolist(), hemi)

    # Trend
    yrs = list(range(trend_start, end_year + 1))
    ann = trend.annual_means(gm)
    t_ann = trend.trend(yrs, ann)
    season_trends = []
    for n in SEASON_ORDER:
        ms = SEASON_MONTHS[hemi][n]
        t = trend.trend(yrs, trend.season_year_means(gm, ms))
        if t:
            t = {k: v for k, v in t.items() if not k.startswith("_")}
        season_trends.append({"season": n, "trend": t})
    annual_trend = None
    if t_ann:
        annual_trend = {k: v for k, v in t_ann.items() if not k.startswith("_")}
    anom, base_mean, limit = trend.anomalies(yrs, ann)
    decades = trend.decade_means(yrs, ann)

    # Extremes
    counts = ext.threshold_counts(gmax, gmin, gp)
    hw = ext.heatwaves(gmax, w0)
    means = {
        k: _r(np.mean([v for v in vs if v is not None]), 1)
        if any(v is not None for v in vs)
        else 0.0
        for k, vs in counts.items()
    }

    k = indices.gorczynski(dt, lat)
    si, sic = indices.seasonality(pm.tolist())

    hot_m, cold_m = int(np.argmax(tm)) + 1, int(np.argmin(tm)) + 1
    return {
        "dataWindow": {"trendStart": trend_start, "normalsStart": w0, "end": end_year},
        "hemisphere": hemi,
        "seasonMode": mode,
        "seasons": seasons,
        "wetDry": wetdry,
        "monthly": {
            "tmean": [_r(x) for x in tm],
            "tmax": [_r(x) for x in tmax_m],
            "tmin": [_r(x) for x in tmin_m],
            "precip": [_r(x, 0) for x in pm],
            "wetDays": [_r(x) for x in wet_days],
            "sunHoursPerDay": None if sun_m is None else [_r(x) for x in sun_m],
        },
        "annual": {
            "mat": _r(mat),
            "map": _r(map_, 0),
            "dT": _r(dt),
            "sunHours": sun_hours,
            "sunPercent": sun_pct,
            "hottestMonth": hot_m,
            "coldestMonth": cold_m,
            "hottestDoy": int(np.argmax(smooth)) + 1,
            "coldestDoy": int(np.argmin(smooth)) + 1,
        },
        "sunPercentMonthly": sun_pct_monthly,
        "dailyMeanSmooth": [_r(x) for x in smooth],
        "cycle": cycle,
        "koppen": kop,
        "trend": {"annual": annual_trend, "seasons": season_trends},
        "annualMean": [None if v is None else _r(v, 2) for v in ann],
        "annualAnomaly": anom,
        "baseline": {"start": 1961, "end": 1990, "mean": base_mean},
        "stripesLimit": limit,
        "decades": decades,
        "extremes": {
            "years": hw["years"],
            **counts,
            "means": means,
            "heatwave": {
                "events": hw["events"],
                "days": hw["days"],
                "first15": hw["first15"],
                "last15": hw["last15"],
            },
        },
        "indices": {
            "gorczynskiK": _r(k),
            "continentality": indices.continentality_class(k),
            "seasonalityIndex": si,
            "seasonalityClass": sic,
        },
    }
