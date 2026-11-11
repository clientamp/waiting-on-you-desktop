"""Bounds and rejection regressions from the pre-release audit."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import sqlite3
from unittest.mock import patch

import pytest
from wou import satellite_hub as hub


@pytest.mark.parametrize('projects', [[{'key': 'p', 'name': 'P', 'profile': 1}], [{'key': 'p', 'name': 'P'}] * 2001])
def test_remote_projects_are_bounded(tmp_path, projects):
    from wou.collect import Config, run_remote
    from types import SimpleNamespace
    proc = SimpleNamespace(returncode=0, stdout=json.dumps({'chats': [chat()], 'projects': projects}), stderr='')
    with patch('wou.collect.subprocess.run', return_value=proc):
        rows, note = run_remote(dict(name='remote', ssh_host='remote', state_db='~/state.db'), Config(), tmp_path)
    assert rows == []
    assert 'invalid' in note
    assert not (tmp_path / 'remote.json').exists()


@pytest.mark.parametrize('mode', ['partial_success', 'different_errors', 'non_connection'])
def test_scan_does_not_stop_for_other_failure_patterns(tmp_path, mode):
    from wou.scanner import Scanner
    from wou.settings import save_settings
    save_settings(tmp_path, {'consented': True})
    rows = [dict(chat(str(i), 100), key=str(i), agent='A') for i in range(6)]
    calls = []
    def llm(_):
        calls.append(1)
        if mode == 'partial_success' and len(calls) == 1:
            return '{"asks":[]}'
        if mode == 'non_connection':
            raise ValueError('ordinary validation failure')
        raise ConnectionError('Connection refused' + (str(len(calls)) if mode == 'different_errors' else ''))
    result = Scanner(tmp_path, llm=llm, collect_fn=lambda *a: (rows, []), now_fn=lambda: 100).run_once(manual=True)
    assert len(calls) == 6
    assert not result['model_unreachable']


def test_auth_rechecks_routes_after_registration(monkeypatch):
    from wou import satellite_auth as auth
    from hermes_cli.dashboard_auth import token_auth
    monkeypatch.setattr(token_auth, '_token_routes', set(auth.TOKEN_ROUTES) | {'/api/other/read'})
    monkeypatch.setattr(auth, '_provider_registered', True)
    monkeypatch.setattr(auth, '_registration_reason', '')
    assert not auth.ensure_registered(lambda: 'unused')[0]


def test_scan_connection_stop_ignores_no_model_skips(tmp_path):
    from wou.scanner import Scanner
    from wou.settings import save_settings
    save_settings(tmp_path, {'consented': True})
    rows = [dict(chat(str(i), 100 - i), key=str(i), agent='A') for i in range(6)]
    rows[0]['last_role'] = 'user'
    def unreachable(_):
        raise ConnectionError('Connection refused')
    result = Scanner(tmp_path, llm=unreachable, collect_fn=lambda *a: (rows, []), now_fn=lambda: 100).run_once(manual=True)
    assert result['failed'] == 3
    assert result['skipped_chats'] == 1
    assert result['model_unreachable']


def test_satellite_session_connection_mapping(tmp_path):
    from tests_py.test_api import _load_api_module
    api = _load_api_module()
    api.plugin_data_directory = lambda: str(tmp_path)
    code, _ = api._satellite_hub.create_pair_code(str(tmp_path / 'wou.db'), 'node', 'A', ['node-connection'], 'default', hermes_home=tmp_path)
    api._satellite_hub.redeem_pair_code(str(tmp_path / 'wou.db'), code, 'h', '1')
    cfg = api._collect.Config.from_dict({'local_profiles': [], 'remote_hosts': []})
    assert api._resolve_chat_key('session', 'default', 'node-connection', cfg) == 'node:session'


@pytest.mark.parametrize('route', ['/tasks', '/session-tasks'])
def test_http_rejects_raw_prefixed_session(tmp_path, route):
    from tests_py.test_api import _load_api_module
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    api = _load_api_module()
    api.plugin_data_directory = lambda: str(tmp_path)
    app = FastAPI()
    app.include_router(api.router)
    with TestClient(app) as client:
        if route == '/tasks':
            result = client.post(route, json={'session_id': 'remote:chat', 'quadrant': 2})
        else:
            result = client.get(route, params={'session_id': 'remote:chat'})
        assert result.status_code == 400
        assert 'unprefixed' in result.json()['error']


def test_hardening_privacy_and_release_notes():
    root = Path(__file__).resolve().parent.parent
    readme = (root / 'README.md').read_text()
    assert 'up to 8 of your own priority corrections from other chats' in readme
    assert 'task ask + chosen quadrant' in readme
    assert '2,000 chat rows per satellite' in readme
    release = (root / 'CHANGELOG.md').read_text().split('## Unreleased')[0]
    assert '### Hardening' in release
    assert 'three matching connection failures' in release


def test_pair_name_cannot_shadow_configured_remote(tmp_path):
    from wou import satellite_hub
    (tmp_path / 'config.json').write_text(json.dumps({'collect': {'remote_hosts': [{'name': 'Office'}]}}))
    with pytest.raises(ValueError, match='name already in use'):
        satellite_hub.create_pair_code(str(tmp_path / 'wou.db'), 'office', 'A', [], None, hermes_home=tmp_path)


def test_card_action_route_restored_for_external_producers():
    from tests_py.test_api import _load_api_module
    api = _load_api_module()
    route = next(r for r in api.router.routes if r.path == '/tasks/{task_id}/actions/{action_id}')
    assert route.methods == {'POST'}
    assert route.endpoint is api.run_task_action


def test_foreign_token_route_fails_closed(satellite, monkeypatch):
    from wou import satellite_auth as auth
    from hermes_cli.dashboard_auth import token_auth
    db, sid = satellite
    monkeypatch.setattr(token_auth, '_token_routes', set(auth.TOKEN_ROUTES) | {'/api/other/read'})
    monkeypatch.setattr(auth, '_provider_registered', False)
    monkeypatch.setattr(auth, '_registration_reason', '')
    monkeypatch.setattr(auth, 'verify_satellite_token', lambda *_: sid)
    assert not auth.ensure_registered(lambda: db)[0]
    assert auth.WaitingOnYouSatelliteProvider(lambda: db).verify_token(token='wousat_test') is None
    assert not auth.registration_state()[0]


def test_sql_clips_content_before_fetch(tmp_path, monkeypatch):
    from wou import collect
    from tests_py.test_collect import make_state_db, add_session, add_message
    db = tmp_path / 'state.db'
    make_state_db(db)
    add_session(db, 's', started_at=100)
    add_message(db, 'm', 's', 'assistant', 'ordinary content ' * 1000)
    queries = []
    real_connect = sqlite3.connect
    def connect(*args, **kwargs):
        conn = real_connect(*args, **kwargs)
        conn.set_trace_callback(queries.append)
        return conn
    monkeypatch.setattr(collect.sqlite3, 'connect', connect)
    rows = collect.collect_db(db, collect.Config(tail_chars=900), now=100)
    assert len(rows[0]['agent_last']) <= 901
    assert any('substr(rtrim(content, char(32,9,10,13,11,12)), -(case' in q.lower() for q in queries)


@pytest.mark.parametrize('route,operation,body', [('/tags/suggest', 'suggest_tags', {}), ('/eval-priorities', 'evaluate', {'confirm': True})])
def test_model_routes_reject_overlap(tmp_path, monkeypatch, route, operation, body):
    from tests_py.test_api import _load_api_module
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import threading
    from concurrent.futures import ThreadPoolExecutor
    api = _load_api_module()
    api.plugin_data_directory = lambda: str(tmp_path)
    api._settings.save_settings(tmp_path, {'consented': True})
    app = FastAPI()
    app.include_router(api.router)
    entered, release = threading.Event(), threading.Event()
    def blocked(*args):
        entered.set()
        assert release.wait(5)
        return {'ok': True}
    monkeypatch.setattr(api._assist, operation, blocked)
    with TestClient(app) as client, ThreadPoolExecutor() as pool:
        first = pool.submit(client.post, route, json=body)
        assert entered.wait(5)
        try:
            second = client.post(route, json=body)
            assert second.status_code == 409
            assert 'already' in second.json()['error']
        finally:
            release.set()
        assert first.result().status_code == 200
        assert client.post(route, json=body).status_code == 200


@pytest.mark.parametrize('cap,expected', [(1, 2), (0, 5)])
def test_forced_scan_hard_ceiling(tmp_path, cap, expected):
    from wou.scanner import Scanner
    from wou.settings import save_settings
    save_settings(tmp_path, {'consented': True, 'daily_call_cap': cap})
    rows = [dict(chat(str(i), 100), key=str(i), agent='A') for i in range(5)]
    scanner = Scanner(tmp_path, llm=lambda _: '{"asks":[]}',
                      collect_fn=lambda *a: (rows, []), now_fn=lambda: 100)
    result = scanner.run_once(manual=True, force=True)
    assert result['succeeded'] == expected


def test_scan_stops_after_three_matching_connection_failures(tmp_path):
    from wou.scanner import Scanner
    from wou.settings import save_settings
    from wou.store import Store
    save_settings(tmp_path, {'consented': True})
    rows = [dict(chat(str(i), 100), key=str(i), agent='A') for i in range(7)]
    calls = []
    def unreachable(_):
        calls.append(1)
        raise ConnectionError('Connection refused')
    scanner = Scanner(tmp_path, llm=unreachable, collect_fn=lambda *a: (rows, []), now_fn=lambda: 100)
    result = scanner.run_once(manual=True)
    assert len(calls) == 3
    assert result['model_unreachable'] is True
    assert result['classification_errors'] == ['Connection refused']
    store = Store(str(tmp_path / 'wou.db'))
    try:
        assert all(store.get_scan_state(r['key']) is None for r in rows)
    finally:
        store.close()


def test_raw_prefixed_session_ids_rejected_and_known_local_profile_required(tmp_path):
    from tests_py.test_api import _load_api_module
    from wou.collect import Config
    api = _load_api_module()
    assert api._validate_session_params('remote:chat', None, None) is not None
    cfg = Config.from_dict({'local_profiles': [{'name': 'default', 'state_db': str(tmp_path / 'missing.db')}]})
    assert api._resolve_chat_key('missing', None, None, cfg) == 'missing'
    assert api._resolve_chat_key('missing', 'unknown', None, cfg) is None


def test_remote_bounds_and_host_separator(tmp_path):
    from wou.collect import Config, run_remote
    from types import SimpleNamespace
    host = dict(name='remote', ssh_host='remote', state_db='~/state.db')
    proc = SimpleNamespace(returncode=0, stdout=json.dumps([chat(), chat('bad', True)]), stderr='')
    with patch('wou.collect.subprocess.run', return_value=proc) as run:
        rows, note = run_remote(host, Config(), tmp_path)
    argv = run.call_args.args[0]
    assert argv[argv.index(host['ssh_host']) - 1] == '--'
    assert [r['id'] for r in rows] == ['chat']
    assert 'invalid' in note
    with patch('wou.collect.MAX_REMOTE_STDOUT_BYTES', 20, create=True), patch('wou.collect.subprocess.run', return_value=proc):
        rows, note = run_remote(host, Config(), tmp_path)
    assert rows[0]['stale']
    assert 'too large' in note


def test_classifier_random_fences():
    from wou.classify import build_messages
    first = build_messages(chat(), [], [], 100, nonce='testnonce')
    assert 'as untrusted data' in first[1]['content']
    assert 'BEGIN_PERSON_testnonce' in first[1]['content']
    assert 'END_AGENT_testnonce' in first[1]['content']
    assert build_messages(chat(), [], [], 100) != build_messages(chat(), [], [], 100)


def chat(cid='chat', at=100):
    return dict(id=cid, title='Title', source='desktop', last_active=at,
                last_msg_id='1', last_role='assistant', user_last='', agent_last='Reply')


@pytest.fixture
def satellite(tmp_path):
    db = str(tmp_path / 'wou.db')
    code, _ = hub.create_pair_code(db, 'sat', 'Agent', [], None, hermes_home=tmp_path)
    sid, *_ = hub.redeem_pair_code(db, code, 'host', '1')
    return db, sid


@pytest.mark.parametrize('value', [True, float('nan'), float('inf'), -float('inf'), 10 ** 400])
def test_reject_nonfinite_activity(value):
    with pytest.raises(ValueError, match='last_active'):
        hub._validate_chat_row(chat(at=value), 0)


@pytest.mark.parametrize('value', [123, [], 'x' * 65])
def test_project_profile_bound(satellite, value):
    db, sid = satellite
    with pytest.raises(ValueError, match='profile'):
        hub.ingest(db, sid, dict(chats=[], full=False, version='1',
                   projects=[dict(key='p', name='Project', profile=value)]))


def test_satellite_keeps_newest_rows_without_touching_other_satellites(satellite):
    db, sid = satellite
    code, _ = hub.create_pair_code(db, 'other', 'Agent', [], None)
    other, *_ = hub.redeem_pair_code(db, code, 'host', '1')
    def push(s, rows):
        hub.ingest(db, s, dict(chats=rows, full=False, version='1'))
    from wou.store import Store
    store = Store(db)
    local_id = store.add_manual_task('local-chat', 'A', 'T', 'Local task', 'Local', 2)
    local_before = store.get_task(local_id)
    store.close()
    with patch.object(hub, 'MAX_SATELLITE_CHATS', 2, create=True):
        push(other, [chat('other')])
        push(sid, [chat('new', 300), chat('old', 100)])
        push(sid, [chat('middle', 200)])
        with sqlite3.connect(db) as conn:
            assert set(conn.execute('SELECT satellite_id,chat_id FROM satellite_chats')) == {
                (sid, 'new'), (sid, 'middle'), (other, 'other')}
    store = Store(db)
    try:
        assert store.get_task(local_id) == local_before
    finally:
        store.close()
