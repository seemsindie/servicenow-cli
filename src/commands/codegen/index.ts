import { defineCommand } from "citty";
import typescript from "./typescript.ts";
import python from "./python.ts";
import go from "./go.ts";

export default defineCommand({
  meta: {
    name: "codegen",
    description:
      "Generate type-safe client code from live ServiceNow schema (dictionary + choices)",
  },
  subCommands: { typescript, python, go },
});
