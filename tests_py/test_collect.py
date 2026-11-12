"""Tests for wou.collect."""

from __future__ import annotations

import json
import os
import sqlite3
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou.collect import (
    Config,
    change_signature,
    clip,
    collect_all,
    collect_db,
    discover_local_profiles,
    run_remote,
)


def make_state_db(
    path: Path,
    *,
    with_archived: bool = True,
    with_hidden: bool = True,
    with_last_activity: bool = True,
    with_active: bool = True,
    with_created_source: bool = True,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    sess_cols = [
        "id TEXT PRIMARY KEY",
        "source TEXT",
        "title TEXT",
        "started_at REAL",
        "parent_session_id TEXT",
    ]
    if with_created_source:
        sess_cols.append("created_source TEXT")
    if with_archived:
        sess_cols.append("archived INTEGER DEFAULT 0")
    if with_hidden:
        sess_cols.append("hidden INTEGER DEFAULT 0")
    if with_last_activity:
        sess_cols.append("last_activity_at REAL")
    conn.execute(f"CREATE TABLE sessions ({', '.join(sess_cols)})")

    msg_cols = [
        "id TEXT PRIMARY KEY",
        "session_id TEXT",
        "role TEXT",
        "content TEXT",
    ]
    if with_active:
        msg_cols.append("active INTEGER DEFAULT 1")
    msg_cols.append("timestamp REAL")
    conn.execute(f"CREATE TABLE messages ({', '.join(msg_cols)})")
    conn.commit()
    conn.close()


def add_session(
    path: Path,
    sid: str,
    source: str = "desktop",
    title: str = "Chat",
    started_at: float = 1_700_000_000.0,
    last_activity_at: float | None = None,
    archived: int = 0,
    hidden: int = 0,
    parent_session_id: str | None = None,
    created_source: str | None = None,
) -> None:
    conn = sqlite3.connect(path)
    cols = conn.execute("PRAGMA table_info(sessions)").fetchall()
    col_names = {c[1] for c in cols}
    fields = ["id", "source", "title", "started_at"]
    vals = [sid, source, title, started_at]
    if "created_source" in col_names:
        fields.append("created_source")
        vals.append(created_source)
    if "last_activity_at" in col_names:
        fields.append("last_activity_at")
        vals.append(last_activity_at if last_activity_at is not None else started_at)
    if "archived" in col_names:
        fields.append("archived")
        vals.append(archived)
    if "hidden" in col_names:
        fields.append("hidden")
        vals.append(hidden)
    if "parent_session_id" in col_names:
        fields.append("parent_session_id")
        vals.append(parent_session_id)
    ph = ",".join("?" * len(fields))
    conn.execute(
        f"INSERT INTO sessions ({','.join(fields)}) VALUES ({ph})", vals
    )
    conn.commit()
    conn.close()


def add_message(
    path: Path,
    mid: str,
    session_id: str,
    role: str,
    content: str,
    active: int = 1,
    timestamp: float | None = None,
) -> None:
    conn = sqlite3.connect(path)
    cols = conn.execute("PRAGMA table_info(messages)").fetchall()
    col_names = {c[1] for c in cols}
    fields = ["id", "session_id", "role", "content"]
    vals = [mid, session_id, role, content]
    if "active" in col_names:
        fields.append("active")
        vals.append(active)
    if "timestamp" in col_names:
        fields.append("timestamp")
        vals.append(timestamp if timestamp is not None else 0.0)
    ph = ",".join("?" * len(fields))
    conn.execute(
        f"INSERT INTO messages ({','.join(fields)}) VALUES ({ph})", vals
    )
    conn.commit()
    conn.close()


class ClipTestCase(unittest.TestCase):
    def test_clip_short(self):
        self.assertEqual(clip("hello world", 100), "hello world")

    def test_clip_long(self):
        s = "x" * 400
        out = clip(s, 10)
        self.assertTrue(out.startswith("…"))
        self.assertEqual(len(out), 11)


class CollectDbTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "state.db"
        make_state_db(self.db)
        self.now = 1_700_100_000.0
        self.cfg = Config.from_dict(
            {"days": 10, "local_profiles": [{"name": "default", "state_db": str(self.db)}]},
            hermes_home=Path(self.tmp.name),
        )

    def tearDown(self):
        self.tmp.cleanup()

    def seed_surface(self, sid, source, created_source=None, **kwargs):
        add_session(self.db, sid, source=source, created_source=created_source,
                    started_at=self.now - 50, **kwargs)
        add_message(self.db, sid + "-m", sid, "user", "hello")

    def test_surface_explicit_local_is_unrestricted(self):
        from wou.collect import source_label_drift
        for sid, created in [("desktop", "desktop"), ("tui", "tui"), ("cli", "cli"), ("unset", None)]:
            self.seed_surface(sid, "local", created)
        for sources in [["local"], ["local", "desktop"]]:
            with self.subTest(sources=sources):
                self.cfg.sources = sources
                self.assertEqual({r["id"] for r in collect_db(self.db, self.cfg, now=self.now)},
                                 {"desktop", "tui", "cli", "unset"})
                self.assertEqual(source_label_drift(self.db, self.cfg, now=self.now), {})

    def test_surface_defaults_include_local_and_gui(self):
        for sid, source, created in [
            ("local-desktop", "local", "desktop"), ("gui", "gui", "desktop"),
            ("local-gui", "local", "gui"), ("local-tui", "local", "tui"),
            ("desktop", "desktop", None), ("tui", "tui", None),
            ("webui", "webui", None),
        ]:
            self.seed_surface(sid, source, created)
        self.assertEqual({r["id"] for r in collect_db(self.db, self.cfg, now=self.now)},
                         {"local-desktop", "gui", "local-gui", "local-tui", "desktop", "tui", "webui"})

    def test_surface_defaults_exclude_unrequested_and_ineligible(self):
        for i, created in enumerate(["cli", "acp", None, "", "local", "webui"]):
            self.seed_surface(str(i), "local", created)
        for source in ["oneshot", "tool", "kanban", "cron", "subagent"]:
            self.seed_surface(source, source, "desktop")
        for sid, flags in [("child", {"parent_session_id": "parent"}),
                           ("archived", {"archived": 1}), ("hidden", {"hidden": 1})]:
            self.seed_surface(sid, "local", "desktop", **flags)
        self.assertEqual(collect_db(self.db, self.cfg, now=self.now), [])

    def test_surface_cli_is_opt_in_without_tool_aliases(self):
        self.cfg.sources = ["cli"]
        for sid, source, created in [("new", "local", "cli"), ("old", "cli", None),
                                     ("desktop", "local", "desktop"),
                                     ("tool", "tool", "cli"), ("oneshot", "oneshot", "cli")]:
            self.seed_surface(sid, source, created)
        self.assertEqual({r["id"] for r in collect_db(self.db, self.cfg, now=self.now)}, {"new", "old"})

    def test_surface_old_schema_excludes_local(self):
        self.db.unlink()
        make_state_db(self.db, with_created_source=False)
        for source in ["desktop", "tui", "webui", "local"]:
            self.seed_surface(source, source)
        self.assertEqual({r["id"] for r in collect_db(self.db, self.cfg, now=self.now)},
                         {"desktop", "tui", "webui"})

    def test_surface_labels_are_bound_parameters(self):
        label = "odd'label"
        self.cfg.sources = [label]
        self.seed_surface("literal", label)
        self.seed_surface("other", "desktop")
        self.assertEqual([r["id"] for r in collect_db(self.db, self.cfg, now=self.now)], ["literal"])

    def test_surface_groups_match_hermes(self):
        import importlib
        try:
            policy = importlib.import_module("gateway.session_policy")
        except ImportError:
            with mock.patch.object(sys, "path", [str(Path.home() / ".hermes/hermes-agent"), *sys.path]):
                try:
                    policy = importlib.import_module("gateway.session_policy")
                except ImportError as exc:
                    self.skipTest(f"Hermes session policy unavailable: {exc}")
        self.assertEqual(collect_db.__globals__.get("SURFACE_GROUPS"), policy.SURFACE_GROUPS)

    def test_missing_db_returns_empty(self):
        self.assertEqual(collect_db("/no/such/db.sqlite", self.cfg), [])

    def test_basic_chat(self):
        add_session(self.db, "s1", title="Hello", started_at=self.now - 100)
        add_message(self.db, "m1", "s1", "user", "Hi there")
        add_message(self.db, "m2", "s1", "assistant", "Hello!")
        rows = collect_db(self.db, self.cfg, now=self.now)
        self.assertEqual(len(rows), 1)
        r = rows[0]
        self.assertEqual(r["id"], "s1")
        self.assertEqual(r["last_msg_id"], "m2")
        self.assertEqual(r["last_role"], "assistant")
        self.assertIn("Hi there", r["user_last"])
        self.assertIn("Hello!", r["agent_last"])

    def test_filters_archived_hidden_child_cron(self):
        add_session(self.db, "ok", started_at=self.now - 50)
        add_message(self.db, "m1", "ok", "user", "yes")
        add_session(self.db, "arch", archived=1, started_at=self.now - 50)
        add_message(self.db, "m2", "arch", "user", "no")
        add_session(self.db, "hid", hidden=1, started_at=self.now - 50)
        add_message(self.db, "m3", "hid", "user", "no")
        add_session(
            self.db, "child", parent_session_id="ok", started_at=self.now - 50
        )
        add_message(self.db, "m4", "child", "user", "no")
        add_session(self.db, "cron", source="cron", started_at=self.now - 50)
        add_message(self.db, "m5", "cron", "user", "no")
        rows = collect_db(self.db, self.cfg, now=self.now)
        self.assertEqual([r["id"] for r in rows], ["ok"])

    def test_skip_title_prefix_and_contains(self):
        self.cfg.skip_title_prefixes = ["Subagent:"]
        self.cfg.skip_title_contains = ["Parallel Test"]
        add_session(self.db, "a", title="Subagent: foo", started_at=self.now - 50)
        add_message(self.db, "m1", "a", "user", "x")
        add_session(self.db, "b", title="My Parallel Test chat", started_at=self.now - 50)
        add_message(self.db, "m2", "b", "user", "x")
        add_session(self.db, "c", title="Good chat", started_at=self.now - 50)
        add_message(self.db, "m3", "c", "user", "x")
        rows = collect_db(self.db, self.cfg, now=self.now)
        self.assertEqual([r["id"] for r in rows], ["c"])

    def test_old_chats_excluded(self):
        add_session(self.db, "old", started_at=self.now - 20 * 86400)
        add_message(self.db, "m1", "old", "user", "stale")
        add_session(self.db, "new", started_at=self.now - 100)
        add_message(self.db, "m2", "new", "user", "fresh")
        rows = collect_db(self.db, self.cfg, now=self.now)
        self.assertEqual([r["id"] for r in rows], ["new"])

    def test_last_role_user(self):
        add_session(self.db, "s1", started_at=self.now - 50)
        add_message(self.db, "m1", "s1", "assistant", "first")
        add_message(self.db, "m2", "s1", "user", "last word mine")
        rows = collect_db(self.db, self.cfg, now=self.now)
        self.assertEqual(rows[0]["last_role"], "user")

    def test_clipping(self):
        self.cfg.user_chars = 5
        self.cfg.tail_chars = 8
        add_session(self.db, "s1", started_at=self.now - 50)
        add_message(self.db, "m1", "s1", "user", "one two three four five six")
        add_message(self.db, "m2", "s1", "assistant", "a b c d e f g h i j k")
        rows = collect_db(self.db, self.cfg, now=self.now)
        self.assertTrue(rows[0]["user_last"].startswith("…"))
        self.assertTrue(rows[0]["agent_last"].startswith("…"))

    def test_no_messages_skipped(self):
        add_session(self.db, "empty", started_at=self.now - 50)
        self.assertEqual(collect_db(self.db, self.cfg, now=self.now), [])

    def test_inactive_messages_ignored(self):
        add_session(self.db, "s1", started_at=self.now - 50)
        add_message(self.db, "m1", "s1", "user", "old", active=0)
        self.assertEqual(collect_db(self.db, self.cfg, now=self.now), [])

    def test_db_without_optional_columns(self):
        minimal = Path(self.tmp.name) / "minimal.db"
        minimal.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(minimal)
        conn.execute(
            "CREATE TABLE sessions (id TEXT PRIMARY KEY, source TEXT, title TEXT, started_at REAL, parent_session_id TEXT)"
        )
        conn.execute(
            "CREATE TABLE messages (id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT)"
        )
        conn.commit()
        conn.close()
        add_session(minimal, "s1", started_at=self.now - 50)
        conn = sqlite3.connect(minimal)
        conn.execute(
            "INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)",
            ("m1", "s1", "user", "hi"),
        )
        conn.commit()
        conn.close()
        rows = collect_db(minimal, self.cfg, now=self.now)
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0].get("last_msg_at"))

    def test_last_msg_at_from_latest_message_timestamp(self):
        msg_ts = self.now - 12345.5
        add_session(self.db, "s1", started_at=self.now - 100)
        add_message(self.db, "m1", "s1", "user", "Hi", timestamp=self.now - 99999)
        add_message(
            self.db, "m2", "s1", "assistant", "Hello!", timestamp=msg_ts
        )
        rows = collect_db(self.db, self.cfg, now=self.now)
        self.assertEqual(rows[0]["last_msg_id"], "m2")
        self.assertEqual(rows[0]["last_msg_at"], msg_ts)


class CollectAllTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name) / "hermes"
        self.home.mkdir()
        self.default_db = self.home / "state.db"
        make_state_db(self.default_db)
        self.work_dir = self.home / "profiles" / "work"
        self.work_db = self.work_dir / "state.db"
        make_state_db(self.work_db)
        self.now = 1_700_100_000.0
        self.cache = Path(self.tmp.name) / "cache"

    def tearDown(self):
        self.tmp.cleanup()

    def test_surface_drift_ignores_known_handoffs(self):
        cfg = Config.from_dict({}, hermes_home=self.home)
        for source in ["telegram", "slack", "api_server", "mobile", "push", "future-platform"]:
            with self.subTest(source=source):
                add_session(self.default_db, source, source=source, created_source="desktop",
                            started_at=self.now - 50)
                self.assertEqual(collect_all(cfg, self.cache, now=self.now)[1], [])
        add_session(self.default_db, "unknown", source="owner", created_source="desktop",
                    started_at=self.now - 50)
        self.assertEqual(collect_all(cfg, self.cache, now=self.now)[1],
                         ['default: 1 recent chat uses storage label "owner", which this version cannot read. Update the plugin.'])

    def test_known_labels_cover_hermes(self):
        import importlib
        from wou import collect
        try:
            labels = set(importlib.import_module("hermes_state_local_migration").not_client_labels())
        except ImportError:
            with mock.patch.object(sys, "path", [str(Path.home() / ".hermes/hermes-agent"), *sys.path]):
                try:
                    labels = set(importlib.import_module("hermes_state_local_migration").not_client_labels())
                except ImportError as exc:
                    self.skipTest(f"Hermes label migration unavailable: {exc}")
        self.assertLessEqual(labels, collect.KNOWN_HERMES_LABELS)

    def test_surface_drift_note_matches_panel_sample(self):
        from wou.collect import _source_drift_note
        self.assertEqual(_source_drift_note("default", {"owner": 12}),
                         'default: 12 recent chats use storage label "owner", which this version cannot read. Update the plugin.')

    def test_surface_drift_note_and_metadata_only(self):
        from wou import collect
        cases = [("unknown", "owner", "desktop", {}),
                 ("matched", "local", "desktop", {}),
                 ("other", "owner", "cli", {}),
                 ("child", "owner", "desktop", {"parent_session_id": "p"}),
                 ("archived", "owner", "desktop", {"archived": 1}),
                 ("hidden", "owner", "desktop", {"hidden": 1})]
        for sid, source, created, flags in cases:
            add_session(self.default_db, sid, source=source, created_source=created,
                        started_at=self.now - 50, **flags)
        add_session(self.default_db, "old", source="owner", created_source="desktop",
                    started_at=self.now - 20 * 86400)
        cfg = Config.from_dict({}, hermes_home=self.home)
        _, notes = collect_all(cfg, self.cache, now=self.now)
        self.assertEqual(notes, ['default: 1 recent chat uses storage label "owner", which this version cannot read. Update the plugin.'])
        real_connect = sqlite3.connect
        reads = []
        def metadata_connection(*args, **kwargs):
            conn = real_connect(*args, **kwargs)
            def authorize(action, table, column, *_):
                if action == sqlite3.SQLITE_READ:
                    reads.append((table, column))
                    if table == "messages":
                        return sqlite3.SQLITE_DENY
                return sqlite3.SQLITE_OK
            conn.set_authorizer(authorize)
            return conn
        with mock.patch.object(collect.sqlite3, "connect", side_effect=metadata_connection):
            self.assertEqual(collect.source_label_drift(self.default_db, cfg, now=self.now), {"owner": 1})
        self.assertTrue(reads)
        self.assertTrue(all(table == "sessions" for table, _ in reads))

    def test_surface_drift_no_note_for_matching_or_other_surfaces(self):
        for sid, source, created in [("matched", "local", "desktop"), ("other", "owner", "cli")]:
            add_session(self.default_db, sid, source=source, created_source=created,
                        started_at=self.now - 50)
        cfg = Config.from_dict({}, hermes_home=self.home)
        self.assertEqual(collect_all(cfg, self.cache, now=self.now)[1], [])

    def test_surface_drift_failure_does_not_break_collection(self):
        add_session(self.default_db, "ok", started_at=self.now - 50)
        add_message(self.default_db, "m", "ok", "user", "hello")
        cfg = Config.from_dict({}, hermes_home=self.home)
        with mock.patch.dict(collect_all.__globals__, {"source_label_drift": mock.Mock(side_effect=RuntimeError("unavailable"))}):
            chats, notes = collect_all(cfg, self.cache, now=self.now)
        self.assertEqual([r["id"] for r in chats], ["ok"])
        self.assertEqual(notes, [])

    def test_surface_drift_note_bounds_and_sanitization(self):
        label = "bad label\n" + "x" * 100
        add_session(self.default_db, "unknown", source=label, created_source="desktop",
                    started_at=self.now - 50)
        cfg = Config.from_dict({}, hermes_home=self.home)
        _, notes = collect_all(cfg, self.cache, now=self.now)
        self.assertEqual(len(notes), 1)
        self.assertLessEqual(len(notes[0]), 200)
        self.assertNotIn("\n", notes[0])
        self.assertIn('"badlabel' + 'x' * 24 + '"', notes[0])

    def test_discover_profiles_and_keys(self):
        add_session(self.default_db, "d1", started_at=self.now - 50)
        add_message(self.default_db, "m1", "d1", "user", "x")
        add_session(self.work_db, "k1", started_at=self.now - 50)
        add_message(self.work_db, "m2", "k1", "user", "y")
        profiles = discover_local_profiles(self.home)
        names = [p["name"] for p in profiles]
        self.assertIn("default", names)
        self.assertIn("work", names)
        cfg = Config.from_dict(
            {"agent_names": {"default": "Alice", "work": "Bob"}},
            hermes_home=self.home,
        )
        chats, notes = collect_all(cfg, self.cache, now=self.now)
        self.assertEqual(notes, [])
        keys = {c["key"] for c in chats}
        self.assertIn("d1", keys)
        self.assertIn("work:k1", keys)
        agents = {c["key"]: c["agent"] for c in chats}
        self.assertEqual(agents["d1"], "Alice")
        self.assertEqual(agents["work:k1"], "Bob")

    def test_sort_by_last_active(self):
        add_session(self.default_db, "slow", started_at=self.now - 5000)
        add_message(self.default_db, "m1", "slow", "user", "a")
        add_session(self.default_db, "fast", started_at=self.now - 10)
        add_message(self.default_db, "m2", "fast", "user", "b")
        cfg = Config.from_dict({}, hermes_home=self.home)
        chats, _ = collect_all(cfg, self.cache, now=self.now)
        self.assertEqual([c["id"] for c in chats], ["fast", "slow"])

    def test_remote_stale_flag_survives(self):
        cfg = Config.from_dict(
            {
                "days": 10,
                "local_profiles": [],
                "remote_hosts": [
                    {
                        "name": "studio-mac",
                        "ssh_host": "studio-mac",
                        "state_db": "/remote/state.db",
                    }
                ],
            },
            hermes_home=self.home,
        )
        row = {
            "id": "c1",
            "last_active": self.now,
            "last_msg_id": "m1",
            "last_role": "assistant",
            "stale": True,
        }
        # Patch the globals collect_all actually closes over. Other tests drop
        # wou.* from sys.modules, so a string patch can miss this binding.
        fake_remote = mock.Mock(return_value=([row], "using list cached"))
        with mock.patch.dict(collect_all.__globals__, {"run_remote": fake_remote}):
            chats, notes = collect_all(cfg, self.cache, now=self.now)
        fake_remote.assert_called_once()
        self.assertEqual(notes, ["using list cached"])
        self.assertEqual(len(chats), 1)
        self.assertTrue(chats[0]["stale"])
        self.assertEqual(chats[0]["key"], "studio-mac:c1")


class RunRemoteTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = Path(self.tmp.name) / "cache"
        self.cache.mkdir()
        self.cfg = Config.from_dict({"days": 10})
        self.host = {
            "name": "studio-mac",
            "ssh_host": "studio-mac",
            "state_db": "/remote/state.db",
        }

    def tearDown(self):
        self.tmp.cleanup()

    def test_success_writes_cache(self):
        chats = [{"id": "r1", "title": "Title", "source": "desktop", "last_active": 100.0, "last_msg_id": "m1", "last_role": "user", "user_last": "", "agent_last": "", "cwd": "", "profile": "default", "project": None}]
        proc = mock.Mock(returncode=0, stdout=json.dumps(chats), stderr="")
        with mock.patch("wou.collect.subprocess.run", return_value=proc) as run:
            rows, note = run_remote(self.host, self.cfg, self.cache)
        self.assertIsNone(note)
        self.assertEqual(rows, chats)
        cache_file = self.cache / "studio-mac.json"
        self.assertTrue(cache_file.is_file())
        mode = stat.S_IMODE(cache_file.stat().st_mode)
        self.assertEqual(mode, stat.S_IRUSR | stat.S_IWUSR)
        run.assert_called_once()
        self.assertIn("BatchMode=yes", run.call_args[0][0])

    def test_failure_uses_cache(self):
        cached = {
            "at": 1_700_000_000.0,
            "chats": [
                {
                    "id": "c1",
                    "source": "desktop",
                    "title": "T",
                    "last_active": 1.0,
                    "last_msg_id": "m1",
                    "last_role": "assistant",
                    "user_last": "",
                    "agent_last": "hi",
                }
            ],
        }
        (self.cache / "studio-mac.json").write_text(json.dumps(cached))
        proc = mock.Mock(returncode=1, stdout="", stderr="connection refused")
        with mock.patch("wou.collect.subprocess.run", return_value=proc):
            rows, note = run_remote(self.host, self.cfg, self.cache)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], "c1")
        self.assertTrue(rows[0]["stale"])
        self.assertIn("unreachable", note or "")
        self.assertIn("cached", note or "")
        on_disk = json.loads((self.cache / "studio-mac.json").read_text())
        self.assertNotIn("stale", on_disk["chats"][0])

    def test_ssh_255_marks_cache_rows_stale(self):
        cached = {
            "at": 1_700_000_000.0,
            "chats": [
                {
                    "id": "c1",
                    "source": "desktop",
                    "title": "T",
                    "last_active": 1.0,
                    "last_msg_id": "m1",
                    "last_role": "assistant",
                    "user_last": "",
                    "agent_last": "hi",
                }
            ],
        }
        cache_file = self.cache / "studio-mac.json"
        cache_file.write_text(json.dumps(cached))
        original = cache_file.read_text()
        proc = mock.Mock(returncode=255, stdout="", stderr="ssh failed")
        with mock.patch("wou.collect.subprocess.run", return_value=proc):
            rows, note = run_remote(self.host, self.cfg, self.cache)
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["stale"])
        self.assertEqual(rows[0]["id"], "c1")
        self.assertIn("cached", note or "")
        self.assertEqual(cache_file.read_text(), original)
        self.assertNotIn("stale", json.loads(original)["chats"][0])

    def test_failure_no_cache(self):
        proc = mock.Mock(returncode=1, stdout="", stderr="fail")
        with mock.patch("wou.collect.subprocess.run", return_value=proc):
            rows, note = run_remote(self.host, self.cfg, self.cache)
        self.assertEqual(rows, [])
        self.assertIn("no studio-mac cache yet", note or "")


class ChangeSignatureTestCase(unittest.TestCase):
    def test_stable_sorted(self):
        chats = [
            {"key": "b", "last_msg_id": "2", "last_role": "assistant"},
            {"key": "a", "last_msg_id": "1", "last_role": "user"},
        ]
        sig = change_signature(chats)
        self.assertEqual(sig, "a|1|D\nb|2|A")
        self.assertEqual(change_signature(list(reversed(chats))), sig)

    def test_no_timestamps(self):
        sig = change_signature(
            [{"key": "x", "last_msg_id": "m", "last_role": "user"}]
        )
        self.assertNotIn(".", sig)
        self.assertEqual(sig, "x|m|D")


class MainEmitJsonTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "state.db"
        make_state_db(self.db)
        self.now = 1_700_100_000.0

    def tearDown(self):
        self.tmp.cleanup()

    def test_emit_json_via_main(self):
        ts = time.time() - 50
        add_session(self.db, "s1", started_at=ts)
        add_message(self.db, "m1", "s1", "user", "test")
        from io import StringIO

        from wou.collect import main

        buf = StringIO()
        cfg_json = json.dumps({"days": 10})
        with mock.patch("sys.stdout", buf):
            main(
                [
                    "--emit-json",
                    "--db",
                    str(self.db),
                    "--config-json",
                    cfg_json,
                ]
            )
        data = json.loads(buf.getvalue())
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], "s1")


class StandaloneReaderTestCase(unittest.TestCase):
    def test_stdin_emit_json_without_package(self):
        repo = Path(__file__).resolve().parents[1]
        src = (repo / "wou" / "collect.py").read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "state.db"
            make_state_db(db)
            started = time.time() - 50
            add_session(db, "seeded", title="Seeded chat", started_at=started)
            add_message(db, "m1", "seeded", "user", "hello from seed")
            env = os.environ.copy()
            env.pop("PYTHONPATH", None)
            env["HERMES_HOME"] = tmp
            proc = subprocess.run(
                [
                    sys.executable,
                    "-",
                    "--emit-json",
                    "--db",
                    str(db),
                    "--config-json",
                    "{}",
                ],
                input=src,
                capture_output=True,
                text=True,
                cwd=tmp,
                env=env,
                check=False,
            )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertEqual([row["id"] for row in data], ["seeded"])




if __name__ == "__main__":
    unittest.main()
