"""Catalog build boundaries, exercised only in disposable homes."""
import ast
import json
import os
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
ROOT = Path(__file__).resolve().parents[1]


def test_catalog_python_uses_only_public_hermes_cli_imports():
    allowed = {"hermes_cli.config", "hermes_cli.plugin_events", "hermes_cli.dashboard_auth"}
    for base in (ROOT / "wou", ROOT / "dashboard", ROOT / "satellite"):
        for path in base.rglob("*.py"):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                modules = [node.module] if isinstance(node, ast.ImportFrom) else (
                    [alias.name for alias in node.names] if isinstance(node, ast.Import) else []
                )
                for module in modules:
                    if module and module.startswith("hermes_cli"):
                        assert module in allowed, (str(path.relative_to(ROOT)), module)
                if isinstance(node, ast.ImportFrom) and node.module == "hermes_cli.dashboard_auth":
                    assert all(not n.name.startswith("_") and n.name != "token_auth" for n in node.names)


def test_catalog_router_has_no_satellite_endpoints(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("WOU_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("HERMES_WOU_BACKGROUND", "0")
    from tests_py.test_api import _load_api_module
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    api = _load_api_module()
    app = FastAPI()
    app.include_router(api.router)
    client = TestClient(app)
    assert not any("satellite" in getattr(r, "path", "") for r in api.router.routes)
    for method, path in (("GET", "/satellite/status"), ("POST", "/satellite/pair-codes"),
                         ("POST", "/satellite/pair"), ("POST", "/satellite/push"),
                         ("GET", "/satellites"), ("DELETE", "/satellites/example")):
        assert client.request(method, path, json={}).status_code == 404


def test_old_satellite_records_are_ignored_and_preserved(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("WOU_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("HERMES_WOU_BACKGROUND", "0")
    from tests_py.test_api import _load_api_module
    api = _load_api_module()
    # Historical table layouts with a sentinel each: nothing in the catalog
    # build should read, migrate, or delete these records.
    db = tmp_path / "wou.db"
    tables = ("satellites", "satellite_pair_codes", "satellite_project_catalog", "satellite_chats")
    with sqlite3.connect(db) as conn:
        for name in tables:
            conn.execute(f"CREATE TABLE {name} (sentinel TEXT)")
            conn.execute(f"INSERT INTO {name} VALUES ('preserve')")
    cfg = api._collect.Config(local_profiles=[], remote_hosts=[])
    cfg.local_profiles = []
    chats, notes = api._collect.collect_all(cfg, tmp_path / "cache", data_dir=tmp_path)
    assert chats == []
    assert not notes
    assert api._collect.profile_display_map(cfg, data_dir=tmp_path) == {}
    monkeypatch.setattr(api._config, "load_config", lambda _: {"collect": {"local_profiles": [], "remote_hosts": []}})
    assert api._chat_targets()("retired:session") is None
    store = api.Store(str(db))
    store.close()
    with sqlite3.connect(db) as conn:
        for name in tables:
            assert conn.execute(f"SELECT * FROM {name}").fetchall() == [("preserve",)]


def test_catalog_has_no_satellite_client_or_settings_surface():
    for name in ("satellite", "wou/satellite_auth.py", "wou/satellite_hub.py",
                 "src/ui/SatellitesSection.tsx", "src/ui/satelliteHelpers.ts", "scripts/sync_satellite_reader.py"):
        assert not (ROOT / name).exists(), name
    for name in ("src/ui/api.ts", "src/ui/SettingsView.tsx", "src/ui/strings.ts", "src/ui/styles.ts", "desktop/plugin.js"):
        assert "satellite" not in (ROOT / name).read_text().lower(), name
