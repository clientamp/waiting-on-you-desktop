"""Message-tail and deferred local-session persistence regressions."""
import json
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from test_collect import make_state_db, add_session, add_message
from test_api import _load_api_module
from wou.collect import Config, clip, collect_db


@pytest.mark.parametrize('role,field,limit', [('assistant', 'agent_last', 900), ('user', 'user_last', 300)])
@pytest.mark.parametrize('separator', [' ', ' \t\n  '])
@pytest.mark.parametrize('reader', ['local', 'satellite'])
def test_sql_excerpt_preserves_final_sentence(tmp_path, role, field, limit, separator, reader):
    if reader == 'satellite':
        from satellite.wou_satellite.reader import collect_db as read_db
    else:
        read_db = collect_db
    db = tmp_path / 'state.db'
    make_state_db(db)
    add_session(db, 'session', started_at=100)
    final = 'Please approve the violet launch checklist.'
    content = separator.join(['Earlier detailed progress'] * 200) + separator + final
    assert len(content) > 3000
    add_message(db, 'message', 'session', role, content)
    row, = read_db(db, Config(), now=100)
    assert final in row[field]
    assert row[field] == clip(content, limit)
    assert len(row[field]) <= limit + 1


@pytest.mark.parametrize('role,field', [('assistant', 'agent_last'), ('user', 'user_last')])
@pytest.mark.parametrize('trailing', ['\n' * 6256, ' \t\r\n\v\f' * 1100], ids=['newlines', 'mixed-whitespace'])
@pytest.mark.parametrize('reader', ['local', 'satellite'])
def test_sql_excerpt_ignores_trailing_whitespace(tmp_path, role, field, trailing, reader):
    if reader == 'satellite':
        from satellite.wou_satellite.reader import collect_db as read_db
    else:
        read_db = collect_db
    db = tmp_path / 'state.db'
    make_state_db(db)
    add_session(db, 'session', started_at=100)
    ask = 'Please approve the launch.'
    content = ask + trailing
    add_message(db, 'message', 'session', role, content)

    rows = read_db(db, Config(tail_chars=1500, user_chars=1500), now=100)

    # The non-empty filter must retain the message, not just its session.
    assert len(rows) == 1
    row = rows[0]
    assert row['last_msg_id'] == 'message'
    assert row['last_role'] == role
    assert row[field] == ask
    assert row[field] == clip(content, 1500)


@pytest.mark.parametrize('route', ['/tasks', '/session-tasks'])
@pytest.mark.parametrize('profile,session_id,status,key', [
    (None, 'unsaved-chat', 200, 'unsaved-chat'),
    ('default', 'unsaved-chat', 200, 'unsaved-chat'),
    ('work', 'unsaved-chat', 200, 'work:unsaved-chat'),
    ('unknown', 'unsaved-chat', 404, None),
    ('default', 'remote:chat', 400, None),
    ('../work', 'unsaved-chat', 400, None),
])
def test_unsaved_local_chat_routes(tmp_path, route, profile, session_id, status, key):
    api = _load_api_module()
    api.plugin_data_directory = lambda: str(tmp_path)
    profiles = []
    for name in ('default', 'work'):
        db = tmp_path / name / 'state.db'
        make_state_db(db)
        profiles.append({'name': name, 'state_db': str(db)})
    (tmp_path / 'config.json').write_text(json.dumps({'collect': {'local_profiles': profiles}}))
    app = FastAPI()
    app.include_router(api.router)
    params = {'session_id': session_id, 'connection_id': 'local'}
    if profile is not None:
        params['profile'] = profile
    with TestClient(app) as client:
        if route == '/tasks':
            response = client.post(route, json=dict(params, quadrant=2))
        else:
            response = client.get(route, params=params)
        assert response.status_code == status, response.text
        if status == 200:
            body = response.json()
            assert (body['task'] if route == '/tasks' else body)['chat_key'] == key
            lookup = client.get('/session-tasks', params=params)
            assert lookup.status_code == 200
            assert lookup.json()['chat_key'] == key
            assert lookup.json()['tracked'] is (route == '/tasks')
