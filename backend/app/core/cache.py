"""Two-level cache: in-process LRU (L1) and Upstash Redis over REST (L2).

Entries carry a soft expiry (freshness) and the Redis key a longer hard expiry, so stale data
can still be served when a provider fails.
"""

from __future__ import annotations

import base64
import time
import zlib
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import httpx
import orjson

from . import logging as log
from .clock import now

MAX_COMPRESSED = 512 * 1024
PREFIX = "mrd:v1:"
DAY = 86400


@dataclass(frozen=True)
class Ttl:
    soft: int  # seconds
    hard: int
    l1: int
    refresh: str = "blocking"  # or "swr"


TTLS: dict[str, Ttl] = {
    "search": Ttl(7 * DAY, 14 * DAY, 3600),
    "identity": Ttl(90 * DAY, 120 * DAY, 3600),
    "climate": Ttl(90 * DAY, 100 * DAY, 3600, "swr"),
    "seismic": Ttl(DAY, 7 * DAY, 3600),
    "places": Ttl(30 * DAY, 60 * DAY, 3600),
    "boundary": Ttl(180 * DAY, 200 * DAY, 3600),
    "history": Ttl(30 * DAY, 60 * DAY, 3600),
    "wdcountry": Ttl(90 * DAY, 120 * DAY, 3600),
    "air": Ttl(900, 900, 900),
}

# Modules whose L2 reads/writes survive "survival" mode (SDS 6.5.6).
SURVIVAL_L2 = {"identity", "climate", "boundary", "places", "history"}
SURVIVAL_L2_WRITE = {"identity", "climate", "boundary"}
L1_ONLY = {"air"}


@dataclass
class Entry:
    computed_at: str
    soft_expires_at: float  # epoch seconds
    payload: Any

    def fresh(self) -> bool:
        return time.time() < self.soft_expires_at


def encode(entry: Entry) -> bytes:
    return orjson.dumps(
        {
            "v": 1,
            "computedAt": entry.computed_at,
            "softExpiresAt": entry.soft_expires_at,
            "payload": entry.payload,
        }
    )


def decode(raw: bytes) -> Entry:
    d = orjson.loads(raw)
    return Entry(d["computedAt"], d["softExpiresAt"], d["payload"])


def pack(raw: bytes) -> str | None:
    comp = zlib.compress(raw, 6)
    if len(comp) > MAX_COMPRESSED:
        return None
    return base64.b64encode(comp).decode()


def unpack(text: str) -> bytes:
    return zlib.decompress(base64.b64decode(text))


class L1:
    def __init__(self, max_bytes: int) -> None:
        self.max_bytes = max_bytes
        self.size = 0
        self.data: OrderedDict[str, tuple[bytes, float]] = OrderedDict()

    def get(self, key: str) -> bytes | None:
        item = self.data.get(key)
        if item is None:
            return None
        raw, exp = item
        if time.time() >= exp:
            self._drop(key)
            return None
        self.data.move_to_end(key)
        return raw

    def set(self, key: str, raw: bytes, ttl: int) -> None:
        if key in self.data:
            self._drop(key)
        self.data[key] = (raw, time.time() + ttl)
        self.size += len(raw)
        while self.size > self.max_bytes and self.data:
            oldest = next(iter(self.data))
            self._drop(oldest)

    def _drop(self, key: str) -> None:
        raw, _ = self.data.pop(key)
        self.size -= len(raw)


class Upstash:
    """Minimal Upstash REST client with a failure circuit that falls back to memory mode."""

    def __init__(self, url: str | None, token: str | None) -> None:
        self.url = url.rstrip("/") if url else None
        self.token = token
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(4.0, connect=2.0))
        self.failures = 0
        self.memory_until = 0.0
        self.commands = 0
        self.unflushed = 0
        self.month_used = 0

    @property
    def configured(self) -> bool:
        return bool(self.url and self.token)

    @property
    def available(self) -> bool:
        return self.configured and time.time() >= self.memory_until

    @property
    def mode(self) -> str:
        return "redis" if self.available else "memory"

    def level(self, economy: int, survival: int) -> str:
        used = self.month_used + self.unflushed
        return "survival" if used >= survival else ("economy" if used >= economy else "normal")

    async def pipeline(self, commands: list[list[Any]]) -> list[Any]:
        if not self.available:
            return []
        try:
            r = await self.client.post(
                f"{self.url}/pipeline",
                json=commands,
                headers={"Authorization": f"Bearer {self.token}"},
            )
            r.raise_for_status()
            out = r.json()
            self._ok(len(commands))
            return [
                x.get("result") if isinstance(x, dict) and "error" not in x else None for x in out
            ]
        except Exception as exc:
            self._fail(exc)
            return []

    async def _post(self, url: str, body: list[Any], n: int) -> Any:
        if not self.available:
            return None
        try:
            r = await self.client.post(
                url, json=body, headers={"Authorization": f"Bearer {self.token}"}
            )
            r.raise_for_status()
            data = r.json()
            if "error" in data:
                raise RuntimeError(data["error"])
            self._ok(n)
            return data.get("result")
        except Exception as exc:
            self._fail(exc)
            return None

    def _ok(self, n: int) -> None:
        self.failures = 0
        self.unflushed += n

    def _fail(self, exc: Exception) -> None:
        self.failures += 1
        log.warn("upstash failure", error=type(exc).__name__, failures=self.failures)
        if self.failures >= 3:
            self.memory_until = time.time() + 600
            self.failures = 0
            log.warn("upstash entering memory mode for 10 minutes")

    async def command_ping(self) -> None:
        await self._post(self.url or "", ["PING"], 1)

    async def get(self, key: str) -> str | None:
        r = await self._post(self.url or "", ["GET", key], 1)
        return r if isinstance(r, str) else None

    async def set(self, key: str, value: str, ex: int) -> None:
        await self._post(self.url or "", ["SET", key, value, "EX", ex], 1)

    async def flush_meter(self) -> None:
        if not self.available or self.unflushed < 100:
            return
        month = now().strftime("%Y%m")
        n, self.unflushed = self.unflushed, 0
        r = await self._post(self.url or "", ["INCRBY", f"{PREFIX}meta:cmds:{month}", n], 1)
        if isinstance(r, int):
            self.month_used = r

    async def load_meter(self) -> None:
        month = now().strftime("%Y%m")
        r = await self._post(self.url or "", ["GET", f"{PREFIX}meta:cmds:{month}"], 1)
        if isinstance(r, str) and r.isdigit():
            self.month_used = int(r)

    async def close(self) -> None:
        await self.client.aclose()


class Cache:
    def __init__(self, l1_max: int, redis: Upstash, economy: int, survival: int) -> None:
        self.l1 = L1(l1_max)
        self.redis = redis
        self.economy = economy
        self.survival = survival

    @property
    def mode(self) -> str:
        return self.redis.mode

    def _l2_allowed(self, kind: str, write: bool) -> bool:
        if kind in L1_ONLY or not self.redis.available:
            return False
        lvl = self.redis.level(self.economy, self.survival)
        if lvl == "survival":
            return kind in (SURVIVAL_L2_WRITE if write else SURVIVAL_L2)
        return not (lvl == "economy" and kind == "search")

    async def get(self, kind: str, key: str) -> Entry | None:
        raw = self.l1.get(key)
        if raw is not None:
            e = decode(raw)
            return e
        if not self._l2_allowed(kind, False):
            return None
        text = await self.redis.get(key)
        if not text:
            return None
        try:
            raw = unpack(text)
            e = decode(raw)
        except Exception:
            log.warn("cache decode failed", key=key)
            return None
        self.l1.set(key, raw, self._l1_ttl(kind, e))
        return e

    def _l1_ttl(self, kind: str, e: Entry) -> int:
        return max(1, int(min(TTLS[kind].l1, e.soft_expires_at - time.time())))

    async def put(
        self, kind: str, key: str, payload: Any, soft_override: int | None = None
    ) -> Entry:
        t = TTLS[kind]
        soft = soft_override or t.soft
        entry = Entry(
            computed_at=now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            soft_expires_at=time.time() + soft,
            payload=payload,
        )
        raw = encode(entry)
        self.l1.set(key, raw, self._l1_ttl(kind, entry))
        if self._l2_allowed(kind, True):
            packed = pack(raw)
            if packed is None:
                log.warn("cache value too large for redis", key=key, bytes=len(raw))
            else:
                await self.redis.set(key, packed, soft_override if soft_override else t.hard)
        return entry


def expiry_iso(seconds: int) -> str:
    return (now() + timedelta(seconds=seconds)).isoformat()


def next_utc_midnight() -> datetime:
    n = now()
    return (n + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
