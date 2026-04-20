import { defineCommand } from "citty";
import login from "./login.ts";
import logout from "./logout.ts";
import status from "./status.ts";

export default defineCommand({
  meta: { name: "auth", description: "OAuth 2.0 Authorization Code login + token management" },
  subCommands: { login, logout, status },
});
