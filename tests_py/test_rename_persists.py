"""Card rename persists across group transitions and scanner upserts."""

from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

from wou.store import Store


def _load_api_module():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for key in list(sys.modules):
        if key == "wou" or key.startswith("wou.") or key == "wou_dashboard_api":
            del sys.modules[key]
    path = os.path.join(root, "dashboard", "plugin_api.py")
    spec = importlib.util.spec_from_file_location("wou_dashboard_api", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


@unittest.skipUnless(HAS_FASTAPI, "fastapi not installed")
class RenamePersistsApiTest(unittest.TestCase):
    t0 = 1_700_000_000.0

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name
        self.api = _load_api_module()
        app = FastAPI()
        app.include_router(self.api.router)
        self.client = TestClient(app)

    def tearDown(self):
        self.tmp.cleanup()

    def _patch_data_dir(self):
        return mock.patch.object(
            self.api, "plugin_data_directory", return_value=self.data_dir
        )

    def _db_path(self) -> str:
        return os.path.join(self.data_dir, "wou.db")

    def test_rename_persists_through_group_and_rescan(self):
        chat_key = "sess-rename"
        with self._patch_data_dir():
            store = Store(self._db_path())
            tid = store.upsert_task(
                chat_key, "A", "T", "ask one", "topic", 2, "m1", now=self.t0
            )
            store.close()

            resp = self.client.patch(f"/tasks/{tid}", json={"title": "My name"})
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["task"]["title_override"], "My name")

            store = Store(self._db_path())
            meta = store._get_chat_group_row(chat_key)
            self.assertTrue(meta["title_locked"])
            self.assertEqual(meta["title"], "My name")
            row = store.list_tasks(now=self.t0)[0]
            self.assertEqual(row["chat_name"], "My name")
            store.close()

            store = Store(self._db_path())
            store.upsert_task(
                chat_key, "A", "T", "ask two", "topic2", 3, "m2", now=self.t0 + 1
            )
            store.close()

            listed = self.client.get("/tasks")
            self.assertEqual(listed.status_code, 200)
            body = listed.json()
            groups = [g for g in body["groups"] if g["chat_key"] == chat_key]
            self.assertEqual(len(groups), 1)
            self.assertEqual(groups[0]["title"], "My name")
            self.assertTrue(groups[0]["title_locked"])

            store = Store(self._db_path())
            store.set_group_title(chat_key, "Scanner title", now=self.t0 + 2)
            meta = store._get_chat_group_row(chat_key)
            self.assertEqual(meta["title"], "My name")
            old_fp_task = tid
            new_tid = store.upsert_task(
                chat_key,
                "A",
                "T",
                "reworded ask one",
                "topic",
                2,
                "m3",
                now=self.t0 + 3,
            )
            store.resolve_task(old_fp_task, now=self.t0 + 3)
            new_row = store.get_task(new_tid)
            self.assertEqual(new_row["chat_name"], "My name")
            tasks = store.open_tasks_for_chat(chat_key)
            child_two = next(t for t in tasks if t["id"] != new_tid)
            store.rename_task(child_two["id"], "Other label", now=self.t0 + 4)
            store.close()

            patch_group = self.client.patch(
                f"/groups/{chat_key}", json={"title": "New name"}
            )
            self.assertEqual(patch_group.status_code, 200)

            store = Store(self._db_path())
            self.assertEqual(
                store.get_task(old_fp_task)["title_override"], "New name"
            )
            self.assertEqual(store.get_task(new_tid)["chat_name"], "New name")
            self.assertEqual(
                store.get_task(child_two["id"])["title_override"], "Other label"
            )
            store.close()

    def test_nested_child_rename_does_not_touch_chat_groups(self):
        chat_key = "sess-nested"
        with self._patch_data_dir():
            store = Store(self._db_path())
            t1 = store.upsert_task(
                chat_key, "A", "T", "a1", "t1", 1, "m1", now=self.t0
            )
            t2 = store.upsert_task(
                chat_key, "A", "T", "a2", "t2", 2, "m2", now=self.t0
            )
            store.close()

            resp = self.client.patch(f"/tasks/{t1}", json={"title": "Child name"})
            self.assertEqual(resp.status_code, 200)

            store = Store(self._db_path())
            meta = store._get_chat_group_row(chat_key)
            self.assertIsNone(meta)
            self.assertEqual(store.get_task(t1)["title_override"], "Child name")
            store.close()

    def test_clear_standalone_rename(self):
        chat_key = "sess-clear"
        with self._patch_data_dir():
            store = Store(self._db_path())
            tid = store.upsert_task(
                chat_key, "A", "T", "x", "topic", 1, "m", now=self.t0
            )
            store.close()

            self.client.patch(f"/tasks/{tid}", json={"title": "My name"})
            resp = self.client.patch(f"/tasks/{tid}", json={"title": None})
            self.assertEqual(resp.status_code, 200)
            self.assertIsNone(resp.json()["task"]["title_override"])

            store = Store(self._db_path())
            meta = store._get_chat_group_row(chat_key)
            self.assertFalse(meta["title_locked"])
            self.assertIsNone(store.get_task(tid)["title_override"])
            store.close()


class RenamePersistsStoreTest(unittest.TestCase):
    t0 = 1_700_000_000.0

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(os.path.join(self.tmp.name, "wou.db"))

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def test_rename_group_syncs_mirrored_overrides(self):
        chat_key = "c"
        t1 = self.store.upsert_task(
            chat_key, "A", "T", "a1", "t1", 1, "m1", now=self.t0
        )
        t2 = self.store.upsert_task(
            chat_key, "A", "T", "a2", "t2", 2, "m2", now=self.t0
        )
        self.store.rename_task(t1, "My name", now=self.t0)
        self.store.rename_group(chat_key, "My name", now=self.t0)
        self.store.rename_task(t2, "Unrelated", now=self.t0)
        self.store.rename_group(chat_key, "New name", now=self.t0 + 1)
        self.assertEqual(self.store.get_task(t1)["title_override"], "New name")
        self.assertEqual(self.store.get_task(t2)["title_override"], "Unrelated")


if __name__ == "__main__":
    unittest.main()


class StandaloneNameMigrationTest(unittest.TestCase):
    def test_existing_standalone_rename_names_the_chat_and_survives_rewording(self):
        import tempfile, os
        from wou.store import Store

        d = tempfile.mkdtemp()
        db = os.path.join(d, "wou.db")
        s = Store(db)
        tid = s.upsert_task("c1", "Atlas", "Chat", "Do the first thing", "Topic", 2, "m1")
        # Old-style rename: only the task override, no chat lock.
        s._conn.execute("UPDATE tasks SET title_override = 'My name' WHERE id = ?", (tid,))
        # A chat with two live renamed tasks must not be touched.
        a = s.upsert_task("c2", "Atlas", "Chat2", "Ask one", "T1", 2, "m1")
        b = s.upsert_task("c2", "Atlas", "Chat2", "Ask two", "T2", 2, "m1")
        s._conn.execute("UPDATE tasks SET title_override = 'Child' WHERE id IN (?, ?)", (a, b))
        s._conn.commit()
        s.close()

        s = Store(db)  # migration runs on open
        try:
            row = s._conn.execute(
                "SELECT title, title_locked FROM chat_groups WHERE chat_key='c1'"
            ).fetchone()
            self.assertEqual((row["title"], row["title_locked"]), ("My name", 1))
            self.assertIsNone(
                s._conn.execute("SELECT 1 FROM chat_groups WHERE chat_key='c2' AND title_locked=1").fetchone()
            )
            # Scanner rewords the ask: new row, old one resolved. Name still shows.
            new_id = s.upsert_task("c1", "Atlas", "Chat", "Totally reworded ask text", "New topic", 2, "m2")
            s.resolve_task(tid)
            s.set_group_title("c1", "Scanner title")
            new = s.get_task(new_id)
            self.assertIsNone(new["title_override"])
            self.assertEqual(new["chat_name"], "My name")
        finally:
            s.close()
