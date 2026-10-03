# API reference

The backend is a JSON API under `/api`. When it is running, interactive documentation is at
`/docs` and the generated schema is at `/openapi.json`; a copy is committed as
[`openapi.json`](openapi.json) and checked in CI so it cannot drift.

All endpoints are `GET`. Cities are identified by their numeric GeoNames ID.

| Path | Module | Notes |
| --- | --- | --- |
| `/api/status` | none | Health, whether the server has finished starting, cache mode and today's fresh-city budget. Never cached. Costs no provider call |
| `/api/search?q=` | search | 3 to 80 characters. Populated places only, at most 8 results |
| `/api/cities/{id}` | identity | Name, coordinates, timezone, population, area, founding, IDs |
| `/api/cities/{id}/climate` | climate | Seasons, normals, lag, Köppen, trend, extremes |
| `/api/cities/{id}/solar` | solar | Daylight through the year. Computed per request |
| `/api/cities/{id}/seismic?radius=300` | seismic | Radius 100, 300 or 500 |
| `/api/cities/{id}/water` | water | Nearest coast, lake and river. Computed per request |
| `/api/cities/{id}/places` | places | Counts and notable places |
| `/api/cities/{id}/boundary` | boundary | GeoJSON polygon, or a 5 km circle |
| `/api/cities/{id}/history` | history | Founding, country facts, Wikipedia summary |
| `/api/cities/{id}/air` | air | Current and last seven days |

Every module endpoint other than `identity` loads the identity first, so an unknown city returns
`404 CITY_NOT_FOUND` from any of them.

## Envelope

```json
{
  "module": "climate",
  "status": "ok",
  "data": {},
  "computedAt": "2026-10-01T10:00:00Z",
  "stale": false,
  "refreshing": false,
  "notes": ["sunshine_unavailable"],
  "sources": [{ "id": "open-meteo", "text": "...", "url": "..." }]
}
```

- `status` is `ok`, `partial` (something is missing; `notes` says what) or `unavailable` with
  `data: null` for a deterministic absence, for example a city with no English Wikipedia article.
- `notes` are machine codes, never sentences. The browser turns them into text.
- `stale` means the entry was served after its soft expiry. `refreshing` means a refresh is
  running (climate only).

## Long calculations

A fresh city's climate takes about a minute. If a job is not done within 8 seconds the API answers
`202` with `Retry-After: 2`:

```json
{ "module": "climate", "status": "computing",
  "progress": { "step": 2, "steps": 3, "label": "Reading daily temperature range, rainfall and sunshine, 1996 to 2025" },
  "retryAfterSeconds": 2 }
```

Poll the same URL. Concurrent requests for the same city share one job.

## Errors

Every non-2xx body is `{ "error": { "code", "message", "retryAfterSeconds"? } }`. Messages are
written for visitors and shown as they are.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | Bad query text, ID or radius |
| `CITY_NOT_FOUND` | 404 | No populated place with that ID |
| `RATE_LIMITED` | 429 | More than 120 requests a minute from one address, or more than 5 new cities an hour |
| `BUDGET_EXHAUSTED` | 429 | The day's allowance of new cities, search or air calls is used |
| `HOURLY_LIMIT` | 429 | Too many new cities in the last hour |
| `BUSY` | 429 | More than 20 jobs running |
| `UPSTREAM_RATE_LIMITED` | 502 | A provider is limiting requests and no stale data exists |
| `UPSTREAM_UNAVAILABLE` | 502 | A provider timed out or failed and no stale data exists |
| `UPSTREAM_BAD_DATA` | 502 | A provider returned something unusable |
| `INITIALISING` | 503 | Still starting (the water index is loading) |
| `INTERNAL` | 500 | Unexpected; logged with a request ID |

A 502, 503 or 504 with no JSON body comes from the host's edge while the service is asleep, not from
the application.

## Caching headers

Most `200` responses carry `public, max-age=300, stale-while-revalidate=86400`; seismic
`max-age=3600`; air `max-age=300`; stale responses `max-age=60`; status, 202s and errors
`no-store`. Responses carry `Vary: Origin`. There are no ETags.

## Payloads

Field-level shapes are defined as TypeScript types in
[`frontend/src/api/types.ts`](../frontend/src/api/types.ts). Units on the wire are always metric:
°C, mm, km, metres, hours, km². Dates are `YYYY-MM-DD`, timestamps are UTC ISO 8601, and a day of
year always means the 365-day calendar described in [METHODS.md](METHODS.md).
