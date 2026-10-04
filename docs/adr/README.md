# Architecture decision records

Short records of the decisions that shaped Meridian, each with the alternatives I turned down.

| # | Decision |
| --- | --- |
| [0001](0001-open-meteo-geocoding-for-search.md) | Search with Open-Meteo's geocoder, not Nominatim |
| [0002](0002-budget-guard-and-weighted-calls.md) | Meter every provider call and cap fresh cities per day |
| [0003](0003-jobs-and-polling.md) | Run slow calculations as jobs and poll, instead of holding requests open |
| [0004](0004-soft-and-hard-ttl.md) | Two expiry times per cache entry |
| [0005](0005-prebuilt-water-index.md) | Bundle Natural Earth instead of querying coastlines |
| [0006](0006-numbers-not-sentences.md) | The API sends numbers; the browser writes the words |
| [0007](0007-no-keep-alive.md) | No keep-alive ping for the sleeping host |
| [0008](0008-svg-charts-without-a-kit.md) | Hand-built SVG charts and no component kit |
| [0009](0009-chapters-and-real-pixel-charts.md) | Ten chapters, computed takeaways and charts drawn in real pixels |
