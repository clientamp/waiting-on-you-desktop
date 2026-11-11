import sys
import sqlite3
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def test_archive_unarchive_uses_owner_database_and_closes_handle(tmp_path, monkeypatch):
    from wou import paths, hermes_sessions
    hub = tmp_path / 'hub'
    secondary = hub / 'profiles' / 'work'
    for home in (hub, secondary):
        home.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(home / 'state.db') as conn:
            conn.execute('CREATE TABLE sessions(id TEXT, archived INTEGER)')
            conn.execute("INSERT INTO sessions VALUES('collision', 0)")
    monkeypatch.setattr(paths, 'hub_hermes_home', lambda: hub)
    monkeypatch.setattr(paths, '_active_hermes_home', lambda: secondary)
    closed = []

    class SessionDB:
        def __init__(self, db_path=None):
            assert isinstance(db_path, Path), 'host SessionDB expects pathlib.Path'
            self.path = db_path
            self.conn = sqlite3.connect(db_path)

        def set_session_archived(self, sid, archived):
            self.conn.execute('UPDATE sessions SET archived=? WHERE id=?', (int(archived), sid))
            self.conn.commit()
            return True

        def close(self):
            closed.append(self.path)
            self.conn.close()

    monkeypatch.setitem(sys.modules, 'hermes_state', SimpleNamespace(SessionDB=SessionDB))
    assert hermes_sessions.archive_chat('collision')
    with sqlite3.connect(hub / 'state.db') as conn:
        assert conn.execute('SELECT archived FROM sessions').fetchone()[0] == 1
    with sqlite3.connect(secondary / 'state.db') as conn:
        assert conn.execute('SELECT archived FROM sessions').fetchone()[0] == 0
    assert hermes_sessions.unarchive_chat('collision')
    assert hermes_sessions.archive_chat('work:collision')
    assert closed == [hub / 'state.db', hub / 'state.db', secondary / 'state.db']


def test_archive_profile_local_home_uses_collectors_default_key(tmp_path, monkeypatch):
    from wou import paths
    root = tmp_path / 'hub'
    active = root / 'profiles' / 'work'
    active.mkdir(parents=True)
    monkeypatch.setattr(paths, 'hub_hermes_home', lambda: None)
    monkeypatch.setattr(paths, '_active_hermes_home', lambda: active)
    monkeypatch.setenv('HERMES_HOME', str(active))
    monkeypatch.setenv('WOU_DATA_DIR', str(tmp_path / 'data'))
    monkeypatch.setattr(paths, '_default_hermes_home', lambda: root)
    assert paths.state_db_path_for_chat_key('chat') == active / 'state.db'


def test_archive_eligibility_includes_future_snoozed_task(tmp_path):
    from wou.store import Store
    store = Store(str(tmp_path / 'tasks.db'))
    tid = store.upsert_task('chat', 'A', 'Chat', 'Ask?', 'Topic', 2, 'm', now=100)
    store.snooze_task(tid, 1_900_000_000, now=101)
    assert store.has_active_tasks_for_chat('chat', now=102)
    store.close()
