# Verification

What is checked automatically, and what still has to be checked against the live providers before
a public launch.

## Checked automatically

These run in CI on every push and none of them calls a real provider.

| Area | What is tested |
| --- | --- |
| Analysis | Harmonic fit recovers a known peak day and amplitude; wrap-around and weak-cycle guard; bootstrap is reproducible; Köppen on nine hand-checked vectors and three boundary cases; Theil-Sen on an exact line; December belongs to the following winter; heatwave runs, wrap and missing days; indices; daylight against known day lengths and polar cases; Poisson intervals against published values; activity-class boundaries; b-value recovered from a seeded catalogue within 0.1; geodesic area; polygon rejection rules; air-quality hour rules and category boundaries |
| Water index | Antimeridian, polar cases and agreement with a brute-force search on random points; real Natural Earth checks for Cairo, Singapore, Sydney and Moscow |
| Core | Weighted-call arithmetic for both models; token bucket; rolling window; the 16th fresh city is refused and a re-run is not double counted; per-IP admission; all three Open-Meteo 429 reasons; UTC-midnight reset; Overpass caps; sliding-window limiter; cache LRU, compression and size cap; single-flight jobs, 202 progress, failure memory, the 20-job limit, stale-while-revalidate |
| API | The whole API driven against a mocked provider network: search filtering, validation, identity, the full climate pipeline (two archive requests with the right parameters, cached on the second call), seismic, boundary, places, history, air, a provider 429 blocking further calls, one failing provider leaving others intact, and the per-IP limiter |
| Contract | The generated OpenAPI schema equals `docs/openapi.json` |
| Resources | Peak memory under 380 MB, water index load under 10 s, climate analysis under 15 s (`pytest -m perf`, Linux) |
| Front end | Geometry (distance, bearing, solar hour), every takeaway sentence against fixture data, glossary popovers, the Plain/Detailed fold, the chapter rail, and a full-page render of all ten chapters, plus unit conversion for every row, sentence templates, slug rules, API response classification, polling schedule, theme script, preferences with failing storage, search debounce and keyboard use, and a full-page render of all eleven sections |
| Browser | Playwright with a mocked API: search and disambiguation, all sections, 202 polling, error states, waking sequence, radius switch requesting only seismic, unit switch and persistence, clock keyboard use, theme before first paint, reduced motion, WebGL fallback, and axe-core in both themes |

## Visual review still to do

The layout, the scroll-driven dial, the radar and the globe fly-in have been exercised in jsdom
and by the Playwright suite but have not been looked at by a person in a browser. Before launch,
check by eye: chapter spacing at 360, 768 and 1280 px; the sticky dial on a phone while scrolling the
year chapter; the radar time-lapse; the map's globe-to-city flight; and both themes.

## Live checks still to run

These depend on how the providers behave today, which documentation cannot settle. Each has a
fallback already built in; record the outcome in the **Result** column when you run it.

| # | Check | How | Passes if | If it fails | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | Open-Meteo weight model | `python backend/scripts/calibrate_open_meteo.py --contact <url>` | 80 or more successes before the per-minute 429 | Set `OM_WEIGHT_MODEL=floored`; limits adjust themselves | |
| 2 | ERA5 archive request | One request A and B for London | Array lengths 27,759 and 10,958 (window end 2025); sunshine not all null | If sunshine is null the section says so | |
| 3 | Air-quality variables | One call for London | All five hourly names accepted | Rename per the error text | |
| 4 | Geocoding `get` | `python backend/scripts/verify_samples.py` | Every sample returns the expected name and country | Correct `samples.json` and `frontend/src/app/samples.ts` | |
| 5 | Wikidata lookup | `haswbstatement:P1566=<id>` for each sample | Each resolves to one item | Identity runs without Wikidata (status partial) | |
| 6 | Overpass mirror | The count query for London on each mirror | HTTP 200 with 13 count elements | Replace the alternate in `OVERPASS_URLS` | |
| 7 | OpenFreeMap | Compare the style's source and glyph URLs with the published Liberty style; load the map under the CSP | Same URLs; no CSP violations | Correct `frontend/src/map/style.ts` and the CSP lists | |
| 8 | Upstash accounting | 50 cached views each of two cities, then read the console | At most 8 commands per view | Lower `REDIS_ECONOMY_CMDS` to 250,000 | |
| 9 | Nominatim lookup | `/lookup?osm_ids=R65606` | A polygon with fewer than 20,000 points | Raise `polygon_threshold` | |
| 10 | USGS CSV | One count and one query for London | Columns as the parser expects | Adjust the column names | |
| 11 | Render capacity | Deploy and run a full report | Peak memory under 380 MB; wake plus warm-up under 90 s | Lower `BOOTSTRAP_N` to 200 | |
| 12 | Names free | Pages project and Render service names | Both available | Append a suffix | |

The Natural Earth index was built from the `natural-earth-vector` GeoJSON files on GitHub (the
10 m coastline, lakes and rivers themes) rather than from the Natural Earth download site.
