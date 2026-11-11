import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import json
from wou.settings import load_settings, save_settings


def test_group_by_migration(tmp_path):
    (tmp_path / "settings.json").write_text(
        json.dumps({"show_priorities": False, "auto_projects": True})
    )
    s = load_settings(tmp_path)
    assert s["group_by"] == "none"
    assert s["show_priorities"] is False
    assert "auto_projects" not in s
    assert s["auto_tag"] is False
    s = save_settings(tmp_path, {"group_by": "project", "auto_tag": True})
    assert s["group_by"] == "project"
    assert s["show_priorities"] is True
    assert load_settings(tmp_path)["auto_tag"] is True
