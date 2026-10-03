# Contributing

Thanks for taking a look. This is a portfolio project by Akif Bin Atif, but fixes and improvements
are welcome.

## Set up

See the "Run it on your machine" section of the [README](README.md). On Windows, call the virtual
environment's Python directly (`.venv\Scripts\python`) so no activation is needed.

## Before opening a pull request

```
cd backend
.venv\Scripts\python -m ruff check .
.venv\Scripts\python -m ruff format --check .
.venv\Scripts\python -m mypy app
.venv\Scripts\python -m pytest -m "not perf"
```

```
cd frontend
npm run lint
npm run typecheck
npm test
```

## House rules

- **Analysis code has tests with known answers.** A new statistic needs a synthetic case whose
  result can be worked out by hand.
- **The API sends numbers and codes, not sentences.** Words live in `frontend/src/copy`, so unit
  changes never need new data.
- **A payload change bumps the cache key version** (`mrd:v1:` in `backend/app/core/cache.py`) and
  regenerates the schema: `python scripts/export_openapi.py` from `backend`.
- **A change to a provider limit updates the capacity tables** in `docs/ARCHITECTURE.md` in the
  same commit. A new provider needs an entry there before any code is written.
- **Design rules are binding** (see [docs/DESIGN.md](docs/DESIGN.md)): no gradients, no pill
  shapes, radius at most 4 px, no decorative motion, contrast checked in both themes.
- Never commit secrets, and never call a real provider from a test.
