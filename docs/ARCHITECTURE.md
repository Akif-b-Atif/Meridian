# Architecture

This document explains how Meridian is put together and why. It is the place to start if you want
to read the code.

## Overview

A static React app calls a stateless Python API. The API has no database; its only state is a
cache. All third-party data is fetched by the backend, with one exception: map tiles come from
OpenFreeMap straight to the browser.

```
Browser (React SPA, Cloudflare Pages)
  |-- JSON/HTTPS: simple GETs, no custom headers, so no CORS preflight
  |        v
  |   FastAPI on Render free (one container, one Uvicorn worker)
  |     middleware -> routes -> ModuleRunner -> cache (L1 memory, L2 Upstash Redis)
  |                                  |-> governors and budgets -> adapters -> providers
  |                                  |-> analysis (numpy, scipy, shapely, pyproj)
  |     static: Natural Earth water index (.gpkg)
  |-- vector tiles and glyphs: tiles.openfreemap.org (the only third-party host the browser calls)
```

## Design principles

1. **One module, one endpoint, one failure domain.** The page requests modules in parallel. A
   failing provider fails one section, never the report.
2. **Cache first.** A previously seen city is served from cache. Provider calls happen only on a
   miss and are metered against a daily budget.
3. **Honest degradation.** Every module says whether it is `ok`, `partial` or `unavailable`, and
   why. Stale data is served, and marked as stale, when a provider is limiting requests.
4. **Show the method.** Each section states its data window, method and caveats.

## Backend layout

| Path | Responsibility |
| --- | --- |
| `app/main.py` | App factory, middleware (rate limit, CORS, gzip, security headers), error handlers |
| `app/config.py` | One `Settings` class; every tunable is an environment variable |
| `app/errors.py` | The error model and the exact texts shown to visitors |
| `app/core/cache.py` | In-process LRU, Upstash client, soft and hard TTLs, command meter |
| `app/core/budget.py` | Token bucket, rolling hour, UTC-day ledger, blocked states, admission control |
| `app/core/http.py` | Per-provider clients, retries with full jitter, circuit breaker, spacing |
| `app/core/runner.py` | `ModuleRunner`: single-flight jobs, stale-while-revalidate, 202 polling |
| `app/adapters/` | One class per provider. They build requests and validate responses; no caching, no statistics |
| `app/analysis/` | Pure functions from data to numbers. No I/O. Deterministic |
| `app/services/` | One module per report section: compose adapters and analysis into a payload |
| `app/api/routes.py` | HTTP routes, input validation, cache headers |
| `scripts/` | Calibration, pre-warm, fixture and index builders |

The analysis package imports numpy at module level and scipy only inside the functions that need
it, which keeps the cold start short on a very small CPU. Heavy work runs through
`asyncio.to_thread` behind a semaphore, so the event loop stays responsive.

## The request path

1. Validate input and apply the per-IP limit (120 requests a minute).
2. Load the city's identity (cache, then provider).
3. `ModuleRunner.get` reads the cache. A fresh entry returns at once.
4. A soft-expired entry is returned immediately as stale; climate refreshes in the background
   (stale-while-revalidate), other modules refresh while the request waits and fall back to the old
   entry if the refresh fails.
5. With no entry, admission control decides whether a job may start, then the job runs. Concurrent
   requests for the same key join one job (single flight). At most 20 jobs run at once.
6. If the job finishes within 8 seconds the answer is `200`. Otherwise `202` with a progress step
   and label, and the browser polls.

## Caching

Each entry has a **soft TTL** (when it stops being fresh) and a longer **hard TTL** (when Redis
deletes it). The gap is what makes serving stale data on errors possible.

| Data | Soft | Hard |
| --- | --- | --- |
| Search prefixes | 7 days | 14 days |
| Identity | 90 days | 120 days |
| Climate | 90 days | 100 days |
| Seismic | 24 hours | 7 days |
| Places, history | 30 days | 60 days |
| Boundary | 180 days | 200 days |
| Air quality | 15 minutes (memory only) | none |

Redis values are JSON, compressed with zlib and base64-encoded, capped at 512 KB. The climate
cache key carries no year: when the data window moves on (after 15 January), each entry is treated
as soft-expired and refreshed in the background, so the cache never goes cold all at once.

A command meter counts Redis commands. Above 400,000 a month the service drops search prefixes to
memory only (economy); above 480,000 it stops caching everything except identity, climate,
boundary, places and history (survival). After three consecutive Redis failures it runs from
memory for ten minutes.

## Capacity budget

Open-Meteo's free tier allows 10,000 weighted calls a day, 5,000 an hour and 600 a minute per IP
address, and the free host shares outbound addresses. Climate dominates the cost:

| Request | Variables | Days | Weighted cost |
| --- | --- | --- | --- |
| A: long daily mean, 1950 to last full year | 1 | about 27,759 | about 198 |
| B: 30-year window of max, min, rain, sunshine | 4 | about 10,958 | about 313 |
| **One fresh city** | | | **about 511** |

The documented rule is cost = (variables / 10) x (days / 14), but it is not clear whether each
factor below 1 counts as a fraction or as 1. The code supports both (`OM_WEIGHT_MODEL`). If the
floored reading is true, one city costs about 1,983 and only 4 fit in a day. The limit adjusts
itself, and `backend/scripts/calibrate_open_meteo.py` decides which reading applies.

| Cap | Value | Why |
| --- | --- | --- |
| Per minute | 500 (token bucket, may go negative) | Provider allows 600 |
| Rolling hour | 4,000 | Provider allows 5,000 |
| Per UTC day, all Open-Meteo calls | 9,500 | Provider allows 10,000 and the address is shared |
| Fresh cities per day | 15 | About 7,700 calls, leaving room for search and air |
| Fresh cities per IP per hour | 5 | Stops one visitor spending the day's budget |
| Search / air per day | 600 / 300 | Light calls cannot starve climate, or the reverse |
| Overpass | 80 attempts and 8 MB a day | OSM asks regular users to divide its limits by 100 |
| Nominatim | one request start per 1.05 s | Policy is 1 per second |
| Wikimedia | 180 a minute | Provider allows 200 with an identifying User-Agent |

The ledger lives in memory and is flushed to Redis at most once a minute, so a restart does not
forget what the day has already spent. When Open-Meteo itself reports a limit, the matching blocked
state is set (65 seconds, until the next hour, or until midnight UTC) and the ledger jumps to the
cap.

## Resilience

- **Retries:** connect errors, timeouts and HTTP 500/502/503/504 are retried with full-jitter
  backoff. A 429 is never retried; it blocks that provider and the request fails fast or serves
  stale data.
- **Circuit breaker:** five consecutive failures open a provider's circuit for 60 seconds, then one
  trial request is allowed.
- **Failure memory:** a failed job's error is remembered for 120 seconds so pollers get the same
  answer instead of each triggering a new attempt.
- **Cold start:** the free host sleeps after 15 minutes idle. The browser sends one status request
  per page load and shows a "waking up" banner with elapsed seconds if it is slow. That request is
  a visitor-triggered wake, not a keep-alive; nothing pings the server on a timer.

## Frontend layout

| Path | Responsibility |
| --- | --- |
| `src/api/` | Fetch client, response classification, polling hook, waking logic |
| `src/copy/` | Every visible sentence, built from numbers so unit changes need no new data |
| `src/units/` | All metric/imperial conversion, in the browser only |
| `src/charts/` | SVG chart components. d3 computes geometry; React renders |
| `src/map/` | MapLibre wrapper and the custom style over OpenFreeMap tiles |
| `src/routes/` | Landing page and the city report |
| `src/state/` | Units and theme preferences (stored in `localStorage` only) |

The API sends numbers and codes, never sentences, so the unit switch can change every value
without a refetch. Sentences are written once, in `src/copy`.

## Known deviations and simplifications

I would rather list these than have a reader find them:

- Module payloads are plain JSON-compatible dictionaries validated by the analysis tests and
  described in [API.md](API.md); only the envelope, progress, error and status bodies are typed
  pydantic models.
- A Wikimedia 429 blocks that provider for the Retry-After period (or 60 seconds) instead of
  waiting once and retrying the same call.
- Overpass mirror failover sits inside the adapter: a failed attempt on the first mirror tries the
  second, and every attempt counts against the daily cap.
- The Playwright suite is written and wired into CI but was not run in the environment where the
  code was authored (no browser could be downloaded there). The same fixtures are exercised by a
  full-page render test in Vitest.
