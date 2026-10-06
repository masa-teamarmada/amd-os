import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProjectContractList, type ProjectContractSource, PROJECT_CONTRACT_LIST_SCOPES } from "./project-contract-list";

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
  return buildProjectContractList(await loadProjectContractSources(db, projectId, ddOnly), projectId, ddOnly, canManage);
}
