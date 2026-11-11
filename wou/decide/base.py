"""Provider-neutral decisions and privacy-safe stdlib transport.

Missing or malformed answers are omitted, never inferred or repaired. No request
state, credentials, remote exception text or response body belongs in diagnostics.
"""
from __future__ import annotations

import ipaddress
import json
import math
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class Noul:
    name: str
    instructions: str


@dataclass(frozen=True)
class Choice:
    name: str
    instructions: str
    criteria: dict[str, str]


@dataclass(frozen=True)
class Score:
    name: str
    instructions: str
    levels: dict[str, str]  # insertion order: lowest to highest


Question = Noul | Choice | Score


@dataclass(frozen=True)
class Answer:
    kind: str
    p_yes: float | None = None
    choice: str | None = None
    score: float | None = None
    probabilities: dict[str, float] = field(default_factory=dict)
    confidence: float | None = None


@dataclass(frozen=True)
class DecisionResult:
    answers: dict[str, Answer]
    model: str
    usage: dict[str, int]
    latency_ms: float


class DecisionProvider(Protocol):
    def decide(self, state: str | dict | list, questions: list[Question]) -> DecisionResult: ...


_ERROR_CODES = frozenset({
    "http_400", "http_401", "http_403", "http_404", "http_408", "http_429",
    "http_500", "http_502", "http_503", "http_504", "http_error",
    "timeout", "bad_response", "not_configured", "invalid_request", "unsafe_url",
    "network_error", "redirect",
})


class DecisionError(Exception):
    def __init__(self, code: str):
        self.code = code if code in _ERROR_CODES else "bad_response"
        super().__init__(self.code)


def number(value: Any, low: float, high: float) -> bool:
    return (type(value) in (int, float) and low <= value <= high
            and math.isfinite(value))


def validate_questions(questions: list[Question], max_questions: int = 64) -> None:
    if not isinstance(questions, (list, tuple)) or not 1 <= len(questions) <= max_questions:
        raise DecisionError("invalid_request")
    names = set()
    for q in questions:
        if (not isinstance(q, (Noul, Choice, Score)) or not isinstance(q.name, str)
                or re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", q.name) is None
                or q.name in names or not isinstance(q.instructions, str)):
            raise DecisionError("invalid_request")
        names.add(q.name)
        values = q.criteria if isinstance(q, Choice) else q.levels if isinstance(q, Score) else None
        if isinstance(q, (Choice, Score)):
            if (not isinstance(values, dict) or len(values) < 2
                    or any(not isinstance(k, str) or not k or not isinstance(v, str)
                           for k, v in values.items())):
                raise DecisionError("invalid_request")


def validate_url(url: str) -> None:
    """HTTPS for hostnames; HTTP only for literal local/private/CGNAT IPs."""
    try:
        parsed = urllib.parse.urlsplit(url)
        host = parsed.hostname
        if (not host or parsed.username is not None or parsed.password is not None
                or parsed.fragment or parsed.port == 0):
            raise ValueError
        if parsed.scheme == "https":
            return
        if parsed.scheme != "http":
            raise ValueError
        if host.lower() == "localhost":
            return

        def allowed(address):
            addr = ipaddress.ip_address(address)
            return (addr.is_loopback or addr.is_private or addr.is_link_local
                    or (addr.version == 4 and addr in ipaddress.ip_network("100.64.0.0/10")))

        try:
            if allowed(host):
                return
        except ValueError:
            pass  # Never resolve a hostname then trust a later DNS lookup.
    except (ValueError, TypeError, OSError):
        pass
    raise DecisionError("unsafe_url") from None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class JsonProvider:
    def __init__(self, url: str, model: str, api_key: str | None = None, timeout: float = 20):
        validate_url(url)
        if not isinstance(model, str) or not model:
            raise DecisionError("not_configured")
        if not number(timeout, 0.001, 300):
            raise DecisionError("invalid_request")
        self.url = url
        self.model = model
        self._api_key = api_key
        self.timeout = timeout

    def _post(self, payload: dict) -> dict:
        try:
            data = json.dumps(payload, allow_nan=False).encode("utf-8")
            headers = {"Content-Type": "application/json", "Accept": "application/json"}
            if self._api_key:
                headers["Authorization"] = "Bearer " + self._api_key
            request = urllib.request.Request(self.url, data=data, headers=headers, method="POST")
        except (TypeError, ValueError):
            raise DecisionError("invalid_request") from None
        opener = urllib.request.build_opener(NoRedirect())
        for attempt in range(2):
            code = None
            try:
                with opener.open(request, timeout=self.timeout) as response:
                    raw = response.read(4 * 1024 * 1024 + 1)
                if len(raw) > 4 * 1024 * 1024:
                    raise DecisionError("bad_response")
                result = json.loads(raw)
                if not isinstance(result, dict):
                    raise DecisionError("bad_response")
                return result
            except urllib.error.HTTPError as exc:
                status = exc.code
                exc.close()
                if attempt == 0 and (status == 429 or 500 <= status <= 599):
                    time.sleep(0.1)
                    continue
                code = "redirect" if 300 <= status <= 399 else f"http_{status}"
                if code not in _ERROR_CODES:
                    code = "http_error"
            except (TimeoutError, socket.timeout):
                code = "timeout"
            except urllib.error.URLError as exc:
                code = "timeout" if isinstance(exc.reason, TimeoutError) else "network_error"
            except (ValueError, UnicodeError, RecursionError):
                code = "bad_response"
            except OSError:
                code = "network_error"
            # Raise outside the handler: remote exceptions cannot leak via chaining.
            raise DecisionError(code) from None
        raise DecisionError("bad_response")


def usage_from(data: dict) -> dict[str, int]:
    raw = data.get("usage")
    if not isinstance(raw, dict):
        return {}
    return {k: v for k, v in raw.items()
            if k in {"input_tokens", "output_tokens", "total_tokens", "prompt_tokens", "completion_tokens"}
            and type(v) is int and v >= 0}


def parse_answer(q: Question, raw: Any, *, openai: bool = False) -> Answer | None:
    if not isinstance(raw, dict) or raw.get("refusal"):
        return None
    kind = raw.get("type")
    if isinstance(q, Noul):
        if kind != ("predicate" if openai else "noul"):
            return None
        value = raw.get("probability" if openai else "noul")
        return Answer("noul", p_yes=value) if number(value, 0, 1) else None
    if kind != ("choice" if isinstance(q, Choice) else "score"):
        return None
    confidence = raw.get("confidence")
    if "confidence" in raw and not number(confidence, 0, 1):
        return None
    probabilities = raw.get("probabilities", [] if openai else {})
    if openai:
        if not isinstance(probabilities, list):
            return None
        converted = {}
        for item in probabilities:
            if not isinstance(item, dict):
                return None
            key = item.get("value" if isinstance(q, Choice) else "label")
            if not isinstance(key, str) or key in converted:
                return None
            converted[key] = item.get("probability")
        probabilities = converted
    if not isinstance(probabilities, dict):
        return None
    allowed = set(q.criteria) if isinstance(q, Choice) else {str(i) for i in range(len(q.levels))} | set(q.levels)
    if any(not isinstance(k, str) or k not in allowed or not number(v, 0, 1)
           for k, v in probabilities.items()):
        return None
    if isinstance(q, Choice):
        choice = raw.get("choice")
        if not isinstance(choice, str) or choice not in q.criteria:
            return None
        return Answer("choice", choice=choice, probabilities=probabilities, confidence=confidence)
    score = raw.get("score")
    if not number(score, 0, len(q.levels) - 1):
        return None
    if openai:
        indices = {label: str(i) for i, label in enumerate(q.levels)}
        probabilities = {indices.get(k, k): v for k, v in probabilities.items()}
    return Answer("score", score=score, probabilities=probabilities, confidence=confidence)


def test_connection(provider: DecisionProvider | None) -> dict[str, Any]:
    """Explicit opt-in probe for a future Test button; sends synthetic data only."""
    started = time.monotonic()
    code = "not_configured"
    if provider is not None:
        try:
            result = provider.decide("Synthetic connection test: ready.", [Noul("ready", "Is the state ready?")])
            code = "ok" if "ready" in result.answers else "bad_response"
        except DecisionError as exc:
            code = exc.code
    return {"ok": code == "ok", "code": code, "latency_ms": (time.monotonic() - started) * 1000}
