"""Daily pre-warm of the sample cities. Used by .github/workflows/prewarm.yml.

This is not a keep-alive: it runs once a day, refreshes caches that are about to expire and
lets the free host go back to sleep afterwards. It calls public endpoints only.

    python backend/scripts/prewarm.py --backend-url https://meridian-api.onrender.com
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

import httpx

SAMPLES = json.loads(
    (Path(__file__).resolve().parent.parent / "app" / "data" / "samples.json").read_text()
)
MODULES = ["", "/climate", "/boundary", "/places", "/history", "/seismic?radius=300"]
STOP_CODES = {"BUDGET_EXHAUSTED", "HOURLY_LIMIT"}
NOMINATIM_MODULES = {"/boundary", "/places"}
NOMINATIM_PER_MINUTE = 4


def wake(client: httpx.Client, base: str) -> bool:
    deadline = time.time() + 180
    while time.time() < deadline:
        try:
            r = client.get(f"{base}/api/status", timeout=10)
            if r.status_code == 200 and r.json().get("warm"):
                return True
        except httpx.HTTPError:
            pass
        time.sleep(5)
    return False


def fetch(client: httpx.Client, url: str, limit_s: float = 150) -> tuple[int, dict]:
    deadline = time.time() + limit_s
    while True:
        r = client.get(url, timeout=40)
        body = r.json()
        if r.status_code != 202 or time.time() > deadline:
            return r.status_code, body
        time.sleep(body.get("retryAfterSeconds", 2))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend-url", default=os.environ.get("BACKEND_URL", ""))
    args = ap.parse_args()
    base = args.backend_url.rstrip("/")
    if not base:
        print("Set --backend-url or BACKEND_URL", file=sys.stderr)
        return 2
    rows: list[tuple[str, str, int, str]] = []
    nominatim_times: list[float] = []
    with httpx.Client(headers={"User-Agent": "meridian-prewarm/1.0"}) as client:
        if not wake(client, base):
            print("The backend did not wake within 3 minutes", file=sys.stderr)
            return 1
        day = dt.date.today().timetuple().tm_yday
        chosen = [SAMPLES[(6 * day + i) % len(SAMPLES)] for i in range(6)]
        for city_i, city in enumerate(chosen):
            if city_i:
                time.sleep(30)
            for mod in MODULES:
                if mod in NOMINATIM_MODULES:
                    now = time.time()
                    nominatim_times[:] = [t for t in nominatim_times if now - t < 60]
                    if len(nominatim_times) >= NOMINATIM_PER_MINUTE:
                        time.sleep(60 - (now - nominatim_times[0]))
                    nominatim_times.append(time.time())
                code, body = fetch(client, f"{base}/api/cities/{city['id']}{mod}")
                state = "stale" if body.get("stale") else "fresh"
                rows.append((city["name"], mod or "/identity", code, state))
                err = body.get("error", {}).get("code")
                if err in STOP_CODES:
                    print(f"{err}: stopping, the remaining cities are tried again tomorrow")
                    _print(rows)
                    return 0
    _print(rows)
    return 0


def _print(rows: list[tuple[str, str, int, str]]) -> None:
    print(f"{'city':<12}{'module':<22}{'http':<6}state")
    for r in rows:
        print(f"{r[0]:<12}{r[1]:<22}{r[2]:<6}{r[3]}")


if __name__ == "__main__":
    raise SystemExit(main())
