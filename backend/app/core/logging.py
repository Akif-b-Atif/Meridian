"""One JSON object per line on stdout. Search text, IP addresses and cookies are never logged."""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

_logger = logging.getLogger("meridian")


def setup(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    _logger.handlers[:] = [handler]
    _logger.setLevel(level.upper())
    _logger.propagate = False


def _emit(level: int, msg: str, fields: dict[str, Any]) -> None:
    if _logger.isEnabledFor(level):
        rec = {
            "ts": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "level": logging.getLevelName(level).lower(),
            "msg": msg,
            **fields,
        }
        _logger.log(level, json.dumps(rec, default=str))


def info(msg: str, **f: Any) -> None:
    _emit(logging.INFO, msg, f)


def warn(msg: str, **f: Any) -> None:
    _emit(logging.WARNING, msg, f)


def error(msg: str, **f: Any) -> None:
    _emit(logging.ERROR, msg, f)
