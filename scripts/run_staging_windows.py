#!/usr/bin/env python3
"""Executes two sequential staging validation windows for Aetheron Sentinel L3."""

from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))

from aetheron_sentinel_l3.staging import StagingWindowRunner


def main() -> int:
    runner = StagingWindowRunner(prefer_real_pq=True)
    w1, w2 = runner.run_two_clean_staging_windows()
    summary = {
        "staging_windows": [asdict(w1), asdict(w2)],
        "all_windows_clean": bool(w1.passed and w2.passed),
    }
    print(json.dumps(summary, indent=2))
    return 0 if summary["all_windows_clean"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
