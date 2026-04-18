/**
 * Back-compat alias over `_domain-crud.ts`. The original script-crud factory was
 * generalised in Phase 3 to also serve non-script domains (agile, CI, etc.); this
 * file remains as the entry point for the six script-bearing domains so their
 * existing index.ts files don't need to change.
 *
 * New code should import from `./_domain-crud.ts` directly.
 */

export {
  defineDomainCrud as defineScriptCrud,
  composeDomainCrudCommand as composeScriptCrudCommand,
  type DomainCrudConfig as ScriptCrudConfig,
} from "./_domain-crud.ts";
