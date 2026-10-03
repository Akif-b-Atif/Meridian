"""FastAPI application factory."""

from __future__ import annotations

import asyncio
import secrets
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from .api.routes import Specs, client_ip, router
from .config import Settings, get_settings
from .core import logging as log
from .core.container import Container
from .errors import ApiError, make_error


def create_app(
    settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None
) -> FastAPI:
    s = settings or get_settings()
    s.validate_production()
    log.setup(s.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        c = Container(s, transport)
        app.state.container = c
        app.state.specs = Specs(c)
        task = asyncio.create_task(c.warmup())
        try:
            yield
        finally:
            task.cancel()
            await c.close()

    app = FastAPI(
        title="Meridian API",
        version=s.app_version,
        description="City profiles computed from free public data. See the repository README.",
        lifespan=lifespan,
        redoc_url=None,
    )

    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        headers = {"Cache-Control": "no-store"}
        if exc.retry_after:
            headers["Retry-After"] = str(exc.retry_after)
        return JSONResponse(exc.body(), status_code=exc.status, headers=headers)

    @app.exception_handler(Exception)
    async def crash(_: Request, exc: Exception) -> JSONResponse:
        log.error("unhandled", error=repr(exc))
        return JSONResponse(
            make_error("INTERNAL").body(), status_code=500, headers={"Cache-Control": "no-store"}
        )

    @app.middleware("http")
    async def rate_limit(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method != "OPTIONS" and request.url.path.startswith("/api/"):
            c: Container = request.app.state.container
            try:
                c.http_limit.check_and_add(client_ip(request))
            except ApiError as exc:
                return JSONResponse(
                    exc.body(),
                    status_code=429,
                    headers={"Retry-After": str(exc.retry_after), "Cache-Control": "no-store"},
                )
        return await call_next(request)

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.origins,
        allow_origin_regex=s.allowed_origin_regex or None,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=[],
        expose_headers=["Retry-After", "X-Request-Id"],
        max_age=86400,
    )

    @app.middleware("http")
    async def security_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        rid = secrets.token_hex(6)
        response = await call_next(request)
        response.headers["X-Request-Id"] = rid
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Meridian-Version"] = s.app_version
        return response

    app.include_router(router)
    return app
