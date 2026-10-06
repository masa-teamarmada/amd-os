import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachProjectContractEvidence, projectContractGroups, buildProjectContractList, type ProjectContractDocumentSource, type ProjectContractHistorySource, type ProjectContractSource, PROJECT_CONTRACT_LIST_SCOPES } from "./project-contract-list";

async function allEvidenceRows<T>(makeQuery: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }> & { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await makeQuery().range(offset, offset + 499);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}
export async function loadProjectContractSources(db: SupabaseClient, projectId: string, ddOnly = false): Promise<ProjectContractSource[]> {
  const query = db.from("contracts")
    .select("contract_id,project_id,contract_title,canonical_title,canonical_contract_id,counterparty_name,contract_type,status,registry_status,relationship_scope,amd_entity_name,expected_signing_date,effective_date,expiration_date,renewal_notice_date,signed_at,last_activity_at,review_required,dd_visible,project_contract_scope,project_party_name")
    .eq("project_id", projectId).eq("registry_status", "accepted").in("project_contract_scope", [...PROJECT_CONTRACT_LIST_SCOPES]).order("last_activity_at", { ascending: false });
  if (ddOnly) query.eq("dd_visible", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectContractSource[];
}
export async function loadProjectContractList(db: SupabaseClient, projectId: string, ddOnly = false, canManage = false) {
  const sources = await loadProjectContractSources(db, projectId, ddOnly);
  const data = buildProjectContractList(sources, projectId, ddOnly, canManage);
  // A contract's DD selection does not authorize disclosure of correspondence or draft versions.
  if (ddOnly || !data.contracts.length) return data;
  const groups = projectContractGroups(sources, projectId);
  const ids = [...new Set(groups.flatMap(group => group.related_contract_ids))];
  const [documents, history] = await Promise.all([
    allEvidenceRows<ProjectContractDocumentSource>(() => db.from("contract_documents").select("document_id,contract_id,project_id,version_label,file_name,web_view_link,received_at,is_latest").eq("project_id", projectId).in("contract_id", ids).order("received_at", { ascending: true }).order("document_id")),
    allEvidenceRows<ProjectContractHistorySource>(() => db.from("contract_signals").select("signal_id,contract_id,project_id,signal_type,status,title,snippet,source_url,detected_at").eq("project_id", projectId).in("contract_id", ids).eq("signal_type", "contract_exchange").eq("status", "linked").order("detected_at", { ascending: true }).order("signal_id")),
  ]);
  return attachProjectContractEvidence(data, groups, projectId, documents, history);
}
