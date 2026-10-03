"""Build app/data/water_index.gpkg from Natural Earth 10m physical vectors.

Run once per Natural Earth release. Files are read from --src (a folder holding the three
GeoJSON files) or downloaded from the nvkelso/natural-earth-vector repository on GitHub.

    python scripts/build_water_index.py
    python scripts/build_water_index.py --src C:\\data\\natural-earth
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import shapely
from pyogrio import raw
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, shape

BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
FILES = {
    "coast": "ne_10m_coastline.geojson",
    "lake": "ne_10m_lakes.geojson",
    "river": "ne_10m_rivers_lake_centerlines.geojson",
}
OUT = Path(__file__).resolve().parent.parent / "app" / "data" / "water_index.gpkg"
MAX_VERTICES = 200
MAX_SIZE_MB = 40


def load(name: str, src: Path | None) -> list[dict]:
    if src and (src / name).exists():
        return json.loads((src / name).read_text(encoding="utf-8"))["features"]
    print(f"downloading {name}")
    with urllib.request.urlopen(f"{BASE}/{name}", timeout=120) as r:
        return json.loads(r.read())["features"]


def lines_of(geom) -> list[LineString]:
    if isinstance(geom, LineString):
        return [geom]
    if isinstance(geom, MultiLineString):
        return list(geom.geoms)
    if isinstance(geom, Polygon):
        return [LineString(geom.exterior.coords), *[LineString(r.coords) for r in geom.interiors]]
    if isinstance(geom, MultiPolygon):
        return [ln for p in geom.geoms for ln in lines_of(p)]
    return []


def chunks(line: LineString) -> list[LineString]:
    c = np.asarray(line.coords)
    if len(c) < 2:
        return []
    out = []
    for i in range(0, len(c) - 1, MAX_VERTICES - 1):
        part = c[i : i + MAX_VERTICES]
        if len(part) >= 2:
            out.append(LineString(part))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=None)
    args = ap.parse_args()
    geoms: list[LineString] = []
    kinds: list[str] = []
    names: list[str | None] = []
    for kind, fname in FILES.items():
        for f in load(fname, args.src):
            props = f.get("properties") or {}
            if kind == "river" and "lake" in str(props.get("featurecla", "")).lower():
                continue
            if f.get("geometry") is None:
                continue
            name = props.get("name") or None
            for line in lines_of(shape(f["geometry"])):
                for ch in chunks(line):
                    geoms.append(ch)
                    kinds.append(kind)
                    names.append(name)
    wkb = shapely.to_wkb(np.array(geoms, dtype=object))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()
    raw.write(
        str(OUT),
        geometry=wkb,
        field_data=[np.array(kinds, dtype=object), np.array(names, dtype=object)],
        fields=["kind", "name"],
        geometry_type="LineString",
        crs="EPSG:4326",
        layer="water",
        driver="GPKG",
    )
    mb = OUT.stat().st_size / 1e6
    print(f"wrote {len(geoms)} chunks to {OUT} ({mb:.1f} MB)")
    if mb > MAX_SIZE_MB:
        print(f"index is larger than {MAX_SIZE_MB} MB", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
