"""Search: one cached geocoding call answered inline (SDS 8.2)."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from ..core.container import Container
from ..errors import invalid


def clean_query(q: str) -> str:
    q = unicodedata.normalize("NFKC", q)
    q = "".join(ch for ch in q if unicodedata.category(ch) not in ("Cc", "Cf"))
    q = re.sub(r"\s+", " ", q).strip()
    if not 3 <= len(q) <= 80:
        raise invalid("Type at least 3 characters (at most 80).")
    return q


async def search(c: Container, q: str) -> tuple[dict[str, Any], str]:
    q = clean_query(q)
    key = f"mrd:v1:search:en:{unicodedata.normalize('NFKC', q).casefold()}"
    entry = await c.cache.get("search", key)
    if entry and entry.fresh():
        return {"results": entry.payload}, entry.computed_at
    try:
        c.gov.admit_light("search")
        results = await c.om.search(q)
    except Exception:
        if entry:
            return {"results": entry.payload}, entry.computed_at
        raise
    e = await c.cache.put("search", key, results)
    return {"results": results}, e.computed_at
