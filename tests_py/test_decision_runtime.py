"""Decision integration: no credentials, network, or live Hermes state."""
import json
from types import SimpleNamespace

import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from wou import decision
from wou.decide import Answer, DecisionError, DecisionResult
from wou.settings import load_settings, save_settings


class Context:
    def __init__(self):
        self.values = {}
    def get_config(self, key, default=None):
        return self.values.get(key, default)
    def set_config(self, key, value):
        self.values[key] = value


@pytest.fixture(autouse=True)
def reset_context():
    decision.set_context(None)
    yield
    decision.set_context(None)


def test_configuration_uses_host_and_never_returns_secret(tmp_path, monkeypatch):
    ctx = Context()
    decision.set_context(ctx)
    monkeypatch.setattr(decision, 'get_secret', lambda name: 'never-display-this')
    out = decision.patch(tmp_path, {'provider': 'openai', 'model': 'gpt-6-luna'})
    assert out['provider'] == 'openai' and out['key_set'] is True
    assert out['key_name'] == 'WOU_OPENAI_API_KEY'
    assert 'never-display-this' not in json.dumps(out)
    assert ctx.values['decision_provider'] == 'openai'
    assert not (tmp_path / 'settings.json').exists()
    assert load_settings(tmp_path)['decision_gate'] is True
    assert save_settings(tmp_path, {'decision_priority': False})['decision_priority'] is False


@pytest.mark.parametrize('body', [
    {'provider': 'bad'}, {'model': 'x' * 101}, {'model': 'bad\nmodel'},
    {'base_url': 'https://u:p@example.org'}, {'base_url': 'ftp://localhost'},
    {'cloudflare_account_id': 'abc/def'}, {'cloudflare_account_id': 'a' * 65},
    {'key': 'secret'},
])
def test_configuration_rejects_invalid_values(tmp_path, body):
    decision.set_context(Context())
    with pytest.raises(ValueError):
        decision.patch(tmp_path, body)


from wou.classify import classify_chat, parse_response
from wou.store import Store
from test_classify import _sample_chat


def test_scoring_tags_and_gate_in_classifier(tmp_path):
    store = Store(str(tmp_path / 'wou.db'))
    tag = store.create_tag('Shipping', hint='Product releases')
    save_settings(tmp_path, {'auto_tag': True})
    calls = []
    class Provider:
        def decide(self, state, questions):
            calls.append(questions)
            answers = {q.name: Answer('score', score=3, confidence=0.8) if '.urgency' in q.name else
                       Answer('score', score=3, confidence=0.4) if '.importance' in q.name else
                       Answer('noul', p_yes=0.9) for q in questions}
            return DecisionResult(answers, 'fake', {}, 1)
    runtime = decision.Runtime(tmp_path, provider=Provider(), now=1000)
    raw = json.dumps({'asks': [{'ask': 'Approve release', 'topic': 'Release', 'urgency': 0, 'importance': 1}]})
    out = classify_chat(store, _sample_chat(), llm=lambda m: raw, now=1000, decision_runtime=runtime)
    assert out['added'] == 1
    task = store.list_tasks()[0]
    assert task['urgency'] == 3 and task['importance'] == 1 and task['quadrant'] == 3
    assert [t['id'] for t in task['tags']] == [tag['id']]
    assert len(calls) == 2 and len(calls[1]) == 3
    store.update_task_tags(task['id'], remove=[tag['id']])
    store.set_quadrant(task['id'], 2, locked=True)
    classify_chat(store, _sample_chat(last_msg_id='new'), llm=lambda m: raw, now=1001, decision_runtime=runtime)
    task = store.get_task(task['id'])
    assert task['tags'] == [] and task['quadrant'] == 2
    assert len(calls) == 3  # open tasks bypass gate
    store.close()


@pytest.mark.parametrize('p,expected', [(0.149, True), (0.15, False), (0.9, False)])
def test_classifier_gate_threshold(tmp_path, p, expected):
    class Provider:
        def decide(self, state, questions):
            return DecisionResult({'waiting': Answer('noul', p_yes=p)}, 'fake', {}, 1)
    store = Store(str(tmp_path / 'wou.db'))
    calls = []
    runtime = decision.Runtime(tmp_path, provider=Provider(), now=1000)
    out = classify_chat(store, _sample_chat(), llm=lambda m: calls.append(m) or '{"asks": []}', now=1000, decision_runtime=runtime)
    assert bool(out.get('gated')) == expected
    assert len(calls) == (0 if expected else 1)
    store.close()


def test_scanner_records_gated_summary(tmp_path, monkeypatch):
    import importlib
    scanner_module = importlib.import_module('wou.scanner')
    runtime_module = importlib.import_module('wou.decision')
    settings_module = importlib.import_module('wou.settings')
    # No real home discovery, even while constructing the scanner's config.
    (tmp_path / 'config.json').write_text(json.dumps({'collect': {'hermes_home': str(tmp_path / 'fake-home'), 'local_profiles': [{'name': 'default', 'state_db': str(tmp_path / 'missing.db')}]}}))
    settings_module.save_settings(tmp_path, {'consented': True})
    base = importlib.import_module('wou.decide.base')
    class Provider:
        def decide(self, state, questions):
            return base.DecisionResult({'waiting': base.Answer('noul', p_yes=0.01)}, 'fake', {'input_tokens': 9}, 1)
    monkeypatch.setattr(runtime_module, 'provider', lambda: Provider())
    monkeypatch.setattr(scanner_module.collect, 'profile_display_map', lambda *a, **kw: {})
    scanner = scanner_module.Scanner(tmp_path, llm=lambda m: pytest.fail('gated chat must skip LLM'),
                                     collect_fn=lambda *a: ([_sample_chat(last_active=1000)], []), now_fn=lambda: 1000)
    result = scanner.run_once(manual=True, force_full=True)
    assert result['gated'] == 1 and result['classified'] == 0
    assert scanner_module.read_last_scan(tmp_path)['gated'] == 1
    assert runtime_module.usage_today(tmp_path, 1000)['calls'] == 1


def test_gate_and_usage(tmp_path):
    class Provider:
        def decide(self, state, questions):
            assert len(questions) == 1
            return DecisionResult({'waiting': Answer('noul', p_yes=0.1)}, 'fake', {'input_tokens': 12}, 1)
    runtime = decision.Runtime(tmp_path, provider=Provider(), now=1000)
    assert runtime.gated({'title': 'chat', 'agent_last': 'done'})
    assert decision.status(tmp_path)['usage_today']['calls'] == 0  # another day
    assert decision.usage_today(tmp_path, 1000) == {'calls': 1, 'input_tokens': 12}


from wou.decide.base import _ERROR_CODES


@pytest.mark.parametrize('code', sorted(_ERROR_CODES) + ['raw_timeout'])
@pytest.mark.parametrize('phase', ['gate', 'score'])
def test_decision_failures_never_drop_tasks(tmp_path, code, phase):
    save_settings(tmp_path, {'decision_gate': phase == 'gate', 'auto_tag': True})
    store = Store(str(tmp_path / 'wou.db'))
    store.create_tag('Shipping')
    class Provider:
        def decide(self, state, questions):
            if code == 'raw_timeout':
                raise TimeoutError('private state')
            raise DecisionError(code)
    runtime = decision.Runtime(tmp_path, provider=Provider(), now=1000)
    raw = '{"asks":[{"ask":"Approve release","topic":"Release","urgency":0,"importance":2}]}'
    out = classify_chat(store, _sample_chat(), llm=lambda m: raw, now=1000, decision_runtime=runtime)
    assert out['added'] == 1 and out['error'] is None
    task = store.list_tasks()[0]
    assert task['quadrant'] == 2 and task['urgency'] == 0 and task['tags'] == []
    assert decision.last_error(tmp_path) == ('timeout' if code == 'raw_timeout' else code)
    assert decision.usage_today(tmp_path, 1000)['calls'] == 1
    assert 'private state' not in (tmp_path / 'decision-status.json').read_text()
    store.close()


@pytest.mark.parametrize('fail_second', [False, True])
def test_scoring_batches_at_64_and_rolls_back_all_on_failure(tmp_path, fail_second):
    calls = []
    class Provider:
        def decide(self, state, questions):
            calls.append(questions)
            assert len(questions) <= 64
            assert state['project_name'] == 'A project'
            assert len(state['examples']) == 8
            if fail_second and len(calls) == 2:
                raise DecisionError('timeout')
            return DecisionResult({q.name: Answer('score', score=2.6, confidence=0.5) if '.tag' not in q.name else Answer('noul', p_yes=0.8) for q in questions}, 'fake', {'input_tokens': 20}, 1)
    asks = parse_response(json.dumps({'asks': [{'ask': f'Task {i}', 'topic': 'Work', 'urgency': 0, 'importance': 1} for i in range(10)]}))['asks']
    tags = [{'id': i, 'name': f'Tag {i}', 'hint': ''} for i in range(10)]
    runtime = decision.Runtime(tmp_path, provider=Provider(), now=1000, manual=True)
    scored = runtime.score(asks, {'title': 'Chat', 'project': {'name': 'A project'}}, {'auto_tag': True}, tags, [{}] * 12)
    if fail_second:
        assert scored == asks and len(calls) == 2
    else:
        assert [len(c) for c in calls] == [64, 56]
        assert all(a['quadrant'] == 1 and a['urgency'] == 3 and len(a['_auto_tags']) == 10 for a in scored)
    assert decision.usage.today(tmp_path / 'decision-usage', 1000)['manual_calls'] == 2
    assert all('_auto_tags' not in a for a in asks)


@pytest.mark.parametrize('probability,applied', [(0.799, False), (0.8, True)])
def test_auto_tags_threshold_no_creation(tmp_path, probability, applied):
    save_settings(tmp_path, {'decision_gate': False, 'decision_priority': False, 'auto_tag': True})
    store = Store(str(tmp_path / 'wou.db'))
    tag = store.create_tag('Work')
    class Provider:
        def decide(self, state, questions):
            assert len(questions) == 1
            return DecisionResult({questions[0].name: Answer('noul', p_yes=probability)}, 'fake', {}, 1)
    runtime = decision.Runtime(tmp_path, provider=Provider(), now=1000)
    classify_chat(store, _sample_chat(), llm=lambda m: '{"asks":[{"ask":"Review work","topic":"Work","urgency":0,"importance":1}]}', now=1000, decision_runtime=runtime)
    assert bool(store.list_tasks()[0]['tags']) == applied
    assert len(store.list_tags()) == 1
    store.close()


def test_native_provider_preferred_and_off_stays_off(tmp_path, monkeypatch):
    ctx = Context()
    decision.set_context(ctx)
    native = object()
    monkeypatch.setattr(decision, 'get_secret', lambda name: None)
    monkeypatch.setattr(decision.hermes_native, 'native_available', lambda ctx: True)
    monkeypatch.setattr(decision.hermes_native, 'build_native_provider', lambda ctx: native)
    monkeypatch.setattr(decision, 'build_provider', lambda *a: pytest.fail('external provider should not be built'))
    assert decision.provider() is None
    ctx.values['decision_provider'] = 'jev'
    assert decision.provider() is native
    assert decision.status(tmp_path)['native_available'] is True


def test_open_task_user_reply_always_reaches_llm(tmp_path):
    store = Store(str(tmp_path / 'wou.db'))
    task = store.upsert_task('chat/test', 'Desktop', 'Deploy chat', 'Approve deploy', 'Deploy', 2, 'old', now=999)
    class Provider:
        def decide(self, state, questions):
            pytest.fail('open task must bypass gate')
    runtime = decision.Runtime(tmp_path, provider=Provider(), now=1000)
    out = classify_chat(store, _sample_chat(last_role='user'), llm=lambda m: json.dumps({'asks': [], 'answered_task_ids': [task]}), now=1000, decision_runtime=runtime)
    assert out['resolved'] == 1
    store.close()

