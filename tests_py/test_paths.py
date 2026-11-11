"""Hub data dir when Desktop scopes the API to a secondary profile."""

import os
import unittest
from pathlib import Path
from unittest import mock

from wou import paths


class HubHomeTests(unittest.TestCase):
    def test_secondary_profile_uses_default_home(self):
        default = Path.home() / ".hermes"
        scout = default / "profiles" / "scout"
        with mock.patch.object(paths, "_is_hub_install", return_value=True), mock.patch.object(
            paths, "_default_hermes_home", return_value=default
        ), mock.patch.dict(os.environ, {"HERMES_HOME": str(scout)}, clear=False):
            self.assertEqual(paths.hub_hermes_home(), default)

    def test_hub_process_is_not_redirected(self):
        default = Path.home() / ".hermes"
        with mock.patch.object(paths, "_is_hub_install", return_value=True), mock.patch.object(
            paths, "_default_hermes_home", return_value=default
        ), mock.patch.dict(os.environ, {"HERMES_HOME": str(default)}, clear=False):
            self.assertIsNone(paths.hub_hermes_home())

    def test_profile_local_copy_is_not_redirected(self):
        default = Path.home() / ".hermes"
        scout = default / "profiles" / "scout"
        with mock.patch.object(paths, "_is_hub_install", return_value=False), mock.patch.dict(
            os.environ, {"HERMES_HOME": str(scout)}, clear=False
        ):
            self.assertIsNone(paths.hub_hermes_home())

    def test_plugin_data_directory_follows_hub(self):
        default = Path.home() / ".hermes"
        scout = default / "profiles" / "scout"
        env = {"HERMES_HOME": str(scout)}
        with mock.patch.object(paths, "_is_hub_install", return_value=True), mock.patch.object(
            paths, "_default_hermes_home", return_value=default
        ), mock.patch.dict(os.environ, env, clear=False):
            os.environ.pop("WOU_DATA_DIR", None)
            self.assertEqual(
                paths.plugin_data_directory(),
                default / "plugin-data" / "waiting-on-you",
            )


if __name__ == "__main__":
    unittest.main()
