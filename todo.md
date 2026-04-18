# servicenow-cli — TODO

Tracks feature work by phase. Check each item as it's shipped.

## Phase 1: MVP

### Infrastructure
- [x] `package.json`, `tsconfig.json`, `bin/sn`, `.gitignore`
- [x] `constants.ts` (BIN_NAME single source)
- [x] Port `auth/`, `client/`, `utils/` from MCP server
- [x] `config.ts` (XDG discovery + Zod)
- [x] `context.ts` (CliContext)
- [x] Middleware: error-handler, stdin
- [x] Formatters: table, json, field-presets, colorize
- [x] Spinner util
- [x] Interactive instance wizard (first-run bootstrap)
- [x] `cli.ts` + `commands/index.ts` (citty tree)
- [x] Global flag plumbing (`--instance`, `--output`, `--config`, `--fields`, `--quiet`, `--debug`, `--no-color`)

### Commands
- [x] `instance` — list, use, info, add, remove, current
- [x] `incident` — list, get, create, update, resolve, close, reopen, comment, work-note
- [x] `change` — list, get, create, update, submit-approval, approve, reject, add-task, comment, work-note
- [x] `user` — list, get, create, update
- [x] `group` — list, create, update, add-members, remove-members
- [x] `search` — natural-language query
- [x] `table` — query, get, create, update, delete

### Phase 1 exit criteria
- [x] Help text renders for every leaf command
- [x] Unit tests for formatters, resolvers, config loader, error handler, NL search
- [x] README with quick start
- [x] End-to-end PDI smoke test (create → get → update → resolve real INC) — `tests/integration/incident-lifecycle.test.ts`, run with `RUN_INTEGRATION=1`

## Phase 2: Platform Dev

- [ ] `update-set` — list, get, create, update, use, commit, clone, add, move
- [ ] `scope` — current, set
- [ ] `script` — pull, push, watch (script sync with `.sn-sync.json` manifest)
- [ ] `run-script` — background script exec (file / `-` stdin / `-c` inline)
- [ ] `script-include` — list, get, create, update, delete
- [ ] `business-rule` — list, get, create, update, delete
- [ ] `client-script` — list, get, create, update, delete
- [ ] `ui-policy` — list, get, create, update, delete
- [ ] `ui-action` — list, get, create, update, delete
- [ ] `ui-script` — list, get, create, update, delete
- [ ] `schema` — tables, discover `<table>`, field `<table> <field>`, explain-field
- [ ] `problem` — list, get, create, update, close, comment, work-note
- [ ] `request` — list, get, submit
- [ ] `ritm` — list, get, update

## Phase 3: Full Parity & Polish

- [ ] `kb` — base-create, category-create, article-list, article-get, article-create, article-update, article-publish
- [ ] `catalog` — list, items, item-get, variables, category-create, category-update, move-items, validate, recommend
- [ ] `workflow` — list, get, create, create-full, publish, delete, activity-add, transition-add
- [ ] `flow` — list, get, create, stages, variables, variable-add
- [ ] `rest-api` — list, get, create, update, resource-create, resource-update, resource-delete
- [ ] `widget` — list, get, create, update, delete
- [ ] `ui-page` — list, get, create, update, delete
- [ ] `story`, `epic`, `task`, `project` (agile) — list, create, update
- [ ] `ci` (CMDB) — list, get, create, relationships, relate
- [ ] `attachment` — list, get, upload
- [ ] `batch` — create, update, delete (parallel ops with progress)
- [ ] `aggregate` — count/sum/avg/min/max across tables
- [ ] `import` — set-create, transform
- [ ] CSV + YAML formatters
- [ ] Shell completions (bash / zsh / fish) — `sn completion <shell>`
- [ ] Single-binary release pipeline (linux-x64, darwin-arm64, darwin-x64)
- [ ] Man page (`sn(1)`)
- [ ] Full README with example per command

## Cross-cutting (ongoing)

- [ ] Unit test per new command module
- [ ] Integration tests (env-gated via `SN_TEST_INSTANCE`, `SN_TEST_USER`, `SN_TEST_PASS`)
- [ ] Error message quality pass (ensure every thrown Error reads well in the terminal)
- [ ] Review `citty`'s TTY detection — currently relying on `process.stdout.isTTY` alone
- [ ] Explore secret storage (macOS keychain / `gnome-libsecret`) instead of plaintext passwords

## Known quirks

- Global flags (`--config`, `-i`, etc.) must follow the subcommand name because citty parses args on the leaf command only (e.g. `sn instance list --config ...`, not `sn --config ... instance list`).
