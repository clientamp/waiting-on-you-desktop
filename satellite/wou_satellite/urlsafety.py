"""Refuse plain HTTP to hosts that are not literal local/private/CGNAT (same as decision URLs)."""

from __future__ import annotations

import ipaddress
from urllib.parse import urlparse


_PUBLIC_HTTP_MSG = (
    "Refusing to send chats over plain http to a public address. Use https."
)


def _allowed_literal(address: str) -> bool:
    try:
        addr = ipaddress.ip_address(address)
    except ValueError:
        return False
    return (
        addr.is_loopback
        or addr.is_private
        or addr.is_link_local
        or (addr.version == 4 and addr in ipaddress.ip_network("100.64.0.0/10"))
    )


def check(url: str) -> str | None:
    """Return None if OK, else a short refusal reason."""
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    if scheme == "https":
        return None
    if scheme != "http":
        return "Only http and https hub URLs are supported."
    host = parsed.hostname
    if not host:
        return _PUBLIC_HTTP_MSG
    if host.lower() == "localhost":
        return None
    try:
        if _allowed_literal(host):
            return None
    except ValueError:
        pass
    return _PUBLIC_HTTP_MSG
