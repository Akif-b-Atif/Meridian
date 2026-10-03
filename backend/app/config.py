"""Application settings. Every tunable value lives here and is read from the environment."""

from __future__ import annotations

from functools import lru_cache

import httpx
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: str = "development"
    app_version: str = "1.0.0"
    contact_url: str | None = None
    allowed_origins: str = "http://localhost:5173"
    allowed_origin_regex: str = ""
    upstash_redis_rest_url: str | None = None
    upstash_redis_rest_token: str | None = None

    om_geocoding_base: str = "https://geocoding-api.open-meteo.com"
    om_archive_base: str = "https://archive-api.open-meteo.com"
    om_air_base: str = "https://air-quality-api.open-meteo.com"
    usgs_base: str = "https://earthquake.usgs.gov"
    overpass_urls: str = (
        "https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter"
    )
    nominatim_base: str = "https://nominatim.openstreetmap.org"
    wikipedia_api: str = "https://en.wikipedia.org/w/api.php"
    wikidata_api: str = "https://www.wikidata.org/w/api.php"

    om_weight_model: str = "fractional"
    om_minute_rate: int = 500
    om_hourly_cap: int = 4000
    om_daily_hard_cap: int = 9500
    om_light_reserve: int = 1000
    om_search_daily_cap: int = 600
    om_air_daily_cap: int = 300
    fresh_city_daily_limit: int = 15
    fresh_per_ip_hour: int = 5
    overpass_daily_cap: int = 80
    overpass_daily_bytes: int = 8_000_000
    nominatim_rps: float = 1.0
    nominatim_script_rpm: int = 4
    wikimedia_rpm: int = 180
    usgs_concurrency: int = 2
    rate_limit_per_min: int = 120
    inline_wait_s: float = 8.0
    analysis_concurrency: int = 1
    l1_max_bytes: int = 33_554_432
    redis_economy_cmds: int = 400_000
    redis_survival_cmds: int = 480_000
    climate_years: int = 30
    trend_start_year: int = 1950
    bootstrap_n: int = 500
    seismic_min_mag: float = 4.5
    seismic_start_year: int = 1973
    seismic_class_thresholds: str = "0.05,0.3,1.5,6"
    log_level: str = "INFO"

    @field_validator("om_weight_model")
    @classmethod
    def _weight_model(cls, v: str) -> str:
        if v not in {"fractional", "floored"}:
            raise ValueError("OM_WEIGHT_MODEL must be 'fractional' or 'floored'")
        return v

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def overpass_mirrors(self) -> list[str]:
        return [u.strip() for u in self.overpass_urls.split(",") if u.strip()]

    @property
    def class_thresholds(self) -> list[float]:
        return [float(x) for x in self.seismic_class_thresholds.split(",")]

    @property
    def user_agent(self) -> str:
        return f"Meridian/{self.app_version} ({self.contact_url}) python-httpx/{httpx.__version__}"

    def validate_production(self) -> None:
        if self.app_env != "production":
            return
        c = self.contact_url or ""
        if not (c.startswith("https://") or "@" in c):
            raise RuntimeError(
                "CONTACT_URL must be set in production to an https:// URL or an email address, "
                "because Wikimedia, OpenStreetMap and Open-Meteo expect identifying clients."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
