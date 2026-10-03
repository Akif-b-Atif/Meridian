"""Injectable clock so tests can fix the date."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime

_override: Callable[[], datetime] | None = None


def now() -> datetime:
    return _override() if _override else datetime.now(UTC)


def today() -> date:
    return now().date()


def set_clock(fn: Callable[[], datetime] | None) -> None:
    global _override
    _override = fn


def iso(dt: datetime | None = None) -> str:
    return (dt or now()).strftime("%Y-%m-%dT%H:%M:%SZ")
