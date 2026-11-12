"""Third-review regressions; only temporary databases are used."""
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.mark.parametrize('hub', [False, True])
def test_archive_owner_matches_scanner_for_profile_home(tmp_path, monkeypatch, hub):
    from wou import paths
    from wou.scanner import Scanner
    root = tmp_path / 'home'
    work = root / 'profiles' / 'work'
    work.mkdir(parents=True)
    data = tmp_path / 'data'
    data.mkdir()
    monkeypatch.setenv('HERMES_HOME', str(work))
    monkeypatch.setenv('WOU_DATA_DIR', str(data))
    monkeypatch.setattr(paths, 'hub_hermes_home', lambda: root if hub else None)
    cfg = Scanner(data)._collect_cfg({})
    expected = root / 'state.db' if hub else work / 'state.db'
    assert Path(cfg.local_profiles[0]['state_db']) == expected
    assert paths.state_db_path_for_chat_key('chat') == expected
    if hub:
        assert paths.state_db_path_for_chat_key('work:chat') == work / 'state.db'

    # Colliding session IDs must not let archive/Undo mutate the other home.
    from types import SimpleNamespace
    from wou import hermes_sessions
    for db in (root / 'state.db', work / 'state.db'):
        with sqlite3.connect(db) as conn:
            conn.execute('CREATE TABLE sessions(id TEXT, archived INTEGER)')
            conn.execute("INSERT INTO sessions VALUES('chat', 0)")

    class SessionDB:
        def __init__(self, db_path):
            self.conn = sqlite3.connect(db_path)
        def set_session_archived(self, sid, archived):
            self.conn.execute('UPDATE sessions SET archived=? WHERE id=?', (int(archived), sid))
            self.conn.commit()
            return True
        def close(self):
            self.conn.close()

    monkeypatch.setitem(sys.modules, 'hermes_state', SimpleNamespace(SessionDB=SessionDB))
    for action, archived in ((hermes_sessions.archive_chat, 1), (hermes_sessions.unarchive_chat, 0)):
        assert action('chat')
        for db in (root / 'state.db', work / 'state.db'):
            with sqlite3.connect(db) as conn:
                assert conn.execute('SELECT archived FROM sessions').fetchone()[0] == (archived if db == expected else 0)


def test_archive_unknown_profile_raises_without_creating_database(tmp_path, monkeypatch):
    from wou import paths
    monkeypatch.setenv('HERMES_HOME', str(tmp_path / 'home'))
    monkeypatch.setenv('WOU_DATA_DIR', str(tmp_path / 'data'))
    monkeypatch.setattr(paths, 'hub_hermes_home', lambda: None)
    with pytest.raises(ValueError, match='owning profile'):
        paths.state_db_path_for_chat_key('unknown:chat')
    assert list(tmp_path.rglob('*')) == []


def test_all_stale_group_close_does_not_archive(tmp_path, monkeypatch):
    from tests_py import test_api as fixtures
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    api = fixtures._load_api_module()
    monkeypatch.setattr(api, 'plugin_data_directory', lambda: tmp_path)
    monkeypatch.setattr(api._settings, 'load_settings', lambda _: {'archive_chat_on_done': True})
    calls = []
    monkeypatch.setattr(api._hermes_sessions, 'archive_chat', lambda key: calls.append(key) or True)
    store = api.Store(str(tmp_path / 'wou.db'))
    tid = store.upsert_task('chat', 'A', 'Chat', 'Ask?', 'Topic', 2, 'm')
    store.resolve_task(tid)
    before = store.get_task(tid)
    store.close()
    app = FastAPI()
    app.include_router(api.router)
    with TestClient(app) as client:
        response = client.patch('/groups/chat', json={'status': 'done', 'task_ids': [tid]})
    assert response.status_code == 200, response.text
    assert response.json()['closed_task_ids'] == []
    assert response.json()['chat_archived'] is False
    assert calls == []
    store = api.Store(str(tmp_path / 'wou.db'))
    assert store.get_task(tid) == before
    store.close()