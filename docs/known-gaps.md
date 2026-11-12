# Known gaps

These are limits of the Hermes plugin door. Waiting On You must not invent a route around them.

## Catalog id `waiting-on-you-desktop` vs durable data `waiting-on-you`

Checked 2026-11-09 against Hermes source in the local install (`hermes_cli/plugins_manifest.py`, `plugins_state.py`, `plugins/plugin_storage.py`, `web_server_dashboard.py`).

- **Catalog / registry id** is `plugin.yaml` `name` (`waiting-on-you-desktop`): Desktop `HermesPlugin.id`, `ctx.rest` → `/api/plugins/waiting-on-you-desktop/`, `plugins.entries.<id>`, and `dashboard/manifest.json` `name` must match.
- **Durable task DB and `settings.json`** stay in `plugin-data/waiting-on-you` via `wou.paths.plugin_data_directory()` and `wou.identity.DATA_NAMESPACE`. Hermes `plugin_data_dir(plugin_id)` alone would use the catalog id; WoU does not rely on that for `wou.db`.
- **`data_namespace` in `plugin.yaml` is not parsed** for v1 manifests (`data_namespace` is absent from `_KNOWN_MANIFEST_FIELDS`); declaring it would be ignored (debug “unknown field”). Portable plugins get a derived namespace; directory plugins must pin storage in code (as here).
- **Existing data detection** uses verified WoU markers (`wou.db` with a `tasks` table, `config.json` / `settings.json` with WoU keys), not bare `settings.json` in `plugin-data/<catalog_id>` — another plugin can own that path.
- **Manifest decision settings migration** has no public Hermes loader for “read legacy catalog entry when ctx is missing”; runtime code uses `ctx.get_config` first, then `HERMES_HOME/config.yaml` `plugins.entries` (current catalog id before legacy). See `wou.plugin_config.settings_migration_blocker()`. WoU does not call private `hermes_cli.config` loaders.
- **Desktop `ctx.storage` UI prefs** are namespaced per plugin id with no public cross-id read API (`desktop-plugin-sdk.md` — convention, not isolation). Panel filter/collapse keys do not auto-migrate from `waiting-on-you` to `waiting-on-you-desktop`; task data and `settings.json` do.
- **Scanner ownership** when old and new catalog packages share one data tree: `background.lock` and `scan.lock` under `plugin-data/waiting-on-you` keep a single owner (existing `BackgroundRunner` behavior).

## Satellite pairing waits for public token routes

Satellite pairing and push are not shipped. Pushing chats from another Hermes needs plugin REST routes that accept a scoped bearer token instead of a dashboard session. Hermes has no supported public API for that yet; the only way today is a private dashboard-auth module, which a catalog plugin must not import.

Pairing can return only after Hermes ships supported public plugin token routes. Tracking: [hermes-agent#151760](https://github.com/NousResearch/hermes-agent/pull/151760) (open, not merged) and [hermes-agent#143507](https://github.com/NousResearch/hermes-agent/issues/143507).

What you get instead: optional read-only SSH collection through `collect.remote_hosts`, off by default. Satellite tables and rows from earlier versions stay in `wou.db` untouched and are ignored; no migration deletes them.

Do not register token-authenticated routes through private Hermes modules.

## Opening another agent's chat

Chat links call the public SDK `host.openSession(sessionId, { intent: 'window', profile, route })`. Waiting On You does not use a private Desktop bridge. If the host cannot open a separate window, the SDK may open the chat in a tab instead. On a host without `host.openSession`, the link navigates to the chat in place.

## `wou_list` cannot expand beyond the trusted invocation profile

The agent `wou_list` tool scopes tasks to `PluginContext.profile_name`, which Hermes resolves from the running process (`HERMES_HOME` / `get_active_profile_name()`), not from model-supplied tool arguments. That is **process-profile isolation only**, not per-user or per-chat authorization. Scan privacy consent does not grant cross-profile reads. Model-supplied profile names are ignored. Missing or broken plugin context fails closed (empty list). Chats stored under the default key (`chat_id` without a `profile:` prefix) can still be visible whenever the active profile is default — residual shared-bucket risk inside one process, not leakage across Hermes profiles that use distinct prefixed keys. A per-tool-call caller authorization API does not exist yet; until it does, multi-profile agent reads stay unavailable even when collect watches several profiles. Desktop combined UI is unchanged.

## Inline answers stop at this window

Checked 2026-11-09 against Hermes source `0ea6ea9` and the running Desktop build `c314285`.

Yes, No, and Reply send only when this window's visible composer owns the chat. A remote chat, or a chat on another profile, opens in a different window. `host.composer.submit` cannot reach that window. Opening the window and then sending can land in the wrong chat.

What you get instead: Open, plus a note that an inline answer is not available. Later still snoozes the ask here. Nothing is sent.

Do not send an inline answer to a remote chat or another profile from this panel.

## Open Kanban does not open a card

Checked 2026-11-09 against Hermes source `0ea6ea9`. The Kanban page does not read a board or task query. The open card starts empty. A local Desktop patch would be overwritten on the next update.

What you get instead: an Open Kanban button that opens only the Kanban view, not a specific board or card; board cards and card IDs are not shown.

Do not add board or task query parameters and treat them as a deep link.

## Chat read / unread is not on `host.state`

Checked 2026-11-09 against Hermes Desktop SDK source (`hermes-agent-dev/clean/apps/desktop/src/sdk/index.ts` lines 137–159, 559–573) and `desktop-plugin-sdk.md` (lines 1387–1389, 1527–1529). Public readonly atoms: `host.state.busy` (focused chat mid-turn, statusbar pulse), `host.state.awaitingResponse` (true from send until the first assistant payload on that focused chat), `host.state.busyBySession` (runtime id → mid-turn, not socket state), plus focus ids (`focusedStoredSessionId`, `focusedSessionId`, `focusedSessionOwner`, `focusedSessionProfile`). `awaitingResponse === false` while `busy === true` only means the first assistant payload arrived while the turn is still live — not user-answer acknowledgement, thread read state, or a finished reply. WoU shows **Working** only when the row’s chat matches focused selection (stored id + profile/owner when known) and the focus-scoped busy signal is true; it never borrows another session’s busy. It does not show a confident **Responded** from these atoms; when the atom is missing on an older host it shows **Responded unknown**, otherwise it omits that positive label. There is no public atom for persisted unread (`SessionInfo.unread`) or session-dot text; WoU shows **Read unknown** (never guessed from `updated_at`). Background sessions never get Working or idle labels (`index.test.ts` “does not pick up a background session”).

## Catch-up board reads and answers need a public host API

Checked 2026-11-09 against Hermes source `0ea6ea9` and the public Desktop plugin SDK documentation. Catch up uses the existing native `{profile}:{id}` project keys and Waiting On You's own consent-scoped tasks. Tags remain normalized in `tags` / `task_tags`; they are not project labels.

The waiting-chat section works, with the normal task answers/actions and tag controls. Snoozed asks are counted separately. Human-blocked and review sections say **not checked**, not zero or all clear. Open Kanban opens the view only.

Hermes does not expose authorized board listing, comment, or unblock operations to another plugin. `ctx.rest` is restricted to this plugin's backend namespace. Kanban's own dashboard routes are not a cross-plugin API. Do not read `kanban.db`, import `hermes_cli.kanban_db`, shell out to `hermes kanban`, or bypass worker fences.

The missing host contract must provide:

- A read scoped to an authorized native project and its board, with explicit human-input block reasons and review state. A title prefix or a person's name is not authorization. Public-facing wording is "Human-blocked cards", never a hardcoded person's name.
- An authorized, atomic comment-plus-unblock operation. Unfinished parents must keep the card in `todo`; a previously blocked review card returns to `review` when appropriate. Answering a blocked card is not sending a review back to its implementer.
- A durable retry key for the whole answer transaction. Retrying after a lost response must not duplicate a comment or transition. The existing create-task idempotency key does not supply this.
- Exact-target response/readback so a late answer cannot replace the currently selected project's view.

No board-answer form or pretend-success endpoint is shipped until that contract exists. General human wording does not broaden authorization to all blocked cards.

## Scanner benchmark and priority quality limits

**Scanner benchmark (`scripts/benchmark_scanner_unchanged.py`):** fixture size (`--chats`) is independent of per-scan budget (`--scan-budget`, clamped to settings range **5–100**). Unchanged-chat runs assert **zero** tracked model invocations. Baseline comparison uses `git archive` into a **new** directory under `scratch/bench-baseline/<ref>/` (prior extractions kept) plus a copied harness script; no `stash`, `checkout`, or `clone`. Optional `--baseline-ref` reports median wall time over `--trials` and a `delta_wall_seconds` between measured medians (not a speedup ratio). JSON includes `git.dirty`, `worktree_diff_sha`, and `source_hash` (content hash of `wou/` tracked + untracked, excluding ignored paths). `baseline_compare.same_source_hash` is false when the dirty worktree differs from the clean archive even if `HEAD` matches.

**Priority quality (unresolved product requirement):** shipped quadrant rules are deterministic (`wou/priorities.py`: scores, due-within-48h urgency, local end-of-day due timestamps). Regression coverage includes quiz/move flows (`tests_py/test_priorities.py`), held-out label behavior in eval (`tests_py/test_decision_api.py::test_eval_uses_model_prediction_and_holds_out_labels`), and offline `eval-priorities` without models. There is **no** automated gate on “you agree with model priority” beyond confusion-matrix agreement when explicit predictions exist; reaching that bar needs a labeled holdout set and (for live rescoring) paid model calls — intentionally out of scope for CI and this benchmark.

### Safe tag verification

Run `python scripts/check_tag_migration.py /path/to/wou.db` to read a source with SQLite `mode=ro`, back it up consistently (including committed WAL data), and open/migrate only a disposable copy. It compares full normalized tag/link rows including removed flags, retains task columns, checks integrity, and reopens three times. It emits pass/fail flags only and deletes the copy and backups. Never put database copies or row contents into release artifacts. Synthetic regressions also test absent/present migration markers, current schema, completed rollback backups, and injected backup failure.
