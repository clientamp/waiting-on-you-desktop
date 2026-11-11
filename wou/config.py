"""Plugin configuration loaded from plugin data directory."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def _defaults() -> dict[str, Any]:
    return {
        "collect": {},
        "model": {
            "provider": None,
            "model": None,
            "reasoning_effort": "low",
        },
        "debounce_seconds": 90,
        "sweep_minutes": 30,
        "max_chats_per_scan": 25,
        "quiet_hours": None,
        "action_handlers": {},
    }


def _deep_merge(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in overlay.items():
        if (
            key in out
            and isinstance(out[key], dict)
            and isinstance(value, dict)
        ):
            out[key] = {**out[key], **value}
        else:
            out[key] = value
    return out


def load_config(data_dir: str | Path) -> dict[str, Any]:
    """Load config.json merged over defaults. Never raises."""
    result = _defaults()
    error: str | None = None
    path = Path(data_dir) / "config.json"
    if not path.is_file():
        return result
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            error = "config.json must be a JSON object"
        else:
            result = _deep_merge(result, data)
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        error = str(exc)
        result = _defaults()
    if error is not None:
        result["error"] = error
    return result


def normalized_action_handlers(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Return chat_key prefix → handler config. Invalid entries are dropped."""
    raw = config.get("action_handlers")
    if not isinstance(raw, dict):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for prefix, entry in raw.items():
        if not isinstance(prefix, str) or not prefix:
            continue
        if not isinstance(entry, dict):
            continue
        command = entry.get("command")
        if not isinstance(command, list) or not command:
            continue
        if not all(isinstance(part, str) and part for part in command):
            continue
        if not os.path.isabs(command[0]):
            continue
        timeout_raw = entry.get("timeout_seconds", 60)
        try:
            timeout = int(timeout_raw)
        except (TypeError, ValueError):
            timeout = 60
        timeout = max(1, min(300, timeout))
        out[prefix] = {"command": list(command), "timeout_seconds": timeout}
    return out


def match_action_handler(
    handlers: dict[str, dict[str, Any]], chat_key: str
) -> dict[str, Any] | None:
    best: dict[str, Any] | None = None
    best_len = -1
    for prefix, cfg in handlers.items():
        if chat_key.startswith(prefix) and len(prefix) > best_len:
            best = cfg
            best_len = len(prefix)
    return best


def ensure_data_dir(data_dir: str | Path) -> Path:
    root = Path(data_dir).expanduser().resolve()
    os.makedirs(root, mode=0o700, exist_ok=True)
    try:
        os.chmod(root, 0o700)
    except OSError:
        pass
    return root
