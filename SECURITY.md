# Security

## Reporting a vulnerability

Please report security issues privately to **support@clientamp.com**. Do not open public issues for exploitable problems.

## What this plugin reads

- **Hermes chat databases** (`state.db`), read-only: session metadata and the tail of messages needed to classify waiting-on-you tasks. By default that is your Hermes home (`~/.hermes` or `HERMES_HOME`) and each `profiles/<name>/state.db`. `collect.local_profiles` replaces that list.
- **Hermes project databases** (`projects.db`) beside each watched `state.db`, read-only. The plugin uses them to find each chat's project from its working folder.
- **Hermes `config.yaml`** in your Hermes home: the `auxiliary.waiting_on_you` model choice and this plugin's `plugins.entries` settings.
- **Optional remote hosts** you list in plugin `config.json` under `collect.remote_hosts`. The plugin runs `python3` on that host over SSH. It reads the remote `state.db` path you configure and the `projects.db` beside it, read-only. No remote writes.
- **Its own data** under `~/.hermes/plugin-data/waiting-on-you/` (tasks, tags, settings, usage, scan cache for remotes).

## What this plugin writes

- **Its own data directory:** SQLite task store, `settings.json`, `usage.json`, remote host cache JSON, locks and related files (intended permissions `0600` / `0700` where supported). Task and group names you change are saved here. Hermes chat titles are not changed.
- **Panel view choices** (for example collapsed groups) in Desktop's per-plugin storage.
- **Hermes plugin settings:** when you save decision provider settings, the plugin writes provider, model, endpoint and account ID through Hermes's `ctx.set_config()`. The decision timeout is read from Hermes's plugin configuration; the plugin does not write it. API keys stay in Hermes credential storage; the plugin does not write them.
- **One-time database backup:** the first time a task database opens without the Hermes Projects marker, the plugin copies it to `wou.db.bak-pre-hermes-projects-<timestamp>` beside itself, then clears the plugin's old project assignments. If the backup fails, nothing is deleted. Later upgrades do not take a backup.
- **Optional chat archive:** if you turn on "Archive chat when last task done", marking the last open task done in a local chat archives that chat through Hermes's session database API. Undo unarchives it.
- **Answers you send:** Yes, No and Reply add a new message to a chat, after the undo window, through the composer of the chat this window is showing.
- **Card action handlers:** **Run** starts the command you configured under `action_handlers`. What that command changes is up to the command.

## What leaves your machine

- **Models:** your configured Hermes model and the optional decision provider. See the complete [outbound paths in README](README.md#privacy--what-is-sent-where), including classification, AI naming, tag suggestions, priority evaluation, and decision calls. There is no telemetry.
- **SSH** to hosts you configured, only for read-only collection as above. Off unless you list hosts.
- **Card action handlers** can make their own network calls and file changes. The plugin does not limit what they do.

## Child process environment

SSH and card action handlers start with a small environment: `PATH`, `HOME`, `USER`, `LOGNAME`, `LANG`, `LC_*`, `TMPDIR` and `TZ`. SSH also gets `SSH_AUTH_SOCK`, so your SSH agent still works. Other variables from the Hermes process, including API keys, are not passed.

A handler can list more variable names under `env`. Names must be exact; there is no wildcard or prefix match. Each name you add is passed to that command. Adding a credential or a variable that changes how a tool behaves gives that power to the command. Add only what the handler needs.

## What does not happen

- No edits to existing Hermes chat messages. The plugin adds to a chat only when you answer from the panel, as described above.
- No network calls beyond the configured model and decision providers, the optional SSH hosts, and any card action commands you configure.
- No satellite pairing or push endpoints. Earlier satellite records in the task database are left in place and ignored.

## Dashboard route protection

Plugin routes rely on the Hermes dashboard’s authentication and CSRF protection. Do not expose a dashboard with authentication disabled. The plugin registers no bearer-token routes of its own.
