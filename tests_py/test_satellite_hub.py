"""Tests for wou.satellite_hub."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
import threading
from concurrent.futures import ThreadPoolExecutor
from unittest import mock
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou.collect import Config, collect_all
from wou.satellite_hub import (
    PAIR_PREFIX,
    SAT_TOKEN_PREFIX,
    create_pair_code,
    ingest,
    redeem_pair_code,
    revoke,
    verify_pair_code,
    verify_satellite_token,
)
from wou.store import Store
from wou import satellite_hub
from tests_py.test_collect import make_state_db


class SatelliteHubTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp.name, "wou.db")
        self.home = Path(self.tmp.name) / "hermes"
        self.home.mkdir()
        make_state_db(self.home / "state.db")
        self.now = 1_700_200_000.0

    def tearDown(self):
        self.tmp.cleanup()

    def test_concurrent_same_code_only_one_redeems(self):
        code, _ = create_pair_code(self.db_path, "race", "A", [], None, hermes_home=self.home, now=self.now)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(redeem_pair_code, self.db_path, code, "h", "v", hermes_home=self.home, now=self.now) for _ in range(2)]
            results = [f.result() for f in futures]
        self.assertEqual(sum(r is not None for r in results), 1)

    def test_concurrent_same_name_codes_only_one_redeems(self):
        first, _ = create_pair_code(self.db_path, "same", "A", [], None, hermes_home=self.home, now=self.now)
        second, _ = create_pair_code(self.db_path, "same", "A", [], None, hermes_home=self.home, now=self.now)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(redeem_pair_code, self.db_path, code, "h", "v", hermes_home=self.home, now=self.now) for code in (first, second)]
            results = []
            for future in futures:
                try:
                    results.append(future.result())
                except ValueError as exc:
                    self.assertIn('pick another name', str(exc))
                    results.append(None)
        self.assertEqual(sum(r is not None for r in results), 1)

    def test_pair_code_create_redeem_single_use(self):
        code, exp = create_pair_code(
            self.db_path,
            "studio",
            "Juno",
            ["conn-a"],
            "default",
            hermes_home=self.home,
            now=self.now,
        )
        self.assertTrue(code.startswith(PAIR_PREFIX))
        self.assertGreater(exp, self.now)
        cid = verify_pair_code(self.db_path, code, now=self.now)
        self.assertIsNotNone(cid)
        out = redeem_pair_code(
            self.db_path, code, "host", "1.0", hermes_home=self.home, now=self.now
        )
        self.assertIsNotNone(out)
        satellite_id, token, name, agent = out
        self.assertEqual(name, "studio")
        self.assertEqual(agent, "Juno")
        self.assertTrue(token.startswith(SAT_TOKEN_PREFIX))
        self.assertIsNone(
            redeem_pair_code(
                self.db_path, code, "host", "1.0", hermes_home=self.home, now=self.now
            )
        )
        self.assertEqual(verify_satellite_token(self.db_path, token), satellite_id)

    def test_pair_code_expiry(self):
        code, _ = create_pair_code(
            self.db_path,
            "air",
            "Gil",
            [],
            None,
            ttl=10,
            hermes_home=self.home,
            now=self.now,
        )
        self.assertIsNone(verify_pair_code(self.db_path, code, now=self.now + 11))

    def test_name_rules(self):
        with self.assertRaises(ValueError):
            create_pair_code(
                self.db_path, "default", "A", [], None, hermes_home=self.home
            )
        with self.assertRaises(ValueError):
            create_pair_code(
                self.db_path, "Bad Name", "A", [], None, hermes_home=self.home
            )
        code, _ = create_pair_code(
            self.db_path, "studio", "A", [], None, hermes_home=self.home, now=self.now
        )
        redeem_pair_code(
            self.db_path, code, "h", "v", hermes_home=self.home, now=self.now
        )
        with self.assertRaises(ValueError):
            create_pair_code(
                self.db_path, "studio", "B", [], None, hermes_home=self.home, now=self.now
            )

    def test_revoke_token(self):
        code, _ = create_pair_code(
            self.db_path, "mac2", "A", [], None, hermes_home=self.home, now=self.now
        )
        sid, token, _, _ = redeem_pair_code(
            self.db_path, code, "h", "v", hermes_home=self.home, now=self.now
        )
        revoke(self.db_path, sid, now=self.now)
        self.assertIsNone(verify_satellite_token(self.db_path, token))

    def test_repair_after_revoke(self):
        code1, _ = create_pair_code(
            self.db_path, "retry", "A", [], None, hermes_home=self.home, now=self.now
        )
        sid, _, _, _ = redeem_pair_code(
            self.db_path, code1, "h", "v", hermes_home=self.home, now=self.now
        )
        revoke(self.db_path, sid, now=self.now)
        code2, _ = create_pair_code(
            self.db_path, "retry", "A", [], None, hermes_home=self.home, now=self.now
        )
        self.assertIsNotNone(
            redeem_pair_code(
                self.db_path, code2, "h", "v", hermes_home=self.home, now=self.now
            )
        )

    def test_ingest_validation_and_dirty(self):
        code, _ = create_pair_code(
            self.db_path, "ing", "A", [], None, hermes_home=self.home, now=self.now
        )
        sid, token, _, _ = redeem_pair_code(
            self.db_path, code, "h", "v", hermes_home=self.home, now=self.now
        )
        payload = {
            "chats": [
                {
                    "id": "c1",
                    "title": "T",
                    "source": "desktop",
                    "last_active": self.now,
                    "last_msg_id": "m1",
                    "last_role": "user",
                    "user_last": "hi",
                    "agent_last": "",
                }
            ],
            "full": False,
            "version": "0.1",
        }
        r1 = ingest(self.db_path, sid, payload, now=self.now)
        self.assertEqual(r1, {"accepted": 1, "changed": 1})
        store = Store(self.db_path)
        dirty = store.pop_dirty(self.now + 1)
        store.close()
        self.assertEqual(dirty, ["ing:c1"])

        payload["chats"][0]["last_msg_id"] = "m1"
        r2 = ingest(self.db_path, sid, payload, now=self.now + 1)
        self.assertEqual(r2["changed"], 0)

        bad = dict(payload)
        bad["chats"][0]["last_role"] = "system"
        with self.assertRaises(ValueError):
            ingest(self.db_path, sid, bad, now=self.now)

        with self.assertRaises(ValueError):
            ingest(
                self.db_path,
                sid,
                {**payload, "chats": [{**payload["chats"][0], "id": "bad id"}]},
                now=self.now,
            )

    def test_ingest_full_deletes(self):
        code, _ = create_pair_code(
            self.db_path, "full", "A", [], None, hermes_home=self.home, now=self.now
        )
        sid, _, _, _ = redeem_pair_code(
            self.db_path, code, "h", "v", hermes_home=self.home, now=self.now
        )
        base = {
            "full": True,
            "version": "1",
            "chats": [
                {
                    "id": "a",
                    "title": "A",
                    "source": "desktop",
                    "last_active": self.now,
                    "last_msg_id": "1",
                    "last_role": "assistant",
                    "user_last": "",
                    "agent_last": "x",
                },
                {
                    "id": "b",
                    "title": "B",
                    "source": "desktop",
                    "last_active": self.now,
                    "last_msg_id": "2",
                    "last_role": "user",
                    "user_last": "y",
                    "agent_last": "",
                },
            ],
        }
        ingest(self.db_path, sid, base, now=self.now)
        ingest(
            self.db_path,
            sid,
            {**base, "chats": [base["chats"][0]]},
            now=self.now + 1,
        )
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        rows = conn.execute(
            "SELECT chat_id FROM satellite_chats WHERE satellite_id = ?", (sid,)
        ).fetchall()
        conn.close()
        self.assertEqual([r[0] for r in rows], ["a"])

    def test_collect_merge_and_ssh_skip(self):
        from unittest import mock

        code, _ = create_pair_code(
            self.db_path,
            "studio-mac",
            "Juno",
            [],
            None,
            hermes_home=self.home,
            now=self.now,
        )
        sid, _, _, _ = redeem_pair_code(
            self.db_path, code, "h", "v", hermes_home=self.home, now=self.now
        )
        ingest(
            self.db_path,
            sid,
            {
                "chats": [
                    {
                        "id": "remote1",
                        "title": "From sat",
                        "source": "desktop",
                        "last_active": self.now - 10,
                        "last_msg_id": "m",
                        "last_role": "user",
                        "user_last": "u",
                        "agent_last": "",
                    }
                ],
                "full": True,
                "version": "1",
            },
            now=self.now,
        )
        cfg = Config.from_dict(
            {
                "remote_hosts": [
                    {
                        "name": "studio-mac",
                        "ssh_host": "studio",
                        "state_db": "~/state.db",
                    }
                ]
            },
            hermes_home=self.home,
        )
        cache = Path(self.tmp.name) / "cache"
        with mock.patch("wou.collect.run_remote") as remote:
            chats, notes = collect_all(
                cfg, cache, now=self.now, data_dir=self.tmp.name
            )
            remote.assert_not_called()
        keys = {c["key"] for c in chats}
        self.assertIn("studio-mac:remote1", keys)
        self.assertEqual(
            next(c for c in chats if c["key"] == "studio-mac:remote1")["agent"],
            "Juno",
        )
        self.assertFalse(
            next(c for c in chats if c["key"] == "studio-mac:remote1").get("stale")
        )
        self.assertEqual(notes, [])

        # Eight hours of silence: rows are stale and the panel gets a note.
        later = self.now + 8 * 3600
        with mock.patch("wou.collect.run_remote") as remote:
            chats, notes = collect_all(cfg, cache, now=later, data_dir=self.tmp.name)
            remote.assert_not_called()
        row = next(c for c in chats if c["key"] == "studio-mac:remote1")
        self.assertTrue(row["stale"])
        self.assertEqual(len(notes), 1)
        self.assertTrue(notes[0].startswith("studio-mac unreachable ("))
        self.assertIn("list cached", notes[0])


if __name__ == "__main__":
    unittest.main()
