"""Seismicity statistics: rate, Poisson interval, Mc, Aki-Utsu b-value, recurrence (SDS 8.5)."""

from __future__ import annotations

import math
from collections import Counter
from datetime import date
from typing import Any

import numpy as np

RE = 6371.0088


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * RE * math.asin(min(1.0, math.sqrt(h)))


def cap_area_km2(radius_km: float) -> float:
    return 2 * math.pi * RE**2 * (1 - math.cos(radius_km / RE))


def poisson_interval(n: int, level: float = 0.90) -> tuple[float, float]:
    from scipy.special import gammaincinv

    a = (1 - level) / 2
    lo = 0.0 if n == 0 else float(gammaincinv(n, a))
    hi = float(gammaincinv(n + 1, 1 - a))
    return lo, hi


def activity_class(rate100k: float, n: int, thresholds: list[float]) -> int:
    if n == 0:
        return 0
    for i, t in enumerate(thresholds):
        if rate100k < t:
            return i + 1
    return len(thresholds) + 1


def estimate_mc(mags: np.ndarray) -> float:
    binned = np.round(mags, 1)
    counts = Counter(binned.tolist())
    top = max(counts.values())
    mode = float(min(m for m, c in counts.items() if c == top))
    return round(mode + 0.2, 1)


def decimate(events: list[dict[str, Any]], limit: int = 1500) -> list[dict[str, Any]]:
    big = [e for e in events if e["mag"] >= 5.5]
    if len(big) >= limit:
        return sorted(sorted(big, key=lambda e: -e["mag"])[:limit], key=lambda e: e["t"])
    rest = sorted((e for e in events if e["mag"] < 5.5), key=lambda e: e["t"])
    room = limit - len(big)
    if len(rest) > room:
        k = math.ceil(len(rest) / room)
        rest = rest[::k]
    return sorted(big + rest[:room], key=lambda e: e["t"])


def analyse(
    events: list[dict[str, Any]],
    lat: float,
    lon: float,
    radius: int,
    start: date,
    end: date,
    thresholds: list[float],
    *,
    partial: bool = False,
    truncated: bool = False,
    dropped: int = 0,
) -> dict[str, Any]:
    t_years = max((end - start).days / 365.2425, 1e-6)
    n = len(events)
    area = cap_area_km2(radius)
    rate = n / t_years
    rate100k = rate / area * 100_000
    lo, hi = poisson_interval(n)
    cls = activity_class(rate100k, n, thresholds)

    mags = np.array([e["mag"] for e in events], float)
    mc = b = b_se = None
    nc = 0
    recurrence = None
    if n:
        mc = estimate_mc(mags)
        sel = mags[mags >= mc - 1e-9]
        nc = int(sel.size)
        if nc >= 50:
            denom = float(sel.mean() - (mc - 0.05))
            if denom > 0:
                b = math.log10(math.e) / denom
                b_se = b / math.sqrt(nc)
                a = math.log10(nc / t_years) + b * mc
                rec: dict[str, Any] = {}
                for m in (5, 6, 7):
                    if m < mc:
                        rec[f"m{m}"] = None
                        continue
                    yrs = 1 / 10 ** (a - b * m)
                    rec[f"m{m}"] = "gt10000" if yrs > 10_000 else round(yrs, 0 if yrs >= 10 else 1)
                recurrence = rec

    for e in events:
        e["distanceKm"] = haversine_km(lat, lon, e["lat"], e["lon"])
    pts = decimate([{**e, "t": e["year_dec"]} for e in events])
    top = sorted(events, key=lambda e: (-e["mag"], -e["year_dec"]))[:10]

    first_full = start.year if (start.month, start.day) == (1, 1) else start.year + 1
    per_year = [0] * (end.year - first_full + 1) if end.year >= first_full else []
    for e in events:
        y = int(e["time"][:4])
        if first_full <= y <= end.year:
            per_year[y - first_full] += 1

    gr_counts: list[int] = []
    m0 = 4.5
    mmax = round(float(mags.max()), 1) if n else m0
    steps = round((mmax - m0) / 0.1) + 1
    for i in range(steps):
        gr_counts.append(int(np.sum(mags >= m0 + i * 0.1 - 1e-9)))

    return {
        "radiusKm": radius,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "years": round(t_years, 1),
        "n": n,
        "areaKm2": round(area, 0),
        "ratePerYear": round(rate, 2),
        "ratePerYearCi": [round(lo / t_years, 2), round(hi / t_years, 2)],
        "ratePer100kKm2": round(rate100k, 3),
        "ratePer100kKm2Ci": [
            round(lo / t_years / area * 100_000, 3),
            round(hi / t_years / area * 100_000, 3),
        ],
        "activityClass": cls,
        "mc": mc,
        "nc": nc,
        "b": None if b is None else round(b, 2),
        "bSe": None if b_se is None else round(b_se, 2),
        "recurrence": recurrence,
        "partial": partial,
        "coverageStart": start.isoformat() if partial else None,
        "truncated": truncated,
        "droppedRows": dropped,
        "points": {
            "t": [round(e["t"], 2) for e in pts],
            "lat": [round(e["lat"], 2) for e in pts],
            "lon": [round(e["lon"], 2) for e in pts],
            "mag": [round(e["mag"], 1) for e in pts],
            "depth": [round(e["depth"]) if e["depth"] is not None else 0 for e in pts],
        },
        "top": [
            {
                "time": e["time"],
                "mag": round(e["mag"], 1),
                "magType": e.get("magType"),
                "depth": None if e["depth"] is None else round(e["depth"]),
                "place": e.get("place"),
                "id": e["id"],
                "distanceKm": round(e["distanceKm"], 1),
            }
            for e in top
        ],
        "perYear": {"firstYear": first_full, "counts": per_year},
        "gr": {"m0": m0, "step": 0.1, "counts": gr_counts},
    }
