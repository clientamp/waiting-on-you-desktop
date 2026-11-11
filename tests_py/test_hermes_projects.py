import sqlite3
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def projects_db(tmp_path):
    path = tmp_path / "projects.db"
    with sqlite3.connect(path) as c:
        c.executescript(
            "CREATE TABLE projects(id TEXT PRIMARY KEY, slug TEXT, name TEXT, color TEXT, archived INT); CREATE TABLE project_folders(project_id TEXT,path TEXT);"
        )
        c.executemany(
            "INSERT INTO projects VALUES(?,?,?,?,?)",
            [
                ("a", "alpha", "Alpha", "blue", 0),
                ("b", "beta", "Beta", "red", 0),
                ("c", "old", "Old", "gray", 1),
            ],
        )
        c.executemany(
            "INSERT INTO project_folders VALUES(?,?)",
            [
                ("a", str(tmp_path)),
                ("b", str(tmp_path / "nested")),
                ("c", str(tmp_path / "old")),
            ],
        )
    return path


def test_project_mapping(tmp_path):
    from wou.hermes_projects import project_for_cwd, list_projects

    db = projects_db(tmp_path)
    assert project_for_cwd(db, str(tmp_path), "default")["key"] == "default:a"
    assert (
        project_for_cwd(db, str(tmp_path / "nested" / "child") + "/", "work")["key"]
        == "work:b"
    )
    assert project_for_cwd(db, str(tmp_path / "old"), "default")["key"] == "default:a"
    assert project_for_cwd(db, "", "default") is None
    assert project_for_cwd(db, str(tmp_path) + "-other", "default") is None
    (tmp_path / "nested").mkdir()
    (tmp_path / "link").symlink_to(tmp_path / "nested")
    assert project_for_cwd(db, str(tmp_path / "link"), "default")["key"] == "default:b"
    assert len(list_projects(db, "work")) == 2
    assert list_projects(tmp_path / "missing.db") == []


def test_multi_profile_collect(tmp_path):
    from wou.collect import Config, collect_all
    from test_satellite_plugin import _make_state_db
    import time

    for profile, folder in [
        ("default", tmp_path),
        ("work", tmp_path / "profiles" / "work"),
    ]:
        folder.mkdir(parents=True, exist_ok=True)
        _make_state_db(folder / "state.db")
        projects_db(folder)
        with sqlite3.connect(folder / "state.db") as c:
            c.execute("ALTER TABLE sessions ADD COLUMN cwd TEXT")
            c.execute("UPDATE sessions SET cwd=?", (str(folder),))
    cfg = Config.from_dict({}, hermes_home=tmp_path)
    chats, _ = collect_all(cfg, tmp_path / "cache", now=time.time())
    assert {c["project"]["key"] for c in chats} == {"default:a", "work:a"}
    assert {c["profile"] for c in chats} == {"default", "work"}


def test_standalone_ssh_reader_projects(tmp_path):
    from wou.collect import Config, run_remote
    from test_satellite_plugin import _make_state_db
    from unittest.mock import patch
    import subprocess

    state = tmp_path / "state.db"
    _make_state_db(state)
    projects_db(tmp_path)
    with sqlite3.connect(state) as c:
        c.execute("ALTER TABLE sessions ADD COLUMN cwd TEXT")
        c.execute("UPDATE sessions SET cwd=?", (str(tmp_path),))
    run = subprocess.run

    def fake_ssh(command, **kwargs):
        config = command[-1].split("--config-json ", 1)[1]
        import shlex

        return run(
            [
                sys.executable,
                "-",
                "--emit-json",
                "--db",
                str(state),
                "--config-json",
                shlex.split(config)[0],
            ],
            **kwargs,
        )

    import wou.collect as mod

    with patch.object(mod.subprocess, "run", side_effect=fake_ssh):
        chats, note = run_remote(
            {"name": "remote", "ssh_host": "host", "state_db": str(state)},
            Config.from_dict({}, hermes_home=tmp_path),
            tmp_path / "cache",
        )
    assert note is None
    assert chats[0]["project"]["key"] == "remote:a"
    import json

    cache = json.loads((tmp_path / "cache" / "remote.json").read_text())
    assert {p["key"] for p in cache["projects"]} == {"remote:a", "remote:b"}


def test_locked_projects_db(tmp_path):
    from wou.hermes_projects import list_projects

    db = projects_db(tmp_path)
    assert len(list_projects(db)) == 2
    with sqlite3.connect(db) as c:
        c.execute("BEGIN EXCLUSIVE")
        assert list_projects(db) == []


def test_cache_refresh(tmp_path):
    from wou.hermes_projects import list_projects

    db = projects_db(tmp_path)
    assert list_projects(db)[0]["name"] == "Alpha"
    with sqlite3.connect(db) as c:
        c.execute("UPDATE projects SET name='Changed' WHERE id='a'")
    assert any(p["name"] == "Changed" for p in list_projects(db))
