"""Budgets and governors: token bucket, rolling hour, UTC-day ledger, blocked states.

Open-Meteo enforces limits per IP address (600/min, 5,000/hour, 10,000/day) and the free host
shares outbound addresses, so every attempt is charged here before it is sent.
"""

from __future__ import annotations

import asyncio
import math
import time
from collections import deque
from typing import Any

from ..config import Settings
from ..errors import make_error
from . import clock
from .cache import PREFIX, Upstash, next_utc_midnight

FRESH_ESTIMATE = {"fractional": 516, "floored": 1987}


def om_weight(n_vars: int, n_days: int, mode: str) -> float:
    """Weighted cost of one Open-Meteo request. Floored mode counts each factor below 1 as 1."""
    v, d = n_vars / 10, n_days / 14
    if mode == "floored":
        v, d = max(1.0, v), max(1.0, d)
    return v * d


class TokenBucket:
    """Refills continuously. The balance may go negative so any request is admissible."""

    def __init__(self, per_minute: int) -> None:
        self.rate = per_minute / 60.0
        self.capacity = float(per_minute)
        self.tokens = float(per_minute)
        self.t = time.monotonic()

    def _refill(self) -> None:
        n = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (n - self.t) * self.rate)
        self.t = n

    async def acquire(self, w: float) -> None:
        while True:
            self._refill()
            if self.tokens >= min(w, self.capacity):
                self.tokens -= w
                return
            need = min(w, self.capacity) - self.tokens
            await asyncio.sleep(max(0.05, need / self.rate))


class RollingWindow:
    def __init__(self, seconds: int = 3600) -> None:
        self.seconds = seconds
        self.items: deque[tuple[float, float]] = deque()

    def _prune(self) -> None:
        t = time.time()
        while self.items and t - self.items[0][0] >= self.seconds:
            self.items.popleft()

    def add(self, w: float) -> None:
        self.items.append((time.time(), w))

    def used(self) -> float:
        self._prune()
        return sum(w for _, w in self.items)

    def seconds_until_room(self, w: float, cap: float) -> int:
        self._prune()
        total = sum(x for _, x in self.items)
        t = time.time()
        wait = 1.0
        for ts, x in self.items:
            if total + w <= cap:
                break
            total -= x
            wait = ts + self.seconds - t
        return max(1, math.ceil(wait))


FIELDS = [
    "om_total",
    "om_fresh",
    "om_search",
    "om_air",
    "om_other",
    "fresh_cities",
    "op_req",
    "op_bytes",
]


class Ledger:
    """Counters for the current UTC day, persisted to Redis at most once a minute."""

    def __init__(self, redis: Upstash | None = None) -> None:
        self.redis = redis
        self.date = clock.today().isoformat()
        self.c: dict[str, float] = dict.fromkeys(FIELDS, 0)
        self.fresh_ids: set[int] = set()
        self.hours: dict[int, float] = {}
        self.dirty = False
        self.last_flush = 0.0

    def roll(self) -> None:
        d = clock.today().isoformat()
        if d != self.date:
            self.date = d
            self.c = dict.fromkeys(FIELDS, 0)
            self.fresh_ids.clear()
            self.hours.clear()
            self.dirty = True

    def charge(self, category: str, w: float) -> None:
        self.roll()
        self.c["om_total"] += w
        self.c[f"om_{category}"] = self.c.get(f"om_{category}", 0) + w
        h = clock.now().hour
        self.hours[h] = self.hours.get(h, 0) + w
        self.dirty = True

    def key(self) -> str:
        return f"{PREFIX}budget:{self.date.replace('-', '')}"

    async def maybe_flush(self, force: bool = False, interval: float = 60.0) -> None:
        if not self.redis or not self.redis.available or not self.dirty:
            return
        if not force and time.time() - self.last_flush < interval:
            return
        self.last_flush = time.time()
        self.dirty = False
        cmd: list[Any] = ["HSET", self.key()]
        for f in FIELDS:
            cmd += [f, self.c[f]]
        for h, w in self.hours.items():
            cmd += [f"om_h{h:02d}", w]
        await self.redis.pipeline([cmd, ["EXPIRE", self.key(), 172800]])

    async def restore(self) -> dict[int, float]:
        if not self.redis or not self.redis.available:
            return {}
        res = await self.redis.pipeline([["HGETALL", self.key()]])
        flat = res[0] if res else None
        if not flat:
            return {}
        d = dict(zip(flat[::2], flat[1::2], strict=False))
        for f in FIELDS:
            if f in d:
                self.c[f] = float(d[f])
        self.hours = {int(k[4:]): float(v) for k, v in d.items() if k.startswith("om_h")}
        return self.hours


class Governor:
    """Admission control for provider calls and fresh-city computations."""

    def __init__(self, s: Settings, ledger: Ledger) -> None:
        self.s = s
        self.ledger = ledger
        self.bucket = TokenBucket(s.om_minute_rate)
        self.hourly = RollingWindow()
        self.blocked: dict[str, float] = {}
        self.ip_fresh_check: Any = None  # set by the container (SlidingWindow)

    # -- blocked states -------------------------------------------------
    def block(self, provider: str, seconds: float) -> None:
        self.blocked[provider] = time.time() + seconds

    def blocked_for(self, provider: str) -> int:
        return max(0, math.ceil(self.blocked.get(provider, 0) - time.time()))

    def seed_hourly(self, hours: dict[int, float]) -> None:
        h = clock.now().hour
        pess = hours.get(h, 0) + hours.get((h - 1) % 24, 0)
        if pess:
            self.hourly.add(pess)

    def block_open_meteo_from_reason(self, reason: str, retry_after: int | None) -> int:
        r = reason.lower()
        now = clock.now()
        if "minutely" in r:
            secs = 65
        elif "hourly" in r:
            nxt = now.replace(minute=0, second=5, microsecond=0)
            secs = int((nxt - now).total_seconds()) % 3600 + 3600 * (nxt <= now)
            self.hourly.add(max(0, self.s.om_hourly_cap - self.hourly.used()))
        elif "daily" in r:
            secs = int((next_utc_midnight() - now).total_seconds()) + 60
            self.ledger.c["om_total"] = self.s.om_daily_hard_cap
            self.ledger.dirty = True
        else:
            secs = min(retry_after, 3600) if retry_after else 65
        self.block("open-meteo", secs)
        return secs

    # -- limits ---------------------------------------------------------
    def effective_fresh_limit(self) -> int:
        est = FRESH_ESTIMATE[self.s.om_weight_model]
        budget = self.s.om_daily_hard_cap - self.s.om_light_reserve
        return min(self.s.fresh_city_daily_limit, budget // est)

    def admit_fresh(self, geoname_id: int, est: int, ip: str | None) -> None:
        self.ledger.roll()
        wait = self.blocked_for("open-meteo")
        if wait:
            raise make_error("UPSTREAM_RATE_LIMITED", provider="Open-Meteo", retry_after=wait)
        if geoname_id not in self.ledger.fresh_ids:
            if self.ledger.c["fresh_cities"] >= self.effective_fresh_limit():
                raise make_error("BUDGET_EXHAUSTED")
            if ip and self.ip_fresh_check is not None:
                self.ip_fresh_check.check_only(ip)
        if self.ledger.c["om_total"] + est > self.s.om_daily_hard_cap - self.s.om_light_reserve:
            raise make_error("BUDGET_EXHAUSTED")
        if self.hourly.used() + est > self.s.om_hourly_cap:
            raise make_error(
                "HOURLY_LIMIT",
                retry_after=self.hourly.seconds_until_room(est, self.s.om_hourly_cap),
            )
        if geoname_id not in self.ledger.fresh_ids:
            self.ledger.fresh_ids.add(geoname_id)
            self.ledger.c["fresh_cities"] += 1
            if ip and self.ip_fresh_check is not None:
                self.ip_fresh_check.add(ip)
            self.ledger.dirty = True

    def admit_light(self, category: str) -> None:
        self.ledger.roll()
        caps = {"search": self.s.om_search_daily_cap, "air": self.s.om_air_daily_cap}
        wait = self.blocked_for("open-meteo")
        if wait:
            raise make_error("UPSTREAM_RATE_LIMITED", provider="Open-Meteo", retry_after=wait)
        if (
            self.ledger.c["om_total"] + 1 > self.s.om_daily_hard_cap
            or self.hourly.used() + 1 > self.s.om_hourly_cap
            or self.ledger.c.get(f"om_{category}", 0) >= caps.get(category, 1e9)
        ):
            raise make_error("BUDGET_EXHAUSTED")

    async def charge_open_meteo(self, category: str, weight: float) -> None:
        await self.bucket.acquire(weight)
        self.ledger.charge(category, weight)
        self.hourly.add(weight)

    def charge_overpass(self, nbytes: int = 0) -> None:
        self.ledger.roll()
        if self.ledger.c["op_req"] >= self.s.overpass_daily_cap or (
            self.ledger.c["op_bytes"] >= self.s.overpass_daily_bytes
        ):
            raise make_error("UPSTREAM_RATE_LIMITED", provider="Overpass", retry_after=3600)
        self.ledger.c["op_req"] += 1
        self.ledger.c["op_bytes"] += nbytes
        self.ledger.dirty = True

    def snapshot(self) -> dict[str, Any]:
        self.ledger.roll()
        return {
            "freshCitiesToday": int(self.ledger.c["fresh_cities"]),
            "freshCitiesLimit": self.effective_fresh_limit(),
            "resetsAt": next_utc_midnight().strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
