# servicenow-cli

`sn` — command-line interface for ServiceNow. Multi-instance, multi-module, feature-parity with [servicenow-mcp-server](../servicenow-mcp-server).

## Status

Phase 1 (MVP). Covers:

- `sn instance` — list, use, info, add, remove, current
- `sn incident` — list, get, create, update, resolve, close, reopen, comment, work-note
- `sn change` — list, get, create, update, submit-approval, approve, reject, add-task, comment, work-note
- `sn user` — list, get, create, update
- `sn group` — list, create, update, add-members, remove-members
- `sn search` — natural-language → encoded query
- `sn table` — generic Table API (query/get/create/update/delete) — escape hatch for any table not yet wrapped

Phase 2 (update sets, script sync, background scripts, schema discovery) and Phase 3 (KB, catalog, workflows, CMDB, agile, batch, completions) to follow — tracked in [todo.md](./todo.md).

## Install

```bash
bun install
# (optional) compile single binary
bun run build   # → dist/sn
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
  "color": "auto"
}
```

Config discovery order:
1. `--config <path>` (explicit)
2. `./servicenow-cli.config.json` (project-local)
3. `$XDG_CONFIG_HOME/servicenow-cli/config.json` (default `~/.config/servicenow-cli/config.json`)

## Examples

```bash
sn instance list
sn instance use dev

sn incident list --state 2 --priority 1
sn incident get INC0012345
sn incident create --short-desc "Printer jam" --urgency 2
sn incident comment INC0012345 "checking with vendor"
sn incident resolve INC0012345 --code "Solved (Permanently)" --notes "replaced toner"

sn change list --type normal --state open
sn change approve CHG0001234 --comments "LGTM"

sn user list --active --role admin
sn group add-members "Network" --users "alice,bob@example.com"

sn search "high priority incidents assigned to admin"
sn search "emergency changes this week"

sn table query sys_user --query "active=true" --sn-fields user_name,email --limit 5
sn table get incident abc123...
sn table create incident --data '{"short_description":"Test"}'
sn table update incident abc123... --set priority=1,state=2
sn table delete incident abc123... --force
```

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
bun run dev           # run CLI in watch mode (via bun run)
bun run start         # run CLI once
bun test              # unit tests
bun run typecheck     # tsc --noEmit
bun run build         # compile dist/sn single binary
```

## License

See LICENSE (TBD — defaults to the same license as servicenow-mcp-server).
