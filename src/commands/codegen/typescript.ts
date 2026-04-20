import { defineLeaf } from "../_leaf.ts";
import { writeFileSync } from "fs";
import {
  generateTypeScript,
  type DictEntry,
  type ChoiceEntry,
} from "../../utils/codegen-ts.ts";
import type { ServiceNowClient } from "../../client/index.ts";

export default defineLeaf({
  meta: {
    name: "typescript",
    description: "Emit a TypeScript interface for a SN table (from sys_dictionary + sys_choice)",
  },
  args: {
    table: {
      type: "positional",
      description: "Table name (e.g. incident, sys_user, cmdb_ci_server)",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Write to file (default: stdout)",
    },
    "no-parent": {
      type: "boolean",
      description: "Skip walking super_class chain (omit inherited fields)",
    },
    "no-system": {
      type: "boolean",
      description: "Skip system fields (sys_id, sys_created_on, sys_mod_count, ...)",
    },
    "include-inactive": {
      type: "boolean",
      description: "Include inactive dictionary entries (default: skip)",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const table = args.table as string;
    const includeParent = !args["no-parent"];
    const includeSystem = !args["no-system"];
    const skipInactive = !args["include-inactive"];

    // 1. Walk super_class chain to collect ancestors
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

    // 2. Fetch dictionary for all ancestors in one go
    const dictQuery = ancestors
      .map((t) => `name=${t}`)
      .join("^OR");
    const dictResult = await client.queryTable("sys_dictionary", {
      sysparm_query: `${dictQuery}^elementISNOTEMPTY^ORDERBYelement`,
      sysparm_fields:
        "name,element,column_label,internal_type,max_length,mandatory,reference,default_value,active,read_only",
      sysparm_limit: 2000,
      // Raw values — we need `reference` to be the target table name, not a display label.
      sysparm_display_value: "false",
      sysparm_exclude_reference_link: "true",
    });
    const dictionary = dictResult.records as unknown as DictEntry[];

    // 3. Fetch choices for any column on any ancestor
    const choiceResult = await client.queryTable("sys_choice", {
      sysparm_query: `${dictQuery}^ORDERBYelement^ORDERBYsequence`,
      sysparm_fields: "name,element,label,value,sequence,inactive",
      sysparm_limit: 5000,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    const allChoices = choiceResult.records as unknown as ChoiceEntry[];

    // Group choices by column. Prefer choices defined on the most-specific ancestor
    // (e.g. incident.state choices override task.state).
    const choices = new Map<string, ChoiceEntry[]>();
    const specificity = new Map<string, number>(); // element → ancestor index (0 = leaf)
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

    // 4. Fetch the label of the root table for JSDoc
    const tableLabel = await fetchTableLabel(client, table);

    const code = generateTypeScript({
      table,
      tableLabel,
      instanceUrl: instanceUrl(ctx),
      dictionary,
      choices,
      ancestors,
      includeSystem,
      skipInactive,
    });

    if (args.output) {
      writeFileSync(args.output as string, code, "utf-8");
      process.stderr.write(`→ wrote ${code.length} bytes to ${args.output}\n`);
    } else {
      process.stdout.write(code);
    }
  },
});

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

async function fetchTableLabel(client: ServiceNowClient, table: string): Promise<string | undefined> {
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

function instanceUrl(ctx: { registry: { getInstanceInfo: (name?: string) => { url: string } }; flags: { instance?: string } }): string {
  try {
    return ctx.registry.getInstanceInfo(ctx.flags.instance).url;
  } catch {
    return "";
  }
}
