import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { uploadAttachment } from "../../utils/binary-upload.ts";

export default defineLeaf({
  meta: { name: "upload", description: "Upload a local file to a record" },
  args: {
    table: { type: "positional", description: "Parent table name", required: true },
    "sys-id": {
      type: "positional",
      description: "Parent record sys_id",
      required: true,
    },
    file: {
      type: "positional",
      description: "Local file path",
      required: true,
    },
    "file-name": {
      type: "string",
      description: "Override file name (default: basename of file)",
    },
    "content-type": {
      type: "string",
      description: "Override content type (default: inferred from extension)",
    },
  },
  async run(ctx, args) {
    const result = await uploadAttachment(ctx.client(), {
      table: args.table as string,
      sysId: args["sys-id"] as string,
      filePath: args.file as string,
      fileName: args["file-name"] as string | undefined,
      contentType: args["content-type"] as string | undefined,
    });
    output(ctx, result as unknown as Record<string, unknown>, { single: true });
  },
});
