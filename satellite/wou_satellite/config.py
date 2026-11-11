"""Paths and atomic JSON persistence for the satellite plugin."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from . import VERSION

META_KEYS = frozenset(
    {"last_full_at", "last_ok_at", "last_error", "next_retry_at", "retry_backoff"}
)

PAIRING_FILE = "pairing.json"
SENT_FILE = "sent.json"
LOCK_FILE = "push.lock"


def hermes_home() -> Path:
    try:
        from hermes_constants import get_hermes_home  # type: ignore[import-not-found]

        return Path(get_hermes_home()).expanduser()
    except ImportError:
        return Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")).expanduser()


def plugin_data_directory() -> Path:
    override = os.environ.get("WOU_SAT_DATA_DIR")
    if override:
        return Path(override).expanduser()
    try:
        from plugins.plugin_storage import plugin_data_dir  # type: ignore[import-not-found]

        return Path(plugin_data_dir("waiting-on-you-satellite")).expanduser()
    except ImportError:
        return hermes_home() / "plugin-data" / "waiting-on-you-satellite"


def state_db_path() -> Path:
    override = os.environ.get("WOU_SAT_STATE_DB")
    if override:
        return Path(override).expanduser()
    return hermes_home() / "state.db"


def _atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def write_json(path: Path, data: dict[str, Any]) -> None:
    _atomic_write(path, json.dumps(data, indent=2, sort_keys=True) + "\n")


def pairing_path(data_dir: Path | None = None) -> Path:
    return (data_dir or plugin_data_directory()) / PAIRING_FILE


def sent_path(data_dir: Path | None = None) -> Path:
    return (data_dir or plugin_data_directory()) / SENT_FILE


def lock_path(data_dir: Path | None = None) -> Path:
    return (data_dir or plugin_data_directory()) / LOCK_FILE


def load_pairing(data_dir: Path | None = None) -> dict[str, Any] | None:
    data = read_json(pairing_path(data_dir))
    if not data.get("hub_url") or not data.get("token"):
        return None
    return data


def save_pairing(
    hub_url: str,
    satellite_id: str,
    token: str,
    name: str,
    agent_name: str,
    paired_at: float,
    data_dir: Path | None = None,
) -> None:
    write_json(
        pairing_path(data_dir),
        {
            "hub_url": hub_url,
            "satellite_id": satellite_id,
            "token": token,
            "name": name,
            "agent_name": agent_name,
            "paired_at": paired_at,
        },
    )


def load_sent(data_dir: Path | None = None) -> dict[str, Any]:
    return read_json(sent_path(data_dir))


def chat_ack_map(sent: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, val in sent.items():
        if key in META_KEYS:
            continue
        if isinstance(key, str) and val is not None:
            out[key] = str(val)
    return out


def save_sent(sent: dict[str, Any], data_dir: Path | None = None) -> None:
    write_json(sent_path(data_dir), sent)


def clear_credentials(data_dir: Path | None = None) -> None:
    base = data_dir or plugin_data_directory()
    for name in (PAIRING_FILE, SENT_FILE):
        path = base / name
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def plugin_version() -> str:
    return VERSION
