"""Tests for projects, agent migration, and classifier project assignment."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou.collect import profile_display_map, Config
from wou.store import Store


class StoreProjectsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(os.path.join(self.tmp.name, "wou.db"))
        self.t0 = 1_700_000_000.0

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def test_migration_adds_project_columns(self):
        cols = {
            row[1]
            for row in self.store._conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        self.assertIn("project_id", cols)
        self.assertIn("project_locked", cols)
        tables = {
            row[0]
            for row in self.store._conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        self.assertIn("projects", tables)

    def test_migrate_agent_names(self):
        self.store.upsert_task("c", "Default", "T", "a", "topic", 1, "m", now=self.t0)
        cfg = Config.from_dict({"agent_names": {"default": "Alice"}})
        self.store.migrate_agent_names(profile_display_map(cfg))
        row = self.store.list_tasks(now=self.t0)[0]
        self.assertEqual(row["agent"], "Alice")


if __name__ == "__main__":
    unittest.main()
