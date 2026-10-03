"""Nearest coast, lake and river from a prebuilt Natural Earth chunk index (SDS 8.6)."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import shapely
import shapely.ops
from pyproj import CRS, Geod, Transformer
from shapely.geometry import LineString, Point, box
from shapely.strtree import STRtree

GEOD = Geod(ellps="WGS84")
KINDS = ("coast", "lake", "river")


class WaterIndex:
    def __init__(self) -> None:
        self.trees: dict[str, STRtree] = {}
        self.geoms: dict[str, np.ndarray] = {}
        self.names: dict[str, list[str | None]] = {}

    @classmethod
    def from_lines(cls, data: dict[str, list[tuple[LineString, str | None]]]) -> WaterIndex:
        idx = cls()
        for kind in KINDS:
            items = data.get(kind, [])
            if not items:
                continue
            geoms = np.array([g for g, _ in items], dtype=object)
            idx.geoms[kind] = geoms
            idx.names[kind] = [n for _, n in items]
            idx.trees[kind] = STRtree(geoms)
        return idx

    @classmethod
    def load(cls, path: Path) -> WaterIndex:
        import pyogrio

        _, _, geometry, fields = pyogrio.raw.read(str(path), layer="water")
        # pyogrio.raw returns WKB; fields are (kind, name) in column order
        geoms = shapely.from_wkb(geometry)
        kinds, names = fields[0], fields[1]
        data: dict[str, list[tuple[LineString, str | None]]] = {k: [] for k in KINDS}
        for g, k, n in zip(geoms, kinds, names, strict=True):
            data[str(k)].append((g, None if n is None else str(n)))
        return cls.from_lines(data)

    def nearest(self, kind: str, lat: float, lon: float) -> dict[str, Any] | None:
        tree = self.trees.get(kind)
        if tree is None:
            return None
        pt = Point(lon, lat)
        i0 = int(tree.nearest(pt))
        geoms = self.geoms[kind]
        g0 = geoms[i0]
        n0 = shapely.ops.nearest_points(g0, pt)[0]
        _, _, d0 = GEOD.inv(lon, lat, n0.x, n0.y)
        dlat = 1.05 * (d0 / 1000) / 110.574
        cos_lat = max(math.cos(math.radians(lat)), 1e-6)
        dlon = dlat / cos_lat
        boxes = []
        if abs(lat) + dlat >= 89.9 or dlon >= 180:
            boxes.append(box(-180, max(-90, lat - dlat), 180, min(90, lat + dlat)))
        else:
            x0, x1 = lon - dlon, lon + dlon
            y0, y1 = max(-90, lat - dlat), min(90, lat + dlat)
            if x0 < -180:
                boxes += [box(x0 + 360, y0, 180, y1), box(-180, y0, x1, y1)]
            elif x1 > 180:
                boxes += [box(x0, y0, 180, y1), box(-180, y0, x1 - 360, y1)]
            else:
                boxes.append(box(x0, y0, x1, y1))
        cand: set[int] = set()
        for b in boxes:
            cand.update(int(i) for i in tree.query(b))
        cand.add(i0)
        proj = Transformer.from_crs(
            CRS.from_epsg(4326),
            CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m"),
            always_xy=True,
        )
        best_d, best_pt = float("inf"), None
        for i in cand:
            g = geoms[i]
            coords = np.asarray(g.coords)
            x, y = proj.transform(coords[:, 0], coords[:, 1])
            line = LineString(np.column_stack([x, y]))
            d = line.distance(Point(0, 0))
            if d < best_d:
                best_d = d
                near = line.interpolate(line.project(Point(0, 0)))
                inv = Transformer.from_crs(proj.target_crs, proj.source_crs, always_xy=True)
                best_pt = inv.transform(near.x, near.y)
                best_i = i
        assert best_pt is not None
        az, _, dist = GEOD.inv(lon, lat, best_pt[0], best_pt[1])
        return {
            "km": round(dist / 1000, 1),
            "lat": round(best_pt[1], 4),
            "lon": round(best_pt[0], 4),
            "bearingDeg": round(az % 360),
            "name": self.names[kind][best_i],
        }

    def payload(self, lat: float, lon: float) -> dict[str, Any]:
        coast = self.nearest("coast", lat, lon)
        if coast is None:
            raise RuntimeError("water index has no coastline")
        km = coast["km"]
        cls = "coastal" if km < 10 else ("near-coast" if km < 50 else "inland")
        return {
            "coast": coast,
            "lake": self.nearest("lake", lat, lon),
            "river": self.nearest("river", lat, lon),
            "coastClass": cls,
        }
