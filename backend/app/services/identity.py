"""Identity module (SDS 8.1)."""

from __future__ import annotations

from typing import Any

from ..core.container import Container
from ..core.runner import Computed, Progress, Spec
from ..errors import ApiError


def build_identity(
    city: dict[str, Any], wd: dict[str, Any] | None
) -> tuple[dict[str, Any], list[str]]:
    notes: list[str] = []
    wd = wd or {}
    pop = None
    wp = wd.get("population")
    gp = city.get("population")
    if wp and wp["value"] > 0:
        pop = {"value": wp["value"], "year": wp["year"], "source": "wikidata"}
        if gp and gp > 20 * wp["value"]:
            pop = {"value": gp, "year": None, "source": "geonames"}
    elif gp:
        pop = {"value": gp, "year": None, "source": "geonames"}
    if pop and pop["source"] == "geonames":
        notes.append("population_geonames")
    area = wd.get("areaKm2")
    density = round(pop["value"] / area, 1) if pop and area else None
    data = {
        **{
            k: city[k]
            for k in ("geonameId", "name", "admin1", "country", "countryCode", "lat", "lon")
        },
        "elevationM": city.get("elevationM"),
        "timezone": city["timezone"],
        "population": pop,
        "areaKm2": area,
        "densityPerKm2": density,
        "inception": wd.get("inception"),
        "wikidataQid": wd.get("qid"),
        "osmRelationId": wd.get("osmRelationId"),
        "countryQid": wd.get("countryQid"),
        "enwikiTitle": wd.get("enwikiTitle"),
    }
    return data, notes


def make_spec(c: Container) -> Spec:
    async def compute(progress: Progress, geoname_id: int) -> Computed:
        progress(1, "Looking up the city")
        city = await c.om.get(geoname_id)
        wd: dict[str, Any] | None = None
        notes: list[str] = []
        try:
            qid = await c.wiki.find_qid(geoname_id)
            if qid:
                wd = await c.wiki.city_entity(qid)
                wd["qid"] = qid
        except ApiError:
            wd = None
        if wd is None:
            notes.append("wikidata_missing")
        data, n2 = build_identity(city, wd)
        notes += n2
        srcs = ["geonames"] + (["wikidata"] if wd else [])
        return Computed(data, "partial" if wd is None else "ok", notes, srcs)

    return Spec("identity", "identity", 1, compute, admit=lambda a, ip: c.gov.admit_light("search"))


async def get_identity(
    c: Container, spec: Spec, geoname_id: int, ip: str | None = None
) -> dict[str, Any]:
    body = await c.runner.call_inline(spec, f"mrd:v1:identity:{geoname_id}", geoname_id, ip)
    return body["data"]  # type: ignore[no-any-return]
