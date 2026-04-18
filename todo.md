# servicenow-cli — TODO

Tracks feature work by phase. Check each item as it's shipped.

## Phase 1: MVP (shipped)

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
- [x] Global flag plumbing

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
- [x] End-to-end PDI smoke test (`tests/integration/incident-lifecycle.test.ts`)

## Phase 2: Platform Developer Loop (shipped)

### Shared infrastructure
- [x] `src/utils/state.ts` — per-instance sidecar state (`~/.config/servicenow-cli/state/<instance>.json`)
- [x] `src/utils/apply-session-state.ts` — best-effort session binding (sys_user_preference + concoursepicker)
- [x] `src/commands/_script-crud.ts` — parameterized CRUD factory for 6 script domains
- [x] `src/utils/script-map.ts` — SCRIPT_FIELD_MAP + fieldExtension + safeName
- [x] `src/utils/trigger-poll.ts` — run-script --wait

### Commands
- [x] `update-set` — list, get, create, update, use, current, commit, clone, add, move
- [x] `scope` — current, set
- [x] `script` — pull, push, watch (fs.watch, 300ms debounce)
- [x] `run-script` — background script via sys_trigger (optional --wait)
- [x] `script-include`, `business-rule`, `client-script`, `ui-policy`, `ui-action`, `ui-script` (list/get/create/update/delete each, via factory)
- [x] `schema` — tables, discover, field
- [x] `problem` — list, get, create, update, close, comment, work-note
- [x] `request` — list, get, submit (custom `/order_now` endpoint)
- [x] `ritm` — list, get, update

### Phase 2 exit criteria
- [x] Help text for every new leaf
- [x] Unit tests pass (`bun test` — 56 tests)
- [x] Integration tests pass on dev PDI (`RUN_INTEGRATION=1 bun test` — 9 tests)
- [x] README updated: update-set workflow, script sync workflow, run-script examples, caveats
- [x] Composite `tests/integration/phase2-smoke.test.ts` walks full platform-dev flow

### Known limitations (documented in README)
- **Update-set binding via REST is best-effort.** SN's per-user-session mechanism doesn't consistently honour the preference flip on stateless Basic-Auth writes.
- **Sidecar state races** when parallel invocations target the same instance. Prefer `--update-set` / `--scope` flags in automation.

## Phase 3: Full parity & polish

- [ ] `kb` — base-create, category-create, article-list, article-get, article-create, article-update, article-publish
- [ ] `catalog` — list, items, item-get, variables, category-create, category-update, move-items, validate, recommend
- [ ] `workflow` — list, get, create, create-full, publish, delete, activity-add, transition-add
- [ ] `flow` — list, get, create, stages, variables, variable-add
- [ ] `rest-api` — list, get, create, update, resource-create/update/delete
- [ ] `widget`, `ui-page` — list, get, create, update, delete
- [ ] `story`, `epic`, `task`, `project` (agile) — list, create, update
- [ ] `ci` (CMDB) — list, get, create, relationships, relate
- [ ] `attachment` — list, get, upload
- [ ] `batch` — create, update, delete (parallel ops with progress)
- [ ] `aggregate` — count/sum/avg/min/max
- [ ] `import` — set-create, transform
- [ ] CSV + YAML formatters
- [ ] Shell completions (`sn completion bash|zsh|fish`)
- [ ] Single-binary release pipeline (linux-x64, darwin-arm64, darwin-x64)
- [ ] Man page

## Cross-cutting (ongoing)

- [ ] Suppress ERROR log in client during expected 404s (e.g. `trigger-poll` seeing auto-deleted triggers)
- [ ] Integration test parallelism — consider running files sequentially to avoid sidecar races
- [ ] Secret storage (macOS keychain / libsecret) instead of plaintext passwords
