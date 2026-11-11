"""Offline provider factory. Pass Hermes agent.secret_scope.get_secret explicitly.

Settings are the manifest's plugins.entries.waiting-on-you.settings, read and
written through ctx.get_config/ctx.set_config, not the scanner's settings.json. Ollama bases append /v1/systemone; custom URLs are used
verbatim (also suitable for AWS/Upstage-compatible gateways with bearer auth).
"""
from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Callable, Mapping, Any

from .base import DecisionError, DecisionProvider
from .openai_decisions import OpenAIDecisionsProvider
from .systemone import SystemOneProvider


@dataclass(frozen=True)
class Preset:
    url: str
    model: str
    secret: str
    wire: str = "systemone"


PRESETS = {
    "jev": Preset("https://api.typesafe.ai/v1/systemone", "jev-latest", "WOU_TYPESAFE_API_KEY"),
    "clef": Preset("https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/cloudflare/clef", "clef", "WOU_CLOUDFLARE_API_TOKEN"),
    "clef-flash": Preset("https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/cloudflare/clef-flash", "clef-flash", "WOU_CLOUDFLARE_API_TOKEN"),
    "perplexity": Preset("https://api.perplexity.ai/v1/decisions", "pplx-decider-latest", "WOU_PERPLEXITY_API_KEY"),
    "perplexity-flash": Preset("https://api.perplexity.ai/v1/decisions", "pplx-decider-flash-latest", "WOU_PERPLEXITY_API_KEY"),
    "openai": Preset("https://api.openai.com/v1/decisions", "gpt-6-luna", "WOU_OPENAI_API_KEY", "openai"),
}


def build_provider(settings: Mapping[str, Any], get_secret: Callable[[str], str | None]) -> DecisionProvider | None:
    name = settings.get("decision_provider", "")
    if not isinstance(name, str):
        return None
    name = name.strip().lower()
    preset = PRESETS.get(name)
    model = settings.get("decision_model")
    if model is not None and not isinstance(model, str):
        return None
    model = model or (preset.model if preset else "")
    if preset:
        url = preset.url
        if "{account_id}" in url:
            account = settings.get("cloudflare_account_id")
            if not isinstance(account, str) or re.fullmatch(r"[A-Za-z0-9_-]+", account) is None:
                return None
            url = url.format(account_id=account)
        secret_name = preset.secret
    elif name in {"ollama", "custom"}:
        url = settings.get("decision_base_url")
        if not isinstance(url, str) or not url or not model:
            return None
        if name == "ollama":
            url = url.rstrip("/") + "/v1/systemone"
        secret_name = "WOU_DECISION_API_KEY"
    else:
        return None
    key = get_secret(secret_name)
    if not isinstance(key, str) or not key:
        if preset:
            return None
        key = None
    if key and ("\r" in key or "\n" in key):
        raise DecisionError("not_configured")
    cls = OpenAIDecisionsProvider if preset and preset.wire == "openai" else SystemOneProvider
    return cls(url, model, key, timeout=settings.get("decision_timeout", 20))
