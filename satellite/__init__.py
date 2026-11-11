"""Waiting On You Satellite — Hermes plugin entry."""

from __future__ import annotations

from .wou_satellite.runner import post_llm_call, start_if_paired
from .wou_satellite.sender import format_status, pair, unpair

_SLASH_PAIR_MSG = (
    "Pairing codes belong in the terminal, not chat history. "
    "Run: hermes waiting-on-you-satellite pair <hub_url> <code>"
)


def _cli_dispatch(args) -> None:
    cmd = getattr(args, "wou_sat_command", None)
    if cmd == "pair":
        print(pair(args.hub_url, args.code))
    elif cmd == "status":
        print(format_status())
    elif cmd == "unpair":
        print(unpair())
    else:
        print("Usage: hermes waiting-on-you-satellite <pair|status|unpair>")


def _setup_cli(subparser) -> None:
    subs = subparser.add_subparsers(dest="wou_sat_command")
    p_pair = subs.add_parser("pair", help="Pair with your Waiting On You hub")
    p_pair.add_argument("hub_url", help="Hub base URL (https or LAN http)")
    p_pair.add_argument("code", help="One-time pairing code from hub Settings")
    subs.add_parser("status", help="Show pairing and push status")
    subs.add_parser("unpair", help="Remove local pairing credentials")
    subparser.set_defaults(func=_cli_dispatch)


def _slash_handler(raw_args: str) -> str:
    tokens = raw_args.split() if isinstance(raw_args, str) else []
    sub = tokens[0].lower() if tokens else "status"
    if sub in {"pair", "code"}:
        return _SLASH_PAIR_MSG
    if sub == "unpair":
        return unpair()
    if sub in {"help", "-h", "--help"}:
        return (
            "/waiting-on-you-satellite status — show sync status. "
            "Pair via: hermes waiting-on-you-satellite pair <hub_url> <code>"
        )
    return format_status()


def register(ctx) -> None:
    ctx.register_hook("post_llm_call", post_llm_call)
    # Start syncing as soon as the gateway loads a paired satellite, so a
    # quiet machine still sends its chats without waiting for a new turn.
    start_if_paired()
    ctx.register_cli_command(
        name="waiting-on-you-satellite",
        help="Push this Hermes chats to your Waiting On You hub",
        setup_fn=_setup_cli,
        handler_fn=_cli_dispatch,
    )
    ctx.register_command(
        "waiting-on-you-satellite",
        _slash_handler,
        description="Waiting On You Satellite sync status",
        args_hint="status",
    )
