"""Tests for the waiting-on-you-satellite plugin (no network except localhost)."""

from __future__ import annotations

import importlib.util
import json
import os
import sqlite3
import stat
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ROOT = Path(__file__).resolve().parents[1]
SAT_ROOT = ROOT / "satellite"


def _load_satellite_package():
    name = "hermes_plugins_test.waiting_on_you_satellite"
    import types

    if "hermes_plugins_test" not in sys.modules:
        pkg = types.ModuleType("hermes_plugins_test")
        pkg.__path__ = []
        sys.modules["hermes_plugins_test"] = pkg

    init_path = SAT_ROOT / "__init__.py"
    spec = importlib.util.spec_from_file_location(
        name,
        init_path,
        submodule_search_locations=[str(SAT_ROOT)],
    )
    mod = importlib.util.module_from_spec(spec)
    mod.__package__ = name
    sys.modules[name] = mod
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _load_wou_satellite(sub: str):
    root = _load_satellite_package()
    return importlib.import_module(f"{root.__name__}.wou_satellite.{sub}")


def _make_state_db(path: Path, chat_id: str = "c1", msg_id: str = "m1") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(
        """
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY, source TEXT, title TEXT, started_at REAL,
            parent_session_id TEXT, archived INTEGER DEFAULT 0,
            hidden INTEGER DEFAULT 0, last_activity_at REAL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE messages (
            id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT,
            active INTEGER DEFAULT 1
        )
        """
    )
    now = time.time()
    conn.execute(
        "INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)",
        (chat_id, "desktop", "Title", now, None, 0, 0, now),
    )
    conn.execute(
        "INSERT INTO messages VALUES (?,?,?,?,?)",
        (msg_id, chat_id, "user", "hello", 1),
    )
    conn.commit()
    conn.close()


class UrlSafetyTest(unittest.TestCase):
    def setUp(self):
        self.urlsafety = _load_wou_satellite("urlsafety")

    def test_https_ok(self):
        self.assertIsNone(self.urlsafety.check("https://example.com"))

    def test_http_public_refused(self):
        reason = self.urlsafety.check("http://example.com")
        self.assertIn("plain http", reason or "")

    def test_http_localhost_ok(self):
        self.assertIsNone(self.urlsafety.check("http://localhost:8080"))

    def test_http_127_ok(self):
        self.assertIsNone(self.urlsafety.check("http://127.0.0.1:9"))

    def test_http_192_ok(self):
        self.assertIsNone(self.urlsafety.check("http://192.168.1.1"))

    def test_http_10_ok(self):
        self.assertIsNone(self.urlsafety.check("http://10.0.0.5"))

    def test_http_100_64_ok(self):
        self.assertIsNone(self.urlsafety.check("http://100.64.0.1"))

    def test_http_local_hostname_ok(self):
        self.assertIsNotNone(self.urlsafety.check("http://mybox.local"))

    def test_http_hostname_never_resolved(self):
        with mock.patch("socket.getaddrinfo", side_effect=AssertionError("DNS used")):
            self.assertIsNotNone(self.urlsafety.check("http://internal.example"))

    def test_ftp_refused(self):
        reason = self.urlsafety.check("ftp://localhost/x")
        self.assertIsNotNone(reason)


class _HubHandler(BaseHTTPRequestHandler):
    server_version = "TestHub/1.0"
    pair_code = "woupair_testcode"
    sat_token = "wousat_testtoken"
    push_log: list[dict] = []
    pair_status = 200
    push_status = 200
    push_calls = 0

    def log_message(self, *_args, **_kwargs):
        return

    def _read_json(self):
        n = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_POST(self):
        if self.path.endswith("/satellite/pair"):
            auth = self.headers.get("Authorization", "")
            if auth != f"Bearer {self.pair_code}":
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"unauthorized"}')
                return
            self._read_json()
            self.send_response(self.pair_status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            body = {
                "satellite_id": "sid-1",
                "token": self.sat_token,
                "name": "juno",
                "agent_name": "Juno",
            }
            self.wfile.write(json.dumps(body).encode("utf-8"))
            return

        if self.path.endswith("/satellite/push"):
            _HubHandler.push_calls += 1
            auth = self.headers.get("Authorization", "")
            if auth != f"Bearer {self.sat_token}":
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"unauthorized"}')
                return
            payload = self._read_json()
            _HubHandler.push_log.append(payload)
            self.send_response(self.push_status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"accepted":1,"changed":1}')
            return

        self.send_response(404)
        self.end_headers()


class SatelliteHttpTest(unittest.TestCase):
    def setUp(self):
        _HubHandler.push_log = []
        _HubHandler.push_calls = 0
        _HubHandler.pair_status = 200
        _HubHandler.push_status = 200
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.tmp.name)
        self.db_path = self.data_dir / "state.db"
        _make_state_db(self.db_path)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _HubHandler)
        self.port = self.server.server_address[1]
        self.hub_url = f"http://127.0.0.1:{self.port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.env = mock.patch.dict(
            os.environ,
            {
                "WOU_SAT_DATA_DIR": str(self.data_dir),
                "WOU_SAT_STATE_DB": str(self.db_path),
                "HERMES_WOU_SAT_BACKGROUND": "0",
            },
        )
        self.env.start()
        self.sender = _load_wou_satellite("sender")
        self.config = _load_wou_satellite("config")
        self.runner = _load_wou_satellite("runner")
        self.runner.reset_for_tests()

    def tearDown(self):
        self.runner.reset_for_tests()
        self.env.stop()
        self.server.shutdown()
        self.tmp.cleanup()

    def test_reader_identical_to_collect(self):
        collect_path = ROOT / "wou" / "collect.py"
        reader_path = SAT_ROOT / "wou_satellite" / "reader.py"
        self.assertEqual(
            collect_path.read_bytes(),
            reader_path.read_bytes(),
            "run scripts/sync_satellite_reader.py to refresh reader.py",
        )

    def test_pairing_saves_0600_and_pushes(self):
        msg = self.sender.pair(self.hub_url, _HubHandler.pair_code, data_dir=self.data_dir)
        self.assertIn("Paired as juno", msg)
        self.assertIn("Sent 1 chats", msg)
        pairing = self.config.pairing_path(self.data_dir)
        self.assertTrue(pairing.is_file())
        mode = stat.S_IMODE(pairing.stat().st_mode)
        self.assertEqual(mode, 0o600)
        self.assertGreaterEqual(len(_HubHandler.push_log), 1)
        self.assertTrue(_HubHandler.push_log[0].get("full"))

    def test_pairing_401_message(self):
        msg = self.sender.pair(self.hub_url, "woupair_wrong", data_dir=self.data_dir)
        self.assertIn("Make a new one", msg)

    def test_status_never_contains_token(self):
        self.sender.pair(self.hub_url, _HubHandler.pair_code, data_dir=self.data_dir)
        text = self.sender.format_status(data_dir=self.data_dir)
        self.assertNotIn(_HubHandler.sat_token, text)
        self.assertIn("juno", text)

    def test_sent_updated_only_on_200(self):
        self.config.save_pairing(
            self.hub_url,
            "sid",
            _HubHandler.sat_token,
            "n",
            "a",
            time.time(),
            self.data_dir,
        )
        sent = {"last_full_at": time.time(), "retry_backoff": 30}
        self.config.save_sent(sent, self.data_dir)
        _HubHandler.push_status = 429
        self.sender.push_rows(
            self.hub_url,
            _HubHandler.sat_token,
            [{"id": "c1", "title": "t", "source": "desktop", "last_active": 1.0,
              "last_msg_id": "m2", "last_role": "user", "user_last": "u", "agent_last": ""}],
            full=False,
            data_dir=self.data_dir,
        )
        after = self.config.load_sent(self.data_dir)
        self.assertNotIn("c1", after)
        self.assertIn("next_retry_at", after)

    def test_401_marks_revoked(self):
        self.config.save_pairing(
            self.hub_url,
            "sid",
            "wousat_bad",
            "n",
            "a",
            time.time(),
            self.data_dir,
        )
        ok, err = self.sender.push_rows(
            self.hub_url,
            "wousat_bad",
            [{"id": "c1", "title": "t", "source": "desktop", "last_active": 1.0,
              "last_msg_id": "m1", "last_role": "user", "user_last": "u", "agent_last": ""}],
            full=False,
            data_dir=self.data_dir,
        )
        self.assertFalse(ok)
        self.assertEqual(err, self.sender.REVOKED_ERROR)
        sent = self.config.load_sent(self.data_dir)
        self.assertEqual(sent.get("last_error"), self.sender.REVOKED_ERROR)

    def test_chunked_push_no_full_true_over_250(self):
        rows = [
            {
                "id": f"c{i}",
                "title": "t",
                "source": "desktop",
                "last_active": 1.0,
                "last_msg_id": f"m{i}",
                "last_role": "user",
                "user_last": "u",
                "agent_last": "",
            }
            for i in range(251)
        ]
        _HubHandler.push_log = []
        self.sender.push_rows(
            self.hub_url,
            _HubHandler.sat_token,
            rows,
            full=True,
            data_dir=self.data_dir,
        )
        self.assertEqual(len(_HubHandler.push_log), 2)
        self.assertFalse(_HubHandler.push_log[0]["full"])
        self.assertFalse(_HubHandler.push_log[1]["full"])

    def test_full_push_every_6h(self):
        self.config.save_pairing(
            self.hub_url,
            "sid",
            _HubHandler.sat_token,
            "n",
            "a",
            time.time(),
            self.data_dir,
        )
        now = time.time()
        self.config.save_sent(
            {"last_full_at": now - 7 * 3600, "c1": "m1", "retry_backoff": 30},
            self.data_dir,
        )
        _HubHandler.push_log = []
        count, _ = self.sender.run_push(data_dir=self.data_dir, now=now)
        self.assertGreaterEqual(count, 1)
        self.assertTrue(_HubHandler.push_log[0].get("full"))

    def test_change_detection(self):
        rows = [{"id": "a", "last_msg_id": 1, "title": "t", "source": "d",
                 "last_active": 1.0, "last_role": "user", "user_last": "", "agent_last": ""}]
        changes = self.sender.compute_changes(rows, {"a": "0"})
        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0]["last_msg_id"], "1")
        none = self.sender.compute_changes(rows, {"a": "1"})
        self.assertEqual(none, [])

    def test_flock_prevents_concurrent_push(self):
        self.config.save_pairing(
            self.hub_url,
            "sid",
            _HubHandler.sat_token,
            "n",
            "a",
            time.time(),
            self.data_dir,
        )
        fd = self.runner._try_push_lock(self.data_dir)
        self.assertIsNotNone(fd)
        fd2 = self.runner._try_push_lock(self.data_dir)
        self.assertIsNone(fd2)
        self.runner._release_push_lock(fd)

    def test_hook_never_raises_and_no_thread_when_disabled(self):
        mod = _load_satellite_package()
        hooks = {}
        commands = []

        class Ctx:
            def register_hook(self, name, handler):
                hooks[name] = handler

            def register_cli_command(self, *args, **kwargs):
                pass

            def register_command(self, name, handler, **kwargs):
                commands.append(name)

        mod.register(Ctx())
        handler = hooks["post_llm_call"]
        handler(session_id="x")
        handler(session_id="x")
        self.assertIsNone(self.runner._thread)

    def test_start_if_paired_only_when_paired(self):
        with mock.patch.dict(os.environ, {"HERMES_WOU_SAT_BACKGROUND": "1"}):
            self.assertFalse(self.runner.start_if_paired())
            self.assertIsNone(self.runner._thread)
            self.sender.pair(self.hub_url, _HubHandler.pair_code, data_dir=self.data_dir)
            self.assertTrue(self.runner.start_if_paired())
            self.assertTrue(self.runner._thread.is_alive())


class PluginRegisterTest(unittest.TestCase):
    def test_slash_pair_points_to_cli(self):
        mod = _load_satellite_package()
        slash = None

        class Ctx:
            def register_hook(self, *_a, **_k):
                pass

            def register_cli_command(self, *_a, **_k):
                pass

            def register_command(self, _name, handler, **_k):
                nonlocal slash
                slash = handler

        mod.register(Ctx())
        msg = slash("pair https://x https://y")
        self.assertIn("hermes waiting-on-you-satellite pair", msg)


if __name__ == "__main__":
    unittest.main()


class NoRedirectTest(unittest.TestCase):
    """A redirecting hub must never forward the bearer token elsewhere."""

    def test_token_not_sent_after_redirect(self):
        seen: list[str] = []

        class Target(BaseHTTPRequestHandler):
            def do_POST(self):
                seen.append(self.headers.get("Authorization") or "")
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"{}")

            do_GET = do_POST

            def log_message(self, *a):
                pass

        target = ThreadingHTTPServer(("127.0.0.1", 0), Target)
        threading.Thread(target=target.serve_forever, daemon=True).start()
        loc = f"http://127.0.0.1:{target.server_address[1]}/stolen"

        class Redirector(BaseHTTPRequestHandler):
            def do_POST(self):
                self.send_response(302)
                self.send_header("Location", loc)
                self.end_headers()

            def log_message(self, *a):
                pass

        red = ThreadingHTTPServer(("127.0.0.1", 0), Redirector)
        threading.Thread(target=red.serve_forever, daemon=True).start()
        try:
            sender = _load_wou_satellite("sender")
            status, _p, _e = sender._json_request(
                "POST", f"http://127.0.0.1:{red.server_address[1]}/x", "wousat_secret", {"a": 1}
            )
            self.assertEqual(status, 302)
            self.assertEqual(seen, [])
        finally:
            red.shutdown()
            target.shutdown()
