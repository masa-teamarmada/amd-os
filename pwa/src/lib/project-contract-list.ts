import { consolidateContractRecords, type ContractLedgerSourceRow } from "./contracts-ledger.ts";
import type { ContractStatus } from "./contracts";

export const PROJECT_CONTRACT_LIST_SCOPES = ["project_party", "project_related"] as const;
export type ProjectContractScope = "project_party" | "project_related" | "studio_service" | "unclassified";
export type ProjectContractSource = ContractLedgerSourceRow & {
  dd_visible: boolean; project_contract_scope?: ProjectContractScope; project_party_name?: string | null;
};
export type ProjectContractDocument = { id: string; label: string; fileName: string; url: string; receivedAt: string; latest: boolean };
export type ProjectContractHistory = { id: string; title: string; summary: string; url: string | null; occurredAt: string };
export type ProjectContractListRow = {
  contractId: string; title: string; contractingParty: string; counterparty: string | null;
  contractType: string; status: ContractStatus; signedAt: string | null;
  effectiveDate: string | null; expirationDate: string | null; ddVisible: boolean;
  documents?: ProjectContractDocument[]; history?: ProjectContractHistory[];
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

export type ProjectContractDocumentSource = { document_id: string; contract_id: string; project_id: string; version_label: string; file_name: string; web_view_link: string; received_at: string; is_latest: boolean };
export type ProjectContractHistorySource = { signal_id: string; contract_id: string; project_id: string; signal_type: string; status: string; title: string; snippet: string; source_url: string | null; detected_at: string };
function evidenceUrl(value: string | null, hosts: string[]): string | null {
  try { const url = new URL(value ?? ""); return url.protocol === "https:" && !url.username && !url.password && hosts.includes(url.hostname) ? url.href : null; } catch { return null; }
}
/** Explicit exchange records only; never project raw mail, arbitrary signals or admin notes. */
export function attachProjectContractEvidence(data: ProjectContractListData, groups: ReturnType<typeof projectContractGroups>, projectId: string, documents: ProjectContractDocumentSource[], history: ProjectContractHistorySource[]): ProjectContractListData {
  return { ...data, contracts: data.contracts.map(row => {
    const ids = new Set(groups.find(group => group.contract_id === row.contractId)?.related_contract_ids ?? []);
    return { ...row,
      documents: documents.filter(doc => doc.project_id === projectId && ids.has(doc.contract_id)).flatMap(doc => {
        const url = evidenceUrl(doc.web_view_link, ["drive.google.com", "docs.google.com"]);
        return url ? [{ id: doc.document_id, label: doc.version_label, fileName: doc.file_name, url, receivedAt: doc.received_at, latest: doc.is_latest }] : [];
      }).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)),
      history: history.filter(event => event.project_id === projectId && ids.has(event.contract_id) && event.signal_type === "contract_exchange" && event.status === "linked").map(event => ({ id: event.signal_id, title: event.title, summary: event.snippet, url: evidenceUrl(event.source_url, ["mail.google.com"]), occurredAt: event.detected_at })).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    };
  }) };
}
