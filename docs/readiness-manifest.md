# Ship readiness manifest (honest limits)

**Status:** not “all done” — plugin is usable with documented host and migration boundaries.

## Missing or incomplete host features

- **Public token-route registration** — none in Hermes yet, so satellite pairing/push is not shipped; see `known-gaps.md`.
- **Chat read / unread and durable “responded”** — only `host.state.busy` / `awaitingResponse`; no unread atom; panel shows **Read unknown** / **Responded unknown** on older hosts.
- **Catch-up board list / comment / unblock** — no authorized cross-plugin Kanban API; human-blocked and review sections are explicitly **not checked**.
- **Open Kanban deep link**: the button opens only the Kanban view, not a specific board or card; board cards and card IDs are not shown.
- **Inline Yes/No/Reply** — only when this window’s composer owns the chat; remote/other-profile chats get Open + note only.
- **`wou_list` agent scope** — process-profile only; no per-call caller auth API.

## Migration and UI preference loss

- **Catalog id** `waiting-on-you-desktop` vs **data namespace** `waiting-on-you` — task DB and `settings.json` stay on the pinned namespace; `plugin.yaml` `data_namespace` is not parsed by Hermes v1 manifests.
- **Desktop `ctx.storage` panel prefs** (filters, collapse state) — namespaced per plugin id with **no** public cross-id read; keys under legacy `waiting-on-you` do **not** auto-migrate to `waiting-on-you-desktop`.
- **Manifest decision settings** — runtime uses `ctx.get_config` then `HERMES_HOME/config.yaml` entries (current id before legacy); no Hermes loader for silent legacy merge when ctx is missing (`wou.plugin_config.settings_migration_blocker()`).

## Other machines and chat links

- **No satellite endpoints** — no pairing, push, or token routes ship. Satellite tables and rows from earlier versions stay in `wou.db` untouched and are ignored; there is no destructive migration.
- **SSH collection** — legacy, read-only, off until `collect.remote_hosts` has entries.
- **Chat links** — public SDK `host.openSession(sessionId, { intent: 'window', profile, route })`; the SDK may fall back to a tab when the host has no window support. Hosts without `host.openSession` navigate in place.
- **Mixed old/new installs** sharing one `plugin-data/waiting-on-you` tree rely on existing scanner lock ownership — not a general multi-catalog guarantee.

## Verification pointers (parent-owned)

- **npm** `npm run check` — typecheck, node tests, build, desktop module check.
- **Python** `pytest tests_py/` — includes `test_scanner_benchmark.py` (not a perf gate).
- **Browser harnesses** — 22 interaction + 7 catch-up cases under `scratch/*-harness/` (evidence outside repo); parent runs per `scratch/green-checkpoint-manifest.md`.
- **Scanner benchmark** — `python scripts/benchmark_scanner_unchanged.py --chats 200 --scan-budget 100 --trials 3 --json` (optional `--baseline-ref HEAD` for archive compare; unique dirs under `scratch/bench-baseline/`).
