"""Shared fixtures: a fake provider network driven by httpx.MockTransport."""

from __future__ import annotations

import json
import math
from collections.abc import AsyncIterator, Callable
from datetime import date, timedelta
from typing import Any

import httpx
import pytest
from httpx import ASGITransport

from app.config import Settings
from app.main import create_app

LONDON = {
    "id": 2643743,
    "name": "London",
    "latitude": 51.50853,
    "longitude": -0.12574,
    "elevation": 25.0,
    "feature_code": "PPLC",
    "country_code": "GB",
    "country": "United Kingdom",
    "admin1": "England",
    "population": 8961989,
    "timezone": "Europe/London",
}


def _daily(start: str, end: str, variables: list[str]) -> dict[str, Any]:
    d, e = date.fromisoformat(start), date.fromisoformat(end)
    times, cols = [], {v: [] for v in variables}
    while d <= e:
        doy = min(d.timetuple().tm_yday, 365)
        t = 11 + 7 * math.cos(2 * math.pi * (doy - 200) / 365.2425) + 0.02 * (d.year - 1950)
        times.append(d.isoformat())
        vals = {
            "temperature_2m_mean": t,
            "temperature_2m_max": t + 4,
            "temperature_2m_min": t - 4,
            "precipitation_sum": 4.0 if doy % 2 == 0 else 0.0,
            "sunshine_duration": 18000.0,
        }
        for v in variables:
            cols[v].append(round(vals[v], 2))
        d += timedelta(days=1)
    return {"daily": {"time": times, **cols}}


def fake_providers(
    calls: list[str], overrides: dict[str, Callable[[httpx.Request], httpx.Response]]
) -> Callable[[httpx.Request], httpx.Response]:
    def handler(req: httpx.Request) -> httpx.Response:
        url = str(req.url)
        calls.append(url)
        for frag, fn in overrides.items():
            if frag in url:
                return fn(req)
        q = dict(req.url.params)
        host, path = req.url.host, req.url.path
        if host == "geocoding-api.open-meteo.com":
            if path.endswith("/get"):
                return (
                    httpx.Response(200, json=LONDON)
                    if q["id"] == "2643743"
                    else httpx.Response(404, json={"error": True, "reason": "x"})
                )
            return httpx.Response(
                200, json={"results": [LONDON, {**LONDON, "id": 1, "feature_code": "ADM1"}]}
            )
        if host == "archive-api.open-meteo.com":
            return httpx.Response(
                200, json=_daily(q["start_date"], q["end_date"], q["daily"].split(","))
            )
        if host == "air-quality-api.open-meteo.com":
            times = [f"2026-10-0{d}T{h:02d}:00" for d in (1, 2, 3) for h in range(24)]
            n = len(times)
            return httpx.Response(
                200,
                json={
                    "utc_offset_seconds": 3600,
                    "current": {
                        "time": "2026-10-03T10:00",
                        "pm2_5": 8.0,
                        "pm10": 12.0,
                        "ozone": 40.0,
                        "us_aqi": 40,
                        "european_aqi": 25,
                    },
                    "hourly": {
                        "time": times,
                        "pm2_5": [8.0] * n,
                        "pm10": [12.0] * n,
                        "ozone": [40.0] * n,
                        "us_aqi": [40] * n,
                        "european_aqi": [25] * n,
                    },
                },
            )
        if host == "earthquake.usgs.gov":
            if path.endswith("/count"):
                return httpx.Response(200, text="2")
            return httpx.Response(
                200,
                text="time,latitude,longitude,depth,mag,magType,place,id\n"
                "2000-01-01T00:00:00.000Z,51.0,0.0,10,4.6,mb,UK,a1\n2010-05-05T00:00:00.000Z,51.2,0.1,8,5.1,mw,UK,a2\n",
            )
        if host == "overpass-api.de":
            if "out count" in __import__("urllib.parse").parse.unquote_plus(req.content.decode()):
                els = [
                    {"type": "count", "id": 0, "tags": {"total": str(i * 10)}} for i in range(1, 14)
                ]
                return httpx.Response(200, json={"elements": els})
            return httpx.Response(
                200,
                json={
                    "elements": [
                        {
                            "type": "node",
                            "id": 1,
                            "lat": 51.5,
                            "lon": -0.12,
                            "tags": {"name": "Tower", "historic": "castle", "wikidata": "Q1"},
                        }
                    ]
                },
            )
        if host == "nominatim.openstreetmap.org":
            poly = {
                "type": "Polygon",
                "coordinates": [
                    [[-0.3, 51.3], [0.1, 51.3], [0.1, 51.7], [-0.3, 51.7], [-0.3, 51.3]]
                ],
            }
            return httpx.Response(200, json=[{"geojson": poly}])
        if host == "www.wikidata.org":
            p = req.url.params
            if p.get("list") == "search":
                return httpx.Response(200, json={"query": {"search": [{"title": "Q84"}]}})
            ids = p.get("ids", "")
            if ids == "Q84":
                if p.get("props", "").startswith("claims|"):
                    return httpx.Response(
                        200,
                        json={
                            "entities": {
                                "Q84": {
                                    "claims": {
                                        "P17": [
                                            {
                                                "rank": "normal",
                                                "mainsnak": {
                                                    "datavalue": {"value": {"id": "Q145"}}
                                                },
                                            }
                                        ],
                                        "P1082": [
                                            {
                                                "rank": "preferred",
                                                "mainsnak": {
                                                    "datavalue": {"value": {"amount": "+8799800"}}
                                                },
                                            }
                                        ],
                                        "P2046": [
                                            {
                                                "rank": "normal",
                                                "mainsnak": {
                                                    "datavalue": {
                                                        "value": {
                                                            "amount": "+1572",
                                                            "unit": "http://www.wikidata.org/entity/Q712226",
                                                        }
                                                    }
                                                },
                                            }
                                        ],
                                        "P402": [
                                            {
                                                "rank": "normal",
                                                "mainsnak": {"datavalue": {"value": "65606"}},
                                            }
                                        ],
                                    },
                                    "sitelinks": {"enwiki": {"title": "London"}},
                                }
                            }
                        },
                    )
            if ids == "Q145":
                return httpx.Response(
                    200,
                    json={
                        "entities": {
                            "Q145": {
                                "claims": {
                                    "P38": [
                                        {
                                            "rank": "normal",
                                            "mainsnak": {"datavalue": {"value": {"id": "Q25224"}}},
                                        }
                                    ],
                                    "P1622": [
                                        {
                                            "rank": "normal",
                                            "mainsnak": {
                                                "datavalue": {"value": {"id": "Q13196750"}}
                                            },
                                        }
                                    ],
                                }
                            }
                        }
                    },
                )
            return httpx.Response(
                200,
                json={
                    "entities": {k: {"labels": {"en": {"value": f"L-{k}"}}} for k in ids.split("|")}
                },
            )
        if host == "en.wikipedia.org":
            if q.get("generator") == "geosearch":
                return httpx.Response(
                    200,
                    json={
                        "query": {
                            "pages": [
                                {
                                    "title": "Big Ben",
                                    "description": "Clock tower",
                                    "coordinates": [{"lat": 51.5, "lon": -0.12}],
                                    "pageviews": {"2026-09-01": 100, "2026-09-02": None},
                                }
                            ]
                        }
                    },
                )
            return httpx.Response(
                200, json={"query": {"pages": [{"extract": "London is the capital. " * 5}]}}
            )
        return httpx.Response(500, json={})

    return handler


@pytest.fixture
def calls() -> list[str]:
    return []


@pytest.fixture
def overrides() -> dict[str, Callable[[httpx.Request], httpx.Response]]:
    return {}


@pytest.fixture
async def client(calls: list[str], overrides: dict[str, Any]) -> AsyncIterator[httpx.AsyncClient]:
    settings = Settings(
        rate_limit_per_min=10_000, om_minute_rate=100_000, bootstrap_n=50, inline_wait_s=30
    )
    transport = httpx.MockTransport(fake_providers(calls, overrides))
    app = create_app(settings, transport)
    async with app.router.lifespan_context(app):
        await app.state.container.warm.wait()
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            c.app = app  # type: ignore[attr-defined]
            yield c


def dump(x: Any) -> str:
    return json.dumps(x)[:300]
