"""Air-quality module (SDS 8.10)."""

from __future__ import annotations

from ..analysis import air as aa
from ..core.container import Container
from ..core.runner import Computed, Progress, Spec


def make_spec(c: Container, identity_spec: Spec) -> Spec:
    from .identity import get_identity

    async def compute(progress: Progress, args: tuple[int, str | None]) -> Computed:
        geoname_id, ip = args
        ident = await get_identity(c, identity_spec, geoname_id, ip)
        progress(1, "Reading current air quality")
        raw = await c.om.air(ident["lat"], ident["lon"])
        data = aa.summarise(raw, ident["timezone"])
        if data is None:
            return Computed(None, "unavailable", ["air_no_data"], ["open-meteo"])
        return Computed(data, "ok", [], ["open-meteo"])

    return Spec("air", "air", 1, compute, admit=lambda a, ip: c.gov.admit_light("air"))
