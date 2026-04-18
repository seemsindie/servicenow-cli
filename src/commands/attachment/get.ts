import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { writeFileSync } from "fs";

export default defineLeaf({
  meta: {
    name: "get",
    description: "Get attachment metadata; optionally download bytes to a file",
  },
  args: {
    id: { type: "positional", description: "Attachment sys_id", required: true },
    download: {
      type: "string",
      description: "Local path to write the attachment bytes (binary-safe)",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const sysId = args.id as string;
    const meta = await client.getRecord("sys_attachment", sysId, {
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });

    if (args.download) {
      const response = await client.requestRaw("GET", `/api/now/attachment/${sysId}/file`);
      const buf = Buffer.from(await response.arrayBuffer());
      writeFileSync(args.download as string, buf);
      process.stderr.write(`→ wrote ${buf.length} bytes to ${args.download}\n`);
    }

    output(ctx, meta, { single: true });
  },
});
