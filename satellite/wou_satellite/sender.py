"""HTTP pairing, change detection, and push to the Waiting On You hub."""

from __future__ import annotations

import json
import logging
import socket
import time
from pathlib import Path
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlparse

from . import config as cfg
from . import urlsafety
from .reader import Config, collect_db

_log = logging.getLogger(__name__)

CHUNK_SIZE = 250
FULL_PUSH_INTERVAL = 6 * 3600
REQUEST_TIMEOUT = 20
BACKOFF_INITIAL = 30.0
BACKOFF_MAX = 900.0
REVOKED_ERROR = "unpaired by hub (revoked)"

ROW_KEYS = (
    "id",
    "title",
    "source",
    "last_active",
    "last_msg_id",
    "last_role",
    "user_last",
    "agent_last",
)

PAIR_PATH = "/api/plugins/waiting-on-you-desktop/satellite/pair"
PUSH_PATH = "/api/plugins/waiting-on-you-desktop/satellite/push"
LEGACY_PAIR_PATH = "/api/plugins/waiting-on-you/satellite/pair"
LEGACY_PUSH_PATH = "/api/plugins/waiting-on-you/satellite/push"

PAIR_401_MSG = (
    "That code is wrong, used, or expired. Make a new one in Waiting On You Settings."
)


def normalize_hub_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise ValueError("Hub URL is required.")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Hub URL must start with http:// or https://")
    if not parsed.netloc:
        raise ValueError("Hub URL is invalid.")
    return url.rstrip("/")


def _clip_field(s: str | None, n: int) -> str:
    text = " ".join((s or "").split())
    if len(text) <= n:
        return text
    return text[:n]


def row_for_hub(row: dict[str, Any]) -> dict[str, Any]:
    return {
        **{k: row[k] for k in ("project", "profile", "cwd") if k in row},
        "id": row["id"],
        "title": _clip_field(str(row.get("title", "")), 300),
        "source": _clip_field(str(row.get("source", "")), 64),
        "last_active": float(row["last_active"]),
        "last_msg_id": str(row["last_msg_id"]),
        "last_role": row["last_role"],
        "user_last": _clip_field(str(row.get("user_last", "")), 4000),
        "agent_last": _clip_field(str(row.get("agent_last", "")), 4000),
    }


def _ack_value(row: dict[str, Any]) -> str:
    if "project" not in row:
        return str(row["last_msg_id"])
    return json.dumps(
        [str(row["last_msg_id"]), row.get("project"), row.get("cwd")], sort_keys=True
    )


def compute_changes(
    rows: list[dict[str, Any]], sent: dict[str, str]
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        cid = str(row["id"])
        msg_id = _ack_value(row)
        if sent.get(cid) != msg_id:
            out.append(row_for_hub(row))
    return out


def _collect_rows(now: float | None = None) -> list[dict[str, Any]]:
    path = cfg.state_db_path()
    collect_cfg = Config.from_dict({"days": 10, "local_profiles": []})
    from .hermes_projects import project_for_cwd

    profile = path.parent.name if path.parent.parent.name == "profiles" else "default"
    rows = collect_db(path, collect_cfg, now=now)
    for row in rows:
        row["profile"] = profile
        row["project"] = project_for_cwd(
            path.parent / "projects.db", row.get("cwd"), profile
        )
    return rows


def _project_catalog() -> list[dict]:
    from .hermes_projects import list_projects

    path = cfg.state_db_path()
    profile = path.parent.name if path.parent.parent.name == "profiles" else "default"
    return list_projects(path.parent / "projects.db", profile)


def _user_agent() -> str:
    return f"waiting-on-you-satellite/{cfg.plugin_version()}"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow redirects: the token must only go to the paired hub URL."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def _json_request(
    method: str,
    url: str,
    token: str,
    body: dict[str, Any] | None = None,
) -> tuple[int, dict[str, Any] | None, str | None]:
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": _user_agent(),
        "Accept": "application/json",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with _OPENER.open(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read()
            status = resp.status
    except urllib.error.HTTPError as exc:
        status = exc.code
        try:
            raw = exc.read()
        except OSError:
            raw = b""
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return 0, None, str(exc)

    parsed: dict[str, Any] | None = None
    if raw:
        try:
            loaded = json.loads(raw.decode("utf-8"))
            if isinstance(loaded, dict):
                parsed = loaded
        except (UnicodeDecodeError, json.JSONDecodeError):
            parsed = None
    return status, parsed, None


def _post_json_with_legacy(
    hub_url: str,
    primary_path: str,
    legacy_path: str,
    token: str,
    body: dict[str, Any] | None,
) -> tuple[int, dict[str, Any] | None, str | None]:
    status, parsed, net_err = _json_request(
        "POST", f"{hub_url}{primary_path}", token, body
    )
    if status == 404 and primary_path != legacy_path:
        return _json_request("POST", f"{hub_url}{legacy_path}", token, body)
    return status, parsed, net_err


def _merge_sent_chats(sent: dict[str, Any], rows: list[dict[str, Any]]) -> None:
    for row in rows:
        sent[str(row["id"])] = _ack_value(row)


def _chunk(rows: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    if not rows:
        return []
    return [rows[i : i + CHUNK_SIZE] for i in range(0, len(rows), CHUNK_SIZE)]


def push_rows(
    hub_url: str,
    token: str,
    rows: list[dict[str, Any]],
    *,
    full: bool,
    data_dir: Path | None = None,
    now: float | None = None,
) -> tuple[bool, str | None]:
    """Push chat rows to the hub. Updates sent.json on successful chunks."""
    ts = now if now is not None else time.time()
    reason = urlsafety.check(hub_url)
    if reason:
        return False, reason

    sent = cfg.load_sent(data_dir)
    if sent.get("last_error") == REVOKED_ERROR:
        return False, REVOKED_ERROR

    retry_at = sent.get("next_retry_at")
    if isinstance(retry_at, (int, float)) and ts < float(retry_at):
        return False, "backing off"

    if not rows and not full:
        return True, None

    # An empty full push still goes to the hub: it clears old chats there and
    # tells the hub this machine is alive (otherwise it would look offline).
    chunks = _chunk(rows) or [[]]
    use_full_flag = full and len(rows) <= CHUNK_SIZE
    version = cfg.plugin_version()
    any_ok = False
    all_chunks_ok = bool(chunks)

    for chunk in chunks:
        body = {
            "chats": chunk,
            "projects": _project_catalog(),
            "full": use_full_flag,
            "version": version,
        }
        status, _parsed, net_err = _post_json_with_legacy(
            hub_url, PUSH_PATH, LEGACY_PUSH_PATH, token, body
        )
        if net_err:
            _apply_backoff(sent, ts, net_err, data_dir)
            return False, net_err
        if status == 200:
            _merge_sent_chats(sent, chunk)
            any_ok = True
            sent["last_ok_at"] = ts
            sent["last_error"] = None
            sent.pop("next_retry_at", None)
            sent["retry_backoff"] = BACKOFF_INITIAL
            cfg.save_sent(sent, data_dir)
            continue
        if status == 401:
            sent["last_error"] = REVOKED_ERROR
            sent.pop("next_retry_at", None)
            cfg.save_sent(sent, data_dir)
            return False, REVOKED_ERROR
        if status in (400, 413):
            err = f"hub rejected chunk ({status})"
            _log.warning("push chunk skipped: %s", err)
            sent["last_error"] = err
            cfg.save_sent(sent, data_dir)
            all_chunks_ok = False
            continue
        if status == 429 or status >= 500:
            _apply_backoff(sent, ts, f"HTTP {status}", data_dir)
            return False, f"HTTP {status}"

    if full and all_chunks_ok and any_ok:
        sent = cfg.load_sent(data_dir)
        sent["last_full_at"] = ts
        cfg.save_sent(sent, data_dir)

    return any_ok or not rows, None


def _apply_backoff(sent: dict[str, Any], now: float, err: str, data_dir) -> None:
    backoff = float(sent.get("retry_backoff") or BACKOFF_INITIAL)
    sent["last_error"] = err
    sent["next_retry_at"] = now + backoff
    sent["retry_backoff"] = min(backoff * 2, BACKOFF_MAX)
    cfg.save_sent(sent, data_dir)


def run_push(
    data_dir: Path | None = None,
    *,
    force_full: bool = False,
    now: float | None = None,
) -> tuple[int, str | None]:
    """Read state.db and push changes (or full snapshot). Returns (count, error)."""
    pairing = cfg.load_pairing(data_dir)
    if not pairing:
        return 0, "not paired"

    hub_url = str(pairing["hub_url"])
    token = str(pairing["token"])
    reason = urlsafety.check(hub_url)
    if reason:
        return 0, reason

    sent = cfg.load_sent(data_dir)
    if sent.get("last_error") == REVOKED_ERROR:
        return 0, REVOKED_ERROR

    ts = now if now is not None else time.time()
    retry_at = sent.get("next_retry_at")
    if isinstance(retry_at, (int, float)) and ts < float(retry_at):
        return 0, "backing off"

    rows = _collect_rows(now=ts)
    ack = cfg.chat_ack_map(sent)
    last_full = sent.get("last_full_at")
    need_full = force_full
    if not need_full:
        if not isinstance(last_full, (int, float)):
            need_full = True
        elif ts - float(last_full) >= FULL_PUSH_INTERVAL:
            need_full = True

    if need_full:
        to_send = [row_for_hub(r) for r in rows]
        ok, err = push_rows(
            hub_url, token, to_send, full=True, data_dir=data_dir, now=ts
        )
        if not ok and err:
            return 0, err
        return len(to_send), None

    changes = compute_changes(rows, ack)
    if not changes:
        return 0, None
    ok, err = push_rows(hub_url, token, changes, full=False, data_dir=data_dir, now=ts)
    if not ok and err:
        return 0, err
    return len(changes), None


def pair(
    hub_url: str,
    code: str,
    *,
    data_dir: Path | None = None,
    now: float | None = None,
) -> str:
    """Exchange pairing code for a token; save pairing and run a full push."""
    ts = now if now is not None else time.time()
    try:
        hub = normalize_hub_url(hub_url)
    except ValueError as exc:
        return str(exc)

    reason = urlsafety.check(hub)
    if reason:
        return reason

    body = {
        "hostname": socket.gethostname()[:200],
        "version": cfg.plugin_version(),
    }
    status, parsed, net_err = _post_json_with_legacy(
        hub, PAIR_PATH, LEGACY_PAIR_PATH, code.strip(), body
    )
    if net_err:
        return f"Could not reach the hub at {hub}. ({net_err})"
    if status == 401:
        return PAIR_401_MSG
    if status != 200 or not parsed:
        return f"Pairing failed (HTTP {status}). Check the hub URL and try again."

    satellite_id = parsed.get("satellite_id")
    token = parsed.get("token")
    name = parsed.get("name")
    agent_name = parsed.get("agent_name")
    if not all(isinstance(x, str) for x in (satellite_id, token, name, agent_name)):
        return "Pairing failed: unexpected hub response."

    cfg.save_pairing(hub, satellite_id, token, name, agent_name, ts, data_dir)
    cfg.save_sent(
        {
            "last_full_at": None,
            "last_ok_at": None,
            "last_error": None,
            "retry_backoff": BACKOFF_INITIAL,
        },
        data_dir,
    )
    count, push_err = run_push(data_dir=data_dir, force_full=True, now=ts)
    if push_err and push_err != REVOKED_ERROR:
        return f"Paired as {name}. Push after pairing failed: {push_err}"
    return f"Paired as {name}. Sent {count} chats."


def format_status(data_dir: Path | None = None, now: float | None = None) -> str:
    pairing = cfg.load_pairing(data_dir)
    if not pairing:
        return "Not paired. Run: hermes waiting-on-you-satellite pair <hub_url> <code>"

    sent = cfg.load_sent(data_dir)
    hub = pairing.get("hub_url", "?")
    name = pairing.get("name", "?")
    last_ok = sent.get("last_ok_at")
    last_err = sent.get("last_error")
    rows = _collect_rows(now=now)
    pending = len(compute_changes(rows, cfg.chat_ack_map(sent)))

    parts = [
        f"Paired as {name} → {hub}",
    ]
    if last_ok:
        parts.append(
            f"last ok {time.strftime('%Y-%m-%d %H:%M', time.localtime(float(last_ok)))}"
        )
    else:
        parts.append("no successful push yet")
    if last_err:
        parts.append(f"last error: {last_err}")
    parts.append(f"pending changes: {pending}")
    return "; ".join(parts)


def unpair(data_dir: Path | None = None) -> str:
    cfg.clear_credentials(data_dir)
    return "Unpaired. pairing.json and sent.json removed."
