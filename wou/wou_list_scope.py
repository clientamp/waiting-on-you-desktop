"""Profile scope for the agent-facing wou_list tool (Desktop API unchanged)."""

from __future__ import annotations

from typing import Any

from . import host

# Hermes PluginContext.profile_name (hermes_cli/plugins_context.py ~209) resolves the
# process active profile from HERMES_HOME / get_active_profile_name(), not a model
# argument and not per-chat-user authorization. The API may fall back to "default"
# internally on resolution errors — that is process-profile scoping, not fail-closed
# rejection of every bad context. Until Hermes exposes trustworthy per-invocation
# caller auth, wou_list ignores tool args for profile expansion and returns no tasks
# when host context is entirely unavailable (get_context() is None).


def _chat_profile_key(chat_key: str) -> str:
    """Profile segment of a stored chat_key (see collect._chat_key)."""
    return chat_key.split(":", 1)[0].lower() if ":" in chat_key else "default"


def _normalize_profile_name(text: str) -> str:
    """Match collect._chat_key, which uses str.lower() on profile names."""
    return text.lower()


def invoking_profile_name() -> str | None:
    """Process active Hermes profile for this tool call, or None if unavailable."""
    ctx = host.get_context()
    if ctx is None:
        return None
    try:
        name = getattr(ctx, "profile_name", None)
        if callable(name):
            name = name()
        if name is None:
            return None
        text = str(name).strip()
        if not text:
            return None
        return _normalize_profile_name(text)
    except Exception:
        return None


def resolve_profile_scope(
    args: dict[str, Any] | None, *, data_dir, active: str | None = None
) -> set[str]:
    """Profiles whose tasks wou_list may return. Trusted invocation profile only."""
    del args, data_dir  # model-supplied profiles and scan consent are not authorization
    if active is not None:
        text = str(active).strip()
        return {_normalize_profile_name(text)} if text else set()
    trusted = invoking_profile_name()
    return {trusted} if trusted is not None else set()


def task_in_profile_scope(chat_key: str, allowed: set[str]) -> bool:
    if not allowed:
        return False
    return _chat_profile_key(chat_key) in allowed
