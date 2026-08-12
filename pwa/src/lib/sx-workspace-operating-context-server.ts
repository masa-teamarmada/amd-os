import { getSxManagementBundle, type SxHistory } from "./sx-management";
import { deriveSxWorkspaceOperatingContext } from "./sx-workspace-operating-context";
import { createAdminClient } from "./supabase/admin";

export async function loadSxWorkspaceOperatingContext(input: {
  projectId: string;
  since?: string | null;
  until?: string | null;
}) {
  const admin = createAdminClient();
  let query = admin
    .from("project_management_update_history")
    .select("id,entity_type,entity_id,update_kind,summary,changed_by,changed_on,from_status,to_status")
    .eq("project_id", input.projectId)
    .is("deleted_at", null)
    .order("changed_on", { ascending: true })
    .order("id", { ascending: true });
  if (input.since) query = query.gte("changed_on", input.since);
  if (input.until) query = query.lte("changed_on", input.until);

  const [bundle, historyResult] = await Promise.all([
    getSxManagementBundle(input.projectId, false),
    query,
  ]);
  if (historyResult.error) {
    throw new Error(`SX workspace history: ${historyResult.error.message}`);
  }
  const history: SxHistory[] = (historyResult.data || []).map((row) => ({
    id: String(row.id || ""),
    entityType: String(row.entity_type || ""),
    entityId: row.entity_id == null ? null : String(row.entity_id),
    updateKind: String(row.update_kind || ""),
    summary: String(row.summary || ""),
    changedBy: String(row.changed_by || ""),
    changedOn: String(row.changed_on || ""),
    fromStatus: row.from_status == null ? null : String(row.from_status),
    toStatus: row.to_status == null ? null : String(row.to_status),
  }));
  return deriveSxWorkspaceOperatingContext({ ...input, bundle, history });
}
