import os
import sys
import json
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from wou.classify import parse_response

from wou.store import Store
from wou.priorities import quadrant_for, due_timestamp
from wou.classify import build_messages, classify_chat
from wou.settings import save_settings, load_settings
from unittest import mock
from pathlib import Path
import io
from contextlib import redirect_stdout


class PriorityTests(unittest.TestCase):
    def test_scores_override_model_quadrant(self):
        for u, i, q in [(0, 0, 4), (0, 2, 2), (2, 0, 3), (2, 2, 1)]:
            item = parse_response(
                json.dumps(
                    {
                        "asks": [
                            {
                                "ask": "Review Atlas Transcribe logs",
                                "topic": "Logs",
                                "urgency": u,
                                "importance": i,
                                "quadrant": 4,
                                "context": "Shipping app; no deadline",
                                "due": "2026-11-06",
                            }
                        ]
                    }
                ),
                now=0,
            )["asks"][0]
            self.assertEqual(item["quadrant"], q)
            self.assertEqual(item["context"], "Shipping app; no deadline")
            self.assertIsInstance(item["due_at"], float)


class PriorityStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = os.path.join(self.tmp.name, "wou.db")
        self.store = Store(self.path)
        self.addCleanup(self.store.close)
        self.now = 1700000000.0

    def add(self, q=2, key="chat", ask="Review Atlas Transcribe logs", **kw):
        return self.store.upsert_task(
            key, "Atlas", "Dictate", ask, "Logs", q, "m1", now=self.now, **kw
        )

    def test_escalation_boundaries_and_locks(self):
        for hours, expected in [(49, 2), (47, 1), (-1, 1)]:
            tid = self.add(
                key=str(hours), due_at=self.now + hours * 3600, urgency=0, importance=2
            )
            self.assertEqual(
                self.store.list_tasks(now=self.now)[-1]["quadrant"], expected
            )
        tid = self.add(key="locked", due_at=self.now - 1)
        self.store.set_quadrant(tid, 4)
        self.store.escalate_priorities(self.now)
        self.assertEqual(self.store.get_task(tid)["quadrant"], 4)
        self.assertEqual(quadrant_for(0, 0, self.now - 1, self.now), 3)

    def test_rescan_context_and_user_choices(self):
        tid = self.add()
        self.store.rename_task(tid, "My title")
        self.store.set_quadrant(tid, 4)
        chat = dict(
            key="chat",
            agent="Atlas",
            title="Dictate",
            last_role="assistant",
            last_msg_id="m2",
            last_msg_at=self.now,
            agent_last="Review Atlas Transcribe logs",
        )
        result = classify_chat(
            self.store,
            chat,
            llm=lambda m: json.dumps(
                {
                    "asks": [
                        dict(
                            ask="Review the Atlas Transcribe logs",
                            topic="Logs",
                            context="Shipping app; can wait",
                            due="2026-11-06",
                            urgency=0,
                            importance=3,
                        )
                    ]
                }
            ),
            now=self.now,
        )
        self.assertIsNone(result["error"])
        tasks = self.store.list_tasks(now=self.now)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["id"], tid)
        self.assertEqual(tasks[0]["title_override"], "My title")
        self.assertEqual(tasks[0]["quadrant"], 4)
        self.assertEqual(tasks[0]["context"], "Shipping app; can wait")
        self.assertEqual(tasks[0]["importance"], 3)

    def test_prompt_and_settings(self):
        save_settings(self.tmp.name, {"priorities_note": "Family first"})
        with self.assertRaises(ValueError):
            save_settings(self.tmp.name, {"priorities_note": "x" * 1001})
        with self.assertRaises(ValueError):
            save_settings(self.tmp.name, {"priorities_note": 1})
        self.assertEqual(
            load_settings(self.tmp.name)["priorities_note"], "Family first"
        )
        chat = dict(
            title="Daily checkin", project={"name": "Content"}, last_msg_at=self.now
        )
        text = "\n".join(
            m["content"]
            for m in build_messages(
                chat,
                [],
                [],
                self.now,
                "Family first",
                [dict(ask="Record i9", context="Video", quadrant=2)],
            )
        )
        for value in [
            "urgency 0-3",
            "importance 0-3",
            "Latest message date",
            "2023-11-14",
            "Daily checkin",
            "Content",
            "Family first",
            "Record i9",
        ]:
            self.assertIn(value, text)

    def test_migration_old_database(self):
        old_id = self.add(context="old metadata")
        # Remove just the new columns to recreate the previously supported schema.
        for column in ["context", "due_at", "urgency", "importance"]:
            self.store._conn.execute("ALTER TABLE tasks DROP COLUMN " + column)
        self.store._conn.commit()
        migrated = Store(self.path)
        try:
            self.assertEqual(
                migrated.get_task(old_id)["ask"], "Review Atlas Transcribe logs"
            )
            tid = migrated.upsert_task(
                "old", "A", "T", "Review old logs", "Logs", 2, "m"
            )
            self.assertIsNone(migrated.get_task(tid)["due_at"])
            self.assertIn("context", migrated.get_task(tid))
        finally:
            migrated.close()

    def test_eval_offline(self):
        from wou.eval_priorities import main

        tid = self.add()
        labels = Path(self.tmp.name) / "labels.json"
        labels.write_text(
            json.dumps(
                {
                    "labels": [
                        {"task_id": tid, "label": 2},
                        {"task_id": tid, "label": None},
                    ]
                }
            )
        )
        output = io.StringIO()
        with redirect_stdout(output):
            self.assertEqual(
                main(["--labels", str(labels), "--db", self.path], self.tmp.name), 0
            )
        report = json.loads(output.getvalue())["stored"]
        self.assertEqual(report["agreement"], 1)
        self.assertEqual(report["confusion_matrix"][1][1], 1)
        self.store.set_quadrant(tid, 1)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(main(["--from-db", "--db", self.path], self.tmp.name), 0)

    def test_live_eval_explicit_flag_uses_injected_classifier(self):
        from wou.eval_priorities import main
        from contextlib import redirect_stderr

        tid = self.add()
        labels = Path(self.tmp.name) / "labels.json"
        labels.write_text(json.dumps({"labels": [{"task_id": tid, "label": 1}]}))
        chat = dict(key="chat", agent="Atlas", title="Dictate", last_msg_at=self.now)
        host = mock.Mock()
        host.complete.return_value = mock.Mock(
            text=json.dumps(
                {
                    "asks": [
                        dict(
                            ask="Review Atlas Transcribe logs",
                            topic="Logs",
                            urgency=3,
                            importance=3,
                        )
                    ]
                }
            )
        )
        output, warning = io.StringIO(), io.StringIO()
        with (
            mock.patch("wou.classify._HOST_LLM", host),
            mock.patch("wou.collect.collect_all", return_value=([chat], [])),
            redirect_stdout(output),
            redirect_stderr(warning),
        ):
            self.assertEqual(
                main(
                    ["--labels", str(labels), "--live", "--db", self.path],
                    self.tmp.name,
                ),
                0,
            )
        host.complete.assert_called_once()
        self.assertIn("spends model calls", warning.getvalue())
        self.assertEqual(json.loads(output.getvalue())["live"]["agreement"], 1)
        self.assertEqual(self.store.get_task(tid)["quadrant"], 2)

    def test_bad_fields(self):
        item = parse_response(
            json.dumps(
                {
                    "asks": [
                        dict(
                            ask="a" * 200,
                            topic="T",
                            context="c" * 200,
                            due="2026-99-99",
                            urgency=99,
                            importance=-1,
                        )
                    ]
                }
            ),
            now=0,
        )["asks"][0]
        self.assertEqual((len(item["ask"]), len(item["context"])), (140, 160))
        self.assertEqual(
            (item["urgency"], item["importance"], item["quadrant"]), (3, 0, 3)
        )
        self.assertIsNone(item["due_at"])
        self.assertIsNone(due_timestamp("next Friday"))
        self.assertEqual(
            parse_response('{"asks":[{"ask":"A","topic":"T","quadrant":2}]}')["asks"][
                0
            ]["quadrant"],
            2,
        )


class PriorityApiTests(unittest.TestCase):
    def setUp(self):
        from test_rename_persists import _load_api_module
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.api = _load_api_module()
        self.patch = mock.patch.object(
            self.api, "plugin_data_directory", return_value=self.tmp.name
        )
        self.patch.start()
        self.addCleanup(self.patch.stop)
        app = FastAPI()
        app.include_router(self.api.router)
        self.client = TestClient(app)
        self.store = Store(os.path.join(self.tmp.name, "wou.db"))
        self.addCleanup(self.store.close)
        self.ids = [
            self.store.upsert_task(
                "g" + str(q), "A", "Title", "Ask " + str(q), "Topic", q, "m"
            )
            for q in [1, 1, 2, 3, 4]
        ]

    def test_quiz_spread_skip_validation_and_lock(self):
        tasks = self.client.get("/quiz?limit=4").json()["tasks"]
        self.assertEqual({t["quadrant"] for t in tasks}, {1, 2, 3, 4})
        tid = tasks[0]["id"]
        self.assertEqual(self.client.post(f"/quiz/{tid}/skip").status_code, 200)
        self.assertNotIn(
            tid, [t["id"] for t in self.client.get("/quiz").json()["tasks"]]
        )
        tid = tasks[1]["id"]
        for q in [0, 5, True, "2", 2.2, None]:
            self.assertEqual(
                self.client.post(f"/quiz/{tid}", json={"quadrant": q}).status_code, 400
            )
        self.assertEqual(
            self.client.post(f"/quiz/{tid}", json={"quadrant": 4}).status_code, 200
        )
        self.assertTrue(self.store.get_task(tid)["quadrant_locked"])
        labels = self.store.priority_labels()
        self.assertEqual(len(labels), 1)
        self.assertEqual(labels[0]["source"], "quiz")
        self.assertEqual(self.client.get("/quiz?limit=0").status_code, 400)
        self.assertEqual(
            self.client.post("/quiz/999999", json={"quadrant": 2}).status_code, 404
        )
        self.store.close_task(tid, "done")
        self.assertEqual(self.client.post(f"/quiz/{tid}/skip").status_code, 404)

    def test_move_and_group_labels(self):
        tid = self.ids[0]
        self.assertEqual(
            self.client.patch(f"/tasks/{tid}", json={"quadrant": 4}).status_code, 200
        )
        self.assertEqual(self.store.priority_labels()[0]["source"], "move")
        child = self.store.upsert_task(
            "g1", "A", "Title", "Second ask", "Other", 2, "m"
        )
        self.assertEqual(
            self.client.patch("/groups/g1", json={"quadrant": 3}).status_code, 200
        )
        self.assertEqual(
            {r["task_id"] for r in self.store.priority_labels()},
            {tid, self.ids[1], child},
        )
        self.assertTrue(self.store.get_task(child)["quadrant_locked"])

    def test_settings_api(self):
        self.assertEqual(
            self.client.get("/settings").json()["settings"]["priorities_note"], ""
        )
        self.assertEqual(
            self.client.patch(
                "/settings", json={"priorities_note": "Clients first"}
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get("/settings").json()["settings"]["priorities_note"],
            "Clients first",
        )
        self.assertEqual(
            self.client.patch(
                "/settings", json={"priorities_note": "x" * 1001}
            ).status_code,
            400,
        )


class PriorityBoundaryTests(unittest.TestCase):
    def test_all_score_pairs(self):
        for urgency in range(4):
            for importance in range(4):
                expected = {
                    (False, False): 4,
                    (False, True): 2,
                    (True, False): 3,
                    (True, True): 1,
                }[(urgency >= 2, importance >= 2)]
                self.assertEqual(quadrant_for(urgency, importance, now=0), expected)

    def test_due_is_local_end_of_day(self):
        from datetime import datetime

        stamp = due_timestamp("2026-11-06")
        self.assertEqual(
            datetime.fromtimestamp(stamp).isoformat(), "2026-11-06T23:59:59"
        )

    def test_due_within_48h_elevates_quadrant_without_model(self):
        now = 1_700_000_000.0
        due_soon = now + 36 * 3600
        self.assertEqual(quadrant_for(0, 0, due_at=due_soon, now=now), 3)
        self.assertEqual(quadrant_for(0, 2, due_at=due_soon, now=now), 1)
        due_later = now + 72 * 3600
        self.assertEqual(quadrant_for(0, 0, due_at=due_later, now=now), 4)

    def test_invalid_due_date_does_not_elevate_urgency(self):
        now = 1_700_000_000.0
        self.assertIsNone(due_timestamp("not-a-date"))
        self.assertEqual(quadrant_for(0, 0, due_at=None, now=now), 4)

    def test_offline_eval_agreement_from_explicit_predictions(self):
        from wou.eval_priorities import agreement

        labels = [
            {"task_id": 1, "label": 2},
            {"task_id": 2, "label": None},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(str(Path(tmp) / "wou.db"))
            try:
                report = agreement(store, labels, predictions={1: 2, 2: 3})
            finally:
                store.close()
        self.assertEqual(report["matched"], 1)
        self.assertEqual(report["total"], 1)
        self.assertEqual(report["skipped_null"], 1)

    def test_actual_label_file_offline_cli(self):
        from wou.__main__ import main

        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "labels.json"
            source.write_text(json.dumps({"labels": [
                {"task_id": i, "label": None if i <= 3 else 1} for i in range(1, 13)
            ]}))
            store = Store(str(Path(tmp) / "wou.db"))
            store.close()
            output = io.StringIO()
            with (
                mock.patch(
                    "wou.__main__.plugin_data_directory", return_value=Path(tmp)
                ),
                mock.patch(
                    "wou.classify.make_default_llm",
                    side_effect=AssertionError("offline must never call models"),
                ),
                redirect_stdout(output),
            ):
                self.assertEqual(main(["eval-priorities", "--labels", str(source)]), 0)
            report = json.loads(output.getvalue())["stored"]
            self.assertEqual(report["skipped_null"], 3)
            self.assertEqual(len(report["missing_task_ids"]), 9)
