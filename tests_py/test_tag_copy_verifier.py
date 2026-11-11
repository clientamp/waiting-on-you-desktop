"""Exercise the verifier only against fabricated source data."""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_tag_migration_preservation import seed, normalized


def test_copy_verifier_never_opens_source_writable_and_cleans_up(tmp_path, monkeypatch):
    import importlib.util

    spec = importlib.util.spec_from_file_location('check_tag_migration', Path(__file__).resolve().parents[1] / 'scripts' / 'check_tag_migration.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    source = tmp_path / 'source.db'
    store, _ = seed(source, True)
    before = normalized(store._conn)
    store.close()
    disposable = tmp_path / 'scratch'
    disposable.mkdir()
    monkeypatch.setenv('TMPDIR', str(disposable))
    real_connect = sqlite3.connect
    seen = []

    def connect(path, *args, **kwargs):
        seen.append(str(path))
        if source.name in str(path):
            assert str(path) == source.as_uri() + '?mode=ro'
        return real_connect(path, *args, **kwargs)

    monkeypatch.setattr(sqlite3, 'connect', connect)
    assert mod.check_copy(source)['ok'] is True
    assert seen[0] == source.as_uri() + '?mode=ro'
    assert list(disposable.iterdir()) == []
    with real_connect(source) as conn:
        assert normalized(conn) == before
        assert conn.execute('SELECT count(*) FROM projects').fetchone()[0] == 1
        assert conn.execute("SELECT 1 FROM meta WHERE key='hermes_projects_v1'").fetchone() is None
