"""Authenticated Desktop API for Waiting On You."""

from __future__ import annotations

import asyncio
import importlib
import importlib.util
import json
import os
import threading
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

_ROOT = Path(__file__).resolve().parent.parent
_WOU_PKG = "wou"


def _load_wou_package():
    if _WOU_PKG in sys.modules and hasattr(sys.modules[_WOU_PKG], "store"):
        return sys.modules[_WOU_PKG]
    spec = importlib.util.spec_from_file_location(
        _WOU_PKG,
        _ROOT / "wou" / "__init__.py",
        submodule_search_locations=[str(_ROOT / "wou")],
    )
    if spec is None or spec.loader is None:
        raise ImportError("The Waiting On You package is missing.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[_WOU_PKG] = module
    spec.loader.exec_module(module)
    return module


_load_wou_package()
_store = importlib.import_module("wou.store")
_scanner = importlib.import_module("wou.scanner")
_events = importlib.import_module("wou.events")
_paths = importlib.import_module("wou.paths")
_settings = importlib.import_module("wou.settings")
_hermes_sessions = importlib.import_module("wou.hermes_sessions")
_collect = importlib.import_module("wou.collect")
_config = importlib.import_module("wou.config")
_usage = importlib.import_module("wou.usage")
_satellite_hub = importlib.import_module("wou.satellite_hub")
_satellite_auth = importlib.import_module("wou.satellite_auth")
_ai_title = importlib.import_module("wou.ai_title")
_decision = importlib.import_module("wou.decision")
_assist = importlib.import_module("wou.assist")

Store = _store.Store
Scanner = _scanner.Scanner
read_last_scan = _scanner.read_last_scan
broadcast_tasks_changed = _events.broadcast_tasks_changed
broadcast_settings_changed = _events.broadcast_settings_changed
plugin_data_directory = _paths.plugin_data_directory

router = APIRouter()
_api_background_runner = None
_api_background_lock = threading.Lock()


def _maybe_start_background() -> None:
    global _api_background_runner
    if os.environ.get("HERMES_WOU_BACKGROUND", "1") == "0" or _paths.hub_hermes_home() is not None:
        return
    with _api_background_lock:
        if _api_background_runner is not None:
            return
        settings = _settings.load_settings(_data_dir())
        if not settings["consented"] or settings["mode"] == "off":
            return
        runner = _scanner.BackgroundRunner(Scanner(_data_dir()))
        runner.start()
        # Keep pending ownership retries so repeated requests do not multiply
        # them, and dashboard shutdown can cancel them before lock handoff.
        _api_background_runner = runner


def _stop_background() -> None:
    global _api_background_runner
    with _api_background_lock:
        if _api_background_runner is not None:
            _api_background_runner.stop()
            _api_background_runner = None


router.add_event_handler("shutdown", _stop_background)

_MAX_BODY = 4 * 1024
_MAX_PUSH_BODY = 1024 * 1024
_PUSH_RATE_LIMIT = 30
_PUSH_RATE_WINDOW = 60.0
_push_rate: dict[str, list[float]] = {}
_SCAN_COOLDOWN = 20.0
_FORCE_SCAN_COOLDOWN = 2.0
_last_manual_scan_at: float = 0.0
_scan_rate_lock = asyncio.Lock()
_action_inflight: set[int] = set()
_action_inflight_lock = asyncio.Lock()
_ai_title_inflight: set[str] = set()
_ai_title_inflight_lock = asyncio.Lock()
_ai_title_llm = None
_suggest_tags_lock = threading.Lock()
_eval_priorities_lock = threading.Lock()

_ALLOWED_PATCH = frozenset({"status", "quadrant", "snooze_until", "title", "restore", "quadrant_locked"})
_ALLOWED_GROUP_PATCH = frozenset(
    {"status", "quadrant", "title", "tags_add", "tags_remove", "task_ids", "priority_restore"}
)
_MAX_TITLE_LEN = 120

_SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,128}$")
_PROFILE_RE = re.compile(r"^[A-Za-z0-9_-]{0,64}$")
_CONNECTION_RE = re.compile(r"^[A-Za-z0-9_.-]{0,128}$")
_DEFAULT_MANUAL_ASK = "Follow up on this chat"


def _data_dir() -> Path:
    return Path(plugin_data_directory())


def _db_path() -> str:
    return str(_data_dir() / "wou.db")


_SATELLITE_ENABLED, _SATELLITE_DISABLE_REASON = _satellite_auth.ensure_registered(
    _db_path
)


def _chat_targets():
    """Map a chat_key to where Desktop can open it: {session_id, profile, connection}."""
    config = _config.load_config(_data_dir())
    cfg = _collect.Config.from_dict(config.get("collect") or {})
    local = {str(p.get("name", "")).lower() for p in cfg.local_profiles}
    remote = {str(h.get("name", "")).lower(): h for h in cfg.remote_hosts}
    db_path = _db_path()

    def target(chat_key):
        if ":" not in chat_key:
            return {"session_id": chat_key, "profile": None, "connection": None}
        prefix, sid = chat_key.split(":", 1)
        prefix = prefix.lower()
        sat = _satellite_hub.satellite_by_name(db_path, prefix)
        if sat is not None:
            names = [str(c) for c in sat.get("connections") or [] if c]
            if not names:
                return None
            prof = sat.get("desktop_profile") or "default"
            return {
                "session_id": sid,
                "profile": prof,
                "connection": names[0],
                "connection_aliases": names,
            }
        if prefix in remote:
            host = remote[prefix]
            conn = host.get("desktop_connection")
            # One id, or a list when client Macs name the same connection differently.
            names = [str(c) for c in (conn if isinstance(conn, list) else [conn]) if c]
            if not names:
                return None
            return {
                "session_id": sid,
                "profile": host.get("desktop_profile") or "default",
                "connection": names[0],
                "connection_aliases": names,
            }
        if prefix in local:
            return {"session_id": sid, "profile": prefix, "connection": None}
        return None

    return target


def _is_local_archive_chat(chat_key: str) -> bool:
    if _hermes_sessions.is_local_default_chat(chat_key):
        return True
    prefix = chat_key.split(":", 1)[0].lower()
    config = _config.load_config(_data_dir())
    cfg = _collect.Config.from_dict(config.get("collect") or {})
    return prefix in {str(p.get("name", "")).lower() for p in cfg.local_profiles}


def _parse_title_patch(value: Any) -> tuple[str | None, str | None]:
    """Return (title, error_message). None title clears override/lock."""
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, "title must be a string or null"
    stripped = value.strip()
    if not stripped:
        return None, None
    if len(stripped) > _MAX_TITLE_LEN:
        return None, f"title must be at most {_MAX_TITLE_LEN} characters"
    return stripped, None


def _prevalidate_patch(body: dict, *, statuses: tuple[str, ...]) -> str | None:
    """Check every simple field of a task/group PATCH before any write.

    Returns an error message, or None when the request is well-formed. The
    write paths still re-check, but nothing is written for a request that
    would later be rejected (no close-then-400, no archive-then-400).
    """
    if "status" in body and "snooze_until" in body:
        return "status and snooze_until can't be changed together"
    if "status" in body and body["status"] not in statuses:
        return "invalid status"
    if "quadrant" in body:
        try:
            quadrant = int(body["quadrant"])
        except (TypeError, ValueError):
            quadrant = None
        if quadrant not in (1, 2, 3, 4):
            return "invalid quadrant"
    if "snooze_until" in body and body["snooze_until"] is not None:
        try:
            float(body["snooze_until"])
        except (TypeError, ValueError):
            return "invalid snooze_until"
    if "title" in body:
        _title, err = _parse_title_patch(body["title"])
        if err:
            return err
    if "task_ids" in body:
        ids = body["task_ids"]
        if not isinstance(ids, list) or not ids or any(type(i) is not int for i in ids):
            return "task_ids must be a non-empty list of task ids"
    for key in ("tags_add", "tags_remove"):
        if key in body and not isinstance(body[key], list):
            return f"{key} must be a list"
    return None


def _open_store():
    store = Store(_db_path())
    config = _config.load_config(_data_dir())
    collect_cfg = _collect.Config.from_dict(config.get("collect") or {})
    store.migrate_agent_names(
        _collect.profile_display_map(collect_cfg, data_dir=_data_dir())
    )
    return store


def _normalize_profile(profile: str | None) -> str:
    if profile is None or profile == "":
        return "default"
    return profile


def _local_chat_key_if_session_exists(
    session_id: str,
    profile: str | None,
    collect_cfg: Any,
) -> str | None:
    prof = _normalize_profile(profile).lower()
    try:
        state_db: str | None = None
        for p in collect_cfg.local_profiles:
            if p["name"].lower() == prof:
                state_db = p.get("state_db")
                break
        if not state_db:
            return None
        db = Path(state_db).expanduser()
        if not db.is_file():
            return None
        with sqlite3.connect(Path(db).expanduser().resolve().as_uri() + "?mode=ro", uri=True, timeout=5) as conn_db:
            row = conn_db.execute(
                "SELECT 1 FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if not row:
                return None
    except (OSError, sqlite3.Error, TypeError, ValueError):
        return None
    if prof == "default":
        return session_id
    return f"{prof}:{session_id}"


def _resolve_chat_key(
    session_id: str,
    profile: str | None,
    connection_id: str | None,
    collect_cfg: Any,
) -> str | None:
    """Return chat_key or None when the remote connection is not watched."""
    conn = connection_id if connection_id not in (None, "") else "local"
    if conn != "local":
        for host in collect_cfg.remote_hosts:
            if str(host.get("desktop_connection") or "") == conn:
                return f"{host['name'].lower()}:{session_id}"
        for satellite in _satellite_hub.list_satellites(_db_path()):
            if satellite.get("revoked_at") is None and conn in satellite.get("connections", []):
                return f"{satellite['name'].lower()}:{session_id}"
        return _local_chat_key_if_session_exists(session_id, profile, collect_cfg)
    # Desktop allocates local ids before persisting a session's first prompt.
    # Trust the configured profile, not the presence of its deferred DB row.
    prof = _normalize_profile(profile).lower()
    if not any(p["name"].lower() == prof for p in collect_cfg.local_profiles):
        return None
    return session_id if prof == "default" else f"{prof}:{session_id}"


def _agent_for_chat_key(chat_key: str, collect_cfg: Any) -> str:
    pmap = _collect.profile_display_map(collect_cfg)
    if ":" not in chat_key:
        return pmap.get(
            "default", _collect.profile_display_name("default", collect_cfg.agent_names)
        )
    prefix = chat_key.split(":", 1)[0].lower()
    for host in collect_cfg.remote_hosts:
        if host["name"].lower() == prefix:
            return pmap.get(
                host["name"],
                _collect.profile_display_name(host["name"], collect_cfg.agent_names),
            )
    for prof in collect_cfg.local_profiles:
        if prof["name"].lower() == prefix:
            return pmap.get(
                prof["name"],
                _collect.profile_display_name(prof["name"], collect_cfg.agent_names),
            )
    if _satellite_hub.satellite_by_name(_db_path(), prefix) is not None:
        full_map = _collect.profile_display_map(collect_cfg, data_dir=_data_dir())
        for key, display in full_map.items():
            if key.lower() == prefix:
                return display
    return prefix.capitalize()


def _lookup_chat_title(
    session_id: str,
    profile: str | None,
    connection_id: str | None,
    title_hint: str | None,
    collect_cfg: Any,
) -> str:
    conn = connection_id if connection_id not in (None, "") else "local"
    if conn != "local":
        hint = (title_hint or "").strip()[:200]
        return hint or f"Chat {session_id[:8]}"
    prof = _normalize_profile(profile).lower()
    try:
        state_db: str | None = None
        for p in collect_cfg.local_profiles:
            if p["name"].lower() == prof:
                state_db = p.get("state_db")
                break
        if state_db:
            db = Path(state_db).expanduser()
            if db.is_file():
                with sqlite3.connect(
                    Path(db).expanduser().resolve().as_uri() + "?mode=ro", uri=True, timeout=5
                ) as conn_db:
                    row = conn_db.execute(
                        "SELECT title FROM sessions WHERE id = ?", (session_id,)
                    ).fetchone()
                    if row and row[0]:
                        title = str(row[0]).strip()
                        if title:
                            return title[:200]
    except (OSError, sqlite3.Error, TypeError, ValueError):
        pass
    hint = (title_hint or "").strip()[:200]
    return hint or f"Chat {session_id[:8]}"


def _validate_session_params(
    session_id: str | None,
    profile: str | None,
    connection_id: str | None,
) -> str | None:
    if not isinstance(session_id, str) or not session_id:
        return "session_id required"
    if ":" in session_id:
        return "invalid session_id: use an unprefixed session id and connection/profile"
    if not _SESSION_ID_RE.match(session_id):
        return "invalid session_id"
    if profile is not None and profile != "" and not _PROFILE_RE.match(profile):
        return "invalid profile"
    if connection_id is not None and connection_id != "":
        if not _CONNECTION_RE.match(connection_id):
            return "invalid connection_id"
    return None


def _quadrant_counts(tasks: list[dict[str, Any]]) -> dict[str, int]:
    counts = {str(q): 0 for q in range(1, 5)}
    for task in tasks:
        key = str(task.get("quadrant"))
        if key in counts:
            counts[key] += 1
    return counts


@router.get("/health")
async def health():
    last = await asyncio.to_thread(read_last_scan, _data_dir())
    return {"ready": True, "last_scan": last}


@router.get("/tasks")
async def list_tasks(request: Request, include_closed: int = 0):
    _maybe_start_background()
    include = bool(include_closed)
    projects = request.query_params.getlist("project")
    try:
        tags = [int(t) for t in request.query_params.getlist("tag")]
        if any(t <= 0 for t in tags):
            raise ValueError()
    except ValueError:
        return JSONResponse({"error": "invalid tag filter"}, status_code=400)

    def _load():
        store = _open_store()
        try:
            tasks = store.list_tasks(
                include_closed=include, projects=projects, tags=tags
            )
            open_tasks = store.list_tasks(
                include_closed=False, projects=projects, tags=tags
            )
            counts = _quadrant_counts(open_tasks)
            groups = store.list_task_groups(open_tasks)
            last = read_last_scan(_data_dir())
            target = _chat_targets()
            for item in list(tasks) + list(groups):
                item["chat_target"] = target(item["chat_key"])
            return tasks, counts, groups, last
        finally:
            store.close()

    tasks, counts, groups, last = await asyncio.to_thread(_load)
    return {"tasks": tasks, "counts": counts, "groups": groups, "last_scan": last}


@router.patch("/tasks/{task_id}")
async def patch_task(task_id: int, request: Request):
    if _oversize_header(request, _MAX_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=400)
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        return JSONResponse({"error": "request body too large"}, status_code=400)
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "body must be an object"}, status_code=400)
    extra = set(body) - _ALLOWED_PATCH
    if extra:
        return JSONResponse(
            {"error": f"unknown fields: {', '.join(sorted(extra))}"},
            status_code=400,
        )
    if not body:
        return JSONResponse({"error": "no fields to update"}, status_code=400)

    if "restore" in body or "quadrant_locked" in body:
        if body.get("restore") is not True or type(body.get("quadrant_locked")) is not bool or "quadrant" not in body or set(body) - {"restore", "quadrant_locked", "quadrant"}:
            return JSONResponse({"error": "invalid priority restore"}, status_code=400)

    # Validate everything before any write, so a bad or conflicting request
    # can't leave a half-applied change (e.g. close + archive, then reopen).
    err = _prevalidate_patch(body, statuses=("open", "done", "dismissed"))
    if err:
        return JSONResponse({"error": err}, status_code=400)

    def _apply():
        store = _open_store()
        chat_archived = False
        try:
            before = store.get_task(task_id)
            if before is None:
                return 404, None, False
            if "status" in body:
                status = body["status"]
                if status not in ("open", "done", "dismissed"):
                    return 400, "invalid status", False
                if status in ("done", "dismissed"):
                    store.close_task(task_id, status)
                    if status == "done":
                        settings = _settings.load_settings(_data_dir())
                        chat_key = before["chat_key"]
                        if (
                            settings.get("archive_chat_on_done")
                            and _is_local_archive_chat(chat_key)
                            and not store.has_active_tasks_for_chat(chat_key)
                        ):
                            if _hermes_sessions.archive_chat(chat_key):
                                store.set_archived_chat_flag(task_id, True)
                                chat_archived = True
                elif status == "open":
                    if before.get("archived_chat"):
                        _hermes_sessions.unarchive_chat(before["chat_key"])
                        store.set_archived_chat_flag(task_id, False)
                    store.reopen_task(task_id)
            if "quadrant" in body:
                try:
                    quadrant = int(body["quadrant"])
                except (TypeError, ValueError):
                    return 400, "invalid quadrant", False
                if quadrant not in (1, 2, 3, 4):
                    return 400, "invalid quadrant", False
                store.set_quadrant(task_id, quadrant, locked=body.get("quadrant_locked", True), restore=body.get("restore", False))
            if "snooze_until" in body:
                raw_until = body["snooze_until"]
                if raw_until is None:
                    store.reopen_task(task_id)
                else:
                    try:
                        until = float(raw_until)
                    except (TypeError, ValueError):
                        return 400, "invalid snooze_until", False
                    store.snooze_task(task_id, until)
            if "title" in body:
                title, err = _parse_title_patch(body["title"])
                if err:
                    return 400, err, False
                store.rename_task(task_id, title)
                chat_key = before["chat_key"]
                visible = store._visible_open_tasks_for_chat(chat_key)
                visible_ids = {t["id"] for t in visible}
                if len(visible) < 2 or task_id not in visible_ids:
                    store.rename_group(chat_key, title)
            task = store.get_task(task_id)
            if task is None:
                return 404, None, False
            return 200, task, chat_archived
        except ValueError as exc:
            return 400, str(exc), False
        finally:
            store.close()

    status_code, payload, chat_archived = await asyncio.to_thread(_apply)
    if status_code == 404:
        return JSONResponse({"error": "task not found"}, status_code=404)
    if status_code == 400:
        return JSONResponse({"error": payload}, status_code=400)
    broadcast_tasks_changed()
    return {"task": payload, "chat_archived": chat_archived}


def _handler_error_message(stderr: bytes, exit_code: int) -> str:
    text = (stderr or b"").decode("utf-8", errors="replace").strip()
    if not text:
        return "handler failed"
    return text[:300]


def _parse_handler_stdout(stdout: bytes) -> dict[str, Any] | None:
    lines = [
        ln for ln in stdout.decode("utf-8", errors="replace").splitlines() if ln.strip()
    ]
    if not lines:
        return None
    try:
        data = json.loads(lines[-1])
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    if not isinstance(data.get("ok"), bool):
        return None
    message = data.get("message")
    if not isinstance(message, str):
        return None
    close = data.get("close")
    if close is not None and not isinstance(close, bool):
        return None
    return {"ok": data["ok"], "message": message, "close": bool(close)}


async def _read_handler_output(stream: asyncio.StreamReader) -> bytes:
    """Bound both pipes while draining them concurrently (never communicate unbounded)."""
    output = bytearray()
    while True:
        chunk = await stream.read(min(8192, 65537 - len(output)))
        if not chunk:
            return bytes(output)
        output.extend(chunk)
        if len(output) > 65536:
            raise ValueError("handler output too large")


async def _discard_handler_output(stream: asyncio.StreamReader) -> None:
    while await stream.read(8192):
        pass


@router.post("/tasks/{task_id}/actions/{action_id}")
async def run_task_action(task_id: int, action_id: str):
    if not re.fullmatch(r"[a-z0-9_-]{1,32}", action_id):
        return JSONResponse({"error": "invalid action_id"}, status_code=400)
    async with _action_inflight_lock:
        if task_id in _action_inflight:
            return JSONResponse(
                {"error": "action already in progress"}, status_code=409
            )
        _action_inflight.add(task_id)

    try:

        def _load_task():
            store = _open_store()
            try:
                return store.get_task(task_id)
            finally:
                store.close()

        task = await asyncio.to_thread(_load_task)
        if task is None:
            return JSONResponse({"error": "task not found"}, status_code=404)
        if task.get("status") != "open":
            return JSONResponse({"error": "task not actionable"}, status_code=409)
        source_msg_id = task.get("source_msg_id")
        if source_msg_id is not None and (
            not isinstance(source_msg_id, str)
            or (source_msg_id and (
                source_msg_id.startswith("-")
                or not re.fullmatch(r"[A-Za-z0-9_.:@<>+=,-]{1,128}", source_msg_id)
            ))
        ):
            return JSONResponse({"error": "invalid source_msg_id"}, status_code=400)

        action = None
        for item in task.get("actions") or []:
            if isinstance(item, dict) and item.get("id") == action_id:
                action = item
                break
        if action is None or action.get("kind", "run") != "run":
            return JSONResponse({"error": "action not found"}, status_code=404)

        config = _config.load_config(_data_dir())
        handlers = _config.normalized_action_handlers(config)
        handler = _config.match_action_handler(handlers, task["chat_key"])
        if handler is None:
            return JSONResponse({"error": "no handler configured"}, status_code=400)

        command = handler["command"]
        timeout = handler["timeout_seconds"]
        argv = command + [
            action_id,
            task["chat_key"],
            task.get("source_msg_id") or "",
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *argv,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            readers = [
                asyncio.create_task(_read_handler_output(proc.stdout)),
                asyncio.create_task(_read_handler_output(proc.stderr)),
            ]
            try:
                stdout, stderr, _ = await asyncio.wait_for(
                    asyncio.gather(*readers, proc.wait()), timeout=timeout
                )
            except asyncio.TimeoutError:
                return JSONResponse({"error": "timed out"}, status_code=504)
            except ValueError:
                return JSONResponse({"error": "handler output too large"}, status_code=502)
            finally:
                if proc.returncode is None:
                    try:
                        proc.kill()
                    except ProcessLookupError:
                        pass
                # Drain after kill to avoid Process.wait deadlocking on full pipes.
                for reader in readers:
                    reader.cancel()
                await asyncio.gather(*readers, return_exceptions=True)
                try:
                    await asyncio.wait_for(asyncio.gather(
                        _discard_handler_output(proc.stdout),
                        _discard_handler_output(proc.stderr),
                        proc.wait(),
                    ), timeout=1)
                except asyncio.TimeoutError:
                    # A handler's child may have inherited a pipe. Do not let it
                    # hold this request open after the handler was killed.
                    proc.stdout._transport.close()
                    proc.stderr._transport.close()
                    await proc.wait()
        except OSError:
            return JSONResponse({"error": "handler failed"}, status_code=502)

        parsed = _parse_handler_stdout(stdout or b"")
        if proc.returncode != 0 or parsed is None:
            return JSONResponse(
                {"error": _handler_error_message(stderr or b"", proc.returncode or 1)},
                status_code=502,
            )

        closed = False
        if parsed["ok"] and parsed["close"]:

            def _close():
                store = _open_store()
                try:
                    store.close_task(task_id, "done")
                    row = store.get_task(task_id)
                    if row is not None:
                        row["chat_target"] = _chat_targets()(row["chat_key"])
                    return row
                finally:
                    store.close()

            task = await asyncio.to_thread(_close)
            closed = True
        elif parsed["ok"]:

            def _refresh():
                store = _open_store()
                try:
                    row = store.get_task(task_id)
                    if row is not None:
                        row["chat_target"] = _chat_targets()(row["chat_key"])
                    return row
                finally:
                    store.close()

            task = await asyncio.to_thread(_refresh)

        if parsed["ok"]:
            broadcast_tasks_changed()

        return {
            "ok": parsed["ok"],
            "message": parsed["message"],
            "closed": closed,
            "task": task,
        }
    finally:
        async with _action_inflight_lock:
            _action_inflight.discard(task_id)


@router.patch("/groups/{chat_key:path}")
async def patch_group(chat_key: str, request: Request):
    chat_key = unquote(chat_key)
    if _oversize_header(request, _MAX_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=400)
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        return JSONResponse({"error": "request body too large"}, status_code=400)
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "body must be an object"}, status_code=400)
    extra = set(body) - _ALLOWED_GROUP_PATCH
    if extra:
        return JSONResponse(
            {"error": f"unknown fields: {', '.join(sorted(extra))}"},
            status_code=400,
        )
    if not body:
        return JSONResponse({"error": "no fields to update"}, status_code=400)
    if "priority_restore" not in body:
        err = _prevalidate_patch(body, statuses=("done", "dismissed"))
        if err:
            return JSONResponse({"error": err}, status_code=400)

    def _apply():
        store = _open_store()
        chat_archived = False
        try:
            if "priority_restore" in body:
                snapshot = body["priority_restore"]
                if set(body) != {"priority_restore"} or not isinstance(snapshot, dict):
                    return 400, "invalid priority restore", False
                children = snapshot.get("children")
                if not isinstance(children, list):
                    return 400, "invalid children", False
                for child in children:
                    if not isinstance(child, dict) or type(child.get("id")) is not int or type(child.get("quadrant")) is not int or child["quadrant"] not in (1,2,3,4) or type(child.get("quadrant_locked")) is not bool:
                        return 400, "invalid child restore", False
                    task = store.get_task(child["id"])
                    if not task or task["chat_key"] != chat_key or task["status"] != "open":
                        return 400, "invalid restore target", False
                meta = snapshot.get("group") or {}
                if not isinstance(meta, dict):
                    return 400, "invalid group restore", False
                if type(meta.get("quadrant_locked", False)) is not bool or meta.get("quadrant") not in (None,1,2,3,4):
                    return 400, "invalid group restore", False
                for child in children:
                    store.set_quadrant(child["id"], child["quadrant"], locked=child["quadrant_locked"], restore=True)
                store._conn.execute("UPDATE chat_groups SET quadrant=?, quadrant_locked=? WHERE chat_key=?", (meta.get("quadrant"), int(meta.get("quadrant_locked", False)), chat_key))
                store._conn.commit()
                return 200, {"closed_task_ids": [], "chat_archived": False}, False
            visible = store._visible_open_tasks_for_chat(chat_key)
            if len(visible) < 2 and not ("status" in body and "task_ids" in body):
                # The scanner can resolve a group's tasks between the panel's
                # last refresh and the user's click. A close then has nothing
                # (or one task) left to close: finish it instead of a 404.
                if set(body) != {"status"}:
                    return 404, None, False
                status = body["status"]
                if status not in ("done", "dismissed"):
                    return 400, "invalid status", False
                # Only for a chat that was a group (2+ tasks ever); a solo
                # task still goes through PATCH /tasks/{id}.
                if store.chat_task_count(chat_key) < 2:
                    return 404, None, False
                closed_ids = []
                for task in visible:
                    store.close_task(task["id"], status)
                    closed_ids.append(task["id"])
                # Archive only when this request closed something, so the
                # archive is tied to a task that Undo can restore.
                if status == "done" and closed_ids:
                    settings = _settings.load_settings(_data_dir())
                    if (
                        settings.get("archive_chat_on_done")
                        and _is_local_archive_chat(chat_key)
                        and not store.has_active_tasks_for_chat(chat_key)
                    ):
                        if _hermes_sessions.archive_chat(chat_key):
                            for tid in closed_ids:
                                store.set_archived_chat_flag(tid, True)
                            chat_archived = True
                return (
                    200,
                    {
                        "closed_task_ids": closed_ids,
                        "chat_archived": chat_archived,
                        "already_closed": not closed_ids,
                    },
                    chat_archived,
                )
            # Store-backed checks before the first write: tag ids must exist
            # and explicit task_ids must belong to this chat.
            if "tags_add" in body or "tags_remove" in body:
                store._validate_tag_ids(body.get("tags_add", []))
                store._validate_tag_ids(body.get("tags_remove", []))
            if body.get("task_ids") is not None:
                for tid in body["task_ids"]:
                    owner = store.get_task(tid)
                    if owner is None or owner["chat_key"] != chat_key:
                        return 400, "task_ids must be tasks in this chat", False
            if "tags_add" in body or "tags_remove" in body:
                store.update_group_tags(
                    chat_key,
                    add=body.get("tags_add", []),
                    remove=body.get("tags_remove", []),
                    task_ids=body.get("task_ids"),
                )
            closed_ids: list[int] = []
            if "status" in body:
                status = body["status"]
                if status not in ("done", "dismissed"):
                    return 400, "invalid status", False
                task_ids = body.get("task_ids")
                if task_ids is not None:
                    closed_ids = store.close_tasks_in_chat(
                        chat_key, task_ids, status
                    )
                else:
                    closed_ids = store.close_all_open_tasks_for_chat(
                        chat_key, status
                    )
                if status == "done" and closed_ids:
                    settings = _settings.load_settings(_data_dir())
                    if (
                        settings.get("archive_chat_on_done")
                        and _is_local_archive_chat(chat_key)
                        and not store.has_active_tasks_for_chat(chat_key)
                    ):
                        if _hermes_sessions.archive_chat(chat_key):
                            for tid in closed_ids:
                                store.set_archived_chat_flag(tid, True)
                            chat_archived = True
            priority_restore = None
            if "quadrant" in body:
                try:
                    quadrant = int(body["quadrant"])
                except (TypeError, ValueError):
                    return 400, "invalid quadrant", False
                if quadrant not in (1, 2, 3, 4):
                    return 400, "invalid quadrant", False
                priority_restore = {"group": store._get_chat_group_row(chat_key), "children": [
                    {k: t[k] for k in ("id", "quadrant", "quadrant_locked")} for t in store.open_tasks_for_chat(chat_key)
                ]}
                store.set_group_quadrant(chat_key, quadrant, locked=True)
            if "title" in body:
                title, err = _parse_title_patch(body["title"])
                if err:
                    return 400, err, False
                store.rename_group(chat_key, title)
            payload = {"closed_task_ids": closed_ids, "chat_archived": chat_archived}
            if priority_restore is not None:
                payload["priority_restore"] = priority_restore
            return 200, payload, chat_archived
        except ValueError as exc:
            msg = str(exc)
            if "not a task group" in msg:
                return 404, None, False
            return 400, msg, False
        finally:
            store.close()

    status_code, payload, _chat_archived = await asyncio.to_thread(_apply)
    if status_code == 404:
        return JSONResponse({"error": "group not found"}, status_code=404)
    if status_code == 400:
        return JSONResponse({"error": payload}, status_code=400)
    broadcast_tasks_changed()
    return payload


@router.get("/settings")
async def get_settings():
    _maybe_start_background()
    def _load():
        data_dir = _data_dir()
        now = time.time()
        return {
            "settings": _settings.load_settings(data_dir),
            "usage": {
                "today": _usage.today(data_dir, now),
                "history": _usage.history(data_dir, days=7, now=now),
                "decision": _decision.usage_today(data_dir, now),
            },
            "model": _settings.resolve_hermes_model(),
        }

    return await asyncio.to_thread(_load)


@router.patch("/settings")
async def patch_settings(request: Request):
    if _oversize_header(request, _MAX_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=400)
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        return JSONResponse({"error": "request body too large"}, status_code=400)
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "body must be an object"}, status_code=400)
    if not body:
        return JSONResponse({"error": "no fields to update"}, status_code=400)

    def _apply():
        try:
            return 200, _settings.save_settings(_data_dir(), body)
        except ValueError as exc:
            return 400, str(exc)

    status_code, payload = await asyncio.to_thread(_apply)
    if status_code == 400:
        return JSONResponse({"error": payload}, status_code=400)
    broadcast_settings_changed()
    return {"settings": payload}


@router.get("/decision")
async def get_decision():
    return await asyncio.to_thread(_decision.status, _data_dir())


@router.patch("/decision")
async def patch_decision(request: Request):
    try:
        body = await _tag_body(request, {"provider", "model", "base_url", "cloudflare_account_id"})
        result = await asyncio.to_thread(_decision.patch, _data_dir(), body)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    broadcast_settings_changed()
    return result


@router.post("/decision/test")
async def test_decision():
    return await asyncio.to_thread(_decision.connection_test, _data_dir())


def _oversize_header(request, limit):
    value = request.headers.get("content-length")
    if value is None:
        return False
    try:
        return int(value) < 0 or int(value) > limit
    except (ValueError, TypeError):
        return True


async def _optional_body(request, allowed):
    if _oversize_header(request, _MAX_BODY):
        raise ValueError("request body too large")
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        raise ValueError("request body too large")
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        raise ValueError("invalid JSON") from None
    if not isinstance(body, dict) or set(body) - allowed:
        raise ValueError("invalid fields")
    return body


async def _model_read(operation, lock):
    if not _settings.load_settings(_data_dir()).get("consented"):
        return JSONResponse({"error": "Start Waiting On You first (privacy consent)."}, status_code=403)
    def run():
        if not lock.acquire(blocking=False):
            return JSONResponse({"error": "This model request is already running. Try again shortly."}, status_code=409)
        store = None
        try:
            store = _open_store()
            return operation(store)
        finally:
            if store is not None:
                store.close()
            lock.release()
    try:
        return await asyncio.to_thread(run)
    except _assist.NoModel as exc:
        return JSONResponse({"error": str(exc)}, status_code=409)
    except Exception:
        # Host/provider errors can contain private data. Never echo them.
        return JSONResponse({"error": "The model could not complete this request."}, status_code=502)


@router.post("/tags/suggest")
async def suggest_tags(request: Request):
    try:
        body = await _optional_body(request, {"limit"})
        limit = body.get("limit", 8)
        if type(limit) is not int or not 1 <= limit <= 12:
            raise ValueError("limit must be an integer 1-12")
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    return await _model_read(lambda store: _assist.suggest_tags(_data_dir(), store, limit), _suggest_tags_lock)


@router.post("/eval-priorities")
async def eval_priorities(request: Request):
    try:
        body = await _optional_body(request, {"confirm", "labels"})
        if body.get("confirm") is not True:
            raise ValueError("confirm: true is required; this spends model calls")
        if "labels" in body:
            _assist.validate_labels(body["labels"])
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    return await _model_read(lambda store: _assist.evaluate(_data_dir(), store, body.get("labels")), _eval_priorities_lock)


@router.get("/projects")
async def list_projects():
    def _load():
        from wou.hermes_projects import list_projects as catalog

        cfg = _collect.Config.from_dict(
            _config.load_config(_data_dir()).get("collect") or {}
        )
        store = _open_store()
        try:
            projects = {}
            for profile in cfg.local_profiles:
                for project in catalog(
                    Path(profile["state_db"]).expanduser().parent / "projects.db",
                    profile["name"],
                ):
                    projects[project["key"]] = dict(project, open_count=0)
            for host in cfg.remote_hosts:
                try:
                    cached = json.loads(
                        (_data_dir() / "cache" / (host["name"] + ".json")).read_text()
                    )
                    for project in cached.get("projects", []):
                        projects[project["key"]] = dict(project, open_count=0)
                except (OSError, ValueError, KeyError, TypeError):
                    pass
            for project in _satellite_hub.satellite_projects(_db_path()):
                projects[project["key"]] = dict(project, open_count=0)
            no_project = 0
            for task in store.list_tasks():
                project = task["project"]
                if project is None:
                    no_project += 1
                    continue
                key = project["key"]
                if key not in projects:
                    meta = store._conn.execute(
                        "SELECT project_json FROM chat_groups WHERE chat_key=?",
                        (task["chat_key"],),
                    ).fetchone()
                    snapshot = json.loads(meta[0]) if meta and meta[0] else project
                    projects[key] = dict(
                        snapshot, profile=key.rsplit(":", 1)[0], open_count=0
                    )
                projects[key]["open_count"] += 1
            return {
                "projects": sorted(
                    projects.values(), key=lambda p: (p["name"].casefold(), p["key"])
                ),
                "no_project_count": no_project,
            }
        finally:
            store.close()

    return await asyncio.to_thread(_load)


async def _tag_body(request: Request, allowed: set):
    if _oversize_header(request, _MAX_BODY):
        raise ValueError("request body too large")
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        raise ValueError("request body too large")
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        raise ValueError("invalid JSON") from None
    if not isinstance(body, dict) or not body or set(body) - allowed:
        raise ValueError("invalid fields")
    return body


async def _tag_write(operation):
    def apply():
        store = _open_store()
        try:
            return operation(store)
        finally:
            store.close()

    try:
        payload = await asyncio.to_thread(apply)
    except (ValueError, TypeError) as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    broadcast_tasks_changed()
    return payload


@router.get("/tags")
async def list_tags():
    def load():
        store = _open_store()
        try:
            return {"tags": store.list_tags()}
        finally:
            store.close()

    return await asyncio.to_thread(load)


@router.post("/tags")
async def create_tag(request: Request):
    try:
        body = await _tag_body(request, {"name", "color", "hint"})
        if "name" not in body:
            raise ValueError("tag name required")
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    return await _tag_write(lambda store: {"tag": store.create_tag(**body)})


@router.patch("/tags/{tag_id}")
async def patch_tag(tag_id: int, request: Request):
    try:
        body = await _tag_body(request, {"name", "color", "hint"})
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    return await _tag_write(lambda store: {"tag": store.update_tag(tag_id, **body)})


@router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: int):
    def apply(store):
        store.delete_tag(tag_id)
        return {"ok": True}

    return await _tag_write(apply)


@router.post("/tasks/{task_id}/tags")
async def task_tags(task_id: int, request: Request):
    try:
        body = await _tag_body(request, {"add", "remove"})
        if any(not isinstance(v, list) for v in body.values()):
            raise ValueError("add and remove must be lists")
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)

    def apply(store):
        store.update_task_tags(task_id, **body)
        return {"task": store.get_task(task_id)}

    return await _tag_write(apply)


@router.get("/session-tasks")
async def get_session_tasks(
    session_id: str = "",
    profile: str = "",
    connection_id: str = "",
):
    prof = profile if profile else None
    conn = connection_id if connection_id else None
    err = _validate_session_params(session_id, prof, conn)
    if err:
        return JSONResponse({"error": err}, status_code=400)

    def _load():
        config = _config.load_config(_data_dir())
        collect_cfg = _collect.Config.from_dict(config.get("collect") or {})
        chat_key = _resolve_chat_key(session_id, prof, conn, collect_cfg)
        if chat_key is None:
            return 404, {
                "error": "This chat isn't on a Hermes that Waiting On You watches."
            }
        store = _open_store()
        try:
            tasks = store.session_tasks(chat_key)
            groups = store.list_task_groups(tasks)
            group = groups[0] if groups else None
            target = _chat_targets()
            for item in tasks:
                item["chat_target"] = target(chat_key)
            return 200, {
                "chat_key": chat_key,
                "tracked": len(tasks) > 0,
                "tasks": tasks,
                "group": group,
            }
        finally:
            store.close()

    status_code, payload = await asyncio.to_thread(_load)
    if status_code == 404:
        return JSONResponse(payload, status_code=404)
    return payload


@router.post("/tasks")
async def create_manual_task(request: Request):
    if _oversize_header(request, _MAX_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=400)
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        return JSONResponse({"error": "request body too large"}, status_code=400)
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "body must be an object"}, status_code=400)

    session_id = body.get("session_id")
    profile = body.get("profile")
    connection_id = body.get("connection_id")
    title_hint = body.get("title")
    ask_raw = body.get("ask")
    quadrant_raw = body.get("quadrant")
    if "project_id" in body or "project" in body:
        return JSONResponse({"error": "project is read-only"}, status_code=400)

    err = _validate_session_params(
        session_id if isinstance(session_id, str) else None,
        profile if isinstance(profile, str) else None,
        connection_id if isinstance(connection_id, str) else None,
    )
    if err:
        return JSONResponse({"error": err}, status_code=400)

    if title_hint is not None and not isinstance(title_hint, str):
        return JSONResponse({"error": "title must be a string"}, status_code=400)
    if ask_raw is not None and not isinstance(ask_raw, str):
        return JSONResponse({"error": "ask must be a string"}, status_code=400)
    if quadrant_raw is None:
        return JSONResponse({"error": "quadrant required"}, status_code=400)
    try:
        quadrant = int(quadrant_raw)
    except (TypeError, ValueError):
        return JSONResponse({"error": "invalid quadrant"}, status_code=400)
    if quadrant not in (1, 2, 3, 4):
        return JSONResponse({"error": "invalid quadrant"}, status_code=400)
    ask = (ask_raw if isinstance(ask_raw, str) else _DEFAULT_MANUAL_ASK).strip()
    if not ask:
        ask = _DEFAULT_MANUAL_ASK
    ask = ask[:300]
    topic = ask[:60]

    def _apply():
        config = _config.load_config(_data_dir())
        collect_cfg = _collect.Config.from_dict(config.get("collect") or {})
        chat_key = _resolve_chat_key(session_id, profile, connection_id, collect_cfg)
        if chat_key is None:
            return 404, {
                "error": "This chat isn't on a Hermes that Waiting On You watches."
            }
        agent = _agent_for_chat_key(chat_key, collect_cfg)
        chat_title = _lookup_chat_title(
            session_id, profile, connection_id, title_hint, collect_cfg
        )
        store = _open_store()
        try:
            task_id = store.add_manual_task(
                chat_key,
                agent,
                chat_title,
                ask,
                topic,
                quadrant,
            )
            task = store.get_task(task_id)
            if task is None:
                return 500, "task not found after create"
            target = _chat_targets()
            task["chat_target"] = target(chat_key)
            return 200, {"task": task}
        except ValueError as exc:
            return 400, str(exc)
        finally:
            store.close()

    status_code, payload = await asyncio.to_thread(_apply)
    if status_code == 400:
        return JSONResponse({"error": payload}, status_code=400)
    if status_code == 404:
        return JSONResponse(payload, status_code=404)
    if status_code == 500:
        return JSONResponse({"error": payload}, status_code=500)
    broadcast_tasks_changed()
    return payload


@router.post("/scan")
async def trigger_scan(request: Request):
    global _last_manual_scan_at
    if _oversize_header(request, _MAX_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=400)
    raw = await request.body()
    force = False
    if raw:
        if len(raw) > _MAX_BODY:
            return JSONResponse({"error": "request body too large"}, status_code=400)
        try:
            body = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            return JSONResponse({"error": "invalid JSON"}, status_code=400)
        if not isinstance(body, dict):
            return JSONResponse({"error": "body must be an object"}, status_code=400)
        if "force" in body and not isinstance(body["force"], bool):
            return JSONResponse({"error": "force must be a boolean"}, status_code=400)
        force = bool(body.get("force", False))

    now = time.time()
    async with _scan_rate_lock:
        # A forced scan is an explicit user action, so it only waits a few
        # seconds (enough to stop a runaway loop, short enough that "Scan
        # anyway" right after a scan works). The timestamp still moves so a
        # following non-force scan is limited.
        cooldown = _FORCE_SCAN_COOLDOWN if force else _SCAN_COOLDOWN
        if now - _last_manual_scan_at < cooldown:
            return JSONResponse({"error": "scan rate limited"}, status_code=429)
        _last_manual_scan_at = now

    data_dir = _data_dir()

    def _run():
        return Scanner(data_dir).run_once(force_full=True, manual=True, force=force)

    summary = await asyncio.to_thread(_run)
    return summary


@router.post("/ai-title")
async def ai_title(request: Request):
    if _oversize_header(request, _MAX_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=400)
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        return JSONResponse({"error": "request body too large"}, status_code=400)
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "body must be an object"}, status_code=400)

    allowed = frozenset({"task_id", "chat_key"})
    extra = set(body) - allowed
    if extra:
        return JSONResponse(
            {"error": f"unknown fields: {', '.join(sorted(extra))}"},
            status_code=400,
        )

    has_task = "task_id" in body
    has_chat = "chat_key" in body
    if has_task == has_chat:
        return JSONResponse(
            {"error": "provide exactly one of task_id or chat_key"},
            status_code=400,
        )

    task_id: int | None = None
    chat_key_body: str | None = None
    if has_task:
        raw_id = body["task_id"]
        if isinstance(raw_id, bool) or not isinstance(raw_id, int):
            return JSONResponse({"error": "invalid task_id"}, status_code=400)
        task_id = raw_id
    else:
        raw_key = body["chat_key"]
        if not isinstance(raw_key, str) or not raw_key.strip():
            return JSONResponse({"error": "invalid chat_key"}, status_code=400)
        if len(raw_key) > 300:
            return JSONResponse({"error": "invalid chat_key"}, status_code=400)
        chat_key_body = raw_key.strip()

    settings = _settings.load_settings(_data_dir())
    if not settings.get("consented"):
        return JSONResponse(
            {"error": "Start Waiting On You first (privacy consent)."},
            status_code=403,
        )

    inflight_key = (
        f"task:{task_id}" if task_id is not None else f"group:{chat_key_body}"
    )

    async with _ai_title_inflight_lock:
        if inflight_key in _ai_title_inflight:
            return JSONResponse({"error": "Already naming this one."}, status_code=409)
        _ai_title_inflight.add(inflight_key)

    try:

        def _run():
            store = _open_store()
            try:
                if task_id is not None:
                    task = store.get_task(task_id)
                    if task is None:
                        return 404, None
                    chat_key = task["chat_key"]
                    asks = [task["ask"]]
                    chat_title = task["chat_title"]
                else:
                    assert chat_key_body is not None
                    tasks = store.open_tasks_for_chat(chat_key_body)
                    if not tasks:
                        return 404, None
                    chat_key = chat_key_body
                    asks = [t["ask"] for t in tasks]
                    chat_title = tasks[0]["chat_title"]
            finally:
                store.close()

            collect_cfg = _collect.Config.from_dict(
                _config.load_config(_data_dir()).get("collect") or {}
            )
            transcript = _ai_title.load_transcript(chat_key, collect_cfg)
            try:
                title = _ai_title.generate_title(
                    data_dir=_data_dir(),
                    transcript=transcript,
                    chat_title=chat_title,
                    asks=asks,
                    llm=_ai_title_llm,
                )
            except ValueError:
                return 502, "the model did not return a usable title"
            except Exception as exc:  # noqa: BLE001 — detail stays server-side
                import logging

                logging.getLogger(__name__).warning(
                    "waiting-on-you ai-title failed: %s", type(exc).__name__
                )
                return 502, "the model is not reachable right now"
            return 200, title

        status_code, payload = await asyncio.to_thread(_run)
        if status_code == 404:
            return JSONResponse({"error": "not found"}, status_code=404)
        if status_code == 502:
            return JSONResponse(
                {"error": f"Could not name it with AI: {payload}"},
                status_code=502,
            )
        return {"title": payload}
    finally:
        async with _ai_title_inflight_lock:
            _ai_title_inflight.discard(inflight_key)


def _token_principal(request: Request):
    return getattr(request.state, "token_principal", None)


def _require_pair_principal(request: Request) -> tuple[str | None, JSONResponse | None]:
    principal = _token_principal(request)
    if principal is None:
        return None, JSONResponse({"error": "unauthenticated"}, status_code=401)
    if principal.provider != _satellite_auth.PROVIDER_NAME or not str(
        principal.principal
    ).startswith("wou-pair:"):
        return None, JSONResponse({"error": "unauthorized"}, status_code=401)
    return str(principal.principal).split(":", 1)[1], None


def _require_sat_principal(request: Request) -> tuple[str | None, JSONResponse | None]:
    principal = _token_principal(request)
    if principal is None:
        return None, JSONResponse({"error": "unauthenticated"}, status_code=401)
    if principal.provider != _satellite_auth.PROVIDER_NAME or not str(
        principal.principal
    ).startswith("wou-sat:"):
        return None, JSONResponse({"error": "unauthorized"}, status_code=401)
    return str(principal.principal).split(":", 1)[1], None


def _push_rate_ok(satellite_id: str, now: float) -> bool:
    window_start = now - _PUSH_RATE_WINDOW
    hits = [t for t in _push_rate.get(satellite_id, []) if t > window_start]
    if len(hits) >= _PUSH_RATE_LIMIT:
        _push_rate[satellite_id] = hits
        return False
    hits.append(now)
    _push_rate[satellite_id] = hits
    return True


@router.get("/satellite/status")
async def satellite_status():
    enabled, reason = _satellite_auth.registration_state()
    return {
        "enabled": enabled,
        "reason": reason,
        "routes": list(_satellite_auth.TOKEN_ROUTES),
    }


@router.post("/satellite/pair-codes")
async def create_satellite_pair_code(request: Request):
    if _oversize_header(request, _MAX_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=400)
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        return JSONResponse({"error": "request body too large"}, status_code=400)
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "body must be an object"}, status_code=400)
    name = body.get("name")
    if not isinstance(name, str) or not name.strip():
        return JSONResponse({"error": "name required"}, status_code=400)
    agent_name = body.get("agent_name")
    if agent_name is not None and not isinstance(agent_name, str):
        return JSONResponse({"error": "agent_name must be a string"}, status_code=400)
    connections = body.get("connections")
    if connections is not None and not isinstance(connections, list):
        return JSONResponse({"error": "connections must be a list"}, status_code=400)
    desktop_profile = body.get("desktop_profile")
    if desktop_profile is not None and not isinstance(desktop_profile, str):
        return JSONResponse(
            {"error": "desktop_profile must be a string"}, status_code=400
        )

    def _create():
        config = _config.load_config(_data_dir())
        collect_cfg = _collect.Config.from_dict(config.get("collect") or {})
        return _satellite_hub.create_pair_code(
            _db_path(),
            name.strip(),
            (agent_name or "").strip(),
            connections if isinstance(connections, list) else None,
            desktop_profile.strip() if isinstance(desktop_profile, str) else None,
            hermes_home=collect_cfg.hermes_home,
        )

    try:
        code, expires_at = await asyncio.to_thread(_create)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    return {"code": code, "expires_at": expires_at}


@router.get("/satellites")
async def list_satellites_route():
    def _load():
        return _satellite_hub.list_satellites(_db_path())

    return {"satellites": await asyncio.to_thread(_load)}


@router.delete("/satellites/{satellite_id}")
async def revoke_satellite(satellite_id: str):
    if not _SESSION_ID_RE.match(satellite_id):
        return JSONResponse({"error": "invalid satellite id"}, status_code=400)

    def _revoke():
        _satellite_hub.revoke(_db_path(), satellite_id)

    try:
        await asyncio.to_thread(_revoke)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=404)
    return {"ok": True}


@router.post("/satellite/pair")
async def satellite_pair(request: Request):
    code_id, err = _require_pair_principal(request)
    if err is not None:
        return err
    if _oversize_header(request, _MAX_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=400)
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        return JSONResponse({"error": "request body too large"}, status_code=400)
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "body must be an object"}, status_code=400)
    hostname = body.get("hostname", "")
    version = body.get("version", "")
    if not isinstance(hostname, str) or not isinstance(version, str):
        return JSONResponse({"error": "hostname and version required"}, status_code=400)

    bearer = request.headers.get("authorization") or ""
    token = bearer[7:].strip() if bearer.lower().startswith("bearer ") else ""

    def _redeem():
        config = _config.load_config(_data_dir())
        collect_cfg = _collect.Config.from_dict(config.get("collect") or {})
        if _satellite_hub.verify_pair_code(_db_path(), token) != code_id:
            return None
        return _satellite_hub.redeem_pair_code(
            _db_path(),
            token,
            hostname[:200],
            version[:200],
            hermes_home=collect_cfg.hermes_home,
        )

    try:
        result = await asyncio.to_thread(_redeem)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=409)
    if result is None:
        return JSONResponse({"error": "invalid or expired code"}, status_code=401)
    satellite_id, sat_token, sat_name, agent_name = result
    return {
        "satellite_id": satellite_id,
        "token": sat_token,
        "name": sat_name,
        "agent_name": agent_name,
    }


@router.post("/satellite/push")
async def satellite_push(request: Request):
    _maybe_start_background()
    satellite_id, err = _require_sat_principal(request)
    if err is not None:
        return err
    if _oversize_header(request, _MAX_PUSH_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=413)
    raw = await request.body()
    if len(raw) > _MAX_PUSH_BODY:
        return JSONResponse({"error": "request body too large"}, status_code=413)
    now = time.time()
    if not _push_rate_ok(satellite_id, now):
        return JSONResponse({"error": "rate limited"}, status_code=429)
    try:
        body = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "body must be an object"}, status_code=400)

    def _ingest():
        return _satellite_hub.ingest(_db_path(), satellite_id, body, now=now)

    try:
        result = await asyncio.to_thread(_ingest)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    return result


@router.get("/quiz")
async def get_quiz(limit: int = 10):
    if not 1 <= limit <= 100:
        return JSONResponse({"error": "limit must be 1-100"}, status_code=400)

    def load():
        store = _open_store()
        try:
            return {"tasks": store.quiz_tasks(limit)}
        finally:
            store.close()

    return await asyncio.to_thread(load)


async def _quiz_apply(task_id, quadrant=None, skip=False):
    def apply():
        store = _open_store()
        try:
            task = store.get_task(task_id)
            if task is None or task["status"] != "open":
                return None
            if skip:
                store.skip_quiz(task_id)
                return {"ok": True}
            # Avoid recording both move and quiz for the same answer.
            store.record_priority_label(task_id, quadrant, "quiz")
            store.set_quadrant(task_id, quadrant, locked=False)
            store._conn.execute(
                "UPDATE tasks SET quadrant_locked=1 WHERE id=?", (task_id,)
            )
            store._conn.commit()
            return {"task": store.get_task(task_id)}
        finally:
            store.close()

    payload = await asyncio.to_thread(apply)
    if payload is None:
        return JSONResponse({"error": "open task not found"}, status_code=404)
    broadcast_tasks_changed()
    return payload


@router.post("/quiz/{task_id}")
async def answer_quiz(task_id: int, request: Request):
    try:
        body = await _tag_body(request, {"quadrant"})
        quadrant = body.get("quadrant")
        if type(quadrant) is not int or quadrant not in (1, 2, 3, 4):
            raise ValueError("quadrant must be an integer 1-4")
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    return await _quiz_apply(task_id, quadrant)


@router.post("/quiz/{task_id}/skip")
async def skip_quiz(task_id: int, request: Request):
    if _oversize_header(request, _MAX_BODY):
        return JSONResponse({"error": "request body too large"}, status_code=400)
    raw = await request.body()
    if len(raw) > _MAX_BODY:
        return JSONResponse({"error": "request body too large"}, status_code=400)
    if raw and raw.strip() not in (b"{}", b""):
        return JSONResponse({"error": "skip expects an empty body"}, status_code=400)
    return await _quiz_apply(task_id, skip=True)
