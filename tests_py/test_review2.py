"""Second-review regressions; all state is isolated under tmp_path."""
import json
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wou.store import Store
from wou.scanner import Scanner
from wou.settings import load_settings, save_settings

NOW = 1_800_000_000.0
OLD = NOW - 40 * 86400


def seed_retention(root, **settings):
    save_settings(root, {'consented': True, **settings})
    store = Store(str(root / 'wou.db'))
    tid = store.upsert_task('chat', 'A', 'Chat', 'Ask?', 'Topic', 2, 'm', now=OLD)
    store.close()
    return tid


def scan_old(root, now=NOW):
    def collect(cfg, *_):
        cfg.successful_sources.add('default')
        cfg.collection_activity['chat'] = OLD
        return [], []
    return Scanner(root, collect_fn=collect, now_fn=lambda: now).run_once(manual=True)


@pytest.mark.parametrize('existing', [None, {}, {'consented': True}])
def test_default_retention_keeps_unanswered_forever(tmp_path, existing):
    if existing is not None:
        (tmp_path / 'settings.json').write_text(json.dumps(existing))
    assert load_settings(tmp_path)['retention_days'] == 0
    tid = seed_retention(tmp_path)
    scan_old(tmp_path)
    store = Store(str(tmp_path / 'wou.db'))
    assert store.get_task(tid)['status'] == 'open'
    store.close()


@pytest.mark.parametrize('sweep', [True, False])
@pytest.mark.parametrize('until,expected', [(NOW + 86400, 'snoozed'), (NOW - 10, 'open'), (NOW - 35 * 86400, 'open')])
def test_snooze_survives_retention_and_wake_scan(tmp_path, monkeypatch, until, expected, sweep):
    from wou import scanner
    monkeypatch.setattr(scanner, '_sweep_due', lambda *a: sweep)
    tid = seed_retention(tmp_path, retention_days=30)
    store = Store(str(tmp_path / 'wou.db'))
    store.snooze_task(tid, until, now=OLD)
    store.close()
    scan_old(tmp_path)
    store = Store(str(tmp_path / 'wou.db'))
    assert store.get_task(tid)['status'] == expected
    store.close()
    # Waking grants a fresh retention window, not permanent immunity.
    wake = max(NOW, until + 10)
    scan_old(tmp_path, now=wake)
    store = Store(str(tmp_path / 'wou.db'))
    assert store.get_task(tid)['status'] == 'open'
    store.close()
    scan_old(tmp_path, now=wake + 31 * 86400)
    store = Store(str(tmp_path / 'wou.db'))
    assert store.get_task(tid)['status'] == 'expired'
    store.close()



@pytest.mark.parametrize('profiles,owner', [
    ([{'name': 'work', 'state_db': 'custom'}], 'work'),
    ([], 'unknown'),
    ([{'name': 'work', 'state_db': 'custom'}, {'name': 'WORK', 'state_db': 'other'}], 'work'),
])
def test_archive_uses_configured_owner_or_fails_closed(tmp_path, monkeypatch, caplog, profiles, owner):
    from wou import paths, hermes_sessions
    from types import SimpleNamespace
    custom = tmp_path / 'custom'
    guessed = tmp_path / 'home' / 'profiles' / owner / 'state.db'
    guessed.parent.mkdir(parents=True)
    for db in (custom, guessed):
        with sqlite3.connect(db) as conn:
            conn.execute('CREATE TABLE sessions(id TEXT, archived INTEGER)')
            conn.execute("INSERT INTO sessions VALUES('chat', 0)")
    profiles = [{**p, 'state_db': str(tmp_path / p['state_db'])} for p in profiles]
    (tmp_path / 'config.json').write_text(json.dumps({'collect': {'local_profiles': profiles}}))
    monkeypatch.setenv('WOU_DATA_DIR', str(tmp_path))
    monkeypatch.setattr(paths, '_active_hermes_home', lambda: tmp_path / 'home')
    calls = []
    class SessionDB:
        def __init__(self, db_path):
            calls.append(db_path)
            self.conn = sqlite3.connect(db_path)
        def set_session_archived(self, sid, archived):
            calls.append((sid, archived))
            self.conn.execute('UPDATE sessions SET archived=? WHERE id=?', (int(archived), sid))
            self.conn.commit()
            return True
        def close(self):
            self.conn.close()
    monkeypatch.setitem(sys.modules, 'hermes_state', SimpleNamespace(SessionDB=SessionDB))
    if len(profiles) == 1:
        assert hermes_sessions.archive_chat(f'{owner}:chat')
        with sqlite3.connect(custom) as conn:
            assert conn.execute('SELECT archived FROM sessions').fetchone()[0] == 1
        assert hermes_sessions.unarchive_chat(f'{owner}:chat')
        with sqlite3.connect(custom) as conn:
            assert conn.execute('SELECT archived FROM sessions').fetchone()[0] == 0
        assert calls == [custom, ('chat', True), custom, ('chat', False)]
    else:
        assert not hermes_sessions.archive_chat(f'{owner}:chat')
        assert not hermes_sessions.unarchive_chat(f'{owner}:chat')
        assert calls == []
        assert 'owning profile' in caplog.text
    with sqlite3.connect(guessed) as conn:
        assert conn.execute('SELECT archived FROM sessions').fetchone()[0] == 0


def test_group_close_skips_stale_member_and_undo_only_changes_returned_ids(tmp_path):
    from tests_py import test_api as fixtures
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from unittest import mock
    api = fixtures._load_api_module()
    app = FastAPI()
    app.include_router(api.router)
    with mock.patch.object(api, 'plugin_data_directory', return_value=tmp_path):
        store = api.Store(str(tmp_path / 'wou.db'))
        a, b = [store.upsert_task('c', 'A', 'Chat', f'Ask {i}?', str(i), 2, 'm') for i in range(2)]
        store.resolve_task(a)
        store.close()
        with TestClient(app) as client:
            response = client.patch('/groups/c', json={'status': 'done', 'task_ids': [a, b]})
            assert response.status_code == 200, response.text
            assert response.json()['closed_task_ids'] == [b]
            for tid in response.json()['closed_task_ids']:
                assert client.patch(f'/tasks/{tid}', json={'status': 'open'}).status_code == 200
        store = api.Store(str(tmp_path / 'wou.db'))
        assert store.get_task(a)['status'] == 'resolved'
        assert store.get_task(b)['status'] == 'open'
        store.close()


def test_group_close_rolls_back_all_members_on_write_failure(tmp_path):
    store = Store(str(tmp_path / 'wou.db'))
    a, b = [store.upsert_task('c', 'A', 'Chat', f'Ask {i}?', str(i), 2, 'm') for i in range(2)]
    store._conn.execute(f"CREATE TRIGGER fail_close BEFORE UPDATE OF status ON tasks WHEN NEW.id={b} BEGIN SELECT RAISE(ABORT, 'injected'); END")
    store._conn.commit()
    with pytest.raises(sqlite3.IntegrityError):
        store.close_tasks_in_chat('c', [a, b], 'done')
    assert store.get_task(a)['status'] == 'open'
    assert store.closed_asks_for_chat('c') == []
    store.close()


def test_registration_retries_ownership_after_long_scan_unload(tmp_path, monkeypatch):
    import threading
    import time
    from importlib import import_module
    from tests_py import test_plugin as fixtures
    monkeypatch.setenv('HERMES_WOU_BACKGROUND', '1')
    oldmod = fixtures.PluginRegisterTest()._load_register()
    oldscan = import_module(oldmod.__name__ + '.wou.scanner')
    entered, release = threading.Event(), threading.Event()
    monkeypatch.setattr(oldmod, '_data_dir', lambda: tmp_path)
    import_module(oldmod.__name__ + '.wou.settings').save_settings(tmp_path, {'consented': True})
    monkeypatch.setattr(oldscan.Scanner, 'should_run_background', lambda s: True)
    def long_scan(*a, **kw):
        entered.set()
        release.wait()  # no timeout — a timed wait let the scan thread exit before assertions on slow CI
    monkeypatch.setattr(oldscan.Scanner, 'run_once', long_scan)
    oldmod.register(fixtures.FakeCtx())
    assert entered.wait(1)
    oldrunner = oldmod._background_runner
    assert oldrunner is not None and oldrunner._thread is not None and oldrunner._thread.is_alive()
    oldmod.stop_background()
    newmod = fixtures.PluginRegisterTest()._load_register()
    newscan = import_module(newmod.__name__ + '.wou.scanner')
    monkeypatch.setattr(newmod, '_data_dir', lambda: tmp_path)
    monkeypatch.setattr(newscan.BackgroundRunner, 'retry_seconds', 0.02, raising=False)
    monkeypatch.setattr(newscan.Scanner, 'should_run_background', lambda s: False)
    try:
        newmod.register(fixtures.FakeCtx())
        newrunner = newmod._background_runner
        assert newrunner is not None  # Retain pending retries so unload can cancel.
        assert newrunner._thread is None
        time.sleep(0.08)  # Several failed retry intervals while old scan owns the lock.
        assert newrunner._thread is None
        assert oldrunner._thread.is_alive()
        release.set()
        oldrunner._thread.join(1)
        # Retry timer may publish _thread only after start(); wait for a live owner.
        deadline = time.monotonic() + 1
        while (
            newrunner._thread is None or not newrunner._thread.is_alive()
        ) and time.monotonic() < deadline:
            time.sleep(0.01)
        assert newrunner._thread is not None and newrunner._thread.is_alive()
        assert not oldrunner._thread.is_alive()
        contender = newscan.BackgroundRunner(newrunner.scanner)
        assert contender.start() is False
        contender.stop()
        newmod.stop_background()
        assert contender._thread is None
    finally:
        release.set()
        oldrunner.stop()
        newmod.stop_background()


def test_dashboard_retains_and_cancels_losing_runner_retry(tmp_path, monkeypatch):
    import time
    from tests_py import test_api as fixtures
    from wou.scanner import _ScanLock
    api = fixtures._load_api_module()
    monkeypatch.setenv('HERMES_WOU_BACKGROUND', '1')
    monkeypatch.setattr(api, 'plugin_data_directory', lambda: tmp_path)
    monkeypatch.setattr(api._paths, 'hub_hermes_home', lambda: None)
    monkeypatch.setattr(api._scanner.BackgroundRunner, 'retry_seconds', 0.02)
    monkeypatch.setattr(api.Scanner, 'should_run_background', lambda s: False)
    save_settings(tmp_path, {'consented': True})
    owner = _ScanLock(tmp_path / 'background.lock')
    assert owner.acquire()
    try:
        api._maybe_start_background()
        pending = api._api_background_runner
        assert pending is not None
        api._maybe_start_background()
        assert api._api_background_runner is pending
        api._stop_background()
        owner.release()
        time.sleep(0.06)
        assert pending._thread is None
        assert pending._stop.is_set()
    finally:
        owner.release()
        api._stop_background()


def test_wou_list_excludes_expired_without_claiming_answered(tmp_path, monkeypatch):
    from tests_py import test_plugin as fixtures
    mod = fixtures.PluginRegisterTest()._load_register()
    monkeypatch.setattr(mod, '_data_dir', lambda: tmp_path)
    store = mod.Store(str(tmp_path / 'wou.db'))
    tid = store.upsert_task('c', 'A', 'Chat', 'Ask?', 'Topic', 2, 'm')
    store.expire_task(tid)
    store.close()
    ctx = fixtures.FakeCtx()
    mod.register(ctx)
    assert 'cleared for age' in mod._WOU_LIST_SCHEMA['description']
    assert 'not answered' in mod._WOU_LIST_SCHEMA['description']
    tool = next(t for t in ctx.tools if t['name'] == 'wou_list')
    assert json.loads(tool['handler']({})) == {'total': 0, 'tasks': []}


def test_opt_in_retention_expires_without_claiming_answered(tmp_path):
    tid = seed_retention(tmp_path, retention_days=30)
    result = scan_old(tmp_path)
    store = Store(str(tmp_path / 'wou.db'))
    assert store.get_task(tid)['status'] == 'expired'
    assert store.list_tasks(now=NOW) == []
    assert result['resolved'] == 0
    assert result['expired'] == 1
    store.reopen_task(tid, now=NOW)
    assert store.get_task(tid)['status'] == 'open'
    store.close()
