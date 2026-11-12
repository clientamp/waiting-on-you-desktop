"""Read-only chat collection from Hermes state.db files (local and optional SSH)."""

from __future__ import annotations

import copy
import json
import os
import shlex
import sqlite3
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

MAX_REMOTE_STDOUT_BYTES = 8 * 1024 * 1024
MAX_REMOTE_PROJECTS = 2000
MAX_READ_CACHE_DBS = 4
MAX_READ_CACHE_ROWS = 2000

# Mirror gateway.session_policy; this reader also runs without Hermes installed.
SURFACE_GROUPS = {
    "cli": frozenset({"cli"}),
    "tui": frozenset({"tui"}),
    "gui": frozenset({"gui", "desktop"}),
    "desktop": frozenset({"gui", "desktop"}),
    "acp": frozenset({"acp"}),
}


# Snapshot of hermes_state_local_migration.not_client_labels(), plus mobile clients.
KNOWN_HERMES_LABELS = frozenset({
    "a2a", "a2a-platform", "acp", "api_server", "batch", "bluebubbles",
    "bluebubbles-platform", "bot_room", "buzz", "buzz-platform", "cli", "cron",
    "curator", "desktop", "dingtalk", "dingtalk-platform", "discord", "discord-platform",
    "email", "email-platform", "feishu", "feishu-platform", "google_chat",
    "google_chat-platform", "gui", "homeassistant", "import", "irc", "irc-platform",
    "kanban", "line", "line-platform", "local", "matrix", "matrix-platform",
    "mattermost", "mattermost-platform", "msgraph_webhook", "ntfy", "ntfy-platform",
    "oneshot", "photon", "photon-platform", "qqbot", "qqbot-platform", "raft",
    "raft-platform", "recovered", "relay", "signal", "signal-platform", "simplex",
    "simplex-platform", "slack", "slack-platform", "sms", "sms-platform", "subagent",
    "teams", "teams-platform", "telegram", "telegram-platform", "tool", "tui",
    "unknown", "webhook", "webui", "wecom", "wecom-platform", "wecom_callback",
    "weixin", "weixin-platform", "whatsapp", "whatsapp-platform", "whatsapp_cloud",
    "whatsapp_cloud-platform", "yuanbao", "yuanbao-platform", "mobile", "push",
})


def _source_groups(sources: list[str]) -> set[str]:
    return {label for source in sources for label in SURFACE_GROUPS.get(source, ())}


def source_clause(sources: list[str], has_created_source: bool) -> tuple[str, list[str]]:
    """Build a bound surface filter, keeping the source index usable."""
    created = sorted(_source_groups(sources))
    live = set(sources) | set(created)
    if created and has_created_source:
        live.add("local")
    labels = sorted(live)
    clause = "source in (" + ",".join("?" for _ in labels) + ")"
    params = labels[:]
    if created and has_created_source and "local" not in sources:
        clause += " and (source != ? or created_source in (" + ",".join("?" for _ in created) + "))"
        params.extend(["local", *created])
    return "(" + clause + ")", params


def _default_sources() -> list[str]:
    return ["desktop", "tui", "webui"]


def _default_skip_prefixes() -> list[str]:
    return ["Subagent:"]


def clip(s: str | None, n: int) -> str:
    s = " ".join((s or "").split())
    return s if len(s) <= n else "…" + s[-n:]


def hermes_home_from_env() -> Path:
    # A secondary profile hosting the root install must scan the hub's homes.
    # Otherwise that profile's state.db is labeled "default" and written into
    # the shared task list. Standalone `python3 -` readers have
    # neither import, so a missing hub just means HERMES_HOME / ~/.hermes.
    hub_fn = None
    try:
        from wou.paths import hub_hermes_home as hub_fn
    except ImportError:
        try:
            from .paths import hub_hermes_home as hub_fn
        except ImportError:
            hub_fn = None
    hub = hub_fn() if hub_fn is not None else None
    if hub is not None:
        return hub
    return Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")).expanduser()


def discover_local_profiles(hermes_home: Path) -> list[dict[str, str]]:
    profiles: list[dict[str, str]] = [
        {"name": "default", "state_db": str(hermes_home / "state.db")},
    ]
    profiles_dir = hermes_home / "profiles"
    if profiles_dir.is_dir():
        for child in sorted(profiles_dir.iterdir()):
            # Skip hidden folders such as .deleted (removed profiles).
            if child.is_dir() and not child.name.startswith("."):
                profiles.append(
                    {"name": child.name, "state_db": str(child / "state.db")}
                )
    return profiles


@dataclass
class Config:
    days: int = 10
    sources: list[str] = field(default_factory=_default_sources)
    skip_title_prefixes: list[str] = field(default_factory=_default_skip_prefixes)
    skip_title_contains: list[str] = field(default_factory=list)
    local_profiles: list[dict[str, str]] = field(default_factory=list)
    remote_hosts: list[dict[str, str]] = field(default_factory=list)
    agent_names: dict[str, str] = field(default_factory=dict)
    tail_chars: int = 900
    user_chars: int = 300
    hermes_home: Path = field(default_factory=hermes_home_from_env)
    # Per-scan evidence, never persisted or sent as collection configuration.
    successful_sources: set[str] = field(default_factory=set)
    collection_activity: dict[str, float] = field(default_factory=dict)
    read_cache: Any = None

    @classmethod
    def from_dict(
        cls, data: dict[str, Any] | None = None, hermes_home: Path | None = None
    ) -> Config:
        data = data or {}
        home = Path(hermes_home or data.get("hermes_home") or hermes_home_from_env())
        home = home.expanduser()
        cfg = cls(
            days=int(data.get("days", 10)),
            sources=list(data.get("sources", _default_sources())),
            skip_title_prefixes=list(
                data.get("skip_title_prefixes", _default_skip_prefixes())
            ),
            skip_title_contains=list(data.get("skip_title_contains", [])),
            remote_hosts=list(data.get("remote_hosts", [])),
            agent_names=dict(data.get("agent_names", {})),
            tail_chars=int(data.get("tail_chars", 900)),
            user_chars=int(data.get("user_chars", 300)),
            hermes_home=home,
        )
        if "local_profiles" in data:
            cfg.local_profiles = list(data["local_profiles"])
        else:
            cfg.local_profiles = discover_local_profiles(home)
        return cfg

    def to_json_dict(self) -> dict[str, Any]:
        return {
            "days": self.days,
            "sources": self.sources,
            "skip_title_prefixes": self.skip_title_prefixes,
            "skip_title_contains": self.skip_title_contains,
            "tail_chars": self.tail_chars,
            "user_chars": self.user_chars,
        }


def collection_config(config: dict[str, Any]) -> Config:
    """Build the scanner's collection config, also used to resolve chat owners."""
    data = config.get("collect")
    return Config.from_dict(data if isinstance(data, dict) else {})


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    try:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    except sqlite3.Error:
        return set()
    return {r[1] for r in rows}


def profile_display_map(
    cfg: Config, data_dir: str | Path | None = None
) -> dict[str, str]:
    out: dict[str, str] = {}
    for profile in cfg.local_profiles:
        out[profile["name"]] = profile_display_name(profile["name"], cfg.agent_names)
    for host in cfg.remote_hosts:
        out[host["name"]] = profile_display_name(host["name"], cfg.agent_names)
    return out


def profile_display_name(name: str, agent_names: dict[str, str] | None = None) -> str:
    """Map a profile or remote host name to the agent label shown on tasks."""
    names = agent_names or {}
    for key, display in names.items():
        if key.lower() == name.lower():
            return display
    if name.lower() == "default":
        return "Main"
    return name.capitalize()


def _collect_config_signature(cfg: Config) -> tuple[Any, ...]:
    return (
        int(cfg.days),
        tuple(cfg.sources),
        tuple(cfg.skip_title_prefixes),
        tuple(cfg.skip_title_contains),
        int(cfg.tail_chars),
        int(cfg.user_chars),
    )


def _db_file_identity(path: Path) -> tuple[int, int] | None:
    try:
        st = path.stat()
    except OSError:
        return None
    return (st.st_dev, st.st_ino)


def _open_readonly_db(path: Path, *, timeout: float = 10) -> sqlite3.Connection | None:
    try:
        conn = sqlite3.connect(
            path.as_uri() + "?mode=ro",
            uri=True,
            timeout=timeout,
            check_same_thread=False,
        )
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error:
        return None


def _sqlite_versions(conn: sqlite3.Connection) -> tuple[int, int] | None:
    try:
        schema = int(conn.execute("PRAGMA schema_version").fetchone()[0])
        data = int(conn.execute("PRAGMA data_version").fetchone()[0])
        return schema, data
    except sqlite3.Error:
        return None


def _probe_db_readable(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute("PRAGMA schema_version").fetchone()
        return True
    except sqlite3.Error:
        return False


def _collect_db_from_conn(
    conn: sqlite3.Connection, cfg: Config, now: float | None = None
) -> list[dict]:
    sess_cols = _table_columns(conn, "sessions")
    msg_cols = _table_columns(conn, "messages")
    required_sess = {"id", "source", "title", "started_at"}
    if not required_sess.issubset(sess_cols):
        return []
    if not {"id", "role", "content", "session_id"}.issubset(msg_cols):
        return []

    now_ts = now if now is not None else time.time()
    since = now_ts - cfg.days * 86400

    if "last_activity_at" in sess_cols:
        la_expr = "coalesce(last_activity_at, started_at)"
    else:
        la_expr = "started_at"

    wheres = ["parent_session_id is null"]
    params: list[Any] = []

    if "archived" in sess_cols:
        wheres.append("archived=0")
    if "hidden" in sess_cols:
        wheres.append("hidden=0")

    source_filter, source_params = source_clause(cfg.sources, "created_source" in sess_cols)
    wheres.append(source_filter)
    params.extend(source_params)

    wheres.append(f"{la_expr} > ?")
    params.append(since)

    sql = (
        f"select id, source, title, {la_expr} as la, "
        + ("cwd " if "cwd" in sess_cols else "NULL AS cwd ")
        + f"from sessions where {' and '.join(wheres)} order by la desc"
    )
    try:
        rows = conn.execute(sql, params).fetchall()
    except sqlite3.Error:
        return []

    msg_wheres = [
        "session_id=?",
        "role in ('user','assistant')",
        "content is not null",
        "trim(content)!=''",
    ]
    if "active" in msg_cols:
        msg_wheres.insert(1, "active=1")

    # Trim trailing whitespace before bounding the tail so it cannot crowd
    # out the message. Leave room for normalization and the Python tail clip.
    msg_fields = (
        "id, role, substr(rtrim(content, char(32,9,10,13,11,12)), -(CASE WHEN role='user' THEN "
        f"{4 * max(0, int(cfg.user_chars)) + 256} ELSE {4 * max(0, int(cfg.tail_chars)) + 256} END)) AS content"
    )
    if "timestamp" in msg_cols:
        msg_fields += ", timestamp"
    msg_sql = (
        f"select {msg_fields} from messages where "
        + " and ".join(msg_wheres)
        + " order by id desc limit 12"
    )

    out: list[dict] = []
    for r in rows:
        title = r["title"] or ""
        if any(title.startswith(p) for p in cfg.skip_title_prefixes):
            continue
        if any(s in title for s in cfg.skip_title_contains):
            continue
        try:
            msgs = conn.execute(msg_sql, (r["id"],)).fetchall()
        except sqlite3.Error:
            continue
        if not msgs:
            continue
        lu = next((m for m in msgs if m["role"] == "user"), None)
        la = next((m for m in msgs if m["role"] == "assistant"), None)
        last_msg_at: float | None = None
        if "timestamp" in msg_cols:
            raw_ts = msgs[0]["timestamp"]
            if raw_ts is not None:
                try:
                    last_msg_at = float(raw_ts)
                except (TypeError, ValueError):
                    last_msg_at = None
        out.append(
            {
                "id": r["id"],
                "cwd": r["cwd"] or "",
                "source": r["source"],
                "title": title or "(untitled)",
                "last_active": r["la"],
                "last_msg_id": msgs[0]["id"],
                "last_role": msgs[0]["role"],
                "last_msg_at": last_msg_at,
                "user_last": clip(lu["content"], cfg.user_chars) if lu else "",
                "agent_last": clip(la["content"], cfg.tail_chars) if la else "",
            }
        )
    return out


def _filter_rows_for_now(rows: list[dict], cfg: Config, now: float) -> list[dict]:
    since = now - cfg.days * 86400
    return [r for r in rows if float(r["last_active"]) > since]


@dataclass
class _ReadCacheEntry:
    conn: sqlite3.Connection
    identity: tuple[int, int]
    config_sig: tuple[Any, ...]
    schema_version: int
    data_version: int
    cached_now: float
    rows: list[dict] | None


class CollectionReadCache:
    """Caller-owned, bounded read cache over retained read-only state.db connections."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._entries: dict[str, _ReadCacheEntry] = {}
        self._order: list[str] = []

    def clear(self) -> None:
        with self._lock:
            for entry in self._entries.values():
                try:
                    entry.conn.close()
                except sqlite3.Error:
                    pass
            self._entries.clear()
            self._order.clear()

    def close(self) -> None:
        self.clear()

    def _close_entry(self, key: str) -> None:
        entry = self._entries.pop(key, None)
        if entry is not None:
            try:
                entry.conn.close()
            except sqlite3.Error:
                pass
        if key in self._order:
            self._order.remove(key)

    def _touch(self, key: str) -> None:
        if key in self._order:
            self._order.remove(key)
        self._order.append(key)

    def _evict_if_needed(self) -> None:
        while len(self._entries) > MAX_READ_CACHE_DBS:
            if not self._order:
                break
            oldest = self._order.pop(0)
            entry = self._entries.pop(oldest, None)
            if entry is not None:
                try:
                    entry.conn.close()
                except sqlite3.Error:
                    pass

    def _reload(
        self,
        key: str,
        db: Path,
        cfg: Config,
        now_ts: float,
        conn: sqlite3.Connection | None = None,
    ) -> list[dict]:
        identity_before = _db_file_identity(db)
        if identity_before is None:
            if conn is not None:
                self._close_entry(key)
            return []
        own_conn = conn is None
        if conn is None:
            conn = _open_readonly_db(db, timeout=0.1)
            if conn is None:
                return []
        before = _sqlite_versions(conn)
        if before is None:
            if own_conn:
                conn.close()
            else:
                self._close_entry(key)
            return []
        rows = _collect_db_from_conn(conn, cfg, now=now_ts)
        after = _sqlite_versions(conn)
        identity_after = _db_file_identity(db)
        if (
            after is None
            or after != before
            or identity_after is None
            or identity_after != identity_before
        ):
            if own_conn:
                conn.close()
            else:
                self._close_entry(key)
            return copy.deepcopy(rows)
        stored_rows = copy.deepcopy(rows) if len(rows) <= MAX_READ_CACHE_ROWS else None
        identity = identity_after
        entry = _ReadCacheEntry(
            conn=conn,
            identity=identity,
            config_sig=_collect_config_signature(cfg),
            schema_version=after[0],
            data_version=after[1],
            cached_now=now_ts,
            rows=stored_rows,
        )
        prev = self._entries.get(key)
        if prev is not None and prev.conn is not conn:
            try:
                prev.conn.close()
            except sqlite3.Error:
                pass
        self._entries[key] = entry
        self._touch(key)
        self._evict_if_needed()
        return copy.deepcopy(rows)

    def collect(self, path: str | Path, cfg: Config, now: float | None = None) -> list[dict]:
        db = Path(path).expanduser().resolve()
        now_ts = now if now is not None else time.time()
        key = str(db)
        if not db.is_file():
            with self._lock:
                self._close_entry(key)
            return []
        identity = _db_file_identity(db)
        if identity is None:
            with self._lock:
                self._close_entry(key)
            return []

        with self._lock:
            config_sig = _collect_config_signature(cfg)
            entry = self._entries.get(key)

            if entry is not None:
                if entry.identity != identity or entry.config_sig != config_sig:
                    self._close_entry(key)
                    entry = None
                elif now_ts < entry.cached_now:
                    self._close_entry(key)
                    entry = None

            if entry is not None:
                if not _probe_db_readable(entry.conn):
                    self._close_entry(key)
                    return []
                versions = _sqlite_versions(entry.conn)
                if versions is None:
                    self._close_entry(key)
                    return []
                if versions != (entry.schema_version, entry.data_version):
                    return self._reload(key, db, cfg, now_ts, conn=entry.conn)
                if entry.rows is None:
                    return self._reload(key, db, cfg, now_ts, conn=entry.conn)
                filtered = _filter_rows_for_now(entry.rows, cfg, now_ts)
                entry.cached_now = now_ts
                if len(filtered) <= MAX_READ_CACHE_ROWS:
                    entry.rows = copy.deepcopy(filtered)
                self._touch(key)
                return copy.deepcopy(filtered)

            return self._reload(key, db, cfg, now_ts)


def collect_db(path: str | Path, cfg: Config, now: float | None = None) -> list[dict]:
    """Return chat dicts from one state.db, newest session order (not final sort)."""
    db = Path(path).expanduser()
    if not db.is_file():
        return []
    cache = cfg.read_cache
    if isinstance(cache, CollectionReadCache):
        return cache.collect(path, cfg, now=now)
    try:
        conn = _open_readonly_db(Path(db).expanduser().resolve())
        if conn is None:
            return []
        try:
            return _collect_db_from_conn(conn, cfg, now=now)
        finally:
            conn.close()
    except sqlite3.Error:
        return []


def source_label_drift(path: str | Path, cfg: Config, now: float | None = None) -> dict[str, int]:
    """Count unread surface labels using session metadata only."""
    created = sorted(_source_groups(cfg.sources))
    if not created:
        return {}
    db = Path(path).expanduser().resolve()
    conn = sqlite3.connect(db.as_uri() + "?mode=ro", uri=True, timeout=10)
    try:
        columns = _table_columns(conn, "sessions")
        if "created_source" not in columns:
            return {}
        expr = "coalesce(last_activity_at, started_at)" if "last_activity_at" in columns else "started_at"
        clause, params = source_clause(cfg.sources, True)
        wheres = ["parent_session_id is null", f"{expr} > ?",
                  "created_source in (" + ",".join("?" for _ in created) + ")",
                  f"not coalesce({clause}, 0)"]
        for flag in ("archived", "hidden"):
            if flag in columns:
                wheres.append(f"{flag}=0")
        since = (now if now is not None else time.time()) - cfg.days * 86400
        counts = conn.execute(
            "select source, count(*) from sessions where " + " and ".join(wheres) + " group by source",
            [since, *created, *params],
        )
        return {label: count for label, count in counts
                if label not in KNOWN_HERMES_LABELS
                and not (isinstance(label, str) and label.endswith("-platform"))}
    finally:
        conn.close()


def _source_drift_note(profile: str, counts: dict[str, int]) -> str:
    # Keep labels safe and the update advice visible in the panel's 200-char limit.
    labels = []
    for label in counts:
        safe = "".join(c for c in str(label or "unknown") if c.isascii() and (c.isalnum() or c in "_.-"))[:32]
        labels.append(safe or "unknown")
    count = sum(counts.values())
    noun = "chat uses" if count == 1 else "chats use"
    label = sorted(labels)[0]
    extra = " and others" if len(labels) > 1 else ""
    return (f'{profile[:32]}: {count} recent {noun} storage label "{label}"{extra}, '
            "which this version cannot read. Update the plugin.")[:200]


def collect_activity(path: str | Path) -> dict[str, float]:
    """Read activity metadata independently of discovery lookback; fail explicitly.

    No message content is read. Missing/deleted sessions are not completion
    evidence: only a known timestamp from a successful source can expire a task.
    """
    db = Path(path).expanduser().resolve()
    if not db.is_file():
        raise OSError("state.db missing")
    conn = sqlite3.connect(db.as_uri() + "?mode=ro", uri=True, timeout=10)
    try:
        columns = _table_columns(conn, "sessions")
        if not {"id", "source", "title", "started_at", "parent_session_id"}.issubset(columns):
            raise ValueError("sessions schema unavailable")
        if not {"id", "role", "content", "session_id"}.issubset(_table_columns(conn, "messages")):
            raise ValueError("messages schema unavailable")
        expr = "coalesce(last_activity_at, started_at)" if "last_activity_at" in columns else "started_at"
        return {str(sid): float(ts) for sid, ts in conn.execute(f"SELECT id, {expr} FROM sessions") if ts is not None}
    finally:
        conn.close()


def _record_source_activity(cfg: Config, name: str, activity: dict[str, float]) -> None:
    normalized = { _chat_key(name, sid): float(ts) for sid, ts in activity.items() }
    cfg.collection_activity.update(normalized)
    cfg.successful_sources.add(name.casefold())


def _chat_key(profile_name: str, chat_id: str) -> str:
    if profile_name == "default":
        return chat_id
    return f"{profile_name.lower()}:{chat_id}"


def _remote_path_arg(path: str) -> str:
    """Quote a remote path for a POSIX shell, leaving a leading ~/ expandable."""
    if path.startswith("~/"):
        return "~/" + shlex.quote(path[2:])
    return shlex.quote(path)


def _validated_remote_rows(rows):
    # Both ingress paths use the same finite activity and field bounds.
    from .chat_rows import _validate_chat_row
    if not isinstance(rows, list):
        raise ValueError("invalid remote chats")
    valid, invalid = [], 0
    for i, row in enumerate(rows):
        try:
            checked = _validate_chat_row(row, i)
            # Keep timestamp metadata used for due dates, not arbitrary fields.
            if isinstance(row.get("last_msg_at"), (int, float)):
                import math
                if not isinstance(row["last_msg_at"], bool) and math.isfinite(row["last_msg_at"]):
                    checked["last_msg_at"] = row["last_msg_at"]
            valid.append(checked)
        except ValueError:
            invalid += 1
    return valid, invalid


def _validated_remote_projects(projects):
    from .chat_rows import _validate_project
    if not isinstance(projects, list) or len(projects) > MAX_REMOTE_PROJECTS:
        raise ValueError("invalid remote projects catalog")
    return [dict(_validate_project(p), profile=p.get("profile") or "default")
            for p in projects if p is not None]


def run_remote(
    host: dict[str, str], cfg: Config, cache_dir: str | Path
) -> tuple[list[dict], str | None]:
    """Fetch chats from a remote host via ssh; cache on success; fallback on failure."""
    name = host["name"]
    cache_path = Path(cache_dir) / f"{name}.json"
    module_src = Path(__file__).read_text()
    # SSH runs this reader on stdin, without the installed package. Bundle the
    # same read-only catalog helper alongside it (no private imports).
    projects_src = Path(__file__).with_name("hermes_projects.py").read_text()
    module_src = module_src.replace(
        "from __future__ import annotations",
        "from __future__ import annotations\n"
        + projects_src.replace("from __future__ import annotations", "")
        + "\n_standalone_project_for_cwd = project_for_cwd\n",
        1,
    )
    config_json = json.dumps(
        dict(cfg.to_json_dict(), project_profile=name, include_project_catalog=True)
    )
    cmd = [
        "ssh",
        "-o",
        "ConnectTimeout=8",
        "-o",
        "BatchMode=yes",
        "--",
        host["ssh_host"],
        # ssh hands the remote command to a shell, so every argument is quoted.
        # state_db keeps a leading ~ unquoted so the remote shell expands it.
        " ".join(
            [
                "python3",
                "-",
                "--emit-json",
                "--db",
                _remote_path_arg(host["state_db"]),
                "--config-json",
                shlex.quote(config_json),
            ]
        ),
    ]
    from .child_env import child_env

    err: list[str] = []
    try:
        proc = subprocess.run(
            cmd,
            env=child_env(ssh=True),
            input=module_src,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if len(proc.stdout.encode("utf-8")) > MAX_REMOTE_STDOUT_BYTES:
            raise ValueError("remote output too large")
        if proc.returncode == 0 and proc.stdout.strip().startswith(("[", "{")):
            decoded = json.loads(proc.stdout)
            data = decoded["chats"] if isinstance(decoded, dict) else decoded
            projects = decoded.get("projects", []) if isinstance(decoded, dict) else []
            data, invalid = _validated_remote_rows(data)
            projects = _validated_remote_projects(projects)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {"at": time.time(), "chats": data, "projects": projects}
            cache_path.write_text(json.dumps(payload))
            os.chmod(cache_path, 0o600)
            if isinstance(decoded, dict) and isinstance(decoded.get("activity"), dict):
                _record_source_activity(cfg, name, decoded["activity"])
            return data, f"{name}: dropped {invalid} invalid chat rows" if invalid else None
        err = (proc.stderr or "no output").strip().splitlines()[-1:]
    except Exception as e:  # noqa: BLE001 — never raise to caller
        err = [str(e)]

    if cache_path.is_file():
        try:
            cached = json.loads(cache_path.read_text())
            when = time.strftime("%b %d %I:%M %p", time.localtime(cached["at"]))
            note = (
                f"{name} unreachable ({' '.join(err)}); using {name} list cached {when}"
            )
            # Copies only: the cache file stays as it was written.
            rows = []
            valid_rows, _ = _validated_remote_rows(cached.get("chats", []))
            for row in valid_rows:
                if isinstance(row, dict):
                    copied = dict(row)
                    copied["stale"] = True
                    rows.append(copied)
                else:
                    rows.append(row)
            return rows, note
        except (json.JSONDecodeError, KeyError, OSError):
            pass
    return [], f"{name} unreachable ({' '.join(err)}); no {name} cache yet"


def collect_all(
    cfg: Config,
    cache_dir: str | Path,
    now: float | None = None,
    data_dir: str | Path | None = None,
) -> tuple[list[dict], list[str]]:
    chats: list[dict] = []
    notes: list[str] = []
    cfg.successful_sources.clear()
    cfg.collection_activity.clear()

    for profile in cfg.local_profiles:
        pname = profile["name"]
        try:
            source_activity = collect_activity(profile["state_db"])
            rows = collect_db(profile["state_db"], cfg, now=now)
        except (OSError, sqlite3.Error, ValueError) as exc:
            notes.append(f"{pname} unreachable ({exc}); no {pname} cache yet")
            continue
        _record_source_activity(cfg, pname, source_activity)
        try:
            drift = source_label_drift(profile["state_db"], cfg, now=now)
            if drift:
                notes.append(_source_drift_note(pname, drift))
        except Exception:  # Advisory only; a failed guard must not stop collection.
            pass
        display = profile_display_name(pname, cfg.agent_names)
        from .hermes_projects import project_for_cwd

        for row in rows:
            row["profile"] = pname
            row["project"] = project_for_cwd(
                Path(profile["state_db"]).expanduser().parent / "projects.db",
                row.get("cwd"),
                pname,
            )
            chats.append(
                {
                    **row,
                    "agent": display,
                    "key": _chat_key(pname, row["id"]),
                }
            )

    for host in cfg.remote_hosts:
        rows, note = run_remote(host, cfg, cache_dir)
        if note:
            notes.append(note)
        display = profile_display_name(host["name"], cfg.agent_names)
        for row in rows:
            chats.append(
                {
                    **row,
                    "agent": display,
                    "key": _chat_key(host["name"], row["id"]),
                }
            )

    chats.sort(key=lambda c: c["last_active"], reverse=True)
    return chats, notes


def change_signature(chats: list[dict]) -> str:
    lines: list[str] = []
    for c in sorted(chats, key=lambda x: x["key"]):
        flag = "D" if c["last_role"] == "user" else "A"
        lines.append(f"{c['key']}|{c['last_msg_id']}|{flag}")
    return "\n".join(lines)


def _main_emit_json(db_path: str, config_json: str | None) -> None:
    data = json.loads(config_json) if config_json else {}
    cfg = Config.from_dict(data)
    resolver = globals().get("_standalone_project_for_cwd")
    if resolver is None:
        try:
            from .hermes_projects import project_for_cwd as resolver
        except ImportError:
            resolver = lambda *_args: None
    profile = data.get("project_profile", "default")
    rows = collect_db(db_path, cfg)
    for row in rows:
        row["profile"] = profile
        row["project"] = resolver(
            Path(db_path).expanduser().parent / "projects.db", row.get("cwd"), profile
        )
    if data.get("include_project_catalog"):
        catalog = globals().get("list_projects")
        if catalog is None:
            from .hermes_projects import list_projects as catalog
        print(
            json.dumps(
                dict(
                    chats=rows,
                    activity=collect_activity(db_path),
                    projects=catalog(
                        Path(db_path).expanduser().parent / "projects.db", profile
                    ),
                )
            )
        )
    else:
        print(json.dumps(rows))


def main(argv: list[str] | None = None) -> None:
    args = argv if argv is not None else sys.argv[1:]
    if "--emit-json" in args:
        db = args[args.index("--db") + 1]
        config_json = None
        if "--config-json" in args:
            config_json = args[args.index("--config-json") + 1]
        _main_emit_json(db, config_json)
        return
    cfg = Config.from_dict()
    chats, notes = collect_all(
        cfg, Path(cfg.hermes_home) / "state" / "wou_remote_cache"
    )
    for n in notes:
        print(f"NOTE: {n}", file=sys.stderr)
    print(change_signature(chats))


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        pass
