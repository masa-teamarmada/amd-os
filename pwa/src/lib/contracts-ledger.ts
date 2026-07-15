import type { ContractStatus } from "./contracts";

export type ContractRegistryStatus = "candidate" | "accepted" | "evidence_only" | "rejected";

export type ContractLedgerSourceRow = {
  contract_id: string;
  project_id: string;
  contract_title: string;
  canonical_title: string | null;
  canonical_contract_id?: string | null;
  counterparty_name: string | null;
  contract_type: string;
  status: ContractStatus;
  registry_status: ContractRegistryStatus;
  expected_signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_notice_date: string | null;
  signed_at: string | null;
  signed_document_id?: string | null;
  last_activity_at: string | null;
  planned_at?: string | null;
  review_required: boolean;
  review_status?: string | null;
  signal_confidence?: number | null;
  source_summary?: string | null;
  ledger_notes?: string | null;
  business_owner?: string | null;
  confidentiality_coverage?: "in_contract" | "separate_nda" | "not_included" | "unknown" | null;
  confidentiality_survival_note?: string | null;
  confidentiality_note?: string | null;
};

export type ContractLedgerRow<T extends ContractLedgerSourceRow = ContractLedgerSourceRow> = T & {
  related_contract_ids: string[];
  related_record_count: number;
  related_titles: string[];
  related_statuses: ContractStatus[];
  related_registry_statuses: ContractRegistryStatus[];
  latest_record_at: string | null;
  current_record_id: string;
  current_signed_document_id: string | null;
  confidentiality_conflict: boolean;
};

export type ContractProjectTerms = {
  contractStartYm?: string | null;
  contractEndYm?: string | null;
  monthlyFeeYen?: number | string | null;
  expenseReimbursementAllowed?: boolean | string | null;
  expenseReimbursementNote?: string | null;
  deliverablesRequired?: boolean | string | null;
  deliverablesNote?: string | null;
  monthlyReportSubmissionRule?: string | null;
  monthlyReportSubmissionNote?: string | null;
};

export type ContractDocumentEvidence = {
  document_id: string;
  contract_id: string;
  document_kind: string;
  is_latest?: boolean;
};

const TRAILING_ACTIVITY_PATTERNS = [
  /\s*(?:DocuSign|Docusign|クラウドサイン|CloudSign).*$/i,
  /\s*(?:送付先確認|送付依頼|送付確認|確認依頼|押印依頼|署名依頼|締結依頼|法務確認|リーガルチェック|修正案|微修正|赤入れ|レビュー依頼|ドラフト確認|最終版確認).*$/,
  /\s*確認[・\s].*$/,
  /\s*確認$/,
];

const GENERIC_IDENTITY_KEYS = new Set([
  "nda",
  "mou",
  "契約",
  "契約書",
  "覚書",
  "業務委託",
  "業務委託契約",
  "秘密保持",
  "秘密保持契約",
]);

const STATUS_PRIORITY: Record<ContractStatus, number> = {
  signed: 700,
  stalled: 650,
  awaiting_signature: 600,
  under_review: 500,
  drafting: 400,
  planned: 300,
  cancelled: 100,
};

function cleanTitle(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[＿_]+/g, "_")
    .trim()
    .replace(/[\s・:：/／｜|-]+$/g, "")
    .trim();
}

function normalizedKey(value: string | null | undefined) {
  return cleanTitle(String(value || ""))
    .toLowerCase()
    .replace(/[【】「」『』()[\]（）]/g, "")
    .replace(/[\s・:：/／｜|_-]+/g, " ")
    .trim();
}

function canUseIdentityKey(title: string) {
  const key = normalizedKey(title);
  return key.length >= 6 && !GENERIC_IDENTITY_KEYS.has(key);
}

function latestDate(values: Array<string | null | undefined>) {
  return values.filter(Boolean).map(String).sort((a, b) => b.localeCompare(a))[0] || null;
}

function earliestDate(values: Array<string | null | undefined>) {
  return values.filter(Boolean).map(String).sort((a, b) => a.localeCompare(b))[0] || null;
}

function firstText(values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim()) || null;
}

function maxNumber(values: Array<number | null | undefined>) {
  const nums = values.filter((value): value is number => Number.isFinite(value));
  return nums.length > 0 ? Math.max(...nums) : null;
}

function compareByActivity<T extends ContractLedgerSourceRow>(a: T, b: T) {
  const aDate = a.last_activity_at || a.planned_at || "";
  const bDate = b.last_activity_at || b.planned_at || "";
  return bDate.localeCompare(aDate);
}

function parseFlag(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (["false", "no", "不可", "なし", "対象外", "ng"].includes(normalized)) return false;
  if (["true", "yes", "可", "あり", "ok"].includes(normalized)) return true;
  return true;
}

export function contractDisplayTitle(contract: Pick<ContractLedgerSourceRow, "canonical_title" | "contract_title">) {
  return cleanTitle(contract.canonical_title || contract.contract_title || "契約名未設定");
}

export function contractIdentityTitle(contract: Pick<ContractLedgerSourceRow, "canonical_title" | "contract_title">) {
  const rawTitle = contractDisplayTitle(contract);
  if (contract.canonical_title) return rawTitle;
  return TRAILING_ACTIVITY_PATTERNS.reduce((title, pattern) => {
    const next = cleanTitle(title.replace(pattern, ""));
    return next.length >= 4 ? next : title;
  }, rawTitle);
}

export function contractIdentityKey(contract: ContractLedgerSourceRow) {
  if (contract.canonical_contract_id) return `canonical:${contract.canonical_contract_id}`;
  const identityTitle = contractIdentityTitle(contract);
  if (!canUseIdentityKey(identityTitle)) return `contract:${contract.contract_id}`;
  return [
    "contract",
    contract.project_id,
    normalizedKey(contract.contract_type),
    normalizedKey(contract.counterparty_name) || "counterparty:unset",
    normalizedKey(identityTitle),
  ].join("|");
}

export function deriveCurrentContractStatus(rows: ContractLedgerSourceRow[]): ContractStatus {
  return currentContractRecord(rows)?.status || "planned";
}

function currentContractRecord<T extends ContractLedgerSourceRow>(rows: T[]): T | null {
  const activeRows = rows.filter((row) => row.status !== "cancelled");
  const candidates = activeRows.length > 0 ? activeRows : rows;
  const orderedByActivity = candidates.slice().sort(compareByActivity);
  const latestActivity = orderedByActivity[0]?.last_activity_at || orderedByActivity[0]?.planned_at;
  if (latestActivity) return orderedByActivity[0];
  return candidates
    .slice()
    .sort((a, b) => STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status] || compareByActivity(a, b))[0] || null;
}

function deriveRegistryStatus(rows: ContractLedgerSourceRow[]): ContractRegistryStatus {
  if (rows.some((row) => row.registry_status === "accepted")) return "accepted";
  if (rows.some((row) => row.registry_status === "candidate")) return "candidate";
  if (rows.some((row) => row.registry_status === "evidence_only")) return "evidence_only";
  return "rejected";
}

function mergeContractRecords<T extends ContractLedgerSourceRow>(rows: T[]): ContractLedgerRow<T> {
  const ordered = rows.slice().sort(compareByActivity);
  const canonicalId = ordered.map((row) => row.canonical_contract_id).find(Boolean);
  const currentRecord = currentContractRecord(ordered) || ordered[0];
  const primary = ordered.find((row) => row.contract_id === canonicalId)
    || ordered.find((row) => row.status !== "cancelled")
    || ordered[0];
  const identityTitle = contractIdentityTitle(primary);
  const relatedTitles = Array.from(new Set(ordered.map((row) => contractDisplayTitle(row))));
  const explicitConfidentiality = ordered
    .map((row) => row.confidentiality_coverage)
    .filter((value): value is NonNullable<ContractLedgerSourceRow["confidentiality_coverage"]> => Boolean(value && value !== "unknown"));
  const merged = {
    ...primary,
    canonical_contract_id: canonicalId || primary.contract_id,
    contract_title: identityTitle,
    canonical_title: identityTitle,
    counterparty_name: firstText(ordered.map((row) => row.counterparty_name)),
    status: deriveCurrentContractStatus(ordered),
    registry_status: deriveRegistryStatus(ordered),
    expected_signing_date: latestDate(ordered.map((row) => row.expected_signing_date)),
    effective_date: earliestDate(ordered.map((row) => row.effective_date)),
    expiration_date: latestDate(ordered.map((row) => row.expiration_date)),
    renewal_notice_date: earliestDate(ordered.map((row) => row.renewal_notice_date)),
    signed_at: latestDate(ordered.map((row) => row.signed_at)),
    last_activity_at: latestDate(ordered.map((row) => row.last_activity_at || row.planned_at)),
    review_required: ordered.some((row) => row.review_required || row.registry_status === "candidate"),
    review_status: firstText(ordered.map((row) => row.review_status)) || primary.review_status,
    signal_confidence: maxNumber(ordered.map((row) => row.signal_confidence)),
    source_summary: firstText(ordered.map((row) => row.source_summary)) || primary.source_summary,
    ledger_notes: firstText(ordered.map((row) => row.ledger_notes)) || primary.ledger_notes,
    business_owner: firstText(ordered.map((row) => row.business_owner)) || primary.business_owner,
    confidentiality_coverage: explicitConfidentiality[0] || "unknown",
    confidentiality_survival_note: firstText(ordered.map((row) => row.confidentiality_survival_note)) || primary.confidentiality_survival_note,
    confidentiality_note: firstText(ordered.map((row) => row.confidentiality_note)) || primary.confidentiality_note,
  } as T;

  return {
    ...merged,
    related_contract_ids: ordered.map((row) => row.contract_id),
    related_record_count: ordered.length,
    related_titles: relatedTitles,
    related_statuses: Array.from(new Set(ordered.map((row) => row.status))),
    related_registry_statuses: Array.from(new Set(ordered.map((row) => row.registry_status))),
    latest_record_at: latestDate(ordered.map((row) => row.last_activity_at || row.planned_at)),
    current_record_id: currentRecord.contract_id,
    current_signed_document_id: currentRecord.signed_document_id || null,
    confidentiality_conflict: new Set(explicitConfidentiality).size > 1,
  };
}

export function consolidateContractRecords<T extends ContractLedgerSourceRow>(contracts: T[]): ContractLedgerRow<T>[] {
  const contractsByIdentity = new Map<string, T[]>();
  contracts.forEach((contract) => {
    const key = contractIdentityKey(contract);
    const list = contractsByIdentity.get(key) || [];
    list.push(contract);
    contractsByIdentity.set(key, list);
  });
  return Array.from(contractsByIdentity.values())
    .map((rows) => mergeContractRecords(rows))
    .sort(compareByActivity);
}

export function resolveExpenseReimbursement(terms: ContractProjectTerms | null | undefined) {
  const allowed = parseFlag(terms?.expenseReimbursementAllowed);
  return {
    state: allowed === true ? "allowed" as const : allowed === false ? "not_allowed" as const : "unknown" as const,
    note: terms?.expenseReimbursementNote?.trim() || null,
  };
}

export function resolveSignatureProof(contract: ContractLedgerRow, documents: ContractDocumentEvidence[]) {
  const ids = new Set(contract.related_contract_ids);
  const signedDocuments = documents.filter((document) => ids.has(document.contract_id) && document.document_kind === "signed");
  const currentSignedDocument = contract.current_signed_document_id
    ? signedDocuments.find((document) => document.document_id === contract.current_signed_document_id)
    : null;
  if (contract.status === "signed") {
    if (currentSignedDocument) return { state: "complete" as const, label: "押印完了", note: "現在の記録と押印版ファイルIDが一致" };
    return { state: "needs_proof" as const, label: "要確認", note: "押印済み記録はあるが、現在版の押印証跡なし" };
  }
  if (signedDocuments.length > 0) {
    return { state: "needs_proof" as const, label: "更新中", note: "旧押印版はあるが、現在の契約手続きは未完了" };
  }
  return { state: "incomplete" as const, label: "未完了", note: "押印版ファイルなし" };
}

export function resolveConfidentiality(contract: ContractLedgerRow) {
  if (contract.confidentiality_conflict) {
    return { state: "unknown" as const, label: "要確認", note: "関連記録の設定が一致していない" };
  }
  if (contract.confidentiality_coverage === "in_contract") {
    return { state: "included" as const, label: "本文に含む", note: contract.confidentiality_note || "契約本文で確認済み" };
  }
  if (contract.confidentiality_coverage === "separate_nda") {
    return { state: "separate_nda" as const, label: "別NDA", note: contract.confidentiality_note || "別の秘密保持契約で保護" };
  }
  if (contract.confidentiality_coverage === "not_included") {
    return { state: "not_included" as const, label: "含まない", note: contract.confidentiality_note || "確認済み" };
  }
  const explicitNda = /(^|\b)nda(\b|$)|秘密保持/i.test([
    contract.contract_type,
    contract.canonical_title,
    contract.contract_title,
    ...contract.related_titles,
  ].filter(Boolean).join(" "));
  if (explicitNda) return { state: "included" as const, label: "本文に含む", note: "NDA・秘密保持契約として登録" };
  return { state: "unknown" as const, label: "未確認", note: "秘密保持条項の確認記録なし" };
}

export function resolveContractPeriod(
  contract: Pick<ContractLedgerSourceRow, "effective_date" | "expiration_date">,
  project: { start_ym?: string | null; end_ym?: string | null; contract_terms_json?: ContractProjectTerms | null } | null | undefined,
) {
  const terms = project?.contract_terms_json;
  return {
    start: contract.effective_date || null,
    end: contract.expiration_date || null,
    startSource: contract.effective_date ? "contract" as const : "unknown" as const,
    endSource: contract.expiration_date ? "contract" as const : "unknown" as const,
    referenceStart: terms?.contractStartYm || null,
    referenceEnd: terms?.contractEndYm || null,
    referenceSource: terms?.contractStartYm || terms?.contractEndYm ? "applied_project_terms" as const : "unknown" as const,
  };
}
