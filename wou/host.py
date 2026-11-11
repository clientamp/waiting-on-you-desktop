"""Share host handles across Hermes' package and dashboard import names.

Hermes imports the entry point under a plugin-qualified package, while the
Dashboard loads `wou`. Both must use the same registered public context. Only
our own module is aliased; no Hermes module or host configuration is patched.
"""
import sys

context = None
llm = None
_shared = sys.modules.setdefault('_waiting_on_you_host_handles', sys.modules[__name__])


def set_context(value):
    _shared.context = value


def get_context():
    return _shared.context


def set_llm(value):
    _shared.llm = value


def get_llm():
    return _shared.llm
