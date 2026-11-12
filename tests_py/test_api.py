"""Tests for dashboard/plugin_api.py."""

from __future__ import annotations

import importlib.util
import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests_py.test_collect import add_session, make_state_db

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
class DashboardApiTest(unittest.TestCase):
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
        return mock.patch.object(self.api, "plugin_data_directory", return_value=self.data_dir)

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "1"})
    def test_panel_hit_starts_consented_background_once(self):
        from wou.settings import save_settings

        save_settings(self.data_dir, {"consented": True})
        with self._patch_data_dir(), mock.patch(
            "wou.scanner.BackgroundRunner"
        ) as runner:
            self.client.get("/tasks")
            self.client.get("/tasks")
        runner.assert_called_once()

    def _write_collect_config(self, collect: dict, hermes_home: Path | None = None):
        payload: dict = {"collect": collect}
        if hermes_home is not None:
            payload["collect"]["hermes_home"] = str(hermes_home)
        path = os.path.join(self.data_dir, "config.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)

    def test_patch_unknown_field_400(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            tid = store.upsert_task(
                "c", "A", "T", "x", "topic", 2, "m", now=1_700_000_000.0
            )
            store.close()
            resp = self.client.patch(
                f"/tasks/{tid}", json={"status": "done", "extra": 1}
            )
        self.assertEqual(resp.status_code, 400)

    def test_patch_unknown_id_404(self):
        with self._patch_data_dir():
            resp = self.client.patch("/tasks/99999", json={"status": "done"})
        self.assertEqual(resp.status_code, 404)

    def test_done_writes_closed_memory(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            tid = store.upsert_task(
                "c", "A", "T", "Ask me", "topic", 1, "m", now=1_700_000_000.0
            )
            store.close()
            resp = self.client.patch(f"/tasks/{tid}", json={"status": "done"})
            self.assertEqual(resp.status_code, 200)
            store = Store(os.path.join(self.data_dir, "wou.db"))
            row = store._conn.execute(
                "SELECT COUNT(*) FROM closed"
            ).fetchone()[0]
            store.close()
        self.assertEqual(row, 1)

    def test_scan_rate_limit(self):
        with self._patch_data_dir():
            with mock.patch.object(
                self.api.Scanner,
                "run_once",
                return_value={"classified": 0, "added": 0, "resolved": 0},
            ):
                first = self.client.post("/scan")
                second = self.client.post("/scan", json={"force": False})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)

    def test_force_scan_skips_cooldown(self):
        with self._patch_data_dir():
            with mock.patch.object(
                self.api.Scanner,
                "run_once",
                return_value={"classified": 0, "added": 0, "resolved": 0},
            ) as run_once, mock.patch.object(self.api.time, "time") as clock:
                clock.return_value = 1000.0
                plain = self.client.post("/scan")
                clock.return_value = 1003.0  # inside the 20 s cooldown
                first = self.client.post("/scan", json={"force": True})
                clock.return_value = 1003.5  # runaway loop guard
                too_fast = self.client.post("/scan", json={"force": True})
                clock.return_value = 1006.0
                second = self.client.post("/scan", json={"force": True})
        self.assertEqual(plain.status_code, 200)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(too_fast.status_code, 429)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(run_once.call_count, 3)
        self.assertFalse(run_once.call_args_list[0].kwargs["force"])
        self.assertTrue(run_once.call_args_list[1].kwargs["force"])
        self.assertTrue(run_once.call_args_list[2].kwargs["force"])

    def test_settings_defaults(self):
        with self._patch_data_dir():
            resp = self.client.get("/settings")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("settings", body)
        self.assertIn("usage", body)
        self.assertIn("model", body)
        self.assertEqual(body["settings"]["archive_chat_on_done"], False)
        self.assertEqual(body["settings"]["auto_tag"], False)
        self.assertEqual(body["settings"]["name_after_chat"], False)
        self.assertEqual(body["settings"]["show_priorities"], True)
        self.assertEqual(body["settings"]["show_project_badges"], True)
        self.assertEqual(body["settings"]["follow_selected_chat"], True)
        self.assertEqual(body["usage"]["today"]["calls"], 0)
        self.assertEqual(len(body["usage"]["history"]), 7)
        self.assertIn("label", body["model"])

    def test_settings_patch_unknown_400(self):
        with self._patch_data_dir():
            resp = self.client.patch("/settings", json={"unknown": True})
        self.assertEqual(resp.status_code, 400)

    def test_settings_patch_name_after_chat(self):
        with self._patch_data_dir():
            resp = self.client.patch("/settings", json={"name_after_chat": True})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["settings"]["name_after_chat"])

    def test_settings_patch_show_priorities(self):
        with self._patch_data_dir():
            resp = self.client.patch("/settings", json={"show_priorities": False})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["settings"]["show_priorities"])
        bad = self.client.patch("/settings", json={"show_priorities": "yes"})
        self.assertEqual(bad.status_code, 400)

    def test_settings_patch_show_project_badges(self):
        with self._patch_data_dir():
            resp = self.client.patch("/settings", json={"show_project_badges": False})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["settings"]["show_project_badges"])
        bad = self.client.patch("/settings", json={"show_project_badges": 1})
        self.assertEqual(bad.status_code, 400)

    def test_settings_patch_follow_selected_chat(self):
        with self._patch_data_dir():
            resp = self.client.patch("/settings", json={"follow_selected_chat": False})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["settings"]["follow_selected_chat"])
        bad = self.client.patch("/settings", json={"follow_selected_chat": "yes"})
        self.assertEqual(bad.status_code, 400)

    def test_settings_patch_broadcasts(self):
        with self._patch_data_dir():
            with mock.patch.object(self.api, "broadcast_settings_changed") as broadcast:
                resp = self.client.patch("/settings", json={"name_after_chat": True})
        self.assertEqual(resp.status_code, 200)
        broadcast.assert_called_once()

    def test_patch_task_title(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            tid = store.upsert_task(
                "c", "A", "T", "x", "topic", 2, "m", now=1_700_000_000.0
            )
            store.close()
            resp = self.client.patch(f"/tasks/{tid}", json={"title": "Renamed"})
            bad = self.client.patch(f"/tasks/{tid}", json={"title": "x" * 121})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["task"]["title_override"], "Renamed")
        self.assertEqual(bad.status_code, 400)

    def test_patch_group_title(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            store.upsert_task(
                "sess-1", "A", "T", "a1", "t1", 1, "m1", now=1_700_000_000.0
            )
            store.upsert_task(
                "sess-1", "A", "T", "a2", "t2", 2, "m2", now=1_700_000_000.0
            )
            store.close()
            resp = self.client.patch("/groups/sess-1", json={"title": "Group name"})
        self.assertEqual(resp.status_code, 200)

    def test_done_no_archive_when_setting_off(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            tid = store.upsert_task(
                "sess-1", "A", "T", "x", "topic", 1, "m", now=1_700_000_000.0
            )
            store.close()
            with mock.patch.object(self.api._hermes_sessions, "archive_chat") as arch:
                resp = self.client.patch(f"/tasks/{tid}", json={"status": "done"})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json().get("chat_archived"))
        arch.assert_not_called()

    def test_done_archives_last_local_task(self):
        with self._patch_data_dir():
            self.client.patch(
                "/settings", json={"archive_chat_on_done": True}
            )
            store = Store(os.path.join(self.data_dir, "wou.db"))
            tid = store.upsert_task(
                "sess-1", "A", "T", "x", "topic", 1, "m", now=1_700_000_000.0
            )
            store.close()
            with mock.patch.object(
                self.api._hermes_sessions, "archive_chat", return_value=True
            ) as arch:
                resp = self.client.patch(f"/tasks/{tid}", json={"status": "done"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["chat_archived"])
        arch.assert_called_once_with("sess-1")
        self.assertTrue(body["task"]["archived_chat"])

    def test_done_archives_local_secondary_profile(self):
        with self._patch_data_dir():
            self._write_collect_config({"local_profiles": [{"name": "work", "state_db": "/synthetic/work/state.db"}]})
            self.client.patch("/settings", json={"archive_chat_on_done": True})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            tid = store.upsert_task("work:sess-1", "A", "T", "x", "topic", 1, "m", now=1_700_000_000.0)
            store.close()
            with mock.patch.object(self.api._hermes_sessions, "archive_chat", return_value=True) as arch:
                resp = self.client.patch(f"/tasks/{tid}", json={"status": "done"})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["chat_archived"])
        arch.assert_called_once_with("work:sess-1")

    def test_done_no_archive_when_other_open_tasks(self):
        with self._patch_data_dir():
            self.client.patch(
                "/settings", json={"archive_chat_on_done": True}
            )
            store = Store(os.path.join(self.data_dir, "wou.db"))
            store.upsert_task(
                "sess-1", "A", "T", "a", "topic", 1, "m", now=1_700_000_000.0
            )
            tid2 = store.upsert_task(
                "sess-1", "A", "T", "b", "topic", 2, "m2", now=1_700_000_000.0
            )
            store.close()
            with mock.patch.object(self.api._hermes_sessions, "archive_chat") as arch:
                resp = self.client.patch(f"/tasks/{tid2}", json={"status": "done"})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json().get("chat_archived"))
        arch.assert_not_called()

    def test_reopen_unarchives(self):
        with self._patch_data_dir():
            self.client.patch(
                "/settings", json={"archive_chat_on_done": True}
            )
            store = Store(os.path.join(self.data_dir, "wou.db"))
            tid = store.upsert_task(
                "sess-1", "A", "T", "x", "topic", 1, "m", now=1_700_000_000.0
            )
            store.close()
            with mock.patch.object(
                self.api._hermes_sessions, "archive_chat", return_value=True
            ):
                self.client.patch(f"/tasks/{tid}", json={"status": "done"})
            with mock.patch.object(
                self.api._hermes_sessions, "unarchive_chat", return_value=True
            ) as unarch:
                resp = self.client.patch(f"/tasks/{tid}", json={"status": "open"})
        self.assertEqual(resp.status_code, 200)
        unarch.assert_called_once_with("sess-1")
        self.assertFalse(resp.json()["task"]["archived_chat"])

    def test_tasks_groups_two_per_chat(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            store.upsert_task(
                "sess-1", "A", "Chat T", "a1", "Bank", 2, "m1", now=1_700_000_000.0
            )
            store.upsert_task(
                "sess-1", "A", "Chat T", "a2", "Bank", 3, "m2", now=1_700_000_001.0
            )
            store.upsert_task(
                "sess-2", "A", "Other", "solo", "Solo", 1, "m3", now=1_700_000_002.0
            )
            store.close()
            resp = self.client.get("/tasks")
        body = resp.json()
        self.assertEqual(len(body["groups"]), 1)
        g = body["groups"][0]
        self.assertEqual(g["chat_key"], "sess-1")
        self.assertEqual(g["quadrant"], 2)
        self.assertEqual(len(g["task_ids"]), 2)

    def test_group_title_fallback_most_common_topic(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            store.upsert_task(
                "sess-1", "A", "My chat", "a1", "Bank", 2, "m1", now=1_700_000_000.0
            )
            store.upsert_task(
                "sess-1", "A", "My chat", "a2", "Bank", 2, "m2", now=1_700_000_001.0
            )
            store.upsert_task(
                "sess-1", "A", "My chat", "a3", "Other", 2, "m3", now=1_700_000_002.0
            )
            store.close()
            resp = self.client.get("/tasks")
        self.assertEqual(resp.json()["groups"][0]["title"], "Bank")

    def test_group_quadrant_locked(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            store.upsert_task(
                "sess-1", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0
            )
            store.upsert_task(
                "sess-1", "A", "T", "a2", "t", 3, "m2", now=1_700_000_001.0
            )
            store.set_group_quadrant("sess-1", 4)
            store.close()
            resp = self.client.get("/tasks")
        self.assertEqual(resp.json()["groups"][0]["quadrant"], 4)

    def test_patch_group_task_ids_closes_only_listed(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            t1 = store.upsert_task(
                "sess-1", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0
            )
            t2 = store.upsert_task(
                "sess-1", "A", "T", "a2", "t", 2, "m2", now=1_700_000_001.0
            )
            t3 = store.upsert_task(
                "sess-1", "A", "T", "a3", "t", 2, "m3", now=1_700_000_002.0
            )
            store.close()
            resp = self.client.patch(
                "/groups/sess-1",
                json={"status": "done", "task_ids": [t1, t2]},
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(sorted(resp.json()["closed_task_ids"]), sorted([t1, t2]))
            store = Store(os.path.join(self.data_dir, "wou.db"))
            open_ids = [t["id"] for t in store.list_tasks()]
            store.close()
        self.assertEqual(open_ids, [t3])

    def test_patch_group_done_closes_all_and_closed_memory(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            t1 = store.upsert_task(
                "sess-1", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0
            )
            t2 = store.upsert_task(
                "sess-1", "A", "T", "a2", "t", 2, "m2", now=1_700_000_001.0
            )
            store.close()
            resp = self.client.patch("/groups/sess-1", json={"status": "done"})
            self.assertEqual(resp.status_code, 200)
            closed = resp.json()["closed_task_ids"]
            self.assertEqual(sorted(closed), sorted([t1, t2]))
            store = Store(os.path.join(self.data_dir, "wou.db"))
            n = store._conn.execute("SELECT COUNT(*) FROM closed").fetchone()[0]
            store.close()
        self.assertEqual(n, 2)

    def test_patch_group_archives_once(self):
        with self._patch_data_dir():
            self.client.patch("/settings", json={"archive_chat_on_done": True})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            store.upsert_task(
                "sess-1", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0
            )
            store.upsert_task(
                "sess-1", "A", "T", "a2", "t", 2, "m2", now=1_700_000_001.0
            )
            store.close()
            with mock.patch.object(
                self.api._hermes_sessions, "archive_chat", return_value=True
            ) as arch:
                resp = self.client.patch("/groups/sess-1", json={"status": "done"})
        self.assertTrue(resp.json()["chat_archived"])
        arch.assert_called_once_with("sess-1")


    def test_patch_group_done_after_scanner_resolved_all(self):
        # Scanner resolved the group before the click: report success, not 404.
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            key = "juno:abc123"
            t1 = store.upsert_task(key, "Juno", "T", "a1", "t", 1, "m1", now=1_700_000_000.0)
            t2 = store.upsert_task(key, "Juno", "T", "a2", "t", 2, "m2", now=1_700_000_001.0)
            store.resolve_task(t1)
            store.resolve_task(t2)
            store.close()
            from urllib.parse import quote

            resp = self.client.patch(f"/groups/{quote(key, safe='')}", json={"status": "done"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["closed_task_ids"], [])
        self.assertTrue(resp.json()["already_closed"])

    def test_patch_group_done_with_one_task_left_closes_it(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            t1 = store.upsert_task("sess-1", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0)
            t2 = store.upsert_task("sess-1", "A", "T", "a2", "t", 2, "m2", now=1_700_000_001.0)
            store.resolve_task(t1)
            store.close()
            resp = self.client.patch("/groups/sess-1", json={"status": "done"})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            status = store.get_task(t2)["status"]
            store.close()
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["closed_task_ids"], [t2])
        self.assertFalse(resp.json()["already_closed"])
        self.assertEqual(status, "done")

    def test_patch_task_status_and_snooze_together_rejected_without_writes(self):
        with self._patch_data_dir():
            self.client.patch("/settings", json={"archive_chat_on_done": True})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            t1 = store.upsert_task("sess-x", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0)
            store.close()
            with mock.patch.object(
                self.api._hermes_sessions, "archive_chat", return_value=True
            ) as arch, mock.patch.object(
                self.api._hermes_sessions, "is_local_default_chat", return_value=True
            ):
                resp = self.client.patch(f"/tasks/{t1}", json={"status": "done", "snooze_until": None})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            task = store.get_task(t1)
            store.close()
        self.assertEqual(resp.status_code, 400)
        arch.assert_not_called()
        self.assertEqual(task["status"], "open")
        self.assertFalse(task.get("archived_chat"))

    def test_patch_task_invalid_quadrant_rejected_before_status_write(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            t1 = store.upsert_task("sess-y", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0)
            store.close()
            resp = self.client.patch(f"/tasks/{t1}", json={"status": "done", "quadrant": 9})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            task = store.get_task(t1)
            store.close()
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(task["status"], "open")

    def test_patch_task_bad_title_rejected_before_close_and_archive(self):
        with self._patch_data_dir():
            self.client.patch("/settings", json={"archive_chat_on_done": True})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            t1 = store.upsert_task("sess-t", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0)
            store.close()
            with mock.patch.object(
                self.api._hermes_sessions, "archive_chat", return_value=True
            ) as arch, mock.patch.object(
                self.api._hermes_sessions, "is_local_default_chat", return_value=True
            ):
                resp = self.client.patch(f"/tasks/{t1}", json={"status": "done", "title": 123})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            task = store.get_task(t1)
            store.close()
        self.assertEqual(resp.status_code, 400)
        arch.assert_not_called()
        self.assertEqual(task["status"], "open")

    def _two_task_group(self, chat="sess-g"):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        t1 = store.upsert_task(chat, "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0)
        t2 = store.upsert_task(chat, "A", "T", "a2", "t", 2, "m2", now=1_700_000_001.0)
        tag = store.create_tag("Work", color="blue")
        store.close()
        return t1, t2, tag

    def test_patch_group_bad_quadrant_rejected_before_close(self):
        with self._patch_data_dir():
            t1, t2, _ = self._two_task_group()
            resp = self.client.patch("/groups/sess-g", json={"status": "done", "quadrant": 9})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            statuses = [store.get_task(t)["status"] for t in (t1, t2)]
            store.close()
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(statuses, ["open", "open"])

    def test_patch_group_bad_status_rejected_before_tag_write(self):
        with self._patch_data_dir():
            t1, t2, tag = self._two_task_group()
            tag_id = tag["id"]
            resp = self.client.patch("/groups/sess-g", json={"tags_add": [tag_id], "status": "invalid"})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            tags = [store.get_task(t).get("tags") or [] for t in (t1, t2)]
            store.close()
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(tags, [[], []])

    def test_patch_group_bad_title_rejected_before_priority_write(self):
        with self._patch_data_dir():
            t1, t2, _ = self._two_task_group()
            store = Store(os.path.join(self.data_dir, "wou.db"))
            before = [(store.get_task(t)["quadrant"], store.get_task(t)["quadrant_locked"]) for t in (t1, t2)]
            store.close()
            resp = self.client.patch("/groups/sess-g", json={"quadrant": 4, "title": 123})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            after = [(store.get_task(t)["quadrant"], store.get_task(t)["quadrant_locked"]) for t in (t1, t2)]
            store.close()
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(before, after)

    def test_patch_group_done_all_resolved_does_not_archive(self):
        with self._patch_data_dir():
            self.client.patch("/settings", json={"archive_chat_on_done": True})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            t1 = store.upsert_task("sess-1", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0)
            t2 = store.upsert_task("sess-1", "A", "T", "a2", "t", 2, "m2", now=1_700_000_001.0)
            store.resolve_task(t1)
            store.resolve_task(t2)
            store.close()
            with mock.patch.object(
                self.api._hermes_sessions, "archive_chat", return_value=True
            ) as arch, mock.patch.object(
                self.api._hermes_sessions, "is_local_default_chat", return_value=True
            ):
                resp = self.client.patch("/groups/sess-1", json={"status": "done"})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["chat_archived"])
        self.assertTrue(resp.json()["already_closed"])
        self.assertEqual(resp.json()["closed_task_ids"], [])
        arch.assert_not_called()

    def test_patch_group_solo_task_still_404(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            t1 = store.upsert_task("solo", "A", "T", "a1", "t", 1, "m1", now=1_700_000_000.0)
            store.close()
            resp = self.client.patch("/groups/solo", json={"status": "done"})
            store = Store(os.path.join(self.data_dir, "wou.db"))
            status = store.get_task(t1)["status"]
            store.close()
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(status, "open")

    def test_patch_group_unknown_chat_still_404(self):
        with self._patch_data_dir():
            resp = self.client.patch("/groups/nope", json={"status": "done"})
            resp2 = self.client.patch("/groups/nope", json={"quadrant": 1})
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp2.status_code, 404)

    def test_patch_group_encoded_chat_key(self):
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            key = "work:sess-1"
            store.upsert_task(
                key, "Bob", "T", "a1", "t", 1, "m1", now=1_700_000_000.0
            )
            store.upsert_task(
                key, "Bob", "T", "a2", "t", 2, "m2", now=1_700_000_001.0
            )
            store.close()
            from urllib.parse import quote

            resp = self.client.patch(
                f"/groups/{quote(key, safe='')}", json={"status": "dismissed"}
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["closed_task_ids"]), 2)

    def test_done_no_archive_remote_chat(self):
        with self._patch_data_dir():
            self.client.patch(
                "/settings", json={"archive_chat_on_done": True}
            )
            store = Store(os.path.join(self.data_dir, "wou.db"))
            tid = store.upsert_task(
                "work:sess-1", "Bob", "T", "x", "topic", 1, "m", now=1_700_000_000.0
            )
            store.close()
            with mock.patch.object(self.api._hermes_sessions, "archive_chat") as arch:
                resp = self.client.patch(f"/tasks/{tid}", json={"status": "done"})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json().get("chat_archived"))
        arch.assert_not_called()

    def test_post_tasks_happy_path_and_title_lookup(self):
        hermes = Path(self.data_dir) / "hermes"
        db = hermes / "state.db"
        make_state_db(db)
        add_session(db, "sess-abc", title="Budget review")
        self._write_collect_config(
            {"agent_names": {"default": "Alice"}},
            hermes_home=hermes,
        )
        with self._patch_data_dir():
            resp = self.client.post(
                "/tasks",
                json={"session_id": "sess-abc", "quadrant": 2},
            )
        self.assertEqual(resp.status_code, 200)
        task = resp.json()["task"]
        self.assertEqual(task["chat_title"], "Budget review")
        self.assertEqual(task["agent"], "Alice")
        self.assertTrue(task["manual"])
        self.assertEqual(task["chat_target"]["session_id"], "sess-abc")

    def test_post_tasks_400_invalid_quadrant(self):
        with self._patch_data_dir():
            resp = self.client.post(
                "/tasks",
                json={"session_id": "s1", "quadrant": 9},
            )
        self.assertEqual(resp.status_code, 400)

    def test_post_tasks_400_bad_ask_type(self):
        with self._patch_data_dir():
            resp = self.client.post(
                "/tasks",
                json={"session_id": "s1", "quadrant": 1, "ask": 42},
            )
        self.assertEqual(resp.status_code, 400)

    def _local_session(self, sid):
        hermes = Path(self.data_dir) / 'hermes'
        db = hermes / 'state.db'
        make_state_db(db)
        add_session(db, sid)
        self._write_collect_config({}, hermes_home=hermes)

    def test_get_session_tasks_untracked(self):
        self._local_session('empty-1')
        with self._patch_data_dir():
            resp = self.client.get("/session-tasks", params={"session_id": "empty-1"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertFalse(body["tracked"])
        self.assertEqual(body["tasks"], [])
        self.assertIsNone(body["group"])

    def test_get_session_tasks_tracked(self):
        self._local_session("sess-1")
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            store.add_manual_task(
                "sess-1",
                "A",
                "T",
                "Follow up",
                "Follow up",
                1, now=1_700_000_000.0,
            )
            store.close()
            resp = self.client.get("/session-tasks", params={"session_id": "sess-1"})
        body = resp.json()
        self.assertTrue(body["tracked"])
        self.assertEqual(len(body["tasks"]), 1)
        self.assertIsNotNone(body["tasks"][0]["chat_target"])

    def test_session_tasks_remote_connection_mapping(self):
        self._write_collect_config(
            {
                "remote_hosts": [
                    {
                        "name": "Office",
                        "desktop_connection": "conn-99",
                        "desktop_profile": "default",
                    }
                ]
            }
        )
        with self._patch_data_dir():
            store = Store(os.path.join(self.data_dir, "wou.db"))
            store.add_manual_task(
                "office:remote-sess",
                "Office",
                "T",
                "x",
                "x",
                2, now=1_700_000_000.0,
            )
            store.close()
            resp = self.client.get(
                "/session-tasks",
                params={
                    "session_id": "remote-sess",
                    "connection_id": "conn-99",
                },
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["chat_key"], "office:remote-sess")

    def test_session_tasks_remote_unknown_connection_404(self):
        self._write_collect_config({"remote_hosts": []})
        with self._patch_data_dir():
            resp = self.client.get(
                "/session-tasks",
                params={"session_id": "s1", "connection_id": "missing"},
            )
        self.assertEqual(resp.status_code, 404)

    def test_session_tasks_unknown_connection_falls_back_to_local_session(self):
        hermes = Path(self.data_dir) / "hermes"
        db = hermes / "state.db"
        make_state_db(db)
        add_session(db, "sess-local", title="Local chat")
        self._write_collect_config({"remote_hosts": []}, hermes_home=hermes)
        with self._patch_data_dir():
            resp = self.client.get(
                "/session-tasks",
                params={
                    "session_id": "sess-local",
                    "connection_id": "example-host",
                },
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["chat_key"], "sess-local")
        self.assertFalse(resp.json()["tracked"])

    def test_session_tasks_bad_session_id_400(self):
        with self._patch_data_dir():
            resp = self.client.get(
                "/session-tasks", params={"session_id": "bad id!"}
            )
        self.assertEqual(resp.status_code, 400)

    def _write_action_handler_config(self, handler_path: Path, **handler_kw):
        payload = {
            "collect": {},
            "action_handlers": {
                "mailhist:": {
                    "command": [str(handler_path)],
                    **handler_kw,
                }
            },
        }
        path = os.path.join(self.data_dir, "config.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)

    def _task_with_actions(self, actions):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        tid = store.upsert_task(
            "mailhist:item:1",
            "Mail",
            "Support",
            "Reply?",
            "topic",
            2,
            "src-1",
            now=1_700_000_000.0,
            actions=actions,
        )
        store.close()
        return tid

    def _set_action_task_fields(self, tid, **fields):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        try:
            for name, value in fields.items():
                store._conn.execute(f"UPDATE tasks SET {name}=? WHERE id=?", (value, tid))
            store._conn.commit()
        finally:
            store.close()

    def test_action_rejects_invalid_inputs_before_execution(self):
        cases = [
            ("Send", {}, 400),
            ("a" * 33, {}, 400),
            ("send%0A", {}, 400),
            ("send", {"source_msg_id": "ordinary value"}, 400),
            ("send", {"source_msg_id": "source\n"}, 400),
            ("send", {"source_msg_id": "-source"}, 400),
            ("send", {"source_msg_id": "x" * 129}, 400),
            ("send", {"status": "snoozed"}, 409),
            ("send", {"actions": json.dumps([{"id": "send", "kind": "details"}])}, 404),
        ]
        self._write_action_handler_config(Path(self.data_dir) / "unused-handler")
        with self._patch_data_dir():
            for action_id, fields, expected in cases:
                with self.subTest(action_id=action_id, fields=fields):
                    tid = self._task_with_actions([{"id": "send", "label": "Send"}])
                    self._set_action_task_fields(tid, status="open", source_msg_id="src-1")
                    self._set_action_task_fields(tid, **fields)
                    with mock.patch.object(self.api.asyncio, "create_subprocess_exec", side_effect=OSError) as spawn:
                        resp = self.client.post(f"/tasks/{tid}/actions/{action_id}")
                    self.assertEqual(resp.status_code, expected)
                    spawn.assert_not_called()

    def test_action_child_has_only_runtime_environment_by_default(self):
        handler = Path(self.data_dir) / "check_env.py"
        handler.write_text(
            f"#!{sys.executable}\nimport json, os\n"
            "checks = [bool(os.environ.get('PATH')), "
            "'WOU_TEST_FAKE_PROVIDER_KEY' not in os.environ, "
            "'HERMES_YOLO_MODE' not in os.environ, "
            "'SSH_AUTH_SOCK' not in os.environ]\n"
            "print(json.dumps({'ok': True, 'close': False, 'message': json.dumps(checks)}))\n",
            encoding="utf-8",
        )
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler)
        with self._patch_data_dir(), mock.patch.dict(os.environ, {
            "WOU_TEST_FAKE_PROVIDER_KEY": "synthetic-only",
            "HERMES_YOLO_MODE": "synthetic-only",
            "SSH_AUTH_SOCK": "/synthetic/socket",
        }):
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            resp = self.client.post(f"/tasks/{tid}/actions/send")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(resp.json()["message"]), [True] * 4)

    def test_action_child_passes_only_explicit_handler_names(self):
        handler = Path(self.data_dir) / "explicit_env.py"
        handler.write_text(
            f"#!{sys.executable}\nimport json, os\n"
            "checks = [os.environ.get('WOU_TEST_ALLOWED') == 'synthetic-opt-in', "
            "'WOU_TEST_FAKE_PROVIDER_KEY' not in os.environ, "
            "'HERMES_YOLO_MODE' not in os.environ, bool(os.environ.get('PATH'))]\n"
            "print(json.dumps({'ok': True, 'close': False, 'message': json.dumps(checks)}))\n",
            encoding="utf-8",
        )
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler, env=["WOU_TEST_ALLOWED"])
        with self._patch_data_dir(), mock.patch.dict(os.environ, {
            "WOU_TEST_ALLOWED": "synthetic-opt-in",
            "WOU_TEST_FAKE_PROVIDER_KEY": "synthetic-only",
            "HERMES_YOLO_MODE": "synthetic-only",
        }):
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            resp = self.client.post(f"/tasks/{tid}/actions/send")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(resp.json()["message"]), [True] * 4)

    def test_action_output_is_bounded(self):
        handler = Path(self.data_dir) / "verbose.py"
        handler.write_text(
            "#!/usr/bin/env python3\nimport json\n"
            "print('x' * 65537)\n"
            'print(json.dumps({"ok": True, "message": "sent", "close": True}))\n',
            encoding="utf-8",
        )
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler)
        with self._patch_data_dir():
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            resp = self.client.post(f"/tasks/{tid}/actions/send")
        self.assertEqual(resp.status_code, 502)
        self.assertEqual(resp.json()["error"], "handler output too large")
        store = Store(os.path.join(self.data_dir, "wou.db"))
        try:
            self.assertEqual(store.get_task(tid)["status"], "open")
        finally:
            store.close()

    def test_action_external_producer_argv_and_last_stdout_line(self):
        handler = Path(self.data_dir) / "argv.py"
        handler.write_text(
            "#!/usr/bin/env python3\nimport json, sys\n"
            "print('handler progress')\n"
            'print(json.dumps({"ok": True, "message": json.dumps(sys.argv[1:]), "close": False}))\n'
            "print()\n",
            encoding="utf-8",
        )
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler)
        with self._patch_data_dir(), mock.patch.object(self.api, "broadcast_tasks_changed"):
            for source in (None, "", "cc_reminders:123", "client_questions:42", "cc_reminders:1,2", "<id+part@example.com>", "a" * 128):
                with self.subTest(source=source):
                    tid = self._task_with_actions([{"id": "send", "label": "Send"}])
                    self._set_action_task_fields(tid, source_msg_id=source)
                    resp = self.client.post(f"/tasks/{tid}/actions/send")
                    self.assertEqual(resp.status_code, 200)
                    self.assertEqual(json.loads(resp.json()["message"]), ["send", "mailhist:item:1", source or ""])

    def test_action_invalid_commands_do_not_execute(self):
        for command in ([], ["relative-handler"], "not-argv"):
            with self.subTest(command=command):
                self._write_action_handler_config(Path(self.data_dir) / "unused", command=command)
                with self._patch_data_dir():
                    tid = self._task_with_actions([{"id": "send", "label": "Send"}])
                    with mock.patch.object(self.api.asyncio, "create_subprocess_exec") as spawn:
                        resp = self.client.post(f"/tasks/{tid}/actions/send")
                self.assertEqual(resp.status_code, 400)
                spawn.assert_not_called()

    def test_action_success_closes_task(self):
        handler = Path(self.data_dir) / "ok_close.py"
        handler.write_text(
            "#!/usr/bin/env python3\n"
            "import json\n"
            'print(json.dumps({"ok": True, "message": "sent", "close": True}))\n',
            encoding="utf-8",
        )
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler)
        with self._patch_data_dir():
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            with mock.patch.object(self.api, "broadcast_tasks_changed"):
                resp = self.client.post(f"/tasks/{tid}/actions/send")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["ok"])
        self.assertTrue(body["closed"])
        self.assertEqual(body["task"]["status"], "done")

    def test_action_ok_without_close(self):
        handler = Path(self.data_dir) / "ok_stay.py"
        handler.write_text(
            "#!/usr/bin/env python3\n"
            "import json\n"
            'print(json.dumps({"ok": True, "message": "queued", "close": False}))\n',
            encoding="utf-8",
        )
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler)
        with self._patch_data_dir():
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            resp = self.client.post(f"/tasks/{tid}/actions/send")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["ok"])
        self.assertFalse(body["closed"])
        self.assertEqual(body["task"]["status"], "open")

    def test_action_bad_json_502(self):
        handler = Path(self.data_dir) / "bad_json.py"
        handler.write_text("#!/usr/bin/env python3\nprint('not json')\n", encoding="utf-8")
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler)
        with self._patch_data_dir():
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            resp = self.client.post(f"/tasks/{tid}/actions/send")
        self.assertEqual(resp.status_code, 502)

    def test_action_unknown_404(self):
        handler = Path(self.data_dir) / "noop.py"
        handler.write_text("#!/usr/bin/env python3\nimport json\nprint('{}')\n", encoding="utf-8")
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler)
        with self._patch_data_dir():
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            resp = self.client.post(f"/tasks/{tid}/actions/missing")
        self.assertEqual(resp.status_code, 404)

    def test_action_no_handler_400(self):
        with self._patch_data_dir():
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            resp = self.client.post(f"/tasks/{tid}/actions/send")
        self.assertEqual(resp.status_code, 400)

    def test_action_closed_task_409(self):
        handler = Path(self.data_dir) / "ok.py"
        handler.write_text(
            "#!/usr/bin/env python3\nimport json\n"
            'print(json.dumps({"ok": True, "message": "x", "close": False}))\n',
            encoding="utf-8",
        )
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler)
        with self._patch_data_dir():
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            self.client.patch(f"/tasks/{tid}", json={"status": "done"})
            resp = self.client.post(f"/tasks/{tid}/actions/send")
        self.assertEqual(resp.status_code, 409)

    def test_action_timeout_504(self):
        handler = Path(self.data_dir) / "slow.py"
        handler.write_text(
            "#!/usr/bin/env python3\nimport time\ntime.sleep(5)\n",
            encoding="utf-8",
        )
        handler.chmod(handler.stat().st_mode | stat.S_IEXEC)
        self._write_action_handler_config(handler, timeout_seconds=1)
        with self._patch_data_dir():
            tid = self._task_with_actions([{"id": "send", "label": "Send"}])
            resp = self.client.post(f"/tasks/{tid}/actions/send")
        self.assertEqual(resp.status_code, 504)
        self.assertEqual(resp.json()["error"], "timed out")


if __name__ == "__main__":
    unittest.main()
