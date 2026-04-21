import { defineLeaf } from "../_leaf.ts";
import { readFileSync } from "fs";
import { basename } from "path";
import { resolveInput } from "../../middleware/stdin.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "import",
    description:
      "Upload a previously-exported update-set XML as a Retrieved Update Set. Requires `sn auth session-login` first — SN's XML import endpoint is web-session gated.",
  },
  args: {
    file: {
      type: "positional",
      required: true,
      description: "Path to the XML file produced by `sn update-set export` (or '-' for stdin)",
    },
    name: {
      type: "string",
      description: "Override the upload filename sent to SN (defaults to the input path's basename)",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const filePath = args.file as string;

    const xmlBody =
      filePath === "-" ? await resolveInput("-") : readFileSync(filePath, "utf-8");

    if (!xmlBody.trim().startsWith("<?xml") && !xmlBody.trim().startsWith("<unload")) {
      throw new Error(
        `File doesn't look like an SN update-set XML (expected <?xml ...?> or <unload ...>): ${filePath}`
      );
    }

    const filename = (args.name as string | undefined) ?? basename(filePath === "-" ? "stdin.xml" : filePath);

    // Build multipart form — the exact shape SN's /sys_upload.do expects.
    // sysparm_ck is scraped from the Import Update Set from XML page; it's
    // the same token as window.g_ck / X-UserToken (requestWithSession reads
    // it from the stashed session automatically, but sys_upload.do needs
    // it in the form body too).
    const session = await loadSessionCookieForForm(instanceName);

    const form = new FormData();
    form.append("sysparm_ck", session.x_user_token ?? "");
    form.append("sysparm_upload_prefix", "");
    form.append("sysparm_referring_url", "sys_remote_update_set_list.do");
    form.append("sysparm_target", "sys_remote_update_set");
    form.append(
      "attachFile",
      new Blob([xmlBody], { type: "text/xml" }),
      filename
    );

    // POST; SN returns 302 on success. Don't follow — we don't need to
    // render the HTML form page. Just detect success.
    const resp = await client.requestWithSession("POST", "/sys_upload.do", {
      instanceName,
      body: form,
      followRedirects: false,
    });

    const ok = resp.status === 302 || resp.status === 200;
    if (!ok) {
      const text = await resp.text();
      throw new Error(
        `/sys_upload.do returned ${resp.status}: ${text.slice(0, 300)}`
      );
    }

    // Find the newly-created Retrieved Update Set by parsing the set's
    // name out of the XML. Real exports wrap the set in <sys_update_set>;
    // Retrieved-Update-Set-shaped XML wraps in <sys_remote_update_set>.
    // Accept either.
    const nameMatch =
      /<sys_(?:remote_)?update_set[^>]*>[\s\S]*?<name>\s*([^<]+?)\s*<\/name>/i.exec(
        xmlBody
      );
    const setName = nameMatch?.[1]?.trim();

    let remoteSysId: string | undefined;
    let actualName = setName;
    let actualState: string | undefined;
    if (setName) {
      try {
        const q = await client.queryTable("sys_remote_update_set", {
          sysparm_query: `name=${setName}^ORDERBYDESCsys_created_on`,
          sysparm_fields: "sys_id,name,state,description",
          sysparm_limit: 1,
        });
        const rec = q.records[0];
        if (rec) {
          remoteSysId = rec["sys_id"] as string;
          actualName = rec["name"] as string;
          actualState = rec["state"] as string;
        }
      } catch {
        // Non-fatal: the import succeeded (we got 302), we just can't
        // echo back the sys_id. User can find it in the UI.
      }
    }

    output(
      ctx,
      {
        imported: true,
        remote_sys_id: remoteSysId,
        name: actualName,
        state: actualState,
        next_step: remoteSysId
          ? `Preview + commit via the SN UI, or \`sn update-set commit ${remoteSysId}\` once previewed clean.`
          : `Open Retrieved Update Sets in the SN UI to preview + commit.`,
      },
      { single: true }
    );
  },
});

/**
 * Reach into the session cookies stash for the X-UserToken so we can pass
 * it as `sysparm_ck` in the form body. `requestWithSession` also puts it in
 * the `X-UserToken` header, but /sys_upload.do specifically validates the
 * form field.
 */
async function loadSessionCookieForForm(
  instanceName: string
): Promise<{ x_user_token?: string }> {
  const { loadSessionCookies } = await import("../../auth/session-cookies.ts");
  const session = await loadSessionCookies(instanceName);
  if (!session) {
    throw new Error(
      `No web-session cookies stashed for "${instanceName}" — run ` +
        `\`sn auth session-login -i ${instanceName}\` first.`
    );
  }
  return session;
}
