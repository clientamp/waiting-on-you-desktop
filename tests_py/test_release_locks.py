"""Release-scope settings locks and satellite portability."""

from __future__ import annotations

import importlib
import json
import os
import stat
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou.settings import load_settings, save_settings


class SettingsConcurrentSaveTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def test_concurrent_mode_and_auto_tag_both_persist(self):
        start = threading.Barrier(2, timeout=2)

        def save_mode():
            start.wait()
            save_settings(self.data_dir, {"mode": "off"})

        def save_auto_tag():
            start.wait()
            save_settings(self.data_dir, {"auto_tag": True})

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(save_mode)
            f2 = pool.submit(save_auto_tag)
            f1.result(timeout=5)
            f2.result(timeout=5)

        saved = load_settings(self.data_dir)
        self.assertEqual(saved["mode"], "off")
        self.assertTrue(saved["auto_tag"])

    def test_settings_json_mode_0600_and_parseable(self):
        save_settings(self.data_dir, {"mode": "manual", "debounce_seconds": 120})
        path = Path(self.data_dir) / "settings.json"
        mode = path.stat().st_mode & 0o777
        self.assertEqual(mode, stat.S_IRUSR | stat.S_IWUSR)
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(data["mode"], "manual")
        self.assertEqual(data["debounce_seconds"], 120)


class FilelockWindowsBranchTest(unittest.TestCase):
    def test_msvcrt_lock_when_fcntl_missing(self):
        from wou import filelock

        fake = mock.MagicMock()
        fake.LK_NBLCK = 1
        fake.LK_UNLCK = 2
        handle = mock.MagicMock()
        handle.fileno.return_value = 3

        with mock.patch.dict(sys.modules, {"fcntl": None}):
            with mock.patch("builtins.__import__", side_effect=self._import_without_fcntl):
                with mock.patch.dict(sys.modules, {"msvcrt": fake}):
                    mod = importlib.reload(filelock)
                    self.assertTrue(mod.try_exclusive_lock(handle))
                    mod.release_lock(handle)
                    fake.locking.assert_any_call(3, fake.LK_NBLCK, 1)

    def _import_without_fcntl(self, name, *args, **kwargs):
        if name == "fcntl":
            raise ImportError("no fcntl")
        return importlib.__import__(name, *args, **kwargs)


class SatelliteRunnerImportTest(unittest.TestCase):
    def test_runner_import_without_fcntl(self):
        sat_root = Path(__file__).resolve().parents[1] / "satellite"
        if str(sat_root) not in sys.path:
            sys.path.insert(0, str(sat_root))
        with mock.patch.dict(sys.modules, {"fcntl": None}):
            with mock.patch("builtins.__import__", side_effect=self._import_without_fcntl):
                if "wou_satellite.runner" in sys.modules:
                    del sys.modules["wou_satellite.runner"]
                runner = importlib.import_module("wou_satellite.runner")
                self.assertTrue(callable(runner._try_push_lock))

    def _import_without_fcntl(self, name, *args, **kwargs):
        if name == "fcntl":
            raise ImportError("no fcntl")
        return importlib.__import__(name, *args, **kwargs)


class LockSafetyRegressionTest(unittest.TestCase):
    def test_missing_lock_implementations_never_claim_success(self):
        from wou import filelock
        with mock.patch.dict(sys.modules, {'fcntl': None, 'msvcrt': None}):
            self.assertFalse(filelock.try_exclusive_lock(mock.Mock()))
            with self.assertRaises(RuntimeError):
                filelock.exclusive_lock(mock.Mock())

    def test_satellite_windows_fd_locks_the_same_existing_byte(self):
        sat_root = str(Path(__file__).resolve().parents[1] / 'satellite')
        if sat_root not in sys.path:
            sys.path.insert(0, sat_root)
        from wou_satellite import filelock
        calls = []
        def locking(fd, mode, count):
            calls.append(mode)
            self.assertEqual(count, 1)
            self.assertEqual(os.lseek(fd, 0, os.SEEK_CUR), 0)
            self.assertGreaterEqual(os.fstat(fd).st_size, 1)
        fake = mock.Mock(LK_NBLCK=1, LK_UNLCK=2, locking=locking)
        with tempfile.TemporaryFile() as fh, mock.patch.dict(sys.modules, {'fcntl': None, 'msvcrt': fake}):
            self.assertTrue(filelock.try_exclusive_lock_fd(fh.fileno()))
            os.lseek(fh.fileno(), 5, os.SEEK_SET)
            filelock.release_fd_lock(fh.fileno())
        self.assertEqual(calls, [1, 2])


if __name__ == "__main__":
    unittest.main()
