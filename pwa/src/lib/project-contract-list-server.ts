import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachProjectContractEvidence, projectContractGroups, buildProjectContractList, type ProjectContractEvidenceData, type ProjectContractHistoryCursor, type ProjectContractDocumentSource, type ProjectContractHistorySource, type ProjectContractSource, PROJECT_CONTRACT_LIST_SCOPES } from "./project-contract-list";

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
    .eq("project_id", projectId).eq("registry_status", "accepted").in("project_contract_scope", [...PROJECT_CONTRACT_LIST_SCOPES]).order("last_activity_at", { ascending: false }).order("contract_id");
  if (ddOnly) query.eq("dd_visible", true);
  return allEvidenceRows<ProjectContractSource>(() => query);
}
export async function loadProjectContractList(db: SupabaseClient, projectId: string, ddOnly = false, canManage = false) {
  const sources = await loadProjectContractSources(db, projectId, ddOnly);
  const data = buildProjectContractList(sources, projectId, ddOnly, canManage);
  // A contract's DD selection does not authorize disclosure of correspondence or draft versions.
  if (ddOnly || !data.contracts.length) return data;
  const groups = projectContractGroups(sources, projectId);
  const ids = [...new Set(groups.flatMap(group => group.related_contract_ids))];
  const documents = await allEvidenceRows<ProjectContractDocumentSource>(() => db.from("contract_documents").select("document_id,contract_id,project_id,version_label,file_name,web_view_link,received_at,is_latest").eq("project_id", projectId).in("contract_id", ids).eq("is_latest", true).order("received_at", { ascending: true }).order("document_id"));
  const summaries = attachProjectContractEvidence(data, groups, projectId, documents, []);
  return { ...data, contracts: summaries.contracts.map(({ documents, history: _history, ...row }) => ({ ...row, latestDocument: documents?.at(-1) ?? null })) };
}

export async function loadProjectContractEvidence(db: SupabaseClient, projectId: string, contractId: string, cursor?: ProjectContractHistoryCursor): Promise<ProjectContractEvidenceData | null> {
  const sources = await loadProjectContractSources(db, projectId);
  const groups = projectContractGroups(sources, projectId);
  const target = groups.find(group => group.contract_id === contractId);
  if (!target) return null;
  const ids = target.related_contract_ids;
  let historyQuery = db.from("contract_signals").select("signal_id,contract_id,project_id,signal_type,status,title,snippet,source_url,detected_at").eq("project_id", projectId).in("contract_id", ids).eq("signal_type", "contract_exchange").eq("status", "linked").order("detected_at", { ascending: false }).order("signal_id", { ascending: false });
  if (cursor) historyQuery = historyQuery.or(`detected_at.lt.${cursor.occurredAt},and(detected_at.eq.${cursor.occurredAt},signal_id.lt.${cursor.id})`);
  const [documents, history] = await Promise.all([
    cursor ? Promise.resolve([] as ProjectContractDocumentSource[]) : allEvidenceRows<ProjectContractDocumentSource>(() => db.from("contract_documents").select("document_id,contract_id,project_id,version_label,file_name,web_view_link,received_at,is_latest").eq("project_id", projectId).in("contract_id", ids).order("received_at", { ascending: false }).order("document_id", { ascending: false })),
    historyQuery.limit(21),
  ]);
  if (history.error) throw new Error(history.error.message);
  const rawHistory = (history.data ?? []) as ProjectContractHistorySource[];
  const page = rawHistory.slice(0, 20);
  const last = page.at(-1);
  const attached = attachProjectContractEvidence(buildProjectContractList(sources.filter(source => ids.includes(source.contract_id)), projectId, false), [target], projectId, documents, page).contracts[0];
  return { contractId, documents: (attached?.documents ?? []).reverse(), history: (attached?.history ?? []).reverse(), nextHistoryCursor: rawHistory.length > 20 && last ? { occurredAt: last.detected_at, id: last.signal_id } : null };
}
