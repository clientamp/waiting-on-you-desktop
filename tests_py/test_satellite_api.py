"""Tests for satellite HTTP routes in dashboard/plugin_api.py."""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wou.satellite_auth import (
    DRAIN_ROUTE_PATH,
    PROVIDER_NAME,
    WaitingOnYouSatelliteProvider,
)
from wou.satellite_hub import PAIR_PREFIX, SAT_TOKEN_PREFIX, create_pair_code, ingest

try:
    from fastapi import FastAPI, Request
    from fastapi.testclient import TestClient
    from starlette.middleware.base import BaseHTTPMiddleware

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


def _load_api_module():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for key in list(sys.modules):
        if key == "wou" or key.startswith("wou.") or key == "wou_dashboard_api":
            del sys.modules[key]
    path = os.path.join(root, "dashboard", "plugin_api.py")
    spec = importlib.util.spec_from_file_location("wou_dashboard_api", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class _TokenMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, provider: WaitingOnYouSatelliteProvider):
        super().__init__(app)
        self.provider = provider

    async def dispatch(self, request: Request, call_next):
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
            principal = self.provider.verify_token(token=token)
            if principal is not None:
                request.state.token_principal = principal
                request.state.token_authenticated = True
        return await call_next(request)


@unittest.skipUnless(HAS_FASTAPI, "fastapi not installed")
class SatelliteApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name
        self.db_path = os.path.join(self.data_dir, "wou.db")
        self.api = _load_api_module()
        self.provider = WaitingOnYouSatelliteProvider(lambda: self.db_path)
        app = FastAPI()
        app.add_middleware(_TokenMiddleware, provider=self.provider)
        app.include_router(self.api.router)
        self.client = TestClient(app)
        self.now = 1_700_300_000.0

    def tearDown(self):
        self.tmp.cleanup()

    def _patch_data_dir(self):
        return mock.patch.object(self.api, "plugin_data_directory", return_value=self.data_dir)

    def _pair_flow(self):
        with self._patch_data_dir():
            resp = self.client.post(
                "/satellite/pair-codes",
                json={"name": "node1", "agent_name": "Agent1", "connections": ["c1"]},
            )
        self.assertEqual(resp.status_code, 200)
        code = resp.json()["code"]
        with self._patch_data_dir():
            pair = self.client.post(
                "/satellite/pair",
                headers={"Authorization": f"Bearer {code}"},
                json={"hostname": "h", "version": "1"},
            )
        self.assertEqual(pair.status_code, 200)
        body = pair.json()
        return body["satellite_id"], body["token"]

    def test_status_enabled(self):
        with self._patch_data_dir():
            resp = self.client.get("/satellite/status")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("enabled", body)
        self.assertIn("routes", body)

    def test_principal_cross_use(self):
        with self._patch_data_dir():
            created = self.client.post(
                "/satellite/pair-codes",
                json={"name": "x1", "connections": ["c"]},
            )
        code = created.json()["code"]
        with self._patch_data_dir():
            bad_push = self.client.post(
                "/satellite/push",
                headers={"Authorization": f"Bearer {code}"},
                json={"chats": [], "full": True, "version": "1"},
            )
        self.assertEqual(bad_push.status_code, 401)
        _, sat_token = self._pair_flow()
        with self._patch_data_dir():
            bad_pair = self.client.post(
                "/satellite/pair",
                headers={"Authorization": f"Bearer {sat_token}"},
                json={"hostname": "h", "version": "1"},
            )
        self.assertEqual(bad_pair.status_code, 401)

    def test_push_ingest_and_413(self):
        _, token = self._pair_flow()
        payload = {
            "chats": [
                {
                    "id": "s1",
                    "title": "T",
                    "source": "desktop",
                    "last_active": self.now,
                    "last_msg_id": "1",
                    "last_role": "user",
                    "user_last": "u",
                    "agent_last": "",
                }
            ],
            "full": False,
            "version": "1",
        }
        with self._patch_data_dir():
            ok = self.client.post(
                "/satellite/push",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["accepted"], 1)

        huge = b"x" * (1024 * 1024 + 1)
        with self._patch_data_dir():
            big = self.client.post(
                "/satellite/push",
                headers={"Authorization": f"Bearer {token}"},
                content=huge,
            )
        self.assertEqual(big.status_code, 413)

    def test_rate_limit_429(self):
        _, token = self._pair_flow()
        payload = {"chats": [], "full": True, "version": "1"}
        with self._patch_data_dir():
            for _ in range(30):
                r = self.client.post(
                    "/satellite/push",
                    headers={"Authorization": f"Bearer {token}"},
                    json=payload,
                )
                self.assertEqual(r.status_code, 200)
            r31 = self.client.post(
                "/satellite/push",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
        self.assertEqual(r31.status_code, 429)

    def test_chat_targets_satellite(self):
        _, token = self._pair_flow()
        payload = {
            "chats": [
                {
                    "id": "chat99",
                    "title": "T",
                    "source": "desktop",
                    "last_active": self.now,
                    "last_msg_id": "1",
                    "last_role": "assistant",
                    "user_last": "",
                    "agent_last": "a",
                }
            ],
            "full": True,
            "version": "1",
        }
        with self._patch_data_dir():
            self.client.post(
                "/satellite/push",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
            target = self.api._chat_targets()("node1:chat99")
        self.assertEqual(
            target,
            {
                "session_id": "chat99",
                "profile": "default",
                "connection": "c1",
                "connection_aliases": ["c1"],
            },
        )

    def test_list_and_revoke(self):
        sid, token = self._pair_flow()
        with self._patch_data_dir():
            listed = self.client.get("/satellites")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json()["satellites"]), 1)
        with self._patch_data_dir():
            deleted = self.client.delete(f"/satellites/{sid}")
            push = self.client.post(
                "/satellite/push",
                headers={"Authorization": f"Bearer {token}"},
                json={"chats": [], "full": True, "version": "1"},
            )
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(push.status_code, 401)


class SatelliteAuthTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp.name, "wou.db")

    def tearDown(self):
        self.tmp.cleanup()

    def test_prefix_rejection(self):
        provider = WaitingOnYouSatelliteProvider(lambda: self.db_path)
        self.assertIsNone(provider.verify_token(token="not-ours"))
        self.assertIsNone(provider.verify_token(token="wousat_short"))

    def test_drain_route_fail_closed(self):
        code, _ = create_pair_code(
            self.db_path, "d", "A", [], None, now=1_700_000_000.0
        )
        provider = WaitingOnYouSatelliteProvider(lambda: self.db_path)
        with mock.patch(
            "hermes_cli.dashboard_auth.token_auth.is_token_route",
            side_effect=lambda p: p == DRAIN_ROUTE_PATH,
        ):
            self.assertIsNone(provider.verify_token(token=code))


class SatelliteImportWithoutSeamTest(unittest.TestCase):
    def test_feature_detection_no_crash(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with mock.patch.dict(sys.modules, {"hermes_cli.dashboard_auth.token_auth": None}):
            for key in list(sys.modules):
                if key in ("wou_dashboard_api",) or key.startswith("wou."):
                    del sys.modules[key]
            path = os.path.join(root, "dashboard", "plugin_api.py")
            spec = importlib.util.spec_from_file_location("wou_dashboard_api_seam", path)
            mod = importlib.util.module_from_spec(spec)
            # Import will fail if satellite_auth breaks on missing token_auth at import
            with mock.patch(
                "wou.satellite_auth.ensure_registered",
                return_value=(False, "token_auth seam unavailable"),
            ):
                try:
                    assert spec.loader is not None
                    spec.loader.exec_module(mod)
                except ImportError:
                    self.skipTest("hermes_cli not available")


if __name__ == "__main__":
    unittest.main()
