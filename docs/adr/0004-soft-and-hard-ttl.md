# 0004. Two expiry times per cache entry

**Status:** accepted

## Context
When a provider rate-limits or is down, the best answer is often the last good one. If the cache
deletes an entry the moment it goes out of date, there is nothing to serve.

## Decision
Each entry has a **soft** expiry (freshness) stored in the entry, and Redis holds it for a longer
**hard** TTL. Past the soft expiry the entry is stale: climate is returned at once and refreshed in
the background; other modules refresh while the request waits and fall back to the stale entry on
failure. The climate key has no year in it, and an entry whose data window has moved on counts as
soft-expired, so nothing goes cold on 15 January.

## Consequences
Stale responses are marked in the envelope, shown to the visitor with the compute date, and carry
a short HTTP cache lifetime.
