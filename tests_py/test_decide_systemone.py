"""Offline contract tests: mock urllib, never decision parsing."""
import io
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import json
from unittest.mock import patch


def test_systemone_noul_roundtrip():
    from wou.decide import Noul, SystemOneProvider
    requests = []

    def open_request(opener, request, timeout):
        requests.append((json.loads(request.data), timeout, request.get_header("Authorization")))
        return io.BytesIO(b'{"answers":{"ready":{"type":"noul","noul":0.94}},"usage":{"input_tokens":2,"output_tokens":1}}')

    with patch("urllib.request.OpenerDirector.open", open_request):
        result = SystemOneProvider("https://example.test/decide", "jev-latest", "sentinel").decide(
            {"synthetic": True}, [Noul("ready", "Is it ready?")])
    assert requests == [({"model": "jev-latest", "state": {"synthetic": True}, "questions": {
        "ready": {"type": "noul", "instructions": "Is it ready?"}}}, 20, "Bearer sentinel")]
    assert result.answers["ready"].p_yes == 0.94
    assert result.model == "jev-latest"
    assert result.usage == {"input_tokens": 2, "output_tokens": 1}
    assert result.latency_ms >= 0
