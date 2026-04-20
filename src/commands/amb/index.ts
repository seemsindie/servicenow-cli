import { defineCommand } from "citty";
import subscribe from "./subscribe.ts";
import publish from "./publish.ts";
import installPublisher from "./install-publisher.ts";

export default defineCommand({
  meta: {
    name: "amb",
    description:
      "ServiceNow Asynchronous Message Bus (AMB / CometD) — subscribe, publish, install SN-side publisher.",
  },
  subCommands: {
    subscribe,
    publish,
    "install-publisher": installPublisher,
  },
});
