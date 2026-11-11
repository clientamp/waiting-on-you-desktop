"""Authenticated route contracts; all state is temporary and transports fake."""
import importlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from test_api import _load_api_module


class Context:
    def __init__(self):
        self.values = {}
    def get_config(self, key, default=None):
        return self.values.get(key, default)
    def set_config(self, key, value):
        self.values[key] = value


@pytest.fixture
def api(tmp_path, monkeypatch):
    mod = _load_api_module()
    monkeypatch.setattr(mod, 'plugin_data_directory', lambda: tmp_path)
    dec = importlib.import_module('wou.decision')
    dec.set_context(Context())
    monkeypatch.setattr(dec, 'get_secret', lambda name: 'super-private')
    app = FastAPI()
    app.include_router(mod.router)
    mod._settings.save_settings(tmp_path, {'consented': True})
    yield mod, TestClient(app), dec
    dec.set_context(None)
    importlib.import_module('wou.classify').set_host_llm(None)


def test_register_context_reaches_dashboard_host(api):
    mod, client, dec = api
    from test_plugin import PluginRegisterTest, FakeCtx
    plugin = PluginRegisterTest()._load_register()
    ctx = FakeCtx()
    ctx.values = {}
    ctx.get_config = lambda key, default=None: ctx.values.get(key, default)
    ctx.set_config = lambda key, value: ctx.values.__setitem__(key, value)
    plugin.register(ctx)
    assert client.patch('/decision', json={'provider': 'jev'}).status_code == 200
    assert ctx.values.get('decision_provider') == 'jev'
    assist = importlib.import_module('wou.assist')
    assist.require_model()
    assert importlib.import_module('wou.classify').make_default_llm()([]).startswith('{')


def test_decision_routes(api):
    mod, client, dec = api
    resp = client.patch('/decision', json={'provider': 'openai'})
    assert resp.status_code == 200
    assert resp.json()['key_set'] is True
    assert 'super-private' not in resp.text
    assert client.get('/decision').json()['provider'] == 'openai'
    assert client.patch('/decision', json={'api_key': 'bad'}).status_code == 400
    for p in ['', 'jev', 'clef', 'clef-flash', 'perplexity', 'perplexity-flash', 'openai', 'ollama', 'custom']:
        assert client.patch('/decision', json={'provider': p}).status_code == 200
    assert client.patch('/settings', json={'decision_gate': False, 'decision_priority': False}).status_code == 200
    assert client.get('/settings').json()['usage']['decision']['calls'] == 0


@pytest.mark.parametrize('code', [None, 'http_401', 'timeout'])
def test_connection_route(api, monkeypatch, code):
    mod, client, dec = api
    base = importlib.import_module('wou.decide.base')
    class Provider:
        model = 'synthetic'
        def decide(self, state, questions):
            assert state == 'Synthetic connection test: ready.'
            if code == 'timeout':
                raise TimeoutError('private request text')
            if code:
                raise base.DecisionError(code)
            return base.DecisionResult({'ready': base.Answer('noul', p_yes=1)}, self.model, {'input_tokens': 7}, 2)
    monkeypatch.setattr(dec, 'provider', lambda: Provider())
    response = client.post('/decision/test')
    assert response.status_code == 200
    assert response.json()['ok'] == (code is None)
    assert response.json()['code'] == code
    assert response.json()['model'] == 'synthetic'
    status = client.get('/decision').json()
    assert status['last_error'] == code
    assert status['usage_today']['calls'] == 1
    assert 'private request text' not in response.text


def host(mod, text):
    classify = importlib.import_module('wou.classify')
    class LLM:
        def complete(self, messages, **kwargs):
            self.messages = messages
            return SimpleNamespace(text=text, usage={'prompt_tokens': 10, 'completion_tokens': 20})
    llm = LLM()
    classify.set_host_llm(llm)
    return llm


def test_tags_no_model_and_validation(api):
    mod, client, dec = api
    assert client.post('/tags/suggest', json={}).status_code == 409
    for value in [0, 13, True, '8']:
        assert client.post('/tags/suggest', json={'limit': value}).status_code == 400


def test_suggest_tags_clean_no_save(api, monkeypatch):
    mod, client, dec = api
    assist = importlib.import_module('wou.assist')
    monkeypatch.setattr(assist, 'recent_chats', lambda d, n, **kw: [{'title': 'Launch', 'project': {'name': 'Product'}}] * 4)
    store = mod._open_store()
    store.create_tag('Existing')
    def tag(name, color='blue', hint='Products'):
        return {'name': name, 'color': color, 'hint': hint, 'example_count': 2}
    llm = host(mod, json.dumps({'suggestions': [tag('Existing'), tag('New'), tag('new'), tag('x' * 33), tag('Bad', 'black'), tag('Long', hint='x' * 201), tag('Next')]}))
    response = client.post('/tags/suggest', json={'limit': 8})
    assert response.status_code == 200
    assert [x['name'] for x in response.json()['suggestions']] == ['New', 'Next']
    assert len(store.list_tags()) == 1
    usage = client.get('/settings').json()['usage']['today']
    assert usage['manual_calls'] == 1 and usage['calls'] == 1
    assert 'Product' in llm.messages[1]['content']
    store.close()


def test_eval_confirm_cap_and_no_task_writes(api, monkeypatch):
    mod, client, dec = api
    assist = importlib.import_module('wou.assist')
    assert client.post('/eval-priorities', json={}).status_code == 400
    assert client.post('/eval-priorities', json={'confirm': 'yes'}).status_code == 400
    assert client.post('/eval-priorities', json={'confirm': True, 'labels': [{'task_id': i + 1, 'quadrant': 2} for i in range(26)]}).status_code == 400
    store = mod._open_store()
    tid = store.upsert_task('chat', 'Agent', 'Launch', 'Approve launch', 'Release', 4, '1', now=1000)
    store.record_priority_label(tid, 1, 'quiz')
    before = dict(store.get_task(tid))
    monkeypatch.setattr(assist, 'recent_chats', lambda d, n, **kw: [{'key': 'chat', 'title': 'Launch', 'last_role': 'assistant', 'agent_last': 'Approve launch?', 'project': None}])
    host(mod, '{"asks":[{"ask":"Approve launch","topic":"Release","urgency":3,"importance":3}]}')
    response = client.post('/eval-priorities', json={'confirm': True})
    assert response.status_code == 200
    assert response.json() == {'before': {'matched': 0, 'total': 1}, 'after': {'matched': 1, 'total': 1}, 'rows': [{'task_id': tid, 'label': 1, 'before': 4, 'after': 1}]}
    assert store.get_task(tid) == before
    assert client.get('/settings').json()['usage']['today']['manual_calls'] == 1
    store.close()

@pytest.mark.parametrize('route,body', [('/tags/suggest', {}), ('/eval-priorities', {'confirm': True})])
def test_model_routes_require_consent_before_collection(api, monkeypatch, route, body):
    mod, client, dec = api
    client.patch('/settings', json={'consented': False})
    monkeypatch.setattr(mod, '_open_store', lambda: pytest.fail('must not collect without consent'))
    response = client.post(route, json=body)
    assert response.status_code == 403
    assert response.json() == {'error': 'Start Waiting On You first (privacy consent).'}

def test_group_priority_undo_restores_children_and_locks_without_labels(api):
    mod, client, _ = api
    store = mod._open_store()
    ids = [store.upsert_task('chat', 'Agent', 'Launch', ask, 'Release', q, '1') for ask, q in [('Approve release', 1), ('Pick design', 4)]]
    store.set_quadrant(ids[1], 4, locked=True)
    before = [(store.get_task(i)['quadrant'], store.get_task(i)['quadrant_locked']) for i in ids]
    moved = client.patch('/groups/chat', json={'quadrant': 2})
    assert moved.status_code == 200
    labels = store.priority_labels()
    response = client.patch('/groups/chat', json={'priority_restore': moved.json()['priority_restore']})
    assert response.status_code == 200
    assert [(store.get_task(i)['quadrant'], store.get_task(i)['quadrant_locked']) for i in ids] == before
    assert store.priority_labels() == labels
    assert store._get_chat_group_row('chat')['quadrant_locked'] is False
    store.close()

def test_group_tags_only_mutate_explicit_open_chat_members(api):
    mod, client, _ = api
    store = mod._open_store()
    ids = [store.upsert_task('chat', 'Agent', 'Launch', ask, 'Release', 2, '1') for ask in ('Approve release', 'Pick design')]
    foreign = store.upsert_task('elsewhere', 'Agent', 'Other', 'Pick font', 'Design', 2, '1')
    tag = store.create_tag('Launch')['id']
    response = client.patch('/groups/chat', json={'tags_add': [tag], 'task_ids': [ids[0]]})
    assert response.status_code == 200
    assert [t['id'] for t in store.get_task(ids[0])['tags']] == [tag]
    assert store.get_task(ids[1])['tags'] == []
    for bad in ([foreign], [999], [True]):
        assert client.patch('/groups/chat', json={'tags_add': [tag], 'task_ids': bad}).status_code == 400
    store.close()

@pytest.mark.parametrize('quiz', [False, True])
def test_eval_uses_model_prediction_and_holds_out_labels(api, monkeypatch, quiz):
    mod, client, _ = api
    assist = importlib.import_module('wou.assist')
    store = mod._open_store()
    tid = store.upsert_task('chat', 'Agent', 'Launch', 'Approve launch', 'Release', 4, '1')
    response = client.post(f'/quiz/{tid}', json={'quadrant': 1}) if quiz else client.patch(f'/tasks/{tid}', json={'quadrant': 1})
    assert response.status_code == 200
    monkeypatch.setattr(assist, 'recent_chats', lambda *a, **kw: [{'key': 'chat', 'title': 'Launch', 'last_role': 'assistant', 'agent_last': 'Approve launch?', 'project': None}])
    original = assist.classify.build_messages
    def build(*args, **kwargs):
        assert all(row['task_id'] != tid for row in args[5])
        assert next(t for t in args[1] if t['id'] == tid)['quadrant'] == 4
        return original(*args, **kwargs)
    monkeypatch.setattr(assist.classify, 'build_messages', build)
    host(mod, '{"asks":[{"ask":"Approve launch","topic":"Release","urgency":3,"importance":3}]}')
    result = client.post('/eval-priorities', json={'confirm': True})
    assert result.status_code == 200
    assert result.json()['rows'][0]['before'] == 4
    assert store.get_task(tid)['quadrant'] == 1
    from wou.eval_priorities import agreement
    assert agreement(store, [{'task_id': tid, 'label': 1}])['matched'] == 0
    store.close()

@pytest.mark.parametrize('method,route', [('patch','/settings'), ('patch','/tasks/1'), ('patch','/groups/chat'), ('post','/tags'), ('post','/tags/suggest'), ('post','/eval-priorities'), ('post','/scan'), ('post','/quiz/1/skip')])
def test_large_content_length_rejected_before_read(api, monkeypatch, method, route):
    from starlette.requests import Request
    mod, client, _ = api
    async def fail(self):
        pytest.fail('oversize body must not be read')
    monkeypatch.setattr(Request, 'body', fail)
    response = getattr(client, method)(route, content=b'{}', headers={'Content-Length': str(mod._MAX_BODY + 1)})
    assert response.status_code == 400


def test_task_priority_undo_preserves_lock_and_does_not_label(api):
    mod, client, _ = api
    store = mod._open_store()
    tid = store.upsert_task('chat', 'Agent', 'Launch', 'Approve launch', 'Release', 4, '1')
    assert client.patch(f'/tasks/{tid}', json={'quadrant': 2}).status_code == 200
    labels = store.priority_labels()
    result = client.patch(f'/tasks/{tid}', json={'quadrant': 4, 'quadrant_locked': False, 'restore': True})
    assert result.status_code == 200
    assert result.json()['task']['quadrant_locked'] is False
    assert store.priority_labels() == labels
    store.close()
