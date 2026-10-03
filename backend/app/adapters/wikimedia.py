"""Wikidata and Wikipedia adapters (SDS 7.6, 7.7). One shared Wikimedia rate bucket."""

from __future__ import annotations

import re
from typing import Any

from ..analysis.seismic import haversine_km
from ..core.http import Providers
from ..errors import make_error

AREA_UNITS = {
    "Q712226": 1.0,
    "Q25343": 1e-6,
    "Q35852": 0.01,
    "Q232291": 2.589988,
    "Q81292": 0.00404686,
}
BASE = {"format": "json", "formatversion": 2}


def _best(claims: list[dict[str, Any]]) -> dict[str, Any] | None:
    live = [c for c in claims if c.get("rank") != "deprecated"]
    pref = [c for c in live if c.get("rank") == "preferred"]
    chosen = pref or live
    return chosen[0] if chosen else None


def _value(claim: dict[str, Any]) -> Any:
    return claim.get("mainsnak", {}).get("datavalue", {}).get("value")


def parse_population(claims: list[dict[str, Any]]) -> dict[str, Any] | None:
    live = [c for c in claims if c.get("rank") != "deprecated"]
    if not live:
        return None
    pref = [c for c in live if c.get("rank") == "preferred"]

    def year(c: dict[str, Any]) -> int | None:
        q = c.get("qualifiers", {}).get("P585")
        if not q:
            return None
        t = q[0].get("datavalue", {}).get("value", {}).get("time", "")
        m = re.match(r"[+-]?(\d{4})", t)
        return int(m.group(1)) if m else None

    chosen = pref[0] if pref else max(live, key=lambda c: year(c) or -1)
    v = _value(chosen)
    if not v:
        return None
    return {"value": int(float(v["amount"])), "year": year(chosen)}


def parse_inception(claims: list[dict[str, Any]]) -> dict[str, Any] | None:
    c = _best(claims)
    v = _value(c) if c else None
    if not v:
        return None
    m = re.match(r"([+-])(\d+)-", v["time"])
    if not m:
        return None
    prec = v.get("precision", 9)
    if prec < 7:
        return None
    year = int(m.group(2)) * (-1 if m.group(1) == "-" else 1)
    return {"year": year, "precision": min(prec, 9)}


def parse_area(claims: list[dict[str, Any]]) -> float | None:
    c = _best(claims)
    v = _value(c) if c else None
    if not v:
        return None
    unit = str(v.get("unit", "")).rsplit("/", 1)[-1]
    f = AREA_UNITS.get(unit)
    return None if f is None else round(float(v["amount"]) * f, 2)


def trim_extract(text: str, limit: int = 1100) -> str:
    if len(text) <= limit:
        return text
    cut = None
    for m in re.finditer(r"[.!?](?=\s+[A-Z0-9])", text[:limit]):
        cut = m.end()
    if cut and cut > 300:
        return text[:cut]
    sp = text.rfind(" ", 0, limit)
    return text[: sp if sp > 0 else limit] + "…"


class Wikimedia:
    def __init__(self, p: Providers) -> None:
        self.p, self.s = p, p.s

    async def _get(self, api: str, params: dict[str, Any]) -> Any:
        r = await self.p.request("wikimedia", "wikimedia", "GET", api, params={**BASE, **params})
        return self.p.json(r, "Wikidata" if "wikidata" in api else "Wikipedia")

    # -- Wikidata -------------------------------------------------------
    async def find_qid(self, geoname_id: int) -> str | None:
        d = await self._get(
            self.s.wikidata_api,
            {
                "action": "query",
                "list": "search",
                "srsearch": f"haswbstatement:P1566={geoname_id}",
                "srlimit": 2,
            },
        )
        res = d.get("query", {}).get("search", [])
        return res[0]["title"] if res else None

    async def city_entity(self, qid: str) -> dict[str, Any]:
        d = await self._get(
            self.s.wikidata_api,
            {
                "action": "wbgetentities",
                "ids": qid,
                "props": "claims|sitelinks|labels",
                "sitefilter": "enwiki",
                "languages": "en",
            },
        )
        ent = d.get("entities", {}).get(qid)
        if not ent:
            raise make_error("UPSTREAM_BAD_DATA", provider="Wikidata")
        claims = ent.get("claims", {})
        rel = None
        c = _best(claims.get("P402", []))
        if c and str(_value(c) or "").isdigit():
            rel = int(_value(c))
        country = None
        c = _best(claims.get("P17", []))
        if c and _value(c):
            country = _value(c).get("id")
        return {
            "population": parse_population(claims.get("P1082", [])),
            "inception": parse_inception(claims.get("P571", [])),
            "areaKm2": parse_area(claims.get("P2046", [])),
            "osmRelationId": rel,
            "countryQid": country,
            "enwikiTitle": (ent.get("sitelinks", {}).get("enwiki") or {}).get("title"),
        }

    async def country_facts(self, qid: str) -> dict[str, Any]:
        d = await self._get(
            self.s.wikidata_api,
            {"action": "wbgetentities", "ids": qid, "props": "claims", "languages": "en"},
        )
        claims = d.get("entities", {}).get(qid, {}).get("claims", {})

        def ids(prop: str, current_only: bool = False) -> list[str]:
            out = []
            for c in claims.get(prop, []):
                if c.get("rank") == "deprecated":
                    continue
                if current_only and "P582" in c.get("qualifiers", {}):
                    continue
                v = _value(c)
                if isinstance(v, dict) and "id" in v:
                    out.append(v["id"])
            return out

        currencies, languages = ids("P38", True), ids("P37")
        cap = ids("P36")[:1]
        side = ids("P1622")[:1]
        call = None
        c = _best(claims.get("P474", []))
        if c and isinstance(_value(c), str):
            digits = _value(c).replace(" ", "")
            call = digits if digits.startswith("+") else f"+{digits}"
        want = list(dict.fromkeys([qid, *currencies, *languages, *cap]))[:50]
        labels: dict[str, str] = {}
        if want:
            ld = await self._get(
                self.s.wikidata_api,
                {
                    "action": "wbgetentities",
                    "ids": "|".join(want),
                    "props": "labels",
                    "languages": "en",
                },
            )
            for k, e in ld.get("entities", {}).items():
                lab = (e.get("labels") or {}).get("en", {}).get("value")
                if lab:
                    labels[k] = lab
        return {
            "name": labels.get(qid),
            "currencies": [labels[i] for i in currencies if i in labels],
            "languages": [labels[i] for i in languages if i in labels],
            "capital": labels.get(cap[0]) if cap else None,
            "callingCode": call,
            "drivingSide": {"Q14565199": "right", "Q13196750": "left"}.get(side[0])
            if side
            else None,
        }

    # -- Wikipedia ------------------------------------------------------
    async def summary(self, title: str) -> dict[str, Any] | None:
        d = await self._get(
            self.s.wikipedia_api,
            {
                "action": "query",
                "prop": "extracts",
                "exintro": 1,
                "explaintext": 1,
                "redirects": 1,
                "titles": title,
            },
        )
        pages = d.get("query", {}).get("pages", [])
        text = (pages[0].get("extract") if pages else "") or ""
        if not text:
            return None
        return {
            "text": trim_extract(text.strip()),
            "url": "https://en.wikipedia.org/wiki/" + title.replace(" ", "_"),
            "license": "CC BY-SA 4.0",
        }

    async def nearby(self, lat: float, lon: float, own_title: str | None) -> dict[str, Any]:
        d = await self._get(
            self.s.wikipedia_api,
            {
                "action": "query",
                "generator": "geosearch",
                "ggscoord": f"{lat}|{lon}",
                "ggsradius": 10000,
                "ggslimit": 50,
                "prop": "pageviews|coordinates|description",
                "pvipdays": 30,
                "colimit": "max",
            },
        )
        arts = []
        for pg in d.get("query", {}).get("pages", []):
            if own_title and pg.get("title") == own_title:
                continue
            co = (pg.get("coordinates") or [None])[0]
            if not co:
                continue
            views = sum(v or 0 for v in (pg.get("pageviews") or {}).values())
            arts.append(
                {
                    "title": pg["title"],
                    "description": pg.get("description"),
                    "lat": co["lat"],
                    "lon": co["lon"],
                    "views": views,
                    "distanceKm": haversine_km(lat, lon, co["lat"], co["lon"]),
                }
            )
        by_views = any(a["views"] for a in arts)
        arts.sort(key=lambda a: (-a["views"], a["distanceKm"]) if by_views else (a["distanceKm"],))
        return {"articles": arts[:10], "ranking": "views" if by_views else "distance"}
