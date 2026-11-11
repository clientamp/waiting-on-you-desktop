"""Additional edge cases and real urllib redirect-chain regression."""
import io
import json
import sys
import urllib.request
import urllib.response
from email.message import Message
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wou.decide import Choice, DecisionError, Noul, Score, SystemOneProvider
from wou.decide.openai_decisions import OpenAIDecisionsProvider
from wou.decide.base import test_connection as probe


@pytest.mark.parametrize("cls", [SystemOneProvider, OpenAIDecisionsProvider])
def test_real_urllib_redirect_chain_blocked(cls):
    headers = Message()
    headers["Location"] = "https://evil.test/steal"
    response = urllib.response.addinfourl(io.BytesIO(b"SENTINEL_SECRET"), headers, "https://example.test", 302)
    response.msg = "Found"
    with patch("urllib.request.HTTPSHandler.https_open", return_value=response) as transport:
        with pytest.raises(DecisionError, match="^redirect$"):
            cls("https://example.test", "model", "SENTINEL_SECRET").decide("synthetic", [Noul("x", "Ready?")])
    assert transport.call_count == 1


@pytest.mark.parametrize("cls", [SystemOneProvider, OpenAIDecisionsProvider])
def test_giant_integer_is_missing_not_overflow(cls):
    value = 10 ** 500
    raw = {"type": "noul", "noul": value} if cls == SystemOneProvider else {"type": "predicate", "name": "x", "probability": value}
    body = {"answers": {"x": raw} if cls == SystemOneProvider else [raw]}
    with patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(json.dumps(body).encode())):
        assert cls("https://example.test", "model").decide("synthetic", [Noul("x", "x")]).answers == {}


@pytest.mark.parametrize("raw", [
    {"type": "choice", "choice": "yes", "confidence": None},
    {"type": "choice", "choice": "yes", "probabilities": None},
    {"type": "choice", "choice": "yes", "probabilities": {"yes": True}},
    {"type": "choice", "choice": "yes", "probabilities": {"no": "0.9"}},
])
def test_explicit_bad_optional_metadata_missing(raw):
    with patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(json.dumps({"answers": {"x": raw}}).encode())):
        assert SystemOneProvider("https://example.test", "model").decide("synthetic", [Choice("x", "x", {"yes": "yes", "no": "no"})]).answers == {}


@pytest.mark.parametrize("raw", [b"not json SENTINEL_SECRET", b'"SENTINEL_SECRET"', b"\xff"])
def test_invalid_json_redacted(raw, caplog):
    with patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(raw)):
        with pytest.raises(DecisionError) as caught:
            SystemOneProvider("https://example.test", "model", "SENTINEL_SECRET").decide("synthetic", [Noul("x", "x")])
    assert str(caught.value) == "bad_response"
    assert "SENTINEL_SECRET" not in caplog.text


def test_duplicate_openai_answers_missing():
    raw = {"type": "predicate", "name": "x", "probability": .9}
    with patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(json.dumps({"answers": [raw, raw]}).encode())):
        assert OpenAIDecisionsProvider("https://example.test", "model").decide("synthetic", [Noul("x", "x")]).answers == {}


def test_connection_bad_and_error():
    with patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(b'{"answers":{}}')):
        assert probe(SystemOneProvider("https://example.test", "model"))["code"] == "bad_response"
    with patch("urllib.request.OpenerDirector.open", side_effect=TimeoutError("SENTINEL_SECRET")):
        result = probe(SystemOneProvider("https://example.test", "model"))
    assert result["code"] == "timeout"
    assert result["latency_ms"] >= 0


def test_openai_levels_bound_before_transport():
    q = Score("x", "x", {str(i): str(i) for i in range(11)})
    with patch("urllib.request.OpenerDirector.open") as transport, pytest.raises(DecisionError, match="invalid_request"):
        OpenAIDecisionsProvider("https://example.test", "model").decide("synthetic", [q])
    transport.assert_not_called()


@pytest.mark.parametrize("timeout", [True, "20", 0, float("nan"), float("inf")])
def test_timeout_setting_strict(timeout):
    with pytest.raises(DecisionError, match="invalid_request"):
        SystemOneProvider("https://example.test", "model", timeout=timeout)


def test_numeric_score_distributions_normalize_to_indices():
    question = Score("x", "x", {"low": "lowest", "high": "highest"})
    body = {"answers": [{"type": "score", "name": "x", "score": .9,
                         "probabilities": [{"label": "low", "probability": .1}, {"label": "high", "probability": .9}]}]}
    with patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(json.dumps(body).encode())):
        result = OpenAIDecisionsProvider("https://example.test", "model").decide("synthetic", [question])
    assert result.answers["x"].probabilities == {"0": .1, "1": .9}


@pytest.mark.parametrize("question", [Choice("x", "x", None), Score("x", "x", None)])
def test_invalid_question_containers(question):
    with patch("urllib.request.OpenerDirector.open") as transport, pytest.raises(DecisionError, match="invalid_request"):
        SystemOneProvider("https://example.test", "model").decide("synthetic", [question])
    transport.assert_not_called()


def test_openai_wrong_distribution_container_missing():
    body = {"answers": [{"type": "choice", "name": "x", "choice": "yes", "probabilities": {"yes": .9}}]}
    with patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(json.dumps(body).encode())):
        assert OpenAIDecisionsProvider("https://example.test", "model").decide("synthetic", [Choice("x", "x", {"yes": "yes", "no": "no"})]).answers == {}
