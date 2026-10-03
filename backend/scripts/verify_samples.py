"""Check that every sample city ID still resolves to the expected name and country."""

from __future__ import annotations

import json
from pathlib import Path

import httpx

SAMPLES = json.loads(
    (Path(__file__).resolve().parent.parent / "app" / "data" / "samples.json").read_text()
)


def main() -> int:
    bad = 0
    with httpx.Client(headers={"User-Agent": "meridian-verify/1.0"}, timeout=20) as c:
        for s in SAMPLES:
            r = c.get(
                "https://geocoding-api.open-meteo.com/v1/get",
                params={"id": s["id"], "language": "en"},
            )
            j = r.json()
            ok = j.get("name") == s["name"] and j.get("country_code") == s["countryCode"]
            print(
                f"{'ok ' if ok else 'BAD'} {s['id']} {s['name']} -> {j.get('name')} {j.get('country_code')}"
            )
            bad += not ok
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
