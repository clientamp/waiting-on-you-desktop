import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_satellite_plugin import _load_wou_satellite, _make_state_db
from test_hermes_projects import projects_db
import sqlite3
from unittest.mock import patch


def test_satellite_resolves_project(tmp_path):
    reader = _load_wou_satellite("sender")
    state = tmp_path / "state.db"
    _make_state_db(state)
    projects_db(tmp_path)
    with sqlite3.connect(state) as c:
        c.execute("ALTER TABLE sessions ADD COLUMN cwd TEXT")
        c.execute("UPDATE sessions SET cwd=?", (str(tmp_path / "nested"),))
    with patch.object(reader.cfg, "state_db_path", return_value=state):
        rows = reader._collect_rows()
    assert rows[0]["project"]["name"] == "Beta"
    assert rows[0]["profile"] == "default"
    payload = reader.row_for_hub(rows[0])
    assert payload["project"]["name"] == "Beta"
    assert reader.compute_changes(rows, {"c1": "m1"})
    sent = {}
    reader._merge_sent_chats(sent, [payload])
    assert reader.compute_changes(rows, sent) == []
    rows[0]["project"]["name"] = "Renamed"
    assert reader.compute_changes(rows, sent)


def test_hub_stores_project_catalog_and_old_payload(tmp_path):
    from wou.satellite_hub import (
        create_pair_code,
        redeem_pair_code,
        ingest,
        satellite_projects,
        satellite_chats_for_collect,
    )
    from wou.collect import Config

    home = tmp_path / "hermes"
    home.mkdir()
    db = str(tmp_path / "wou.db")
    code, _ = create_pair_code(
        db, "studio", "Agent", [], None, hermes_home=home, now=100
    )
    sid, *_ = redeem_pair_code(db, code, "host", "1", hermes_home=home, now=100)
    row = dict(
        id="c",
        source="desktop",
        title="T",
        last_active=100,
        last_msg_id="m",
        last_role="assistant",
        user_last="",
        agent_last="Ask",
    )
    project = dict(key="default:p", name="Work", slug="work", color="blue")
    ingest(
        db,
        sid,
        dict(
            chats=[dict(row, project=project)],
            full=True,
            version="1",
            projects=[dict(project, profile="default")],
        ),
        now=100,
    )
    cfg = Config.from_dict({"local_profiles": []}, hermes_home=home)
    assert satellite_projects(db)[0]["key"] == "studio:default:p"
    assert (
        satellite_chats_for_collect(db, cfg, now=100)[0]["project"]["key"]
        == "studio:default:p"
    )
    ingest(db, sid, dict(chats=[row], full=True, version="old"), now=101)
    assert satellite_chats_for_collect(db, cfg, now=101)[0]["project"] is None


def test_hub_project_payload_compatibility():
    from wou.satellite_hub import _validate_chat_row

    row = dict(
        id="c",
        source="desktop",
        title="T",
        last_active=1,
        last_msg_id="m",
        last_role="assistant",
        user_last="",
        agent_last="Ask",
    )
    assert _validate_chat_row(row, 0)["project"] is None
    row["project"] = dict(key="default:p", name="Work", slug="work", color="blue")
    assert _validate_chat_row(row, 0)["project"] == row["project"]
