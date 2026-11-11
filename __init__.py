"""Waiting On You — Hermes plugin."""

from __future__ import annotations

import json
import threading
from pathlib import Path

from .wou.scanner import BackgroundRunner, Scanner, read_last_scan
from .wou.store import Store

_WOU_LIST_SCHEMA = {
    "name": "wou_list",
    "description": (
        "List open tasks waiting on the user (read-only) for this chat's Hermes profile only. "
        "Other profiles' tasks are omitted. "
        "Tasks cleared for age are expired, not answered, and excluded."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "quadrant": {
                "type": "integer",
                "minimum": 1,
                "maximum": 4,
                "description": "Filter to one Covey quadrant.",
            },
            "project": {
                "type": "string",
                "description": "Filter by Hermes project name or key.",
            },
            "tag": {"type": "string", "description": "Filter by tag name."},
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 200,
                "description": "Maximum tasks to return (default 20).",
            },
        },
        "additionalProperties": False,
    },
}

_WOU_LIST_DEFAULT_LIMIT = 20


def _slim_task(t: dict) -> dict:
    """Fields an agent needs; the full row costs ~10x the tokens."""
    out = {
        "id": t.get("id"),
        "agent": t.get("agent"),
        "chat": t.get("title_override") or t.get("chat_name") or t.get("chat_title"),
        "topic": t.get("topic"),
        "ask": t.get("ask"),
        "quadrant": t.get("quadrant"),
    }
    if t.get("context"):
        out["context"] = t["context"]
    if t.get("due_at") is not None:
        from datetime import datetime

        out["due"] = datetime.fromtimestamp(t["due_at"]).strftime("%Y-%m-%d")
    if t.get("project"):
        out["project"] = t["project"]["name"]
    if t.get("tags"):
        out["tags"] = [tag["name"] for tag in t["tags"]]
    if t.get("status") == "snoozed":
        out["status"] = "snoozed"
    return out


_HELP = (
    "Waiting On You: /waiting-on-you status shows quadrant counts and last scan. "
    "/waiting-on-you scan runs a full scan now. "
    "/waiting-on-you help shows this message."
)

_background_runner: BackgroundRunner | None = None
_startup_lock = threading.Lock()


def _data_dir() -> Path:
    from .wou import paths

    return Path(paths.plugin_data_directory())


def _maybe_start_background() -> None:
    import os
    from .wou.paths import hub_hermes_home
    from .wou.settings import load_settings

    if os.environ.get("HERMES_WOU_BACKGROUND", "1") == "0" or hub_hermes_home() is not None:
        return
    global _background_runner
    with _startup_lock:
        settings = load_settings(_data_dir())
        if not settings["consented"] or settings["mode"] == "off":
            return
        if _background_runner is not None:
            return
        runner = BackgroundRunner(Scanner(_data_dir()))
        runner.start()
        # A lock loser owns a cancellable retry, even before it owns a runner.
        _background_runner = runner


def start_background_if_enabled() -> None:
    _maybe_start_background()


def stop_background() -> None:
    global _background_runner
    with _startup_lock:
        runner = _background_runner
        _background_runner = None
        if runner is not None:
            runner.stop()


def register(ctx):
    from .wou import classify as _classify
    from .wou import decision as _decision

    _decision.set_context(ctx)

    # Public plugin seams: an auxiliary task the user can point at any model in
    # config.yaml (auxiliary.waiting_on_you), and the host-owned LLM facade.
    try:
        ctx.register_auxiliary_task(
            _classify.TASK_NAME,
            display_name="Waiting On You",
            description="Reads the end of each chat and lists what the agent is waiting on you for.",
        )
    except Exception:
        pass
    try:
        _classify.set_host_llm(ctx.llm)
    except Exception:
        pass

    def post_llm_call(**kwargs):
        try:
            session_id = kwargs.get("session_id")
            if not session_id:
                return
            store = Store(str(_data_dir() / "wou.db"))
            try:
                store.mark_dirty(str(session_id))
            finally:
                store.close()
        except Exception:
            pass
        _maybe_start_background()

    ctx.register_hook("post_llm_call", post_llm_call)

    def wou_list_handler(args, **kwargs):
        del kwargs
        quadrant = args.get("quadrant") if isinstance(args, dict) else None
        limit = _WOU_LIST_DEFAULT_LIMIT
        if isinstance(args, dict) and args.get("limit") is not None:
            try:
                limit = int(args["limit"])
            except (TypeError, ValueError):
                limit = _WOU_LIST_DEFAULT_LIMIT
        limit = max(1, min(200, limit))
        data_dir = _data_dir()
        from .wou.wou_list_scope import resolve_profile_scope, task_in_profile_scope

        scope = resolve_profile_scope(args if isinstance(args, dict) else None, data_dir=data_dir)
        store = Store(str(data_dir / "wou.db"))
        try:
            tasks = store.list_tasks(include_closed=False)
            tasks = [t for t in tasks if task_in_profile_scope(t["chat_key"], scope)]
            if quadrant is not None:
                try:
                    q = int(quadrant)
                except (TypeError, ValueError):
                    q = None
                if q in (1, 2, 3, 4):
                    tasks = [t for t in tasks if t["quadrant"] == q]
            if isinstance(args, dict):
                project = str(args.get("project") or "").strip().casefold()
                tag = str(args.get("tag") or "").strip().casefold()
                if project:
                    tasks = [
                        t
                        for t in tasks
                        if t.get("project")
                        and project
                        in (
                            t["project"]["name"].casefold(),
                            t["project"]["key"].casefold(),
                        )
                    ]
                if tag:
                    tasks = [
                        t
                        for t in tasks
                        if any(v["name"].casefold() == tag for v in t.get("tags", []))
                    ]
            total = len(tasks)
            # Most important first, newest first within a quadrant, so a
            # small limit still shows what matters.
            tasks.sort(
                key=lambda t: (
                    int(t.get("quadrant") or 4),
                    -float(t.get("updated_at") or 0),
                )
            )
            slim = [_slim_task(t) for t in tasks[:limit]]
            return json.dumps(
                {"total": total, "tasks": slim},
                ensure_ascii=False,
                separators=(",", ":"),
            )
        finally:
            store.close()

    ctx.register_tool(
        name="wou_list",
        toolset="waiting_on_you",
        schema=_WOU_LIST_SCHEMA,
        handler=wou_list_handler,
    )

    def waiting_on_you_command(raw_args: str) -> str:
        tokens = raw_args.split() if isinstance(raw_args, str) else []
        sub = tokens[0].lower() if tokens else "help"
        if sub in {"help", "-h", "--help"}:
            return _HELP
        if sub == "scan":
            from .wou import settings as _wou_settings

            if not _wou_settings.load_settings(_data_dir()).get("consented"):
                return (
                    "Scanning is paused until you start Waiting On You "
                    "from the Desktop panel (privacy consent)."
                )
            summary = Scanner(_data_dir()).run_once(force_full=True, manual=True)
            if summary.get("skipped") == "locked":
                return "Scan skipped: another scan is already running."
            if summary.get("skipped") == "consent":
                return (
                    "Scanning is paused until you start Waiting On You "
                    "from the Desktop panel (privacy consent)."
                )
            return (
                f"Scan complete: {summary.get('classified', 0)} classified, "
                f"+{summary.get('added', 0)} added, "
                f"{summary.get('resolved', 0)} resolved, "
                f"{summary.get('expired', 0)} cleared for age (not answered)."
            )
        if sub == "status":
            store = Store(str(_data_dir() / "wou.db"))
            try:
                tasks = store.list_tasks(include_closed=False)
                counts = {str(q): 0 for q in range(1, 5)}
                for t in tasks:
                    key = str(t["quadrant"])
                    if key in counts:
                        counts[key] += 1
            finally:
                store.close()
            last = read_last_scan(_data_dir()) or {}
            at = last.get("at")
            when = f"last scan at {at}" if at else "no scan yet"
            return f"Q1={counts['1']} Q2={counts['2']} Q3={counts['3']} Q4={counts['4']}; {when}"
        return _HELP

    ctx.register_command(
        "waiting-on-you",
        waiting_on_you_command,
        description="Waiting On You task list and scanner",
        args_hint="scan|status|help",
    )
    start_background_if_enabled()
    on_unload = getattr(ctx, "on_unload", None)
    if callable(on_unload):
        on_unload(stop_background)
