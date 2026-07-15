import type { ContractStatus } from "./contracts";

export type ContractRegistryStatus = "candidate" | "accepted" | "evidence_only" | "rejected";

export type ContractLedgerSourceRow = {
  contract_id: string;
  project_id: string;
  contract_title: string;
  canonical_title: string | null;
  counterparty_name: string | null;
  contract_type: string;
  status: ContractStatus;
  registry_status: ContractRegistryStatus;
  expected_signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_notice_date: string | null;
  signed_at: string | null;
  last_activity_at: string | null;
  planned_at?: string | null;
  review_required: boolean;
  review_status?: string | null;
  signal_confidence?: number | null;
  source_summary?: string | null;
  ledger_notes?: string | null;
  business_owner?: string | null;
};

export type ContractLedgerFamilyRow<T extends ContractLedgerSourceRow = ContractLedgerSourceRow> = T & {
  ledger_contract_ids: string[];
  ledger_family_title: string;
  ledger_row_count: number;
  ledger_titles: string[];
  ledger_statuses: ContractStatus[];
  ledger_registry_statuses: ContractRegistryStatus[];
  ledger_latest_activity_at: string | null;
};

const TRAILING_ACTION_PATTERNS = [
  /\s*(?:DocuSign|Docusign|クラウドサイン|CloudSign).*$/i,
  /\s*(?:送付先確認|送付依頼|送付確認|確認依頼|押印依頼|署名依頼|締結依頼|法務確認|リーガルチェック|修正案|微修正|赤入れ|レビュー依頼|ドラフト確認|最終版確認).*$/,
  /\s*確認[・\s].*$/,
  /\s*確認$/,
];

const GENERIC_FAMILY_KEYS = new Set([
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

function canUseFamilyKey(title: string) {
  const key = normalizedKey(title);
  return key.length >= 6 && !GENERIC_FAMILY_KEYS.has(key);
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

export function contractDisplayTitle(contract: Pick<ContractLedgerSourceRow, "canonical_title" | "contract_title">) {
  return cleanTitle(contract.canonical_title || contract.contract_title || "契約名未設定");
}

export function contractFamilyTitle(contract: Pick<ContractLedgerSourceRow, "canonical_title" | "contract_title">) {
  const rawTitle = contractDisplayTitle(contract);
  if (contract.canonical_title) return rawTitle;
  return TRAILING_ACTION_PATTERNS.reduce((title, pattern) => {
    const next = cleanTitle(title.replace(pattern, ""));
    return next.length >= 4 ? next : title;
  }, rawTitle);
}

export function contractFamilyKey(contract: ContractLedgerSourceRow) {
  const familyTitle = contractFamilyTitle(contract);
  if (!canUseFamilyKey(familyTitle)) return `contract:${contract.contract_id}`;
  return [
    "family",
    contract.project_id,
    normalizedKey(contract.contract_type),
    normalizedKey(contract.counterparty_name) || "counterparty:unset",
    normalizedKey(familyTitle),
  ].join("|");
}

export function deriveContractFamilyStatus(rows: ContractLedgerSourceRow[]): ContractStatus {
  const activeRows = rows.filter((row) => row.status !== "cancelled");
  const candidates = activeRows.length > 0 ? activeRows : rows;
  if (candidates.some((row) => row.status === "signed" || Boolean(row.signed_at))) return "signed";
  return candidates
    .slice()
    .sort((a, b) => STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status] || compareByActivity(a, b))[0]?.status || "planned";
}

function deriveRegistryStatus(rows: ContractLedgerSourceRow[]): ContractRegistryStatus {
  if (rows.some((row) => row.registry_status === "accepted")) return "accepted";
  if (rows.some((row) => row.registry_status === "candidate")) return "candidate";
  if (rows.some((row) => row.registry_status === "evidence_only")) return "evidence_only";
  return "rejected";
}

function mergeFamily<T extends ContractLedgerSourceRow>(rows: T[]): ContractLedgerFamilyRow<T> {
  const ordered = rows.slice().sort(compareByActivity);
  const primary = ordered.find((row) => row.status !== "cancelled") || ordered[0];
  const familyTitle = contractFamilyTitle(primary);
  const ledgerTitles = Array.from(new Set(ordered.map((row) => contractDisplayTitle(row))));
  const merged = {
    ...primary,
    contract_title: familyTitle,
    canonical_title: familyTitle,
    counterparty_name: firstText(ordered.map((row) => row.counterparty_name)),
    status: deriveContractFamilyStatus(ordered),
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
  } as T;

  return {
    ...merged,
    ledger_contract_ids: ordered.map((row) => row.contract_id),
    ledger_family_title: familyTitle,
    ledger_row_count: ordered.length,
    ledger_titles: ledgerTitles,
    ledger_statuses: Array.from(new Set(ordered.map((row) => row.status))),
    ledger_registry_statuses: Array.from(new Set(ordered.map((row) => row.registry_status))),
    ledger_latest_activity_at: latestDate(ordered.map((row) => row.last_activity_at || row.planned_at)),
  };
}

export function groupContractLedgerRows<T extends ContractLedgerSourceRow>(contracts: T[]): ContractLedgerFamilyRow<T>[] {
  const families = new Map<string, T[]>();
  contracts.forEach((contract) => {
    const key = contractFamilyKey(contract);
    const list = families.get(key) || [];
    list.push(contract);
    families.set(key, list);
  });
  return Array.from(families.values())
    .map((rows) => mergeFamily(rows))
    .sort(compareByActivity);
}
