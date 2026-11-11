# Ship readiness manifest (honest limits)

**Status:** not “all done” — plugin is usable with documented host and migration boundaries.

## Missing or incomplete host features

- **`host.openSessionWindow`** (or SDK equivalent) — cross-window open still may touch undocumented Desktop bridge; see `known-gaps.md`.
- **Public token-route registration** — satellite bearer paths use private `hermes_cli.dashboard_auth.token_auth` imports until Hermes exports a supported API.
- **Chat read / unread and durable “responded”** — only `host.state.busy` / `awaitingResponse`; no unread atom; panel shows **Read unknown** / **Responded unknown** on older hosts.
- **Catch-up board list / comment / unblock** — no authorized cross-plugin Kanban API; human-blocked and review sections are explicitly **not checked**.
- **Open Kanban deep link**: the button opens only the Kanban view, not a specific board or card; board cards and card IDs are not shown.
- **Inline Yes/No/Reply** — only when this window’s composer owns the chat; remote/other-profile chats get Open + note only.
- **`wou_list` agent scope** — process-profile only; no per-call caller auth API.

## Migration and UI preference loss

- **Catalog id** `waiting-on-you-desktop` vs **data namespace** `waiting-on-you` — task DB and `settings.json` stay on the pinned namespace; `plugin.yaml` `data_namespace` is not parsed by Hermes v1 manifests.
- **Desktop `ctx.storage` panel prefs** (filters, collapse state) — namespaced per plugin id with **no** public cross-id read; keys under legacy `waiting-on-you` do **not** auto-migrate to `waiting-on-you-desktop`.
- **Manifest decision settings** — runtime uses `ctx.get_config` then `HERMES_HOME/config.yaml` entries (current id before legacy); no Hermes loader for silent legacy merge when ctx is missing (`wou.plugin_config.settings_migration_blocker()`).

## Satellite compatibility limits

- REST under `/api/plugins/waiting-on-you-desktop/satellite/*` with **404 fallback** to legacy prefix; token routes registered on both prefixes.
- Pair/push behavior depends on Desktop exposing the catalog id route; mixed old/new installs sharing one `plugin-data/waiting-on-you` tree rely on existing scanner lock ownership — not a general multi-catalog guarantee.

## Verification pointers (parent-owned)

- **npm** `npm run check` — typecheck, node tests, build, desktop module check.
- **Python** `pytest tests_py/` — includes `test_scanner_benchmark.py` (not a perf gate).
- **Browser harnesses** — 22 interaction + 7 catch-up cases under `scratch/*-harness/` (evidence outside repo); parent runs per `scratch/green-checkpoint-manifest.md`.
- **Scanner benchmark** — `python scripts/benchmark_scanner_unchanged.py --chats 200 --scan-budget 100 --trials 3 --json` (optional `--baseline-ref HEAD` for archive compare; unique dirs under `scratch/bench-baseline/`).
