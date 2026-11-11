"""All fixtures/copies are disposable. No live database is opened by these tests."""
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wou.store import Store


def normalized(conn):
    return tuple(tuple(tuple(r) for r in conn.execute(f'SELECT * FROM {table} ORDER BY 1,2'))
                 for table in ('tags', 'task_tags'))


def seed(path, legacy=False):
    store = Store(str(path))
    tid = store.upsert_task('c', 'Any user', 'Chat', 'Keep ask', 'Topic', 2, 'm')
    assert isinstance(tid, int)
    for name in ('Manual', 'Automatic', 'Removed'):
        tag = store.create_tag(name, hint='Retained', color='teal')
        store.apply_auto_tags(tid, [tag['id']]) if name == 'Automatic' else store.update_task_tags(tid, add=[tag['id']])
        if name == 'Removed':
            store.update_task_tags(tid, remove=[tag['id']])
    store._conn.execute("UPDATE tasks SET context='Retained context',due_at=42,manual=1")
    store._conn.commit()
    store.refresh_chat_project('c', {'key': 'work:native_id', 'name': 'Native', 'color': 'blue'})
    if legacy:
        store._conn.execute("DELETE FROM meta WHERE key='hermes_projects_v1'")
        store._conn.execute("INSERT INTO projects(name,source,created_at) VALUES('Old','auto',0)")
        store._conn.execute('UPDATE tasks SET project_id=1, project_locked=1')
        store._conn.commit()
    return store, tid


@pytest.mark.parametrize('legacy', [False, True])
def test_consistent_copy_preserves_normalized_rows_current_schema_and_reopen(tmp_path, legacy):
    source, tid = seed(tmp_path / 'source.db', legacy)
    # Keep the WAL connection open: backup must include these committed rows.
    before = normalized(source._conn)
    copy = tmp_path / 'disposable' / 'wou.db'
    copy.parent.mkdir()
    with sqlite3.connect(copy) as dest:
        source._conn.backup(dest)
    source.close()
    backups = set(copy.parent.glob('*.bak-*'))
    migrated = Store(str(copy))
    assert normalized(migrated._conn) == before
    payload = migrated.get_task(tid)
    assert payload is not None
    assert payload['project']['key'] == 'work:native_id'
    assert (payload['context'], payload['due_at'], payload['manual']) == ('Retained context', 42, True)
    assert {t['name'] for t in payload['tags']} == {'Manual', 'Automatic'}
    assert {r[1] for r in migrated._conn.execute('PRAGMA table_info(tasks)')} >= {
        'actions', 'context', 'due_at', 'urgency', 'importance', 'model_quadrant', 'source_msg_at', 'manual'
    }
    assert migrated._conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    assert migrated._conn.execute('PRAGMA foreign_key_check').fetchall() == []
    if legacy:
        assert migrated._conn.execute('SELECT count(*) FROM projects').fetchone()[0] == 0
        assert tuple(migrated._conn.execute('SELECT project_id,project_locked FROM tasks').fetchone()) == (None, None)
    migrated.close()
    after = set(copy.parent.glob('*.bak-*'))
    assert len(after - backups) == int(legacy)
    for _ in range(3):
        reopened = Store(str(copy))
        assert normalized(reopened._conn) == before
        reopened.apply_auto_tags(tid, [3])
        assert normalized(reopened._conn) == before  # removed stays removed
        reopened.close()
    assert set(copy.parent.glob('*.bak-*')) == after
    if legacy:
        with sqlite3.connect(next(iter(after - backups))) as original:
            assert normalized(original) == before
            assert original.execute('SELECT count(*) FROM projects').fetchone()[0] == 1


def test_failed_backup_retains_existing_removed_flags_and_marker(tmp_path, monkeypatch):
    store, _ = seed(tmp_path / 'source.db', True)
    before = normalized(store._conn)
    store.close()
    real_connect = sqlite3.connect

    class FailingSource(sqlite3.Connection):
        def backup(self, *args, **kwargs):
            raise sqlite3.OperationalError('fixture backup failure')

    def connect(path, *args, **kwargs):
        if str(path).endswith('?mode=ro'):
            kwargs['factory'] = FailingSource
        return real_connect(path, *args, **kwargs)

    monkeypatch.setattr(sqlite3, 'connect', connect)
    with pytest.raises(sqlite3.OperationalError, match='fixture backup failure'):
        Store(str(tmp_path / 'source.db'))
    with real_connect(tmp_path / 'source.db') as conn:
        assert normalized(conn) == before
        assert conn.execute("SELECT 1 FROM meta WHERE key='hermes_projects_v1'").fetchone() is None
        assert conn.execute('SELECT count(*) FROM projects').fetchone()[0] == 1
    assert list(tmp_path.glob('source.db.bak-*'))  # only seed's completed pre-migration backup
    assert len(list(tmp_path.glob('source.db.bak-*'))) == 1
