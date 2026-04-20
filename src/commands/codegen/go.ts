import { defineLeaf } from "../_leaf.ts";
import { writeFileSync } from "fs";
import { fetchCodegenData } from "../../utils/codegen-fetch.ts";
import { generateGo } from "../../utils/codegen-go.ts";

export default defineLeaf({
  meta: {
    name: "go",
    description: "Emit a Go struct + typed string constants for a SN table",
  },
  args: {
    table: { type: "positional", description: "Table name", required: true },
    "out-file": { type: "string", description: "Write to file (default: stdout)" },
    package: { type: "string", description: "Go package name (default: servicenow)" },
    "no-parent": { type: "boolean", description: "Skip super_class chain" },
    "no-system": { type: "boolean", description: "Skip system fields (sys_*)" },
    "include-inactive": { type: "boolean" },
  },
  async run(ctx, args) {
    const data = await fetchCodegenData(
      ctx.client(),
      instanceUrl(ctx),
      args.table as string,
      { includeParent: !args["no-parent"] }
    );
    const code = generateGo(data, {
      packageName: (args.package as string | undefined) || "servicenow",
      includeSystem: !args["no-system"],
      skipInactive: !args["include-inactive"],
    });
    const outPath = args["out-file"] as string | undefined;
    if (outPath) {
      writeFileSync(outPath, code, "utf-8");
      process.stderr.write(`→ wrote ${code.length} bytes to ${outPath}\n`);
    } else {
      process.stdout.write(code);
    }
  },
});

function instanceUrl(ctx: {
  registry: { getInstanceInfo: (name?: string) => { url: string } };
  flags: { instance?: string };
}): string {
  try {
    return ctx.registry.getInstanceInfo(ctx.flags.instance).url;
  } catch {
    return "";
  }
}
