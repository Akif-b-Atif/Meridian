"""Nominatim boundary lookup (SDS 7.5). Never used for autocomplete."""

from __future__ import annotations

from typing import Any

from ..core.http import Providers
from ..errors import ApiError


class Nominatim:
    def __init__(self, p: Providers) -> None:
        self.p, self.s = p, p.s

    async def lookup(self, rel: int) -> dict[str, Any] | None:
        r = await self.p.request(
            "nominatim",
            "nominatim",
            "GET",
            f"{self.s.nominatim_base}/lookup",
            params={
                "osm_ids": f"R{rel}",
                "format": "jsonv2",
                "polygon_geojson": 1,
                "polygon_threshold": 0.001,
                "accept-language": "en",
            },
        )
        data = self.p.json(r, "Nominatim")
        if isinstance(data, list) and data:
            g = data[0].get("geojson")
            if g and g.get("type") in ("Polygon", "MultiPolygon"):
                return {"geojson": g, "osm_id": rel}
        return None

    async def search(self, name: str, country: str) -> list[dict[str, Any]]:
        r = await self.p.request(
            "nominatim",
            "nominatim",
            "GET",
            f"{self.s.nominatim_base}/search",
            params={
                "q": f"{name}, {country}",
                "format": "jsonv2",
                "polygon_geojson": 1,
                "polygon_threshold": 0.001,
                "limit": 5,
                "accept-language": "en",
            },
        )
        data = self.p.json(r, "Nominatim")
        return data if isinstance(data, list) else []

    def blocked(self) -> bool:
        return bool(self.p.gov.blocked_for("nominatim")) or not self.p.breakers["nominatim"].allow()


__all__ = ["ApiError", "Nominatim"]
