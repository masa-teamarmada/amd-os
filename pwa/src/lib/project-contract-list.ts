import { consolidateContractRecords, type ContractLedgerSourceRow } from "./contracts-ledger.ts";
import type { ContractStatus } from "./contracts";

export type ProjectContractSource = ContractLedgerSourceRow & { dd_visible: boolean };
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

/** 台帳に採用した契約だけ。推定候補や原メール・内部メモは閲覧本文へ送らない。 */
export function projectContractGroups(rows: ProjectContractSource[], projectId: string) {
  return consolidateContractRecords(rows.filter(row => row.project_id === projectId && row.registry_status === "accepted"));
}
export function buildProjectContractList(rows: ProjectContractSource[], projectId: string, ddOnly: boolean, canManage = false): ProjectContractListData {
  const visibleIds = new Set(rows.filter(row => row.project_id === projectId && row.dd_visible).map(row => row.contract_id));
  const contracts = projectContractGroups(ddOnly ? rows.filter(row => row.dd_visible) : rows, projectId).map(row => ({
    contractId: row.contract_id,
    title: row.canonical_title || row.contract_title,
    contractingParty: row.relationship_scope === "amd_contract" ? row.amd_entity_name || "株式会社チームアルマダ" : "未確認",
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
