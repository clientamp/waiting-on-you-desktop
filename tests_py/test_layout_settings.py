import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import json

import pytest

from wou.settings import load_settings, save_settings


def test_layout_defaults_to_cards(tmp_path):
    assert load_settings(tmp_path)["layout"] == "cards"


@pytest.mark.parametrize("value", ["cards", "compact", "focus"])
def test_layout_accepts_known_values(tmp_path, value):
    assert save_settings(tmp_path, {"layout": value})["layout"] == value
    assert load_settings(tmp_path)["layout"] == value


@pytest.mark.parametrize("value", ["grid", "", None, 3, ["cards"], "Cards"])
def test_layout_rejects_other_values(tmp_path, value):
    with pytest.raises(ValueError):
        save_settings(tmp_path, {"layout": value})
    assert load_settings(tmp_path)["layout"] == "cards"


def test_bad_stored_layout_falls_back_to_cards(tmp_path):
    (tmp_path / "settings.json").write_text(json.dumps({"layout": "grid", "auto_tag": True}))
    s = load_settings(tmp_path)
    assert s["layout"] == "cards"
    assert s["auto_tag"] is True
