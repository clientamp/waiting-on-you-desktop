"""Debounced chat scanner with file lock and optional background runner."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import stat
import threading
import time
from pathlib import Path
from typing import Any, Callable, Optional

from . import classify, collect, usage
from .config import ensure_data_dir, load_config
from . import settings as _settings
from .events import broadcast_tasks_changed
from .store import Store, _TASK_FROM, _TASK_SELECT

_log = logging.getLogger(__name__)

_ACTIVITY_FILE = "chat_activity.json"
_LAST_SCAN_FILE = "last_scan.json"
_LAST_SWEEP_FILE = "last_sweep"
_LOCK_FILE = "scan.lock"
_MAX_ERRORS = 20
_DAILY_RECHECK_SECONDS = 86400
_DAILY_RECHECK_MAX = 5


def _short_error(exc: BaseException, limit: int = 200) -> str:
    text = f"{type(exc).__name__}: {exc}"
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    try:
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass


def _load_activity(path: Path) -> dict[str, float]:
    data = _read_json(path)
    if not data:
        return {}
    out: dict[str, float] = {}
    for key, value in data.items():
        if isinstance(key, str):
            try:
                out[key] = float(value)
            except (TypeError, ValueError):
                continue
    return out


def _save_activity(path: Path, activity: dict[str, float]) -> None:
    _write_json(path, activity)


def _sweep_due(data_dir: Path, sweep_minutes: int, now: float) -> bool:
    marker = data_dir / _LAST_SWEEP_FILE
    if not marker.is_file():
        return True
    try:
        age = now - marker.stat().st_mtime
    except OSError:
        return True
    return age >= sweep_minutes * 60


def _touch_sweep(data_dir: Path) -> None:
    marker = data_dir / _LAST_SWEEP_FILE
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(str(time.time()), encoding="utf-8")
    try:
        os.chmod(marker, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass


def _chat_changed(store: Store, chat: dict[str, Any]) -> bool:
    """True when the chat is new or its latest message id moved."""
    state = store.get_scan_state(chat["key"])
    last_id = str(chat.get("last_msg_id", ""))
    return state is None or str(state.get("last_msg_id") or "") != last_id


def _chat_profile_key(chat_key: str) -> str:
    return chat_key.split(":", 1)[0].casefold() if ":" in chat_key else "default"


def _retention_cutoff_ts(retention_days: int, now: float) -> float | None:
    return now - retention_days * 86400 if retention_days > 0 else None


def _retention_age_candidates(store: Store, now: float) -> list[dict[str, Any]]:
    # Retention also runs between full sweeps; wake snoozes first so their
    # actual wake time counts as recent activity in this very scan.
    store._reopen_due_snoozed(now)
    rows = store._conn.execute(
        f"SELECT {_TASK_SELECT} {_TASK_FROM} WHERE tasks.status IN ('open', 'snoozed') ORDER BY tasks.id"
    ).fetchall()
    return [store._task_payload(r) for r in rows]


def _protected_from_retention(task: dict[str, Any], now: float) -> bool:
    due = task.get("due_at")
    snooze = task.get("snooze_until")
    return bool(task.get("manual") or task.get("quadrant_locked")
                or (due is not None and float(due) > now)
                or (snooze is not None and float(snooze) > now))


def _has_dirty_older_than(db_path: str, cutoff_ts: float) -> bool:
    try:
        conn = sqlite3.connect(db_path, timeout=5)
        row = conn.execute(
            "SELECT 1 FROM dirty WHERE marked_at <= ? LIMIT 1", (cutoff_ts,)
        ).fetchone()
        conn.close()
        return row is not None
    except sqlite3.Error:
        return False


class _ScanLock:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._fh: Any = None

    def acquire(self) -> bool:
        from .filelock import try_exclusive_lock

        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = open(self._path, "a+", encoding="utf-8")
        if try_exclusive_lock(self._fh):
            return True
        self._release_handle()
        return False

    def _release_handle(self) -> None:
        if self._fh is not None:
            try:
                self._fh.close()
            except OSError:
                pass
            self._fh = None

    def release(self) -> None:
        from .filelock import release_lock

        if self._fh is None:
            return
        release_lock(self._fh)
        self._release_handle()


class Scanner:
    def __init__(
        self,
        data_dir: str | Path,
        llm: Optional[Callable[..., str]] = None,
        collect_fn: Optional[Callable[..., Any]] = None,
        now_fn: Callable[[], float] = time.time,
    ) -> None:
        self.data_dir = ensure_data_dir(data_dir)
        self.llm = llm
        self.collect_fn = collect_fn
        self.now_fn = now_fn
        self.db_path = str(self.data_dir / "wou.db")
        self._read_cache = collect.CollectionReadCache()

    def _store(self) -> Store:
        return Store(self.db_path)

    def _collect_cfg(self, config: dict[str, Any]) -> collect.Config:
        cfg = collect.collection_config(config)
        cfg.read_cache = self._read_cache
        return cfg

    def close_read_cache(self) -> None:
        self._read_cache.close()

    def _model_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        model = config.get("model")
        if not isinstance(model, dict):
            model = {}
        return {
            "provider": model.get("provider"),
            "model": model.get("model"),
            "reasoning_effort": model.get("reasoning_effort"),
        }

    def should_run_background(self, config: dict[str, Any] | None = None) -> bool:
        cfg = config if config is not None else load_config(self.data_dir)
        knobs = _settings.scan_knobs(self.data_dir, cfg)
        mode = knobs["mode"]
        if mode in ("off", "manual"):
            return False
        now = self.now_fn()
        sweep_minutes = int(knobs["sweep_minutes"])
        if mode == "hourly":
            sweep_minutes = max(60, sweep_minutes)
            return _sweep_due(self.data_dir, sweep_minutes, now)
        debounce = float(knobs["debounce_seconds"])
        if _sweep_due(self.data_dir, sweep_minutes, now):
            return True
        return _has_dirty_older_than(self.db_path, now - debounce)

    def run_once(
        self,
        force_full: bool = False,
        manual: bool = False,
        force: bool = False,
    ) -> dict[str, Any]:
        lock = _ScanLock(self.data_dir / _LOCK_FILE)
        if not lock.acquire():
            return {"skipped": "locked"}

        try:
            return self._run_locked(force_full, manual=manual, force=force)
        finally:
            lock.release()

    def _run_locked(
        self, force_full: bool, manual: bool = False, force: bool = False
    ) -> dict[str, Any]:
        config = load_config(self.data_dir)
        knobs = _settings.scan_knobs(self.data_dir, config)
        user_settings = _settings.load_settings(self.data_dir)

        if not knobs["consented"]:
            return {"skipped": "consent"}

        mode = knobs["mode"]
        if mode == "off" and not (manual and force):
            return {"skipped": "off"}
        if mode == "manual" and not manual:
            return {"skipped": "manual"}

        now = self.now_fn()
        debounce = float(knobs["debounce_seconds"])
        sweep_minutes = int(knobs["sweep_minutes"])
        if mode == "hourly":
            sweep_minutes = max(60, sweep_minutes)
        max_chats = int(knobs["max_chats_per_scan"])
        daily_cap = int(knobs["daily_call_cap"])
        collect_cfg = self._collect_cfg(config)
        collect_cfg.days = int(knobs["lookback_days"])
        collect_cfg.tail_chars = max(1500, collect_cfg.tail_chars)
        model_kw = self._model_kwargs(config)

        store = self._store()
        errors: list[str] = []
        classification_errors: list[str] = []
        skipped_chats = 0
        classified = 0
        attempted = 0
        succeeded = 0
        failed = 0
        gated = 0
        added = 0
        resolved = 0
        expired = 0
        changed = False
        capped = False

        def on_usage(prompt_tokens: int, completion_tokens: int) -> None:
            usage.record(
                self.data_dir,
                prompt_tokens,
                completion_tokens,
                now,
                manual=(manual and force),
            )

        try:
            store.migrate_agent_names(
                collect.profile_display_map(collect_cfg, data_dir=self.data_dir)
            )
            if self.collect_fn is not None:
                chats, notes = self.collect_fn(
                    collect_cfg, self.data_dir / "cache", now
                )
            else:
                chats, notes = collect.collect_all(
                    collect_cfg,
                    self.data_dir / "cache",
                    now=now,
                    data_dir=self.data_dir,
                )
            for note in notes:
                if len(errors) < _MAX_ERRORS:
                    errors.append(note[:200])

            activity_path = self.data_dir / _ACTIVITY_FILE
            activity = _load_activity(activity_path)
            chat_by_key = {c["key"]: c for c in chats}
            for chat in chats:
                changed = (
                    store.refresh_chat_project(chat["key"], chat.get("project"))
                    or changed
                )
                try:
                    activity[chat["key"]] = float(chat["last_active"])
                except (KeyError, TypeError, ValueError):
                    pass
            _save_activity(activity_path, activity)

            dirty_keys = set(store.pop_dirty(now - debounce))
            sweep = force_full or _sweep_due(self.data_dir, sweep_minutes, now)
            if store.escalate_priorities(now):
                broadcast_tasks_changed()
            if sweep:
                _touch_sweep(self.data_dir)

            to_scan: dict[str, dict[str, Any]] = {}
            recheck_keys: list[str] = []
            for chat in chats:
                # A stale remote cache is not worth a model call.
                if chat.get("stale"):
                    continue
                if _chat_changed(store, chat):
                    to_scan[chat["key"]] = chat
            # post_llm_call marks dirty on every model step, so dirty only
            # proves we should look. Background runs still require a new
            # message. Manual scans keep the old force behavior.
            for key in dirty_keys:
                chat = chat_by_key.get(key)
                if chat is None or chat.get("stale"):
                    continue
                if manual or _chat_changed(store, chat):
                    to_scan[key] = chat

            if sweep:
                open_tasks = store.list_tasks(include_closed=False, now=now)
                if manual:
                    for task in open_tasks:
                        ck = task["chat_key"]
                        chat = chat_by_key.get(ck)
                        if chat is not None and not chat.get("stale"):
                            to_scan[ck] = chat
                else:
                    ranked: list[tuple[float, str]] = []
                    seen: set[str] = set()
                    for task in open_tasks:
                        ck = task["chat_key"]
                        if ck in seen:
                            continue
                        seen.add(ck)
                        chat = chat_by_key.get(ck)
                        if chat is None or chat.get("stale"):
                            continue
                        state = store.get_scan_state(ck)
                        if state is None or state.get("scanned_at") is None:
                            rank = float("-inf")
                        else:
                            rank = float(state["scanned_at"])
                            if now - rank < _DAILY_RECHECK_SECONDS:
                                continue
                        ranked.append((rank, ck))
                    ranked.sort(key=lambda item: item[0])
                    for _rank, ck in ranked[:_DAILY_RECHECK_MAX]:
                        recheck_keys.append(ck)
                        to_scan[ck] = chat_by_key[ck]

            # Due rechecks go first (at most _DAILY_RECHECK_MAX), so a busy
            # day of changed chats cannot push them out on every sweep.
            recheck_set = set(recheck_keys)
            rest = sorted(
                (c for k, c in to_scan.items() if k not in recheck_set),
                key=lambda c: float(c.get("last_active", 0)),
                reverse=True,
            )
            ordered = ([to_scan[k] for k in recheck_keys] + rest)[:max_chats]

            effective_cap = daily_cap * (2 if manual and force else 1)
            model_unreachable = False
            initial_connection_errors: list[str] = []

            for chat in ordered:
                if (
                    effective_cap > 0
                    and usage.today(self.data_dir, now)["calls"] >= effective_cap
                ):
                    capped = True
                    break
                attempted += 1
                try:
                    from .decision import Runtime
                    summary = classify.classify_chat(
                        store,
                        chat,
                        llm=self.llm,
                        now=now,
                        on_usage=on_usage,
                        decision_runtime=Runtime(self.data_dir, now=now, manual=manual),
                        **model_kw,
                    )
                except Exception as exc:  # noqa: BLE001
                    summary = {"error": _short_error(exc), "connection_error": classify.is_connection_error(exc)}
                if summary.get("gated"):
                    gated += 1
                    skipped_chats += 1
                    continue
                if summary.get("error"):
                    failed += 1
                    err = str(summary["error"])
                    if summary.get("connection_error") and succeeded == 0:
                        initial_connection_errors.append(err)
                    if len(errors) < _MAX_ERRORS and err[:200] not in errors:
                        errors.append(err[:200])
                    if len(classification_errors) < _MAX_ERRORS and err[:200] not in classification_errors:
                        classification_errors.append(err[:200])
                    if (succeeded == 0 and failed == 3 and len(initial_connection_errors) == 3
                            and len(set(initial_connection_errors)) == 1):
                        model_unreachable = True
                        break
                    continue
                if summary.get("skipped"):
                    skipped_chats += 1
                    continue
                succeeded += 1
                classified += 1
                if summary.get("added"):
                    added += int(summary["added"])
                    changed = True
                if summary.get("resolved"):
                    resolved += int(summary["resolved"])
                    changed = True
                if summary.get("updated"):
                    changed = True

            aged_cutoff = _retention_cutoff_ts(int(knobs["retention_days"]), now)
            if aged_cutoff is not None:
                for task in _retention_age_candidates(store, now):
                    ck = task["chat_key"]
                    if _protected_from_retention(task, now):
                        continue
                    # Old cache/scanned_at timestamps and missing chats are not
                    # evidence of inactivity. Require fresh metadata from this
                    # source in this scan, independently of discovery lookback.
                    if _chat_profile_key(ck) not in collect_cfg.successful_sources:
                        continue
                    last_active = collect_cfg.collection_activity.get(ck)
                    if last_active is None or max(last_active, float(task.get("updated_at") or 0)) >= aged_cutoff:
                        continue
                    try:
                        store.expire_task(int(task["id"]), now=now)
                        expired += 1
                        changed = True
                    except ValueError:
                        pass

            scan_doc: dict[str, Any] = {
                "at": now,
                "chats_seen": len(chats),
                "attempted": attempted,
                "succeeded": succeeded,
                "failed": failed,
                "skipped_chats": skipped_chats,
                "classification_errors": classification_errors,
                "model_unreachable": model_unreachable,
                "classified": classified,
                "gated": gated,
                "added": added,
                "resolved": resolved,
                "expired": expired,
                "errors": errors,
            }
            if capped:
                scan_doc["capped"] = True
            _write_json(self.data_dir / _LAST_SCAN_FILE, scan_doc)

            if changed:
                broadcast_tasks_changed()

            return scan_doc
        finally:
            store.close()


def read_last_scan(data_dir: str | Path) -> dict[str, Any] | None:
    return _read_json(Path(data_dir) / _LAST_SCAN_FILE)


_background_started = False
_background_lock = threading.Lock()


class BackgroundRunner:
    retry_seconds = 30.0

    def __init__(self, scanner: Scanner, interval_seconds: int = 60) -> None:
        self.scanner = scanner
        self.interval_seconds = interval_seconds
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._retry_timer: threading.Timer | None = None

    def start(self) -> bool:
        global _background_started
        with _background_lock:
            if self._stop.is_set() or self._thread is not None:
                return False
            if _background_started:
                self._schedule_retry()
                return False
            # The plugin package and dashboard can load under different module
            # names, and multiple host processes can serve one hub. Hold a
            # lifetime lock as well as the per-scan lock to own just one timer.
            self._owner_lock = _ScanLock(Path(self.scanner.data_dir) / "background.lock")
            if not self._owner_lock.acquire():
                self._schedule_retry()
                return False
            _background_started = True
            thread = threading.Thread(target=self._loop, name="wou-scanner", daemon=True)
            try:
                thread.start()
            except Exception:
                _background_started = False
                self._owner_lock.release()
                raise
            # Publish _thread only after start() so observers never see a handle
            # that is not yet alive (timer retries vs unload handoff).
            self._thread = thread
            return True

    def _schedule_retry(self) -> None:
        # Called under _background_lock, including from a previous timer.
        if self._retry_timer is not None and self._retry_timer.is_alive():
            if self._retry_timer is not threading.current_thread():
                return
        self._retry_timer = threading.Timer(self.retry_seconds, self.start)
        self._retry_timer.daemon = True
        self._retry_timer.start()

    def stop(self) -> None:
        with _background_lock:
            self._stop.set()
            if self._retry_timer is not None:
                self._retry_timer.cancel()
                self._retry_timer = None
            thread = self._thread
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=2)
        # _loop retains ownership until any in-flight scan actually returns.

    def _loop(self) -> None:
        global _background_started
        try:
            while not self._stop.is_set():
                try:
                    if self.scanner.should_run_background():
                        self.scanner.run_once(force_full=False, manual=False)
                except Exception:
                    _log.exception("background scan failed")
                if self._stop.wait(self.interval_seconds):
                    break
        finally:
            try:
                self.scanner.close_read_cache()
            except Exception:
                _log.exception("failed to close read cache on background exit")
            with _background_lock:
                self._owner_lock.release()
                _background_started = False
