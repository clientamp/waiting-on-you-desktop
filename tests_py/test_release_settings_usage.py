"""Release-scope classify usage on failed LLM calls."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou import classify
from wou.classify import classify_chat, make_default_llm
from wou.store import Store


def _sample_chat(**extra):
    base = {
        "key": "k1",
        "agent": "Desktop",
        "title": "Test",
        "last_msg_id": "m1",
        "last_role": "assistant",
        "last_active": 1_700_000_000.0,
        "last_msg_at": 1_700_000_000.0,
        "user_last": "hi",
        "agent_last": "Please confirm?",
    }
    base.update(extra)
    return base


class ClassifyFailedUsageTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name
        self.store = Store(os.path.join(self.data_dir, "wou.db"))
        self.t0 = 1_700_000_000.0

    def tearDown(self):
        classify.set_host_llm(None)
        self.tmp.cleanup()

    def test_host_complete_failure_records_usage_once(self):
        recorded = []

        class Host:
            def complete(self, messages, **kwargs):
                raise RuntimeError("host down")

        classify.set_host_llm(Host())
        llm = make_default_llm(on_usage=lambda p, c: recorded.append((p, c)))
        with self.assertRaises(RuntimeError):
            llm([{"role": "user", "content": "abcd" * 10}])
        self.assertEqual(len(recorded), 1)
        self.assertGreater(recorded[0][0], 0)
        self.assertEqual(recorded[0][1], 0)

    def test_classify_injected_llm_failure_records_usage(self):
        recorded = []

        def boom(_messages):
            raise RuntimeError("network down")

        out = classify_chat(
            self.store,
            _sample_chat(),
            llm=boom,
            now=self.t0,
            on_usage=lambda p, c: recorded.append((p, c)),
        )
        self.assertIn("network down", out["error"])
        self.assertEqual(len(recorded), 1)
        self.assertGreater(recorded[0][0], 0)
        self.assertEqual(recorded[0][1], 0)

    def test_host_failure_via_classify_chat_records_usage(self):
        recorded = []

        class Host:
            def complete(self, messages, **kwargs):
                raise RuntimeError("quota exceeded")

        classify.set_host_llm(Host())
        out = classify_chat(
            self.store,
            _sample_chat(),
            now=self.t0,
            on_usage=lambda p, c: recorded.append((p, c)),
        )
        self.assertIn("quota", out["error"])
        self.assertEqual(len(recorded), 1)
        self.assertEqual(recorded[0][1], 0)


if __name__ == "__main__":
    unittest.main()
