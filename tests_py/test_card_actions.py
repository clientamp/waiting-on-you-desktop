"""External producer compatibility and card-action validation regressions."""
import inspect
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wou.config import match_action_handler, normalized_action_handlers
from wou.store import Store


@pytest.mark.parametrize("actions", [
    [{"id": "send\n", "label": "Send"}],
    [{"id": "send", "label": "Send", "style": []}],
    [{"id": "send", "label": "Send", "kind": []}],
])
def test_upsert_rejects_invalid_actions(tmp_path, actions):
    store = Store(str(tmp_path / "wou.db"))
    try:
        with pytest.raises(ValueError):
            store.upsert_task("mailhist:cc:client@example.com", "Mail", "Mail", "Reply?",
                              "topic", 2, "cc_reminders:123", actions=actions)
        assert store.list_tasks() == []
    finally:
        store.close()


@pytest.mark.parametrize("command", [[], "python3", ["python3"], [123], [""]])
def test_handler_command_must_be_nonempty_absolute_argv(command):
    assert normalized_action_handlers({"action_handlers": {"mailhist:": {"command": command}}}) == {}


def test_handler_longest_prefix_and_timeout_bounds():
    handlers = normalized_action_handlers({"action_handlers": {
        "mailhist:": {"command": ["/usr/bin/python3", "/handler.py"], "timeout_seconds": 0},
        "mailhist:cc:": {"command": ["/usr/bin/python3", "/cc.py"], "timeout_seconds": 999},
    }})
    assert handlers["mailhist:"]["timeout_seconds"] == 1
    assert match_action_handler(handlers, "mailhist:cc:client@example.com") == {
        "command": ["/usr/bin/python3", "/cc.py"], "timeout_seconds": 300, "env": [],
    }


def test_handler_env_defaults_empty_and_keeps_explicit_names():
    handlers = normalized_action_handlers({"action_handlers": {
        "default:": {"command": ["/handler"]},
        "explicit:": {"command": ["/handler"], "env": ["WOU_TEST_ALLOWED"]},
    }})
    assert handlers["default:"]["env"] == []
    assert handlers["explicit:"]["env"] == ["WOU_TEST_ALLOWED"]


@pytest.mark.parametrize("env", [
    None, "PATH", {}, [123], [""], ["lower_case"], ["UPPER-NAME"],
    ["NAME=VALUE"], [" NAME"], ["NAME\n"], ["1NAME"], ["Á_NAME"],
    ["A" * 129], ["VALID", "not_valid"], [f"NAME_{i}" for i in range(33)],
])
def test_handler_rejects_invalid_env_names_or_bounds(env):
    assert normalized_action_handlers({"action_handlers": {
        "handler:": {"command": ["/handler"], "env": env},
    }}) == {}


def test_handler_env_accepts_count_and_length_boundaries():
    names = ["A" * 128, "_NAME"] + [f"NAME_{i}" for i in range(30)]
    handler = normalized_action_handlers({"action_handlers": {
        "handler:": {"command": ["/handler"], "env": names},
    }})["handler:"]
    assert handler["env"] == names


def test_external_producer_signature_and_actions(tmp_path):
    assert "actions" in inspect.signature(Store.upsert_task).parameters
    store = Store(str(tmp_path / "wou.db"))
    try:
        tid = store.upsert_task("mailhist:cc:client@example.com", "Mailer", "Mail", "Send reminder?",
                                "Mail", 1, "cc_reminders:123", actions=[
                                    {"id": "send", "label": "Send reminder", "style": "primary", "confirm": "Email reminder?"},
                                    {"id": "skip", "label": "Skip", "style": "default"},
                                    {"id": "details", "label": "View email & draft", "kind": "details"},
                                ])
        task = store.get_task(tid)
        assert task["source_msg_id"] == "cc_reminders:123"
        assert [a["kind"] for a in task["actions"]] == ["run", "run", "details"]
    finally:
        store.close()
