"""Hub-side satellite pairing, token store, and chat ingest."""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any

from .collect import Config, _chat_key, discover_local_profiles, profile_display_name
from .store import Store
from .chat_rows import _validate_chat_row, _validate_project

SAT_TOKEN_PREFIX = "wousat_"
PAIR_PREFIX = "woupair_"
MAX_CHATS_PER_PUSH = 300
MAX_SATELLITE_CHATS = 2000
MAX_ACTIVE_PAIR_CODES = 5
# A healthy but idle satellite sends a full list every 6 hours, so silence
# longer than 7 hours means it is offline or broken.
SATELLITE_OFFLINE_SECONDS = 7 * 3600
_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")


def _hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_tables(db_path: str) -> None:
    with _connect(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS satellites (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                agent_name TEXT NOT NULL,
                connections TEXT NOT NULL,
                desktop_profile TEXT,
                token_hash TEXT NOT NULL UNIQUE,
                created_at REAL NOT NULL,
                last_seen REAL,
                last_push_count INTEGER,
                revoked_at REAL
            );
            CREATE TABLE IF NOT EXISTS satellite_pair_codes (
                id TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                agent_name TEXT NOT NULL,
                connections TEXT NOT NULL,
                desktop_profile TEXT,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL,
                used_at REAL
            );
            CREATE TABLE IF NOT EXISTS satellite_project_catalog (
                satellite_id TEXT PRIMARY KEY, row_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS satellite_chats (
                satellite_id TEXT NOT NULL,
                chat_id TEXT NOT NULL,
                row_json TEXT NOT NULL,
                received_at REAL NOT NULL,
                PRIMARY KEY (satellite_id, chat_id)
            );
            """
        )
        # Names are part of persistent chat/project identities. Never rename
        # existing rows; serialize uniqueness checks at claim time instead.
        conn.execute("DROP INDEX IF EXISTS idx_satellites_active_name")


def _normalize_connections(connections: list[str] | None) -> list[str]:
    if not connections:
        return []
    out: list[str] = []
    for c in connections:
        if isinstance(c, str) and c.strip():
            out.append(c.strip())
    return out


def create_pair_code(
    db_path: str,
    name: str,
    agent_name: str,
    connections: list[str] | None,
    desktop_profile: str | None,
    *,
    ttl: float = 600,
    hermes_home: Path | None = None,
    now: float | None = None,
) -> tuple[str, float]:
    """Return (plaintext code, expires_at)."""
    ensure_tables(db_path)
    if not _NAME_RE.match(name):
        raise ValueError("invalid satellite name")
    lname = name.lower()
    home = hermes_home or Path.home() / ".hermes"
    for p in discover_local_profiles(home):
        if p["name"].lower() == lname:
            raise ValueError("name already in use; pick another name")
    from .config import load_config
    config = load_config(Path(db_path).parent)
    remote_hosts = (config.get("collect") or {}).get("remote_hosts", [])
    if any(str(h.get("name", "")).lower() == lname for h in remote_hosts):
        raise ValueError("name already in use; pick another name")
    if _active_satellite_by_name(db_path, lname):
        raise ValueError("name already in use; pick another name")

    ts = now if now is not None else time.time()
    with _connect(db_path) as conn:
        n = conn.execute(
            """
            SELECT COUNT(*) FROM satellite_pair_codes
            WHERE used_at IS NULL AND expires_at > ?
            """,
            (ts,),
        ).fetchone()[0]
        if n >= MAX_ACTIVE_PAIR_CODES:
            raise ValueError("too many active pairing codes")

    code = PAIR_PREFIX + secrets.token_urlsafe(18)
    code_id = str(uuid.uuid4())
    agent = (agent_name or "").strip() or profile_display_name(name, {})
    conns = json.dumps(_normalize_connections(connections))
    prof = (desktop_profile or "").strip() or None
    with _connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO satellite_pair_codes
            (id, code_hash, name, agent_name, connections, desktop_profile,
             created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                code_id,
                _hash_secret(code),
                name,
                agent,
                conns,
                prof,
                ts,
                ts + ttl,
            ),
        )
        conn.commit()
    return code, ts + ttl


def _active_satellite_names(db_path: str) -> set[str]:
    with _connect(db_path) as conn:
        rows = conn.execute(
            "SELECT name FROM satellites WHERE revoked_at IS NULL"
        ).fetchall()
    return {str(r["name"]).lower() for r in rows}


def _active_satellite_by_name(db_path: str, lname: str) -> bool:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT 1 FROM satellites WHERE lower(name) = ? AND revoked_at IS NULL",
            (lname,),
        ).fetchone()
    return row is not None


def verify_pair_code(db_path: str, code: str, now: float | None = None) -> str | None:
    if not code.startswith(PAIR_PREFIX):
        return None
    ensure_tables(db_path)
    ts = now if now is not None else time.time()
    h = _hash_secret(code)
    with _connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT id FROM satellite_pair_codes
            WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?
            """,
            (h, ts),
        ).fetchone()
    return str(row["id"]) if row else None


def redeem_pair_code(
    db_path: str,
    code: str,
    hostname: str,
    version: str,
    *,
    hermes_home: Path | None = None,
    now: float | None = None,
) -> tuple[str, str, str, str] | None:
    ensure_tables(db_path)
    if not code.startswith(PAIR_PREFIX):
        return None
    ts = now if now is not None else time.time()
    h = _hash_secret(code)
    satellite_id = str(uuid.uuid4())
    token = SAT_TOKEN_PREFIX + secrets.token_urlsafe(32)
    token_h = _hash_secret(token)

    with _connect(db_path) as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            """
            SELECT id, name, agent_name, connections, desktop_profile
            FROM satellite_pair_codes
            WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?
            """,
            (h, ts),
        ).fetchone()
        if not row:
            conn.rollback()
            return None
        if conn.execute(
            "SELECT 1 FROM satellites WHERE lower(name) = ? AND revoked_at IS NULL",
            (str(row["name"]).lower(),),
        ).fetchone():
            raise ValueError("satellite name already in use; pick another name")
        cur = conn.execute(
            "UPDATE satellite_pair_codes SET used_at = ? WHERE id = ? AND used_at IS NULL",
            (ts, row["id"]),
        )
        if cur.rowcount != 1:
            conn.rollback()
            return None
        try:
            conn.execute(
                """
                INSERT INTO satellites
                (id, name, agent_name, connections, desktop_profile, token_hash,
                 created_at, last_seen)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    satellite_id,
                    row["name"],
                    row["agent_name"],
                    row["connections"],
                    row["desktop_profile"],
                    token_h,
                    ts,
                    ts,
                ),
            )
        except sqlite3.IntegrityError:
            conn.rollback()
            return None
        conn.commit()
    return satellite_id, token, str(row["name"]), str(row["agent_name"])


def verify_satellite_token(db_path: str, token: str) -> str | None:
    if not token.startswith(SAT_TOKEN_PREFIX):
        return None
    ensure_tables(db_path)
    h = _hash_secret(token)
    with _connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT id FROM satellites
            WHERE token_hash = ? AND revoked_at IS NULL
            """,
            (h,),
        ).fetchone()
    return str(row["id"]) if row else None


def _satellite_row(db_path: str, satellite_id: str) -> sqlite3.Row | None:
    with _connect(db_path) as conn:
        return conn.execute(
            "SELECT * FROM satellites WHERE id = ?", (satellite_id,)
        ).fetchone()


def satellite_projects(db_path: str) -> list[dict]:
    ensure_tables(db_path)
    with _connect(db_path) as conn:
        rows = conn.execute(
            "SELECT p.row_json,s.name FROM satellite_project_catalog p JOIN satellites s ON s.id=p.satellite_id WHERE s.revoked_at IS NULL"
        ).fetchall()
    projects = []
    for row in rows:
        for p in json.loads(row["row_json"]):
            projects.append(
                dict(
                    p,
                    key=f"{row['name']}:{p['key']}",
                    profile=f"{row['name']}:{p.get('profile', 'default')}",
                )
            )
    return projects


def ingest(
    db_path: str,
    satellite_id: str,
    payload: dict[str, Any],
    now: float | None = None,
) -> dict[str, int]:
    ensure_tables(db_path)
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    chats_raw = payload.get("chats")
    full = payload.get("full")
    version = payload.get("version")
    if not isinstance(chats_raw, list):
        raise ValueError("chats must be a list")
    if not isinstance(full, bool):
        raise ValueError("full must be boolean")
    if not isinstance(version, str):
        raise ValueError("version must be string")
    if len(chats_raw) > MAX_CHATS_PER_PUSH:
        raise ValueError("too many chats")

    sat = _satellite_row(db_path, satellite_id)
    if not sat or sat["revoked_at"] is not None:
        raise ValueError("unknown satellite")

    validated: list[dict[str, Any]] = []
    for i, row in enumerate(chats_raw):
        validated.append(_validate_chat_row(row, i))

    catalog = payload.get("projects")
    if catalog is not None:
        if not isinstance(catalog, list) or len(catalog) > 2000:
            raise ValueError("invalid projects catalog")
        catalog = [
            dict(_validate_project(p), profile=p.get("profile", "default"))
            for p in catalog
            if p is not None
        ]
    ts = now if now is not None else time.time()
    sat_name = str(sat["name"])
    accepted = len(validated)
    changed = 0
    seen_ids: set[str] = set()

    dirty_keys: list[str] = []
    with _connect(db_path) as conn:
        if catalog is not None:
            conn.execute(
                "INSERT INTO satellite_project_catalog VALUES(?,?) ON CONFLICT(satellite_id) DO UPDATE SET row_json=excluded.row_json",
                (satellite_id, json.dumps(catalog)),
            )
        for row in validated:
            cid = row["id"]
            seen_ids.add(cid)
            prev = conn.execute(
                """
                SELECT row_json FROM satellite_chats
                WHERE satellite_id = ? AND chat_id = ?
                """,
                (satellite_id, cid),
            ).fetchone()
            prev_msg = None
            if prev:
                try:
                    prev_msg = json.loads(prev["row_json"]).get("last_msg_id")
                except (json.JSONDecodeError, TypeError, AttributeError):
                    prev_msg = None
            row_json = json.dumps(row)
            conn.execute(
                """
                INSERT INTO satellite_chats (satellite_id, chat_id, row_json, received_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(satellite_id, chat_id) DO UPDATE SET
                    row_json = excluded.row_json,
                    received_at = excluded.received_at
                """,
                (satellite_id, cid, row_json, ts),
            )
            if str(prev_msg) != str(row["last_msg_id"]):
                dirty_keys.append(_chat_key(sat_name, cid))
                changed += 1
        if full:
            if seen_ids:
                placeholders = ",".join("?" * len(seen_ids))
                conn.execute(
                    f"""
                    DELETE FROM satellite_chats
                    WHERE satellite_id = ? AND chat_id NOT IN ({placeholders})
                    """,
                    (satellite_id, *seen_ids),
                )
            else:
                conn.execute(
                    "DELETE FROM satellite_chats WHERE satellite_id = ?",
                    (satellite_id,),
                )
        # Bound only this satellite; retain the most recently active chats.
        conn.execute(
            """DELETE FROM satellite_chats WHERE satellite_id = ? AND chat_id IN (
                SELECT chat_id FROM satellite_chats WHERE satellite_id = ?
                ORDER BY json_extract(row_json, '$.last_active') DESC, chat_id
                LIMIT -1 OFFSET ?)""",
            (satellite_id, satellite_id, MAX_SATELLITE_CHATS),
        )
        conn.execute(
            """
            UPDATE satellites
            SET last_seen = ?, last_push_count = ?
            WHERE id = ?
            """,
            (ts, accepted, satellite_id),
        )
        conn.commit()

    if dirty_keys:
        store = Store(db_path)
        try:
            for chat_key in dirty_keys:
                store.mark_dirty(chat_key, now=ts)
        finally:
            store.close()

    return {"accepted": accepted, "changed": changed}


def list_satellites(db_path: str) -> list[dict[str, Any]]:
    ensure_tables(db_path)
    with _connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT id, name, agent_name, connections, desktop_profile,
                   created_at, last_seen, last_push_count, revoked_at
            FROM satellites ORDER BY created_at
            """
        ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        try:
            conns = json.loads(r["connections"] or "[]")
        except json.JSONDecodeError:
            conns = []
        out.append(
            {
                "id": r["id"],
                "name": r["name"],
                "agent_name": r["agent_name"],
                "connections": conns,
                "desktop_profile": r["desktop_profile"],
                "created_at": r["created_at"],
                "last_seen": r["last_seen"],
                "last_push_count": r["last_push_count"],
                "revoked_at": r["revoked_at"],
            }
        )
    return out


def revoke(db_path: str, satellite_id: str, now: float | None = None) -> None:
    ensure_tables(db_path)
    ts = now if now is not None else time.time()
    with _connect(db_path) as conn:
        cur = conn.execute(
            "UPDATE satellites SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
            (ts, satellite_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise ValueError("satellite not found")


def active_satellite_name_set(db_path: str) -> set[str]:
    return _active_satellite_names(db_path)


def satellite_profile_display_map(db_path: str, cfg: Config) -> dict[str, str]:
    ensure_tables(db_path)
    out: dict[str, str] = {}
    for sat in list_satellites(db_path):
        if sat["revoked_at"] is not None:
            continue
        name = str(sat["name"])
        out[name] = sat.get("agent_name") or profile_display_name(name, cfg.agent_names)
    return out


def _satellite_offline(last_seen: Any, ts: float) -> bool:
    if not isinstance(last_seen, (int, float)):
        return False
    return ts - float(last_seen) > SATELLITE_OFFLINE_SECONDS


def satellite_offline_notes(db_path: str, now: float | None = None) -> list[str]:
    """Scan notes for paired satellites that have gone quiet too long.

    Same shape as collect.run_remote notes so the panel shows one warning style.
    """
    ensure_tables(db_path)
    ts = now if now is not None else time.time()
    notes: list[str] = []
    for sat in list_satellites(db_path):
        if sat["revoked_at"] is not None or not _satellite_offline(
            sat["last_seen"], ts
        ):
            continue
        name = str(sat["name"])
        when = time.strftime("%b %d %I:%M %p", time.localtime(float(sat["last_seen"])))
        notes.append(
            f"{name} unreachable (no update from its satellite); "
            f"using {name} list cached {when}"
        )
    return notes


def satellite_chats_for_collect(
    db_path: str,
    cfg: Config,
    now: float | None = None,
) -> list[dict[str, Any]]:
    ensure_tables(db_path)
    ts = now if now is not None else time.time()
    since = ts - cfg.days * 86400
    out: list[dict[str, Any]] = []
    with _connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT s.name, s.agent_name, s.last_seen, c.chat_id, c.row_json, c.received_at
            FROM satellite_chats c
            JOIN satellites s ON s.id = c.satellite_id
            WHERE s.revoked_at IS NULL
            """
        ).fetchall()
    for r in rows:
        try:
            row = json.loads(r["row_json"])
        except json.JSONDecodeError:
            continue
        title = row.get("title") or ""
        if any(title.startswith(p) for p in cfg.skip_title_prefixes):
            continue
        if any(s in title for s in cfg.skip_title_contains):
            continue
        last_active = row.get("last_active")
        if not isinstance(last_active, (int, float)) or float(last_active) <= since:
            continue
        name = str(r["name"])
        display = str(r["agent_name"]) or profile_display_name(name, cfg.agent_names)
        if row.get("project"):
            row["project"] = dict(row["project"], key=f"{name}:{row['project']['key']}")
        row["profile"] = f"{name}:{row.get('profile', 'default')}"
        item = {
            **row,
            "agent": display,
            "key": _chat_key(name, str(r["chat_id"])),
        }
        if _satellite_offline(r["last_seen"], ts):
            item["stale"] = True
        out.append(item)
    out.sort(key=lambda c: float(c.get("last_active", 0)), reverse=True)
    return out


def satellite_by_name(db_path: str, lname: str) -> dict[str, Any] | None:
    """Active satellite metadata for chat_targets (not revoked)."""
    with _connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT id, name, connections, desktop_profile
            FROM satellites
            WHERE lower(name) = ? AND revoked_at IS NULL
            """,
            (lname.lower(),),
        ).fetchone()
    if not row:
        return None
    try:
        conns = json.loads(row["connections"] or "[]")
    except json.JSONDecodeError:
        conns = []
    return {
        "id": row["id"],
        "name": row["name"],
        "connections": conns,
        "desktop_profile": row["desktop_profile"],
    }
