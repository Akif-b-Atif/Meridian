"""Infer how Open-Meteo weighs archive requests (fractional or floored).

The API has no usage counter, so the script sends 700-day single-variable requests (weight 5
if fractional, weight 50 if floored) until the per-minute limit answers 429, then counts the
successes. Run once, after two idle minutes, on a day the application has served no fresh cities.
It costs about 600 weighted calls.

    python scripts/calibrate_open_meteo.py --contact https://github.com/you/meridian
"""

from __future__ import annotations

import argparse
import sys

import httpx


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--contact", required=True, help="URL or email for the User-Agent")
    ap.add_argument("--max-requests", type=int, default=150)
    args = ap.parse_args()
    ua = f"Meridian-calibration/1.0 ({args.contact})"
    ok = 0
    with httpx.Client(headers={"User-Agent": ua}, timeout=60) as client:
        for i in range(args.max_requests):
            r = client.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params={
                    "latitude": round(10 + 0.37 * i, 2),
                    "longitude": 10,
                    "start_date": "2022-01-01",
                    "end_date": "2023-12-01",
                    "daily": "temperature_2m_mean",
                    "models": "era5",
                },
            )
            if r.status_code == 429 and "minutely" in r.text.lower():
                break
            r.raise_for_status()
            ok += 1
    print(f"successful requests before the per-minute limit: {ok}")
    if ok >= 80:
        print("Result: fractional weighting. Set OM_WEIGHT_MODEL=fractional")
    else:
        print("Result: floored weighting (or inconclusive). Set OM_WEIGHT_MODEL=floored")
        if ok > 25:
            print(
                "Warning: the result sits between the two models, so the safe reading was chosen.",
                file=sys.stderr,
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
