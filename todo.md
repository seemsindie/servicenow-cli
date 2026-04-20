# servicenow-cli — TODO

Tracks feature work by phase.

## Phase 1: MVP (shipped, v0.1.0)

- [x] Infrastructure: package.json, tsconfig, bin/sn, constants, auth/client/utils port, config loader (XDG), CliContext, middleware, formatters (table, json), instance wizard, citty tree
- [x] Commands: instance, incident, change, user, group, search, table
- [x] Unit tests + README
- [x] `tests/integration/incident-lifecycle.test.ts`

## Phase 2: Platform Developer Loop (shipped, v0.2.0)

- [x] Shared: `state.ts` (sidecar), `apply-session-state.ts`, `_script-crud.ts` factory, `script-map.ts`, `trigger-poll.ts`
- [x] Commands: update-set, scope, script (pull/push/watch), run-script, business-rule, client-script, ui-policy, ui-action, ui-script, script-include, schema, problem, request, ritm
- [x] Integration tests: schema, problem, run-script, script-sync, phase2-smoke composite
- [x] README updated

## Phase 3: Full parity & polish (shipped, v0.3.0)

### Shared infrastructure
- [x] `_domain-crud.ts` — generic CRUD factory (generalised from `_script-crud.ts`)
- [x] `_script-crud.ts` — back-compat alias over `_domain-crud.ts`
- [x] `workflow-yaml.ts` — YAML parser + Zod schema for `workflow create-full`
- [x] `binary-upload.ts` — multipart file upload for attachments
- [x] `resolve-ci.ts` — cmdb_rel_type name → sys_id resolver
- [x] `client.requestBinary` — raw body uploads
- [x] `client.request({ expect404 })` — suppress expected-404 ERROR log (used by trigger-poll)

### Commands
- [x] kb — list, base-create, category-create, article-{list,get,create,update,publish}
- [x] catalog — list, item {list, get, update, move, validate, recommend, variable {list, create, update}}, category {list, create, update}
- [x] workflow — list, get, create, update, delete, activity-add, transition-add, publish, create-full (YAML)
- [x] flow — list, get, create, variables, variable-add, stages
- [x] rest-api — list, get, create, update + resource {create, update, delete}
- [x] widget — list, get, create, update, delete (via factory, fileArgs for all script fields)
- [x] ui-page — list, get, create, update, delete (via factory, fileArgs for html/client-script/processing-script)
- [x] story, epic, task, project — list, get, create, update, delete (each, via factory)
- [x] ci — list, get, create, relationships, relate
- [x] attachment — list, get, upload
- [x] batch — create, update, delete (sequential default, --parallel)
- [x] aggregate — single leaf, /api/now/stats/<table>
- [x] import-set — create, run-transform
- [x] completion — bash, zsh, fish

### Polish
- [x] CSV + YAML formatters (with unit tests)
- [x] `formatters/index.ts` dispatch to csv/yaml
- [x] man/sn.1 roff page
- [x] `scripts/build-release.sh` (linux-x64, darwin-arm64, darwin-x64)
- [x] `.github/workflows/release.yml` (fires on `v*` tag push)

### Phase 3 exit criteria
- [x] `bun run typecheck` clean
- [x] `bun test` — all unit tests pass (63 of 72, 9 env-gated integration tests skipped)
- [x] Compiled binaries for 3 targets produced locally
- [x] Bash completion script sources without errors (`bash -n`)
- [x] README updated with new command sections
- [ ] v0.3.0 tag + GitHub Release (push tag to trigger release.yml)

## Known limitations (documented in README / per-command help)

- **Update-set binding via stateless Basic-Auth REST is best-effort.** SN's per-user-session mechanism doesn't reliably honour the sys_user_preference flip. Prefer setting in the browser first, or attach via `sn update-set add`.
- **Sidecar state races** when parallel invocations target the same instance. Use `--update-set`/`--scope` in automation.
- **Flow Designer logic blocks are UI-only** — REST only supports basic flow skeleton + variables/stages.
- **CI relationships** accept either a `cmdb_rel_type` sys_id or an exact name (e.g. "Parent of") — resolved by `resolve-ci.ts`.

## Phase 4: build-on-SN toolkit (shipped, v0.4.0)

Reframed around **developers using SN as a backend for their own apps/services**, not admins. Competitive survey (pysnow, aiosnow, PySNC, servicenow-rest-api, @servicenow/sdk) confirmed none of these gaps were filled well for external consumers.

- [x] `sn codegen typescript <table>` — live-schema TS codegen: interface + choice unions + reference annotations, walks super_class chain
- [x] `sn log tail [--follow]` — stream `syslog` with level/source/message filters, color-coded
- [x] `sn watch <table> [--follow] [--since] [--once]` — JSONL stream of new/updated records, pipeable to jq/slack/anything
- [x] README section "Using ServiceNow as a backend for your own app"

## Phase 5 ideas (not committed)

- [ ] `sn auth login` — OAuth Auth-Code + PKCE helper (local loopback, keyring storage)
- [ ] `sn impersonate <user> -- <cmd>` — scoped impersonation for sub-commands
- [ ] `sn rest-api scaffold --from openapi.yaml` — generate Scripted REST APIs from OpenAPI
- [ ] `sn webhook create` — Business Rule + REST Message + retry in one command
- [ ] `sn codegen python` / `sn codegen go` — same codegen for other target languages
- [ ] OS keyring secret storage (macOS Keychain, libsecret, Windows credman)
- [ ] AMB record-watcher (websocket-native) — replaces polling in `sn watch`
- [ ] Integration tests covering each Phase 3 + 4 domain
- [ ] Interactive TUI mode for `sn incident list` — live refresh, keyboard shortcuts
- [ ] `sn edit <domain> <id>` — open $EDITOR on relevant fields, diff-apply on save
- [ ] Approvals workflow UI (`sn change pending-approvals --mine`)
