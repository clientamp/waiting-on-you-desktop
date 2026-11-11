"""Shared validation for chat rows received from satellites and SSH readers."""
from __future__ import annotations

import math
import re
from typing import Any

_CHAT_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")


def _validate_project(project):
    if project is None:
        return None
    if not isinstance(project, dict):
        raise ValueError("invalid project")
    if project.get("profile") is not None and (not isinstance(project["profile"], str) or len(project["profile"]) > 64):
        raise ValueError("invalid project profile")
    for field in ("key", "name", "slug", "color"):
        if project.get(field) is not None and (
            not isinstance(project[field], str) or len(project[field]) > 300
        ):
            raise ValueError("invalid project field")
    if not project.get("key") or not project.get("name"):
        raise ValueError("project key and name required")
    return {k: project.get(k) for k in ("key", "name", "slug", "color")}


def _validate_chat_row(row: Any, index: int) -> dict[str, Any]:
    if not isinstance(row, dict):
        raise ValueError(f"chat {index}: not an object")
    cid = row.get("id")
    if not isinstance(cid, str) or not _CHAT_ID_RE.match(cid):
        raise ValueError(f"chat {index}: invalid id")
    title = row.get("title")
    if not isinstance(title, str) or len(title) > 300:
        raise ValueError(f"chat {index}: invalid title")
    source = row.get("source")
    if not isinstance(source, str) or len(source) > 64:
        raise ValueError(f"chat {index}: invalid source")
    last_active = row.get("last_active")
    if isinstance(last_active, bool) or not isinstance(last_active, (int, float)):
        raise ValueError(f"chat {index}: invalid last_active")
    try:
        valid_activity = math.isfinite(last_active)
    except OverflowError:
        valid_activity = False
    if not valid_activity:
        raise ValueError(f"chat {index}: invalid last_active")
    last_msg_id = row.get("last_msg_id")
    if isinstance(last_msg_id, bool) or last_msg_id is None:
        raise ValueError(f"chat {index}: invalid last_msg_id")
    last_msg_s = str(last_msg_id)
    if len(last_msg_s) > 128:
        raise ValueError(f"chat {index}: invalid last_msg_id")
    last_role = row.get("last_role")
    if last_role not in ("user", "assistant"):
        raise ValueError(f"chat {index}: invalid last_role")
    user_last = row.get("user_last")
    if not isinstance(user_last, str) or len(user_last) > 4000:
        raise ValueError(f"chat {index}: invalid user_last")
    agent_last = row.get("agent_last")
    if not isinstance(agent_last, str) or len(agent_last) > 4000:
        raise ValueError(f"chat {index}: invalid agent_last")
    for field, limit in (("profile", 64), ("cwd", 1024)):
        if isinstance(row.get(field), str) and len(row[field]) > limit:
            raise ValueError(f"chat {index}: invalid {field}")
    project = _validate_project(row.get("project"))
    return {
        "project": project,
        "profile": row.get("profile")
        if isinstance(row.get("profile"), str)
        else "default",
        "cwd": row.get("cwd") if isinstance(row.get("cwd"), str) else "",
        "id": cid,
        "title": title,
        "source": source,
        "last_active": float(last_active),
        "last_msg_id": last_msg_s,
        "last_role": last_role,
        "user_last": user_last,
        "agent_last": agent_last,
    }
