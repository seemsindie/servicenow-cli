import type { ServiceNowClient } from "../../client/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

/**
 * Shared helper: find the first pending approval for a change, set its state, and save comments.
 */
export async function decidePendingApproval(
  client: ServiceNowClient,
  changeId: string,
  decision: "approved" | "rejected",
  comments?: string
): Promise<{ changeSysId: string; approvalSysId: string }> {
  const rc = client as unknown as ResolvableClient;
  const resolved = await resolveRecordIdentifier(rc, changeId, "change_request");

  const approvals = await client.queryTable("sysapproval_approver", {
    sysparm_query: `sysapproval=${resolved.sys_id}^state=requested`,
    sysparm_limit: 1,
    sysparm_fields: "sys_id",
  });
  const approval = approvals.records[0];
  if (!approval || typeof approval["sys_id"] !== "string") {
    throw new Error("No pending approval found for this change request");
  }

  const data: Record<string, unknown> = { state: decision };
  if (comments) data["comments"] = comments;
  await client.updateRecord("sysapproval_approver", approval["sys_id"], data);

  return { changeSysId: resolved.sys_id, approvalSysId: approval["sys_id"] };
}
