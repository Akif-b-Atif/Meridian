"""Application container: one place that owns settings, cache, governors and adapters."""

from __future__ import annotations

import asyncio
from pathlib import Path

import httpx

from ..adapters.nominatim import Nominatim
from ..adapters.open_meteo import OpenMeteo
from ..adapters.overpass import Overpass
from ..adapters.usgs import Usgs
from ..adapters.wikimedia import Wikimedia
from ..analysis.water import WaterIndex
from ..config import Settings
from .budget import Governor, Ledger
from .cache import Cache, Upstash
from .http import Providers
from .ratelimit import SlidingWindow
from .runner import ModuleRunner

SOURCES: dict[str, dict[str, str]] = {
    "open-meteo": {"id": "open-meteo", "text": "Weather data by Open-Meteo.com (CC BY 4.0)", "url": "https://open-meteo.com/"},
    "era5": {"id": "era5", "text": "Contains modified Copernicus Climate Change Service information (ERA5)", "url": "https://climate.copernicus.eu/"},
    "geonames": {"id": "geonames", "text": "Place data from GeoNames (CC BY 4.0)", "url": "https://www.geonames.org/"},
    "usgs": {"id": "usgs", "text": "Earthquake data: U.S. Geological Survey", "url": "https://earthquake.usgs.gov/"},
    "osm": {"id": "osm", "text": "Map data from OpenStreetMap, ODbL, (c) OpenStreetMap contributors", "url": "https://www.openstreetmap.org/copyright"},
    "wikidata": {"id": "wikidata", "text": "Wikidata (CC0)", "url": "https://www.wikidata.org/"},
    "wikipedia": {"id": "wikipedia", "text": "Text from Wikipedia (CC BY-SA 4.0)", "url": "https://en.wikipedia.org/"},
    "natural-earth": {"id": "natural-earth", "text": "Natural Earth (public domain)", "url": "https://www.naturalearthdata.com/"},
}  # fmt: skip


def lookup_sources(ids: list[str]) -> list[dict[str, str]]:
    return [SOURCES[i] for i in ids if i in SOURCES]


class Container:
    def __init__(self, s: Settings, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.s = s
        self.redis = Upstash(s.upstash_redis_rest_url, s.upstash_redis_rest_token)
        self.cache = Cache(s.l1_max_bytes, self.redis, s.redis_economy_cmds, s.redis_survival_cmds)
        self.ledger = Ledger(self.redis)
        self.gov = Governor(s, self.ledger)
        self.fresh_ip = SlidingWindow(s.fresh_per_ip_hour, 3600)
        self.gov.ip_fresh_check = self.fresh_ip
        self.http_limit = SlidingWindow(s.rate_limit_per_min, 60)
        self.providers = Providers(s, self.gov, transport)
        self.om = OpenMeteo(self.providers)
        self.usgs = Usgs(self.providers)
        self.overpass = Overpass(self.providers)
        self.nominatim = Nominatim(self.providers)
        self.wiki = Wikimedia(self.providers)
        self.runner = ModuleRunner(self.cache, s.inline_wait_s, lookup_sources)
        self.analysis_sem = asyncio.Semaphore(s.analysis_concurrency)
        self.water: WaterIndex | None = None
        self.warm = asyncio.Event()
        self.water_path = Path(__file__).resolve().parent.parent / "data" / "water_index.gpkg"
        self._flush_task: asyncio.Task[None] | None = None

    async def warmup(self) -> None:
        """Background start-up: connect to Redis, restore the ledger, import scipy, load the index."""
        if self.redis.configured:
            await self.redis.command_ping()
            await self.redis.load_meter()
            hours = await self.ledger.restore()
            self.gov.seed_hourly(hours)
        await asyncio.to_thread(self._heavy)
        self.warm.set()
        self._flush_task = asyncio.create_task(self._flusher())

    def _heavy(self) -> None:
        import scipy.special
        import scipy.stats  # noqa: F401

        if self.water_path.exists():
            self.water = WaterIndex.load(self.water_path)

    async def _flusher(self) -> None:
        while True:
            await asyncio.sleep(15)
            interval = (
                300.0
                if self.redis.level(self.s.redis_economy_cmds, self.s.redis_survival_cmds)
                != "normal"
                else 60.0
            )
            await self.ledger.maybe_flush(interval=interval)
            await self.redis.flush_meter()

    async def close(self) -> None:
        if self._flush_task:
            self._flush_task.cancel()
        await self.ledger.maybe_flush(force=True)
        await self.redis.flush_meter()
        await self.providers.close()
        await self.redis.close()
