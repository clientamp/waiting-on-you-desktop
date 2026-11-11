"""R1: settings, usage, consent, modes, caps, source_excerpt."""

from __future__ import annotations

import json
import os
import stat
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou import classify, usage
from wou.classify import make_default_llm, source_excerpt_from_chat
from wou.scanner import Scanner
from wou.settings import load_settings, save_settings
from wou.store import Store


def _chat(key: str, msg_id: str, last_active: float, **extra):
    base = {
        "key": key,
        "agent": "Desktop",
        "title": "Test chat",
        "last_msg_id": msg_id,
        "last_role": "assistant",
        "last_active": last_active,
        "user_last": "hi",
        "agent_last": "Please confirm the deploy?",
    }
    base.update(extra)
    return base


class SettingsValidationTest(unittest.TestCase):
    def test_concurrent_saves_merge_distinct_keys(self):
        import threading
        import time
        from concurrent.futures import ThreadPoolExecutor
        from wou import settings

        first_read = threading.Event()
        release_first = threading.Event()
        original = settings.load_settings
        reads = 0
        read_lock = threading.Lock()

        def paused_load(*args):
            nonlocal reads
            value = original(*args)
            with read_lock:
                reads += 1
                first = reads == 1
            if first:
                first_read.set()
                release_first.wait(timeout=2)
            return value

        with mock.patch.object(settings, "load_settings", side_effect=paused_load):
            with ThreadPoolExecutor(max_workers=2) as pool:
                one = pool.submit(settings.save_settings, self.data_dir, {"mode": "hourly"})
                self.assertTrue(first_read.wait(2))
                two = pool.submit(settings.save_settings, self.data_dir, {"retention_days": 12})
                time.sleep(0.05)
                release_first.set()
                one.result()
                two.result()
        saved = original(self.data_dir)
        self.assertEqual((saved["mode"], saved["retention_days"]), ("hourly", 12))

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def test_fresh_defaults(self):
        s = load_settings(self.data_dir)
        self.assertFalse(s["consented"])
        self.assertEqual(s["lookback_days"], 2)
        self.assertEqual(s["mode"], "auto")
        self.assertFalse(s["name_after_chat"])
        self.assertTrue(s["show_priorities"])
        self.assertTrue(s["show_project_badges"])
        self.assertTrue(s["follow_selected_chat"])

    def test_existing_install_settings_without_consented(self):
        path = os.path.join(self.data_dir, "settings.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"archive_chat_on_done": True}, fh)
        s = load_settings(self.data_dir)
        self.assertFalse(s["consented"])
        self.assertEqual(s["lookback_days"], 10)

    def test_tasks_in_db_do_not_grant_consent(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        store.upsert_task(
            "c", "A", "T", "ask", "topic", 1, "m", now=1_700_000_000.0
        )
        store.close()
        s = load_settings(self.data_dir)
        self.assertFalse(s["consented"])
        self.assertEqual(s["lookback_days"], 2)

    def test_explicit_consented_true_in_settings(self):
        save_settings(self.data_dir, {"consented": True})
        s = load_settings(self.data_dir)
        self.assertTrue(s["consented"])

    def test_missing_settings_file_no_consent(self):
        s = load_settings(self.data_dir)
        self.assertFalse(s["consented"])

    def test_unknown_key_400(self):
        with self.assertRaises(ValueError) as ctx:
            save_settings(self.data_dir, {"not_a_key": 1})
        self.assertIn("unknown fields", str(ctx.exception))

    def test_int_range_validation(self):
        with self.assertRaises(ValueError):
            save_settings(self.data_dir, {"debounce_seconds": 10})
        with self.assertRaises(ValueError):
            save_settings(self.data_dir, {"lookback_days": 31})
        save_settings(self.data_dir, {"debounce_seconds": 120})
        self.assertEqual(load_settings(self.data_dir)["debounce_seconds"], 120)


class UsageTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name
        self.t0 = 1_700_000_000.0

    def tearDown(self):
        self.tmp.cleanup()

    def test_record_and_today(self):
        usage.record(self.data_dir, 100, 50, self.t0)
        usage.record(self.data_dir, 10, 5, self.t0)
        today = usage.today(self.data_dir, self.t0)
        self.assertEqual(today["calls"], 2)
        self.assertEqual(today["prompt_tokens"], 110)
        self.assertEqual(today["completion_tokens"], 55)
        path = os.path.join(self.data_dir, "usage.json")
        mode = stat.S_IMODE(os.stat(path).st_mode)
        self.assertEqual(mode, stat.S_IRUSR | stat.S_IWUSR)

    def test_history_seven_days(self):
        hist = usage.history(self.data_dir, days=7, now=self.t0)
        self.assertEqual(len(hist), 7)
        self.assertEqual(hist[-1]["calls"], 0)
        self.assertEqual(hist[-1]["manual_calls"], 0)

    def test_manual_record_increments_calls_and_manual_calls(self):
        usage.record(self.data_dir, 10, 2, self.t0, manual=True)
        usage.record(self.data_dir, 1, 1, self.t0)
        today = usage.today(self.data_dir, self.t0)
        self.assertEqual(today["calls"], 2)
        self.assertEqual(today["manual_calls"], 1)
        hist = usage.history(self.data_dir, days=7, now=self.t0)
        self.assertEqual(hist[-1]["calls"], 2)
        self.assertEqual(hist[-1]["manual_calls"], 1)

    def test_old_usage_file_without_manual_calls_reads_zero(self):
        from datetime import datetime

        date = datetime.fromtimestamp(self.t0).strftime("%Y-%m-%d")
        path = os.path.join(self.data_dir, "usage.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "days": {
                        date: {
                            "calls": 3,
                            "prompt_tokens": 9,
                            "completion_tokens": 4,
                        }
                    }
                },
                fh,
            )
        today = usage.today(self.data_dir, self.t0)
        self.assertEqual(today["calls"], 3)
        self.assertEqual(today["manual_calls"], 0)
        hist = usage.history(self.data_dir, days=7, now=self.t0)
        self.assertEqual(hist[-1]["calls"], 3)
        self.assertEqual(hist[-1]["manual_calls"], 0)


class ClassifyUsageTest(unittest.TestCase):
    def test_default_llm_usage_hook(self):
        recorded = []

        class Usage:
            prompt_tokens = 42
            completion_tokens = 7

        class Result:
            text = '{"asks": [], "answered_task_ids": []}'
            usage = Usage()

        class Host:
            def complete(self, messages, **kwargs):
                return Result()

        classify.set_host_llm(Host())
        llm = make_default_llm(on_usage=lambda p, c: recorded.append((p, c)))
        llm([{"role": "user", "content": "hello"}])
        self.assertEqual(recorded, [(42, 7)])

    def test_default_llm_usage_estimate_fallback(self):
        recorded = []

        class Result:
            text = '{"asks": [], "answered_task_ids": []}'

        class Host:
            def complete(self, messages, **kwargs):
                return Result()

        classify.set_host_llm(Host())
        llm = make_default_llm(on_usage=lambda p, c: recorded.append((p, c)))
        llm([{"role": "user", "content": "abcd"}])
        self.assertEqual(recorded[0][0], 1)
        self.assertGreater(recorded[0][1], 0)


class ScannerControlTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name
        self.t0 = 1_700_000_000.0
        self.collected = []
        self.llm_calls = []

    def tearDown(self):
        self.tmp.cleanup()

    def _collect_fn(self, cfg, cache_dir, now=None):
        return list(self.collected), []

    def _llm(self, messages):
        self.llm_calls.append(messages)
        return json.dumps(
            {
                "asks": [
                    {"ask": "Approve?", "topic": "Deploy", "quadrant": 1}
                ],
                "answered_task_ids": [],
            }
        )

    def _scanner(self):
        return Scanner(
            self.data_dir,
            llm=self._llm,
            collect_fn=self._collect_fn,
            now_fn=lambda: self.t0,
        )

    def _consent(self):
        save_settings(self.data_dir, {"consented": True})

    def test_consent_gate_no_llm(self):
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary.get("skipped"), "consent")
        self.assertEqual(len(self.llm_calls), 0)

    def test_mode_off_skips_manual(self):
        self._consent()
        save_settings(self.data_dir, {"mode": "off"})
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary.get("skipped"), "off")
        self.assertEqual(len(self.llm_calls), 0)

    def test_mode_off_force_runs(self):
        self._consent()
        save_settings(self.data_dir, {"mode": "off"})
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(
            manual=True, force_full=True, force=True
        )
        self.assertNotIn("skipped", summary)
        self.assertEqual(summary["classified"], 1)

    def test_mode_manual_background_skips(self):
        self._consent()
        save_settings(self.data_dir, {"mode": "manual"})
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=False)
        self.assertEqual(summary.get("skipped"), "manual")

    def test_mode_hourly_no_dirty_trigger(self):
        self._consent()
        save_settings(self.data_dir, {"mode": "hourly"})
        store = Store(os.path.join(self.data_dir, "wou.db"))
        store.set_scan_state("s1", "m1", self.t0)
        store.mark_dirty("s1", now=self.t0 - 120)
        store.close()
        self.collected = [_chat("s1", "m1", self.t0)]
        scanner = self._scanner()
        summary = scanner.run_once(manual=False)
        self.assertEqual(summary.get("classified"), 0)
        self.assertEqual(len(self.llm_calls), 0)

    def test_should_run_hourly_only_on_sweep(self):
        self._consent()
        save_settings(self.data_dir, {"mode": "hourly", "sweep_minutes": 60})
        scanner = self._scanner()
        marker = os.path.join(self.data_dir, "last_sweep")
        with open(marker, "w", encoding="utf-8") as fh:
            fh.write("1")
        os.utime(marker, (self.t0, self.t0))
        self.assertFalse(scanner.should_run_background())

    def test_mode_manual_scan_runs(self):
        self._consent()
        save_settings(self.data_dir, {"mode": "manual"})
        self.collected = [_chat("s1", "m1", self.t0)]
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary.get("classified"), 1)

    def test_daily_cap_stops_background(self):
        self._consent()
        save_settings(self.data_dir, {"daily_call_cap": 1})
        chats = [_chat(f"s{i}", f"m{i}", self.t0 + i) for i in range(3)]
        self.collected = chats
        summary = self._scanner().run_once(manual=True, force_full=True)
        self.assertEqual(summary["classified"], 1)
        self.assertTrue(summary.get("capped"))

    def test_daily_cap_force_override(self):
        self._consent()
        save_settings(self.data_dir, {"daily_call_cap": 1})
        usage.record(self.data_dir, 1, 1, self.t0)
        chats = [_chat(f"s{i}", f"m{i}", self.t0 + i) for i in range(2)]
        self.collected = chats
        summary = self._scanner().run_once(
            manual=True, force_full=True, force=True
        )
        self.assertEqual(summary["classified"], 1)
        self.assertTrue(summary["capped"])

    def test_lookback_days_in_collect(self):
        self._consent()
        save_settings(self.data_dir, {"lookback_days": 3})
        seen_days = []

        def collect_fn(cfg, cache_dir, now=None):
            seen_days.append(cfg.days)
            return [], []

        scanner = Scanner(
            self.data_dir,
            llm=self._llm,
            collect_fn=collect_fn,
            now_fn=lambda: self.t0,
        )
        scanner.run_once(manual=True, force_full=True)
        self.assertEqual(seen_days, [3])

    def test_source_excerpt_stored(self):
        self._consent()
        agent = "x" * 500
        self.collected = [_chat("s1", "m1", self.t0, agent_last=agent)]
        self._scanner().run_once(manual=True, force_full=True)
        store = Store(os.path.join(self.data_dir, "wou.db"))
        task = store.list_tasks()[0]
        store.close()
        self.assertEqual(len(task["source_excerpt"]), 400)
        self.assertEqual(task["source_excerpt"], agent[:400])


class SourceExcerptMigrationTest(unittest.TestCase):
    def test_old_db_gets_column(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = os.path.join(tmp, "wou.db")
            import sqlite3

            conn = sqlite3.connect(db_path)
            conn.executescript(
                """
                CREATE TABLE tasks (
                    id INTEGER PRIMARY KEY,
                    chat_key TEXT, agent TEXT, chat_title TEXT,
                    ask TEXT, topic TEXT, quadrant INTEGER, status TEXT,
                    snooze_until REAL, source_msg_id TEXT,
                    created_at REAL, updated_at REAL,
                    fingerprint TEXT, quadrant_locked INTEGER DEFAULT 0
                );
                """
            )
            conn.close()
            store = Store(db_path)
            cols = {
                r[1]
                for r in store._conn.execute("PRAGMA table_info(tasks)").fetchall()
            }
            store.close()
            self.assertIn("source_excerpt", cols)


class SourceExcerptHelperTest(unittest.TestCase):
    def test_clip_400(self):
        long = "a" * 500
        self.assertEqual(len(source_excerpt_from_chat({"agent_last": long})), 400)


class PluginEventsTest(unittest.TestCase):
    def test_broadcast_settings_changed_safe_without_hermes(self):
        from wou.events import broadcast_settings_changed

        broadcast_settings_changed()


if __name__ == "__main__":
    unittest.main()
