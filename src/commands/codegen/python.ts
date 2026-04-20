import { defineLeaf } from "../_leaf.ts";
import { writeFileSync } from "fs";
import { fetchCodegenData } from "../../utils/codegen-fetch.ts";
import { generatePython } from "../../utils/codegen-python.ts";

export default defineLeaf({
  meta: {
    name: "python",
    description: "Emit Pydantic v2 models + Enum classes for a SN table",
  },
  args: {
    table: { type: "positional", description: "Table name", required: true },
    "out-file": { type: "string", description: "Write to file (default: stdout)" },
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
    const code = generatePython(data, {
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
