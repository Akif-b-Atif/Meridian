# 0007. No keep-alive ping for the sleeping host

**Status:** accepted

## Context
The free host sleeps after 15 idle minutes and takes about a minute to wake. A scheduled ping would
hide that, at the cost of spending free instance-hours on idle time and working against the
tier's intent.

## Decision
No ping. The browser sends one status request per page load; if it is slow, the page says the
server is waking and counts the seconds, and the rest of the page stays usable. A daily pre-warm
job refreshes sample-city caches, then lets the host sleep again.

## Consequences
The first visit after a quiet spell is slower, but honest about why, and the sample cities are
already cached when the server is up.
