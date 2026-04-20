import { defineCommand } from "citty";
import typescript from "./typescript.ts";

export default defineCommand({
  meta: {
    name: "codegen",
    description:
      "Generate type-safe client code from live ServiceNow schema (dictionary + choices)",
  },
  subCommands: { typescript },
});
