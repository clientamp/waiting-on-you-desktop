"""Dashboard bearer-token auth for satellite push and pair routes."""

from __future__ import annotations

import logging
from typing import Callable, Optional

from hermes_cli.dashboard_auth import (
    DashboardAuthProvider,
    TokenPrincipal,
    Session,
    register_provider,
)

from . import identity
from .satellite_hub import PAIR_PREFIX, SAT_TOKEN_PREFIX, verify_pair_code, verify_satellite_token

_log = logging.getLogger(__name__)

PROVIDER_NAME = "waiting-on-you-satellite"
DRAIN_ROUTE_PATH = "/api/gateway/drain"

ROUTE_PAIR = identity.CATALOG_SATELLITE_PAIR
ROUTE_PUSH = identity.CATALOG_SATELLITE_PUSH
TOKEN_ROUTES = (
    identity.LEGACY_SATELLITE_PAIR,
    identity.LEGACY_SATELLITE_PUSH,
    ROUTE_PAIR,
    ROUTE_PUSH,
)

_provider_registered = False
_registration_reason = ""


def _token_route_api():
    """Lazy compatibility boundary: Hermes has no public token-route API yet.

    Removal disables satellite auth, never substitutes dashboard-wide access.
    Local collection and the task panel continue to work without this seam.
    """
    try:
        from hermes_cli.dashboard_auth.token_auth import is_token_route, register_token_route
        return is_token_route, register_token_route
    except ImportError:
        return None


def _route_scope_error() -> str:
    # Hermes currently exposes no public route enumeration. If this private
    # compatibility boundary disappears, do not accept globally usable tokens.
    try:
        from hermes_cli.dashboard_auth import token_auth
        with token_auth._lock:
            routes = set(token_auth._token_routes)
    except (ImportError, AttributeError, TypeError):
        return "token route enumeration unavailable; satellite auth fail-closed"
    if DRAIN_ROUTE_PATH in routes:
        return "drain token route registered; satellite auth fail-closed"
    if routes - set(TOKEN_ROUTES):
        return "foreign token route registered; satellite auth fail-closed"
    return ""


class WaitingOnYouSatelliteProvider(DashboardAuthProvider):
    name = PROVIDER_NAME
    display_name = "Waiting On You Satellite"
    supports_token = True
    supports_session = False

    def __init__(self, db_path_fn: Callable[[], str]) -> None:
        self._db_path_fn = db_path_fn

    def verify_token(self, *, token: str) -> Optional[TokenPrincipal]:
        if not token:
            return None
        if not (token.startswith(SAT_TOKEN_PREFIX) or token.startswith(PAIR_PREFIX)):
            return None
        api = _token_route_api()
        if api is None:
            return None
        is_token_route, _ = api
        if is_token_route(DRAIN_ROUTE_PATH) or _route_scope_error():
            return None
        db_path = self._db_path_fn()
        if token.startswith(SAT_TOKEN_PREFIX):
            sid = verify_satellite_token(db_path, token)
            if sid:
                return TokenPrincipal(
                    principal=f"wou-sat:{sid}",
                    provider=self.name,
                    scopes=("wou-satellite",),
                )
            return None
        code_id = verify_pair_code(db_path, token)
        if code_id:
            return TokenPrincipal(
                principal=f"wou-pair:{code_id}",
                provider=self.name,
                scopes=("wou-pair",),
            )
        return None

    def start_login(self, *, redirect_uri: str):
        raise NotImplementedError("non-interactive satellite provider")

    def complete_login(self, *, code: str, state: str, code_verifier: str, redirect_uri: str):
        raise NotImplementedError("non-interactive satellite provider")

    def verify_session(self, *, access_token: str) -> Optional[Session]:
        return None

    def refresh_session(self, *, refresh_token: str) -> Session:
        raise NotImplementedError("non-interactive satellite provider")

    def revoke_session(self, *, refresh_token: str) -> None:
        return None


def ensure_registered(db_path_fn: Callable[[], str]) -> tuple[bool, str]:
    """Register provider and token routes once per process. Returns (enabled, reason)."""
    global _provider_registered, _registration_reason
    if _provider_registered:
        return registration_state()

    api = _token_route_api()
    if api is None:
        _registration_reason = "token_auth seam unavailable"
        _provider_registered = True
        return False, _registration_reason
    is_token_route, register_token_route = api

    scope_error = _route_scope_error()
    if scope_error:
        _registration_reason = scope_error
        _provider_registered = True
        return False, scope_error

    provider = WaitingOnYouSatelliteProvider(db_path_fn)
    try:
        register_provider(provider)
    except ValueError:
        pass
    except TypeError as exc:
        _registration_reason = f"provider registration failed: {exc}"
        _provider_registered = True
        return False, _registration_reason

    for path in TOKEN_ROUTES:
        register_token_route(path)

    if is_token_route(DRAIN_ROUTE_PATH) or _route_scope_error():
        _registration_reason = _route_scope_error() or "drain token route registered; satellite auth fail-closed"
        _provider_registered = True
        return False, _registration_reason

    _provider_registered = True
    _registration_reason = ""
    return True, ""


def registration_state() -> tuple[bool, str]:
    """Current enablement after import-time registration."""
    if not _provider_registered:
        return False, "not registered"
    if _registration_reason:
        return False, _registration_reason
    api = _token_route_api()
    if api is None:
        return False, "token_auth seam unavailable"
    if api[0](DRAIN_ROUTE_PATH) or _route_scope_error():
        return False, _route_scope_error() or "drain token route registered; satellite auth fail-closed"
    return True, ""
