# Data sources and licences

Meridian shows data from the sources below. I do not own any of it. Each source's terms are
summarised here; the page footer carries the required attributions.

| Source | Used for | Licence and terms |
| --- | --- | --- |
| [Open-Meteo](https://open-meteo.com/) | City search, ERA5 daily weather, air quality | Free API for **non-commercial** use, no key, attribution required (CC BY 4.0). Limits are per IP address: 600 weighted calls a minute, 5,000 an hour, 10,000 a day. This is why the site has no advertising and sells nothing |
| [ERA5 / Copernicus Climate Change Service](https://climate.copernicus.eu/) | The reanalysis behind Open-Meteo's historical data | Copernicus licence; the modification notice is shown in the footer. ERA5 is gridded model output, not station data |
| [GeoNames](https://www.geonames.org/) | Place identifiers and coordinates, through Open-Meteo | CC BY 4.0 |
| [USGS Earthquake Catalog](https://earthquake.usgs.gov/fdsnws/event/1/) | Earthquake history | US Government work, public domain. No published numeric rate limit; used politely |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via Overpass and Nominatim | Place counts, notable places, city boundaries | ODbL, "© OpenStreetMap contributors". Overpass: regular use should stay under about 100 queries and 10 MB a day. Nominatim: at most 1 request a second, an identifying User-Agent, no autocomplete, no bulk geocoding |
| [Wikidata](https://www.wikidata.org/) | Founding date, area, population, country facts | CC0 |
| [Wikipedia](https://en.wikipedia.org/) | City summaries and nearby articles | Text under CC BY-SA 4.0, shown as a short extract (at most 1,100 characters) with a link to the article. Requests identify the application and a contact address |
| [Natural Earth](https://www.naturalearthdata.com/) | Coastline, lakes and rivers for distance to water | Public domain. A derived GeoPackage built from the 1:10 million physical themes is committed to this repository |
| [OpenFreeMap](https://openfreemap.org/) and OpenMapTiles | Map tiles | Free, no key. Attribution "OpenFreeMap © OpenMapTiles, data from OpenStreetMap" is shown on the map |
| [Source Sans 3](https://github.com/adobe-fonts/source-sans) | Typeface | SIL Open Font Licence, self-hosted |

## How requests are made

- Every request to a provider comes from the backend and carries
  `Meridian/<version> (<contact>) python-httpx/<version>`. The backend will not start in production
  without a contact URL or email.
- Every provider's base URL is an environment variable, so a provider can be replaced without
  changing code.
- Caches are long, daily budgets are enforced in code, and a provider that answers 429 is left
  alone until its limit window passes. The numbers are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- The site stores no personal data and sets no cookies. `localStorage` holds only the theme and unit
  choices, in your own browser.

The values on the site are modelled and are for information only.
