const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>「」『』]+/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?<!\d)(?:\+?81[- ]?)?0\d{1,4}[-ー]\d{1,4}[-ー]\d{3,4}(?!\d)/g;
const SECRET_RE = /(?:password|passcode|secret|token|api[_ -]?key|client[_ -]?secret|パスワード|パスコード|暗証番号|秘密鍵|APIキー)\s*[:=：]?\s*[^\s,、。;；]{2,}/gi;
const TOKEN_VALUE_RE = /\b(?:xox[baprs]-[A-Za-z0-9-]+|sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{8,})\b/g;

export const IMPORTANT_EVIDENCE_TEMPORAL_CLASSES = [
  "monthly_actual",
  "period_end_balance",
  "annual_cumulative",
  "financing_cash_flow",
  "grant_deposit",
  "grant_commitment_cap",
  "not_applicable",
] as const;

export type ImportantEvidenceTemporalClass = typeof IMPORTANT_EVIDENCE_TEMPORAL_CLASSES[number];

export const IMPORTANT_EVIDENCE_MATERIAL_KINDS = ["document", "message", "event", "thread", "page"] as const;
export type ImportantEvidenceMaterialKind = typeof IMPORTANT_EVIDENCE_MATERIAL_KINDS[number];

const IMPORTANT_EVIDENCE_TEMPORAL_CLASS_SET = new Set<string>(IMPORTANT_EVIDENCE_TEMPORAL_CLASSES);
const IMPORTANT_EVIDENCE_MATERIAL_KIND_SET = new Set<string>(IMPORTANT_EVIDENCE_MATERIAL_KINDS);

// 過去候補で使われた説明的な分類を、正本schemaの有限な時間分類へ安全側に畳む。
// 計画・見積・承認・価格・プロセスは実績や入出金へ昇格させない。
const IMPORTANT_EVIDENCE_TEMPORAL_CLASS_ALIASES: Readonly<Record<string, ImportantEvidenceTemporalClass>> = {
  capital_expenditure_cash_schedule: "not_applicable",
  grant_reimbursement_timing: "not_applicable",
  planned_product_price: "not_applicable",
  planned_project_cost_estimate: "not_applicable",
  monthly_actual_or_management_estimate: "not_applicable",
  excluded_cost_component: "not_applicable",
  capital_expenditure_commitment: "not_applicable",
  unit_cost_target: "not_applicable",
  unit_cost_estimate: "not_applicable",
  planned_contract_cash_outflow: "not_applicable",
  capital_expenditure_estimate: "not_applicable",
  financing_process_event: "not_applicable",
};

export function normalizeImportantEvidenceTemporalClass(value: unknown): ImportantEvidenceTemporalClass | null {
  const raw = String(value ?? "").trim();
  if (IMPORTANT_EVIDENCE_TEMPORAL_CLASS_SET.has(raw)) return raw as ImportantEvidenceTemporalClass;
  return IMPORTANT_EVIDENCE_TEMPORAL_CLASS_ALIASES[raw] ?? null;
}

export function normalizeImportantEvidenceMaterialKind(value: unknown): ImportantEvidenceMaterialKind | null {
  const raw = String(value ?? "").trim();
  if (IMPORTANT_EVIDENCE_MATERIAL_KIND_SET.has(raw)) return raw as ImportantEvidenceMaterialKind;
  return raw === "message_thread" ? "thread" : null;
}

type ImportantEvidenceValueBoundaryFact = {
  temporal_class?: unknown;
  fact_key?: unknown;
  label?: unknown;
  status?: unknown;
  accounting_treatment?: unknown;
  value_number?: unknown;
  value_yen?: unknown;
  unit?: unknown;
};

/**
 * 売上・会社価値へ直加点してはいけない資金移動を判定する。
 * SBIR / NEDO という制度名だけでは、技術目標・契約状態・期限まで財務CF扱いにしない。
 */
export function importantEvidenceFactMustExcludeFromValue(fact: ImportantEvidenceValueBoundaryFact): boolean {
  const temporalClass = normalizeImportantEvidenceTemporalClass(fact.temporal_class);
  if (["financing_cash_flow", "grant_deposit", "grant_commitment_cap"].includes(temporalClass || "")) {
    return true;
  }

  const classificationText = [
    fact.fact_key,
    fact.label,
    fact.status,
    fact.accounting_treatment,
  ].map((value) => String(value ?? "")).join(" ");

  if (/(?:資金調達|借入金?|融資|出資|増資|転換社債|新株予約権|J[- ]?KISS|設備投資|financ(?:ing|e)|fundrais(?:ing|e)|borrow(?:ing)?|loan|debt|equity\s+financ|convertible|capital\s+expenditure|capex)/i.test(classificationText)) {
    return true;
  }

  const mentionsGrant = /(?:補助金|助成金|交付金|SBIR|NEDO|SusHi\s*Tech|grant|subsid(?:y|ies))/i.test(classificationText);
  if (!mentionsGrant) return false;

  const hasCurrencyValue = fact.value_yen != null
    || (["JPY", "円"].includes(String(fact.unit ?? "")) && fact.value_number != null);
  const mentionsGrantCash = /(?:金額|上限|採択額|交付額|助成額|予算額|入金|着金|受領|預り|前受|概算払|支払|精算|払戻|払い戻|償還|資金繰り)|\b(?:reimburse(?:ment|d)?|cash|amount|cap|award(?:ed)?|payment|deposit|advance)\b/i.test(classificationText);
  return hasCurrencyValue || mentionsGrantCash;
}

/**
 * 重要情報の候補・正本・通知へ残す短文専用の非LLM sanitizer。
 * 原文hashは別fieldで保持し、表示用短文にはURL・連絡先・認証情報を残さない。
 */
export function sanitizeImportantEvidenceText(value: unknown, max = 500): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(URL_RE, "[URL省略]")
    .replace(EMAIL_RE, "[メール省略]")
    .replace(PHONE_RE, "[電話番号省略]")
    .replace(SECRET_RE, "[認証情報省略]")
    .replace(TOKEN_VALUE_RE, "[認証情報省略]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, max));
}
