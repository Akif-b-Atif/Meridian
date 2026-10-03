# Deployment

Meridian runs entirely on free tiers: Cloudflare Pages for the front end, Render for the backend
and Upstash for the shared cache. None needs a payment method.

## 1. Upstash Redis

Create one free Redis database (region close to your Render region, TLS on). Note the REST URL and
token. Without them the backend still works, but the cache is memory-only and is lost whenever the
free host restarts.

## 2. Backend on Render

1. Create a **Blueprint** from this repository. `render.yaml` describes the service: Docker, free
   plan, health check `/api/status`.
2. Enter the secrets in the dashboard: `CONTACT_URL` (the repository URL or a project email; every
   provider request identifies itself with it), `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`.
3. If the service name `meridian-api` is taken, append something unique and use the new URL below.

Expect the first request after 15 idle minutes to take up to a minute while the service wakes and
loads the water index. The front end handles this with a visible "waking up" message.

## 3. Front end on Cloudflare Pages

Create a Pages project from the repository:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Node version | 22 |
| `VITE_API_BASE_URL` | your Render URL, no trailing slash |
| `VITE_REPO_URL` | this repository's URL |

The build writes `dist/_headers` with a Content-Security-Policy that allows only this site, your
API origin and `tiles.openfreemap.org`. `public/_redirects` makes deep links work.

Then set `ALLOWED_ORIGINS` on Render to your Pages URL. If you use preview deployments, the
`ALLOWED_ORIGIN_REGEX` in `render.yaml` allows `*.meridian-city-profile.pages.dev`; change it if
your project name differs.

## 4. Before launch

Run the checks in [VERIFICATION.md](VERIFICATION.md), in particular the Open-Meteo calibration,
and set `OM_WEIGHT_MODEL` from its result. Then set the repository variable `BACKEND_URL` to your
Render URL so the daily pre-warm job can run.

## Pre-warm

`.github/workflows/prewarm.yml` runs at 00:30 UTC, shortly after the provider budgets reset. It
visits up to six sample cities and refreshes anything about to expire, using the same admission
control as visitors, so it cannot exceed the daily caps. It is not a keep-alive: the free host goes
back to sleep 15 minutes after it finishes.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_ENV` | `development` | `production` enforces the `CONTACT_URL` check |
| `CONTACT_URL` | none | Required in production |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated exact origins for CORS |
| `ALLOWED_ORIGIN_REGEX` | empty | Optional, for preview deployments |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | none | Shared cache |
| `OM_*_BASE`, `USGS_BASE`, `OVERPASS_URLS`, `NOMINATIM_BASE`, `WIKIPEDIA_API`, `WIKIDATA_API` | provider defaults | Swap a provider without a code change |
| `OM_WEIGHT_MODEL` | `fractional` | `fractional` or `floored` |
| `OM_MINUTE_RATE` / `OM_HOURLY_CAP` / `OM_DAILY_HARD_CAP` | 500 / 4000 / 9500 | Open-Meteo pacing |
| `OM_LIGHT_RESERVE` | 1000 | Calls kept free for search and air |
| `OM_SEARCH_DAILY_CAP` / `OM_AIR_DAILY_CAP` | 600 / 300 | Light-call caps |
| `FRESH_CITY_DAILY_LIMIT` / `FRESH_PER_IP_HOUR` | 15 / 5 | New-city limits |
| `OVERPASS_DAILY_CAP` / `OVERPASS_DAILY_BYTES` | 80 / 8,000,000 | Overpass limits |
| `WIKIMEDIA_RPM` | 180 | Wikipedia and Wikidata requests a minute |
| `RATE_LIMIT_PER_MIN` | 120 | Requests per client address |
| `INLINE_WAIT_S` | 8 | Longest wait before answering 202 |
| `BOOTSTRAP_N` | 500 | Bootstrap resamples for the lag interval |
| `REDIS_ECONOMY_CMDS` / `REDIS_SURVIVAL_CMDS` | 400,000 / 480,000 | Monthly Redis command thresholds |
| `SEISMIC_CLASS_THRESHOLDS` | `0.05,0.3,1.5,6` | Activity class bounds, events/yr/100,000 km² |
| `LOG_LEVEL` | `INFO` | JSON logs to stdout. Search text and IP addresses are never logged |

## Rebuilding the water index

The index is committed (about 18 MB). To rebuild it after a Natural Earth release:

```
cd backend
.venv\Scripts\python scripts\build_water_index.py
```

The script downloads the three 10 m themes from the `natural-earth-vector` repository, or reads
them from a folder given with `--src`. It fails if the result exceeds 40 MB.

## If a free tier changes

Everything that could change is a setting or an adapter. The container image and `render.yaml`
recreate the backend on any host that runs Docker, and the front end is static files.
