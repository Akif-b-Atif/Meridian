# Meridian

**Search any city in the world and get one page about it, computed from free public data.**

Meridian profiles a city's seasons, how far peak heat lags behind the solstice, how much it has
warmed since 1950, where earthquakes have struck, how far the sea is, what is mapped there and how
the place began. Every number is calculated on the server from open sources, and every section
says how its numbers were made and what they cannot tell you.

I built it as a portfolio project to show three things in one piece of work: integrating many
unreliable public APIs responsibly, doing honest statistics on the data they return, and
designing an interface that is quiet, precise and accessible rather than a stock dashboard.

**Live demo:** _add your Cloudflare Pages URL here after deploying (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))_

> The backend runs on a free host that sleeps when idle. The first request after a quiet spell
> can take up to a minute, and the page says so while it waits.

## What a report contains

| Section | What it shows | How it is computed |
| --- | --- | --- |
| **Year Clock** | A radial 365-day temperature curve, the daylight curve, the solstices and the lag between them, which you can scrub through | Daily ERA5 means, smoothed; daylight from the NOAA solar equations |
| **Seasons** | Four meteorological seasons (hemisphere-aware) with their spread, or wet and dry seasons where temperature barely changes | Climatology over the last 30 full years |
| **Seasonal lag** | Days between the solstice and the warmest and coldest day, with a 90% interval | Harmonic least-squares fit, a rolling-mean cross-check and a seeded 500-sample bootstrap |
| **Climate normals** | Climograph, Köppen-Geiger class with the rule that produced it, continentality, rainfall seasonality | Peel et al. (2007) rules, Gorczynski and Walsh-Lawler indices |
| **Warming** | Warming stripes and trend since 1950 with a confidence interval | Theil-Sen slope and Kendall tau, anomalies against 1961 to 1990 |
| **Extremes** | Hot days, frost days, wet days and heatwaves, first half of the period against the second | Threshold counts and a percentile-based heatwave rule |
| **Daylight** | Hours of daylight through the year, polar day and night | NOAA declination series |
| **Earthquakes** | Rate, largest events, magnitude-frequency fit and indicative recurrence within 100, 300 or 500 km | USGS catalogue, exact Poisson interval, Aki-Utsu maximum-likelihood b-value |
| **Air quality** | Current air quality and the last seven days | Open-Meteo air-quality model |
| **Water** | Distance and bearing to the nearest coast, lake and major river | Natural Earth geometry, local azimuthal equidistant projection |
| **Places** | Counts per category and a list of notable places | OpenStreetMap through Overpass, ranked with Wikipedia page views |
| **History** | Founding date, country facts and a Wikipedia summary | Wikidata and Wikipedia |

## Why it is built the way it is

The interesting problems in this project are not the charts. They are the constraints.

- **Everything must stay free.** Open-Meteo's free tier counts a long request as many weighted
  calls. One fresh city costs about 511 of the 10,000 daily calls, so only about 19 new cities fit
  in a day. That single number drove the design: a daily budget guard, long cache lifetimes, a
  pre-warmed set of sample cities, and stale data served rather than errors when a provider pushes
  back. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the full capacity budget.
- **Provider rules are requirements.** Nominatim forbids autocomplete, so city search uses
  Open-Meteo's geocoder. Overpass asks regular users to divide its limits by 100, so the places
  module needs only two requests per city and is capped at 80 requests a day. Every request carries
  an identifying User-Agent with a contact address, and the backend refuses to start in production
  without one.
- **The statistics are tested against known answers.** A synthetic sinusoid must return its own
  peak day, a noise-free line its own slope, a seeded Gutenberg-Richter catalogue its own b-value,
  and nine hand-checked monthly vectors must classify as the expected Köppen class.
- **Honest degradation.** One failing provider never blocks the rest of the page. Each section is
  its own request with its own failure state and retry control.

## Architecture

```
Browser: React single-page app (Cloudflare Pages)
  |  JSON over HTTPS, simple GETs only
  v
FastAPI service (Render free web service, one worker, 512 MB)
  middleware -> routes -> ModuleRunner -> two-level cache (memory, Upstash Redis)
                              |-> budgets and governors -> provider adapters
                              |-> analysis (numpy, scipy, shapely, pyproj)
  bundled: Natural Earth water index (GeoPackage)
  |
  v
Open-Meteo (geocoding, ERA5 archive, air quality) · USGS · Overpass · Nominatim · Wikidata · Wikipedia
```

Map tiles come from OpenFreeMap straight to the browser; every other third-party request goes
through the backend so identification, throttling and caching are enforced in one place.

Long calculations (a fresh city's climate takes about a minute) run as background jobs. The API
answers `202` with a progress step and the page polls, so no request is held open for 90 seconds.

## Tech stack

**Backend:** Python 3.12, FastAPI, httpx, pydantic v2, numpy, scipy, shapely, pyproj, pyogrio,
orjson, Upstash Redis (REST). **Frontend:** React 19, TypeScript (strict), Vite, Tailwind CSS 4,
d3 scale/shape/array modules (React renders the SVG), MapLibre GL, TanStack Query.
**Quality:** pytest, respx, Ruff, mypy (strict), Vitest, Testing Library, Playwright, axe-core,
GitHub Actions.

I did not use a component kit. The interface uses one typeface, seven colour tokens per theme,
corner radii of at most 4 px, no gradients, no pill shapes and no decorative motion. Light and dark
themes are separately tuned, and both meet WCAG 2.2 AA contrast
(see the table in [docs/DESIGN.md](docs/DESIGN.md)).

## Run it on your machine (Windows)

You need [Python 3.12](https://www.python.org/downloads/) and [Node.js 22](https://nodejs.org/).
Commands below work in PowerShell and in Command Prompt. No activation step is needed because
they call the virtual environment's Python directly.

**1. Get the code**

```
git clone https://github.com/YOUR-USERNAME/meridian.git
cd meridian
```

**2. Start the backend** (terminal one)

```
cd backend
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
copy .env.example .env
.venv\Scripts\python -m uvicorn app.asgi:app --reload --port 8000
```

Open <http://localhost:8000/docs> to see the generated API documentation. Without Redis
credentials in `.env` the cache runs in memory, which is fine for development.

**3. Start the front end** (terminal two)

```
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open <http://localhost:5173>.

**Note on the first run.** The backend calls the real providers, so your first visit to a city
makes real requests and a fresh city's climate takes a minute or so. Sample cities and anything
already cached open straight away.

## Run the tests

```
cd backend
.venv\Scripts\python -m pytest -m "not perf"
.venv\Scripts\python -m ruff check .
.venv\Scripts\python -m mypy app
```

```
cd frontend
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run e2e
```

None of these tests touch a real provider: the backend suite drives the full API against a mocked
network, and the browser suites answer every request from recorded fixtures. The memory and timing
gates (`pytest -m perf`) are meant for Linux, where CI runs them.

## Configuration

Every limit and base URL is an environment variable with a safe default; see
[`backend/.env.example`](backend/.env.example) and the table in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The ones you are most likely to touch:

| Variable | Purpose |
| --- | --- |
| `CONTACT_URL` | URL or email sent in every provider request. Required in production. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared cache. Without them the cache is memory-only. |
| `OM_WEIGHT_MODEL` | `fractional` or `floored`; decided by `backend/scripts/calibrate_open_meteo.py` |
| `FRESH_CITY_DAILY_LIMIT` | New cities computed per UTC day (default 15) |

## Repository layout

```
backend/    FastAPI service, analysis package, provider adapters, tests, scripts
frontend/   React app, charts, map, unit and end-to-end tests
docs/       Architecture, methods, API, deployment, design, decision records
.github/    CI, daily pre-warm job, templates
```

## Limits you should know about

- Climate values come from **ERA5 reanalysis on a grid**. They describe the surrounding area, not a
  weather station, and will differ from local records, especially on coasts and in mountains.
- The Natural Earth coastline is generalised at 1:10 million, so distances are good to a few
  kilometres, and only large lakes and major rivers are included.
- OpenStreetMap completeness varies a lot between regions, so place counts compare poorly across
  countries.
- Earthquake recurrence figures are indicative extrapolations, not hazard forecasts.
- The trend p-value is optimistic because annual means are autocorrelated. The page says so.
- The free tiers this runs on are not production infrastructure. If a provider changes its terms,
  the adapters isolate it behind a base-URL setting.

More detail is in [docs/METHODS.md](docs/METHODS.md).

## Documentation

- [Architecture and capacity budget](docs/ARCHITECTURE.md)
- [Methods: every statistic and its caveats](docs/METHODS.md)
- [API reference](docs/API.md) and the generated [OpenAPI schema](docs/openapi.json)
- [Design system and accessibility](docs/DESIGN.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Verification checklist](docs/VERIFICATION.md)
- [Architecture decision records](docs/adr)
- [Data sources and licences](DATA_SOURCES.md)

## Licence

The code is MIT licensed (see [LICENSE](LICENSE)). The data shown belongs to its providers and is
used under their terms; Open-Meteo's free tier is for non-commercial use, which is why this site
carries no advertising and sells nothing. Attributions are in the page footer and in
[DATA_SOURCES.md](DATA_SOURCES.md).
