"""Boundary module: Nominatim lookup chain with a 5 km circle fallback (SDS 7.5, 8.8)."""

from __future__ import annotations

import asyncio
from typing import Any

from ..analysis.geometry import circle_payload, process_polygon
from ..analysis.seismic import haversine_km
from ..core.container import Container
from ..core.runner import Computed, Progress, Spec
from ..errors import ApiError

HOUR = 3600


def make_spec(c: Container, identity_spec: Spec) -> Spec:
    from .identity import get_identity

    async def compute(progress: Progress, args: tuple[int, str | None]) -> Computed:
        geoname_id, ip = args
        ident = await get_identity(c, identity_spec, geoname_id, ip)
        progress(1, "Looking up the city boundary")
        lat, lon = ident["lat"], ident["lon"]
        blocked = c.nominatim.blocked()
        if not blocked:
            result = await _chain(c, ident)
            if result:
                return Computed(result, "ok", [], ["osm"])
            blocked = c.nominatim.blocked()
        circ = circle_payload(lat, lon)
        notes = ["boundary_circle"] + (["boundary_blocked"] if blocked else [])
        return Computed(circ, "partial", notes, ["osm"], soft_override=HOUR if blocked else None)

    return Spec("boundary", "boundary", 1, compute)


async def _chain(c: Container, ident: dict[str, Any]) -> dict[str, Any] | None:
    lat, lon = ident["lat"], ident["lon"]
    area = ident.get("areaKm2")
    rel = ident.get("osmRelationId")
    try:
        if rel:
            hit = await c.nominatim.lookup(rel)
            if hit:
                out = await asyncio.to_thread(process_polygon, hit["geojson"], lat, lon, area)
                if out:
                    out["osmRelationId"] = rel
                    return out
        for r in await c.nominatim.search(ident["name"], ident.get("country") or ""):
            g = r.get("geojson")
            if (
                r.get("osm_type") != "relation"
                or not g
                or g.get("type") not in ("Polygon", "MultiPolygon")
            ):
                continue
            try:
                if haversine_km(lat, lon, float(r["lat"]), float(r["lon"])) > 50:
                    continue
            except (KeyError, ValueError):
                continue
            out = await asyncio.to_thread(process_polygon, g, lat, lon, area)
            if out:
                out["osmRelationId"] = int(r["osm_id"])
                return out
    except ApiError:
        return None
    return None
