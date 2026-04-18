import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";

interface Issue {
  severity: "error" | "warning";
  message: string;
}

export default defineLeaf({
  meta: {
    name: "validate",
    description: "Lint a catalog item for common issues (missing desc, no vars, etc.)",
  },
  args: { id: { type: "positional", description: "Catalog item sys_id", required: true } },
  async run(ctx, args) {
    const client = ctx.client();
    const sysId = args.id as string;
    const [item, varsResult] = await Promise.all([
      client.getRecord("sc_cat_item", sysId, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("item_option_new", {
        sysparm_query: `cat_item=${sysId}^ORDERBYorder`,
        sysparm_fields: "sys_id,name,question_text,type,mandatory,default_value,order,active",
        sysparm_limit: 200,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);

    const variables = varsResult.records;
    const issues: Issue[] = [];
    const isFalsy = (v: unknown) =>
      v === undefined || v === null || (typeof v === "string" && v.trim() === "");

    if (isFalsy(item["short_description"])) {
      issues.push({ severity: "error", message: "Missing short_description" });
    }
    if (isFalsy(item["description"])) {
      issues.push({
        severity: "warning",
        message: "Missing detailed description",
      });
    }
    if (isFalsy(item["category"])) {
      issues.push({ severity: "warning", message: "No category assigned" });
    }
    if (item["active"] === "false" || item["active"] === false) {
      issues.push({ severity: "warning", message: "Item is inactive" });
    }
    if (variables.length === 0) {
      issues.push({ severity: "warning", message: "No variables defined" });
    }

    for (const v of variables) {
      if (v["mandatory"] === "true" || v["mandatory"] === true) {
        if (isFalsy(v["default_value"])) {
          issues.push({
            severity: "warning",
            message: `Mandatory variable "${v["name"]}" has no default value`,
          });
        }
      }
    }

    const inactiveVars = variables.filter(
      (v) => v["active"] === "false" || v["active"] === false
    );
    if (inactiveVars.length > 0) {
      issues.push({
        severity: "warning",
        message: `${inactiveVars.length} inactive variable(s) found`,
      });
    }

    if (!item["price"] || item["price"] === "0" || item["price"] === "$0.00") {
      issues.push({ severity: "warning", message: "No price set" });
    }

    const varNames = variables.map((v) => v["name"] as string).filter(Boolean);
    const dupes = varNames.filter((n, i) => varNames.indexOf(n) !== i);
    if (dupes.length > 0) {
      issues.push({
        severity: "error",
        message: `Duplicate variable names: ${[...new Set(dupes)].join(", ")}`,
      });
    }

    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;

    output(
      ctx,
      {
        valid: errors === 0,
        errors,
        warnings,
        issues,
        item_name: item["name"],
        item_sys_id: sysId,
        variable_count: variables.length,
      },
      { single: true }
    );
  },
});
