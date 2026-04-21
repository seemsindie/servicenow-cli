import { defineCommand } from "citty";
import login from "./login.ts";
import logout from "./logout.ts";
import status from "./status.ts";
import sessionLogin from "./session-login.ts";
import sessionLogout from "./session-logout.ts";

export default defineCommand({
  meta: { name: "auth", description: "OAuth 2.0 Authorization Code login + form-session escape hatch" },
  subCommands: {
    login,
    logout,
    status,
    "session-login": sessionLogin,
    "session-logout": sessionLogout,
  },
});
