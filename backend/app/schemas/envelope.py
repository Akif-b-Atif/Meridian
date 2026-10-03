"""Wire models for the shared envelope. Module payloads are validated by the analysis tests
and described in docs/API.md; the envelope itself is typed so OpenAPI stays honest."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Source(Wire):
    id: str
    text: str
    url: str


class Envelope(Wire):
    module: str
    status: Literal["ok", "partial", "unavailable"]
    data: dict[str, Any] | None
    computed_at: str
    stale: bool
    refreshing: bool
    notes: list[str]
    sources: list[Source]


class Progress(Wire):
    step: int
    steps: int
    label: str


class ProgressBody(Wire):
    module: str
    status: Literal["computing"]
    progress: Progress
    retry_after_seconds: int


class ErrorDetail(Wire):
    code: str
    message: str
    retry_after_seconds: int | None = None


class ErrorBody(Wire):
    error: ErrorDetail


class Budget(Wire):
    fresh_cities_today: int
    fresh_cities_limit: int
    resets_at: str


class StatusBody(Wire):
    ok: bool
    warm: bool
    cache_mode: Literal["redis", "memory"]
    version: str
    budget: Budget


class SearchResult(Wire):
    geoname_id: int
    name: str
    admin1: str | None
    country: str | None
    country_code: str
    lat: float
    lon: float
    population: int | None
