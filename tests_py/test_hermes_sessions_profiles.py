from pathlib import Path
from types import SimpleNamespace
from unittest import mock
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from wou import hermes_sessions, paths


def test_archive_and_unarchive_target_owning_profile_state_db(tmp_path):
    root = Path(tmp_path)
    calls = []
    for name in ("work", "personal"):
        home = root / "profiles" / name
        home.mkdir(parents=True)
        (home / "state.db").touch()


    class FakeSessionDB:
        def __init__(self, db_path):
            self.path = db_path

        def close(self):
            pass

        def set_session_archived(self, session_id, archived):
            calls.append((self.path, session_id, archived))
            return True

    with (
        mock.patch.dict('os.environ', {'HERMES_HOME': str(root), 'WOU_DATA_DIR': str(root / 'data')}),
        mock.patch.object(paths, "_active_hermes_home", return_value=root / "profiles" / "work"),
        mock.patch.object(paths, "_default_hermes_home", return_value=root),
        mock.patch.object(paths, "_is_hub_install", return_value=True),
        mock.patch.dict("sys.modules", {"hermes_state": SimpleNamespace(SessionDB=FakeSessionDB)}),
    ):
        assert hermes_sessions.archive_chat("work:one")
        assert hermes_sessions.archive_chat("personal:two")
        assert hermes_sessions.unarchive_chat("work:one")
    assert calls == [
        (root / "profiles" / "work" / "state.db", "one", True),
        (root / "profiles" / "personal" / "state.db", "two", True),
        (root / "profiles" / "work" / "state.db", "one", False),
    ]
