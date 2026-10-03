"""Climate module: Open-Meteo archive requests plus analysis (SDS 7.2.3, 8.3)."""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

from ..adapters.open_meteo import PROVIDER, OpenMeteo, chunk_ranges
from ..analysis.calendar365 import window_end_year
from ..analysis.climate import analyse_climate
from ..core import clock
from ..core.budget import FRESH_ESTIMATE
from ..core.container import Container
from ..core.runner import Computed, Progress, Spec
from ..errors import make_error

A_VARS = ["temperature_2m_mean"]
B_VARS = ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "sunshine_duration"]


def expected_end_year() -> int:
    return window_end_year(clock.today())


async def _fetch_plan_f(
    c: Container, ident: dict[str, Any], end: date, progress: Progress, wy0: int
) -> tuple[dict[str, list[Any]], dict[str, list[Any]]]:
    lat, lon, tz = ident["lat"], ident["lon"], ident["timezone"]
    progress(1, f"Reading daily temperatures, 1950 to {end.year}")
    a = await c.om.archive(lat, lon, date(1950, 1, 1), end, A_VARS, tz)
    progress(2, f"Reading daily temperature range, rainfall and sunshine, {wy0} to {end.year}")
    b = await c.om.archive(lat, lon, date(wy0, 1, 1), end, B_VARS, tz)
    return a, b


async def _fetch_plan_u(
    c: Container, ident: dict[str, Any], end: date, progress: Progress, wy0: int
) -> tuple[dict[str, list[Any]], dict[str, list[Any]]]:
    lat, lon, tz = ident["lat"], ident["lon"], ident["timezone"]
    allv = A_VARS + B_VARS
    merged: dict[str, list[Any]] = {"time": [], **{v: [] for v in allv}}
    ranges = chunk_ranges(date(1950, 1, 1), end)
    for i, (a0, a1) in enumerate(ranges, 1):
        progress(
            1 if i < len(ranges) else 2, f"Reading daily climate data, part {i} of {len(ranges)}"
        )
        part = await c.om.archive(lat, lon, a0, a1, allv, tz)
        for k in merged:
            merged[k].extend(part[k])
    a = {"time": merged["time"], **{v: merged[v] for v in A_VARS}}
    cut = next(i for i, t in enumerate(merged["time"]) if t >= f"{wy0}-01-01")
    b = {"time": merged["time"][cut:], **{v: merged[v][cut:] for v in B_VARS}}
    return a, b


def make_spec(c: Container, identity_spec: Spec) -> Spec:
    from .identity import get_identity

    async def compute(progress: Progress, args: tuple[int, str | None]) -> Computed:
        geoname_id, ip = args
        ident = await get_identity(c, identity_spec, geoname_id, ip)
        end_year = expected_end_year()
        end = date(end_year, 12, 31)
        wy0 = end_year - c.s.climate_years + 1
        fetch = _fetch_plan_f if c.s.om_weight_model == "fractional" else _fetch_plan_u
        a, b = await fetch(c, ident, end, progress, wy0)
        for name, series in (
            ("temperature_2m_mean", a["temperature_2m_mean"]),
            *((v, b[v]) for v in B_VARS[:3]),
        ):
            if not OpenMeteo.check_missing(series):
                raise make_error("UPSTREAM_BAD_DATA", provider=PROVIDER)
            _ = name
        progress(3, "Analysing seasons, normals and trend")
        notes: list[str] = []
        sun = b.get("sunshine_duration")
        if not sun or all(v is None for v in sun):
            notes.append("sunshine_unavailable")
            b = {k: v for k, v in b.items() if k != "sunshine_duration"}
        async with c.analysis_sem:
            data = await asyncio.to_thread(
                analyse_climate,
                a["time"],
                a["temperature_2m_mean"],
                b["time"],
                b,
                end_year,
                ident["lat"],
                geoname_id,
                c.s.bootstrap_n,
                c.s.trend_start_year,
                c.s.climate_years,
            )
        return Computed(data, "partial" if notes else "ok", notes, ["open-meteo", "era5"])

    def admit(args: tuple[int, str | None], ip: str | None) -> None:
        c.gov.admit_fresh(args[0], FRESH_ESTIMATE[c.s.om_weight_model], ip)

    return Spec(
        "climate",
        "climate",
        3,
        compute,
        admit=admit,
        obsolete=lambda d: bool(d) and d["dataWindow"]["end"] < expected_end_year(),
        refresh_mode="swr",
    )
