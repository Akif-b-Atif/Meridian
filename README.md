# Meridian

**Search any city in the world and get one page about it, computed from free public data.**

Meridian profiles a city's seasons, how far peak heat lags behind the solstice, how much it has
warmed since 1950, where earthquakes have struck, how far the sea is, what is mapped there and how
the place began. Every number is calculated on the server from open sources, and every section
says how its numbers were made and what it cannot tell you.

**Live demo:** not hosted at the moment. It runs locally in a few minutes (see
[Run it on your machine](#run-it-on-your-machine-windows)), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
describes how I would host it on free tiers.

> When hosted on a free tier, the backend sleeps when idle. The first request after a quiet spell
> can take up to a minute, and the page says so while it waits.

## Why I built this

I am a geography nerd, and the part of it I like most is big data about places: the kind of
numbers that make a city's character visible, like why the hottest day of the year lands weeks
after the solstice, or how a coastline, a fault line or a river shapes a place. I also like finding
ways to show that data so it is clear at a glance and still rewards a closer look.

This project is where those two interests met, and it doubled as a self-directed way to learn
by building something real. I wanted to work with live public APIs as they actually behave
(rate limits, weighted costs, inconsistent coverage, terms of use), do honest statistics on what
comes back, and design the result by hand rather than from a template. Most of the interesting
decisions in the repo come from those constraints, and they are written up in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the [decision records](docs/adr).

## What a report contains

A report reads as ten short chapters, not a dashboard. Each opens with a plain question and a few
headline numbers, shows one chart, and says in a sentence what that chart is telling you. Method
notes sit in a "For the curious" fold, and a Plain/Detailed switch controls whether they are open.

| Chapter | The question it answers | How it is computed |
| --- | --- | --- |
| **1. Where it is** | Where on Earth is this, and how far is the sea? | A map that opens as a globe and flies in; distance and bearing to coast, lake and river from Natural Earth geometry |
| **2. How it began** | How old is this place? | Wikidata founding date on a timeline, country facts, Wikipedia summary |
| **3. What's there** | What is on the ground? | OpenStreetMap counts through Overpass, with "one every N metres" spacing, and notable places ranked by Wikipedia page views |
| **4. The year** | How does the year unfold, and when does the heat arrive? | A scroll-driven year dial: daily ERA5 means, NOAA daylight, and the solstice lag from a harmonic fit with a seeded 500-sample bootstrap |
| **5. Typical weather** | What should I pack, month by month? | Climograph over 30 years of normals, and the Köppen-Geiger type (Peel et al. 2007) spelled out letter by letter |
| **6. Daylight** | How much light, and how fast does it change? | NOAA declination series; a 24-hour bar for any date |
| **7. Extremes** | Are hot and cold days changing? | Earlier half of the period against the later half; percentile-based heatwave rule |
| **8. Warming** | Is it warming, and by how much? | Warming stripes and decade averages; Theil-Sen slope and Kendall tau, anomalies against 1961 to 1990 |
| **9. Earthquakes** | How restless is the ground? | A radar of every quake at its true distance and direction with a time-lapse; exact Poisson interval, Aki-Utsu b-value |
| **10. Air** | Is the air clean right now? | Open-Meteo air-quality model against the WHO 24-hour guideline |

The page also has a few things I wanted for the sake of it: a progress line down the side that
follows your scroll (the "meridian"), one shared date that links the dial, the climate chart, the
seasons and the daylight curve, a live "right now" panel that works out from longitude whether the
sun is up there, and glossary popovers for terms like *anomaly* and *magnitude*. Details are in
[docs/DESIGN.md](docs/DESIGN.md).

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
corner radii of at most 4 px, no gradients and no pill shapes; motion is there only where it
explains something (the scroll-driven dial, the earthquake time-lapse, the map's fly-in). Light and dark
themes are separately tuned, and both meet WCAG 2.2 AA contrast
(see the table in [docs/DESIGN.md](docs/DESIGN.md)).

## Run it on your machine (Windows)

You need [Python 3.12](https://www.python.org/downloads/) and [Node.js 22](https://nodejs.org/).
Commands below work in PowerShell and in Command Prompt. No activation step is needed because
they call the virtual environment's Python directly.

**1. Get the code**

```
git clone https://github.com/Akif-b-Atif/Meridian.git
cd Meridian
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
| `CONTACT_URL` | URL or email sent in every provider request. Defaults to this repository's URL in development. Required in production. |
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

## Author

Built by [Akif Bin Atif](https://github.com/Akif-b-Atif). Questions and suggestions are welcome as
[issues](https://github.com/Akif-b-Atif/Meridian/issues).

## Licence

The code is MIT licensed (see [LICENSE](LICENSE)). The data shown belongs to its providers and is
used under their terms; Open-Meteo's free tier is for non-commercial use, which is why this site
carries no advertising and sells nothing. Attributions are in the page footer and in
[DATA_SOURCES.md](DATA_SOURCES.md).
