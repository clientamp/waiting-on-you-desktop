"""Explicit runtime environment for opt-in local child processes."""
from __future__ import annotations

import os
from collections.abc import Iterable

_RUNTIME_NAMES = frozenset({"PATH", "HOME", "USER", "LOGNAME", "LANG", "TMPDIR", "TZ"})


def child_env(*, ssh: bool = False, passthrough: Iterable[str] = ()) -> dict[str, str]:
    """Copy only runtime variables and explicitly configured handler names."""
    names = _RUNTIME_NAMES | set(passthrough)
    if ssh:
        names = names | {"SSH_AUTH_SOCK"}
    return {
        name: value for name, value in os.environ.items()
        if name in names or name.startswith("LC_")
    }
