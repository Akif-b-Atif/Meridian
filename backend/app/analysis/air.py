"""Air-quality summaries: 18-hour rule and AQI categories (SDS 8.10)."""

from __future__ import annotations

from typing import Any

US_BANDS = [50, 100, 150, 200, 300]
EU_BANDS = [20, 40, 60, 80, 100]


def category(aqi: float | None, scale: str) -> int | None:
    if aqi is None:
        return None
    bands = EU_BANDS if scale == "eaqi" else US_BANDS
    return sum(1 for b in bands if aqi > b)


def scale_for(timezone: str) -> str:
    return "eaqi" if timezone.startswith("Europe/") else "usaqi"


def summarise(raw: dict[str, Any], timezone: str) -> dict[str, Any] | None:
    scale = scale_for(timezone)
    key = "european_aqi" if scale == "eaqi" else "us_aqi"
    cur_t = raw["current"]["time"]
    h = raw["hourly"]
    keep = [i for i, t in enumerate(h["time"]) if t <= cur_t]
    times = [h["time"][i] for i in keep]
    pm = [h["pm2_5"][i] for i in keep]
    aq = [h[key][i] for i in keep]
    if all(v is None for v in pm) and all(v is None for v in aq):
        return None
    dates = sorted({t[:10] for t in times})
    last = dates[-1] if dates else None
    daily: list[dict[str, Any]] = []
    for d in dates:
        ix = [i for i, t in enumerate(times) if t[:10] == d]
        pv = [pm[i] for i in ix if pm[i] is not None]
        av = [aq[i] for i in ix if aq[i] is not None]
        partial = d == last
        ok_pm = len(pv) >= 18 or (partial and pv)
        ok_aq = len(av) >= 18 or (partial and av)
        amax = max(av) if ok_aq else None
        daily.append(
            {
                "date": d,
                "pm25Mean": round(sum(pv) / len(pv), 1) if ok_pm else None,
                "aqiMax": amax,
                "category": category(amax, scale),
                "partial": partial,
            }
        )
    c = raw["current"]
    return {
        "scale": scale,
        "utcOffsetSeconds": raw.get("utc_offset_seconds", 0),
        "current": {
            "time": cur_t,
            "pm25": c.get("pm2_5"),
            "pm10": c.get("pm10"),
            "ozone": c.get("ozone"),
            "aqi": c.get(key),
        },
        "hourly": {"time": times, "pm25": pm},
        "daily": daily,
    }
