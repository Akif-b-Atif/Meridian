# 0005. Bundle Natural Earth instead of querying coastlines

**Status:** accepted

## Context
Distance to the nearest coast, lake and river could come from Overpass, but those queries are
heavy and Overpass is the scarcest budget in the project.

## Decision
Build a GeoPackage of Natural Earth 1:10 million coastline, lakes and rivers, cut into chunks of at
most 200 vertices, and commit it (about 18 MB). Queries use a spatial index, bound the true
geodesic distance, and measure exactly in a local azimuthal equidistant projection.

## Consequences
Results are instant, free and deterministic, but only as accurate as the generalised data: a few
kilometres, large lakes only, major rivers only. The page says so in those words. This is a
deliberate exception to "everything comes from an API".
