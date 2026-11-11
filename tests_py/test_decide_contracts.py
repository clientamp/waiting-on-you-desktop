"""Offline real-adapter contracts and fault injection at urllib's boundary."""
import io
import json
import socket
import sys
import traceback
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wou.decide import Choice, DecisionError, Noul, Score, SystemOneProvider, OpenAIDecisionsProvider
from wou.decide.base import test_connection as probe

QUESTIONS = [Noul("ready", "Ready?"), Choice("mood", "Mood?", {"yes": "positive", "no": "negative"}),
             Score("level", "Level?", {"low": "lowest", "mid": "middle", "high": "highest"})]
SYSTEM = {"answers": {"ready": {"type": "noul", "noul": .94},
                      "mood": {"type": "choice", "choice": "yes", "probabilities": {"yes": .9, "no": .1}, "confidence": .8},
                      "level": {"type": "score", "score": 1.78, "confidence": .78, "probabilities": {"0": .01, "1": .2, "2": .79}}}}
OPENAI = {"answers": [{"type": "predicate", "name": "ready", "probability": .94},
                      {"type": "choice", "name": "mood", "choice": "yes", "probabilities": [{"value": "yes", "probability": .9}, {"value": "no", "probability": .1}], "confidence": .8},
                      {"type": "score", "name": "level", "score": 1.78, "confidence": .78, "probabilities": [{"label": "low", "probability": .01}, {"label": "mid", "probability": .2}, {"label": "high", "probability": .79}]}]}


def provider(kind="system"):
    if kind == "openai":
        return OpenAIDecisionsProvider("https://example.test/decisions", "gpt-6-luna", "SENTINEL_SECRET")
    return SystemOneProvider("https://example.test/decisions", "jev-latest", "SENTINEL_SECRET")


def reply(payload):
    return patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(json.dumps(payload).encode()))


@pytest.mark.parametrize("kind,payload", [("system", SYSTEM), ("openai", OPENAI)])
def test_all_types(kind, payload):
    with reply(payload):
        result = provider(kind).decide("synthetic", QUESTIONS)
    assert result.answers["ready"].p_yes == .94
    assert result.answers["mood"].choice == "yes"
    assert result.answers["mood"].probabilities == {"yes": .9, "no": .1}
    assert result.answers["mood"].confidence == .8
    assert result.answers["level"].score == 1.78
    assert result.answers["level"].confidence == .78


def test_system_exact_shape_and_cloudflare():
    with reply({"success": True, "result": SYSTEM}) as transport:
        result = provider().decide(["synthetic"], QUESTIONS)
    assert set(result.answers) == {"ready", "mood", "level"}
    assert json.loads(transport.call_args.args[0].data) == {
        "model": "jev-latest", "state": ["synthetic"], "questions": {
            "ready": {"type": "noul", "instructions": "Ready?"},
            "mood": {"type": "choice", "instructions": "Mood?", "criteria": {"yes": "positive", "no": "negative"}},
            "level": {"type": "score", "instructions": "Level?", "criteria": ["lowest", "middle", "highest"]}}}


@pytest.mark.parametrize("state", ["synthetic", {"synthetic": True}, ["synthetic"]])
def test_openai_exact_shape(state):
    with reply(OPENAI) as transport:
        provider("openai").decide(state, QUESTIONS)
    assert json.loads(transport.call_args.args[0].data) == {
        "model": "gpt-6-luna", "input": state if isinstance(state, str) else json.dumps(state),
        "questions": [{"type": "predicate", "name": "ready", "instructions": "Ready?"},
                      {"type": "choice", "name": "mood", "instructions": "Mood?", "choices": [{"value": "yes", "description": "positive"}, {"value": "no", "description": "negative"}]},
                      {"type": "score", "name": "level", "instructions": "Level?", "levels": [{"label": "low", "description": "lowest"}, {"label": "mid", "description": "middle"}, {"label": "high", "description": "highest"}]}]}


@pytest.mark.parametrize("kind", ["system", "openai"])
@pytest.mark.parametrize("bad", [True, False, "0.9", None, float("nan"), float("inf"), -.1, 1.1, [], {}])
def test_bad_probabilities_missing(kind, bad):
    raw = {"type": "predicate", "name": "ready", "probability": bad} if kind == "openai" else {"type": "noul", "noul": bad}
    payload = {"answers": [raw] if kind == "openai" else {"ready": raw}}
    with reply(payload):
        assert provider(kind).decide("synthetic", QUESTIONS).answers == {}


@pytest.mark.parametrize("kind", ["system", "openai"])
@pytest.mark.parametrize("name,field,bad", [
    ("mood", "choice", True), ("mood", "choice", "unknown"),
    ("mood", "confidence", "0.9"), ("mood", "confidence", True),
    ("mood", "probabilities", {"yes": float("nan")}),
    ("mood", "probabilities", {"yes": 1.2}),
    ("level", "score", True), ("level", "score", "1.2"),
    ("level", "score", float("inf")), ("level", "score", 3),
    ("level", "confidence", False), ("level", "probabilities", []),
])
def test_bad_choice_score_partial(kind, name, field, bad):
    payload = json.loads(json.dumps(OPENAI if kind == "openai" else SYSTEM))
    raw = next(a for a in payload["answers"] if a["name"] == name) if kind == "openai" else payload["answers"][name]
    raw[field] = bad
    # Empty OpenAI distributions are valid optional metadata, not malformed.
    if kind == "openai" and field == "probabilities" and bad == []:
        raw[field] = [False]
    with reply(payload):
        result = provider(kind).decide("synthetic", QUESTIONS)
    assert name not in result.answers
    assert len(result.answers) == 2


@pytest.mark.parametrize("kind", ["system", "openai"])
def test_refusal_unknown_missing(kind):
    raw = {"name": "ready", "type": "refusal", "refusal": "SENSITIVE"}
    with reply({"answers": [raw] if kind == "openai" else {"ready": raw}}):
        assert provider(kind).decide("synthetic", QUESTIONS).answers == {}


@pytest.mark.parametrize("payload", [[], {}, {"answers": None}, {"result": None}, {"success": False, "result": SYSTEM}])
def test_bad_envelope(payload):
    with reply(payload), pytest.raises(DecisionError, match="^bad_response$"):
        provider().decide("synthetic", QUESTIONS)


@pytest.mark.parametrize("status,count,code", [(401, 1, "http_401"), (429, 2, "http_429"), (500, 2, "http_500"), (302, 1, "redirect"), (418, 1, "http_error")])
def test_http_errors_retry_redacted(status, count, code, caplog):
    def fail(*args, **kwargs):
        raise urllib.error.HTTPError("SENTINEL_SECRET", status, "SENTINEL_SECRET", {}, io.BytesIO(b"SENTINEL_SECRET"))
    with patch("urllib.request.OpenerDirector.open", side_effect=fail) as transport, patch("wou.decide.base.time.sleep") as sleep:
        with pytest.raises(DecisionError) as error:
            provider().decide("PRIVATE_STATE", QUESTIONS)
    assert error.value.code == code
    assert transport.call_count == count
    assert sleep.call_count == count - 1
    assert "SENTINEL_SECRET" not in str(error.value)
    assert "SENTINEL_SECRET" not in "".join(traceback.format_exception(error.value))
    assert "SENTINEL_SECRET" not in caplog.text


@pytest.mark.parametrize("status", [429, 500])
def test_retry_recovers(status):
    with patch("urllib.request.OpenerDirector.open", side_effect=[urllib.error.HTTPError("x", status, "x", {}, None), io.BytesIO(json.dumps(SYSTEM).encode())]) as transport, patch("wou.decide.base.time.sleep"):
        assert len(provider().decide("synthetic", QUESTIONS).answers) == 3
    assert transport.call_count == 2


@pytest.mark.parametrize("error,code", [(socket.timeout("SECRET"), "timeout"), (urllib.error.URLError(socket.timeout("SECRET")), "timeout"), (urllib.error.URLError("SECRET"), "network_error")])
def test_transport_errors(error, code):
    with patch("urllib.request.OpenerDirector.open", side_effect=error), pytest.raises(DecisionError) as caught:
        provider().decide("synthetic", QUESTIONS)
    assert str(caught.value) == code


def test_redirect_handler_never_returns_request():
    from wou.decide.base import NoRedirect
    handler = NoRedirect()
    req = urllib.request.Request("https://example.test", headers={"Authorization": "Bearer SENTINEL_SECRET"})
    assert handler.redirect_request(req, None, 302, "found", {}, "https://evil.test") is None
    opener = urllib.request.build_opener(handler)
    assert [h for h in opener.handlers if isinstance(h, urllib.request.HTTPRedirectHandler)] == [handler]


@pytest.mark.parametrize("host", ["127.0.0.1", "192.168.1.2", "100.64.0.1", "100.127.255.254", "localhost", "[::1]"])
def test_http_local_allowed(host):
    assert SystemOneProvider(f"http://{host}/decide", "local").timeout == 20


@pytest.mark.parametrize("url", ["http://host.local/decide", "http://8.8.8.8/decide", "http://100.128.0.1", "ftp://localhost", "https://key@example.test", "https://example.test/#secret", "not a url"])
def test_unsafe_url_rejected(url):
    with pytest.raises(DecisionError, match="^unsafe_url$"):
        SystemOneProvider(url, "local")


def test_dns_mixed_public_private_rejected():
    with patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("192.168.1.1", 0)), (2, 1, 6, "", ("8.8.8.8", 0))]):
        with pytest.raises(DecisionError, match="unsafe_url"):
            SystemOneProvider("http://mixed.test", "local")


def test_connection_synthetic_only():
    with reply(SYSTEM) as transport:
        assert probe(provider())["ok"] is True
    body = json.loads(transport.call_args.args[0].data)
    assert body["state"].startswith("Synthetic connection test")
    assert len(body["questions"]) == 1
    assert probe(None)["code"] == "not_configured"


@pytest.mark.parametrize("questions", [[], [Noul("bad name", "x")], [Noul("x" * 101, "x")], [Noul("x", "x")] * 2, [Noul(str(i), "x") for i in range(65)]])
def test_invalid_questions_no_transport(questions):
    with patch("urllib.request.OpenerDirector.open") as transport, pytest.raises(DecisionError, match="invalid_request"):
        provider().decide("synthetic", questions)
    transport.assert_not_called()
