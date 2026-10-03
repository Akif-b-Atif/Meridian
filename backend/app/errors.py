"""Error model shared by the whole API. Messages are shown to visitors as written."""

from __future__ import annotations

from dataclasses import dataclass

STATUS: dict[str, int] = {
    "INVALID_INPUT": 400,
    "CITY_NOT_FOUND": 404,
    "RATE_LIMITED": 429,
    "BUDGET_EXHAUSTED": 429,
    "HOURLY_LIMIT": 429,
    "BUSY": 429,
    "UPSTREAM_RATE_LIMITED": 502,
    "UPSTREAM_UNAVAILABLE": 502,
    "UPSTREAM_BAD_DATA": 502,
    "INITIALISING": 503,
    "INTERNAL": 500,
}

MESSAGES: dict[str, str] = {
    "CITY_NOT_FOUND": "No populated place with that ID was found.",
    "RATE_LIMITED": "Too many requests from your connection. Try again in {n} seconds.",
    "BUDGET_EXHAUSTED": (
        "Today's allowance of new cities has been used. Sample cities and cities already "
        "computed still work. The allowance resets at 00:00 UTC."
    ),
    "HOURLY_LIMIT": (
        "Several new cities were computed in the last hour. Try again in about {n} minutes."
    ),
    "BUSY": "The server is computing several cities at once. Try again in a minute.",
    "UPSTREAM_RATE_LIMITED": (
        "{provider} is limiting requests right now. Try again in about {n} minutes."
    ),
    "UPSTREAM_UNAVAILABLE": "{provider} did not respond. This is usually temporary.",
    "UPSTREAM_BAD_DATA": "{provider} returned data that could not be used.",
    "INITIALISING": "The server is still starting. Try again in a few seconds.",
    "INTERNAL": "Something went wrong on our side.",
}


@dataclass
class ApiError(Exception):
    code: str
    message: str
    retry_after: int | None = None

    @property
    def status(self) -> int:
        return STATUS[self.code]

    def body(self) -> dict[str, object]:
        err: dict[str, object] = {"code": self.code, "message": self.message}
        if self.retry_after is not None:
            err["retryAfterSeconds"] = self.retry_after
        return {"error": err}


def make_error(code: str, *, provider: str = "", retry_after: int | None = None) -> ApiError:
    template = MESSAGES.get(code, MESSAGES["INTERNAL"])
    n = max(1, round((retry_after or 60) / 60)) if "minutes" in template else (retry_after or 60)
    return ApiError(code, template.format(provider=provider or "A data provider", n=n), retry_after)


def invalid(message: str) -> ApiError:
    return ApiError("INVALID_INPUT", message)
