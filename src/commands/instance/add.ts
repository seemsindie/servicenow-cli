import { defineLeaf } from "../_leaf.ts";
import { runInstanceWizard } from "../../prompts/instance-wizard.ts";

export default defineLeaf({
  meta: {
    name: "add",
    description: "Add a new ServiceNow instance (interactive)",
  },
  requiresConfig: false,
  async run() {
    const path = await runInstanceWizard();
    if (!path) {
      process.exit(64);
    }
  },
});
