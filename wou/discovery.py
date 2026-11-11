"""Detect existing installs under the legacy data namespace (disposable paths only in tests)."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .identity import DATA_NAMESPACE

_WOU_SETTINGS_KEYS = frozenset(
    {
        "consented",
        "mode",
        "group_by",
        "layout",
        "decision_gate",
        "decision_priority",
        "debounce_seconds",
        "sweep_minutes",
    }
)
_WOU_CONFIG_KEYS = frozenset({"collect", "model", "debounce_seconds", "sweep_minutes"})


def data_root_for_home(hermes_home: Path) -> Path:
    """Canonical plugin-data directory for task DB and settings.json.

    Uses ``DATA_NAMESPACE`` (``waiting-on-you``), not the Desktop catalog id, so a
    renamed catalog does not fork task state or collide with another plugin's
    ``plugin-data/<catalog_id>`` tree.
    """
    return hermes_home.expanduser() / "plugin-data" / DATA_NAMESPACE


def _looks_like_wou_db(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            row = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasks'"
            ).fetchone()
            return row is not None
        finally:
            conn.close()
    except (OSError, sqlite3.Error):
        return False


def _looks_like_wou_json(path: Path, expected_keys: frozenset[str]) -> bool:
    if not path.is_file():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return False
    if not isinstance(data, dict):
        return False
    return bool(expected_keys & data.keys())


def has_existing_data(root: Path) -> bool:
    """True when ``root`` already holds WoU state verified by schema markers."""
    base = root.expanduser()
    if not base.is_dir():
        return False
    if _looks_like_wou_db(base / "wou.db"):
        return True
    if _looks_like_wou_json(base / "config.json", _WOU_CONFIG_KEYS):
        return True
    if _looks_like_wou_json(base / "settings.json", _WOU_SETTINGS_KEYS):
        return True
    return False
