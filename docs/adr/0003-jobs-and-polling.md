# 0003. Run slow calculations as jobs and poll

**Status:** accepted

## Context
A fresh city's climate takes about a minute on the free host (provider pacing plus a small CPU).
Holding a request open that long is fragile behind proxies and gives no way to show progress.

## Decision
A request starts, or joins, a background job keyed by the cache key. If the job finishes within 8
seconds the answer is `200`. Otherwise it is `202` with a step number and label, and the browser
polls on an interval that depends on how many modules are computing, so polling never exceeds the
per-IP limit.

## Alternatives
- **One long request:** no progress and a higher chance of timeouts.
- **WebSockets or server-sent events:** more moving parts than a free single-worker host warrants.

## Consequences
Concurrent visitors asking for the same city share one job. Failures are remembered for two
minutes so pollers do not each trigger a new attempt.
