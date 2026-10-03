"""History module (SDS 8.9)."""

from __future__ import annotations

from typing import Any

from ..core.container import Container
from ..core.runner import Computed, Progress, Spec
from ..errors import ApiError


def make_spec(c: Container, identity_spec: Spec) -> Spec:
    from .identity import get_identity

    async def compute(progress: Progress, args: tuple[int, str | None]) -> Computed:
        geoname_id, ip = args
        ident = await get_identity(c, identity_spec, geoname_id, ip)
        notes: list[str] = []
        progress(1, "Reading Wikidata")
        country: dict[str, Any] | None = None
        cq = ident.get("countryQid")
        if cq:
            key = f"mrd:v1:wdcountry:{cq}"
            entry = await c.cache.get("wdcountry", key)
            if entry and entry.fresh():
                country = entry.payload
            else:
                try:
                    country = await c.wiki.country_facts(cq)
                    await c.cache.put("wdcountry", key, country)
                except ApiError:
                    country = entry.payload if entry else None
        if country is None:
            notes.append("country_facts_failed" if cq else "wikidata_missing")
        progress(2, "Reading Wikipedia")
        wp = None
        title = ident.get("enwikiTitle")
        if title:
            wp = await c.wiki.summary(title)
        if wp is None:
            notes.append("wikipedia_missing")
        data = {"inception": ident.get("inception"), "country": country, "wikipedia": wp}
        return Computed(data, "ok" if not notes else "partial", notes, ["wikidata", "wikipedia"])

    return Spec("history", "history", 2, compute)
