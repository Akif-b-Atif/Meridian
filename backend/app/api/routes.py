"""HTTP routes. Every module endpoint validates input, loads identity and delegates to the runner."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..analysis.solar import solar_payload
from ..core import clock
from ..core.container import Container, lookup_sources
from ..core.runner import Spec
from ..errors import ApiError, invalid, make_error
from ..schemas.envelope import Envelope, ProgressBody, StatusBody
from ..services import air, boundary, climate, history, identity, places, seismic
from ..services import search as search_service

router = APIRouter(prefix="/api")

CACHE_DEFAULT = "public, max-age=300, stale-while-revalidate=86400"
RADII = {100, 300, 500}


class Specs:
    def __init__(self, c: Container) -> None:
        self.identity = identity.make_spec(c)
        self.climate = climate.make_spec(c, self.identity)
        self.seismic = seismic.make_spec(c, self.identity)
        self.boundary = boundary.make_spec(c, self.identity)
        self.places = places.make_spec(c, self.identity, self.boundary)
        self.history = history.make_spec(c, self.identity)
        self.air = air.make_spec(c, self.identity)


def container(request: Request) -> Container:
    return request.app.state.container  # type: ignore[no-any-return]


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def parse_id(raw: str) -> int:
    if not (raw.isdigit() and 1 <= len(raw) <= 10) or not 1 <= int(raw) <= 2_147_483_647:
        raise invalid("The city ID must be a whole number.")
    return int(raw)


def respond(code: int, body: dict[str, Any], cache: str | None = None) -> JSONResponse:
    headers = {"Vary": "Origin"}
    if code == 202:
        headers["Cache-Control"] = "no-store"
        headers["Retry-After"] = "2"
    else:
        stale = bool(body.get("stale"))
        headers["Cache-Control"] = "public, max-age=60" if stale else (cache or CACHE_DEFAULT)
    return JSONResponse(body, status_code=code, headers=headers)


async def run(
    request: Request, spec_name: str, geoname_id: int, key: str, args: Any, cache: str | None = None
) -> JSONResponse:
    c = container(request)
    specs: Specs = request.app.state.specs
    spec: Spec = getattr(specs, spec_name)
    code, body = await c.runner.get(spec, key, args, client_ip(request))
    return respond(code, body, cache)


@router.get("/status", response_model=StatusBody, response_model_by_alias=True)
async def status(request: Request) -> JSONResponse:
    c = container(request)
    body = {
        "ok": True,
        "warm": c.warm.is_set(),
        "cacheMode": c.cache.mode,
        "version": c.s.app_version,
        "budget": c.gov.snapshot(),
    }
    return JSONResponse(body, headers={"Cache-Control": "no-store"})


@router.get("/search")
async def search(request: Request, q: str = "") -> JSONResponse:
    c = container(request)
    data, at = await search_service.search(c, q)
    env = {
        "module": "search",
        "status": "ok",
        "data": data,
        "computedAt": at,
        "stale": False,
        "refreshing": False,
        "notes": [],
        "sources": lookup_sources(["geonames"]),
    }
    return respond(200, env, "public, max-age=300")


@router.get("/cities/{geoname_id}", response_model=Envelope)
async def city(request: Request, geoname_id: str) -> JSONResponse:
    i = parse_id(geoname_id)
    return await run(request, "identity", i, f"mrd:v1:identity:{i}", i)


@router.get("/cities/{geoname_id}/climate", response_model=Envelope)
async def climate_route(request: Request, geoname_id: str) -> JSONResponse:
    i = parse_id(geoname_id)
    await _identity_first(request, i)
    return await run(request, "climate", i, f"mrd:v1:climate:{i}", (i, client_ip(request)))


@router.get("/cities/{geoname_id}/seismic", response_model=Envelope)
async def seismic_route(request: Request, geoname_id: str, radius: str = "300") -> JSONResponse:
    i = parse_id(geoname_id)
    if not radius.isdigit() or int(radius) not in RADII:
        raise invalid("Radius must be 100, 300 or 500.")
    r = int(radius)
    await _identity_first(request, i)
    return await run(
        request,
        "seismic",
        i,
        f"mrd:v1:seismic:{i}:{r}",
        (i, r, client_ip(request)),
        "public, max-age=3600",
    )


@router.get("/cities/{geoname_id}/places", response_model=Envelope)
async def places_route(request: Request, geoname_id: str) -> JSONResponse:
    i = parse_id(geoname_id)
    await _identity_first(request, i)
    return await run(request, "places", i, f"mrd:v1:places:{i}", (i, client_ip(request)))


@router.get("/cities/{geoname_id}/boundary", response_model=Envelope)
async def boundary_route(request: Request, geoname_id: str) -> JSONResponse:
    i = parse_id(geoname_id)
    await _identity_first(request, i)
    return await run(request, "boundary", i, f"mrd:v1:boundary:{i}", (i, client_ip(request)))


@router.get("/cities/{geoname_id}/history", response_model=Envelope)
async def history_route(request: Request, geoname_id: str) -> JSONResponse:
    i = parse_id(geoname_id)
    await _identity_first(request, i)
    return await run(request, "history", i, f"mrd:v1:history:{i}", (i, client_ip(request)))


@router.get("/cities/{geoname_id}/air", response_model=Envelope)
async def air_route(request: Request, geoname_id: str) -> JSONResponse:
    i = parse_id(geoname_id)
    await _identity_first(request, i)
    return await run(
        request, "air", i, f"mrd:v1:air:{i}", (i, client_ip(request)), "public, max-age=300"
    )


def _computed(module: str, data: dict[str, Any], sources: list[str]) -> JSONResponse:
    env = {
        "module": module,
        "status": "ok",
        "data": data,
        "computedAt": clock.iso(),
        "stale": False,
        "refreshing": False,
        "notes": [],
        "sources": lookup_sources(sources),
    }
    return respond(200, env)


@router.get("/cities/{geoname_id}/water", response_model=Envelope)
async def water_route(request: Request, geoname_id: str) -> JSONResponse:
    i = parse_id(geoname_id)
    c = container(request)
    ident = await _identity_first(request, i)
    try:
        await asyncio.wait_for(c.warm.wait(), 90)
    except TimeoutError as exc:
        raise make_error("INITIALISING") from exc
    if c.water is None:
        raise ApiError("INTERNAL", make_error("INTERNAL").message)
    data = await asyncio.to_thread(c.water.payload, ident["lat"], ident["lon"])
    return _computed("water", data, ["natural-earth"])


@router.get("/cities/{geoname_id}/solar", response_model=Envelope)
async def solar_route(request: Request, geoname_id: str) -> JSONResponse:
    i = parse_id(geoname_id)
    ident = await _identity_first(request, i)
    return _computed("solar", solar_payload(ident["lat"]), [])


async def _identity_first(request: Request, i: int) -> dict[str, Any]:
    c = container(request)
    specs: Specs = request.app.state.specs
    return await identity.get_identity(c, specs.identity, i, client_ip(request))


__all__ = ["ProgressBody", "router"]
