"""Daily LLM usage counters (local date, file-backed)."""

from __future__ import annotations

import json
import os
import stat
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

_EMPTY_DAY = {
    "calls": 0,
    "manual_calls": 0,
    "prompt_tokens": 0,
    "completion_tokens": 0,
}


def _local_date(now: float) -> str:
    return datetime.fromtimestamp(now).strftime("%Y-%m-%d")


def _usage_path(data_dir: str | Path) -> Path:
    return Path(data_dir) / "usage.json"


def _lock_path(data_dir: str | Path) -> Path:
    return Path(data_dir) / "usage.lock"


def _read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"days": {}}
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if isinstance(data, dict) and isinstance(data.get("days"), dict):
            return data
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        pass
    return {"days": {}}


def _atomic_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        dir=str(path.parent), prefix=".usage.", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)
            fh.write("\n")
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


def _with_lock(data_dir: str | Path, fn) -> Any:
    import fcntl

    lock_path = _lock_path(data_dir)
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with open(lock_path, "a+", encoding="utf-8") as lock_fh:
        fcntl.flock(lock_fh.fileno(), fcntl.LOCK_EX)
        return fn()


def _day_entry(data: dict[str, Any], date: str) -> dict[str, int]:
    days = data.setdefault("days", {})
    if not isinstance(days, dict):
        days = {}
        data["days"] = days
    entry = days.get(date)
    if not isinstance(entry, dict):
        entry = dict(_EMPTY_DAY)
        days[date] = entry
    for key in _EMPTY_DAY:
        if key not in entry:
            entry[key] = 0
    return entry


def _prune_old_days(data: dict[str, Any], now: float, keep_days: int = 7) -> None:
    days = data.get("days")
    if not isinstance(days, dict):
        return
    today = datetime.fromtimestamp(now).date()
    cutoff = today - timedelta(days=keep_days - 1)
    for key in list(days.keys()):
        try:
            d = datetime.strptime(key, "%Y-%m-%d").date()
        except ValueError:
            del days[key]
            continue
        if d < cutoff:
            del days[key]


def record(
    data_dir: str | Path,
    prompt_tokens: int,
    completion_tokens: int,
    now: float,
    manual: bool = False,
) -> None:
    """Increment today's usage counters.

    ``manual=True`` also increments ``manual_calls`` (user-started model use).
    ``calls`` still counts every call.
    """

    def _mutate() -> None:
        path = _usage_path(data_dir)
        data = _read_json(path)
        date = _local_date(now)
        entry = _day_entry(data, date)
        entry["calls"] = int(entry.get("calls", 0)) + 1
        if manual:
            entry["manual_calls"] = int(entry.get("manual_calls", 0)) + 1
        entry["prompt_tokens"] = int(entry.get("prompt_tokens", 0)) + int(
            prompt_tokens
        )
        entry["completion_tokens"] = int(entry.get("completion_tokens", 0)) + int(
            completion_tokens
        )
        _prune_old_days(data, now, keep_days=7)
        _atomic_write(path, data)

    _with_lock(data_dir, _mutate)


def today(data_dir: str | Path, now: float) -> dict[str, int]:
    """Return usage stats for the local calendar day containing ``now``."""

    def _read() -> dict[str, int]:
        data = _read_json(_usage_path(data_dir))
        date = _local_date(now)
        entry = _day_entry(data, date)
        return {
            "calls": int(entry.get("calls", 0)),
            "manual_calls": int(entry.get("manual_calls", 0)),
            "prompt_tokens": int(entry.get("prompt_tokens", 0)),
            "completion_tokens": int(entry.get("completion_tokens", 0)),
        }

    return _with_lock(data_dir, _read)


def history(data_dir: str | Path, days: int = 7, now: float | None = None) -> list[dict[str, Any]]:
    """Return up to ``days`` daily usage records ending on the local today."""
    import time as _time

    ts = now if now is not None else _time.time()
    days = max(1, int(days))

    def _read() -> list[dict[str, Any]]:
        data = _read_json(_usage_path(data_dir))
        raw_days = data.get("days")
        if not isinstance(raw_days, dict):
            raw_days = {}
        today_d = datetime.fromtimestamp(ts).date()
        out: list[dict[str, Any]] = []
        for offset in range(days - 1, -1, -1):
            d = today_d - timedelta(days=offset)
            key = d.strftime("%Y-%m-%d")
            entry = raw_days.get(key)
            if isinstance(entry, dict):
                out.append(
                    {
                        "date": key,
                        "calls": int(entry.get("calls", 0)),
                        "manual_calls": int(entry.get("manual_calls", 0)),
                        "prompt_tokens": int(entry.get("prompt_tokens", 0)),
                        "completion_tokens": int(entry.get("completion_tokens", 0)),
                    }
                )
            else:
                out.append({"date": key, **_EMPTY_DAY})
        return out

    return _with_lock(data_dir, _read)
