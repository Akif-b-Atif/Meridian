"""Seismic module (SDS 7.3, 8.5)."""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

from ..analysis import seismic as sa
from ..core import clock
from ..core.container import Container
from ..core.runner import Computed, Progress, Spec


def make_spec(c: Container, identity_spec: Spec) -> Spec:
    from .identity import get_identity

    async def compute(progress: Progress, args: tuple[int, int, str | None]) -> Computed:
        geoname_id, radius, ip = args
        ident = await get_identity(c, identity_spec, geoname_id, ip)
        progress(1, "Counting earthquakes in the chosen radius")
        start = date(c.s.seismic_start_year, 1, 1)
        end = clock.today()
        progress(2, "Downloading the earthquake catalogue")
        res = await c.usgs.fetch(ident["lat"], ident["lon"], radius, start, end)
        progress(3, "Fitting magnitude statistics")
        cov = res["coverageStart"] if res["partial"] else start
        async with c.analysis_sem:
            data: dict[str, Any] = await asyncio.to_thread(
                sa.analyse,
                res["events"],
                ident["lat"],
                ident["lon"],
                radius,
                cov,
                end,
                c.s.class_thresholds,
                partial=res["partial"],
                truncated=res["truncated"],
                dropped=res["droppedRows"],
            )
        notes = []
        if res["partial"]:
            notes.append("seismic_partial")
        if res["truncated"]:
            notes.append("seismic_truncated")
        return Computed(data, "partial" if notes else "ok", notes, ["usgs"])

    return Spec("seismic", "seismic", 3, compute)
