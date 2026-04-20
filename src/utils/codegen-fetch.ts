/**
 * Shared data-fetch layer for the codegen emitters (typescript / python / go).
 *
 * Walks the `super_class` chain of the root table, pulls sys_dictionary + sys_choice
 * for every ancestor, merges choices to prefer the most-specific definition, and
 * returns a normalised record bundle each emitter can consume purely.
 */

import type { ServiceNowClient } from "../client/index.ts";
import type { DictEntry, ChoiceEntry } from "./codegen-ts.ts";

export interface CodegenData {
  table: string;
  tableLabel?: string;
  instanceUrl: string;
  dictionary: DictEntry[];
  /** Keyed by column name. Values are the active choices defined on the most-specific ancestor. */
  choices: Map<string, ChoiceEntry[]>;
  /** Inheritance chain, leaf → root. E.g. ["incident", "task"]. */
  ancestors: string[];
}

export interface FetchOptions {
  /** Walk the super_class chain (default: true). */
  includeParent?: boolean;
}

export async function fetchCodegenData(
  client: ServiceNowClient,
  instanceUrl: string,
  table: string,
  opts: FetchOptions = {}
): Promise<CodegenData> {
  const includeParent = opts.includeParent !== false;

  // 1. Walk super_class chain
  const ancestors: string[] = [table];
  if (includeParent) {
    let current = table;
    for (let i = 0; i < 10; i++) {
      const parent = await fetchParent(client, current);
      if (!parent || parent === current) break;
      ancestors.push(parent);
      current = parent;
    }
  }

  // 2. Fetch dictionary for all ancestors in one query
  const dictQuery = ancestors.map((t) => `name=${t}`).join("^OR");
  const dictResult = await client.queryTable("sys_dictionary", {
    sysparm_query: `${dictQuery}^elementISNOTEMPTY^ORDERBYelement`,
    sysparm_fields:
      "name,element,column_label,internal_type,max_length,mandatory,reference,default_value,active,read_only",
    sysparm_limit: 2000,
    // Raw values — reference needs to be the target table name, not a display label.
    sysparm_display_value: "false",
    sysparm_exclude_reference_link: "true",
  });
  const dictionary = dictResult.records as unknown as DictEntry[];

  // 3. Fetch choices; prefer the most-specific ancestor's definitions
  const choiceResult = await client.queryTable("sys_choice", {
    sysparm_query: `${dictQuery}^ORDERBYelement^ORDERBYsequence`,
    sysparm_fields: "name,element,label,value,sequence,inactive",
    sysparm_limit: 5000,
    sysparm_display_value: "true",
    sysparm_exclude_reference_link: "true",
  });
  const allChoices = choiceResult.records as unknown as ChoiceEntry[];

  const choices = new Map<string, ChoiceEntry[]>();
  const specificity = new Map<string, number>();
  for (const c of allChoices) {
    if (!c.element || !c.value) continue;
    const idx = ancestors.indexOf(c.name);
    if (idx < 0) continue;
    const existing = specificity.get(c.element);
    if (existing === undefined || idx < existing) {
      specificity.set(c.element, idx);
      choices.set(c.element, [c]);
    } else if (idx === existing) {
      choices.get(c.element)!.push(c);
    }
  }

  // 4. Root table's label for generated-file header
  const tableLabel = await fetchTableLabel(client, table);

  return { table, tableLabel, instanceUrl, dictionary, choices, ancestors };
}

async function fetchParent(client: ServiceNowClient, table: string): Promise<string | null> {
  const result = await client.queryTable("sys_db_object", {
    sysparm_query: `name=${table}`,
    sysparm_fields: "super_class",
    sysparm_limit: 1,
    sysparm_display_value: "true",
    sysparm_exclude_reference_link: "true",
  });
  const row = result.records[0];
  if (!row) return null;
  const sc = row["super_class"];
  if (typeof sc === "string" && sc.length > 0) return sc;
  return null;
}

async function fetchTableLabel(
  client: ServiceNowClient,
  table: string
): Promise<string | undefined> {
  try {
    const result = await client.queryTable("sys_db_object", {
      sysparm_query: `name=${table}`,
      sysparm_fields: "label",
      sysparm_limit: 1,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    const row = result.records[0];
    return typeof row?.["label"] === "string" ? row["label"] : undefined;
  } catch {
    return undefined;
  }
}
