# servicenow-cli

[![npm](https://img.shields.io/npm/v/@seemsindie/servicenow-cli.svg)](https://www.npmjs.com/package/@seemsindie/servicenow-cli)
[![release](https://img.shields.io/github/v/release/seemsindie/servicenow-cli?include_prereleases)](https://github.com/seemsindie/servicenow-cli/releases)

`sn` — command-line interface for ServiceNow. Multi-instance, multi-module, feature parity with [servicenow-mcp-server](../servicenow-mcp-server).

## Contents

- [What you can do](#what-you-can-do)
- [Install](#install)
- [First run](#first-run)
- [Command reference](#command-reference)
- [Workflows](#workflows)
  - [Editing records](#editing-records)
  - [Promoting changes between instances](#promoting-changes-between-instances)
  - [Script sync](#script-sync)
  - [Run background scripts](#run-background-scripts)
  - [Use `sn` as an MCP server](#use-sn-as-an-mcp-server)
- [Global flags](#global-flags)
- [Exit codes](#exit-codes)
- [Auth](#auth)

## What you can do

- **Everyday SN work** — ticketing (`incident`, `change`, `problem`, `request`, `ritm`), CMDB (`ci`), content (`kb`, `catalog`), agile (`story`, `epic`, `task`, `project`), attachments, batch ops. 35+ domains, 146 leaf commands.
- **Build on SN as a backend** — `sn codegen {typescript, python, go}` emits type-safe client code from the live dictionary; `sn log tail -f` and `sn watch` stream server-side events to stdout; `sn openapi import` scaffolds a Scripted REST API from an OpenAPI 3.x spec.
- **LLM integration** — `sn mcp serve` exposes every leaf as an MCP tool. Point Claude Desktop / Cursor / Claude Code at it and the agent gets the full CLI surface. Read-only by default; writes gated behind `--allow-writes`.
- **DevOps** — `sn update-set export` + `sn diff <instance-a> <instance-b> <table>` for promoting changes between environments and validating what landed.
- **OAuth + keyring** — `sn auth login` runs OAuth 2.0 Authorization Code + PKCE, stores tokens in the OS keyring (macOS `security` / Linux `secret-tool` / Windows `cmdkey`) with an AES-256-GCM file fallback. No passwords in `config.json`.

## Command reference

### Ticketing & workflow
- `sn incident` — list, get, create, update, resolve, close, reopen, comment, work-note
- `sn change` — list, get, create, update, submit-approval, approve, reject, add-task, comment, work-note
- `sn problem` — list, get, create, update, close, comment, work-note
- `sn request` — list, get, submit (catalog order via `/api/sn_sc/.../order_now`)
- `sn ritm` — list, get, update

### Platform developer loop
- `sn update-set` — list, get, create, update, use, current, commit, clone, add, move
- `sn scope` — current, set
- `sn script` — pull, push, watch (local `.sn-sync.json` manifest, `fs.watch` debounced)
- `sn run-script` — execute server-side JS via `sys_trigger`, optional `--wait <seconds>`
- `sn business-rule`, `sn client-script`, `sn ui-policy`, `sn ui-action`, `sn ui-script`, `sn script-include`, `sn widget`, `sn ui-page` — list, get, create, update, delete (each)
- `sn rest-api` — list, get, create, update + `resource {create, update, delete}` for operations
- `sn workflow` — list, get, create, update, delete, activity-add, transition-add, publish, **create-full -f workflow.yaml**
- `sn flow` — list, get, create, variables, variable-add, stages (logic blocks are UI-only)
- `sn schema` — tables, discover, field

### Content
- `sn kb` — list, base-create, category-create, article-{list,get,create,update,publish}
- `sn catalog` — list + grouped: `item {list, get, update, move, validate, recommend, variable {list, create, update}}` + `category {list, create, update}`

### Agile
- `sn story`, `sn epic`, `sn task`, `sn project` — list, get, create, update, delete (each)

### CMDB
- `sn ci` — list, get, create, relationships, relate (with cmdb_rel_type name resolution)

### Bulk / admin
- `sn attachment` — list, get (with --download), upload (binary-safe multipart)
- `sn batch` — create, update, delete (sequential by default; `--parallel` for `Promise.allSettled`)
- `sn aggregate <table> <stat>` — COUNT/SUM/AVG/MIN/MAX via `/api/now/stats/<table>`
- `sn import-set` — create (staging), run-transform
- `sn instance` — list, use, info, add, remove, current
- `sn user` — list, get, create, update
- `sn group` — list, create, update, add-members, remove-members

### Escape hatches
- `sn search` — natural-language → encoded query
- `sn table` — generic Table API (query/get/create/update/delete) for any table

### Build-on-SN toolkit
- `sn codegen {typescript, python, go} <table>` — **live-schema codegen** from `sys_dictionary` + `sys_choice`, walks the super_class chain for inherited fields. TS interfaces + choice unions, Pydantic v2 models, or Go structs with typed const choices.
- `sn log tail [--follow] [--level] [--source] [--message]` — stream `syslog` like `tail -f`. Colored by level, `-f` polls, JSON/CSV output works.
- `sn watch <table> [--query] [--interval N] [--since]` — emits new/updated records as JSONL (one per line), `--once` for a single pass. Pipe to `jq` / feed a reactive UI / trigger external automation.

### Auth & admin
- `sn auth {login, logout, status}` — **OAuth 2.0 Authorization Code + PKCE** with browser handoff, tokens stored in OS keyring (macOS `security` / Linux `secret-tool` / Windows `cmdkey`), AES-256-GCM file fallback.
- `sn impersonate <user> -- <cmd> [args…]` — run a sub-command as another user via SN's session-cookie impersonation. OAuth-only. Ideal for ACL testing.
- `sn webhook create -f spec.yaml` — declarative scaffold: REST Message + function + Business Rule trigger from a YAML spec.

### Dev loop
- `sn edit <table> <id> [--field <name>] [--no-confirm]` — open a record (or one field) in `$EDITOR`, show a colored diff, prompt for confirmation, then PATCH only what changed. Dirty-write detection via `sys_mod_count` re-check. Reference fields get `# → Display Name` annotations.
- `sn openapi import <spec.{yaml,json}>` — scaffold a Scripted REST API + one operation per path/method from an OpenAPI 3.x spec. `--dry-run` prints the plan.

### LLM integration
- `sn mcp serve [--allow-writes] [--allow-admin]` — expose every `sn` leaf as an MCP tool over stdio. Drop into Claude Desktop / Cursor / Claude Code config and the agent can run any command you can. Read-only by default.

### DevOps
- `sn export <table> [id] [--query Q] [--out PATH]` — **generic XML export** via SN's platform `/{table}.do?UNL` endpoint (same as the UI's "Export to XML" action). Works for every table: `sys_update_set`, `oauth_entity`, `sp_widget`, `sys_script_include`, etc. Single sys_id → one record; pass `--query` to export many.
- `sn update-set export <id-or-name> [--out PATH] [--format xml|json]` — ergonomic shortcut over `sn export sys_update_set`: resolves by name, warns on non-Complete state, offers a structured `--format json` mode that dumps the parent + `sys_update_xml` children via the Table API.
- `sn diff <instance-a> <instance-b> <table> [--query] [--key] [--fields]` — field-level record diff across two configured instances. Reports `onlyInA` / `onlyInB` / `different` / identical. `--key name` for portable records where cross-instance sys_ids differ.

### Output, completion, release
- Output: `-o json | table | csv | yaml` (TTY → table, pipe → json)
- `sn completion {bash, zsh, fish}` — emits completion scripts (auto-enumerates all commands)
- Prebuilt binaries for linux-x64, darwin-arm64, darwin-x64 via `scripts/build-release.sh` / GitHub Releases

## Install

### From npm (recommended for Node / Bun users)

```bash
npm i -g @seemsindie/servicenow-cli
# or one-shot
npx @seemsindie/servicenow-cli instance list
```

### Download the prebuilt binary (no Node required)

Grab the binary for your platform from the [latest release](https://github.com/seemsindie/servicenow-cli/releases/latest):

```bash
# Linux x64
curl -L https://github.com/seemsindie/servicenow-cli/releases/latest/download/sn-linux-x64 -o /usr/local/bin/sn
chmod +x /usr/local/bin/sn

# macOS arm64
curl -L https://github.com/seemsindie/servicenow-cli/releases/latest/download/sn-darwin-arm64 -o /usr/local/bin/sn
chmod +x /usr/local/bin/sn
```

### From source

```bash
git clone https://github.com/seemsindie/servicenow-cli.git
cd servicenow-cli
bun install
bun run build   # → dist/sn (single binary)
```

## First run

If no config exists, the CLI launches an interactive wizard:

```bash
bun run src/cli.ts instance add
```

Or manually create `~/.config/servicenow-cli/config.json`:

```json
{
  "instances": [
    {
      "name": "dev",
      "url": "https://dev12345.service-now.com",
      "auth": { "type": "basic", "username": "admin", "password": "..." },
      "default": true
    }
  ],
  "defaultOutput": "table",
  "color": "auto",
  "scriptSync": { "workDir": "./sn-scripts" }
}
```

Config discovery order:
1. `--config <path>` (explicit)
2. `./servicenow-cli.config.json` (project-local)
3. `$XDG_CONFIG_HOME/servicenow-cli/config.json` (default `~/.config/servicenow-cli/config.json`)

## Examples

```bash
# Instances & ticketing
sn instance list
sn incident list --state 2 --priority 1
sn incident create --short-desc "Printer jam" --urgency 2
sn incident resolve INC0012345 --code "Solution provided" --notes "replaced toner"
sn problem close PRB0040001 --close-code "Risk Accepted" --close-notes "done"

# Natural-language search & escape hatch
sn search "high priority incidents assigned to admin"
sn table query sys_user --query "active=true" --sn-fields user_name,email --limit 5
```

## Using ServiceNow as a backend for your own app

If you're building a mobile app, service, or integration that *uses* SN as a data/workflow backend — not administering it — the CLI has a few superpowers tailored for that workflow.

### 1. Generate type-safe client code — TypeScript, Python, or Go

`sn codegen <lang> <table>` queries `sys_dictionary` + `sys_choice` + the parent-class chain, and emits a type-safe module with:

- A record type (`interface` / `BaseModel` / `struct`) with correctly-typed fields
- Choice fields as literal unions / Enum / typed `const` blocks
- Reference fields annotated with the target table
- Inherited fields from the super-class chain (e.g. `Incident` includes `Task` fields)

```bash
# TypeScript (interface + union types + label maps)
sn codegen typescript incident --out-file src/types/incident.ts

# Python (Pydantic v2 BaseModel + str Enum) — requires pydantic>=2
sn codegen python incident --out-file app/schemas/incident.py

# Go (struct + json tags + typed const blocks)
sn codegen go incident --out-file api/servicenow/incident.go
sn codegen go cmdb_ci_server --package cmdb --out-file cmdb/server.go
```

Your app code is type-checked against the live schema of *your* instance — no drift between a hand-written definition and a field that got added in an update set last Tuesday.

### 2. OAuth login with keyring-stored tokens — no more passwords in config

For production-ish use, prefer OAuth over Basic Auth:

```bash
# One-time: register an OAuth app in SN (System OAuth → Application Registry)
# with redirect URL http://127.0.0.1:*/cb
sn instance add                           # pick "OAuth Authorization Code + PKCE"
sn auth login -i dev                      # opens browser, captures tokens into OS keyring
sn auth status -i dev                     # shows current user + expiry
sn incident list -i dev                   # uses the bearer token from keyring
sn auth logout -i dev                     # clears the keyring entries
```

Tokens live in the macOS Keychain / GNOME Keyring / Windows Credential Manager — never in config.json. Refresh happens automatically before every call.

### 3. Impersonate users to test ACLs

```bash
sn impersonate abel.tuter -- sn incident list --limit 5
sn impersonate alice.admin -- bash        # interactive sub-shell as another user
```

Requires an OAuth profile. Admin's bearer is exchanged for the target user's bearer via `/api/now/ui/impersonate/<sys_id>`; that token is piped to the sub-command via `SN_IMPERSONATION_TOKEN_FILE`. Clean temp-file with 0600 perms; auto-cleaned on exit.

### 4. Scaffold outbound webhooks declaratively

```yaml
# webhook.yaml
name: Notify Slack on P1 incidents
trigger:
  table: incident
  when: after
  condition: priority=1^active=true
endpoint:
  url: https://hooks.slack.com/services/...
  method: POST
  headers:
    Content-Type: application/json
  body: |
    {"text": "P1: ${current.number}"}
retry:
  attempts: 3
  delay_seconds: 30
```

```bash
sn webhook create -f webhook.yaml
```

Creates `sys_rest_message` + `sys_rest_message_fn` + a Business Rule that triggers it, all inside the current update-set.

### 2. Tail server-side logs

`sn log tail` streams `syslog` like `tail -f` — invaluable when you're iterating on a Scripted REST API or a Business Rule and need to see what `gs.info()` / `gs.error()` printed.

```bash
# One-shot, recent 50 entries
sn log tail

# Follow-mode with filters
sn log tail --follow --level error
sn log tail --follow --source "Business Rule" --message "my-api"
```

### 3. Stream record changes as JSONL

`sn watch <table>` polls for records with `sys_updated_on >= cursor` and emits each as a JSON line. Perfect for feeding a reactive dashboard, kicking off external automation, or piping to `jq`.

```bash
# Watch new P1 incidents forever, feed to Slack
sn watch incident --query "priority=1^active=true" --follow |
  while read -r rec; do
    number=$(echo "$rec" | jq -r .number)
    curl -X POST https://slack.../webhook -d "{\"text\":\"P1: $number\"}"
  done

# One-shot since a specific time (for cron)
sn watch incident --once --since "2026-04-20 00:00:00" > today.jsonl
```

### 4. Run tests / data loads locally

```bash
# Bulk-seed test data
cat seed.json | sn batch create -f -

# Run a server-side fix script with result polling
sn run-script --code "gs.info('hello from ' + gs.getUserName());" --wait 15

# Ad-hoc aggregation for a dashboard
sn aggregate incident count --group-by priority -o json
```

### 5. Test as a different user

Auth works as whoever is in your config. Point your client integration tests at a restricted user to validate ACLs:

```bash
sn instance add   # add a non-admin test account
sn incident list -i test-user --limit 5    # see what they see
```

## Workflows

### Editing records

`sn edit` fetches a record, opens it in `$EDITOR` as YAML (read-only audit fields stripped, reference fields annotated with display names), shows you a colored diff when you save, prompts to confirm, then PATCHes only the fields that changed.

```bash
# Full-record edit — opens YAML with reference-field hints
sn edit incident INC0010016 -i devoauth
# Shows a diff + [y/N] prompt; y applies the PATCH, anything else aborts.

# One-field edit — opens just that field with a sensible extension
sn edit sp_widget <sys_id> -i dev --field template       # → .html
sn edit sys_script_include <sys_id> -i dev --field script  # → .js

# Non-interactive / scripted
sn edit incident INC0010016 -i devoauth --no-confirm --editor /path/to/sed-script
```

Dirty-write protection is built in: `sn edit` captures the record's `sys_mod_count` at fetch time and re-GETs right before the PATCH. If another user modified the record between your fetch and save, the edit aborts with a clear "re-run `sn edit` to pick up the latest" message.

### Update-set workflow

```bash
# Create a set and start working under it
SET=$(sn update-set create --name "CLI smoke" -o json | jq -r .sys_id)
sn update-set use "$SET"             # persists to sidecar state
sn business-rule create --name Foo --collection incident --when before --script-file foo.js
sn update-set get "$SET" --full       # inspect captured records
sn update-set commit "$SET"
```

Any write command (`business-rule create`, `script-include update`, etc.) accepts `--update-set <sys_id>` to override the current set for that invocation. Pass `--no-apply-state` to skip entirely.

### Caveats

- **Update-set binding on Basic-Auth REST is best-effort.** SN's mechanism for the "current update set" depends on a per-user browser session; Basic-Auth REST requests don't always honour the `sys_user_preference` flip the CLI performs. If records aren't landing where you expect, set the update set interactively in the browser first (with the same user), or attach records manually via `sn update-set add`. Scope binding (via concoursepicker) is more reliable.
- **Sidecar state races.** The per-instance sidecar at `~/.config/servicenow-cli/state/<instance>.json` is a single file — parallel invocations to the same instance can clobber each other's `update-set use` / `scope set` writes. Prefer `--update-set` / `--scope` flags in automation.

### Promoting changes between instances

Package an update set as XML, move it to another environment, and verify the landing with a cross-instance diff.

```bash
# Export a completed update set (pipes to stdout if --out is omitted)
sn update-set export "My Change Set" -i dev --out /tmp/my-change.xml

# Or use the generic exporter for any table — same platform endpoint (`.do?UNL`)
sn export sys_update_set <sys_id> -i dev --out /tmp/my-change.xml
sn export oauth_entity <sys_id> -i dev > /tmp/my-oauth-app.xml
sn export sys_script_include --query "nameLIKEMyUtil" -i dev > /tmp/my-utils.xml

# Import in the target (SN UI: Retrieved Update Sets → Import Update Set from XML)
# Then preview + commit via SN's UI, or
sn update-set commit <remote-sys-id> -i test

# Verify what actually landed — field-level diff of the records you care about
sn diff dev test incident --query "priority=1" --fields "number,short_description,state"

# Portable records (script includes, business rules) have different sys_ids across
# instances — key on name instead:
sn diff dev test sys_script_include --key name --limit 50

# JSON output for machine consumption / CI gates
sn diff dev prod sys_script_include --key name -o json | jq '.counts'
```

`sn update-set export` also has a `--format json` mode that dumps the parent `sys_update_set` row plus every `sys_update_xml` child, useful for structural diffs / version control when you want to track a set's contents as code.

> **Why no `sn update-set import`?** SN has no clean REST endpoint for XML-upload — the SN-native pattern is cross-instance retrieval (configure one instance as an "Update Source" of another), which requires SN-side config. Queued for a future release once we confirm an approach that doesn't require per-instance setup.

### Use `sn` as an MCP server

Run the CLI as a Model Context Protocol server so Claude Desktop / Cursor / Claude Code agents can call every `sn` command as a tool — same auth, same multi-instance config, no duplicated implementation.

```bash
# Verify it boots and lists tools
sn mcp serve --allow-writes &
npx @modelcontextprotocol/inspector stdio sn mcp serve --allow-writes
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "servicenow": {
      "command": "sn",
      "args": ["mcp", "serve", "--allow-writes"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add servicenow -- sn mcp serve --allow-writes
```

### Tool naming

Every leaf becomes one MCP tool with a dot-separated name:

| Command | Tool |
|---|---|
| `sn incident list` | `incident.list` |
| `sn update-set export` | `update_set.export` |
| `sn codegen typescript` | `codegen.typescript` |

### Authorization tiers

- **default**: read-only. `list`, `get`, `query`, `export`, `diff`, `status`, `info`, `schema`, `search`, `aggregate`, `watch`, `tail`, all `codegen.*` and `completion.*`.
- **`--allow-writes`**: enables creates/updates/adds (`incident.create`, `update_set.create`, `edit`, `webhook.create`, `openapi.import`, ...).
- **`--allow-admin`**: enables destructive ops (`commit`, `delete`, `close`, `resolve`, `approve`, `reject`, `impersonate`, `run-script`). Implies `--allow-writes`.

Pick the lowest tier an agent actually needs. Writes are gated on purpose.

### Script sync

```bash
# Pull a record's script fields into ./sn-scripts/
sn script pull <sys_id> --table sys_script_include   # --table optional; inferred otherwise

# Edit locally in your editor
$EDITOR sn-scripts/myscript.js

# Push back
sn script push sn-scripts/myscript.js

# Or watch + auto-push (debounced fs.watch)
sn script watch sn-scripts/
```

Manifest lives at `./.sn-sync.json` in the working directory (one per project / scoped app). Multi-field records (widgets, UI pages) are pulled into a subdirectory with one file per field.

### Run background scripts

```bash
# Fire-and-forget
sn run-script --code "gs.info('hello from cli');"

# From file with auto-wait
sn run-script ./fix.js --wait 15

# From stdin
cat fix.js | sn run-script -
```

The script runs as a one-shot `sys_trigger` that auto-deletes itself after execution (`--no-auto-delete` to keep the record). `--wait <seconds>` polls the trigger's `state` field and exits when it transitions to `executed` (1) or `error` (2).

## Global flags

Available on every command (pass them after the subcommand name):

| Flag | Purpose |
|---|---|
| `-i, --instance <name>` | Target a specific instance |
| `-o, --output <json\|table\|csv\|yaml>` | Output format (TTY default: table, pipe default: json) |
| `--config <path>` | Explicit config path |
| `--fields <csv>` | Override columns in table output |
| `-q, --quiet` | Suppress INFO/WARN log lines |
| `--debug` | Enable DEBUG logging |
| `--no-color` | Disable ANSI colors |

Write commands (create/update/delete/close/resolve) additionally accept:

| Flag | Purpose |
|---|---|
| `--update-set <sys_id>` | Override current update-set for this call |
| `--scope <sys_id>` | Override current scope for this call |
| `--no-apply-state` | Don't apply any session state |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | ok |
| 1 | generic error |
| 2 | config error (missing, invalid) |
| 3 | auth error (HTTP 401) |
| 4 | not found (HTTP 404) |
| 5 | validation error (HTTP 400/409 or Zod) |
| 64 | user cancel |

## Auth

Both basic and OAuth 2.0 (password grant) are supported. Credentials live in `config.json` unencrypted — protect the file with filesystem permissions.

## Scripts

```bash
bun run dev           # run CLI in watch mode
bun run start         # run CLI once
bun test              # unit tests only
bun run typecheck     # tsc --noEmit
bun run build         # compile dist/sn single binary
RUN_INTEGRATION=1 bun test   # + integration tests against dev PDI
```

## Testing

Unit tests run offline. Integration tests are env-gated by `RUN_INTEGRATION=1` and hit a real ServiceNow developer instance (PDI). Config path defaults to `servicenow-mcp-server/config/servicenow-config.json`; override with `SN_TEST_CONFIG` and/or `SN_TEST_INSTANCE`.

The composite `tests/integration/phase2-smoke.test.ts` walks the full platform-dev workflow in one shot: update-set create + use → business-rule create → script pull/push → run-script with wait → commit → schema lookup. Use it as a regression check after touching any Phase 2 code.

## License

See LICENSE.
