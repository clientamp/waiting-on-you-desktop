# Changelog

## 1.0.2 — 2026-11-12

- Removed satellite pairing: no pairing, push or token routes ship, and Settings no longer has an Other machines section. Pairing can return once Hermes supports token-authenticated plugin routes through a public API ([hermes-agent#151760](https://github.com/NousResearch/hermes-agent/pull/151760), [hermes-agent#143507](https://github.com/NousResearch/hermes-agent/issues/143507))
- No destructive database migration: satellite tables and rows from earlier versions stay in `wou.db` untouched and are ignored
- Read-only SSH collection (`collect.remote_hosts`) still works and stays off until you add a host
- Chat links open other agents' chats through the public SDK `host.openSession` with `intent: 'window'`, the chat's profile and route. No private Desktop bridge is used. Hosts without window support may open a tab; hosts without `host.openSession` navigate in place
- Still requires Hermes 0.21.5 or newer

## 1.0.1 — 2026-11-11

- Calmer task cards: the selected task gets a soft tint instead of a blue left bar, so nothing cuts through a sub-item's checkbox, and the tint keeps clear of neighbouring asks
- Agent, project, tags and due date read as one quiet text line above the answer buttons, so they no longer look like buttons
- Yes, No, Reply, Later and Open session look and behave like buttons, and keep readable contrast at rest, on hover and when pressed in every built-in Hermes theme

## 1.0.0 — 2026-11-11

- Catalog name is now `waiting-on-you-desktop` (another plugin uses `waiting-on-you`); tasks and settings stay in `plugin-data/waiting-on-you`, and older `plugins.entries.waiting-on-you` settings are still read
- Answer from the panel: Yes, No, Reply, Later and Open on the selected task, single-key shortcuts (Y N R L O, J/K), ⌘⌥A to show answer buttons on every task, and five seconds to undo before anything is sent
- Answers go only into a chat this window is showing, never overwrite a half-typed draft, and send once; remote and other-profile chats get Open plus a note
- Catch up on one Hermes project: every chat there that is waiting on you; board sections Hermes does not expose yet are labeled as not checked
- Close all tasks in a chat from right-click, Shift-F10 or the … menu, with confirm and undo
- Working badge on the focused chat while its agent is mid-turn; read and responded state show as unknown rather than guessed
- `wou_list` returns only the current Hermes profile's tasks
- Upgrades abort without deleting anything if the database backup fails

- Reads Desktop and terminal chats that newer Hermes saves under the `local` label, and warns in the panel if Hermes changes chat labels again
- Open session works for profile chats with the newer `local-…` chat ids

- Three list layouts in Settings: **Cards** (default), **Compact**, and **Next up**
- Filters and sort sit behind one Filter button; when filters are on, a one-line summary with Clear shows instead
- Narrow side panels use the full width: smaller indents, borderless header icons, filters in two columns
- Calmer cards: a task's background line opens when you click the ask; Open session and the “…” menu appear on hover or keyboard focus; the agent chip shows only when more than one agent has tasks

- Keep unanswered tasks forever by default (`retention_days: 0`); opt-in expiry is labeled “Cleared for age · not answered” in history, never counted as answered
- Future snoozes survive retention; waking starts a fresh retention window
- Archive and Undo use the owning profile's configured database; unknown or ambiguous owners fail closed
- Group close skips already-terminal members, closes remaining tasks atomically, and returns only changed ids for Undo
- Background ownership retries after reload while an old scan finishes, with cancellable retries and a single runner
- Corrected HTTP guidance: `.local` and other hostnames require HTTPS

- Hermes Projects on tasks and groups; project badges and group-by-project
- Colored tags and tag suggestions, flexible grouping, priorities with context and due dates, and a short quiz to teach the plugin what matters to you
- Optional decision models for scan gating, priority scoring, and automatic tagging
- Privacy-first consent gate and clearer outbound-path disclosures
- Task list durability: separate scan lookback from retention, explicit group closes, snooze-safe rescans, and honest scan failure reporting
- Settings and schema hardening: atomic saves, full migration locking, and background scan when idle

### Hardening

- Reject invalid activity dates and oversized project profiles.
- Give each classifier call fresh random data markers; disclose priority examples shared from other chats.
- Separate SSH options from host names, bound remote output and project lists, and drop invalid chat rows before caching or scanning.
- Require plain session ids and existing local chats for manual tasks; validate card action inputs before executing configured handlers.
- Keep forced scans below twice the daily limit (zero remains unlimited), and reject overlapping tag suggestions or priority evaluations with a short notice.
- Clip message text inside database reads.
- Stop a scan after three matching connection failures and explain how to restore model access; failed chats stay available for retry.

## Unreleased

- Far fewer model calls: background scans only send a chat to the model when it has a new message. Chats with open tasks get one re-check a day (at most 5 per scan). Scan now still re-reads everything with an open task. A real install went from ~1,300 to an expected ~50–80 calls a day.
- A turn finishing no longer forces a model call when the chat's last message has not changed
- Cached chats from an unreachable SSH host are never re-sent to the model
- Prompt: only the 10 most recent closed asks per chat, and project ids dropped
- `wou_list` tool returns a slim list (about a tenth of the tokens): 20 tasks by default, most important first, plus the total count
- Fix: SSH collection crashed with an import error (`attempted relative import`) when run outside the plugin package
- Panel warns when another machine can't be reached and its chats are stale
- Checking a task off from another profile's chat no longer 404s. The pane follows the focused chat, so Desktop asks that profile for the plugin. A profile that has the root install enabled now reads and writes the default home's task list instead of an empty one.
- Clicking the gear while Settings is open now closes Settings
- Show or hide the panel: status bar button, header button, ⌘⌥Y (was open-only), and a ⌘K command; the choice persists
- Desktop pane: recover from backend restarts — DOM-aware pane visibility for polling, resilient settings/projects/tasks load with backoff, and settings UI while the bundle is still loading
- Desktop pane: follow the chat selected in the session sidebar — center and highlight its task card (setting: Follow selected chat, on by default)
- Task cards show when the source chat message was sent (`source_msg_at`), not when the plugin last rescanned; `python3 -m wou backfill-msg-times` backfills existing rows from Hermes state.db
- Settings: show priorities (flat list mode) and show project badges; last-updated on cards; Open session links
- Keyboard shortcuts: toggle priorities/badges, expand/collapse groups, scan, show/hide panel
- Per-card action buttons for external task producers, with configurable local handlers and richer non-chat task cards

## 0.3.0

- Search the list with Cmd-F: live matching on every word, highlights, and an option to include closed tasks
- Prompt-bar button to add a task from the chat you're in
- Projects: pick several at once, rename them, and a cleaner row menu
- Close a whole group with Option-click, with a clearer confirm box
- Chat links open agent chats in their own window, including other profiles and remote Hermes connections
- Settings save right away and stay in sync between Macs, with switch toggles
- Counts show main tasks, with subtasks in parentheses
- Readable error messages

## 0.2.0

- Release controls: mode (auto / hourly / manual / off), debounce, sweep interval, chats per scan, daily model-call cap, lookback days, and consent gate before any model use
- First-run screen and expanded Settings (cost usage, model hint, behavior toggles)
- Nested asks per chat, group actions, and “Why is this here?” from source excerpts
- Projects (manual + AI suggestions), filters by agent and project, sort, undo
- Usage accounting and cap handling in the scanner

## 0.1.0

- Initial release: Covey-sorted task list, scan hook, desktop panel, durable done/dismiss/snooze memory
