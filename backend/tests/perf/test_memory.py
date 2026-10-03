"""Resource gates from the design: peak RSS under 380 MB, index load under 10 s, analysis under 15 s."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.perf
@pytest.mark.skipif(sys.platform != "linux", reason="ru_maxrss is in kilobytes on Linux only")
def test_peak_memory_and_timings() -> None:
    out = subprocess.run(
        [sys.executable, "-m", "tests.perf.measure"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split()
    rss_mb, load_s, analysis_s = float(out[0]), float(out[1]), float(out[2])
    print(f"peak RSS {rss_mb:.0f} MB, index load {load_s}s, climate analysis {analysis_s}s")
    assert rss_mb < 380
    assert load_s < 10
    assert analysis_s < 15
