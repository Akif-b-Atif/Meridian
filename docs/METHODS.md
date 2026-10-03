# Methods

Every statistic on a Meridian page, how it is computed and what it cannot tell you. The code lives
in `backend/app/analysis/`, and each method has tests against answers that can be worked out by
hand.

## Data windows

- **Normals window:** the last 30 full years. ERA5 lags real time by about five days, so the window
  ends on 31 December of last year from 15 January onward, and of the year before that until then.
- **Trend series:** annual means from 1950 to the same end year.
- **Calendar:** every year is reduced to 365 days. 29 February is averaged with 28 February for
  temperature and sunshine, and added to it for rainfall so annual totals stay exact. Day numbers
  run 1 to 365 and the solstices are fixed at days 172 (21 June) and 355 (21 December).
- Missing days are kept as gaps and every statistic ignores them. A year needs at least 329 of 365
  days for an annual mean, and a month must be complete to count towards a monthly rainfall total.

ERA5 is a **gridded reanalysis**, not a station record. It describes the area around the city.

## Seasons

Meteorological seasons by calendar month (December to February, March to May and so on, shifted by
six months in the southern hemisphere). Where the annual temperature range (warmest minus coldest
monthly mean) is under 3 °C, temperature seasons are not meaningful, so the page reports wet and
dry months instead: a month is wet if its rainfall is above the annual monthly mean.

## Seasonal lag (the signature analysis)

1. Average the daily mean temperature by day of year over 30 years.
2. Fit `T(d) = M + a cos(2πd/P) + b sin(2πd/P)` by least squares, with `P = 365.2425`. The
   semi-amplitude is `A = √(a² + b²)` and the peak day is `(P/2π)·atan2(b, a)`.
3. The lag is the peak day minus the warm solstice (June in the north, December in the south),
   wrapped to ±182.6 days. The cold lag uses the trough, half a year later, against the other
   solstice.
4. **Cross-check:** the peak of a 31-day circular rolling mean. If it differs from the harmonic peak
   by more than 10 days the page says to read the lag with caution.
5. **Uncertainty:** 500 bootstrap resamples of the 30 years, seeded by the city's GeoNames ID so
   results are reproducible. All fits run as one matrix product. The 90% interval is the 5th to
   95th percentile of the resampled peaks.
6. **Guard rail:** if `A` is under 2 °C the page reports that the annual cycle is too weak to
   measure a lag.

The wording is observational. It never claims a cause such as sea or continent.

## Köppen-Geiger classification

The rules of Peel, Finlayson and McMahon (2007), tested in the order E, B, A, C, D. The summer
half-year is whichever of October to March and April to September is warmer. The dryness threshold
depends on where the rain falls (2·MAT, 2·MAT + 14 or 2·MAT + 28). Tests use nine synthetic
monthly vectors with hand-checked classes plus the boundary cases (a coldest month of exactly 0 °C
gives D, 18 °C gives A, a hottest month of exactly 10 °C is not E). The result is a function of ERA5
normals for the last 30 years, so it can differ from published maps built on 1980 to 2016 station
data.

## Warming trend

The Theil-Sen slope with a 95% interval, and Kendall's tau with its two-sided p-value (equivalent
to the Mann-Kendall test), on annual means. Anomalies are measured against the 1961 to 1990 mean
(shown only if at least 25 of those years are valid). **Annual means are autocorrelated, so the
p-value is optimistic**, and the page says so.

## Extremes

Per year: days with a maximum of at least 30 °C and at least 35 °C, frost days (minimum below 0 °C)
and wet days (at least 1 mm). A year with fewer than 347 days of data is dropped; one with slightly
fewer than 365 is scaled up. A **heatwave** is at least three consecutive days with a maximum above
the 90th percentile of that calendar day, estimated from a five-day window across all 30 years
(circular, so it wraps at New Year). A missing day ends a run. Events and days are compared between
the first and last 15 years.

## Continentality and rainfall seasonality

- Gorczynski (1920): `K = 1.7·ΔT / sin(|φ| + 10°) − 14`. The bands on the page (under 20 oceanic,
  20 to 50 transitional, over 50 continental) are my own wording, not taken from the paper.
- Walsh and Lawler (1981): `SI = Σ|xₘ − R/12| / R` with seven classes. Not reported below 25 mm a
  year.

## Daylight

The NOAA solar declination series and the standard hour-angle equation with a zenith of 90.833°
(refraction and the solar radius). Polar day and night are detected where the cosine leaves ±1.
Tests compare against known day lengths for London, Reykjavik and Singapore.

## Earthquakes

- Events: USGS catalogue, magnitude 4.5 or more, from 1973 (the catalogue is considered complete
  at that magnitude worldwide from about then), within 100, 300 or 500 km.
- **Rate:** events per year, with the exact 90% Poisson interval from the incomplete gamma
  function, and the same per 100,000 km² of the search cap so classes do not depend on the radius.
- **Activity class:** none, very low, low, moderate, high, very high, from thresholds of 0.05, 0.3,
  1.5 and 6 events per year per 100,000 km². A descriptive label, not a hazard rating.
- **Completeness magnitude:** the most frequent 0.1-magnitude bin plus 0.2.
- **b-value:** Aki-Utsu maximum likelihood with the bin-width correction,
  `b = log₁₀(e) / (mean(M) − (Mc − 0.05))`, standard error `b/√N`. Reported only with at least 50
  events at or above Mc.
- **Recurrence** for magnitude 5, 6 and 7 is extrapolated from that fit and labelled indicative.
  Anything over 10,000 years is shown as such. It is not a forecast.
- Large catalogues are fetched by recursive bisection by date, newest half first, within a
  10-request cap; a catalogue that cannot be completed is flagged as partial with its coverage start.

## Distance to water

Natural Earth 1:10 million coastline, lakes and rivers are cut into chunks of at most 200
vertices and stored in a GeoPackage built by `scripts/build_water_index.py`. A query finds a
candidate chunk, bounds the true distance geodesically, gathers every chunk inside that bound
(splitting at the antimeridian, widening near the poles) and measures exactly in a local azimuthal
equidistant projection centred on the city. Tests compare against a brute-force search on random
points. Distances are good to a few kilometres.

## Places

Counts by category come from one Overpass query with a `count` statement per category, matched by
position. Density uses the boundary area from Nominatim, or a 5 km circle (78.5 km²) when no
boundary is available. Notable places merge OpenStreetMap features with nearby Wikipedia articles
(matched by the `wikipedia` tag, or by name within 150 m) and are ranked by 30-day page views.
OSM completeness varies by region, which the page states.

## Air quality

Open-Meteo's air-quality model. Daily values need at least 18 valid hours, except the current day,
which is marked partial. The page shows the European index in Europe and the US index elsewhere,
with the category taken from each day's maximum.

## What none of this tells you

Reanalysis smooths local effects. A coastal or mountain city's grid cell may be warmer, cooler or
wetter than the city. A trend over seven decades says nothing about a single year. Counts of mapped
places measure mapping effort as well as places. The numbers are meant to be read as a careful
sketch of a place, not as a substitute for local records.
