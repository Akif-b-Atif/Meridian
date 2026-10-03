"""USGS FDSN event service with recursive bisection (SDS 7.3)."""

from __future__ import annotations

import csv
import io
from datetime import UTC, date, datetime, timedelta
from typing import Any

from ..core.http import Providers
from ..errors import make_error

PROVIDER = "USGS"
MAX_CALLS = 10
SAFE_COUNT = 19_000


class Usgs:
    def __init__(self, p: Providers) -> None:
        self.p, self.s = p, p.s
        self.base = f"{p.s.usgs_base}/fdsnws/event/1"

    def _params(self, lat: float, lon: float, radius: int, a: date, b: date) -> dict[str, Any]:
        return {
            "latitude": f"{lat:.4f}",
            "longitude": f"{lon:.4f}",
            "maxradiuskm": radius,
            "eventtype": "earthquake",
            "minmagnitude": self.s.seismic_min_mag,
            "starttime": a.isoformat(),
            "endtime": (b + timedelta(days=1)).isoformat(),
        }

    async def _count(self, params: dict[str, Any]) -> int:
        async with self.p.usgs_sem:
            r = await self.p.request(
                "usgs",
                "usgs-count",
                "GET",
                f"{self.base}/count",
                params=params,
                headers={"Accept": "text/plain"},
            )
        try:
            return int(r.text.strip())
        except ValueError as exc:
            raise make_error("UPSTREAM_BAD_DATA", provider=PROVIDER) from exc

    async def _query(self, params: dict[str, Any]) -> str:
        async with self.p.usgs_sem:
            r = await self.p.request(
                "usgs",
                "usgs-query",
                "GET",
                f"{self.base}/query",
                params={**params, "format": "csv", "orderby": "time-asc", "limit": 20000},
                headers={"Accept": "text/csv"},
            )
        return "" if r.status_code == 204 else r.text

    async def fetch(
        self, lat: float, lon: float, radius: int, start: date, end: date
    ) -> dict[str, Any]:
        calls = 0
        chunks: list[str] = []
        truncated = False
        earliest = end
        partial = False

        async def rec(a: date, b: date) -> None:
            nonlocal calls, truncated, earliest, partial
            if partial:
                return
            if calls + 2 > MAX_CALLS and (b - a).days > 31:
                partial = True
                return
            params = self._params(lat, lon, radius, a, b)
            calls += 1
            n = await self._count(params)
            if n == 0:
                earliest = min(earliest, a)
                return
            if n <= SAFE_COUNT or (b - a).days <= 31:
                if calls + 1 > MAX_CALLS:
                    partial = True
                    return
                if n > SAFE_COUNT:
                    truncated = True
                calls += 1
                chunks.append(await self._query(params))
                earliest = min(earliest, a)
                return
            mid = a + (b - a) / 2
            await rec(mid + timedelta(days=1), b)  # newer half first
            await rec(a, mid)

        await rec(start, end)
        events, dropped = parse_csv(chunks)
        return {
            "events": events,
            "droppedRows": dropped,
            "truncated": truncated,
            "partial": partial,
            "coverageStart": earliest if partial else start,
        }


def parse_csv(chunks: list[str]) -> tuple[list[dict[str, Any]], int]:
    seen: dict[str, dict[str, Any]] = {}
    dropped = 0
    for text in chunks:
        if not text.strip():
            continue
        for row in csv.DictReader(io.StringIO(text)):
            try:
                t, lat, lon, mag = row["time"], row["latitude"], row["longitude"], row["mag"]
                if not (t and lat and lon and mag):
                    raise ValueError
                dt = datetime.fromisoformat(t.replace("Z", "+00:00")).astimezone(UTC)
                year_dec = dt.year + (dt.timetuple().tm_yday - 1) / 365.25
                seen[row["id"]] = {
                    "id": row["id"],
                    "time": t.replace("Z", ""),
                    "lat": float(lat),
                    "lon": float(lon),
                    "mag": float(mag),
                    "magType": row.get("magType") or None,
                    "depth": float(row["depth"]) if row.get("depth") else None,
                    "place": row.get("place") or None,
                    "year_dec": year_dec,
                }
            except (KeyError, ValueError):
                dropped += 1
    return sorted(seen.values(), key=lambda e: e["time"]), dropped
