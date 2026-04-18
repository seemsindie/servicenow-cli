# servicenow-cli

[![npm](https://img.shields.io/npm/v/@seemsindie/servicenow-cli.svg)](https://www.npmjs.com/package/@seemsindie/servicenow-cli)
[![release](https://img.shields.io/github/v/release/seemsindie/servicenow-cli?include_prereleases)](https://github.com/seemsindie/servicenow-cli/releases)

`sn` — command-line interface for ServiceNow. Multi-instance, multi-module, feature-parity with [servicenow-mcp-server](../servicenow-mcp-server).

## Status

Phase 3 shipped (v0.3.0). Full parity with [servicenow-mcp-server](../servicenow-mcp-server) across 35 top-level command domains.

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

## Update-set workflow

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

## Script sync workflow

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

## Running background scripts

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
