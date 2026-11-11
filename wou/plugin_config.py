"""Host manifest settings with legacy catalog entry fallback (read-only)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from . import identity

_MISSING = object()

_SETTINGS_MIGRATION_BLOCKER = (
    "Hermes exposes plugin manifest settings through ctx.get_config/ctx.set_config only; "
    "there is no public cross-catalog migration API. When the host ctx is absent, WoU "
    "reads plugins.entries from HERMES_HOME/config.yaml directly (not hermes_cli private loaders)."
)


def settings_migration_blocker() -> str:
    """Document why legacy catalog settings need a host-side seam."""
    return _SETTINGS_MIGRATION_BLOCKER


def _entries_from_home_config() -> dict[str, Any]:
    """Best-effort read of plugins.entries from config.yaml (same seam as resolve_hermes_model)."""
    try:
        import yaml  # type: ignore
    except ImportError:
        return {}
    raw = os.environ.get("HERMES_HOME")
    home = Path(raw).expanduser() if raw else Path.home() / ".hermes"
    path = home / "config.yaml"
    if not path.is_file():
        return {}
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError, TypeError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}
    entries = (data.get("plugins") or {}).get("entries") or {}
    return entries if isinstance(entries, dict) else {}


def _explicit_setting(entries: dict[str, Any], plugin_id: str, key: str) -> Any:
    """Return _MISSING when absent; None in yaml is absent; empty string is explicit."""
    settings = (entries.get(plugin_id) or {}).get("settings") or {}
    if not isinstance(settings, dict) or key not in settings:
        return _MISSING
    value = settings[key]
    if value is None:
        return _MISSING
    return value


def _setting_from_entries(entries: dict[str, Any], key: str) -> Any | None:
    """Current catalog id wins, including explicit empty values; legacy fills only missing keys."""
    current = _explicit_setting(entries, identity.CATALOG_ID, key)
    if current is not _MISSING:
        return current
    legacy = _explicit_setting(entries, identity.LEGACY_CATALOG_ID, key)
    if legacy is not _MISSING and legacy != "":
        return legacy
    return None


def get_manifest_setting(ctx: Any, key: str, default: Any = "") -> Any:
    """Read ``plugins.entries.<catalog>.settings`` via ``ctx.get_config``, then legacy catalog id."""
    if ctx is not None:
        get_config = getattr(ctx, "get_config", None)
        if callable(get_config):
            try:
                current = get_config(key, default=_MISSING)
            except TypeError:
                current = get_config(key)
                if current is None:
                    current = _MISSING
            if current is not _MISSING and current is not None:
                return current
    from_yaml = _setting_from_entries(_entries_from_home_config(), key)
    if from_yaml is not None:
        return from_yaml
    return default
