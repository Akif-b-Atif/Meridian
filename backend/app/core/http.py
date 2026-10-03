"""Provider HTTP layer: timeouts, retries with full jitter, circuit breaker, blocked states."""

from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass
from typing import Any

import httpx

from ..config import Settings
from ..errors import ApiError, make_error
from . import logging as log
from .budget import Governor

RETRY_STATUS = {500, 502, 503, 504}


@dataclass(frozen=True)
class CallProfile:
    connect: float
    read: float
    attempts: int
    max_bytes: int


PROFILES: dict[str, CallProfile] = {
    "om-geocoding": CallProfile(3, 10, 3, 1_000_000),
    "om-archive": CallProfile(5, 60, 2, 5_000_000),
    "om-air": CallProfile(3, 15, 3, 1_000_000),
    "usgs-count": CallProfile(3, 20, 3, 1024),
    "usgs-query": CallProfile(3, 60, 3, 12_000_000),
    "overpass": CallProfile(5, 100, 1, 2_000_000),
    "nominatim": CallProfile(3, 15, 3, 1_000_000),
    "wikimedia": CallProfile(3, 15, 3, 1_000_000),
}


class Breaker:
    def __init__(self) -> None:
        self.failures = 0
        self.open_until = 0.0
        self.half_open = False

    def allow(self) -> bool:
        if time.time() < self.open_until:
            return False
        if self.failures >= 5:
            if self.half_open:
                return False
            self.half_open = True
        return True

    def success(self) -> None:
        self.failures, self.half_open = 0, False

    def failure(self) -> None:
        self.failures += 1
        self.half_open = False
        if self.failures >= 5:
            self.open_until = time.time() + 60


class Spacer:
    """Enforces a minimum gap between request starts."""

    def __init__(self, gap: float) -> None:
        self.gap, self.next = gap, 0.0
        self.lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self.lock:
            delay = self.next - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)
            self.next = time.monotonic() + self.gap


class Providers:
    """Owns one httpx client per provider and applies the shared rules to every call."""

    def __init__(
        self, s: Settings, gov: Governor, transport: httpx.AsyncBaseTransport | None = None
    ):
        self.s, self.gov = s, gov
        headers = {"User-Agent": s.user_agent, "Accept": "application/json"}
        limits = httpx.Limits(max_connections=8, max_keepalive_connections=4)
        names = ["open-meteo", "usgs", "overpass", "nominatim", "wikimedia"]
        self.clients = {
            n: httpx.AsyncClient(
                headers=headers, limits=limits, follow_redirects=False, transport=transport
            )
            for n in names
        }
        self.breakers = {n: Breaker() for n in names}
        self.spacers = {
            "nominatim": Spacer(1.05),
            "overpass": Spacer(2.0),
            "usgs": Spacer(0.25),
            "wikimedia": Spacer(60.0 / s.wikimedia_rpm),
        }
        self.usgs_sem = asyncio.Semaphore(s.usgs_concurrency)
        self.overpass_sem = asyncio.Semaphore(1)

    async def close(self) -> None:
        for c in self.clients.values():
            await c.aclose()

    @staticmethod
    def _display(provider: str) -> str:
        return {
            "open-meteo": "Open-Meteo",
            "usgs": "USGS",
            "overpass": "Overpass",
            "nominatim": "Nominatim",
            "wikimedia": "Wikipedia",
        }.get(provider, provider)

    async def request(
        self,
        provider: str,
        profile: str,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        charge: tuple[str, float] | None = None,
    ) -> httpx.Response:
        prof = PROFILES[profile]
        name = self._display(provider)
        wait = self.gov.blocked_for(provider)
        if wait:
            raise make_error("UPSTREAM_RATE_LIMITED", provider=name, retry_after=wait)
        br = self.breakers[provider]
        last: Exception | None = None
        for attempt in range(1, prof.attempts + 1):
            if not br.allow():
                raise make_error("UPSTREAM_UNAVAILABLE", provider=name)
            if provider in self.spacers:
                await self.spacers[provider].wait()
            if charge:
                await self.gov.charge_open_meteo(*charge)
            t0 = time.monotonic()
            try:
                resp = await self.clients[provider].request(
                    method,
                    url,
                    params=params,
                    data=data,
                    headers=headers,
                    timeout=httpx.Timeout(prof.read, connect=prof.connect),
                )
            except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
                br.failure()
                last = exc
                log.warn(
                    "upstream error", provider=provider, attempt=attempt, error=type(exc).__name__
                )
                await self._backoff(attempt, prof.attempts)
                continue
            ms = int((time.monotonic() - t0) * 1000)
            log.info("upstream", provider=provider, status=resp.status_code, attempt=attempt, ms=ms)
            if resp.status_code == 429:
                self._on_429(provider, resp)
                raise make_error(
                    "UPSTREAM_RATE_LIMITED",
                    provider=name,
                    retry_after=self.gov.blocked_for(provider),
                )
            if resp.status_code in RETRY_STATUS:
                br.failure()
                last = RuntimeError(f"HTTP {resp.status_code}")
                await self._backoff(attempt, prof.attempts)
                continue
            if len(resp.content) > prof.max_bytes:
                raise make_error("UPSTREAM_BAD_DATA", provider=name)
            br.success()
            return resp
        _ = last
        raise make_error("UPSTREAM_UNAVAILABLE", provider=name)

    @staticmethod
    async def _backoff(attempt: int, total: int) -> None:
        if attempt < total:
            await asyncio.sleep(random.uniform(0, min(8, 2 ** (attempt - 1))))

    def _on_429(self, provider: str, resp: httpx.Response) -> None:
        ra = resp.headers.get("Retry-After")
        retry = int(ra) if ra and ra.isdigit() else None
        if provider == "open-meteo":
            try:
                reason = str(resp.json().get("reason", ""))
            except Exception:
                reason = ""
            self.gov.block_open_meteo_from_reason(reason, retry)
        elif provider == "nominatim":
            self.gov.block(provider, 3600)
        elif provider == "wikimedia":
            self.gov.block(provider, retry if retry and retry <= 10 else 60)
        elif provider == "overpass":
            self.gov.block(provider, 120)
        else:
            self.gov.block(provider, retry or 60)

    @staticmethod
    def json(resp: httpx.Response, provider: str, required: tuple[str, ...] = ()) -> Any:
        """Decode JSON and check required keys. Any failure is UPSTREAM_BAD_DATA."""
        try:
            data = resp.json()
        except Exception as exc:
            raise make_error("UPSTREAM_BAD_DATA", provider=provider) from exc
        if isinstance(data, dict):
            if data.get("error") is True and "reason" in data:
                log.error("provider rejected request", provider=provider, reason=data["reason"])
                raise ApiError("INTERNAL", "Something went wrong on our side.")
            for k in required:
                if k not in data:
                    raise make_error("UPSTREAM_BAD_DATA", provider=provider)
        return data
