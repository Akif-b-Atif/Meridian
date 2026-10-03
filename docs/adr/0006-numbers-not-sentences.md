# 0006. The API sends numbers; the browser writes the words

**Status:** accepted

## Context
Visitors can switch between metric and imperial units at any time. A sentence built on the server
("peak heat arrives 38 days after the solstice, about 12 km from the sea") would have to be
rebuilt, and refetched, for every change.

## Decision
The API returns numbers and machine codes only, always in metric units. All sentences are written
once in `frontend/src/copy` as functions of numbers, and all conversion lives in `frontend/src/units`.

## Consequences
A unit change redraws everything with no request. Wording is easy to review in one place and to
test with edge cases (zero, negative, BCE dates, imperial).
