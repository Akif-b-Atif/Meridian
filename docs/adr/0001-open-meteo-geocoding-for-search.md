# 0001. Search with Open-Meteo's geocoder, not Nominatim

**Status:** accepted

## Context
City search needs search-as-you-type, ranked candidates with population, and a stable identifier
that links to Wikidata.

## Decision
Use Open-Meteo's geocoding API. Its results carry a GeoNames ID, which becomes the city key
everywhere, and GeoNames IDs resolve to Wikidata through property P1566.

## Alternatives
- **Nominatim:** the usual choice, but its usage policy forbids autocomplete on the public
  instance. It is used only to fetch a boundary for a city already chosen.
- **A fallback geocoder for when Open-Meteo is limiting:** rejected. A different geocoder would
  return no GeoNames ID, which is the primary key. When search is limited the page shows cached
  results, a clear message and the sample cities.

## Consequences
Search shares Open-Meteo's daily allowance, so it has its own cap (600 a day) and a minimum of
three characters with a 300 ms debounce.
