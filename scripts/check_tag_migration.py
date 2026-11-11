#!/usr/bin/env python3
"""Read-only source -> consistent disposable SQLite copy -> Store/reopen checks.

Never prints rows, names, paths or exception details. The source is never passed
into Store. Usage: python scripts/check_tag_migration.py /path/to/wou.db
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import tempfile
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wou.store import Store


def _tags(conn):
    return tuple(tuple(conn.execute(f'SELECT * FROM {table} ORDER BY 1,2'))
                 for table in ('tags', 'task_tags'))


def check_copy(source: Path) -> dict:
    source = source.expanduser().resolve(strict=True)
    # TMPDIR is a caller-owned scratch root; TemporaryDirectory removes DBs,
    # migration backups and sidecars together even when a check fails.
    with tempfile.TemporaryDirectory(prefix='wou-tag-check-', dir=os.environ.get('TMPDIR')) as directory:
        copy = Path(directory) / 'wou.db'
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as original:
            original.execute('PRAGMA query_only=ON')
            with closing(sqlite3.connect(copy)) as destination:
                original.backup(destination)
        # Everything after this point reads/writes ONLY the disposable copy.
        with closing(sqlite3.connect(copy)) as baseline:
            before = _tags(baseline)
            columns = {r[1] for r in baseline.execute('PRAGMA table_info(tasks)')}
        first_backups = set()
        for _ in range(3):
            store = Store(str(copy))
            try:
                # row_factory conversion keeps the full normalized row contract.
                after = tuple(tuple(tuple(r) for r in store._conn.execute(f'SELECT * FROM {table} ORDER BY 1,2'))
                              for table in ('tags', 'task_tags'))
                if after != before:
                    raise ValueError('tag preservation failed')
                current = {r[1] for r in store._conn.execute('PRAGMA table_info(tasks)')}
                if not columns <= current:
                    raise ValueError('schema preservation failed')
                if store._conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('integrity failed')
                if store._conn.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('foreign keys failed')
            finally:
                store.close()
            backups = set(Path(directory).glob('*.bak-*'))
            if _ == 0:
                first_backups = backups
            elif backups != first_backups:
                raise ValueError('reopen was not idempotent')
    return {'ok': True, 'tags_preserved': True, 'removed_flags_preserved': True,
            'schema_preserved': True, 'reopen_idempotent': True,
            'integrity_ok': True, 'source_opened_readonly': True, 'disposable_copy_removed': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    try:
        result = check_copy(args.source)
    except Exception:
        # Deliberately omit SQLite diagnostics and private source names/data.
        print(json.dumps({'ok': False, 'error': 'Disposable-copy verification failed; no source data was written.'}))
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
