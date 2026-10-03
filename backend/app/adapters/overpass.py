"""Overpass queries for place counts and notable markers (SDS 7.4)."""

from __future__ import annotations

from typing import Any

from ..core.http import Providers
from ..errors import ApiError, make_error

PROVIDER = "Overpass"
CATEGORIES = [
    "foodAndDrink", "healthcare", "pharmacies", "schools", "universities", "museums",
    "attractions", "hotels", "parks", "railwayStations", "busStops", "historicSites", "airports",
]  # fmt: skip


def count_query(rel: int | None, lat: float, lon: float) -> str:
    around = f"(around:5000,{lat:.4f},{lon:.4f})"
    area = "(area.a)"
    head = "[out:json][timeout:90];\n"
    if rel:
        head += f"area(3600000000+{rel})->.a;\n"
        scope = area
    else:
        scope = around
    stm = [
        f"nwr{scope}[amenity~'^(restaurant|cafe)$'];out count;",
        f"nwr{scope}[amenity~'^(hospital|clinic)$'];out count;",
        f"nwr{scope}[amenity=pharmacy];out count;",
        f"nwr{scope}[amenity=school];out count;",
        f"nwr{scope}[amenity=university];out count;",
        f"nwr{scope}[tourism=museum];out count;",
        f"nwr{scope}[tourism=attraction];out count;",
        f"nwr{scope}[tourism=hotel];out count;",
        f"nwr{scope}[leisure=park];out count;",
        f"node{scope}[railway=station];out count;",
        f"node{scope}[highway=bus_stop];out count;",
        f"nwr{scope}[historic];out count;",
        f"nwr(around:30000,{lat:.4f},{lon:.4f})[aeroway=aerodrome][iata];out count;",
    ]
    return head + "\n".join(stm)


def marker_query(rel: int | None, lat: float, lon: float) -> str:
    head = "[out:json][timeout:90];\n"
    scope = "(area.a)"
    if rel:
        head += f"area(3600000000+{rel})->.a;\n"
    else:
        scope = f"(around:5000,{lat:.4f},{lon:.4f})"
    return (
        head + "(\n"
        f"  nwr{scope}[wikidata][tourism~'^(museum|attraction|gallery|zoo|theme_park)$'];\n"
        f"  nwr{scope}[wikidata][historic];\n"
        f"  nwr{scope}[wikidata][leisure=park];\n"
        f"  nwr{scope}[wikidata][amenity~'^(theatre|university|place_of_worship)$'];\n"
        ");\nout tags center 400;"
    )


class Overpass:
    def __init__(self, p: Providers) -> None:
        self.p, self.s = p, p.s

    async def _run(self, query: str) -> dict[str, Any]:
        last: ApiError | None = None
        for url in self.s.overpass_mirrors:
            try:
                self.p.gov.charge_overpass()
                async with self.p.overpass_sem:
                    r = await self.p.request(
                        "overpass",
                        "overpass",
                        "POST",
                        url,
                        data={"data": query},
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                    )
                self.p.gov.ledger.c["op_bytes"] += len(r.content)
                if r.status_code != 200:
                    raise make_error("UPSTREAM_UNAVAILABLE", provider=PROVIDER)
                data = self.p.json(r, PROVIDER, ("elements",))
                remark = str(data.get("remark", "")).lower()
                if any(k in remark for k in ("runtime error", "timed out", "out of memory")):
                    raise make_error("UPSTREAM_UNAVAILABLE", provider=PROVIDER)
                return data  # type: ignore[no-any-return]
            except ApiError as exc:
                last = exc
                self.p.gov.blocked.pop("overpass", None)  # try the next mirror
        raise last or make_error("UPSTREAM_UNAVAILABLE", provider=PROVIDER)

    async def counts(self, rel: int | None, lat: float, lon: float) -> dict[str, int]:
        data = await self._run(count_query(rel, lat, lon))
        els = [e for e in data["elements"] if e.get("type") == "count"]
        if len(els) != len(CATEGORIES):
            raise make_error("UPSTREAM_BAD_DATA", provider=PROVIDER)
        try:
            return {c: int(e["tags"]["total"]) for c, e in zip(CATEGORIES, els, strict=True)}
        except (KeyError, ValueError) as exc:
            raise make_error("UPSTREAM_BAD_DATA", provider=PROVIDER) from exc

    async def markers(self, rel: int | None, lat: float, lon: float) -> list[dict[str, Any]]:
        data = await self._run(marker_query(rel, lat, lon))
        out = []
        for e in data["elements"]:
            tags = e.get("tags") or {}
            if not tags.get("name"):
                continue
            if "lat" in e and "lon" in e:
                la, lo = e["lat"], e["lon"]
            elif "center" in e:
                la, lo = e["center"]["lat"], e["center"]["lon"]
            else:
                continue
            out.append({"name": tags["name"], "tags": tags, "lat": la, "lon": lo})
        return out
