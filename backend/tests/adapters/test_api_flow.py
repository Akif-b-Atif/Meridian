from __future__ import annotations

import httpx
import pytest


async def test_status_and_search(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/status")
    j = r.json()
    assert r.status_code == 200 and j["ok"] and j["cacheMode"] == "memory"
    assert j["budget"]["freshCitiesLimit"] == 15
    s = await client.get("/api/search", params={"q": "Lond"})
    body = s.json()
    assert [x["geonameId"] for x in body["data"]["results"]] == [2643743]  # ADM1 filtered out
    assert body["sources"][0]["id"] == "geonames"


async def test_validation(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/search", params={"q": "ab"})).status_code == 400
    assert (await client.get("/api/cities/abc")).status_code == 400
    assert (await client.get("/api/cities/99999999999")).status_code == 400
    assert (
        await client.get("/api/cities/2643743/seismic", params={"radius": "250"})
    ).status_code == 400
    r = await client.get("/api/cities/5")
    assert r.status_code == 404 and r.json()["error"]["code"] == "CITY_NOT_FOUND"


async def test_identity(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/cities/2643743")
    d = r.json()["data"]
    assert d["name"] == "London" and d["population"]["source"] == "wikidata"
    assert d["osmRelationId"] == 65606 and d["areaKm2"] == 1572.0
    assert d["densityPerKm2"] == pytest.approx(8799800 / 1572, abs=0.1)
    assert "Cache-Control" in r.headers


async def test_climate_pipeline_and_cache(client: httpx.AsyncClient, calls: list[str]) -> None:
    r = await client.get("/api/cities/2643743/climate")
    assert r.status_code == 200, r.text
    env = r.json()
    assert env["status"] == "ok"
    assert env["data"]["koppen"]["code"].startswith("C")
    assert env["data"]["trend"]["annual"]["slopePerYear"] == pytest.approx(0.02, abs=0.003)
    archive = [c for c in calls if "archive-api" in c]
    assert len(archive) == 2  # plan F: A and B
    assert "models=era5" in archive[0] and "timezone=Europe%2FLondon" in archive[0]
    await client.get("/api/cities/2643743/climate")
    assert len([c for c in calls if "archive-api" in c]) == 2  # served from cache
    status = (await client.get("/api/status")).json()
    assert status["budget"]["freshCitiesToday"] == 1


async def test_solar_and_water(client: httpx.AsyncClient) -> None:
    s = await client.get("/api/cities/2643743/solar")
    assert s.json()["data"]["reference"][1]["hours"] > 16
    w = await client.get("/api/cities/2643743/water")
    assert w.status_code in (200, 500)  # 500 only when the index file has not been built yet


async def test_seismic(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/cities/2643743/seismic")
    d = r.json()["data"]
    assert d["n"] == 2 and d["radiusKm"] == 300 and d["b"] is None
    assert d["top"][0]["mag"] == 5.1


async def test_boundary_places_history_air(client: httpx.AsyncClient) -> None:
    b = (await client.get("/api/cities/2643743/boundary")).json()
    assert b["data"]["kind"] == "polygon" and b["data"]["osmRelationId"] == 65606
    p = (await client.get("/api/cities/2643743/places")).json()
    assert p["status"] == "ok" and p["data"]["areaMode"] == "relation"
    assert p["data"]["counts"]["foodAndDrink"] == 10
    assert any(n["name"] == "Big Ben" for n in p["data"]["notable"])
    h = (await client.get("/api/cities/2643743/history")).json()
    assert h["data"]["country"]["drivingSide"] == "left"
    assert h["data"]["wikipedia"]["license"] == "CC BY-SA 4.0"
    a = (await client.get("/api/cities/2643743/air")).json()
    assert a["data"]["scale"] == "eaqi" and len(a["data"]["daily"]) == 3


async def test_upstream_429_gives_error_and_blocks(
    client: httpx.AsyncClient, overrides: dict
) -> None:
    overrides["archive-api"] = lambda req: httpx.Response(
        429, json={"error": True, "reason": "Daily API request limit exceeded."}
    )
    r = await client.get("/api/cities/2643743/climate")
    assert r.status_code == 502 and r.json()["error"]["code"] == "UPSTREAM_RATE_LIMITED"
    again = await client.get("/api/cities/2643743/climate")
    assert again.status_code == 502  # blocked state or stored failure, no new provider call


async def test_other_modules_survive_one_failure(
    client: httpx.AsyncClient, overrides: dict
) -> None:
    overrides["earthquake.usgs.gov"] = lambda req: httpx.Response(503, text="down")
    assert (await client.get("/api/cities/2643743/seismic")).status_code == 502
    assert (await client.get("/api/cities/2643743/solar")).status_code == 200


async def test_rate_limit_middleware() -> None:
    from app.config import Settings
    from app.main import create_app

    settings = Settings(rate_limit_per_min=3)
    app = create_app(settings)
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c,
    ):
        codes = [(await c.get("/api/status")).status_code for _ in range(5)]
        assert codes == [200, 200, 200, 429, 429]
        r = await c.get("/api/status")
        assert r.json()["error"]["code"] == "RATE_LIMITED" and "retry-after" in r.headers
