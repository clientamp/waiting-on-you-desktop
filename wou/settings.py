"""User-facing plugin settings (separate from config.json)."""

from __future__ import annotations

import json
import os
import stat
import tempfile
from pathlib import Path
from typing import Any

_VALID_MODES = frozenset({"auto", "hourly", "manual", "off"})

_KNOWN_BOOL_KEYS = frozenset(
    {
        "archive_chat_on_done",
        "auto_tag",
        "decision_gate",
        "decision_priority",
        "consented",
        "name_after_chat",
        "show_priorities",
        "show_project_badges",
        "follow_selected_chat",
    }
)
_KNOWN_STR_KEYS = frozenset({"mode", "group_by", "layout", "priorities_note"})
_VALID_LAYOUTS = ("cards", "compact", "focus")
_KNOWN_INT_KEYS = frozenset(
    {
        "debounce_seconds",
        "sweep_minutes",
        "max_chats_per_scan",
        "daily_call_cap",
        "lookback_days",
        "retention_days",
    }
)
_KNOWN_KEYS = _KNOWN_BOOL_KEYS | _KNOWN_STR_KEYS | _KNOWN_INT_KEYS

_INT_RANGES: dict[str, tuple[int, int]] = {
    "debounce_seconds": (30, 600),
    "sweep_minutes": (15, 240),
    "max_chats_per_scan": (5, 100),
    "daily_call_cap": (0, 2000),
    "lookback_days": (1, 30),
    "retention_days": (0, 365),
}


def _fresh_defaults() -> dict[str, Any]:
    return {
        "priorities_note": "",
        "mode": "auto",
        "debounce_seconds": 90,
        "sweep_minutes": 30,
        "max_chats_per_scan": 25,
        "daily_call_cap": 200,
        "lookback_days": 2,
        "retention_days": 0,
        "consented": False,
        "archive_chat_on_done": False,
        "auto_tag": False,
        "decision_gate": True,
        "decision_priority": True,
        "group_by": "priority",
        "layout": "cards",
        "name_after_chat": False,
        "show_priorities": True,
        "show_project_badges": True,
        "follow_selected_chat": True,
    }


def _existing_install_defaults() -> dict[str, Any]:
    """Legacy installs before the consent field: longer lookback only, not implicit consent."""
    base = _fresh_defaults()
    base["lookback_days"] = 10
    return base


def _defaults_for(data_dir: str | Path) -> dict[str, Any]:
    if _is_existing_install(data_dir):
        return _existing_install_defaults()
    return _fresh_defaults()


def _is_existing_install(data_dir: str | Path) -> bool:
    root = Path(data_dir)
    settings_path = root / "settings.json"
    if settings_path.is_file():
        try:
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and "consented" not in data:
                return True
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            pass
    return False


def _clamp_int(key: str, value: Any, fallback: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return fallback
    lo, hi = _INT_RANGES[key]
    if n < lo or n > hi:
        return fallback
    return n


def _validate_int_patch(key: str, value: Any) -> int:
    if key == 'retention_days' and type(value) is not int:
        raise ValueError(f"{key} must be an integer")
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{key} must be an integer") from None
    lo, hi = _INT_RANGES[key]
    if n < lo or n > hi:
        raise ValueError(f"{key} must be between {lo} and {hi}")
    return n


def load_settings(data_dir: str | Path) -> dict[str, Any]:
    """Load settings.json merged over defaults. Never raises."""
    result = dict(_defaults_for(data_dir))
    path = Path(data_dir) / "settings.json"
    if not path.is_file():
        return result
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            return result
        for key in _KNOWN_BOOL_KEYS:
            if key in data:
                val = data[key]
                if isinstance(val, bool):
                    result[key] = val
        if "mode" in data and isinstance(data["mode"], str):
            mode = data["mode"].strip().lower()
            if mode in _VALID_MODES:
                result["mode"] = mode
        for key in _KNOWN_INT_KEYS:
            if key in data:
                result[key] = _clamp_int(key, data[key], int(result[key]))
        if isinstance(data.get("priorities_note"), str):
            result["priorities_note"] = data["priorities_note"][:1000]
        if data.get("layout") in _VALID_LAYOUTS:
            result["layout"] = data["layout"]
        group_by = data.get("group_by")
        if group_by in ("priority", "project", "none"):
            result["group_by"] = group_by
        elif data.get("show_priorities") is False:
            result["group_by"] = "none"
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        pass
    result["show_priorities"] = result["group_by"] != "none"
    return result


def save_settings(data_dir: str | Path, patch: dict[str, Any]) -> dict[str, Any]:
    """Merge validated patch into settings and persist. Raises ValueError on bad input."""
    if not isinstance(patch, dict):
        raise ValueError("body must be an object")
    unknown = set(patch) - _KNOWN_KEYS
    if unknown:
        raise ValueError(f"unknown fields: {', '.join(sorted(unknown))}")

    root = Path(data_dir)
    os.makedirs(root, mode=0o700, exist_ok=True)
    path = root / "settings.json"
    lock_path = root / "settings.lock"
    lock_fh = None
    current: dict[str, Any]
    try:
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        lock_fh = open(lock_path, "a+", encoding="utf-8")
        from .filelock import exclusive_lock, release_lock

        exclusive_lock(lock_fh)
        current = load_settings(data_dir)
        for key, val in patch.items():
            if key in _KNOWN_BOOL_KEYS:
                if not isinstance(val, bool):
                    raise ValueError(f"{key} must be a boolean")
                current[key] = val
            elif key == "priorities_note":
                if not isinstance(val, str) or len(val) > 1000:
                    raise ValueError(
                        "priorities_note must be a string of at most 1000 characters"
                    )
                current[key] = val
            elif key == "group_by":
                if val not in ("priority", "project", "none"):
                    raise ValueError("group_by must be priority, project, or none")
                current[key] = val
            elif key == "layout":
                if not isinstance(val, str) or val not in _VALID_LAYOUTS:
                    raise ValueError("layout must be cards, compact, or focus")
                current[key] = val
            elif key == "mode":
                if not isinstance(val, str):
                    raise ValueError("mode must be a string")
                mode = val.strip().lower()
                if mode not in _VALID_MODES:
                    raise ValueError("mode must be auto, hourly, manual, or off")
                current["mode"] = mode
            elif key in _KNOWN_INT_KEYS:
                current[key] = _validate_int_patch(key, val)
        if "show_priorities" in patch and "group_by" not in patch:
            current["group_by"] = "priority" if patch["show_priorities"] else "none"
        current["show_priorities"] = current["group_by"] != "none"

        fd, tmp_name = tempfile.mkstemp(suffix=".json", dir=root, text=True)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as tmp_fh:
                tmp_fh.write(json.dumps(current, indent=2) + "\n")
            os.chmod(tmp_name, stat.S_IRUSR | stat.S_IWUSR)
            os.replace(tmp_name, path)
            try:
                os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
            except OSError:
                pass
        finally:
            if os.path.exists(tmp_name):
                try:
                    os.unlink(tmp_name)
                except OSError:
                    pass
    finally:
        if lock_fh is not None:
            try:
                from .filelock import release_lock

                release_lock(lock_fh)
            except Exception:
                pass
            try:
                lock_fh.close()
            except OSError:
                pass
    return current


def scan_knobs(data_dir: str | Path, config: dict[str, Any]) -> dict[str, Any]:
    """Settings override config.json for scanner timing and caps."""
    s = load_settings(data_dir)
    return {
        "mode": s.get("mode", "auto"),
        "consented": bool(s.get("consented", False)),
        "debounce_seconds": float(
            s.get("debounce_seconds", config.get("debounce_seconds", 90))
        ),
        "sweep_minutes": int(s.get("sweep_minutes", config.get("sweep_minutes", 30))),
        "max_chats_per_scan": int(
            s.get("max_chats_per_scan", config.get("max_chats_per_scan", 25))
        ),
        "daily_call_cap": int(s.get("daily_call_cap", 200)),
        "lookback_days": int(s.get("lookback_days", 2)),
        "retention_days": int(s.get("retention_days", 30)),
    }


def resolve_hermes_model() -> dict[str, Any]:
    """Best-effort model info for the waiting_on_you auxiliary task."""
    provider: Any = None
    model: Any = None
    label = "your main Hermes model"
    try:
        from hermes_cli.config import load_config as load_hermes_config  # type: ignore

        cfg = load_hermes_config()
        aux = getattr(cfg, "auxiliary", None) or {}
        if isinstance(aux, dict):
            wou = aux.get("waiting_on_you") or aux.get("waiting-on-you")
            if isinstance(wou, dict):
                provider = wou.get("provider") or provider
                model = wou.get("model") or model
    except Exception:
        pass
    if provider is None and model is None:
        try:
            import yaml  # type: ignore

            home = Path(
                os.environ.get("HERMES_HOME", Path.home() / ".hermes")
            ).expanduser()
            path = home / "config.yaml"
            if path.is_file():
                data = yaml.safe_load(path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    aux = data.get("auxiliary") or {}
                    if isinstance(aux, dict):
                        wou = aux.get("waiting_on_you") or aux.get("waiting-on-you")
                        if isinstance(wou, dict):
                            provider = wou.get("provider")
                            model = wou.get("model")
        except Exception:
            pass
    if model and provider:
        label = f"{model} (via {provider})"
    elif model or provider:
        label = str(model or provider)
    return {"provider": provider, "model": model, "label": label}
