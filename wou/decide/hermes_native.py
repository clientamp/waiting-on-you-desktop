"""Reserved native adapter for Hermes issues #146768 and #113008.

A real native decision contract is unavailable and untestable today. Detection
is lazy and does not import private Hermes modules at package import time. Even
if a future capability is found, do not guess its wire/result contract: keep the
factory disabled until it can be tested against a released public API.
"""
from __future__ import annotations

from typing import Any
from .base import DecisionProvider


def native_available(ctx: Any = None) -> bool:
    # Only probe the supplied public context. Never import an unreleased core API.
    return callable(getattr(ctx, "decide", None))


def build_native_provider(ctx: Any = None) -> DecisionProvider | None:
    native_available(ctx)
    return None
