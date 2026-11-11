"""Hermes plugin event helpers."""

from __future__ import annotations


def broadcast_tasks_changed() -> None:
    try:
        from hermes_cli.plugin_events import broadcast_plugin_event
        from .identity import BROADCAST_PLUGIN_IDS

        for plugin_id in BROADCAST_PLUGIN_IDS:
            broadcast_plugin_event(plugin_id, "tasks.changed", {})
    except Exception:
        pass


def broadcast_settings_changed() -> None:
    try:
        from hermes_cli.plugin_events import broadcast_plugin_event
        from .identity import BROADCAST_PLUGIN_IDS

        for plugin_id in BROADCAST_PLUGIN_IDS:
            broadcast_plugin_event(plugin_id, "settings.changed", {})
    except Exception:
        pass
