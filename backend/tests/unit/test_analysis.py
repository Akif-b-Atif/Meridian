from __future__ import annotations

import math
from datetime import date

import numpy as np
import pytest
from shapely.geometry import box

from app.analysis import air, extremes, harmonic, indices, koppen, seismic, solar, trend
from app.analysis.calendar365 import doy_to_label, to_grid, window_end_year
from app.analysis.climate import analyse_climate
from app.analysis.geometry import circle_payload, geodesic_area_km2, process_polygon

KOPPEN_VECTORS = [
    ("Af", [26] * 12, [200] * 12),
    ("Aw", [27] * 12, [10, 10, 10, 10, 100, 200, 200, 200, 200, 100, 10, 10]),
    ("Am", [27] * 12, [50, 50, 100, 200, 300, 400, 400, 400, 400, 300, 200, 100]),
    ("BWh", [14, 16, 20, 25, 30, 34, 36, 35, 32, 27, 20, 15], [3, 3, 3, 2, 1, 0, 0, 0, 0, 1, 2, 3]),
    ("Cfb", [4, 5, 7, 9, 13, 16, 18, 18, 15, 11, 7, 5], [60] * 12),
    ("Dfb", [-10, -8, -2, 5, 11, 16, 19, 18, 12, 5, -2, -8], [50] * 12),
    ("ET", [-20, -18, -14, -8, -2, 3, 6, 5, 1, -6, -14, -19], [30] * 12),
    ("Cfa", [8, 9, 12, 16, 21, 25, 28, 28, 24, 18, 13, 9], [90] * 12),
    (
        "Csa",
        [10, 11, 13, 16, 20, 24, 27, 27, 24, 19, 14, 11],
        [90, 80, 70, 50, 30, 10, 2, 5, 30, 60, 90, 100],
    ),
]


@pytest.mark.parametrize(("code", "t", "p"), KOPPEN_VECTORS)
def test_koppen_vectors(code: str, t: list[float], p: list[float]) -> None:
    assert koppen.classify(t, p, "N")["code"] == code


def test_koppen_boundaries() -> None:
    flat_p = [60.0] * 12
    assert koppen.classify([10.0] * 12, flat_p)["code"][0] != "E"  # Thot == 10 is not E
    assert koppen.classify([18.0] * 12, flat_p)["code"][0] == "A"  # Tcold == 18 is A
    t = [0, 2, 6, 10, 14, 18, 20, 19, 15, 10, 5, 2]
    assert koppen.classify(t, flat_p)["code"][0] == "D"  # Tcold == 0 is D


def test_window_end_year() -> None:
    assert window_end_year(date(2026, 1, 14)) == 2024
    assert window_end_year(date(2026, 1, 15)) == 2025
    assert window_end_year(date(2026, 7, 1)) == 2025


def test_feb29_merge() -> None:
    dates = ["2020-02-28", "2020-02-29", "2020-03-01"]
    g = to_grid(dates, [10.0, 20.0, 5.0], 2020, 2020, mode="mean")
    assert g[0, 58] == 15.0
    g2 = to_grid(dates, [1.0, 2.0, 5.0], 2020, 2020, mode="sum")
    assert g2[0, 58] == 3.0
    assert doy_to_label(172) == "Jun 21"


def _sinusoid(peak: float, amp: float = 8.0, years: int = 30, noise: float = 0.0) -> np.ndarray:
    d = np.arange(1, 366)
    base = 10 + amp * np.cos(2 * np.pi * (d - peak) / 365.2425)
    rng = np.random.default_rng(1)
    return base[None, :] + rng.normal(0, noise, (years, 365))


def test_harmonic_peak_and_amplitude() -> None:
    out = harmonic.analyse_cycle(_sinusoid(200), "N", seed=1, n_boot=100)
    assert abs(out["peakDoy"] - 200) <= 1
    assert abs(out["amplitude"] - 8.0) <= 0.1
    assert out["peakLagDays"] == out["peakDoy"] - 172
    assert out["lagCheck"] == "ok"
    s = harmonic.analyse_cycle(_sinusoid(10), "S", seed=1, n_boot=100)
    assert s["peakLagDays"] == 10 - 355 + 365 or abs(s["peakLagDays"] - 20) <= 1


def test_weak_cycle_and_wrap() -> None:
    assert harmonic.analyse_cycle(_sinusoid(200, amp=1.5), "N", 1, 50)["mode"] == "weak"
    assert harmonic.wrap(200.0) == pytest.approx(200 - harmonic.P)
    assert harmonic.wrap(-200.0) == pytest.approx(-200 + harmonic.P)


def test_bootstrap_deterministic() -> None:
    w = _sinusoid(190, noise=1.5)
    a = harmonic.analyse_cycle(w, "N", 42, 200)["peakLagCi"]
    b = harmonic.analyse_cycle(w, "N", 42, 200)["peakLagCi"]
    assert a == b
    assert a[0] <= 190 - 172 <= a[1] + 3


def test_trend_exact_line() -> None:
    yrs = list(range(1950, 2000))
    vals = [10 + 0.03 * (y - 1950) for y in yrs]
    t = trend.trend(yrs, vals)
    assert t is not None
    assert t["slopePerYear"] == pytest.approx(0.03, abs=1e-3)
    assert t["tau"] == 1.0
    flat = trend.trend(yrs, [10.0 + (i % 2) * 0.1 for i in range(50)])
    assert flat is not None
    assert abs(flat["slopePerYear"]) < 0.01


def test_annual_means_exclude_short_years() -> None:
    g = np.full((2, 365), 10.0)
    g[1, :40] = np.nan
    assert trend.annual_means(g) == [10.0, None]


def test_djf_uses_previous_december() -> None:
    g = np.zeros((2, 365))
    g[0, 334:] = 10  # Dec of year 0
    vals = trend.season_year_means(g, (12, 1, 2))
    assert vals[0] is None
    assert vals[1] == pytest.approx(10 * 31 / 90)


def test_heatwave_runs() -> None:
    tmax = np.full((30, 365), 20.0)
    tmax[:, :] += np.random.default_rng(0).normal(0, 0.01, (30, 365))
    tmax[5, 100:103] = 50.0  # three days: one event
    tmax[6, 200:202] = 50.0  # two days: none
    hw = extremes.heatwaves(tmax, 1996)
    assert hw["events"][5] == 1
    assert hw["events"][6] == 0


def test_threshold_scaling() -> None:
    tmax = np.full((1, 365), 31.0)
    tmax[0, :15] = np.nan  # 350 present
    out = extremes.threshold_counts(tmax, tmax, tmax)
    assert out["hot30"][0] == 365


def test_indices() -> None:
    assert indices.gorczynski(20, 45) == pytest.approx(
        1.7 * 20 / math.sin(math.radians(55)) - 14, abs=0.1
    )
    assert indices.seasonality([10.0] * 12) == (0.0, 0)
    si, _ = indices.seasonality([0.0] * 11 + [120.0])
    assert si == pytest.approx(1.83, abs=0.01)
    assert indices.seasonality([1.0] * 12) == (None, None)


def test_solar_reference() -> None:
    london = solar.solar_payload(51.5074)
    h172 = london["reference"][1]["hours"]
    assert abs(h172 - 16.63) < 0.2  # about 16 h 38 min
    reyk = solar.solar_payload(64.1466)
    assert abs(reyk["reference"][1]["hours"] - 21.1) < 0.3
    sg = solar.solar_payload(1.3521)
    assert abs(sg["reference"][1]["hours"] - 12.1) < 0.2
    pole = solar.solar_payload(78.0)
    assert pole["polarDayCount"] > 0 and pole["polarNightCount"] > 0
    assert solar.solar_payload(90.0)["lat"] == 90.0


def test_poisson_interval() -> None:
    lo, hi = seismic.poisson_interval(0)
    assert (lo, round(hi, 3)) == (0.0, 2.996)
    lo, hi = seismic.poisson_interval(10)
    assert round(lo, 2) == 5.43 and round(hi, 2) == 16.96


def test_activity_class_boundaries() -> None:
    th = [0.05, 0.3, 1.5, 6]
    assert seismic.activity_class(0, 0, th) == 0
    assert seismic.activity_class(0.049, 5, th) == 1
    assert seismic.activity_class(0.05, 5, th) == 2
    assert seismic.activity_class(6, 5, th) == 5


def test_haversine() -> None:
    assert seismic.haversine_km(51.5074, -0.1278, 48.8566, 2.3522) == pytest.approx(343.6, abs=2)


def test_b_value_synthetic() -> None:
    rng = np.random.default_rng(3)
    mags = np.round(4.45 + rng.exponential(1 / (1.0 * math.log(10)), 5000), 1)
    mags = mags[mags >= 4.5]
    events = [
        {
            "mag": float(m),
            "lat": 0.0,
            "lon": 0.0,
            "depth": 10.0,
            "time": "2000-01-01T00:00:00",
            "year_dec": 2000.0,
            "id": f"e{i}",
            "magType": "mb",
            "place": "x",
        }
        for i, m in enumerate(mags)
    ]
    out = seismic.analyse(
        events, 0, 0, 300, date(1973, 1, 1), date(2025, 1, 1), [0.05, 0.3, 1.5, 6]
    )
    assert out["b"] is not None
    assert abs(out["b"] - 1.0) < 0.1


def test_small_catalogue_has_no_b() -> None:
    events = [
        {
            "mag": 4.6,
            "lat": 0.0,
            "lon": 0.0,
            "depth": 5.0,
            "time": "2001-01-01T00:00:00",
            "year_dec": 2001.0,
            "id": "a",
            "magType": "mb",
            "place": "x",
        }
    ]
    out = seismic.analyse(
        events, 0, 0, 100, date(1973, 1, 1), date(2025, 1, 1), [0.05, 0.3, 1.5, 6]
    )
    assert out["b"] is None and out["recurrence"] is None


def test_decimate_limit() -> None:
    ev = [{"mag": 4.5 + (i % 10) / 10, "t": 1973 + i / 100} for i in range(10000)]
    out = seismic.decimate(ev)
    assert len(out) <= 1500
    assert out == seismic.decimate(ev)


def test_geodesic_area() -> None:
    a = geodesic_area_km2(box(0, 0, 1, 1))
    assert abs(a - 12308) / 12308 < 0.01


def test_polygon_processing() -> None:
    gj = {"type": "Polygon", "coordinates": [[[0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2], [0, 0]]]}
    ok = process_polygon(gj, 0.1, 0.1, None)
    assert ok and ok["kind"] == "polygon"
    assert process_polygon(gj, 5.0, 5.0, None) is None  # far from point
    assert process_polygon(gj, 0.1, 0.1, 5.0) is None  # area ratio off
    wide = {
        "type": "Polygon",
        "coordinates": [[[-100, 0], [100, 0], [100, 10], [-100, 10], [-100, 0]]],
    }
    assert process_polygon(wide, 5.0, 0.0, None) is None
    assert circle_payload(10, 10)["vertexCount"] == 64


def test_air_summary() -> None:
    times = [f"2026-10-0{d}T{h:02d}:00" for d in (1, 2) for h in range(24)]
    cur = "2026-10-02T11:00"
    raw = {
        "utc_offset_seconds": 0,
        "current": {
            "time": cur,
            "pm2_5": 12.0,
            "pm10": 20.0,
            "ozone": 50.0,
            "us_aqi": 55,
            "european_aqi": 30,
        },
        "hourly": {
            "time": times,
            "pm2_5": [10.0] * 48,
            "us_aqi": [50 + i % 3 for i in range(48)],
            "european_aqi": [20] * 48,
            "pm10": [0] * 48,
            "ozone": [0] * 48,
        },
    }
    out = air.summarise(raw, "Asia/Karachi")
    assert out and out["scale"] == "usaqi"
    assert out["daily"][0]["pm25Mean"] == 10.0 and out["daily"][1]["partial"] is True
    assert air.category(50, "usaqi") == 0 and air.category(51, "usaqi") == 1
    assert air.category(301, "usaqi") == 5 and air.category(20, "eaqi") == 0
    assert air.category(101, "eaqi") == 5
    eu = air.summarise(raw, "Europe/London")
    assert eu and eu["scale"] == "eaqi"


def _synthetic_series(first: int, last: int, fn):
    dates, vals = [], []
    d = date(first, 1, 1)
    from datetime import timedelta

    while d <= date(last, 12, 31):
        dates.append(d.isoformat())
        vals.append(fn(d))
        d += timedelta(days=1)
    return dates, vals


def test_full_climate_pipeline() -> None:
    def temp(d: date) -> float:
        doy = min(d.timetuple().tm_yday, 365)
        return 12 + 9 * math.cos(2 * math.pi * (doy - 200) / 365.2425) + 0.02 * (d.year - 1950)

    a_d, a_v = _synthetic_series(1950, 2025, temp)
    b_d, tmean = _synthetic_series(1996, 2025, temp)
    bv = {
        "temperature_2m_max": [t + 4 for t in tmean],
        "temperature_2m_min": [t - 4 for t in tmean],
        "precipitation_sum": [2.0] * len(tmean),
        "sunshine_duration": [6 * 3600.0] * len(tmean),
    }
    out = analyse_climate(a_d, a_v, b_d, bv, 2025, 51.5, 2643743, n_boot=50)
    assert out["koppen"]["code"][0] in "CD"
    assert out["seasonMode"] == "thermal"
    assert len(out["dailyMeanSmooth"]) == 365
    assert out["trend"]["annual"]["slopePerYear"] == pytest.approx(0.02, abs=0.002)
    assert out["cycle"]["peakDoy"] == pytest.approx(200, abs=2)
    assert out["extremes"]["means"]["frost"] >= 0
    assert out["annual"]["sunHours"] == pytest.approx(6 * 365, abs=5)
    assert len(out["annualAnomaly"]) == 76
