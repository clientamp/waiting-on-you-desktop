"""Review regressions: temporary databases and synthetic model responses only."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pytest
from wou.store import Store
from wou.classify import classify_chat

ASKS = [f'Approve the Acme website {stage} deployment for the customer launch' for stage in ('staging', 'production')]

@pytest.mark.parametrize('answered', [None, False, True])
def test_classification_uses_frozen_unanswered_one_to_one_targets(tmp_path, answered):
    store = Store(str(tmp_path / 'tasks.db'))
    old = store.upsert_task('chat', 'Agent', 'Launch', ASKS[0], 'Release', 2, '0') if answered is not None else None
    payload = {'asks': [{'ask': ask, 'topic': 'Release', 'quadrant': 2, 'context': 'Approval needed'} for ask in ASKS], 'answered_task_ids': [old] if answered else []}
    chat = {'key': 'chat', 'agent': 'Agent', 'title': 'Launch', 'last_msg_id': '1', 'last_role': 'assistant', 'user_last': '', 'agent_last': 'Approve deployments?'}
    result = classify_chat(store, chat, llm=lambda _: json.dumps(payload))
    tasks = store.open_tasks_for_chat('chat')
    assert {t['ask'] for t in tasks} == set(ASKS)
    assert len(tasks) == 2
    if old and answered:
        assert old not in {t['id'] for t in tasks}
    if answered is False:
        assert result['updated'] == 1 and result['added'] == 1
    store.close()

def test_concurrent_clean_store_init(tmp_path):
    from concurrent.futures import ThreadPoolExecutor

    path = str(tmp_path / "clean.db")

    def open_store(_):
        instance = Store(path)
        instance.close()

    with ThreadPoolExecutor(4) as pool:
        list(pool.map(open_store, range(4)))


def test_concurrent_store_column_migration(tmp_path):
    import threading
    from concurrent.futures import ThreadPoolExecutor
    path = str(tmp_path / 'race.db')
    store = Store(path)
    for name in ('context', 'due_at', 'urgency', 'importance'):
        store._conn.execute(f'ALTER TABLE tasks DROP COLUMN {name}')
    store._conn.commit()
    store.close()
    barrier = threading.Barrier(2)
    class RacingStore(Store):
        def _init_schema(self):
            super()._init_schema()
            barrier.wait(timeout=5)
    def open_store(_):
        instance = RacingStore(path)
        columns = {r[1] for r in instance._conn.execute('PRAGMA table_info(tasks)')}
        instance.close()
        assert {'context', 'due_at', 'urgency', 'importance'} <= columns
    with ThreadPoolExecutor(2) as pool:
        list(pool.map(open_store, range(2)))

@pytest.mark.parametrize('url', ['http://box.local/v1', 'http://internal.example/v1'])
def test_decision_http_hostname_rebinding_rejected(url, monkeypatch):
    import socket
    from wou.decide.base import validate_url, DecisionError
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *a, **kw: [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 80))])
    with pytest.raises(DecisionError):
        validate_url(url)

def test_readonly_sqlite_uri_escapes_filename(tmp_path):
    import sqlite3
    from wou.collect import collect_db, Config
    from test_collect import make_state_db
    path = tmp_path / 'state?#%.db'
    make_state_db(path)
    with sqlite3.connect(path) as conn:
        conn.execute("INSERT INTO sessions(id,source,title,started_at) VALUES('chat','desktop','Launch',100)")
        conn.execute("INSERT INTO messages(id,session_id,role,content,timestamp) VALUES('msg','chat','assistant','Approve?',100)")
    assert len(collect_db(path, Config(), now=101)) == 1

@pytest.mark.parametrize('field,limit', [('profile',64),('cwd',1024)])
def test_chat_metadata_is_bounded(field, limit):
    from wou.chat_rows import _validate_chat_row
    row = dict(id='c', source='desktop', title='T', last_active=1, last_msg_id='m', last_role='assistant', user_last='', agent_last='Ask')
    row[field] = 'x' * (limit + 1)
    with pytest.raises(ValueError):
        _validate_chat_row(row, 0)
