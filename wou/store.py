"""SQLite-backed task store for Waiting On You."""

from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import stat
import time
from collections import Counter
from pathlib import Path
from typing import Any, Callable, Optional

_VALID_TASK_STATUSES = frozenset({"open", "done", "dismissed", "snoozed", "resolved", "expired"})
_VALID_CLOSE_STATUSES = frozenset({"done", "dismissed"})

_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_TASK_SELECT = (
    "tasks.*, chat_groups.project_json AS hermes_project_json, "
    "CASE WHEN chat_groups.title_locked = 1 THEN chat_groups.title ELSE NULL END AS chat_name"
)
_TASK_FROM = "FROM tasks LEFT JOIN chat_groups ON chat_groups.chat_key = tasks.chat_key"
_SPACE_RE = re.compile(r"\s+")
_ACTION_ID_RE = re.compile(r"^[a-z0-9_-]{1,32}$")
_VALID_ACTION_STYLES = frozenset({"primary", "default", "danger"})
_VALID_ACTION_KINDS = frozenset({"run", "details"})
_ACTION_KNOWN_KEYS = frozenset({"id", "label", "confirm", "style", "kind"})


def _discard_partial_backup(path: str) -> None:
    """Remove a backup that never finished, including SQLite sidecars."""
    parent = os.path.dirname(path) or "."
    prefix = os.path.basename(path)
    try:
        names = os.listdir(parent)
    except OSError:
        return
    for name in names:
        if name == prefix or name.startswith(prefix + "-"):
            try:
                os.unlink(os.path.join(parent, name))
            except OSError:
                pass


def validate_actions(actions: list) -> list[dict[str, Any]]:
    if not isinstance(actions, list):
        raise ValueError("actions must be a list")
    if len(actions) > 4:
        raise ValueError("at most 4 actions allowed")
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for raw in actions:
        if not isinstance(raw, dict):
            raise ValueError("each action must be an object")
        item = {k: raw[k] for k in raw if k in _ACTION_KNOWN_KEYS}
        action_id = item.get("id")
        if not isinstance(action_id, str) or not _ACTION_ID_RE.fullmatch(action_id):
            raise ValueError("invalid action id")
        if action_id in seen:
            raise ValueError("duplicate action id")
        seen.add(action_id)
        label = item.get("label")
        if not isinstance(label, str) or not label.strip():
            raise ValueError("action label required")
        label = label.strip()
        if len(label) > 40:
            raise ValueError("action label too long")
        confirm = item.get("confirm")
        if confirm is not None:
            if not isinstance(confirm, str):
                raise ValueError("action confirm must be a string")
            if len(confirm) > 200:
                raise ValueError("action confirm too long")
        style = item.get("style", "default")
        if not isinstance(style, str) or style not in _VALID_ACTION_STYLES:
            raise ValueError("invalid action style")
        kind = item.get("kind", "run")
        if not isinstance(kind, str) or kind not in _VALID_ACTION_KINDS:
            raise ValueError("invalid action kind")
        normalized: dict[str, Any] = {
            "id": action_id,
            "label": label,
            "style": style,
            "kind": kind,
        }
        if confirm is not None:
            normalized["confirm"] = confirm
        out.append(normalized)
    return out


def _parse_actions_cell(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return []
    if not isinstance(data, list):
        return []
    return data


def normalize_ask(text: str) -> str:
    lowered = text.lower()
    stripped = _PUNCT_RE.sub("", lowered)
    return _SPACE_RE.sub(" ", stripped).strip()


def fingerprint(chat_key: str, ask: str) -> str:
    payload = f"{chat_key}\n{normalize_ask(ask)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def similar(a: str, b: str) -> float:
    tokens_a = set(normalize_ask(a).split())
    tokens_b = set(normalize_ask(b).split())
    if not tokens_a and not tokens_b:
        return 1.0
    if not tokens_a or not tokens_b:
        return 0.0
    inter = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(inter) / len(union)


def _validate_quadrant(quadrant: int) -> None:
    if quadrant not in (1, 2, 3, 4):
        raise ValueError(f"quadrant must be 1-4, got {quadrant}")


def _validate_task_status(status: str) -> None:
    if status not in _VALID_TASK_STATUSES:
        raise ValueError(f"invalid task status: {status}")


def _validate_close_status(status: str) -> None:
    if status not in _VALID_CLOSE_STATUSES:
        raise ValueError(f"status must be done or dismissed, got {status}")


def _row_to_task(row: sqlite3.Row) -> dict[str, Any]:
    keys = row.keys()
    archived_chat = bool(row["archived_chat"]) if "archived_chat" in keys else False
    snapshot = (
        json.loads(row["hermes_project_json"])
        if "hermes_project_json" in keys and row["hermes_project_json"]
        else None
    )
    project = (
        {k: snapshot.get(k) for k in ("key", "name", "color")} if snapshot else None
    )
    return {
        "id": row["id"],
        "chat_key": row["chat_key"],
        "agent": row["agent"],
        "chat_title": row["chat_title"],
        "ask": row["ask"],
        "topic": row["topic"],
        "quadrant": row["quadrant"],
        "status": row["status"],
        "snooze_until": row["snooze_until"],
        "source_msg_id": row["source_msg_id"],
        "source_msg_at": row["source_msg_at"] if "source_msg_at" in keys else None,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "fingerprint": row["fingerprint"],
        **{
            name: row[name] if name in keys else None
            for name in ("context", "due_at", "urgency", "importance", "model_quadrant")
        },
        "quadrant_locked": bool(row["quadrant_locked"]),
        "archived_chat": archived_chat,
        "project": project,
        "manual": bool(row["manual"]) if "manual" in keys else False,
        "source_excerpt": row["source_excerpt"] if "source_excerpt" in keys else None,
        "title_override": row["title_override"] if "title_override" in keys else None,
        "chat_name": row["chat_name"] if "chat_name" in keys else None,
        "actions": _parse_actions_cell(row["actions"]) if "actions" in keys else [],
    }


class Store:
    def _schema_script(self, script: str) -> None:
        """Run schema statements without executescript's implicit commit."""
        for statement in script.split(";"):
            if statement.strip():
                self._conn.execute(statement)

    def __init__(self, path: str) -> None:
        self.path = path
        parent = os.path.dirname(os.path.abspath(path))
        if parent:
            os.makedirs(parent, mode=0o700, exist_ok=True)
            os.chmod(parent, stat.S_IRWXU)
        # Desktop API, gateway hook and scanner may open this DB concurrently.
        self._conn = sqlite3.connect(path, timeout=15, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA busy_timeout=15000")
        for _ in range(30):
            try:
                self._conn.execute("PRAGMA journal_mode=WAL")
                break
            except sqlite3.OperationalError:
                time.sleep(0.05)
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._init_schema()
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)

    def close(self) -> None:
        self._conn.close()

    def _migrate_hermes_projects_and_tags(self) -> None:
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)"
        )
        # _init_schema owns the write transaction, including this marker.
        backup_path = None
        backup_ready = False
        try:
            if not self._conn.execute(
                "SELECT 1 FROM meta WHERE key='hermes_projects_v1'"
            ).fetchone():
                # SQLite backup includes committed WAL data, unlike copying the main file.
                backup_path = (
                    self.path + ".bak-pre-hermes-projects-" + str(time.time_ns())
                )
                source = sqlite3.connect(
                    Path(self.path).resolve().as_uri() + "?mode=ro", uri=True
                )
                try:
                    with sqlite3.connect(backup_path) as dest:
                        source.backup(dest)
                        # Keep the rollback copy self-contained, without WAL
                        # sidecars even when someone opens it read-only later.
                        dest.execute("PRAGMA journal_mode=DELETE")
                    dest.close()
                    os.chmod(backup_path, 0o600)
                    backup_ready = True
                finally:
                    source.close()
                self._conn.execute("DELETE FROM projects")
                self._conn.execute("UPDATE tasks SET project_id=NULL")
                self._conn.execute("ALTER TABLE tasks DROP COLUMN project_locked")
                self._conn.execute(
                    "ALTER TABLE tasks ADD COLUMN project_locked INTEGER"
                )
                self._conn.execute("INSERT INTO meta VALUES('hermes_projects_v1','1')")
            cols = {r[1] for r in self._conn.execute("PRAGMA table_info(chat_groups)")}
            if "project_json" not in cols:
                self._conn.execute(
                    "ALTER TABLE chat_groups ADD COLUMN project_json TEXT"
                )
        except Exception:
            self._conn.rollback()
            if backup_path and not backup_ready:
                _discard_partial_backup(backup_path)
            raise
        self._schema_script("""
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                color TEXT, hint TEXT, created_at REAL);
            CREATE TABLE IF NOT EXISTS task_tags (
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
                source TEXT CHECK(source IN ('manual','auto')), removed INTEGER DEFAULT 0,
                created_at REAL, PRIMARY KEY(task_id,tag_id));
        """)

    def refresh_chat_project(self, chat_key: str, project: dict | None) -> bool:
        raw = json.dumps(project, sort_keys=True) if project else None
        previous = self._conn.execute(
            "SELECT project_json FROM chat_groups WHERE chat_key=?", (chat_key,)
        ).fetchone()
        if previous and previous[0] == raw:
            return False
        self._conn.execute(
            """INSERT INTO chat_groups(chat_key,updated_at,project_json) VALUES(?,?,?)
            ON CONFLICT(chat_key) DO UPDATE SET project_json=excluded.project_json""",
            (chat_key, time.time(), raw),
        )
        self._conn.commit()
        return bool(previous or raw)

    def _task_payload(self, row: sqlite3.Row) -> dict:
        task = _row_to_task(row)
        task["tags"] = [
            dict(r)
            for r in self._conn.execute(
                """
            SELECT t.id,t.name,t.color,tt.source FROM tags t JOIN task_tags tt ON tt.tag_id=t.id
            WHERE tt.task_id=? AND tt.removed=0 ORDER BY t.name COLLATE NOCASE""",
                (task["id"],),
            )
        ]
        return task

    @staticmethod
    def _validate_tag(name: str, color: str, hint: str) -> tuple[str, str, str]:
        import unicodedata

        if not isinstance(name, str):
            raise ValueError("tag name must be a string")
        name = name.strip()
        if not 1 <= len(name) <= 32 or any(
            unicodedata.category(c) == "Cc" for c in name
        ):
            raise ValueError(
                "tag name must be 1-32 characters without control characters"
            )
        if color not in (
            "gray",
            "red",
            "orange",
            "yellow",
            "green",
            "teal",
            "blue",
            "purple",
            "pink",
        ):
            raise ValueError("invalid tag color")
        if not isinstance(hint, str) or len(hint) > 200:
            raise ValueError("tag hint must be at most 200 characters")
        return name, color, hint

    def list_tags(self) -> list[dict]:
        counts = Counter(tag["id"] for t in self.list_tasks() for tag in t["tags"])
        return [
            dict(dict(r), open_count=counts[r["id"]])
            for r in self._conn.execute(
                "SELECT * FROM tags ORDER BY name COLLATE NOCASE"
            )
        ]

    def create_tag(self, name: str, *, color: str = "gray", hint: str = "") -> dict:
        name, color, hint = self._validate_tag(name, color, hint)
        try:
            with self._conn:
                self._conn.execute("BEGIN IMMEDIATE")
                if self._conn.execute("SELECT count(*) FROM tags").fetchone()[0] >= 100:
                    raise ValueError("at most 100 tags allowed")
                cur = self._conn.execute(
                    "INSERT INTO tags(name,color,hint,created_at) VALUES(?,?,?,?)",
                    (name, color, hint, time.time()),
                )
                tag_id = cur.lastrowid
        except sqlite3.IntegrityError:
            raise ValueError("tag name already exists") from None
        return dict(
            self._conn.execute("SELECT * FROM tags WHERE id=?", (tag_id,)).fetchone()
        )

    def update_tag(self, tag_id: int, **fields) -> dict:
        if not fields or set(fields) - {"name", "color", "hint"}:
            raise ValueError("provide name, color, or hint")
        row = self._conn.execute("SELECT * FROM tags WHERE id=?", (tag_id,)).fetchone()
        if row is None:
            raise ValueError("tag not found")
        values = dict(row)
        values.update(fields)
        name, color, hint = self._validate_tag(
            values["name"], values["color"], values["hint"]
        )
        try:
            with self._conn:
                self._conn.execute(
                    "UPDATE tags SET name=?,color=?,hint=? WHERE id=?",
                    (name, color, hint, tag_id),
                )
        except sqlite3.IntegrityError:
            raise ValueError("tag name already exists") from None
        return dict(
            self._conn.execute("SELECT * FROM tags WHERE id=?", (tag_id,)).fetchone()
        )

    def delete_tag(self, tag_id: int) -> None:
        with self._conn:
            if not self._conn.execute(
                "DELETE FROM tags WHERE id=?", (tag_id,)
            ).rowcount:
                raise ValueError("tag not found")

    def _validate_tag_ids(self, tag_ids: list) -> None:
        if not isinstance(tag_ids, list) or any(
            type(i) is not int or i <= 0 for i in tag_ids
        ):
            raise ValueError("tag ids must be positive integers")
        for tag_id in set(tag_ids):
            if not self._conn.execute(
                "SELECT 1 FROM tags WHERE id=?", (tag_id,)
            ).fetchone():
                raise ValueError(f"tag not found: {tag_id}")

    def update_task_tags(
        self, task_id: int, *, add: list | None = None, remove: list | None = None
    ) -> None:
        add = [] if add is None else add
        remove = [] if remove is None else remove
        self._validate_tag_ids(add)
        self._validate_tag_ids(remove)
        if not self._conn.execute(
            "SELECT 1 FROM tasks WHERE id=?", (task_id,)
        ).fetchone():
            raise ValueError("task not found")
        with self._conn:
            for tag_id in add:
                self._conn.execute(
                    """INSERT INTO task_tags VALUES(?,?,'manual',0,?) ON CONFLICT(task_id,tag_id)
                    DO UPDATE SET source='manual',removed=0""",
                    (task_id, tag_id, time.time()),
                )
            for tag_id in remove:
                self._conn.execute(
                    """INSERT INTO task_tags VALUES(?,?,'manual',1,?) ON CONFLICT(task_id,tag_id)
                    DO UPDATE SET removed=1""",
                    (task_id, tag_id, time.time()),
                )

    def apply_auto_tags(self, task_id: int, tag_ids: list[int]) -> None:
        self._validate_tag_ids(tag_ids)
        if not self._conn.execute(
            "SELECT 1 FROM tasks WHERE id=?", (task_id,)
        ).fetchone():
            raise ValueError("task not found")
        with self._conn:
            for tag_id in tag_ids:
                self._conn.execute(
                    "INSERT INTO task_tags VALUES(?,?,'auto',0,?) ON CONFLICT(task_id,tag_id) DO NOTHING",
                    (task_id, tag_id, time.time()),
                )

    def update_group_tags(self, chat_key: str, *, add: list, remove: list, task_ids=None) -> None:
        self._validate_tag_ids(add)
        self._validate_tag_ids(remove)
        tasks = self._visible_open_tasks_for_chat(chat_key)
        if len(tasks) < 2:
            raise ValueError(f"not a task group: {chat_key}")
        if task_ids is not None:
            allowed = {t["id"] for t in tasks}
            if not isinstance(task_ids, list) or any(type(i) is not int or i not in allowed for i in task_ids):
                raise ValueError("task_ids must be open tasks in this chat")
            tasks = [t for t in tasks if t["id"] in task_ids]
        for task in tasks:
            self.update_task_tags(task["id"], add=add, remove=remove)

    def _init_schema(self) -> None:
        self._conn.execute("BEGIN IMMEDIATE")
        try:
            self._schema_script(
                """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_key TEXT NOT NULL,
                agent TEXT NOT NULL,
                chat_title TEXT NOT NULL,
                ask TEXT NOT NULL,
                topic TEXT NOT NULL,
                quadrant INTEGER NOT NULL,
                status TEXT NOT NULL,
                snooze_until REAL,
                source_msg_id TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                fingerprint TEXT NOT NULL,
                quadrant_locked INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_fingerprint ON tasks(fingerprint);
            CREATE INDEX IF NOT EXISTS idx_tasks_chat_key ON tasks(chat_key);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

            CREATE TABLE IF NOT EXISTS closed (
                fingerprint TEXT PRIMARY KEY,
                chat_key TEXT NOT NULL,
                ask TEXT NOT NULL,
                status TEXT NOT NULL,
                closed_at REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_closed_chat_key ON closed(chat_key);

            CREATE TABLE IF NOT EXISTS scan_state (
                chat_key TEXT PRIMARY KEY,
                last_msg_id TEXT,
                scanned_at REAL
            );

            CREATE TABLE IF NOT EXISTS dirty (
                chat_key TEXT PRIMARY KEY,
                marked_at REAL NOT NULL
            );
            """
            )
            self._migrate_archived_chat()
            self._migrate_projects()
            self._migrate_chat_groups()
            self._migrate_source_excerpt()
            self._migrate_manual()
            self._migrate_title_override()
            self._migrate_group_title_locked()
            self._migrate_actions()
            self._migrate_source_msg_at()
            self._migrate_closed_last_msg_id()
            self._migrate_standalone_names_to_chat()
            self._migrate_hermes_projects_and_tags()
            columns = {r[1] for r in self._conn.execute("PRAGMA table_info(tasks)")}
            for name, kind in (
                ("context", "TEXT"),
                ("due_at", "REAL"),
                ("urgency", "INT"),
                ("importance", "INT"),
                ("model_quadrant", "INT"),
            ):
                if name not in columns:
                    self._conn.execute(f"ALTER TABLE tasks ADD COLUMN {name} {kind}")
            self._schema_script(
                """
            CREATE TABLE IF NOT EXISTS priority_labels (
                id INTEGER PRIMARY KEY, task_id INT, ask TEXT, context TEXT,
                quadrant INT, source TEXT CHECK(source IN ('move','quiz')), created_at REAL);
            CREATE TABLE IF NOT EXISTS priority_quiz_skips (task_id INTEGER PRIMARY KEY, created_at REAL);
            """
            )
            self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

    def _migrate_standalone_names_to_chat(self) -> None:
        """A name given to a single-task card also names its chat (kept across scans).

        Only chats with exactly one live task that has a name, and no chat name yet.
        Cheap, one statement, safe to run on every open."""
        self._conn.execute(
            """
            INSERT INTO chat_groups (chat_key, title, quadrant_locked, quadrant, updated_at, title_locked)
            SELECT t.chat_key, MAX(t.title_override), 0, NULL, MAX(t.updated_at), 1
            FROM tasks t
            WHERE t.status IN ('open', 'snoozed')
            GROUP BY t.chat_key
            HAVING COUNT(*) = 1
               AND MAX(t.title_override) IS NOT NULL
               AND TRIM(MAX(t.title_override)) != ''
               AND NOT EXISTS (
                   SELECT 1 FROM chat_groups g
                   WHERE g.chat_key = t.chat_key AND g.title_locked = 1
               )
            ON CONFLICT(chat_key) DO UPDATE SET
                title = excluded.title,
                title_locked = 1
            """
        )

    def _migrate_title_override(self) -> None:
        cols = {
            row[1] for row in self._conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "title_override" not in cols:
            self._conn.execute("ALTER TABLE tasks ADD COLUMN title_override TEXT")

    def _migrate_group_title_locked(self) -> None:
        cols = {
            row[1]
            for row in self._conn.execute("PRAGMA table_info(chat_groups)").fetchall()
        }
        if "title_locked" not in cols:
            self._conn.execute(
                "ALTER TABLE chat_groups ADD COLUMN title_locked INTEGER NOT NULL DEFAULT 0"
            )

    def _migrate_manual(self) -> None:
        cols = {
            row[1] for row in self._conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "manual" not in cols:
            self._conn.execute(
                "ALTER TABLE tasks ADD COLUMN manual INTEGER NOT NULL DEFAULT 0"
            )

    def _migrate_source_excerpt(self) -> None:
        cols = {
            row[1] for row in self._conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "source_excerpt" not in cols:
            self._conn.execute("ALTER TABLE tasks ADD COLUMN source_excerpt TEXT")

    def _migrate_actions(self) -> None:
        cols = {
            row[1] for row in self._conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "actions" not in cols:
            self._conn.execute("ALTER TABLE tasks ADD COLUMN actions TEXT")

    def _migrate_source_msg_at(self) -> None:
        cols = {
            row[1] for row in self._conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "source_msg_at" not in cols:
            self._conn.execute("ALTER TABLE tasks ADD COLUMN source_msg_at REAL")

    def _migrate_closed_last_msg_id(self) -> None:
        cols = {
            row[1] for row in self._conn.execute("PRAGMA table_info(closed)").fetchall()
        }
        if "last_msg_id" not in cols:
            self._conn.execute("ALTER TABLE closed ADD COLUMN last_msg_id TEXT")

    def _migrate_chat_groups(self) -> None:
        self._schema_script(
            """
            CREATE TABLE IF NOT EXISTS chat_groups (
                chat_key TEXT PRIMARY KEY,
                title TEXT,
                quadrant_locked INTEGER NOT NULL DEFAULT 0,
                quadrant INTEGER NULL,
                updated_at REAL NOT NULL
            );
            """
        )

    def _migrate_archived_chat(self) -> None:
        cols = {
            row[1] for row in self._conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "archived_chat" not in cols:
            self._conn.execute(
                "ALTER TABLE tasks ADD COLUMN archived_chat INTEGER NOT NULL DEFAULT 0"
            )

    def _migrate_projects(self) -> None:
        self._schema_script(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                keywords TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL CHECK(source IN ('user', 'auto')),
                created_at REAL NOT NULL,
                archived INTEGER NOT NULL DEFAULT 0
            );
            """
        )
        cols = {
            row[1] for row in self._conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "project_id" not in cols:
            self._conn.execute("ALTER TABLE tasks ADD COLUMN project_id INTEGER NULL")
        if "project_locked" not in cols:
            self._conn.execute(
                "ALTER TABLE tasks ADD COLUMN project_locked INTEGER NOT NULL DEFAULT 0"
            )

    def migrate_agent_names(self, profile_display: dict[str, str]) -> None:
        """Rename legacy agent labels to configured display names."""
        for profile_key, display in profile_display.items():
            legacy = profile_key.capitalize()
            self._conn.execute(
                """
                UPDATE tasks SET agent = ?
                WHERE lower(trim(agent)) = lower(?)
                   OR lower(trim(agent)) = lower(?)
                """,
                (display, profile_key, legacy),
            )
        self._conn.commit()

    def _is_suppressed(self, chat_key: str, ask: str, fp: str) -> bool:
        row = self._conn.execute(
            "SELECT 1 FROM closed WHERE fingerprint = ?", (fp,)
        ).fetchone()
        if row is not None:
            return True
        closed_rows = self._conn.execute(
            "SELECT ask FROM closed WHERE chat_key = ?", (chat_key,)
        ).fetchall()
        for closed_row in closed_rows:
            if similar(ask, closed_row["ask"]) >= 0.8:
                return True
        return False

    def priority_labels(self, limit=None):
        sql = "SELECT * FROM priority_labels ORDER BY created_at DESC, id DESC"
        rows = self._conn.execute(
            sql + (" LIMIT ?" if limit is not None else ""),
            (limit,) if limit is not None else (),
        ).fetchall()
        return [dict(r) for r in rows]

    def record_priority_label(self, task_id, quadrant, source, now=None):
        _validate_quadrant(quadrant)
        task = self.get_task(task_id)
        if not task:
            raise ValueError("task not found")
        self._conn.execute(
            "INSERT INTO priority_labels(task_id,ask,context,quadrant,source,created_at) VALUES(?,?,?,?,?,?)",
            (
                task_id,
                task["ask"],
                task["context"],
                quadrant,
                source,
                time.time() if now is None else now,
            ),
        )
        self._conn.commit()

    def escalate_priorities(self, now=None):
        ts = time.time() if now is None else now
        cur = self._conn.execute(
            """UPDATE tasks SET quadrant=CASE WHEN importance>=2 OR (importance IS NULL AND quadrant=2) THEN 1 ELSE 3 END,
            updated_at=? WHERE status IN ('open','snoozed') AND quadrant_locked=0
            AND quadrant IN (2,4) AND due_at IS NOT NULL AND due_at<=?""",
            (ts, ts + 48 * 3600),
        )
        self._conn.commit()
        return cur.rowcount

    def quiz_tasks(self, limit=10):
        excluded = {
            r[0]
            for r in self._conn.execute(
                "SELECT task_id FROM priority_labels UNION SELECT task_id FROM priority_quiz_skips"
            )
        }
        buckets = {q: [] for q in range(1, 5)}
        for task in self.list_tasks():
            if (
                task["status"] == "open"
                and not task["quadrant_locked"]
                and task["id"] not in excluded
            ):
                buckets[task["quadrant"]].append(task)
        result = []
        while len(result) < limit and any(buckets.values()):
            for bucket in buckets.values():
                if bucket and len(result) < limit:
                    task = bucket.pop(0)
                    item = {
                        k: task[k]
                        for k in (
                            "id",
                            "ask",
                            "context",
                            "chat_title",
                            "agent",
                            "quadrant",
                            "due_at",
                        )
                    }
                    item["project"] = (task["project"] or {}).get("name")
                    result.append(item)
        return result

    def skip_quiz(self, task_id):
        self._conn.execute(
            "INSERT OR REPLACE INTO priority_quiz_skips VALUES(?,?)",
            (task_id, time.time()),
        )
        self._conn.commit()

    def upsert_task(
        self,
        chat_key,
        agent,
        chat_title,
        ask,
        topic,
        quadrant,
        source_msg_id,
        now=None,
        source_msg_at=None,
        source_excerpt=None,
        actions=None,
        context=None,
        due_at=None,
        urgency=None,
        importance=None,
        match_candidates=None,
    ):
        # Preserve user titles separately; match contextual rewrites against existing asks.
        if urgency is not None or importance is not None:
            from .priorities import quadrant_for

            quadrant = quadrant_for(urgency, importance, due_at, now)
        existing = self.open_tasks_for_chat(chat_key) if match_candidates is None else match_candidates
        exact = next(
            (t for t in existing if fingerprint(chat_key, ask) == t["fingerprint"]),
            None,
        )
        match = exact or next(
            (
                t
                for t in existing
                if similar(ask, t["ask"]) >= 0.9
                or (t["topic"] == topic and similar(ask, t["ask"]) >= 0.6)
            ),
            None,
        )
        new_ask = ask
        if match and (context is not None or match_candidates is not None):
            ask = match["ask"]
        task_id = self._upsert_task(
            chat_key,
            agent,
            chat_title,
            ask,
            topic,
            quadrant,
            source_msg_id,
            now,
            source_msg_at,
            source_excerpt,
            actions,
            force_new=match_candidates is not None and match is None,
            match_id=match["id"] if match_candidates is not None and match else None,
        )
        if task_id is not None:
            self._conn.execute(
                "UPDATE tasks SET ask=?, fingerprint=?, context=?, due_at=?, urgency=?, importance=?, model_quadrant=? WHERE id=?",
                (
                    new_ask,
                    fingerprint(chat_key, new_ask),
                    context,
                    due_at,
                    urgency,
                    importance,
                    quadrant,
                    task_id,
                ),
            )
            self._conn.commit()
        return task_id

    def _upsert_task(
        self,
        chat_key: str,
        agent: str,
        chat_title: str,
        ask: str,
        topic: str,
        quadrant: int,
        source_msg_id: Optional[str],
        now: Optional[float] = None,
        source_msg_at: Optional[float] = None,
        source_excerpt: Optional[str] = None,
        actions: Optional[list[dict]] = None,
        force_new: bool = False,
        match_id: Optional[int] = None,
    ) -> Optional[int]:
        _validate_quadrant(quadrant)
        ts = now if now is not None else time.time()
        actions_json: str | None = None
        if actions is not None:
            actions_json = json.dumps(validate_actions(actions))
        fp = fingerprint(chat_key, ask)
        if self._is_suppressed(chat_key, ask, fp):
            return None

        existing = self._conn.execute(
            """
            SELECT id, quadrant_locked, status, manual FROM tasks
            WHERE fingerprint = ? AND status IN ('open', 'snoozed', 'resolved', 'expired')
            ORDER BY id DESC LIMIT 1
            """,
            (fp,),
        ).fetchone()
        if match_id is not None:
            existing = self._conn.execute(
                "SELECT id, quadrant_locked, status, manual FROM tasks WHERE id=?",
                (match_id,),
            ).fetchone()
        if existing is not None and not force_new:
            task_id = existing["id"]
            locked = bool(existing["quadrant_locked"]) or bool(existing["manual"])
            reopen = existing["status"] in ("resolved", "expired")
            excerpt_sql = ""
            excerpt_args: tuple[Any, ...] = ()
            if source_excerpt is not None:
                excerpt_sql = ", source_excerpt = ?"
                excerpt_args = (source_excerpt,)
            actions_sql = ""
            actions_args: tuple[Any, ...] = ()
            if actions_json is not None:
                actions_sql = ", actions = ?"
                actions_args = (actions_json,)
            src_sql = ""
            src_args: tuple[Any, ...] = ()
            if source_msg_at is not None:
                src_sql = ", source_msg_at = ?"
                src_args = (source_msg_at,)
            if locked:
                self._conn.execute(
                    f"""
                    UPDATE tasks SET
                        agent = ?, chat_title = ?, ask = ?, topic = ?,
                        source_msg_id = ?, updated_at = ?{excerpt_sql}{actions_sql}{src_sql},
                        status = CASE WHEN ? THEN 'open' ELSE status END,
                        snooze_until = CASE WHEN ? THEN NULL ELSE snooze_until END
                    WHERE id = ?
                    """,
                    (
                        agent,
                        chat_title,
                        ask,
                        topic,
                        source_msg_id,
                        ts,
                        *excerpt_args,
                        *actions_args,
                        *src_args,
                        reopen,
                        reopen,
                        task_id,
                    ),
                )
            else:
                self._conn.execute(
                    f"""
                    UPDATE tasks SET
                        agent = ?, chat_title = ?, ask = ?, topic = ?,
                        quadrant = ?, source_msg_id = ?, updated_at = ?{excerpt_sql}{actions_sql}{src_sql},
                        status = CASE WHEN ? THEN 'open' ELSE status END,
                        snooze_until = CASE WHEN ? THEN NULL ELSE snooze_until END
                    WHERE id = ?
                    """,
                    (
                        agent,
                        chat_title,
                        ask,
                        topic,
                        quadrant,
                        source_msg_id,
                        ts,
                        *excerpt_args,
                        *actions_args,
                        *src_args,
                        reopen,
                        reopen,
                        task_id,
                    ),
                )
            self._conn.commit()
            return task_id

        self._conn.execute(
            """
            INSERT INTO tasks (
                chat_key, agent, chat_title, ask, topic, quadrant, status,
                snooze_until, source_msg_id, source_msg_at, source_excerpt, actions,
                created_at, updated_at, fingerprint, quadrant_locked
            ) VALUES (?, ?, ?, ?, ?, ?, 'open', NULL, ?, ?, ?, ?, ?, ?, ?, 0)
            """,
            (
                chat_key,
                agent,
                chat_title,
                ask,
                topic,
                quadrant,
                source_msg_id,
                source_msg_at,
                source_excerpt,
                actions_json,
                ts,
                ts,
                fp,
            ),
        )
        self._conn.commit()
        return int(self._conn.execute("SELECT last_insert_rowid()").fetchone()[0])

    def add_manual_task(
        self,
        chat_key: str,
        agent: str,
        chat_title: str,
        ask: str,
        topic: str,
        quadrant: int,
        now: Optional[float] = None,
    ) -> int:
        _validate_quadrant(quadrant)
        ts = now if now is not None else time.time()
        fp = fingerprint(chat_key, ask)

        self._conn.execute("DELETE FROM closed WHERE fingerprint = ?", (fp,))

        existing = self._conn.execute(
            """
            SELECT id FROM tasks
            WHERE fingerprint = ? AND status IN ('open', 'snoozed')
            ORDER BY id DESC LIMIT 1
            """,
            (fp,),
        ).fetchone()

        if existing is not None:
            task_id = int(existing["id"])
            self._conn.execute(
                """
                UPDATE tasks SET
                    agent = ?, chat_title = ?, ask = ?, topic = ?,
                    quadrant = ?, status = 'open',
                    snooze_until = NULL, source_msg_id = NULL,
                    quadrant_locked = 1, manual = 1,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    agent,
                    chat_title,
                    ask,
                    topic,
                    quadrant,
                    ts,
                    task_id,
                ),
            )
        else:
            self._conn.execute(
                """
                INSERT INTO tasks (
                    chat_key, agent, chat_title, ask, topic, quadrant, status,
                    snooze_until, source_msg_id, created_at, updated_at,
                    fingerprint, quadrant_locked, manual
                ) VALUES (?, ?, ?, ?, ?, ?, 'open', NULL, NULL, ?, ?, ?, 1, 1)
                """,
                (
                    chat_key,
                    agent,
                    chat_title,
                    ask,
                    topic,
                    quadrant,
                    ts,
                    ts,
                    fp,
                ),
            )
            task_id = int(
                self._conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            )

        group = self._get_chat_group_row(chat_key)
        if group and group.get("quadrant_locked"):
            self._conn.execute(
                """
                UPDATE chat_groups SET quadrant = ?, updated_at = ?
                WHERE chat_key = ?
                """,
                (quadrant, ts, chat_key),
            )

        self._conn.commit()
        return task_id

    def session_tasks(self, chat_key: str) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            f"""
            SELECT {_TASK_SELECT} {_TASK_FROM}
            WHERE tasks.chat_key = ? AND tasks.status IN ('open', 'snoozed')
            ORDER BY tasks.id
            """,
            (chat_key,),
        ).fetchall()
        return [self._task_payload(r) for r in rows]

    def _reopen_due_snoozed(self, now: float) -> None:
        self._conn.execute(
            """
            UPDATE tasks SET status = 'open', snooze_until = NULL, updated_at = ?
            WHERE status = 'snoozed' AND snooze_until IS NOT NULL AND snooze_until <= ?
            """,
            (now, now),
        )
        self._conn.commit()

    def list_tasks(
        self,
        include_closed: bool = False,
        now: Optional[float] = None,
        *,
        projects: Optional[list[str]] = None,
        tags: Optional[list[int]] = None,
    ) -> list[dict[str, Any]]:
        ts = now if now is not None else time.time()
        self._reopen_due_snoozed(ts)
        self.escalate_priorities(ts)

        if include_closed:
            rows = self._conn.execute(
                f"SELECT {_TASK_SELECT} {_TASK_FROM} ORDER BY tasks.id"
            ).fetchall()
        else:
            rows = self._conn.execute(
                f"""
                SELECT {_TASK_SELECT} {_TASK_FROM}
                WHERE tasks.status NOT IN ('done', 'dismissed', 'resolved', 'expired')
                  AND NOT (
                    tasks.status = 'snoozed'
                    AND tasks.snooze_until IS NOT NULL
                    AND tasks.snooze_until > ?
                  )
                ORDER BY tasks.id
                """,
                (ts,),
            ).fetchall()
        tasks = [self._task_payload(r) for r in rows]
        if projects:
            tasks = [
                t
                for t in tasks
                if ((t["project"] or {}).get("key") or "none") in projects
            ]
        if tags:
            wanted = set(tags)
            tasks = [
                t for t in tasks if wanted.issubset({tag["id"] for tag in t["tags"]})
            ]
        return tasks

    def close_task(
        self, task_id: int, status: str, now: Optional[float] = None,
        *, _commit: bool = True,
    ) -> None:
        _validate_close_status(status)
        ts = now if now is not None else time.time()
        row = self._conn.execute(
            "SELECT fingerprint, chat_key, ask, source_msg_id FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
        if row is None:
            raise ValueError(f"task not found: {task_id}")

        self._conn.execute(
            """
            INSERT INTO closed (
                fingerprint, chat_key, ask, status, closed_at, last_msg_id
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(fingerprint) DO UPDATE SET
                chat_key = excluded.chat_key,
                ask = excluded.ask,
                status = excluded.status,
                closed_at = excluded.closed_at,
                last_msg_id = excluded.last_msg_id
            """,
            (
                row["fingerprint"],
                row["chat_key"],
                row["ask"],
                status,
                ts,
                row["source_msg_id"],
            ),
        )
        self._conn.execute(
            "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
            (status, ts, task_id),
        )
        if _commit:
            self._conn.commit()

    def resolve_task(self, task_id: int, now: Optional[float] = None) -> None:
        ts = now if now is not None else time.time()
        cur = self._conn.execute(
            """
            UPDATE tasks SET status = 'resolved', updated_at = ?
            WHERE id = ?
            """,
            (ts, task_id),
        )
        if cur.rowcount == 0:
            raise ValueError(f"task not found: {task_id}")
        self._conn.commit()

    def expire_task(self, task_id: int, now: Optional[float] = None) -> None:
        """Clear for age, without claiming that the user answered."""
        ts = now if now is not None else time.time()
        cur = self._conn.execute(
            "UPDATE tasks SET status = 'expired', updated_at = ? WHERE id = ?",
            (ts, task_id),
        )
        if cur.rowcount == 0:
            raise ValueError(f"task not found: {task_id}")
        self._conn.commit()

    def reopen_task(self, task_id: int, now: Optional[float] = None) -> None:
        ts = now if now is not None else time.time()
        row = self._conn.execute(
            "SELECT fingerprint FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        if row is None:
            raise ValueError(f"task not found: {task_id}")
        fp = row["fingerprint"]
        self._conn.execute("DELETE FROM closed WHERE fingerprint = ?", (fp,))
        self._conn.execute(
            """
            UPDATE tasks SET status = 'open', snooze_until = NULL, updated_at = ?
            WHERE id = ?
            """,
            (ts, task_id),
        )
        self._conn.commit()

    def snooze_task(
        self, task_id: int, until_ts: float, now: Optional[float] = None
    ) -> None:
        ts = now if now is not None else time.time()
        cur = self._conn.execute(
            """
            UPDATE tasks SET status = 'snoozed', snooze_until = ?, updated_at = ?
            WHERE id = ?
            """,
            (until_ts, ts, task_id),
        )
        if cur.rowcount == 0:
            raise ValueError(f"task not found: {task_id}")
        self._conn.commit()

    def set_quadrant(
        self,
        task_id: int,
        quadrant: int,
        locked: bool = True,
        now: Optional[float] = None,
        restore: bool = False,
    ) -> None:
        _validate_quadrant(quadrant)
        ts = now if now is not None else time.time()
        previous = self.get_task(task_id)
        if not restore and locked and previous and previous["quadrant"] != quadrant:
            self.record_priority_label(task_id, quadrant, "move", now=ts)
        cur = self._conn.execute(
            """
            UPDATE tasks SET quadrant = ?, quadrant_locked = ?, updated_at = ?
            WHERE id = ?
            """,
            (quadrant, 1 if locked else 0, ts, task_id),
        )
        if cur.rowcount == 0:
            raise ValueError(f"task not found: {task_id}")
        self._conn.commit()

    def open_tasks_for_chat(self, chat_key: str) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            f"""
            SELECT {_TASK_SELECT} {_TASK_FROM}
            WHERE tasks.chat_key = ? AND tasks.status = 'open'
            ORDER BY tasks.id
            """,
            (chat_key,),
        ).fetchall()
        return [self._task_payload(r) for r in rows]

    def identity_tasks_for_chat(self, chat_key: str) -> list[dict[str, Any]]:
        """Open and snoozed tasks eligible for classifier identity matching."""
        rows = self._conn.execute(
            f"""
            SELECT {_TASK_SELECT} {_TASK_FROM}
            WHERE tasks.chat_key = ? AND tasks.status IN ('open', 'snoozed')
            ORDER BY tasks.id
            """,
            (chat_key,),
        ).fetchall()
        return [self._task_payload(r) for r in rows]

    def has_active_tasks_for_chat(
        self, chat_key: str, now: Optional[float] = None
    ) -> bool:
        row = self._conn.execute(
            """
            SELECT COUNT(*) AS n FROM tasks
            WHERE chat_key = ? AND status IN ('open', 'snoozed')
            """,
            (chat_key,),
        ).fetchone()
        return int(row["n"]) > 0

    def _closeable_tasks_for_chat(
        self, chat_key: str, now: Optional[float] = None
    ) -> list[dict[str, Any]]:
        ts = now if now is not None else time.time()
        self._reopen_due_snoozed(ts)
        rows = self._conn.execute(
            f"""
            SELECT {_TASK_SELECT} {_TASK_FROM}
            WHERE tasks.chat_key = ?
              AND tasks.status IN ('open', 'snoozed')
            ORDER BY tasks.id
            """,
            (chat_key,),
        ).fetchall()
        return [self._task_payload(r) for r in rows]

    def close_tasks_in_chat(
        self,
        chat_key: str,
        task_ids: list[int],
        status: str,
        now: Optional[float] = None,
    ) -> list[int]:
        _validate_close_status(status)
        if not isinstance(task_ids, list) or not task_ids:
            raise ValueError("task_ids must be a non-empty list of task ids")
        if any(type(i) is not int for i in task_ids):
            raise ValueError("task_ids must be a non-empty list of task ids")
        closed_ids: list[int] = []
        with self._conn:
            self._conn.execute("BEGIN IMMEDIATE")
            members = {r["id"]: r for r in self._conn.execute(
                "SELECT id, status FROM tasks WHERE chat_key = ?", (chat_key,)
            )}
            if any(tid not in members for tid in task_ids):
                raise ValueError("task_ids must belong to this chat")
            for tid in dict.fromkeys(task_ids):
                if members[tid]["status"] not in ("open", "snoozed"):
                    continue
                self.close_task(tid, status, now=now, _commit=False)
                closed_ids.append(tid)
        return closed_ids

    def chat_task_count(self, chat_key: str) -> int:
        """Tasks ever stored for this chat, open or closed."""
        row = self._conn.execute(
            "SELECT COUNT(*) AS n FROM tasks WHERE chat_key = ?", (chat_key,)
        ).fetchone()
        return int(row["n"])

    def set_archived_chat_flag(self, task_id: int, archived: bool) -> None:
        cur = self._conn.execute(
            "UPDATE tasks SET archived_chat = ? WHERE id = ?",
            (1 if archived else 0, task_id),
        )
        if cur.rowcount == 0:
            raise ValueError(f"task not found: {task_id}")
        self._conn.commit()

    def get_task(self, task_id: int) -> Optional[dict[str, Any]]:
        row = self._conn.execute(
            f"SELECT {_TASK_SELECT} {_TASK_FROM} WHERE tasks.id = ?",
            (task_id,),
        ).fetchone()
        if row is None:
            return None
        return self._task_payload(row)

    def closed_asks_for_chat(self, chat_key: str) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            """
            SELECT fingerprint, chat_key, ask, status, closed_at, last_msg_id
            FROM closed WHERE chat_key = ? ORDER BY closed_at
            """,
            (chat_key,),
        ).fetchall()
        return [
            {
                "fingerprint": r["fingerprint"],
                "chat_key": r["chat_key"],
                "ask": r["ask"],
                "status": r["status"],
                "closed_at": r["closed_at"],
                "last_msg_id": r["last_msg_id"],
            }
            for r in rows
        ]

    def mark_dirty(self, chat_key: str, now: Optional[float] = None) -> None:
        ts = now if now is not None else time.time()
        self._conn.execute(
            """
            INSERT INTO dirty (chat_key, marked_at) VALUES (?, ?)
            ON CONFLICT(chat_key) DO UPDATE SET marked_at = excluded.marked_at
            """,
            (chat_key, ts),
        )
        self._conn.commit()

    def pop_dirty(self, older_than_ts: float) -> list[str]:
        rows = self._conn.execute(
            "SELECT chat_key FROM dirty WHERE marked_at <= ? ORDER BY marked_at",
            (older_than_ts,),
        ).fetchall()
        keys = [r["chat_key"] for r in rows]
        if keys:
            self._conn.execute(
                "DELETE FROM dirty WHERE marked_at <= ?", (older_than_ts,)
            )
            self._conn.commit()
        return keys

    def get_scan_state(self, chat_key: str) -> Optional[dict[str, Any]]:
        row = self._conn.execute(
            "SELECT last_msg_id, scanned_at FROM scan_state WHERE chat_key = ?",
            (chat_key,),
        ).fetchone()
        if row is None:
            return None
        return {
            "last_msg_id": row["last_msg_id"],
            "scanned_at": row["scanned_at"],
        }

    def set_scan_state(
        self,
        chat_key: str,
        last_msg_id: Optional[str],
        scanned_at: float,
    ) -> None:
        self._conn.execute(
            """
            INSERT INTO scan_state (chat_key, last_msg_id, scanned_at)
            VALUES (?, ?, ?)
            ON CONFLICT(chat_key) DO UPDATE SET
                last_msg_id = excluded.last_msg_id,
                scanned_at = excluded.scanned_at
            """,
            (chat_key, last_msg_id, scanned_at),
        )
        self._conn.commit()

    def set_group_title(
        self, chat_key: str, title: str, now: Optional[float] = None
    ) -> None:
        clean = (title or "").strip()
        if not clean:
            return
        clean = clean[:60]
        ts = now if now is not None else time.time()
        self._conn.execute(
            """
            INSERT INTO chat_groups (chat_key, title, quadrant_locked, quadrant, updated_at, title_locked)
            VALUES (?, ?, 0, NULL, ?, 0)
            ON CONFLICT(chat_key) DO UPDATE SET
                title = CASE WHEN chat_groups.title_locked = 1 THEN chat_groups.title
                             ELSE excluded.title END,
                updated_at = excluded.updated_at
            """,
            (chat_key, clean, ts),
        )
        self._conn.commit()

    def rename_task(
        self, task_id: int, title: Optional[str], now: Optional[float] = None
    ) -> None:
        ts = now if now is not None else time.time()
        if title is None or not str(title).strip():
            cur = self._conn.execute(
                "UPDATE tasks SET title_override = NULL, updated_at = ? WHERE id = ?",
                (ts, task_id),
            )
        else:
            clean = str(title).strip()[:120]
            cur = self._conn.execute(
                "UPDATE tasks SET title_override = ?, updated_at = ? WHERE id = ?",
                (clean, ts, task_id),
            )
        if cur.rowcount == 0:
            raise ValueError(f"task not found: {task_id}")
        self._conn.commit()

    def rename_group(
        self, chat_key: str, title: Optional[str], now: Optional[float] = None
    ) -> None:
        ts = now if now is not None else time.time()
        old_row = self._conn.execute(
            "SELECT title, title_locked FROM chat_groups WHERE chat_key = ?",
            (chat_key,),
        ).fetchone()
        old_locked_title: str | None = None
        if old_row is not None and old_row["title_locked"]:
            old_locked_title = (old_row["title"] or "").strip() or None

        new_title: str | None
        if title is None or not str(title).strip():
            new_title = None
            self._conn.execute(
                """
                INSERT INTO chat_groups (chat_key, title, quadrant_locked, quadrant, updated_at, title_locked)
                VALUES (?, NULL, 0, NULL, ?, 0)
                ON CONFLICT(chat_key) DO UPDATE SET
                    title_locked = 0,
                    updated_at = excluded.updated_at
                """,
                (chat_key, ts),
            )
        else:
            new_title = str(title).strip()[:120]
            self._conn.execute(
                """
                INSERT INTO chat_groups (chat_key, title, quadrant_locked, quadrant, updated_at, title_locked)
                VALUES (?, ?, 0, NULL, ?, 1)
                ON CONFLICT(chat_key) DO UPDATE SET
                    title = excluded.title,
                    title_locked = 1,
                    updated_at = excluded.updated_at
                """,
                (chat_key, new_title, ts),
            )

        if old_locked_title:
            if new_title is None:
                self._conn.execute(
                    """
                    UPDATE tasks SET title_override = NULL, updated_at = ?
                    WHERE chat_key = ?
                      AND title_override IS NOT NULL
                      AND LOWER(TRIM(title_override)) = LOWER(?)
                    """,
                    (ts, chat_key, old_locked_title),
                )
            else:
                self._conn.execute(
                    """
                    UPDATE tasks SET title_override = ?, updated_at = ?
                    WHERE chat_key = ?
                      AND title_override IS NOT NULL
                      AND LOWER(TRIM(title_override)) = LOWER(?)
                    """,
                    (new_title, ts, chat_key, old_locked_title),
                )

        self._conn.commit()

    def _get_chat_group_row(self, chat_key: str) -> Optional[dict[str, Any]]:
        row = self._conn.execute(
            """
            SELECT chat_key, title, quadrant_locked, quadrant, updated_at, title_locked
            FROM chat_groups WHERE chat_key = ?
            """,
            (chat_key,),
        ).fetchone()
        if row is None:
            return None
        keys = row.keys()
        return {
            "chat_key": row["chat_key"],
            "title": row["title"],
            "quadrant_locked": bool(row["quadrant_locked"]),
            "quadrant": row["quadrant"],
            "updated_at": row["updated_at"],
            "title_locked": bool(row["title_locked"])
            if "title_locked" in keys
            else False,
        }

    def set_group_quadrant(
        self,
        chat_key: str,
        quadrant: int,
        locked: bool = True,
        now: Optional[float] = None,
    ) -> None:
        _validate_quadrant(quadrant)
        ts = now if now is not None else time.time()
        for task in self.open_tasks_for_chat(chat_key):
            self.set_quadrant(task["id"], quadrant, locked=locked, now=ts)
        self._conn.execute(
            """
            INSERT INTO chat_groups (chat_key, title, quadrant_locked, quadrant, updated_at)
            VALUES (?, NULL, ?, ?, ?)
            ON CONFLICT(chat_key) DO UPDATE SET
                quadrant_locked = excluded.quadrant_locked,
                quadrant = excluded.quadrant,
                updated_at = excluded.updated_at
            """,
            (chat_key, 1 if locked else 0, quadrant, ts),
        )
        self._conn.commit()

    @staticmethod
    def _group_title_fallback(children: list[dict[str, Any]]) -> str:
        if not children:
            return ""
        topics = Counter(c["topic"] for c in children)
        common = topics.most_common(1)
        if common:
            return common[0][0]
        return children[0]["chat_title"]

    @staticmethod
    def _group_quadrant(
        meta: Optional[dict[str, Any]], children: list[dict[str, Any]]
    ) -> int:
        if (
            meta
            and meta.get("quadrant_locked")
            and meta.get("quadrant") in (1, 2, 3, 4)
        ):
            return int(meta["quadrant"])
        return min(c["quadrant"] for c in children)

    def list_task_groups(self, tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        by_chat: dict[str, list[dict[str, Any]]] = {}
        for task in tasks:
            by_chat.setdefault(task["chat_key"], []).append(task)

        groups: list[dict[str, Any]] = []
        for chat_key, children in by_chat.items():
            if len(children) < 2:
                continue
            meta = self._get_chat_group_row(chat_key)
            stored_title = (meta or {}).get("title") or ""
            title = stored_title.strip() or self._group_title_fallback(children)
            quadrant = self._group_quadrant(meta, children)
            groups.append(
                {
                    "chat_key": chat_key,
                    "title": title,
                    "title_locked": bool((meta or {}).get("title_locked")),
                    "quadrant": quadrant,
                    "task_ids": [c["id"] for c in children],
                    "agent": children[0]["agent"],
                    "chat_title": children[0]["chat_title"],
                    "project": children[0].get("project"),
                }
            )
        return groups

    def _visible_open_tasks_for_chat(
        self, chat_key: str, now: Optional[float] = None
    ) -> list[dict[str, Any]]:
        ts = now if now is not None else time.time()
        self._reopen_due_snoozed(ts)
        rows = self._conn.execute(
            f"""
            SELECT {_TASK_SELECT} {_TASK_FROM}
            WHERE tasks.chat_key = ?
              AND tasks.status NOT IN ('done', 'dismissed', 'resolved', 'expired')
              AND NOT (
                tasks.status = 'snoozed'
                AND tasks.snooze_until IS NOT NULL
                AND tasks.snooze_until > ?
              )
            ORDER BY tasks.id
            """,
            (chat_key, ts),
        ).fetchall()
        return [self._task_payload(r) for r in rows]

    def close_all_open_tasks_for_chat(
        self, chat_key: str, status: str, now: Optional[float] = None
    ) -> list[int]:
        _validate_close_status(status)
        tasks = self._visible_open_tasks_for_chat(chat_key, now=now)
        if len(tasks) < 2:
            raise ValueError(f"not a task group: {chat_key}")
        closed_ids: list[int] = []
        for task in tasks:
            self.close_task(task["id"], status, now=now)
            closed_ids.append(task["id"])
        return closed_ids


def session_id_from_chat_key(chat_key: str) -> str:
    if ":" in chat_key:
        return chat_key.split(":", 1)[1]
    return chat_key


def backfill_source_msg_at(
    store: Store,
    lookup: Callable[[str, str, str], Optional[float]],
) -> int:
    """Set source_msg_at on tasks where it is NULL. lookup(chat_key, session_id, msg_id) -> epoch."""
    rows = store._conn.execute(
        """
        SELECT id, chat_key, source_msg_id FROM tasks
        WHERE source_msg_at IS NULL
          AND source_msg_id IS NOT NULL
          AND trim(source_msg_id) != ''
        """
    ).fetchall()
    updated = 0
    for row in rows:
        session_id = session_id_from_chat_key(row["chat_key"])
        msg_id = row["source_msg_id"]
        ts = lookup(row["chat_key"], session_id, msg_id)
        if ts is None:
            continue
        cur = store._conn.execute(
            "UPDATE tasks SET source_msg_at = ? WHERE id = ? AND source_msg_at IS NULL",
            (ts, row["id"]),
        )
        updated += cur.rowcount
    if updated:
        store._conn.commit()
    return updated


def make_state_db_timestamp_lookup(
    profile_dbs: dict[str, Path],
) -> tuple[Callable[[str, str, str], Optional[float]], Callable[[], None]]:
    """Read-only Hermes state.db lookup; call closer() when finished."""
    conns: dict[str, sqlite3.Connection] = {}
    has_timestamp: dict[str, bool] = {}

    def _profile_for_chat_key(chat_key: str) -> str:
        if ":" in chat_key:
            return chat_key.split(":", 1)[0].lower()
        return "default"

    def _open(profile: str) -> Optional[sqlite3.Connection]:
        if profile in conns:
            return conns[profile] if has_timestamp.get(profile) else None
        db_path = profile_dbs.get(profile)
        if db_path is None or not db_path.is_file():
            has_timestamp[profile] = False
            return None
        try:
            conn = sqlite3.connect(Path(db_path).expanduser().resolve().as_uri() + "?mode=ro", uri=True, timeout=10)
        except sqlite3.Error:
            has_timestamp[profile] = False
            return None
        cols = {r[1] for r in conn.execute("PRAGMA table_info(messages)").fetchall()}
        has_timestamp[profile] = "timestamp" in cols
        conns[profile] = conn
        return conn if has_timestamp[profile] else None

    def lookup(chat_key: str, session_id: str, source_msg_id: str) -> Optional[float]:
        if not source_msg_id:
            return None
        profile = _profile_for_chat_key(chat_key)
        conn = _open(profile)
        if conn is None:
            return None
        try:
            row = conn.execute(
                "SELECT timestamp FROM messages WHERE id = ? AND session_id = ?",
                (source_msg_id, session_id),
            ).fetchone()
        except sqlite3.Error:
            return None
        if row is None or row[0] is None:
            return None
        try:
            return float(row[0])
        except (TypeError, ValueError):
            return None

    def closer() -> None:
        for conn in conns.values():
            try:
                conn.close()
            except sqlite3.Error:
                pass
        conns.clear()

    return lookup, closer


def default_state_db_lookup(
    hermes_home: Optional[Path] = None,
) -> tuple[Callable[[str, str, str], Optional[float]], Callable[[], None]]:
    from wou.collect import discover_local_profiles, hermes_home_from_env

    home = Path(hermes_home or hermes_home_from_env())
    profile_dbs = {
        p["name"]: Path(p["state_db"]) for p in discover_local_profiles(home)
    }
    return make_state_db_timestamp_lookup(profile_dbs)
