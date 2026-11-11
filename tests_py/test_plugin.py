"""Tests for plugin register() hooks, tools, and commands."""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou.store import Store
from wou.settings import save_settings


class FakeLlm:
    def __init__(self):
        self.calls = []

    def complete(self, messages, **kwargs):
        self.calls.append((messages, kwargs))

        class R:
            text = '{"asks": [], "answered_task_ids": []}'

        return R()


class FakeCtx:
    def __init__(self, profile: str = "default"):
        self.hooks = {}
        self.tools = []
        self.commands = []
        self.aux_tasks = []
        self.llm = FakeLlm()
        self._profile = profile

    @property
    def profile_name(self):
        return self._profile

    def register_auxiliary_task(
        self, key, *, display_name, description, defaults=None, inherit_from=None
    ):
        self.aux_tasks.append(key)

    def register_hook(self, name, handler):
        self.hooks[name] = handler

    def register_tool(self, name, toolset, schema, handler):
        self.tools.append(
            {"name": name, "toolset": toolset, "schema": schema, "handler": handler}
        )

    def register_command(self, name, handler, description="", args_hint=""):
        self.commands.append(
            {
                "name": name,
                "handler": handler,
                "description": description,
                "args_hint": args_hint,
            }
        )


class PluginRegisterTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name
        self._env = mock.patch.dict(os.environ, {"WOU_DATA_DIR": self.data_dir})
        self._env.start()

    def tearDown(self):
        self._env.stop()
        self.tmp.cleanup()

    def _load_register(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        # Load the way Hermes does: a package named after the plugin, with
        # submodule_search_locations so relative imports (.wou...) resolve.
        name = "hermes_plugins_test.waiting_on_you"
        import types

        if "hermes_plugins_test" not in sys.modules:
            parent = types.ModuleType("hermes_plugins_test")
            parent.__path__ = []  # type: ignore[attr-defined]
            sys.modules["hermes_plugins_test"] = parent
        spec = importlib.util.spec_from_file_location(
            name,
            os.path.join(root, "__init__.py"),
            submodule_search_locations=[root],
        )
        mod = importlib.util.module_from_spec(spec)
        mod.__package__ = name
        sys.modules[name] = mod
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        return mod

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "1"})
    def test_consented_registration_starts_one_idle_runner(self):
        save_settings(self.data_dir, {"consented": True, "mode": "auto"})
        mod = self._load_register()
        with mock.patch.object(mod, "BackgroundRunner") as runner:
            mod.register(FakeCtx())
            mod.register(FakeCtx())
        runner.assert_called_once()
        runner.return_value.start.assert_called_once()

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "0"}, clear=False)
    def test_register_wires_hook_tool_command(self):
        mod = self._load_register()
        ctx = FakeCtx()
        mod.register(ctx)
        self.assertIn("post_llm_call", ctx.hooks)
        self.assertEqual(len(ctx.tools), 1)
        self.assertEqual(ctx.tools[0]["name"], "wou_list")
        self.assertEqual(ctx.tools[0]["toolset"], "waiting_on_you")
        self.assertEqual(len(ctx.commands), 1)
        self.assertEqual(ctx.commands[0]["name"], "waiting-on-you")
        self.assertEqual(ctx.aux_tasks, ["waiting_on_you"])
        # The default classifier routes through ctx.llm with our own task key.
        from importlib import import_module

        classify = import_module(mod.__name__ + ".wou.classify")
        out = classify.make_default_llm()([{"role": "user", "content": "x"}])
        self.assertIn("asks", out)
        self.assertEqual(ctx.llm.calls[0][1]["task"], "waiting_on_you")

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "0"}, clear=False)
    def test_hook_marks_dirty(self):
        mod = self._load_register()
        ctx = FakeCtx()
        mod.register(ctx)
        hook = ctx.hooks["post_llm_call"]
        hook(session_id="chat-abc")
        store = Store(os.path.join(self.data_dir, "wou.db"))
        keys = store.pop_dirty(time.time() + 60)
        store.close()
        self.assertEqual(keys, ["chat-abc"])

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "0"}, clear=False)
    def test_hook_swallows_errors(self):
        mod = self._load_register()
        ctx = FakeCtx()
        mod.register(ctx)
        hook = ctx.hooks["post_llm_call"]
        hook(session_id=None)
        hook()

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "0"}, clear=False)
    def test_wou_list_read_only(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        store.upsert_task("c1", "A", "T", "Ask?", "Topic", 1, "m1", now=1_700_000_000.0)
        store.close()
        mod = self._load_register()
        ctx = FakeCtx()
        mod.register(ctx)
        handler = ctx.tools[0]["handler"]
        out = json.loads(handler({"quadrant": 1, "limit": 10}))
        self.assertEqual(len(out["tasks"]), 1)
        after = Store(os.path.join(self.data_dir, "wou.db"))
        tasks = after.list_tasks(include_closed=False)
        after.close()
        self.assertEqual(tasks[0]["status"], "open")

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "0"}, clear=False)
    def test_wou_list_slim_sorted_and_default_limit(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        t0 = 1_700_000_000.0
        for i in range(25):
            store.upsert_task(
                f"c{i}",
                "A",
                f"Chat {i}",
                f"Ask {i}?",
                f"Topic {i}",
                4 if i < 24 else 1,
                f"m{i}",
                now=t0 + i,
            )
        store.close()
        mod = self._load_register()
        ctx = FakeCtx()
        mod.register(ctx)
        handler = ctx.tools[0]["handler"]
        out = json.loads(handler({}))
        self.assertEqual(out["total"], 25)
        self.assertEqual(len(out["tasks"]), 20)
        first = out["tasks"][0]
        self.assertEqual(first["quadrant"], 1)
        self.assertEqual(first["chat"], "Chat 24")
        self.assertEqual(
            set(first), {"id", "agent", "chat", "topic", "ask", "quadrant"}
        )
        # Newest first within a quadrant.
        self.assertEqual(out["tasks"][1]["topic"], "Topic 23")

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "0"}, clear=False)
    def test_wou_list_projects_tags_filters(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        tid = store.upsert_task("c", "A", "T", "Ask", "Topic", 2, "m")
        store.upsert_task("d", "A", "Other", "Another", "Topic", 2, "m")
        store.refresh_chat_project(
            "c", dict(key="default:p", name="Work", slug="work", color="blue")
        )
        tag = store.create_tag("Client")
        store.update_task_tags(tid, add=[tag["id"]])
        store.close()
        mod = self._load_register()
        ctx = FakeCtx()
        mod.register(ctx)
        handler = ctx.tools[0]["handler"]
        for project in ["work", "default:p"]:
            out = json.loads(handler({"project": project, "tag": "client"}))
            self.assertEqual(out["total"], 1)
            self.assertEqual(out["tasks"][0]["project"], "Work")
            self.assertEqual(out["tasks"][0]["tags"], ["Client"])
        self.assertEqual(json.loads(handler({"tag": "missing"}))["total"], 0)


if __name__ == "__main__":
    unittest.main()
