"""Keep every test away from the real plugin data folder."""

import os
import tempfile

# Set before any test module imports the plugin, so a test that forgets to
# patch the data dir writes to a throwaway folder, never the live wou.db.
_GUARD = tempfile.mkdtemp(prefix="wou-test-data-")
os.environ["WOU_DATA_DIR"] = _GUARD
# Collection/catalog defaults must also stay away from real Hermes databases.
os.environ["HERMES_HOME"] = os.path.join(_GUARD, "hermes")
os.environ["WOU_SAT_DATA_DIR"] = os.path.join(_GUARD, "satellite")
# Lifecycle tests explicitly opt in with a stub model; ordinary tests never
# start an unattended background model call.
os.environ["HERMES_WOU_BACKGROUND"] = "0"
