# Security

## Reporting a vulnerability

Please report security issues privately to **support@clientamp.com**. Do not open public issues for exploitable problems.

## What this plugin reads

- **Hermes chat databases** (`state.db`) on this machine, read-only: session metadata and the tail of messages needed to classify waiting-on-you tasks. By default that is your Hermes home (`~/.hermes` or `HERMES_HOME`) and each `profiles/<name>/state.db`.
- **Optional remote hosts** you list in plugin `config.json` under `remote_hosts`: the plugin runs read-only SSH commands to fetch the same kind of data from a remote `state.db` path you configure. No remote writes.
- **Its own data** under `~/.hermes/plugin-data/waiting-on-you/` (tasks, projects, settings, usage, scan cache for remotes).

## What this plugin writes

- **Plugin data directory** only: SQLite task store, `settings.json`, `usage.json`, remote host cache JSON, and related files (intended permissions `0600` / `0700` where supported).
- **Optional chat archive**: if you enable “archive chat when last task done”, the plugin may set an archive flag on **your** Hermes chats through the host session API when you mark the last open task done for that chat.

## What leaves your machine

- **Models:** see the complete [outbound paths in README](README.md#privacy--what-is-sent-where), including classification, AI naming, tag suggestions, priority evaluation, and optional decision providers. There is no telemetry.
- **SSH** to hosts you configured, only for read-only collection as above. Off unless you list hosts.

## What does not happen

- No edits to existing Hermes chat messages. The plugin adds to a chat only when you answer from the panel (Yes, No or Reply): after the undo window, that answer is sent as a new message through the composer of the chat this window is showing. The optional archive flag is the only other change it makes to your chats.
- No network calls beyond the configured model/decision providers and optional SSH targets you define.
- No satellite pairing or push endpoints. Earlier satellite records in the task database are left in place and ignored.

## Dashboard route protection

Plugin routes rely on the Hermes dashboard’s authentication and CSRF protection. Do not expose a dashboard with authentication disabled. The plugin registers no bearer-token routes of its own.
