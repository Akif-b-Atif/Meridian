"""Boundary processing and geodesic helpers (SDS 8.8)."""

from __future__ import annotations

from typing import Any

from pyproj import Geod
from shapely.geometry import MultiPolygon, Point, Polygon, mapping, shape
from shapely.validation import make_valid

GEOD = Geod(ellps="WGS84")


def geodesic_area_km2(geom: Polygon | MultiPolygon) -> float:
    polys = [geom] if isinstance(geom, Polygon) else list(geom.geoms)
    total = 0.0
    for p in polys:
        a, _ = GEOD.geometry_area_perimeter(p)
        total += abs(a)
    return total / 1e6


def circle(lat: float, lon: float, radius_km: float, n: int = 64) -> Polygon:
    pts = []
    for i in range(n):
        lo, la, _ = GEOD.fwd(lon, lat, 360 * i / n, radius_km * 1000)
        pts.append((lo, la))
    return Polygon(pts)


def vertex_count(geom: Polygon | MultiPolygon) -> int:
    polys = [geom] if isinstance(geom, Polygon) else list(geom.geoms)
    return sum(len(p.exterior.coords) + sum(len(r.coords) for r in p.interiors) for p in polys)


def _round_coords(obj: Any) -> Any:
    if isinstance(obj, (list, tuple)):
        return [_round_coords(x) for x in obj]
    return round(obj, 4)


def process_polygon(
    gj: dict[str, Any], lat: float, lon: float, wikidata_area_km2: float | None
) -> dict[str, Any] | None:
    """Return the boundary payload or None if the polygon must be rejected."""
    if gj.get("type") not in ("Polygon", "MultiPolygon"):
        return None
    geom = shape(gj)
    if not geom.is_valid:
        geom = make_valid(geom)
    parts = [g for g in getattr(geom, "geoms", [geom]) if isinstance(g, (Polygon, MultiPolygon))]
    flat: list[Polygon] = []
    for g in parts:
        flat.extend([g] if isinstance(g, Polygon) else list(g.geoms))
    if not flat:
        return None
    minx, _miny, maxx, _maxy = MultiPolygon(flat).bounds
    if maxx - minx > 180:
        return None
    big = max(p.area for p in flat)
    flat = [p for p in flat if p.area >= 0.005 * big]
    geom = flat[0] if len(flat) == 1 else MultiPolygon(flat)
    dist_km = 0.0
    if not geom.contains(Point(lon, lat)):
        near = (
            geom.exterior.interpolate(geom.exterior.project(Point(lon, lat)))
            if isinstance(geom, Polygon)
            else min(
                (p.exterior.interpolate(p.exterior.project(Point(lon, lat))) for p in flat),
                key=lambda q: q.distance(Point(lon, lat)),
            )
        )
        _, _, d = GEOD.inv(lon, lat, near.x, near.y)
        dist_km = d / 1000
    if dist_km > 50:
        return None
    area = geodesic_area_km2(geom)
    if wikidata_area_km2 and (area / wikidata_area_km2 > 10 or area / wikidata_area_km2 < 0.1):
        return None
    tol = 0.001
    simp = geom
    while vertex_count(simp) > 1500 and tol <= 0.016:
        simp = geom.simplify(tol, preserve_topology=True)
        tol *= 2
    if vertex_count(simp) > 1500:
        simp = geom.convex_hull
    g = mapping(simp)
    b = simp.bounds
    return {
        "kind": "polygon",
        "areaKm2": round(area, 1),
        "bbox": [round(b[0], 4), round(b[1], 4), round(b[2], 4), round(b[3], 4)],
        "geometry": {"type": g["type"], "coordinates": _round_coords(g["coordinates"])},
        "vertexCount": vertex_count(simp) if not isinstance(simp, Polygon) or True else 0,
    }


def circle_payload(lat: float, lon: float, radius_km: float = 5.0) -> dict[str, Any]:
    c = circle(lat, lon, radius_km)
    b = c.bounds
    g = mapping(c)
    return {
        "kind": "circle",
        "osmRelationId": None,
        "areaKm2": 78.5,
        "bbox": [round(x, 4) for x in b],
        "geometry": {"type": "Polygon", "coordinates": _round_coords(g["coordinates"])},
        "vertexCount": 64,
    }
