import { consolidateContractRecords, type ContractLedgerSourceRow } from "./contracts-ledger.ts";
import type { ContractStatus } from "./contracts";

export const PROJECT_CONTRACT_LIST_SCOPES = ["project_party", "project_related"] as const;
export type ProjectContractScope = "project_party" | "project_related" | "studio_service" | "unclassified";
export type ProjectContractSource = ContractLedgerSourceRow & {
  dd_visible: boolean; project_contract_scope?: ProjectContractScope; project_party_name?: string | null;
};
export type ProjectContractListRow = {
  contractId: string; title: string; contractingParty: string; counterparty: string | null;
  contractType: string; status: ContractStatus; signedAt: string | null;
  effectiveDate: string | null; expirationDate: string | null; ddVisible: boolean;
};
export type ProjectContractListData = { contracts: ProjectContractListRow[]; canManage: boolean };

export function canManageContractDisclosure(access: {
  principal: "member" | "workspace_account"; scope: string; isAdmin: boolean; role?: string;
}): boolean {
  return access.principal === "member"
    ? access.isAdmin || access.scope === "portfolio"
    : access.role === "manager";
}

/** PJ主体、または明示採用した関連契約だけ。AMD業務契約・未分類はPJへの関連付けだけでは掲載しない。 */
export function projectContractGroups(rows: ProjectContractSource[], projectId: string) {
  return consolidateContractRecords(rows.filter(row => row.project_id === projectId && row.registry_status === "accepted" && (PROJECT_CONTRACT_LIST_SCOPES as readonly string[]).includes(row.project_contract_scope ?? "unclassified")));
}
export function buildProjectContractList(rows: ProjectContractSource[], projectId: string, ddOnly: boolean, canManage = false): ProjectContractListData {
  const visibleIds = new Set(rows.filter(row => row.project_id === projectId && row.dd_visible).map(row => row.contract_id));
  const contracts = projectContractGroups(ddOnly ? rows.filter(row => row.dd_visible) : rows, projectId).map(row => ({
    contractId: row.contract_id,
    title: row.canonical_title || row.contract_title,
    contractingParty: row.project_contract_scope === "project_party" ? row.project_party_name || "未確認" : row.relationship_scope === "amd_contract" ? row.amd_entity_name || "株式会社チームアルマダ" : "未確認",
    counterparty: row.counterparty_name,
    contractType: row.contract_type,
    status: row.status,
    signedAt: row.signed_at,
    effectiveDate: row.effective_date,
    expirationDate: row.expiration_date,
    ddVisible: row.related_contract_ids.some(id => visibleIds.has(id)),
  }));
  return { contracts: ddOnly ? contracts.filter(row => row.ddVisible) : contracts, canManage: !ddOnly && canManage };
}
