"""ModuleRunner: single-flight jobs, soft/hard TTL, stale-while-revalidate and polling (SDS 6.4)."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from ..errors import ApiError, make_error
from . import logging as log
from .cache import Cache, Entry

MAX_JOBS = 20


@dataclass
class Computed:
    data: Any
    status: str = "ok"
    notes: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    soft_override: int | None = None


Progress = Callable[[int, str], None]
ComputeFn = Callable[[Progress, Any], Awaitable[Computed]]


@dataclass
class Spec:
    module: str  # envelope module name
    kind: str  # cache kind (TTL table key)
    steps: int
    compute: ComputeFn
    admit: Callable[[Any, str | None], None] | None = None
    obsolete: Callable[[Any], bool] | None = None
    refresh_mode: str = "blocking"


@dataclass
class Job:
    task: asyncio.Task[Computed] | None = None
    step: int = 1
    label: str = ""
    steps: int = 1


class ModuleRunner:
    def __init__(
        self,
        cache: Cache,
        inline_wait: float,
        source_lookup: Callable[[list[str]], list[dict[str, str]]],
    ):
        self.cache = cache
        self.inline_wait = inline_wait
        self.jobs: dict[str, Job] = {}
        self.failures: dict[str, tuple[ApiError, float]] = {}
        self.last_refresh_failure: dict[str, float] = {}
        self.source_lookup = source_lookup

    # -- envelope -------------------------------------------------------
    def envelope(self, spec: Spec, entry: Entry, stale: bool, refreshing: bool) -> dict[str, Any]:
        p = entry.payload
        return {
            "module": spec.module,
            "status": p["status"],
            "data": p["data"],
            "computedAt": entry.computed_at,
            "stale": stale,
            "refreshing": refreshing,
            "notes": p["notes"],
            "sources": self.source_lookup(p["sources"]),
        }

    # -- main entry point --------------------------------------------------
    async def get(
        self, spec: Spec, key: str, args: Any, ip: str | None = None
    ) -> tuple[int, dict[str, Any]]:
        entry = await self.cache.get(spec.kind, key)
        job = self.jobs.get(key)
        if entry is not None:
            obsolete = bool(spec.obsolete and spec.obsolete(entry.payload.get("data")))
            if entry.fresh() and not obsolete:
                return 200, self.envelope(spec, entry, False, False)
            if job is None:
                if spec.refresh_mode == "swr":
                    refreshing = self._try_refresh(spec, key, args, ip)
                    return 200, self.envelope(spec, entry, True, refreshing)
                try:
                    job = self._start(spec, key, args, ip)
                except ApiError:
                    return 200, self.envelope(spec, entry, True, False)
            elif spec.refresh_mode == "swr":
                return 200, self.envelope(spec, entry, True, True)
        else:
            if key in self.failures:
                err, until = self.failures[key]
                if time.time() < until:
                    raise err
                del self.failures[key]
            if job is None:
                job = self._start(spec, key, args, ip)
        return await self._wait(spec, key, job, entry)

    def _try_refresh(self, spec: Spec, key: str, args: Any, ip: str | None) -> bool:
        if time.time() - self.last_refresh_failure.get(key, 0) < 600:
            return False
        try:
            self._start(spec, key, args, ip, refresh=True)
            return True
        except ApiError:
            return False

    def _start(self, spec: Spec, key: str, args: Any, ip: str | None, refresh: bool = False) -> Job:
        if len(self.jobs) >= MAX_JOBS:
            raise make_error("BUSY")
        if spec.admit:
            spec.admit(args, ip)
        job = Job(steps=spec.steps)
        self.jobs[key] = job

        def progress(step: int, label: str) -> None:
            job.step, job.label = step, label

        async def run() -> Computed:
            try:
                res = await spec.compute(progress, args)
                await self.cache.put(
                    spec.kind,
                    key,
                    {
                        "status": res.status,
                        "notes": res.notes,
                        "sources": res.sources,
                        "data": res.data,
                    },
                    res.soft_override,
                )
                return res
            except ApiError as exc:
                if refresh:
                    self.last_refresh_failure[key] = time.time()
                else:
                    self.failures[key] = (exc, time.time() + 120)
                raise
            except Exception as exc:
                log.error("job crashed", module=spec.module, error=repr(exc))
                err = ApiError("INTERNAL", make_error("INTERNAL").message)
                if not refresh:
                    self.failures[key] = (err, time.time() + 120)
                raise err from exc
            finally:
                self.jobs.pop(key, None)

        job.task = asyncio.create_task(run())
        job.task.add_done_callback(lambda t: t.exception() if not t.cancelled() else None)
        return job

    async def _wait(
        self, spec: Spec, key: str, job: Job, entry: Entry | None
    ) -> tuple[int, dict[str, Any]]:
        assert job.task is not None
        try:
            await asyncio.wait_for(asyncio.shield(job.task), self.inline_wait)
        except TimeoutError:
            if entry is not None:
                return 200, self.envelope(spec, entry, True, True)
            return 202, {
                "module": spec.module,
                "status": "computing",
                "progress": {"step": job.step, "steps": job.steps, "label": job.label},
                "retryAfterSeconds": 2,
            }
        except ApiError:
            if entry is not None:
                return 200, self.envelope(spec, entry, True, False)
            raise
        fresh = await self.cache.get(spec.kind, key)
        assert fresh is not None
        return 200, self.envelope(spec, fresh, False, False)

    async def call_inline(self, spec: Spec, key: str, args: Any, ip: str | None = None) -> Any:
        """Internal helper: return the data payload of a module, waiting for completion."""
        while True:
            code, body = await self.get(spec, key, args, ip)
            if code == 200:
                return body
            await asyncio.sleep(0.5)
