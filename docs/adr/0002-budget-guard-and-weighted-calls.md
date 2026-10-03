# 0002. Meter every provider call and cap fresh cities per day

**Status:** accepted

## Context
Open-Meteo's free tier counts a long request as several calls. A fresh city needs about 511 of the
10,000 daily calls, limits are per IP address, and the free host shares outbound addresses.

## Decision
Charge every attempt (including retries) to a ledger before it is sent. Enforce a per-minute token
bucket, a rolling hour, a daily hard cap below the provider's, a reserve for light calls and a
daily limit on fresh cities (15). Persist the ledger to Redis so a restart does not forget the day.
Support both readings of the weighting rule and let a calibration script choose.

## Alternatives
- **Trust the provider to throttle:** a shared address means another tenant could use my allowance.
- **Fetch less history:** the 1950 start and the 30-year window are what make the trend and the
  normals meaningful.
- **Pay for an API plan:** against the project's constraint that everything stays free.

## Consequences
Visitors can hit a "today's allowance is used" state for new cities. Sample cities and anything
already cached keep working, and the message says when the allowance resets.
