"""Catalog id migration: disposable directories only."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from unittest import mock

import pytest
import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou import discovery, identity, paths, plugin_config
from wou.plugin_config import _MISSING
from wou.settings import load_settings, save_settings
from wou.store import Store


def test_fresh_install_uses_legacy_data_namespace(tmp_path):
    home = tmp_path / "hermes"
    (home / "plugin-data" / identity.CATALOG_ID).mkdir(parents=True)
    with mock.patch.object(paths, "_active_hermes_home", return_value=home), mock.patch.dict(
        os.environ, {}, clear=False
    ):
        os.environ.pop("WOU_DATA_DIR", None)
        resolved = paths.plugin_data_directory()
    assert resolved == discovery.data_root_for_home(home)
    assert not discovery.has_existing_data(resolved)


def test_existing_legacy_tree_preserved(tmp_path):
    legacy = discovery.data_root_for_home(tmp_path)
    legacy.mkdir(parents=True)
    save_settings(legacy, {"consented": True, "mode": "manual", "group_by": "project"})
    store = Store(str(legacy / "wou.db"))
    tid = store.upsert_task("c", "Agent", "Chat", "Keep", "Topic", 2, "m")
    store.close()
    assert isinstance(tid, int)

    wrong = tmp_path / "plugin-data" / identity.CATALOG_ID
    wrong.mkdir(parents=True)

    with mock.patch.object(paths, "_active_hermes_home", return_value=tmp_path), mock.patch(
        "plugins.plugin_storage.plugin_data_dir", return_value=wrong
    ), mock.patch.dict(os.environ, {}, clear=False):
        os.environ.pop("WOU_DATA_DIR", None)
        resolved = paths.plugin_data_directory()

    assert resolved == legacy
    assert load_settings(resolved)["group_by"] == "project"
    reopened = Store(str(resolved / "wou.db"))
    try:
        assert reopened.get_task(tid)["ask"] == "Keep"
    finally:
        reopened.close()


def test_manifest_settings_fallback_to_legacy_entry(tmp_path, monkeypatch):
    cfg = {
        "plugins": {
            "entries": {
                identity.LEGACY_CATALOG_ID: {
                    "settings": {"decision_provider": "jev", "decision_model": "jev-latest"}
                }
            }
        }
    }
    (tmp_path / "config.yaml").write_text(yaml.dump(cfg), encoding="utf-8")
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))

    class Ctx:
        def get_config(self, key, default=_MISSING):
            return default

    assert plugin_config.get_manifest_setting(Ctx(), "decision_provider") == "jev"


def test_manifest_current_catalog_beats_legacy_entry(tmp_path, monkeypatch):
    cfg = {
        "plugins": {
            "entries": {
                identity.CATALOG_ID: {
                    "settings": {"decision_provider": "openai", "decision_model": "gpt-6-luna"}
                },
                identity.LEGACY_CATALOG_ID: {
                    "settings": {"decision_provider": "jev", "decision_model": "jev-latest"}
                },
            }
        }
    }
    (tmp_path / "config.yaml").write_text(yaml.dump(cfg), encoding="utf-8")
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))

    class Ctx:
        def get_config(self, key, default=_MISSING):
            return default

    assert plugin_config.get_manifest_setting(Ctx(), "decision_provider") == "openai"


def test_ctx_manifest_setting_wins_over_legacy_file(tmp_path, monkeypatch):
    cfg = {
        "plugins": {
            "entries": {
                identity.LEGACY_CATALOG_ID: {
                    "settings": {"decision_provider": "jev"}
                }
            }
        }
    }
    (tmp_path / "config.yaml").write_text(yaml.dump(cfg), encoding="utf-8")
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))

    class Ctx:
        values = {"decision_provider": "perplexity"}

        def get_config(self, key, default=_MISSING):
            return self.values.get(key, default)

    assert plugin_config.get_manifest_setting(Ctx(), "decision_provider") == "perplexity"


def test_manifest_explicit_empty_current_beats_legacy(tmp_path, monkeypatch):
    cfg = {
        "plugins": {
            "entries": {
                identity.CATALOG_ID: {"settings": {"decision_provider": ""}},
                identity.LEGACY_CATALOG_ID: {"settings": {"decision_provider": "jev"}},
            }
        }
    }
    (tmp_path / "config.yaml").write_text(yaml.dump(cfg), encoding="utf-8")
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))

    class Ctx:
        def get_config(self, key, default=_MISSING):
            return default

    assert plugin_config.get_manifest_setting(Ctx(), "decision_provider") == ""


def test_manifest_legacy_timeout_migrates_when_ctx_absent(tmp_path, monkeypatch):
    cfg = {
        "plugins": {
            "entries": {
                identity.LEGACY_CATALOG_ID: {"settings": {"decision_timeout": 45}},
            }
        }
    }
    (tmp_path / "config.yaml").write_text(yaml.dump(cfg), encoding="utf-8")
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))

    class Ctx:
        def get_config(self, key, default=_MISSING):
            return default

    assert plugin_config.get_manifest_setting(Ctx(), "decision_timeout", default=20) == 45


def test_manifest_current_nonempty_beats_legacy_timeout(tmp_path, monkeypatch):
    cfg = {
        "plugins": {
            "entries": {
                identity.CATALOG_ID: {"settings": {"decision_timeout": 30}},
                identity.LEGACY_CATALOG_ID: {"settings": {"decision_timeout": 45}},
            }
        }
    }
    (tmp_path / "config.yaml").write_text(yaml.dump(cfg), encoding="utf-8")
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))

    class Ctx:
        def get_config(self, key, default=_MISSING):
            return default

    assert plugin_config.get_manifest_setting(Ctx(), "decision_timeout", default=20) == 30


def test_has_existing_data_rejects_unrelated_settings_json(tmp_path):
    root = tmp_path / "data"
    root.mkdir()
    (root / "settings.json").write_text("{}", encoding="utf-8")
    assert not discovery.has_existing_data(root)


@pytest.mark.parametrize(
    "marker, payload",
    [
        ("wou.db", None),
        ("settings.json", {"consented": True, "mode": "auto"}),
        ("config.json", {"collect": {}, "debounce_seconds": 90}),
    ],
)
def test_has_existing_data_markers(tmp_path, marker, payload):
    root = tmp_path / "data"
    root.mkdir()
    target = root / marker
    if marker == "wou.db":
        store = Store(str(target))
        store.upsert_task("c", "A", "Chat", "?", "T", 2, "m")
        store.close()
    else:
        target.write_text(json.dumps(payload), encoding="utf-8")
    assert discovery.has_existing_data(root)


def test_concurrent_catalog_packages_share_scan_lock(tmp_path):
    from wou.scanner import _LOCK_FILE, _ScanLock

    data_dir = discovery.data_root_for_home(tmp_path)
    data_dir.mkdir(parents=True)
    save_settings(data_dir, {"consented": True})
    lock_path = data_dir / _LOCK_FILE
    owner = _ScanLock(lock_path)
    contender = _ScanLock(lock_path)
    assert owner.acquire()
    try:
        assert contender.acquire() is False
    finally:
        owner.release()
    assert contender.acquire() is True
    contender.release()
    bg_lock = data_dir / "background.lock"
    bg_a = _ScanLock(bg_lock)
    bg_b = _ScanLock(bg_lock)
    assert bg_a.acquire()
    try:
        assert bg_b.acquire() is False
    finally:
        bg_a.release()


def test_satellite_token_routes_include_legacy_prefixes():
    from wou import identity as id_mod
    from wou.satellite_auth import TOKEN_ROUTES

    assert id_mod.CATALOG_SATELLITE_PAIR in TOKEN_ROUTES
    assert id_mod.LEGACY_SATELLITE_PAIR in TOKEN_ROUTES
    assert id_mod.CATALOG_SATELLITE_PUSH in TOKEN_ROUTES
    assert id_mod.LEGACY_SATELLITE_PUSH in TOKEN_ROUTES


def test_plugin_http_router_has_no_legacy_api_prefix(monkeypatch):
    """Bearer token registration is not an HTTP mount; legacy prefix needs a separate host mount."""
    from tests_py.test_satellite_api import _load_api_module

    api = _load_api_module()
    paths = {getattr(route, "path", "") for route in api.router.routes}
    assert "/satellite/pair" in paths
    assert "/satellite/push" in paths
    assert not any(
        str(path).startswith(identity.LEGACY_API_PREFIX) for path in paths if path
    )


def test_satellite_sender_uses_catalog_paths_first():
    from satellite.wou_satellite import sender

    assert sender.PAIR_PATH.startswith(identity.CATALOG_API_PREFIX)
    assert sender.PUSH_PATH.startswith(identity.CATALOG_API_PREFIX)


def test_satellite_legacy_fallback_only_on_404(monkeypatch):
    from satellite.wou_satellite import sender

    calls: list[str] = []

    def fake_json(method, url, token, body=None):
        calls.append(url)
        if url.endswith(sender.PUSH_PATH):
            return 404, None, None
        if url.endswith(sender.LEGACY_PUSH_PATH):
            return 200, {"accepted": 1}, None
        return 503, None, None

    monkeypatch.setattr(sender, "_json_request", fake_json)
    status, parsed, err = sender._post_json_with_legacy(
        "http://hub", sender.PUSH_PATH, sender.LEGACY_PUSH_PATH, "tok", {"chats": []}
    )
    assert status == 200
    assert parsed == {"accepted": 1}
    assert err is None
    assert calls == ["http://hub" + sender.PUSH_PATH, "http://hub" + sender.LEGACY_PUSH_PATH]


def test_satellite_does_not_fallback_on_non_404(monkeypatch):
    from satellite.wou_satellite import sender

    def fake_json(method, url, token, body=None):
        return 401, {"error": "unauthorized"}, None

    monkeypatch.setattr(sender, "_json_request", fake_json)
    status, _, _ = sender._post_json_with_legacy(
        "http://hub", sender.PUSH_PATH, sender.LEGACY_PUSH_PATH, "tok", {}
    )
    assert status == 401
