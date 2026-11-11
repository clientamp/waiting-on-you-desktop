#!/usr/bin/env python3
"""Copy wou/collect.py to satellite/wou_satellite/reader.py (byte-identical)."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "wou" / "collect.py"
DST = ROOT / "satellite" / "wou_satellite" / "reader.py"


def main() -> int:
    if not SRC.is_file():
        print(f"missing source: {SRC}", file=sys.stderr)
        return 1
    DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SRC, DST)
    print(f"copied {SRC} -> {DST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
