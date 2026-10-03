from __future__ import annotations

import json
from pathlib import Path

from scripts.export_openapi import schema

SNAPSHOT = Path(__file__).resolve().parents[3] / "docs" / "openapi.json"


def test_openapi_matches_snapshot() -> None:
    assert SNAPSHOT.exists(), "run: python scripts/export_openapi.py"
    live = json.loads(json.dumps(schema(), sort_keys=True))
    assert live == json.loads(SNAPSHOT.read_text(encoding="utf-8")), (
        "API schema changed. Regenerate docs/openapi.json with python scripts/export_openapi.py"
    )
