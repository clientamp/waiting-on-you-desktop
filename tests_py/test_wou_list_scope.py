"""wou_list active-profile privacy scoping."""

from __future__ import annotations

import importlib
import importlib.util
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou import host as wou_host
from wou.settings import save_settings
from wou.store import Store
from wou.wou_list_scope import (
    invoking_profile_name,
    resolve_profile_scope,
    task_in_profile_scope,
)

_PLUGIN_NAME = "hermes_plugins_test.waiting_on_you"


class FakeCtx:
    """Minimal Hermes PluginContext stub (protocol from tests_py.test_plugin)."""

    def __init__(self, profile: str = "default", *, profile_raises: bool = False):
        self.hooks = {}
        self.tools = []
        self.commands = []
        self.aux_tasks = []
        self.llm = None
        self._profile = profile
        self._profile_raises = profile_raises

    @property
    def profile_name(self):
        if self._profile_raises:
            raise RuntimeError("profile unavailable")
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


class WouListScopeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name
        self._env = mock.patch.dict(os.environ, {"WOU_DATA_DIR": self.data_dir})
        self._env.start()
        self._plugin_mod = None

    def tearDown(self):
        self._teardown_plugin_module()
        wou_host.set_context(None)
        self._env.stop()
        self.tmp.cleanup()

    def _teardown_plugin_module(self):
        mod = sys.modules.get(_PLUGIN_NAME)
        if mod is not None:
            try:
                mod.stop_background()
            except Exception:
                pass
            try:
                self._plugin_host(mod).set_context(None)
            except Exception:
                pass

    def _load_register(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        import types

        if "hermes_plugins_test" not in sys.modules:
            parent = types.ModuleType("hermes_plugins_test")
            parent.__path__ = []  # type: ignore[attr-defined]
            sys.modules["hermes_plugins_test"] = parent
        spec = importlib.util.spec_from_file_location(
            _PLUGIN_NAME,
            os.path.join(root, "__init__.py"),
            submodule_search_locations=[root],
        )
        mod = importlib.util.module_from_spec(spec)
        mod.__package__ = _PLUGIN_NAME
        sys.modules[_PLUGIN_NAME] = mod
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        self._plugin_mod = mod
        return mod

    @staticmethod
    def _plugin_host(mod):
        return importlib.import_module(f"{mod.__name__}.wou.host")

    @staticmethod
    def _populated_store(data_dir: str) -> None:
        store = Store(os.path.join(data_dir, "wou.db"))
        store.upsert_task("c1", "A", "Default chat", "Ask?", "T", 1, "m1", now=1.0)
        store.upsert_task(
            "work:c2", "B", "Work chat", "Work ask?", "T", 1, "m2", now=2.0
        )
        store.close()

    def test_task_profile_keys(self):
        self.assertTrue(task_in_profile_scope("sess", {"default"}))
        self.assertFalse(task_in_profile_scope("work:sess", {"default"}))
        self.assertTrue(task_in_profile_scope("work:sess", {"work"}))
        self.assertFalse(task_in_profile_scope("sess", set()))

    def test_resolve_trusted_active_profile(self):
        scope = resolve_profile_scope({}, data_dir=self.data_dir, active="work")
        self.assertEqual(scope, {"work"})

    def test_resolve_explicit_default_when_trusted(self):
        scope = resolve_profile_scope({}, data_dir=self.data_dir, active="default")
        self.assertEqual(scope, {"default"})

    def test_model_supplied_profiles_ignored_even_with_consent(self):
        save_settings(self.data_dir, {"consented": True})
        scope = resolve_profile_scope(
            {"profiles": ["default", "work"]}, data_dir=self.data_dir, active="work"
        )
        self.assertEqual(scope, {"work"})

    def test_invoking_profile_missing_context_fails_closed(self):
        wou_host.set_context(None)
        self.assertIsNone(invoking_profile_name())
        self.assertEqual(resolve_profile_scope({}, data_dir=self.data_dir), set())

    def test_invoking_profile_exception_fails_closed(self):
        wou_host.set_context(FakeCtx(profile_raises=True))
        self.assertIsNone(invoking_profile_name())
        self.assertEqual(resolve_profile_scope({}, data_dir=self.data_dir), set())

    def test_invoking_profile_empty_name_fails_closed(self):
        wou_host.set_context(FakeCtx(profile="   "))
        self.assertIsNone(invoking_profile_name())

    def test_invoking_profile_default_when_explicit(self):
        wou_host.set_context(FakeCtx(profile="default"))
        self.assertEqual(invoking_profile_name(), "default")

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "0"}, clear=False)
    def test_wou_list_scopes_to_invoking_profile(self):
        self._populated_store(self.data_dir)
        mod = self._load_register()
        ctx = FakeCtx(profile="work")
        mod.register(ctx)
        handler = next(t for t in ctx.tools if t["name"] == "wou_list")["handler"]
        out = json.loads(handler({}))
        self.assertEqual(out["total"], 1)
        self.assertEqual(out["tasks"][0]["chat"], "Work chat")

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "0"}, clear=False)
    def test_wou_list_ignores_spoofed_profiles_when_consented(self):
        save_settings(self.data_dir, {"consented": True})
        self._populated_store(self.data_dir)
        mod = self._load_register()
        ctx = FakeCtx(profile="work")
        mod.register(ctx)
        handler = next(t for t in ctx.tools if t["name"] == "wou_list")["handler"]
        out = json.loads(handler({"profiles": ["default", "work"]}))
        self.assertEqual(out["total"], 1)
        self.assertEqual(out["tasks"][0]["chat"], "Work chat")

    @mock.patch.dict(os.environ, {"HERMES_WOU_BACKGROUND": "0"}, clear=False)
    def test_wou_list_no_context_returns_empty(self):
        store = Store(os.path.join(self.data_dir, "wou.db"))
        store.upsert_task("c1", "A", "Default chat", "Ask?", "T", 1, "m1", now=1.0)
        store.close()
        mod = self._load_register()
        ctx = FakeCtx(profile="default")
        mod.register(ctx)
        self._plugin_host(mod).set_context(None)
        handler = next(t for t in ctx.tools if t["name"] == "wou_list")["handler"]
        out = json.loads(handler({}))
        self.assertEqual(out, {"total": 0, "tasks": []})


if __name__ == "__main__":
    unittest.main()
