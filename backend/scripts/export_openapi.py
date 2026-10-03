"""Write the generated OpenAPI schema to docs/openapi.json (checked by a contract test)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import create_app

OUT = Path(__file__).resolve().parents[2] / "docs" / "openapi.json"


def schema() -> dict:
    return create_app().openapi()


if __name__ == "__main__":
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(schema(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
