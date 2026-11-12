"""Child-environment regressions. All environment fixtures are synthetic."""
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def test_ssh_child_gets_only_runtime_names_and_agent_socket(tmp_path):
    from wou import collect

    allowed = {"PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TZ", "SSH_AUTH_SOCK"}
    parent = {name: "synthetic" for name in allowed}
    parent.update(WOU_TEST_FAKE_PROVIDER_KEY="synthetic", HERMES_YOLO_MODE="synthetic", WOU_TEST_ALLOWED="synthetic")
    proc = SimpleNamespace(returncode=0, stdout='[]', stderr='')
    with mock.patch.dict(os.environ, parent, clear=True), mock.patch.object(collect.subprocess, "run", return_value=proc) as run:
        rows, note = collect.run_remote(
            {"name": "fixture", "ssh_host": "fixture.invalid", "state_db": "~/state.db"},
            collect.Config(), tmp_path,
        )
    assert rows == [] and note is None
    assert run.call_count == 1
    env = run.call_args.kwargs.get("env")
    assert env is not None, "SSH must use an explicit environment"
    assert set(env) == allowed
    assert env["SSH_AUTH_SOCK"] == "synthetic"
