"""Open-Meteo geocoding, ERA5 archive and air-quality adapters (SDS 7.2)."""

from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any

from ..core.budget import om_weight
from ..core.http import Providers
from ..errors import make_error

POPULATED = {"PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLA5", "PPLC", "PPLG", "PPLL", "PPLS"}
PROVIDER = "Open-Meteo"
CHUNK_DAYS = 5600


def _city(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "geonameId": int(r["id"]),
        "name": r["name"],
        "admin1": r.get("admin1"),
        "country": r.get("country"),
        "countryCode": r["country_code"],
        "lat": round(float(r["latitude"]), 4),
        "lon": round(float(r["longitude"]), 4),
        "population": r.get("population") or None,
    }


class OpenMeteo:
    def __init__(self, p: Providers) -> None:
        self.p, self.s = p, p.s

    async def search(self, q: str) -> list[dict[str, Any]]:
        resp = await self.p.request(
            "open-meteo",
            "om-geocoding",
            "GET",
            f"{self.s.om_geocoding_base}/v1/search",
            params={"name": q, "count": 20, "language": "en", "format": "json"},
            charge=("search", 1),
        )
        data = self.p.json(resp, PROVIDER)
        out = []
        for r in data.get("results") or []:
            try:
                if r.get("feature_code") in POPULATED:
                    out.append(_city(r))
            except KeyError as exc:
                raise make_error("UPSTREAM_BAD_DATA", provider=PROVIDER) from exc
        return out[:8]

    async def get(self, geoname_id: int) -> dict[str, Any]:
        resp = await self.p.request(
            "open-meteo",
            "om-geocoding",
            "GET",
            f"{self.s.om_geocoding_base}/v1/get",
            params={"id": geoname_id, "language": "en", "format": "json"},
            charge=("search", 1),
        )
        if resp.status_code == 404:
            raise make_error("CITY_NOT_FOUND")
        data = self.p.json(resp, PROVIDER)
        if (
            not isinstance(data, dict)
            or "id" not in data
            or data.get("feature_code") not in POPULATED
        ):
            raise make_error("CITY_NOT_FOUND")
        if not data.get("timezone"):
            raise make_error("UPSTREAM_BAD_DATA", provider=PROVIDER)
        c = _city(data)
        c.update(elevationM=data.get("elevation"), timezone=data["timezone"])
        return c

    async def archive(
        self, lat: float, lon: float, start: date, end: date, variables: list[str], tz: str
    ) -> dict[str, list[Any]]:
        n_days = (end - start).days + 1
        weight = om_weight(len(variables), n_days, self.s.om_weight_model)
        resp = await self.p.request(
            "open-meteo",
            "om-archive",
            "GET",
            f"{self.s.om_archive_base}/v1/archive",
            params={
                "latitude": f"{lat:.4f}",
                "longitude": f"{lon:.4f}",
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "daily": ",".join(variables),
                "models": "era5",
                "timezone": tz,
                "temperature_unit": "celsius",
                "precipitation_unit": "mm",
                "timeformat": "iso8601",
                "format": "json",
            },
            charge=("fresh", weight),
        )
        data = self.p.json(resp, PROVIDER, ("daily",))
        daily = data["daily"]
        if "time" not in daily or any(v not in daily for v in variables):
            raise make_error("UPSTREAM_BAD_DATA", provider=PROVIDER)
        n = len(daily["time"])
        if any(len(daily[v]) != n for v in variables) or n > n_days:
            raise make_error("UPSTREAM_BAD_DATA", provider=PROVIDER)
        # Pad trailing days that ERA5 has not published yet with nulls.
        times = list(daily["time"])
        d0 = start + timedelta(days=n)
        out: dict[str, list[Any]] = {"time": times}
        for v in variables:
            out[v] = list(daily[v])
        for i in range(n_days - n):
            out["time"].append((d0 + timedelta(days=i)).isoformat())
            for v in variables:
                out[v].append(None)
        return out

    @staticmethod
    def check_missing(values: list[Any], limit: float = 0.01) -> bool:
        return sum(v is None for v in values) / max(1, len(values)) <= limit

    async def air(self, lat: float, lon: float) -> dict[str, Any]:
        names = "pm2_5,pm10,ozone,us_aqi,european_aqi"
        resp = await self.p.request(
            "open-meteo",
            "om-air",
            "GET",
            f"{self.s.om_air_base}/v1/air-quality",
            params={
                "latitude": f"{lat:.4f}",
                "longitude": f"{lon:.4f}",
                "hourly": names,
                "current": names,
                "past_days": 7,
                "forecast_days": 1,
                "timezone": "auto",
            },
            charge=("air", 1),
        )
        data = self.p.json(resp, PROVIDER, ("hourly", "current"))
        if "time" not in data["hourly"] or "time" not in data["current"]:
            raise make_error("UPSTREAM_BAD_DATA", provider=PROVIDER)
        return dict(data)


def chunk_ranges(start: date, end: date, size: int = CHUNK_DAYS) -> list[tuple[date, date]]:
    out = []
    d = start
    while d <= end:
        e = min(end, d + timedelta(days=size - 1))
        out.append((d, e))
        d = e + timedelta(days=1)
    return out


def expected_days(start: date, end: date) -> int:
    return (end - start).days + 1


def _ceil(x: float) -> int:
    return math.ceil(x)
