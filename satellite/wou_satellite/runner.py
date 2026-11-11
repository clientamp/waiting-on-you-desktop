"""Background debounced push loop and post_llm_call hook."""

from __future__ import annotations

import logging
import os
import threading
import time
from pathlib import Path

from . import config as cfg
from .filelock import release_fd_lock, try_exclusive_lock_fd
from .sender import run_push

_log = logging.getLogger(__name__)

POLL_SECONDS = 15
DIRTY_DEBOUNCE = 45
MIN_CHECK_INTERVAL = 120

_lock = threading.Lock()
_thread: threading.Thread | None = None
_dirty_at: float | None = None
_last_check_at: float = 0.0
_stop = threading.Event()


def mark_dirty() -> None:
    global _dirty_at
    with _lock:
        _dirty_at = time.time()


def _background_enabled() -> bool:
    return os.environ.get("HERMES_WOU_SAT_BACKGROUND", "1") != "0"


def _try_push_lock(data_dir: Path) -> int | None:
    path = cfg.lock_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        if not try_exclusive_lock_fd(fd):
            os.close(fd)
            return None
    except OSError:
        os.close(fd)
        return None
    return fd


def _release_push_lock(fd: int | None) -> None:
    if fd is None:
        return
    try:
        release_fd_lock(fd)
    except OSError:
        pass
    try:
        os.close(fd)
    except OSError:
        pass


def _should_run(now: float) -> bool:
    if not cfg.load_pairing():
        return False
    global _dirty_at, _last_check_at
    if _dirty_at is not None and now - _dirty_at >= DIRTY_DEBOUNCE:
        return True
    if now - _last_check_at >= MIN_CHECK_INTERVAL:
        return True
    return False


def _run_once(now: float) -> None:
    global _last_check_at, _dirty_at
    data_dir = cfg.plugin_data_directory()
    fd = _try_push_lock(data_dir)
    if fd is None:
        return
    try:
        _last_check_at = now
        with _lock:
            dirty_seen = _dirty_at
        try:
            run_push(data_dir=data_dir, now=now)
        except Exception:  # noqa: BLE001 — never escape the hook thread
            _log.exception("satellite push failed")
        # Keep a mark set by a turn that finished during the push.
        with _lock:
            if _dirty_at == dirty_seen:
                _dirty_at = None
    finally:
        _release_push_lock(fd)


def _loop() -> None:
    while not _stop.is_set():
        if _stop.wait(POLL_SECONDS):
            break
        if not _background_enabled():
            continue
        now = time.time()
        if _should_run(now):
            _run_once(now)


def ensure_background_thread() -> None:
    if not _background_enabled():
        return
    global _thread
    with _lock:
        if _thread is not None and _thread.is_alive():
            return
        _stop.clear()
        _thread = threading.Thread(target=_loop, name="wou-satellite-push", daemon=True)
        _thread.start()


def start_if_paired() -> bool:
    """Start the push loop at plugin load when this machine is paired."""
    try:
        if not cfg.load_pairing():
            return False
        ensure_background_thread()
        return _thread is not None and _thread.is_alive()
    except Exception:  # noqa: BLE001 — never break plugin load
        return False


def post_llm_call(**_kwargs) -> None:
    try:
        mark_dirty()
        ensure_background_thread()
    except Exception:  # noqa: BLE001
        pass


def reset_for_tests() -> None:
    """Stop background thread state (tests only)."""
    global _thread, _dirty_at, _last_check_at
    _stop.set()
    if _thread is not None:
        _thread.join(timeout=2)
    _thread = None
    _dirty_at = None
    _last_check_at = 0.0
    _stop.clear()
