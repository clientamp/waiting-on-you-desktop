"""Catalog vs durable data namespace for Waiting On You.

Hermes ``manifest_key`` / Desktop ``HermesPlugin.id`` use the catalog identifier.
Task DB, settings.json, and scanner locks stay under ``DATA_NAMESPACE`` so
catalog renames do not fork user data. See ``wou.paths.plugin_data_directory``.
"""

from __future__ import annotations

CATALOG_ID = "waiting-on-you-desktop"
LEGACY_CATALOG_ID = "waiting-on-you"
DATA_NAMESPACE = LEGACY_CATALOG_ID

INSTALL_DIR_NAMES = (CATALOG_ID, LEGACY_CATALOG_ID)

LEGACY_API_PREFIX = f"/api/plugins/{LEGACY_CATALOG_ID}"
CATALOG_API_PREFIX = f"/api/plugins/{CATALOG_ID}"

BROADCAST_PLUGIN_IDS = (CATALOG_ID, LEGACY_CATALOG_ID)
