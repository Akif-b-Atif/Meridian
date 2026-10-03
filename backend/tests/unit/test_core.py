from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime

import pytest

from app.config import Settings
from app.core import clock
from app.core.budget import Governor, Ledger, RollingWindow, TokenBucket, om_weight
from app.core.cache import L1, MAX_COMPRESSED, Cache, Entry, Upstash, decode, encode, pack, unpack
from app.core.ratelimit import SlidingWindow
from app.core.runner import Computed, ModuleRunner, Spec
from app.errors import ApiError
from app.services.search import clean_query


def test_om_weight_table() -> None:
    assert om_weight(1, 27759, "fractional") == pytest.approx(198.3, abs=0.1)
    assert om_weight(4, 10958, "fractional") == pytest.approx(313.1, abs=0.1)
    assert om_weight(1, 27759, "floored") == pytest.approx(1982.8, abs=0.1)
    assert om_weight(4, 10958, "floored") == pytest.approx(782.7, abs=0.1)
    assert om_weight(1, 700, "fractional") == pytest.approx(5.0)
    assert om_weight(1, 700, "floored") == pytest.approx(50.0)


async def test_token_bucket_goes_negative_and_recovers() -> None:
    b = TokenBucket(600)  # 10 tokens per second, capacity 600
    await b.acquire(1000)  # heavier than capacity: admitted once the bucket is full
    assert b.tokens < 0
    t = time.monotonic()
    await b.acquire(3)  # must wait for the balance to recover
    assert time.monotonic() - t > 0.3


def test_rolling_window() -> None:
    w = RollingWindow(3600)
    w.add(2000)
    w.add(1500)
    assert w.used() == 3500
    assert w.seconds_until_room(1000, 4000) >= 1


def _gov(**kw: object) -> Governor:
    s = Settings(**kw)  # type: ignore[arg-type]
    return Governor(s, Ledger())


def test_fresh_city_limit_and_reruns() -> None:
    g = _gov(fresh_city_daily_limit=15)
    for i in range(15):
        g.admit_fresh(i + 1, 516, None)
    with pytest.raises(ApiError) as e:
        g.admit_fresh(99, 516, None)
    assert e.value.code == "BUDGET_EXHAUSTED"
    g.admit_fresh(3, 516, None)  # re-run of a reserved id is not counted twice
    assert g.ledger.c["fresh_cities"] == 15


def test_floored_model_lowers_limit() -> None:
    g = _gov(om_weight_model="floored")
    assert g.effective_fresh_limit() == 4


def test_per_ip_fresh_limit() -> None:
    g = _gov()
    g.ip_fresh_check = SlidingWindow(5, 3600)
    for i in range(5):
        g.admit_fresh(i + 1, 516, "1.2.3.4")
    with pytest.raises(ApiError) as e:
        g.admit_fresh(50, 516, "1.2.3.4")
    assert e.value.code == "RATE_LIMITED"


def test_block_reasons() -> None:
    g = _gov()
    assert g.block_open_meteo_from_reason("Minutely API request limit exceeded", None) == 65
    secs = g.block_open_meteo_from_reason("Daily API request limit exceeded", None)
    assert secs > 60
    assert g.ledger.c["om_total"] == g.s.om_daily_hard_cap
    with pytest.raises(ApiError) as e:
        g.admit_light("search")
    assert e.value.code == "UPSTREAM_RATE_LIMITED"


def test_utc_midnight_reset() -> None:
    clock.set_clock(lambda: datetime(2026, 10, 1, 23, 59, tzinfo=UTC))
    try:
        led = Ledger()
        led.charge("search", 5)
        clock.set_clock(lambda: datetime(2026, 10, 2, 0, 1, tzinfo=UTC))
        led.roll()
        assert led.c["om_total"] == 0
    finally:
        clock.set_clock(None)


def test_overpass_caps() -> None:
    g = _gov(overpass_daily_cap=2)
    g.charge_overpass()
    g.charge_overpass()
    with pytest.raises(ApiError):
        g.charge_overpass()


def test_sliding_window() -> None:
    w = SlidingWindow(3, 60)
    for _ in range(3):
        w.check_and_add("a")
    with pytest.raises(ApiError) as e:
        w.check_and_add("a")
    assert e.value.code == "RATE_LIMITED" and e.value.retry_after
    w.check_and_add("b")


def test_l1_lru_by_bytes() -> None:
    c = L1(100)
    c.set("a", b"x" * 60, 60)
    c.set("b", b"x" * 60, 60)
    assert c.get("a") is None and c.get("b") is not None
    c.set("c", b"x" * 30, 60)
    assert c.get("b") is not None and c.size <= 100


def test_pack_roundtrip_and_cap() -> None:
    raw = encode(Entry("2026-01-01T00:00:00Z", time.time() + 10, {"a": list(range(1000))}))
    assert decode(unpack(pack(raw) or "")).payload["a"][999] == 999
    import os

    assert pack(os.urandom(MAX_COMPRESSED + 10)) is None


def test_clean_query() -> None:
    assert clean_query("  Spring\u200bfield  ") == "Springfield"
    for bad in ("ab", "x" * 81, "  a "):
        with pytest.raises(ApiError):
            clean_query(bad)


async def test_cache_soft_and_hard() -> None:
    cache = Cache(10_000_000, Upstash(None, None), 1, 2)
    await cache.put("identity", "k", {"x": 1})
    e = await cache.get("identity", "k")
    assert e is not None and e.fresh()
    e.soft_expires_at = time.time() - 1
    assert not e.fresh()


def _runner() -> tuple[ModuleRunner, Cache]:
    cache = Cache(10_000_000, Upstash(None, None), 1, 2)
    return ModuleRunner(cache, 0.2, lambda ids: []), cache


async def test_single_flight_and_202() -> None:
    runner, _ = _runner()
    calls = 0

    async def compute(progress, args):  # type: ignore[no-untyped-def]
        nonlocal calls
        calls += 1
        progress(1, "working")
        await asyncio.sleep(0.5)
        return Computed({"v": 1})

    spec = Spec("seismic", "seismic", 1, compute)
    r1, r2 = await asyncio.gather(runner.get(spec, "k", 1), runner.get(spec, "k", 1))
    assert r1[0] == 202 and r2[0] == 202
    assert r1[1]["progress"]["label"] == "working"
    await asyncio.sleep(0.6)
    code, body = await runner.get(spec, "k", 1)
    assert code == 200 and body["data"] == {"v": 1} and calls == 1


async def test_failure_table_and_busy() -> None:
    runner, _ = _runner()

    async def boom(progress, args):  # type: ignore[no-untyped-def]
        raise ApiError("UPSTREAM_UNAVAILABLE", "x")

    spec = Spec("seismic", "seismic", 1, boom)
    with pytest.raises(ApiError):
        await runner.get(spec, "k", 1)
    with pytest.raises(ApiError) as e:  # repeated from the failure table
        await runner.get(spec, "k", 1)
    assert e.value.code == "UPSTREAM_UNAVAILABLE"

    async def slow(progress, args):  # type: ignore[no-untyped-def]
        await asyncio.sleep(5)
        return Computed({})

    runner.inline_wait = 0.01

    slow_spec = Spec("seismic", "seismic", 1, slow)
    for i in range(20):
        await runner.get(slow_spec, f"j{i}", 1)
    with pytest.raises(ApiError) as e2:
        await runner.get(slow_spec, "j21", 1)
    assert e2.value.code == "BUSY"
    for job in list(runner.jobs.values()):
        assert job.task is not None
        job.task.cancel()


async def test_stale_served_when_refresh_fails() -> None:
    runner, cache = _runner()

    async def boom(progress, args):  # type: ignore[no-untyped-def]
        raise ApiError("UPSTREAM_UNAVAILABLE", "x")

    spec = Spec("seismic", "seismic", 1, boom)
    entry = await cache.put(
        "seismic", "k", {"status": "ok", "notes": [], "sources": [], "data": {"a": 1}}
    )
    entry.soft_expires_at = time.time() - 5
    cache.l1.set("k", encode(entry), 60)
    code, body = await runner.get(spec, "k", 1)
    assert code == 200 and body["stale"] is True


async def test_swr_obsolete_climate() -> None:
    runner, cache = _runner()
    started = asyncio.Event()

    async def compute(progress, args):  # type: ignore[no-untyped-def]
        started.set()
        return Computed({"dataWindow": {"end": 2025}})

    spec = Spec(
        "climate",
        "climate",
        1,
        compute,
        obsolete=lambda d: d["dataWindow"]["end"] < 2025 + 1,
        refresh_mode="swr",
    )
    await cache.put(
        "climate",
        "k",
        {"status": "ok", "notes": [], "sources": [], "data": {"dataWindow": {"end": 2025}}},
    )
    code, body = await runner.get(spec, "k", 1)
    assert code == 200 and body["stale"] is True and body["refreshing"] is True
    await asyncio.wait_for(started.wait(), 1)


def test_user_agent_identifies_the_project_even_without_contact() -> None:
    ua = Settings().user_agent
    assert "github.com/Akif-b-Atif/Meridian" in ua and "None" not in ua
    assert "me@example.org" in Settings(contact_url="me@example.org").user_agent


def test_production_requires_contact() -> None:
    import pytest as _pytest

    with _pytest.raises(RuntimeError):
        Settings(app_env="production").validate_production()
    Settings(app_env="production", contact_url="https://example.org").validate_production()
