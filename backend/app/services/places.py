"""Places module: counts, markers and Wikipedia candidates (SDS 8.7)."""

from __future__ import annotations

import re
from typing import Any

from ..analysis.seismic import haversine_km
from ..core.container import Container
from ..core.runner import Computed, Progress, Spec
from ..errors import ApiError

PRIORITY = ["attraction", "museum", "historic", "park", "culture", "worship", "university", "other"]


def categorise(tags: dict[str, str]) -> str:
    t, h, le, a = (
        tags.get("tourism"),
        tags.get("historic"),
        tags.get("leisure"),
        tags.get("amenity"),
    )
    if t == "museum":
        return "museum"
    if t == "attraction":
        return "attraction"
    if h:
        return "historic"
    if le == "park":
        return "park"
    if t in {"gallery", "zoo", "theme_park"} or a == "theatre":
        return "culture"
    if a == "place_of_worship":
        return "worship"
    if a == "university":
        return "university"
    return "other"


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.casefold())


def select_notable(
    markers: list[dict[str, Any]], arts: list[dict[str, Any]], ranking: str, lat: float, lon: float
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    used: set[int] = set()
    for m in markers:
        m["dist"] = haversine_km(lat, lon, m["lat"], m["lon"])
    for ai, a in enumerate(arts):
        match = None
        for m in markers:
            wp = m["tags"].get("wikipedia", "")
            if (wp.startswith("en:") and wp[3:].replace("_", " ") == a["title"]) or (
                _norm(m["name"]) == _norm(a["title"])
                and haversine_km(m["lat"], m["lon"], a["lat"], a["lon"]) <= 0.15
            ):
                match = m
            if match:
                break
        if match:
            used.add(id(match))
        records.append(
            {
                "name": a["title"],
                "category": categorise(match["tags"]) if match else "other",
                "lat": match["lat"] if match else a["lat"],
                "lon": match["lon"] if match else a["lon"],
                "source": "both" if match else "wikipedia",
                "wikipediaTitle": a["title"],
                "views30d": a["views"] if ranking == "views" else None,
                "description": a["description"],
                "distanceKm": round(a["distanceKm"], 1),
                "_ai": ai,
            }
        )
    both = sorted(
        (r for r in records if r["source"] == "both"), key=lambda r: -(r["views30d"] or 0)
    )
    wp_only = [r for r in records if r["source"] == "wikipedia"]
    osm_only = []
    for m in markers:
        if id(m) in used:
            continue
        cat = categorise(m["tags"])
        osm_only.append(
            {
                "name": m["name"],
                "category": cat,
                "lat": m["lat"],
                "lon": m["lon"],
                "source": "osm",
                "wikipediaTitle": None,
                "views30d": None,
                "description": None,
                "distanceKm": round(m["dist"], 1),
            }
        )
    osm_only.sort(key=lambda r: (PRIORITY.index(r["category"]), r["distanceKm"]))
    out = (both + wp_only + osm_only)[:25]
    for r in out:
        r.pop("_ai", None)
    return out


def make_spec(c: Container, identity_spec: Spec, boundary_spec: Spec) -> Spec:
    from .identity import get_identity

    async def compute(progress: Progress, args: tuple[int, str | None]) -> Computed:
        geoname_id, ip = args
        ident = await get_identity(c, identity_spec, geoname_id, ip)
        lat, lon = ident["lat"], ident["lon"]
        progress(1, "Finding the city boundary")
        bnd = (
            await c.runner.call_inline(boundary_spec, f"mrd:v1:boundary:{geoname_id}", args, ip)
        )["data"]
        rel = bnd["osmRelationId"] if bnd["kind"] == "polygon" else None
        area_km2, area_mode = (bnd["areaKm2"], "relation") if rel else (78.5, "radius")
        progress(2, "Counting mapped places")
        notes: list[str] = []
        counts: dict[str, int] | None = None
        markers: list[dict[str, Any]] = []
        try:
            counts = await c.overpass.counts(rel, lat, lon)
            progress(3, "Selecting notable places")
            markers = await c.overpass.markers(rel, lat, lon)
        except ApiError:
            if counts is None:
                notes.append("overpass_failed")
        arts: list[dict[str, Any]] = []
        ranking = None
        try:
            near = await c.wiki.nearby(lat, lon, ident.get("enwikiTitle"))
            arts, ranking = near["articles"], near["ranking"]
        except ApiError:
            notes.append("wikipedia_nearby_failed")
        if counts is None and not arts and not markers and "wikipedia_nearby_failed" in notes:
            raise ApiError(
                "UPSTREAM_UNAVAILABLE",
                "Overpass and Wikipedia did not respond. This is usually temporary.",
            )
        if bnd["kind"] == "circle":
            notes.append("boundary_circle")
        data = {
            "areaMode": area_mode,
            "areaKm2": area_km2,
            "counts": counts,
            "perKm2": None
            if counts is None
            else {k: round(v / area_km2, 3) for k, v in counts.items()},
            "notable": select_notable(markers, arts, ranking or "distance", lat, lon),
            "ranking": ranking,
        }
        failed = {"overpass_failed", "wikipedia_nearby_failed"} & set(notes)
        return Computed(data, "partial" if failed else "ok", notes, ["osm", "wikipedia"])

    return Spec("places", "places", 3, compute)
