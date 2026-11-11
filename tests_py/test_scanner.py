"""Tests for wou.scanner."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests_py.test_collect import add_message, add_session, make_state_db
from wou import usage
from wou.config import load_config
from wou.scanner import BackgroundRunner, Scanner, read_last_scan
from wou.settings import save_settings
from wou.store import Store
import wou.scanner as scanner_module


def _chat(key: str, msg_id: str, last_active: float, **extra):
    base = {
        "key": key,
        "agent": "Desktop",
        "title": "Test chat",
        "last_msg_id": msg_id,
        "last_role": "assistant",
        "last_active": last_active,
        "user_last": "hi",
        "agent_last": "waiting?",
    }
    base.update(extra)
    return base


class LoadConfigTest(unittest.TestCase):
    def test_defaults_without_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg = load_config(tmp)
            self.assertEqual(cfg["debounce_seconds"], 90)
            self.assertNotIn("error", cfg)

    def test_invalid_json_returns_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "config.json")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write("{not json")
            cfg = load_config(tmp)
            self.assertIn("error", cfg)
            self.assertEqual(cfg["debounce_seconds"], 90)


class ScannerRunTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name
        self.t0 = 1_700_000_000.0
        self.collected = []
        self.collect_notes: list[str] = []
        self.llm_calls = []
        save_settings(self.data_dir, {"consented": True})

    def tearDown(self):
        self.tmp.cleanup()

    def _collect_fn(self, cfg, cache_dir, now=None):
        metadata = getattr(self, 'source_activity', {})
        cfg.collection_activity.update(metadata)
        cfg.successful_sources.update('default' if ':' not in key else key.split(':', 1)[0] for key in metadata)
        return list(self.collected), list(self.collect_notes)

    def _llm(self, messages):
        self.llm_calls.append(messages)
        return json.dumps(
            {
                "asks": [{"ask": "Approve deploy?", "topic": "Deploy", "quadrant": 1}],
                "answered_task_ids": [],
            }
        )

    def _scanner(self, **kwargs):
        return Scanner(
            self.data_dir,
            llm=self._llm,
            collect_fn=self._collect_fn,
            now_fn=lambda: self.t0,
            **kwargs,
        )

    def _seed_scanned_open(
        self, key: str, msg_id: str, scanned_at: float, title: str = "Test chat"
    ) -> None:
        store = Store(os.path.join(self.data_dir, "wou.db"))
        store.upsert_task(
            key,
            "Desktop",
            title,
            f"Open ask {key}",
            "Topic",
            1,
            msg_id,
            now=scanned_at,
        )
        store.set_scan_state(key, msg_id, scanned_at)
        store.close()

    def _classified_titles(self) -> list[str]:
        titles: list[str] = []
        for messages in self.llm_calls:
            content = ""
            for message in messages:
                if message.get("role") == "user":
                    content = message.get("content") or ""
                    break
            for line in content.splitlines():
                if line.startswith("Chat title: "):
                    titles.append(line[len("Chat title: ") :])
                    break
        return titles

    def test_changed_chat_triggers_classify(self):
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["classified"], 1)
        self.assertEqual(summary["added"], 1)
        self.assertEqual(len(self.llm_calls), 1)

    def test_project_refresh_without_reclassification(self):
        self.collected = [
            _chat(
                "s1",
                "m1",
                self.t0,
                project={
                    "key": "default:p",
                    "name": "Work",
                    "slug": "work",
                    "color": "blue",
                },
            )
        ]
        self._scanner().run_once(manual=True, force_full=True)
        self.llm_calls.clear()
        self.collected[0]["project"]["name"] = "Renamed"
        summary = self._scanner().run_once(manual=True, force_full=False)
        self.assertEqual(summary["classified"], 0)
        store = Store(os.path.join(self.data_dir, "wou.db"))
        try:
            self.assertEqual(store.list_tasks()[0]["project"]["name"], "Renamed")
        finally:
            store.close()
        self.assertEqual(self.llm_calls, [])

    def test_unchanged_chat_skipped(self):
        self.collected = [_chat("s1", "m1", self.t0)]
        self._scanner().run_once(manual=True, force_full=True)
        self.llm_calls.clear()
        summary = self._scanner().run_once(manual=True, force_full=False)
        self.assertEqual(summary["classified"], 0)

    def test_background_sweep_skips_recent_open_task(self):
        self._seed_scanned_open("s1", "m1", self.t0 - 3600)
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=False)
        self.assertEqual(summary["classified"], 0)
        self.assertEqual(self.llm_calls, [])

    def test_background_sweep_rechecks_day_old_open_task(self):
        self._seed_scanned_open("s1", "m1", self.t0 - 25 * 3600)
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=False)
        self.assertEqual(summary["classified"], 1)
        self.assertEqual(len(self.llm_calls), 1)

    def test_background_daily_recheck_caps_five_oldest(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        # Newest scans are inserted first, so task-id order is not oldest-first.
        for i in range(7, -1, -1):
            key = f"s{i}"
            hours_old = 30 + (7 - i) * 10
            store.upsert_task(
                key,
                "Desktop",
                key,
                f"Open ask {key}",
                "Topic",
                1,
                "m",
                now=self.t0,
            )
            store.set_scan_state(key, "m", self.t0 - hours_old * 3600)
        store.close()
        self.collected = [
            _chat(f"s{i}", "m", self.t0 + i, title=f"s{i}") for i in range(8)
        ]
        summary = self._scanner().run_once(manual=False)
        self.assertEqual(summary["classified"], 5)
        # Due rechecks run first, oldest scan first.
        self.assertEqual(self._classified_titles(), ["s0", "s1", "s2", "s3", "s4"])

    def test_daily_recheck_not_crowded_out_by_changed_chats(self):
        save_settings(self.data_dir, {"consented": True, "max_chats_per_scan": 5})
        self._seed_scanned_open("old", "m", self.t0 - 30 * 3600, title="old")
        self.collected = [_chat("old", "m", self.t0 - 40 * 3600, title="old")] + [
            _chat(f"new{i}", f"n{i}", self.t0 - i, title=f"new{i}") for i in range(10)
        ]
        summary = self._scanner().run_once(manual=False)
        self.assertEqual(summary["classified"], 5)
        self.assertEqual(self._classified_titles()[0], "old")

    def test_background_dirty_unchanged_not_classified(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        store.set_scan_state("s1", "m1", self.t0 - 60)
        store.mark_dirty("s1", now=self.t0 - 120)
        store.close()
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=False)
        self.assertEqual(summary["classified"], 0)
        self.assertEqual(self.llm_calls, [])
        store = Store(os.path.join(self.data_dir, "wou.db"))
        self.assertEqual(store.pop_dirty(self.t0), [])
        store.close()

    def test_background_changed_chat_classified(self):
        self._seed_scanned_open("s1", "m0", self.t0 - 3600)
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=False)
        self.assertEqual(summary["classified"], 1)
        self.assertEqual(len(self.llm_calls), 1)

    def test_manual_rereads_unchanged_open_task(self):
        self._seed_scanned_open("s1", "m1", self.t0 - 3600)
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["classified"], 1)
        self.assertEqual(len(self.llm_calls), 1)

    def test_manual_dirty_forces_unchanged_chat(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        store.set_scan_state("s1", "m1", self.t0 - 60)
        store.mark_dirty("s1", now=self.t0 - 120)
        store.close()
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=True, force_full=False)
        self.assertEqual(summary["classified"], 1)
        self.assertEqual(len(self.llm_calls), 1)

    def test_stale_chat_never_classified(self):
        self._seed_scanned_open("s1", "m0", self.t0 - 25 * 3600)
        store = Store(os.path.join(self.data_dir, "wou.db"))
        store.mark_dirty("s1", now=self.t0 - 120)
        store.close()
        self.collected = [_chat("s1", "m1", self.t0, stale=True)]
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["classified"], 0)
        self.assertEqual(self.llm_calls, [])
        activity_path = os.path.join(self.data_dir, "chat_activity.json")
        with open(activity_path, encoding="utf-8") as fh:
            activity = json.load(fh)
        self.assertEqual(activity["s1"], self.t0)

    def test_dirty_debounce_includes_chat(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        store.mark_dirty("s1", now=self.t0 - 120)
        store.close()
        self.collected = [_chat("s1", "m1", self.t0)]
        with open(
            os.path.join(self.data_dir, "config.json"), "w", encoding="utf-8"
        ) as fh:
            json.dump({"debounce_seconds": 90}, fh)
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["classified"], 1)

    def test_background_scan_stops_at_daily_cap(self):
        save_settings(self.data_dir, {"daily_call_cap": 1})
        self.collected = [_chat(f"s{i}", f"m{i}", self.t0 + i) for i in range(3)]
        summary = self._scanner().run_once(manual=False)
        self.assertEqual(summary["classified"], 1)
        self.assertTrue(summary.get("capped"))
        today = usage.today(self.data_dir, self.t0)
        self.assertEqual(today["calls"], 1)
        self.assertEqual(today["manual_calls"], 0)

    def test_manual_force_scan_records_manual_calls(self):
        self.collected = [
            _chat("s1", "m1", self.t0),
            _chat("s2", "m2", self.t0 + 1),
        ]
        summary = self._scanner().run_once(manual=True, force=True, force_full=True)
        self.assertEqual(summary["classified"], 2)
        self.assertNotIn("capped", summary)
        today = usage.today(self.data_dir, self.t0)
        self.assertEqual(today["calls"], 2)
        self.assertEqual(today["manual_calls"], 2)

    def test_max_chats_cap(self):
        chats = [_chat(f"s{i}", f"m{i}", self.t0 + i) for i in range(10)]
        self.collected = chats
        save_settings(self.data_dir, {"max_chats_per_scan": 5})
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["classified"], 5)

    def test_lock_prevents_concurrent_run(self):
        self.collected = [_chat("s1", "m1", self.t0)]
        scanner = self._scanner()
        lock_path = os.path.join(self.data_dir, "scan.lock")
        import fcntl

        fh = open(lock_path, "a+", encoding="utf-8")
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
        try:
            summary = scanner.run_once()
            self.assertEqual(summary.get("skipped"), "locked")
        finally:
            fcntl.flock(fh.fileno(), fcntl.LOCK_UN)
            fh.close()

    def test_lookback_miss_does_not_auto_resolve(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        old_active = self.t0 - 20 * 86400
        store.upsert_task(
            "gone",
            "Desktop",
            "Old",
            "Still open?",
            "Topic",
            2,
            "m0",
            now=old_active,
        )
        activity_path = os.path.join(self.data_dir, "chat_activity.json")
        with open(activity_path, "w", encoding="utf-8") as fh:
            json.dump({"gone": old_active}, fh)
        store.close()
        self.collected = []
        save_settings(
            self.data_dir, {"lookback_days": 10, "retention_days": 30}
        )
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["resolved"], 0)
        store = Store(os.path.join(self.data_dir, "wou.db"))
        task = store.list_tasks(include_closed=True)[0]
        self.assertEqual(task["status"], "open")
        store.close()

    def test_retention_ages_inactive_task(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        old_active = self.t0 - 40 * 86400
        store.upsert_task(
            "gone",
            "Desktop",
            "Old",
            "Still open?",
            "Topic",
            2,
            "m0",
            now=old_active,
        )
        activity_path = os.path.join(self.data_dir, "chat_activity.json")
        with open(activity_path, "w", encoding="utf-8") as fh:
            json.dump({"gone": old_active}, fh)
        store.close()
        self.collected = []
        self.source_activity = {'gone': old_active}
        save_settings(self.data_dir, {"retention_days": 30})
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["expired"], 1)
        store = Store(os.path.join(self.data_dir, "wou.db"))
        task = store.list_tasks(include_closed=True)[0]
        self.assertEqual(task["status"], "expired")
        store.close()

    def test_future_due_not_aged_by_retention(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        old_active = self.t0 - 40 * 86400
        store.upsert_task(
            "gone",
            "Desktop",
            "Old",
            "Still open?",
            "Topic",
            2,
            "m0",
            now=old_active,
            due_at=self.t0 + 7 * 86400,
        )
        activity_path = os.path.join(self.data_dir, "chat_activity.json")
        with open(activity_path, "w", encoding="utf-8") as fh:
            json.dump({"gone": old_active}, fh)
        store.close()
        self.collected = []
        self.source_activity = {'gone': old_active}
        save_settings(self.data_dir, {"retention_days": 30})
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["resolved"], 0)

    def test_unavailable_source_does_not_age_tasks(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        old_active = self.t0 - 40 * 86400
        store.upsert_task(
            "remote:s1",
            "Remote",
            "Old",
            "Still open?",
            "Topic",
            2,
            "m0",
            now=old_active,
        )
        activity_path = os.path.join(self.data_dir, "chat_activity.json")
        with open(activity_path, "w", encoding="utf-8") as fh:
            json.dump({"remote:s1": old_active}, fh)
        store.close()
        self.collected = []
        self.collect_notes = ["remote unreachable (ssh failed); no remote cache yet"]
        save_settings(self.data_dir, {"retention_days": 30})
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["resolved"], 0)

    def test_retention_zero_never_ages(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        old_active = self.t0 - 400 * 86400
        store.upsert_task(
            "gone",
            "Desktop",
            "Old",
            "Still open?",
            "Topic",
            2,
            "m0",
            now=old_active,
        )
        activity_path = os.path.join(self.data_dir, "chat_activity.json")
        with open(activity_path, "w", encoding="utf-8") as fh:
            json.dump({"gone": old_active}, fh)
        store.close()
        self.collected = []
        save_settings(self.data_dir, {"retention_days": 0})
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["resolved"], 0)

    def test_aged_out_sweep_skips_manual(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        old_active = self.t0 - 20 * 86400
        store.add_manual_task(
            "gone",
            "Desktop",
            "Old",
            "Manual follow-up",
            "Manual follow-up",
            2,
            now=old_active,
        )
        activity_path = os.path.join(self.data_dir, "chat_activity.json")
        with open(activity_path, "w", encoding="utf-8") as fh:
            json.dump({"gone": old_active}, fh)
        store.close()
        self.collected = []
        save_settings(self.data_dir, {"retention_days": 10})
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["resolved"], 0)
        store = Store(os.path.join(self.data_dir, "wou.db"))
        task = store.list_tasks(include_closed=True)[0]
        self.assertEqual(task["status"], "open")
        store.close()

    def test_summary_written(self):
        self.collected = [_chat("s1", "m1", self.t0)]
        self._scanner().run_once(manual=True, force_full=True)
        last = read_last_scan(self.data_dir)
        self.assertIsNotNone(last)
        self.assertEqual(last["chats_seen"], 1)
        self.assertIn("at", last)


class BackgroundRunnerTest(unittest.TestCase):
    def tearDown(self):
        scanner_module._background_started = False

    def test_runner_closes_read_cache_after_active_scan_on_loop_exit(self):
        events: list[str] = []
        scan_started = threading.Event()
        scan_finished = threading.Event()

        class _FakeOwnerLock:
            def __init__(self, _path: Path) -> None:
                pass

            def acquire(self) -> bool:
                return True

            def release(self) -> None:
                pass

        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            state_db = home / "state.db"
            make_state_db(state_db)
            now = 1_700_000_000.0
            add_session(state_db, "s1", started_at=now - 100)
            add_message(state_db, "m1", "s1", "user", "hi")
            save_settings(home, {"consented": True, "mode": "auto"})
            with open(home / "config.json", "w", encoding="utf-8") as fh:
                json.dump({"collect": {"hermes_home": str(home)}}, fh)

            scanner = Scanner(home, now_fn=lambda: now)
            warm_cfg = scanner._collect_cfg(load_config(home))

            assert scanner_module.collect.collect_db(state_db, warm_cfg, now=now)
            assert scanner._read_cache._entries

            real_close = scanner.close_read_cache

            def close_tracked() -> None:
                events.append("close_read_cache")
                real_close()

            scanner.close_read_cache = close_tracked  # type: ignore[method-assign]

            def run_mock(**_kwargs):
                events.append("scan_start")
                scan_started.set()
                try:
                    return {"chats_seen": 0}
                finally:
                    events.append("scan_end")
                    scan_finished.set()

            scanner.run_once = run_mock  # type: ignore[method-assign]
            scanner.should_run_background = lambda _config=None: True  # type: ignore[method-assign]

            runner = BackgroundRunner(scanner, interval_seconds=3600)
            with mock.patch.object(scanner_module, "_ScanLock", _FakeOwnerLock):
                self.assertTrue(runner.start())
            self.assertTrue(
                scan_started.wait(timeout=2.0), "background scan should start"
            )
            self.assertTrue(
                scan_finished.wait(timeout=2.0), "background scan should finish"
            )

            runner.stop()

            self.assertIn("scan_start", events)
            self.assertIn("scan_end", events)
            close_idx = events.index("close_read_cache") if "close_read_cache" in events else -1
            end_idx = events.index("scan_end")
            self.assertGreater(
                close_idx,
                end_idx,
                f"close_read_cache must run after scan settles; got {events}",
            )

    def test_runner_starts_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            scanner = mock.Mock()
            scanner.data_dir = Path(tmp)
            scanner.should_run_background.return_value = False
            scanner.run_once.return_value = {}
            r1 = BackgroundRunner(scanner, interval_seconds=1)
            r2 = BackgroundRunner(scanner, interval_seconds=1)
            r1.start()
            r2.start()
            time.sleep(0.05)
            self.assertIsNotNone(r1._thread)
            self.assertIsNone(r2._thread)
            self.assertTrue(r1._thread.is_alive())
            r1.stop()
            r2.stop()


if __name__ == "__main__":
    unittest.main()
