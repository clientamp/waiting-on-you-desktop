"""Tests for wou.store."""

import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou.store import (
    Store,
    backfill_source_msg_at,
    fingerprint,
    normalize_ask,
    session_id_from_chat_key,
    similar,
    validate_actions,
)


class StoreTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp.name, "nested", "wou.db")
        self.store = Store(self.db_path)
        self.t0 = 1_700_000_000.0

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def _add(self, ask="Should we ship?", quadrant=1, chat_key="chat/a"):
        return self.store.upsert_task(
            chat_key=chat_key,
            agent="agent",
            chat_title="Title",
            ask=ask,
            topic="topic",
            quadrant=quadrant,
            source_msg_id="msg-1",
            now=self.t0,
        )

    def test_permissions_on_dir_and_db(self):
        parent = os.path.dirname(self.db_path)
        parent_mode = stat.S_IMODE(os.stat(parent).st_mode)
        db_mode = stat.S_IMODE(os.stat(self.db_path).st_mode)
        self.assertEqual(parent_mode, stat.S_IRWXU)
        self.assertEqual(db_mode, stat.S_IRUSR | stat.S_IWUSR)

    def test_normalize_and_fingerprint(self):
        self.assertEqual(normalize_ask("  Hello, World!  "), "hello world")
        fp = fingerprint("k", "Hello!")
        self.assertEqual(len(fp), 64)
        self.assertEqual(fp, fingerprint("k", "hello"))

    def test_similar_jaccard(self):
        self.assertEqual(similar("ship fix", "fix ship"), 1.0)
        self.assertGreaterEqual(similar("approve the deploy", "approve deploy now"), 0.5)

    def test_upsert_refuses_closed_fingerprint(self):
        task_id = self._add()
        self.assertIsNotNone(task_id)
        self.store.close_task(task_id, "done", now=self.t0)
        again = self._add()
        self.assertIsNone(again)

    def test_upsert_refuses_fuzzy_closed_match(self):
        task_id = self._add(ask="Should we ship the release today?")
        self.store.close_task(task_id, "dismissed", now=self.t0)
        paraphrase = self._add(ask="Should we ship release today")
        self.assertIsNone(paraphrase)

    def test_reopen_allows_re_add(self):
        task_id = self._add()
        self.store.close_task(task_id, "done", now=self.t0)
        self.assertIsNone(self._add())
        self.store.reopen_task(task_id, now=self.t0 + 1)
        new_id = self._add()
        self.assertEqual(new_id, task_id)

    def test_snooze_hides_then_returns(self):
        task_id = self._add()
        until = self.t0 + 3600
        self.store.snooze_task(task_id, until, now=self.t0)
        visible = self.store.list_tasks(now=self.t0)
        self.assertEqual(visible, [])
        after = self.store.list_tasks(now=until)
        self.assertEqual(len(after), 1)
        self.assertEqual(after[0]["status"], "open")
        self.assertIsNone(after[0]["snooze_until"])

    def test_locked_quadrant_survives_upsert(self):
        task_id = self._add(quadrant=1)
        self.store.set_quadrant(task_id, 3, locked=True, now=self.t0)
        self.store.upsert_task(
            chat_key="chat/a",
            agent="agent",
            chat_title="New title",
            ask="Should we ship?",
            topic="new topic",
            quadrant=2,
            source_msg_id="msg-2",
            now=self.t0 + 1,
        )
        row = self.store.list_tasks(include_closed=True, now=self.t0)[0]
        self.assertEqual(row["quadrant"], 3)
        self.assertTrue(row["quadrant_locked"])
        self.assertEqual(row["chat_title"], "New title")
        self.assertEqual(row["topic"], "new topic")

    def test_invalid_quadrant_raises(self):
        with self.assertRaises(ValueError):
            self._add(quadrant=5)
        task_id = self._add()
        with self.assertRaises(ValueError):
            self.store.set_quadrant(task_id, 0)

    def test_invalid_close_status_raises(self):
        task_id = self._add()
        with self.assertRaises(ValueError):
            self.store.close_task(task_id, "open", now=self.t0)

    def test_dirty_mark_and_pop(self):
        self.store.mark_dirty("chat/a", now=self.t0)
        self.store.mark_dirty("chat/b", now=self.t0 + 10)
        popped = self.store.pop_dirty(self.t0 + 5)
        self.assertEqual(popped, ["chat/a"])
        self.store.mark_dirty("chat/a", now=self.t0 + 20)
        self.assertEqual(self.store.pop_dirty(self.t0 + 100), ["chat/b", "chat/a"])

    def test_scan_state_roundtrip(self):
        self.assertIsNone(self.store.get_scan_state("chat/x"))
        self.store.set_scan_state("chat/x", "msg-99", self.t0)
        state = self.store.get_scan_state("chat/x")
        self.assertEqual(state["last_msg_id"], "msg-99")
        self.assertEqual(state["scanned_at"], self.t0)

    def test_open_and_closed_for_chat(self):
        task_id = self._add(chat_key="chat/z")
        self.assertEqual(len(self.store.open_tasks_for_chat("chat/z")), 1)
        self.store.close_task(task_id, "done", now=self.t0)
        self.assertEqual(self.store.open_tasks_for_chat("chat/z"), [])
        closed = self.store.closed_asks_for_chat("chat/z")
        self.assertEqual(len(closed), 1)
        self.assertEqual(closed[0]["status"], "done")

    def test_close_task_persists_last_msg_id(self):
        task_id = self._add()
        self.store.close_task(task_id, "done", now=self.t0)
        closed = self.store.closed_asks_for_chat("chat/a")
        self.assertEqual(closed[0]["last_msg_id"], "msg-1")

        self.store._conn.execute(
            "UPDATE tasks SET source_msg_id = ? WHERE id = ?",
            ("msg-9", task_id),
        )
        self.store.close_task(task_id, "dismissed", now=self.t0 + 5)
        closed = self.store.closed_asks_for_chat("chat/a")
        self.assertEqual(len(closed), 1)
        self.assertEqual(closed[0]["last_msg_id"], "msg-9")
        self.assertEqual(closed[0]["status"], "dismissed")
        self.assertEqual(closed[0]["closed_at"], self.t0 + 5)

    def test_closed_last_msg_id_migration(self):
        import sqlite3

        db_path = os.path.join(self.tmp.name, "legacy-closed.db")
        conn = sqlite3.connect(db_path)
        conn.executescript(
            """
            CREATE TABLE closed (
                fingerprint TEXT PRIMARY KEY,
                chat_key TEXT NOT NULL,
                ask TEXT NOT NULL,
                status TEXT NOT NULL,
                closed_at REAL NOT NULL
            );
            INSERT INTO closed (fingerprint, chat_key, ask, status, closed_at)
            VALUES ('fp-old', 'chat/legacy', 'Old closed ask', 'done', 10.0);
            """
        )
        conn.close()
        store = Store(db_path)
        cols = {
            r[1] for r in store._conn.execute("PRAGMA table_info(closed)").fetchall()
        }
        self.assertIn("last_msg_id", cols)
        closed = store.closed_asks_for_chat("chat/legacy")
        self.assertEqual(len(closed), 1)
        self.assertIsNone(closed[0]["last_msg_id"])
        self.assertEqual(closed[0]["ask"], "Old closed ask")
        store.close()

    def test_resolve_task_hides_from_list_and_not_in_closed(self):
        task_id = self._add()
        self.store.resolve_task(task_id, now=self.t0)
        self.assertEqual(self.store.list_tasks(now=self.t0), [])
        self.assertEqual(self.store.closed_asks_for_chat("chat/a"), [])
        rows = self.store.list_tasks(include_closed=True, now=self.t0)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["status"], "resolved")

    def test_upsert_reopens_resolved_task(self):
        task_id = self._add()
        self.store.resolve_task(task_id, now=self.t0)
        same = self.store.upsert_task(
            chat_key="chat/a",
            agent="agent",
            chat_title="Title",
            ask="Should we ship?",
            topic="topic",
            quadrant=2,
            source_msg_id="msg-2",
            now=self.t0 + 1,
        )
        self.assertEqual(same, task_id)
        visible = self.store.list_tasks(now=self.t0 + 1)
        self.assertEqual(len(visible), 1)
        self.assertEqual(visible[0]["status"], "open")
        self.assertEqual(visible[0]["quadrant"], 2)

    def test_rename_task_override_and_clear(self):
        task_id = self._add()
        self.store.rename_task(task_id, "  My title  ", now=self.t0)
        row = self.store.get_task(task_id)
        self.assertEqual(row["title_override"], "My title")
        self.store.upsert_task(
            chat_key="chat/a",
            agent="agent",
            chat_title="Title",
            ask="Should we ship?",
            topic="new scanner topic",
            quadrant=2,
            source_msg_id="msg-2",
            now=self.t0 + 1,
        )
        row = self.store.get_task(task_id)
        self.assertEqual(row["title_override"], "My title")
        self.assertEqual(row["topic"], "new scanner topic")
        self.store.rename_task(task_id, None, now=self.t0 + 2)
        self.assertIsNone(self.store.get_task(task_id)["title_override"])


class StoreGroupTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(os.path.join(self.tmp.name, "wou.db"))
        self.t0 = 1_700_000_000.0

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def test_list_task_groups_fallback_title(self):
        self.store.upsert_task(
            "c", "A", "Chat", "a1", "Bank", 2, "m1", now=self.t0
        )
        self.store.upsert_task(
            "c", "A", "Chat", "a2", "Bank", 3, "m2", now=self.t0 + 1
        )
        self.store.upsert_task(
            "c", "A", "Chat", "a3", "Other", 2, "m3", now=self.t0 + 2
        )
        open_tasks = self.store.list_tasks(now=self.t0 + 2)
        groups = self.store.list_task_groups(open_tasks)
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["title"], "Bank")
        self.assertEqual(groups[0]["quadrant"], 2)

    def test_group_quadrant_locked_over_children(self):
        self.store.upsert_task("c", "A", "T", "a1", "t", 1, "m1", now=self.t0)
        self.store.upsert_task("c", "A", "T", "a2", "t", 3, "m2", now=self.t0)
        self.store.set_group_quadrant("c", 4)
        groups = self.store.list_task_groups(self.store.list_tasks(now=self.t0))
        self.assertEqual(groups[0]["quadrant"], 4)

    def test_rename_group_locks_and_set_group_title_skips(self):
        self.store.upsert_task("chat/g", "A", "T", "a1", "t1", 1, "m1", now=self.t0)
        self.store.upsert_task("chat/g", "A", "T", "a2", "t2", 2, "m2", now=self.t0)
        self.store.rename_group("chat/g", "Locked name", now=self.t0)
        meta = self.store._get_chat_group_row("chat/g")
        self.assertTrue(meta["title_locked"])
        self.assertEqual(meta["title"], "Locked name")
        self.store.set_group_title("chat/g", "Scanner title", now=self.t0 + 1)
        meta = self.store._get_chat_group_row("chat/g")
        self.assertEqual(meta["title"], "Locked name")
        self.store.rename_group("chat/g", None, now=self.t0 + 2)
        meta = self.store._get_chat_group_row("chat/g")
        self.assertFalse(meta["title_locked"])
        self.store.set_group_title("chat/g", "Scanner title", now=self.t0 + 3)
        meta = self.store._get_chat_group_row("chat/g")
        self.assertEqual(meta["title"], "Scanner title")

    def test_close_all_open_tasks_for_chat(self):
        t1 = self.store.upsert_task("c", "A", "T", "a1", "t", 1, "m1", now=self.t0)
        t2 = self.store.upsert_task("c", "A", "T", "a2", "t", 2, "m2", now=self.t0)
        closed = self.store.close_all_open_tasks_for_chat("c", "done", now=self.t0)
        self.assertEqual(sorted(closed), sorted([t1, t2]))
        n = self.store._conn.execute("SELECT COUNT(*) FROM closed").fetchone()[0]
        self.assertEqual(n, 2)


class ManualTaskTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(os.path.join(self.tmp.name, "wou.db"))
        self.t0 = 1_700_000_000.0

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def test_add_manual_task_creates(self):
        tid = self.store.add_manual_task(
            "sess-1",
            "Alice",
            "My chat",
            "Follow up on this chat",
            "Follow up on this chat",
            2, now=self.t0,
        )
        task = self.store.get_task(tid)
        self.assertTrue(task["manual"])
        self.assertTrue(task["quadrant_locked"])
        self.assertIsNone(task["project"])
        self.assertEqual(task["status"], "open")
        self.assertIsNone(task["source_msg_id"])

    def test_add_manual_task_updates_same_fingerprint(self):
        tid1 = self.store.add_manual_task(
            "sess-1",
            "A",
            "T",
            "Same ask",
            "Same ask",
            1, now=self.t0,
        )
        tid2 = self.store.add_manual_task(
            "sess-1",
            "A",
            "T",
            "Same ask",
            "Same ask",
            3, now=self.t0 + 1,
        )
        self.assertEqual(tid1, tid2)
        task = self.store.get_task(tid2)
        self.assertEqual(task["quadrant"], 3)
        self.assertTrue(task["manual"])

    def test_add_manual_task_clears_closed_suppression(self):
        auto = self.store.upsert_task(
            "sess-1",
            "A",
            "T",
            "Dismissed ask",
            "topic",
            2,
            "m1",
            now=self.t0,
        )
        self.store.close_task(auto, "dismissed", now=self.t0)
        tid = self.store.add_manual_task(
            "sess-1",
            "A",
            "T",
            "Dismissed ask",
            "Dismissed ask",
            1, now=self.t0 + 1,
        )
        self.assertIsNotNone(tid)
        closed = self.store._conn.execute(
            "SELECT COUNT(*) FROM closed WHERE fingerprint = ?",
            (self.store.get_task(tid)["fingerprint"],),
        ).fetchone()[0]
        self.assertEqual(closed, 0)

    def test_add_manual_task_bad_quadrant(self):
        with self.assertRaises(ValueError):
            self.store.add_manual_task(
                "c", "A", "T", "x", "x", 9, now=self.t0
            )


    def test_session_tasks_open_and_snoozed(self):
        open_id = self.store.add_manual_task(
            "c", "A", "T", "open ask", "open ask", 1, now=self.t0
        )
        snoozed_id = self.store.add_manual_task(
            "c", "A", "T", "snooze ask", "snooze ask", 2, now=self.t0
        )
        self.store.snooze_task(snoozed_id, self.t0 + 3600, now=self.t0)
        done_id = self.store.add_manual_task(
            "c", "A", "T", "done ask", "done ask", 1, now=self.t0
        )
        self.store.close_task(done_id, "done", now=self.t0)
        tasks = self.store.session_tasks("c")
        ids = {t["id"] for t in tasks}
        self.assertEqual(ids, {open_id, snoozed_id})
        self.assertTrue(all("project" in t for t in tasks))


class StoreActionsTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp.name, "wou.db")
        self.store = Store(self.db_path)
        self.t0 = 1_700_000_000.0

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def _good_actions(self):
        return [
            {"id": "send", "label": "Send", "style": "primary"},
            {"id": "skip", "label": "Skip", "confirm": "Sure?", "kind": "run"},
            {"id": "details", "label": "Details", "kind": "details"},
        ]

    def test_validate_and_store_actions(self):
        validated = validate_actions(self._good_actions())
        self.assertEqual(len(validated), 3)
        task_id = self.store.upsert_task(
            "mailhist:x",
            "agent",
            "Title",
            "ask",
            "topic",
            1,
            "msg-1",
            now=self.t0,
            actions=self._good_actions(),
        )
        row = self.store.get_task(task_id)
        self.assertEqual(row["actions"], validated)

    def test_null_actions_returns_empty_list(self):
        task_id = self.store.upsert_task(
            "mailhist:x",
            "agent",
            "Title",
            "ask",
            "topic",
            1,
            "msg-1",
            now=self.t0,
        )
        self.assertEqual(self.store.get_task(task_id)["actions"], [])

    def test_upsert_updates_actions_on_existing_task(self):
        task_id = self.store.upsert_task(
            "mailhist:x",
            "agent",
            "Title",
            "ask",
            "topic",
            1,
            "msg-1",
            now=self.t0,
            actions=[{"id": "a", "label": "A"}],
        )
        self.store.upsert_task(
            "mailhist:x",
            "agent",
            "Title",
            "ask",
            "topic",
            1,
            "msg-1",
            now=self.t0 + 1,
            actions=[{"id": "b", "label": "B"}],
        )
        row = self.store.get_task(task_id)
        self.assertEqual(row["actions"][0]["id"], "b")

    def test_actions_migration_on_old_db(self):
        import sqlite3

        db_path = os.path.join(self.tmp.name, "legacy.db")
        conn = sqlite3.connect(db_path)
        conn.executescript(
            """
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY,
                chat_key TEXT, agent TEXT, chat_title TEXT,
                ask TEXT, topic TEXT, quadrant INTEGER, status TEXT,
                snooze_until REAL, source_msg_id TEXT,
                created_at REAL, updated_at REAL,
                fingerprint TEXT, quadrant_locked INTEGER DEFAULT 0,
                source_excerpt TEXT
            );
            """
        )
        conn.close()
        store = Store(db_path)
        cols = {
            r[1] for r in store._conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        store.close()
        self.assertIn("actions", cols)

    def test_validate_actions_rejects_too_many(self):
        items = [{"id": f"a{i}", "label": "x"} for i in range(5)]
        with self.assertRaises(ValueError):
            validate_actions(items)

    def test_validate_actions_rejects_bad_id(self):
        with self.assertRaises(ValueError):
            validate_actions([{"id": "BAD", "label": "x"}])

    def test_validate_actions_rejects_duplicate_ids(self):
        with self.assertRaises(ValueError):
            validate_actions(
                [{"id": "a", "label": "one"}, {"id": "a", "label": "two"}]
            )

    def test_validate_actions_rejects_missing_label(self):
        with self.assertRaises(ValueError):
            validate_actions([{"id": "a", "label": "  "}])

    def test_validate_actions_rejects_long_label(self):
        with self.assertRaises(ValueError):
            validate_actions([{"id": "a", "label": "x" * 41}])

    def test_validate_actions_rejects_long_confirm(self):
        with self.assertRaises(ValueError):
            validate_actions([{"id": "a", "label": "ok", "confirm": "x" * 201}])

    def test_validate_actions_rejects_bad_style(self):
        with self.assertRaises(ValueError):
            validate_actions([{"id": "a", "label": "ok", "style": "loud"}])

    def test_validate_actions_rejects_bad_kind(self):
        with self.assertRaises(ValueError):
            validate_actions([{"id": "a", "label": "ok", "kind": "fly"}])

    def test_validate_actions_drops_unknown_keys(self):
        out = validate_actions([{"id": "a", "label": "ok", "extra": 1}])
        self.assertEqual(out, [{"id": "a", "label": "ok", "style": "default", "kind": "run"}])

    def test_source_msg_at_on_insert_and_survives_rescan_without_value(self):
        msg_at = self.t0 - 86_400
        task_id = self.store.upsert_task(
            chat_key="chat/a",
            agent="agent",
            chat_title="Title",
            ask="Should we ship?",
            topic="topic",
            quadrant=1,
            source_msg_id="msg-1",
            now=self.t0,
            source_msg_at=msg_at,
        )
        self.assertIsNotNone(task_id)
        row = self.store.get_task(task_id)
        self.assertEqual(row["source_msg_at"], msg_at)

        self.store.upsert_task(
            chat_key="chat/a",
            agent="agent",
            chat_title="Title",
            ask="Should we ship?",
            topic="topic",
            quadrant=1,
            source_msg_id="msg-1",
            now=self.t0 + 99_999,
        )
        row = self.store.get_task(task_id)
        self.assertEqual(row["source_msg_at"], msg_at)
        self.assertEqual(row["updated_at"], self.t0 + 99_999)

    def test_source_msg_at_rescan_can_update_when_provided(self):
        task_id = self.store.upsert_task(
            chat_key="chat/a",
            agent="agent",
            chat_title="Title",
            ask="Should we ship?",
            topic="topic",
            quadrant=1,
            source_msg_id="msg-1",
            now=self.t0,
        )
        first = self.t0 - 5000
        self.store.upsert_task(
            chat_key="chat/a",
            agent="agent",
            chat_title="Title",
            ask="Should we ship?",
            topic="topic",
            quadrant=1,
            source_msg_id="msg-1",
            now=self.t0 + 1,
            source_msg_at=first,
        )
        second = self.t0 - 1000
        self.store.upsert_task(
            chat_key="chat/a",
            agent="agent",
            chat_title="Title",
            ask="Should we ship?",
            topic="topic",
            quadrant=1,
            source_msg_id="msg-1",
            now=self.t0 + 2,
            source_msg_at=second,
        )
        row = self.store.get_task(task_id)
        self.assertEqual(row["source_msg_at"], second)

    def test_backfill_source_msg_at(self):
        import sqlite3

        state_db = os.path.join(self.tmp.name, "state.db")
        conn = sqlite3.connect(state_db)
        conn.execute(
            "CREATE TABLE messages (id TEXT, session_id TEXT, timestamp REAL)"
        )
        conn.execute(
            "INSERT INTO messages VALUES (?, ?, ?)",
            ("msg-1", "sess-1", self.t0 - 3600),
        )
        conn.commit()
        conn.close()

        task_id = self.store.upsert_task(
            chat_key="sess-1",
            agent="agent",
            chat_title="Title",
            ask="Ask?",
            topic="topic",
            quadrant=1,
            source_msg_id="msg-1",
            now=self.t0,
        )
        self.assertIsNone(self.store.get_task(task_id)["source_msg_at"])

        def lookup(chat_key: str, session_id: str, msg_id: str):
            self.assertEqual(session_id_from_chat_key(chat_key), session_id)
            if msg_id != "msg-1":
                return None
            c = sqlite3.connect(Path(state_db).expanduser().resolve().as_uri() + "?mode=ro", uri=True)
            row = c.execute(
                "SELECT timestamp FROM messages WHERE id = ? AND session_id = ?",
                (msg_id, session_id),
            ).fetchone()
            c.close()
            return float(row[0]) if row else None

        n = backfill_source_msg_at(self.store, lookup)
        self.assertEqual(n, 1)
        self.assertEqual(
            self.store.get_task(task_id)["source_msg_at"], self.t0 - 3600
        )
        self.assertEqual(backfill_source_msg_at(self.store, lookup), 0)


if __name__ == "__main__":
    unittest.main()
