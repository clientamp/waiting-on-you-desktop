"""Backup failure must abort before any destructive migration write."""

import os
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from wou.scanner import Scanner
from wou.settings import save_settings
from wou.store import Store


def _fail_backup_chmod(monkeypatch) -> None:
    real_chmod = os.chmod

    def chmod(path, mode):
        if ".bak-pre-hermes-projects-" in str(path):
            raise OSError("fixture disk full")
        return real_chmod(path, mode)

    monkeypatch.setattr(os, "chmod", chmod)


def _seed_legacy(db: Path) -> None:
    store = Store(str(db))
    task_id = store.upsert_task("chat-s", "Desktop", "Chat", "Keep this ask", "Topic", 2, "m1")
    assert isinstance(task_id, int)
    tag = store.create_tag("Kept", color="blue")
    store.update_task_tags(task_id, add=[tag["id"]])
    store._conn.execute("DELETE FROM meta WHERE key='hermes_projects_v1'")
    store._conn.execute(
        "INSERT INTO projects(name,source,created_at) VALUES('Important legacy topic','auto',0)"
    )
    store._conn.execute("UPDATE tasks SET project_id=1, project_locked=1 WHERE id=?", (task_id,))
    store._conn.commit()
    store.close()


def _live_rows(db: Path) -> tuple:
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as conn:
        project = conn.execute("SELECT name FROM projects").fetchone()
        task = conn.execute("SELECT project_id, project_locked FROM tasks").fetchone()
        tags = conn.execute("SELECT name FROM tags").fetchall()
        links = conn.execute("SELECT removed FROM task_tags").fetchall()
    return project, task, tags, links


def test_backup_failure_leaves_live_rows_and_no_backup_file(tmp_path, monkeypatch):
    db = tmp_path / "wou.db"
    _seed_legacy(db)
    before = _live_rows(db)
    before_files = set(tmp_path.glob("wou.db.bak-pre-hermes-projects-*"))

    _fail_backup_chmod(monkeypatch)
    with pytest.raises(OSError, match="fixture disk full"):
        Store(str(db))

    assert _live_rows(db) == before
    assert set(tmp_path.glob("wou.db.bak-pre-hermes-projects-*")) == before_files


def test_scan_does_not_continue_after_backup_failure(tmp_path, monkeypatch):
    db = tmp_path / "wou.db"
    _seed_legacy(db)
    before = _live_rows(db)
    before_files = set(tmp_path.glob("wou.db.bak-pre-hermes-projects-*"))
    save_settings(tmp_path, {"consented": True})
    calls = []

    def collect_fn(*_args, **_kwargs):
        calls.append("collect")
        return [], []

    _fail_backup_chmod(monkeypatch)
    with pytest.raises(OSError, match="fixture disk full"):
        Scanner(tmp_path, collect_fn=collect_fn).run_once(manual=True, force=True)

    assert calls == []
    assert _live_rows(db) == before
    assert set(tmp_path.glob("wou.db.bak-pre-hermes-projects-*")) == before_files
