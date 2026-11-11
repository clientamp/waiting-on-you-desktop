import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from wou.store import Store


def test_tags_lifecycle(tmp_path):
    s = Store(str(tmp_path / "wou.db"))
    try:
        tid = s.upsert_task("c", "A", "T", "Do thing", "Topic", 2, "m")
        tag = s.create_tag(" Work ", color="blue", hint="Business")
        assert tag["name"] == "Work"
        s.update_task_tags(tid, add=[tag["id"]])
        assert s.get_task(tid)["tags"][0]["source"] == "manual"
        assert s.list_tags()[0]["open_count"] == 1
        s.apply_auto_tags(tid, [tag["id"]])
        assert s.get_task(tid)["tags"][0]["source"] == "manual"
        s.update_task_tags(tid, remove=[tag["id"]])
        s.apply_auto_tags(tid, [tag["id"]])
        assert s.get_task(tid)["tags"] == []
        s.update_task_tags(tid, add=[tag["id"]])
        assert s.list_tasks(tags=[tag["id"]])[0]["id"] == tid
        other = s.create_tag("Other")
        s.apply_auto_tags(tid, [other["id"]])
        assert any(t["source"] == "auto" for t in s.get_task(tid)["tags"])
        s.update_task_tags(tid, remove=[other["id"]])
        s.apply_auto_tags(tid, [other["id"]])
        assert all(t["id"] != other["id"] for t in s.get_task(tid)["tags"])
        assert s.list_tasks(tags=[tag["id"], other["id"]]) == []
        assert s.update_tag(tag["id"], name="Renamed")["name"] == "Renamed"
        s.delete_tag(tag["id"])
        assert s.get_task(tid)["tags"] == []
        assert (
            s._conn.execute(
                "SELECT count(*) FROM task_tags WHERE tag_id=?", (tag["id"],)
            ).fetchone()[0]
            == 0
        )
    finally:
        s.close()


@pytest.mark.parametrize(
    "fields",
    [
        {"name": ""},
        {"name": "x" * 33},
        {"name": "a\nb"},
        {"name": "ok", "color": "invalid"},
        {"name": "ok", "hint": "x" * 201},
    ],
)
def test_tag_validation(tmp_path, fields):
    s = Store(str(tmp_path / "wou.db"))
    try:
        with pytest.raises(ValueError):
            s.create_tag(**fields)
    finally:
        s.close()


def test_tag_limits_and_duplicates(tmp_path):
    s = Store(str(tmp_path / "wou.db"))
    try:
        s.create_tag("Work")
        with pytest.raises(ValueError):
            s.create_tag("work")
        for i in range(99):
            s.create_tag(str(i))
        with pytest.raises(ValueError):
            s.create_tag("extra")
    finally:
        s.close()


def test_chat_project_snapshot_and_migration(tmp_path):
    db = tmp_path / "wou.db"
    s = Store(str(db))
    tid = s.upsert_task("c", "A", "T", "Ask", "Topic", 2, "m")
    s.refresh_chat_project(
        "c", {"key": "default:p", "name": "Project", "slug": "project", "color": "blue"}
    )
    assert s.get_task(tid)["project"] == {
        "key": "default:p",
        "name": "Project",
        "color": "blue",
    }
    assert s.list_tasks(projects=["default:p"])[0]["id"] == tid
    assert s.list_tasks(projects=["none"]) == []
    s.refresh_chat_project("c", None)
    assert s.get_task(tid)["project"] is None
    s._conn.execute("DELETE FROM meta WHERE key='hermes_projects_v1'")
    s._conn.execute(
        "INSERT INTO projects(name,source,created_at) VALUES('Old','user',0)"
    )
    s._conn.execute("UPDATE tasks SET project_id=1,project_locked=1")
    s._conn.commit()
    s.close()
    before = set(tmp_path.glob("wou.db.bak-pre-hermes-projects-*"))
    s = Store(str(db))
    assert s._conn.execute("SELECT count(*) FROM projects").fetchone()[0] == 0
    assert tuple(
        s._conn.execute("SELECT project_id,project_locked FROM tasks").fetchone()
    ) == (None, None)
    s.close()
    after = set(tmp_path.glob("wou.db.bak-pre-hermes-projects-*"))
    assert len(after - before) == 1
    import sqlite3

    backup = next(iter(after - before))
    with sqlite3.connect(backup.as_uri() + "?mode=ro", uri=True) as original:
        assert original.execute("SELECT name FROM projects").fetchone()[0] == "Old"
        assert original.execute(
            "SELECT project_id,project_locked FROM tasks"
        ).fetchone() == (1, 1)
    s = Store(str(db))
    s.close()
    assert set(tmp_path.glob("wou.db.bak-pre-hermes-projects-*")) == after
