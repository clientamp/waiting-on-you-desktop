"""Preset construction is offline; credentials are injected, never read from env."""
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.mark.parametrize("name,model,key,url", [
    ("jev", "jev-latest", "WOU_TYPESAFE_API_KEY", "https://api.typesafe.ai/v1/systemone"),
    ("clef", "clef", "WOU_CLOUDFLARE_API_TOKEN", "https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/cloudflare/clef"),
    ("clef-flash", "clef-flash", "WOU_CLOUDFLARE_API_TOKEN", "https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/cloudflare/clef-flash"),
    ("perplexity", "pplx-decider-latest", "WOU_PERPLEXITY_API_KEY", "https://api.perplexity.ai/v1/decisions"),
    ("perplexity-flash", "pplx-decider-flash-latest", "WOU_PERPLEXITY_API_KEY", "https://api.perplexity.ai/v1/decisions"),
    ("openai", "gpt-6-luna", "WOU_OPENAI_API_KEY", "https://api.openai.com/v1/decisions"),
])
def test_presets(name, model, key, url):
    from wou.decide.presets import build_provider
    secret = Mock(return_value="SENTINEL_SECRET")
    with patch("urllib.request.OpenerDirector.open") as transport:
        result = build_provider({"decision_provider": name, "cloudflare_account_id": "acct"}, secret)
    assert result.url == url
    assert result.model == model
    secret.assert_called_once_with(key)
    transport.assert_not_called()
    assert "SENTINEL_SECRET" not in repr(result)


@pytest.mark.parametrize("settings", [{}, {"decision_provider": "unknown"}, {"decision_provider": "jev"}, {"decision_provider": "clef"}, {"decision_provider": "ollama"}, {"decision_provider": "custom", "decision_base_url": "https://example.test"}])
def test_not_configured(settings, monkeypatch):
    from wou.decide.presets import build_provider
    monkeypatch.setenv("WOU_TYPESAFE_API_KEY", "MUST_NOT_USE_ENV")
    assert build_provider(settings, lambda key: None) is None


@pytest.mark.parametrize("name,url,expected", [
    ("custom", "https://example.test/full", "https://example.test/full"),
    ("ollama", "http://127.0.0.1:11434", "http://127.0.0.1:11434/v1/systemone"),
])
def test_custom_optional_key(name, url, expected):
    from wou.decide.presets import build_provider
    p = build_provider({"decision_provider": name, "decision_model": "local-model", "decision_base_url": url,
                        "decision_timeout": 7}, lambda key: None)
    assert p.url == expected
    assert p.model == "local-model"
    assert p.timeout == 7
    assert p._api_key is None


def test_hermes_native_absent():
    from wou.decide.hermes_native import build_native_provider
    with patch("importlib.import_module", side_effect=ImportError):
        assert build_native_provider() is None
        assert build_native_provider(SimpleNamespace()) is None


def test_hermes_native_feature_detection_does_not_claim_supported_contract():
    from wou.decide.hermes_native import build_native_provider, native_available
    ctx = SimpleNamespace(decide=lambda *args: None)
    assert native_available(ctx)
    # Future API shape is unknown. Do not send data to it speculatively.
    assert build_native_provider(ctx) is None
