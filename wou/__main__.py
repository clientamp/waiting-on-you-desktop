"""Cron-friendly CLI: python3 -m wou scan"""

from __future__ import annotations

import json
import sys

from .paths import plugin_data_directory
from .scanner import Scanner


def _cmd_backfill_msg_times() -> int:
    from wou.store import Store, backfill_source_msg_at, default_state_db_lookup

    data_dir = plugin_data_directory()
    db_path = data_dir / "wou.db"
    if not db_path.is_file():
        print(f"No task database at {db_path}", file=sys.stderr)
        return 1
    lookup, closer = default_state_db_lookup()
    store = Store(str(db_path))
    try:
        n = backfill_source_msg_at(store, lookup)
    finally:
        closer()
        store.close()
    print(json.dumps({"backfilled": n}))
    return 0


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if not args or args[0] in {"-h", "--help", "help"}:
        print(
            "Usage: python3 -m wou scan | backfill-msg-times | eval-priorities --labels FILE [--live] | --from-db",
            file=sys.stderr,
        )
        return 0 if args and args[0] in {"-h", "--help", "help"} else 1
    if args[0] == "eval-priorities":
        from .eval_priorities import main as evaluate

        return evaluate(args[1:], plugin_data_directory())
    if args[0] == "scan":
        data_dir = plugin_data_directory()
        summary = Scanner(data_dir).run_once(force_full=True)
        print(json.dumps(summary, ensure_ascii=False))
        return 0
    if args[0] == "backfill-msg-times":
        return _cmd_backfill_msg_times()
    print(f"Unknown command: {args[0]}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
