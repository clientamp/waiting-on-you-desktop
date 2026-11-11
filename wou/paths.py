"""Resolve plugin data directory with or without Hermes runtime."""

from __future__ import annotations

import os
from pathlib import Path

from .discovery import data_root_for_home, has_existing_data
from .identity import CATALOG_ID, INSTALL_DIR_NAMES


def _default_hermes_home() -> Path:
    try:
        from hermes_constants import get_default_hermes_root

        return Path(get_default_hermes_root())
    except Exception:
        return (Path.home() / ".hermes").expanduser()


def _active_hermes_home() -> Path:
    raw = os.environ.get("HERMES_HOME")
    if raw:
        return Path(raw).expanduser()
    try:
        from hermes_constants import get_hermes_home

        return Path(get_hermes_home())
    except Exception:
        return _default_hermes_home()


def _is_hub_install() -> bool:
    """True when this code is the default home's install, not a profile-local copy."""
    try:
        here = Path(__file__).resolve()
        default = _default_hermes_home()
        for name in INSTALL_DIR_NAMES:
            install = (default / "plugins" / name).resolve()
            if here == install or install in here.parents:
                return True
    except OSError:
        return False
    return False


def hub_hermes_home() -> Path | None:
    """Default Hermes home when a secondary profile is hosting the root install.

    The desktop pane is app-wide. Checking a task off while another profile's
    chat is focused sends the API to that profile's plugin host, so
    ``HERMES_HOME`` is the profile. The task list lives in the default home.
    A profile-local copy of the plugin is not redirected.
    """
    if not _is_hub_install():
        return None
    try:
        home = _active_hermes_home().resolve()
        default = _default_hermes_home().resolve()
    except OSError:
        return None
    if home == default:
        return None
    profiles = (default / "profiles").resolve()
    if home.parent == profiles and not home.name.startswith("."):
        return default
    return None


def state_db_path_for_chat_key(chat_key: str) -> Path:
    """Resolve the Hermes state.db that owns a chat_key (hub-aware)."""
    from .config import load_config
    from .collect import collection_config

    profile = chat_key.split(":", 1)[0] if ":" in chat_key else "default"
    if not profile or profile in {".", ".."} or "/" in profile or "\\" in profile:
        raise ValueError("invalid chat profile")
    config = load_config(plugin_data_directory())
    if config.get("error"):
        raise ValueError("cannot resolve owning profile: invalid collection config")
    cfg = collection_config(config)
    matches = [p for p in cfg.local_profiles if str(p.get("name", "")).casefold() == profile.casefold()]
    if len(matches) != 1 or not matches[0].get("state_db"):
        raise ValueError(f"cannot resolve owning profile {profile!r} unambiguously")
    return Path(matches[0]["state_db"]).expanduser()


def plugin_data_directory() -> Path:
    # Explicit override (tests, custom installs) wins over Hermes storage.
    override = os.environ.get("WOU_DATA_DIR")
    if override:
        return Path(override).expanduser()
    hub = hub_hermes_home()
    if hub is not None:
        return data_root_for_home(hub)
    home = _active_hermes_home()
    legacy = data_root_for_home(home)
    # Catalog id may differ from storage namespace; never write task state under
    # ``plugin-data/<catalog_id>`` unless that tree already holds WoU markers.
    try:
        from plugins.plugin_storage import plugin_data_dir

        catalog_dir = Path(plugin_data_dir(CATALOG_ID))
        if catalog_dir != legacy and has_existing_data(catalog_dir) and not has_existing_data(legacy):
            return catalog_dir
    except (ImportError, ValueError, OSError):
        pass
    return legacy
