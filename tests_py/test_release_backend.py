"""Release regressions using only isolated fixtures."""
import sqlite3
import json
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wou.store import Store


def test_all_schema_checks_are_inside_one_write_transaction(tmp_path, monkeypatch):
    real_connect = sqlite3.connect
    observations = []

    class CheckedConnection(sqlite3.Connection):
        def execute(self, sql, *args, **kwargs):
            if 'table_info(' in sql.lower() or sql.lstrip().upper().startswith('ALTER TABLE'):
                observations.append((sql, self.in_transaction))
            return super().execute(sql, *args, **kwargs)

    monkeypatch.setattr(sqlite3, 'connect', lambda *a, **kw: real_connect(*a, factory=CheckedConnection, **kw))
    store = Store(str(tmp_path / 'clean.db'))
    store.close()
    assert observations
    assert all(active for _, active in observations), observations


@pytest.mark.parametrize('source_state', ['missing', 'corrupt', 'recent_outside_lookback', 'old'])
def test_retention_requires_successful_source_and_current_activity(tmp_path, source_state):
    from wou.scanner import Scanner
    from wou.settings import save_settings
    from tests_py.test_collect import make_state_db, add_session

    now = 1_800_000_000.0
    data = tmp_path / 'data'
    save_settings(data, {'consented': True, 'retention_days': 30, 'lookback_days': 2})
    state = tmp_path / 'profile' / 'state.db'
    if source_state == 'corrupt':
        state.parent.mkdir()
        state.write_text('not sqlite')
    elif source_state != 'missing':
        make_state_db(state)
        days = 5 if source_state == 'recent_outside_lookback' else 40
        add_session(state, 'chat', last_activity_at=now - days * 86400)
    (data / 'config.json').write_text(json.dumps({'collect': {
        'local_profiles': [{'name': 'work', 'state_db': str(state)}],
        'remote_hosts': [],
    }}))
    store = Store(str(data / 'wou.db'))
    tid = store.upsert_task('work:chat', 'Work', 'Chat', 'Approve?', 'Approval', 2, 'm1', now=now - 40 * 86400)
    store.set_scan_state('work:chat', 'm1', now - 40 * 86400)
    store.close()
    (data / 'chat_activity.json').write_text(json.dumps({'work:chat': now - 40 * 86400}))
    result = Scanner(data, llm=lambda _: '{"asks": [], "answered_task_ids": []}', now_fn=lambda: now).run_once(manual=True)
    store = Store(str(data / 'wou.db'))
    status = store.get_task(tid)['status']
    store.close()
    assert result['chats_seen'] == 0  # Discovery stays at two days.
    assert status == ('expired' if source_state == 'old' else 'open')


@pytest.mark.parametrize('ok', [True, False])
def test_remote_collection_has_explicit_fresh_activity_evidence(tmp_path, monkeypatch, ok):
    from wou import collect
    from types import SimpleNamespace
    cfg = collect.Config(local_profiles=[], remote_hosts=[])
    response = SimpleNamespace(returncode=0 if ok else 1, stdout=json.dumps({
        'chats': [], 'projects': [], 'activity': {'s': 123.0},
    }), stderr='offline')
    monkeypatch.setattr(collect.subprocess, 'run', lambda *a, **kw: response)
    collect.run_remote({'name': 'remote', 'ssh_host': 'example.test', 'state_db': '~/state.db'}, cfg, tmp_path)
    assert ('remote' in cfg.successful_sources) is ok
    assert cfg.collection_activity == ({'remote:s': 123.0} if ok else {})


def test_scan_summary_distinguishes_failed_successful_and_skipped_chats(tmp_path, monkeypatch):
    from wou import scanner
    from wou.settings import save_settings
    save_settings(tmp_path, {'consented': True})
    now = 1_800_000_000.0
    chats = [{'key': key, 'agent': 'A', 'title': key, 'last_active': now,
              'last_msg_id': 'm', 'last_role': 'assistant'} for key in ('ok', 'failed', 'skipped', 'gated')]
    summaries = {'ok': {}, 'failed': {'error': 'model key rejected'},
                 'skipped': {'skipped': True}, 'gated': {'skipped': True, 'gated': True}}
    monkeypatch.setattr(scanner.classify, 'classify_chat', lambda store, chat, **kw: summaries[chat['key']])
    result = scanner.Scanner(tmp_path, collect_fn=lambda *a: (chats, ['remote unreachable']), now_fn=lambda: now).run_once(manual=True)
    assert result['attempted'] == 4
    assert result['succeeded'] == result['classified'] == 1
    assert result['failed'] == 1
    assert result['skipped_chats'] == 2
    assert result['classification_errors'] == ['model key rejected']


@pytest.mark.parametrize('kind', ['manual', 'locked', 'future_due', 'snoozed', 'normal'])
def test_retention_protects_user_owned_tasks_but_ages_unfinished_inactive_tasks(tmp_path, kind):
    from wou.scanner import Scanner
    from wou.settings import save_settings
    now = 1_800_000_000.0
    old = now - 40 * 86400
    save_settings(tmp_path, {'consented': True, 'retention_days': 30})
    store = Store(str(tmp_path / 'wou.db'))
    if kind == 'manual':
        tid = store.add_manual_task('chat', 'A', 'Chat', 'Ask?', 'Topic', 2, now=old)
    else:
        tid = store.upsert_task('chat', 'A', 'Chat', 'Ask?', 'Topic', 2, 'm', now=old,
                                due_at=now + 86400 if kind == 'future_due' else None)
    if kind == 'locked':
        store.set_quadrant(tid, 2, locked=True)
    if kind == 'snoozed':
        store.snooze_task(tid, now + 86400, now=old)
    store.close()
    def collect(cfg, *_):
        cfg.successful_sources.add('default')
        cfg.collection_activity['chat'] = old
        return [], []
    Scanner(tmp_path, collect_fn=collect, now_fn=lambda: now).run_once(manual=True)
    store = Store(str(tmp_path / 'wou.db'))
    assert store.get_task(tid)['status'] == ('expired' if kind == 'normal' else 'snoozed' if kind == 'snoozed' else 'open')
    store.close()
