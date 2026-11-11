"""Tests for wou.classify."""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou.classify import build_messages, classify_chat, parse_response
from wou.store import Store, similar


def _closed_section(user_content: str) -> str:
    start = user_content.index("CLOSED asks (never re-add):")
    end = len(user_content)
    return user_content[start:end]


def _sample_chat(**overrides):
    base = {
        "key": "chat/test",
        "agent": "Desktop",
        "title": "Deploy chat",
        "last_msg_id": "msg-42",
        "last_role": "assistant",
        "user_last": "Can you deploy?",
        "agent_last": "OK to run deploy now?",
    }
    base.update(overrides)
    return base


class ParseResponseTest(unittest.TestCase):
    def test_fenced_json(self):
        raw = 'Here you go:\n```json\n{"asks":[{"ask":"Go?","topic":"Deploy","quadrant":1}],"answered_task_ids":[]}\n```'
        out = parse_response(raw)
        self.assertEqual(len(out["asks"]), 1)
        self.assertEqual(out["asks"][0]["ask"], "Go?")

    def test_garbage_json(self):
        out = parse_response("not json at all {{{")
        self.assertEqual(out["asks"], [])
        self.assertIn("error", out)

    def test_group_title_parsed_and_truncated(self):
        raw = json.dumps(
            {
                "asks": [
                    {"ask": "a", "topic": "t", "quadrant": 2},
                    {"ask": "b", "topic": "t", "quadrant": 2},
                ],
                "answered_task_ids": [],
                "group_title": "Connect bank accounts",
            }
        )
        out = parse_response(raw)
        self.assertEqual(out["group_title"], "Connect bank accounts")

        long_title = "x" * 80
        raw2 = json.dumps(
            {
                "asks": [{"ask": "a", "topic": "t", "quadrant": 1}],
                "answered_task_ids": [],
                "group_title": long_title,
            }
        )
        out2 = parse_response(raw2)
        self.assertEqual(len(out2["group_title"]), 60)

    def test_topic_and_group_title_trim_trailing_punctuation(self):
        raw = json.dumps(
            {
                "asks": [
                    {
                        "ask": "Link Schwab?",
                        "topic": "Schwab account link.",
                        "quadrant": 2,
                    }
                ],
                "answered_task_ids": [],
                "group_title": "Connect bank accounts:",
            }
        )
        out = parse_response(raw)
        self.assertEqual(out["asks"][0]["topic"], "Schwab account link")
        self.assertEqual(out["group_title"], "Connect bank accounts")

    def test_quadrant_clamping(self):
        raw = json.dumps(
            {
                "asks": [
                    {"ask": "a", "topic": "t", "quadrant": 0},
                    {"ask": "b", "topic": "t", "quadrant": 99},
                    {"ask": "c", "topic": "t", "quadrant": "nope"},
                ],
                "answered_task_ids": [],
            }
        )
        out = parse_response(raw)
        self.assertEqual(out["asks"][0]["quadrant"], 1)
        self.assertEqual(out["asks"][1]["quadrant"], 4)
        self.assertEqual(out["asks"][2]["quadrant"], 2)


class BuildMessagesPromptTest(unittest.TestCase):
    def test_system_prompt_contains_title_guidance_examples(self):
        messages = build_messages(_sample_chat(), [], [], 1_700_000_000.0)
        system = messages[0]["content"]
        self.assertIn("Schwab account link", system)
        self.assertIn("OYHA opt-in test", system)
        self.assertIn("Beelink kernel update", system)
        self.assertIn("Brand report", system)
        self.assertIn("Connect bank accounts", system)
        self.assertIn("Otterly AI recording prep", system)
        self.assertIn('"Check"', system)


class ClassifyChatTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(os.path.join(self.tmp.name, "wou.db"))
        self.t0 = 1_700_000_000.0
        self.llm_calls = 0

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def _llm(self, messages):
        self.llm_calls += 1
        return self._llm_response

    def test_person_spoke_last_skips_llm_and_sets_scan(self):
        chat = _sample_chat(last_role="user")
        out = classify_chat(self.store, chat, llm=self._llm, now=self.t0)
        self.assertTrue(out["skipped"])
        self.assertEqual(self.llm_calls, 0)
        state = self.store.get_scan_state(chat["key"])
        self.assertEqual(state["last_msg_id"], "msg-42")

    def test_snoozed_task_not_duplicated_on_rescan(self):
        task_id = self.store.upsert_task(
            "chat/test",
            "Desktop",
            "Deploy chat",
            "OK to run deploy now?",
            "Deploy",
            2,
            "msg-old",
            now=self.t0,
        )
        self.store.snooze_task(task_id, self.t0 + 86400, now=self.t0)
        self.assertEqual(len(self.store.list_tasks(now=self.t0)), 0)
        self._llm_response = json.dumps(
            {
                "asks": [
                    {
                        "ask": "OK to run deploy now?",
                        "topic": "Deploy",
                        "quadrant": 2,
                    }
                ],
                "answered_task_ids": [],
            }
        )
        chat = _sample_chat(last_msg_id="msg-43")
        out = classify_chat(self.store, chat, llm=self._llm, now=self.t0 + 10)
        self.assertEqual(out["added"], 0)
        self.assertEqual(out["updated"], 1)
        rows = self.store._conn.execute(
            "SELECT id, status FROM tasks WHERE chat_key=?",
            ("chat/test",),
        ).fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["status"], "snoozed")

    def test_one_task_per_ask(self):
        self._llm_response = json.dumps(
            {
                "asks": [
                    {"ask": "Approve A?", "topic": "A", "quadrant": 2},
                    {"ask": "Approve B?", "topic": "B", "quadrant": 3},
                ],
                "answered_task_ids": [],
            }
        )
        out = classify_chat(self.store, _sample_chat(), llm=self._llm, now=self.t0)
        self.assertEqual(out["added"], 2)
        self.assertEqual(len(self.store.list_tasks(now=self.t0)), 2)

    def test_closed_ask_suppressed(self):
        task_id = self.store.upsert_task(
            "chat/test",
            "Desktop",
            "Deploy chat",
            "Old ask",
            "Old",
            2,
            "m1",
            now=self.t0,
        )
        self.store.close_task(task_id, "dismissed", now=self.t0)
        self._llm_response = json.dumps(
            {
                "asks": [{"ask": "Old ask", "topic": "Old", "quadrant": 2}],
                "answered_task_ids": [],
            }
        )
        out = classify_chat(self.store, _sample_chat(), llm=self._llm, now=self.t0)
        self.assertEqual(out["suppressed"], 1)
        self.assertEqual(out["added"], 0)
        self.assertEqual(self.store.list_tasks(now=self.t0), [])

    def test_garbage_json_no_store_changes(self):
        tid = self.store.upsert_task(
            "chat/test",
            "Desktop",
            "T",
            "Keep me",
            "K",
            1,
            "m0",
            now=self.t0,
        )
        self._llm_response = "%%% broken"
        before = self.store.list_tasks(now=self.t0)
        out = classify_chat(self.store, _sample_chat(), llm=self._llm, now=self.t0)
        self.assertIsNotNone(out["error"])
        self.assertEqual(self.store.list_tasks(now=self.t0), before)
        self.assertIsNone(self.store.get_scan_state("chat/test"))
        row = self.store.list_tasks(include_closed=True, now=self.t0)[0]
        self.assertEqual(row["id"], tid)
        self.assertEqual(row["status"], "open")

    def test_answered_ids_resolve_not_close(self):
        tid = self.store.upsert_task(
            "chat/test",
            "Desktop",
            "T",
            "Waiting",
            "W",
            1,
            "m0",
            now=self.t0,
        )
        other = self.store.upsert_task(
            "chat/other",
            "Desktop",
            "O",
            "Other",
            "O",
            1,
            "m0",
            now=self.t0,
        )
        self._llm_response = json.dumps(
            {"asks": [], "answered_task_ids": [tid, other, 99999]}
        )
        out = classify_chat(self.store, _sample_chat(), llm=self._llm, now=self.t0)
        self.assertEqual(out["resolved"], 1)
        rows = {
            r["id"]: r["status"]
            for r in self.store.list_tasks(include_closed=True, now=self.t0)
        }
        self.assertEqual(rows[tid], "resolved")
        self.assertEqual(rows[other], "open")
        self.assertEqual(self.store.closed_asks_for_chat("chat/test"), [])

    def test_answered_task_ids_skips_manual(self):
        manual_id = self.store.add_manual_task(
            "chat/test",
            "Desktop",
            "T",
            "Manual follow-up",
            "Manual follow-up",
            1,
            now=self.t0,
        )
        other = self.store.upsert_task(
            "chat/test",
            "Desktop",
            "T",
            "Auto waiting",
            "Auto",
            1,
            "m0",
            now=self.t0,
        )
        self._llm_response = json.dumps(
            {"asks": [], "answered_task_ids": [manual_id, other]}
        )
        out = classify_chat(self.store, _sample_chat(), llm=self._llm, now=self.t0)
        self.assertEqual(out["resolved"], 1)
        rows = {
            r["id"]: r["status"]
            for r in self.store.list_tasks(include_closed=True, now=self.t0)
        }
        self.assertEqual(rows[manual_id], "open")
        self.assertEqual(rows[other], "resolved")

    def test_prompt_contains_open_and_closed(self):
        tid = self.store.upsert_task(
            "chat/test",
            "Desktop",
            "T",
            "Open ask",
            "Open",
            4,
            "m0",
            now=self.t0,
        )
        closed_id = self.store.upsert_task(
            "chat/test",
            "Desktop",
            "T",
            "Gone ask",
            "Gone",
            2,
            "m0",
            now=self.t0,
        )
        self.store.close_task(closed_id, "done", now=self.t0)
        open_tasks = self.store.open_tasks_for_chat("chat/test")
        closed = self.store.closed_asks_for_chat("chat/test")
        messages = build_messages(_sample_chat(), open_tasks, closed, self.t0)
        user = messages[1]["content"]
        self.assertIn(f"id={tid}", user)
        self.assertIn("Gone ask", user)
        self.assertIn("CLOSED asks", user)

    def test_prompt_caps_closed_and_drops_project_ids(self):
        closed = [{"ask": f"Old ask {i}"} for i in range(30)]
        messages = build_messages(_sample_chat(), [], closed, self.t0)
        user = messages[1]["content"]
        self.assertNotIn("Old ask 19", user)
        self.assertIn("Old ask 20", user)
        self.assertIn("Old ask 29", user)
        self.assertNotIn("PROJECTS", user)
        self.assertIn("product/person/project", messages[0]["content"])
        # System prompt is a stable prefix (provider prompt caching).
        again = build_messages(_sample_chat(), [], [], self.t0 + 999)
        self.assertEqual(messages[0], again[0])

    def test_llm_exception_caught(self):
        def boom(_messages):
            raise RuntimeError("network down")

        out = classify_chat(self.store, _sample_chat(), llm=boom, now=self.t0)
        self.assertIn("network down", out["error"])
        self.assertEqual(self.store.list_tasks(now=self.t0), [])

    def test_group_title_stored(self):
        self._llm_response = json.dumps(
            {
                "asks": [
                    {"ask": "Schwab?", "topic": "Bank", "quadrant": 2},
                    {"ask": "USB?", "topic": "Bank", "quadrant": 2},
                ],
                "answered_task_ids": [],
                "group_title": "Connect bank accounts",
            }
        )
        classify_chat(self.store, _sample_chat(), llm=self._llm, now=self.t0)
        groups = self.store.list_task_groups(self.store.list_tasks(now=self.t0))
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["title"], "Connect bank accounts")

    def test_source_excerpt_on_upsert(self):
        self._llm_response = json.dumps(
            {
                "asks": [{"ask": "Go?", "topic": "T", "quadrant": 1}],
                "answered_task_ids": [],
            }
        )
        chat = _sample_chat(agent_last="Agent says please review this.")
        classify_chat(self.store, chat, llm=self._llm, now=self.t0)
        task = self.store.list_tasks(now=self.t0)[0]
        self.assertEqual(task["source_excerpt"], "Agent says please review this.")

    def _close_ask(self, ask: str, source_msg_id: str = "msg-42") -> int:
        task_id = self.store.upsert_task(
            "chat/test",
            "Desktop",
            "Deploy chat",
            ask,
            "Topic",
            2,
            source_msg_id,
            now=self.t0,
        )
        self.store.close_task(task_id, "done", now=self.t0)
        return task_id

    def _capturing_llm(self, payload: dict):
        self._prompts: list[str] = []

        def llm(messages):
            for message in messages:
                if message.get("role") == "user":
                    self._prompts.append(message["content"])
            return json.dumps(payload)

        return llm

    def test_closed_ask_stays_in_prompt_without_newer_message(self):
        ask = "Check the deploy window"
        self._close_ask(ask)
        llm = self._capturing_llm({"asks": [], "answered_task_ids": []})
        chat = _sample_chat(last_msg_id="msg-42", last_msg_at=self.t0)
        classify_chat(self.store, chat, llm=llm, now=self.t0 + 10)
        section = _closed_section(self._prompts[0])
        self.assertIn(f"- {ask}", section)

    def test_closed_ask_drops_from_prompt_after_newer_message(self):
        ask = "Check the deploy window"
        self._close_ask(ask)
        llm = self._capturing_llm({"asks": [], "answered_task_ids": []})
        chat = _sample_chat(last_msg_id="msg-99", last_msg_at=self.t0 + 30)
        classify_chat(self.store, chat, llm=llm, now=self.t0 + 40)
        section = _closed_section(self._prompts[0])
        self.assertNotIn(ask, section)
        self.assertIn("(none)", section)

    def test_reworded_ask_added_after_new_message(self):
        original = "Please approve the quarterly budget"
        reworded = "Send the vendor the signed contract"
        self.assertLess(similar(original, reworded), 0.8)
        self._close_ask(original)
        self._llm_response = json.dumps(
            {
                "asks": [{"ask": reworded, "topic": "Vendor", "quadrant": 2}],
                "answered_task_ids": [],
            }
        )
        chat = _sample_chat(last_msg_id="msg-99", last_msg_at=self.t0 + 30)
        out = classify_chat(self.store, chat, llm=self._llm, now=self.t0 + 40)
        self.assertEqual(out["added"], 1)
        self.assertEqual(out["suppressed"], 0)
        open_tasks = self.store.list_tasks(now=self.t0 + 40)
        self.assertEqual(len(open_tasks), 1)
        self.assertEqual(open_tasks[0]["ask"], reworded)
        self.assertEqual(open_tasks[0]["status"], "open")

    def test_near_identical_ask_stays_suppressed_after_new_message(self):
        original = "Should we ship the release today?"
        near = "Should we ship release today"
        self.assertGreaterEqual(similar(original, near), 0.8)
        self._close_ask(original)
        self._llm_response = json.dumps(
            {
                "asks": [{"ask": near, "topic": "Release", "quadrant": 2}],
                "answered_task_ids": [],
            }
        )
        chat = _sample_chat(last_msg_id="msg-99", last_msg_at=self.t0 + 30)
        out = classify_chat(self.store, chat, llm=self._llm, now=self.t0 + 40)
        self.assertEqual(out["suppressed"], 1)
        self.assertEqual(out["added"], 0)
        self.assertEqual(self.store.list_tasks(now=self.t0 + 40), [])

    def test_reworded_ask_blocked_on_same_message(self):
        # Checked off on msg-42; a rescan of that same message rewords it.
        self._close_ask("Please approve the quarterly budget")
        self._llm_response = json.dumps(
            {
                "asks": [
                    {"ask": "Sign off on Q3 spending", "topic": "Budget", "quadrant": 2}
                ],
                "answered_task_ids": [],
            }
        )
        chat = _sample_chat(last_msg_id="msg-42", last_msg_at=self.t0 - 5)
        out = classify_chat(self.store, chat, llm=self._llm, now=self.t0 + 10)
        self.assertEqual(out["added"], 0)
        self.assertEqual(out["suppressed"], 1)
        self.assertEqual(self.store.list_tasks(now=self.t0 + 10), [])

    def test_heavily_reworded_ask_returns_after_new_message(self):
        self._close_ask("Please approve the quarterly budget")
        self._llm_response = json.dumps(
            {
                "asks": [
                    {"ask": "Sign off on Q3 spending", "topic": "Budget", "quadrant": 2}
                ],
                "answered_task_ids": [],
            }
        )
        chat = _sample_chat(last_msg_id="msg-99", last_msg_at=self.t0 + 30)
        out = classify_chat(self.store, chat, llm=self._llm, now=self.t0 + 40)
        self.assertEqual(out["added"], 1)

    def test_new_message_in_same_second_as_close_drops_closed_block(self):
        # Timestamps are whole seconds; the message id decides.
        ask = "Check the deploy window"
        self._close_ask(ask)
        llm = self._capturing_llm({"asks": [], "answered_task_ids": []})
        chat = _sample_chat(last_msg_id="msg-99", last_msg_at=float(int(self.t0)))
        classify_chat(self.store, chat, llm=llm, now=self.t0 + 1)
        self.assertNotIn(ask, _closed_section(self._prompts[0]))

    def test_open_ask_still_updates_on_same_message(self):
        self._close_ask("Please approve the quarterly budget")
        self.store.upsert_task(
            "chat/test",
            "Desktop",
            "Deploy chat",
            "Pick the launch date",
            "Launch",
            2,
            "msg-42",
            now=self.t0,
        )
        self._llm_response = json.dumps(
            {
                "asks": [
                    {"ask": "Pick the launch date", "topic": "Launch", "quadrant": 1}
                ],
                "answered_task_ids": [],
            }
        )
        chat = _sample_chat(last_msg_id="msg-42", last_msg_at=self.t0 - 5)
        out = classify_chat(self.store, chat, llm=self._llm, now=self.t0 + 10)
        self.assertEqual(out["updated"], 1)
        self.assertEqual(out["added"], 0)

    def test_updated_vs_added(self):
        tid = self.store.upsert_task(
            "chat/test",
            "Desktop",
            "T",
            "Same ask",
            "S",
            1,
            "m0",
            now=self.t0,
        )
        self._llm_response = json.dumps(
            {
                "asks": [{"ask": "Same ask", "topic": "S", "quadrant": 2}],
                "answered_task_ids": [],
            }
        )
        out = classify_chat(self.store, _sample_chat(), llm=self._llm, now=self.t0)
        self.assertEqual(out["updated"], 1)
        self.assertEqual(out["added"], 0)
        self.assertEqual(len(self.store.open_tasks_for_chat("chat/test")), 1)
        self.assertEqual(self.store.open_tasks_for_chat("chat/test")[0]["id"], tid)


if __name__ == "__main__":
    unittest.main()
