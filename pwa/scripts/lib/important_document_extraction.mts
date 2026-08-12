import crypto from "node:crypto";

export type TextExtractionMethod = "native_text" | "pdf_text" | "ocr" | "unavailable";
export type TextExtractionStatus = "available" | "partial" | "missing";
export type DocumentReviewStatus = "candidate" | "confirmed" | "rejected" | "archived";
export type FinancialTemporalClass =
  | "monthly_actual"
  | "period_end_balance"
  | "annual_cumulative"
  | "financing_cash_flow"
  | "grant_deposit"
  | "grant_commitment_cap";

export type ImportantDocumentInput = {
  file_id: string;
  name: string;
  mime_type: string;
  parent_folders: string[];
  created_at?: string | null;
  modified_at?: string | null;
  content_sha256?: string | null;
  text: string;
  extraction_method: TextExtractionMethod;
  extraction_status: TextExtractionStatus;
  page_markers?: Array<{ page: number; text: string }>;
  canonical_preferred?: boolean;
};

export type ImportantDocumentProject = {
  project_id: string;
  company_name: string;
  company_aliases: string[];
  project_aliases: string[];
};

export type ImportantDocumentBatch = {
  project: ImportantDocumentProject;
  observed_at: string;
  documents: ImportantDocumentInput[];
};

export type FieldProvenance = {
  file_id: string;
  content_sha256: string;
  section: string;
  page: number | null;
  evidence_text: string;
  evidence_sha256: string;
  extraction_method: TextExtractionMethod;
  observation_kind: "document";
};

export type ImportantDocumentFact = {
  fact_key: string;
  label: string;
  value_yen: number | null;
  value_status: "observed" | "calculated" | "partial" | "missing";
  temporal_class: FinancialTemporalClass;
  period_start: string | null;
  period_end: string | null;
  as_of_date: string | null;
  due_at: string | null;
  due_precision: "day" | "month" | "fiscal_year" | "none";
  status: "reported" | "received_on_account" | "conditional_cap" | "missing";
  accounting_treatment: string;
  include_in_revenue: boolean;
  include_in_company_value: boolean;
  provenance: FieldProvenance | null;
};

export type ImportantDocumentCandidate = {
  schema_version: 1;
  candidate_kind: "important_document";
  review_status: DocumentReviewStatus;
  project_id: string;
  company_name: string;
  document_class: "annual_financial_package";
  title: string;
  mime_type: string;
  reporting_period_start: string;
  reporting_period_end: string;
  balance_sheet_date: string;
  audited: boolean;
  audit_opinion: "unqualified" | "other" | "unknown";
  audit_signed_on: string | null;
  content_sha256: string;
  source_hash: string;
  canonical_file_id: string;
  lineage: Array<{
    file_id: string;
    parent_folders: string[];
    created_at: string | null;
    modified_at: string | null;
    extraction_method: TextExtractionMethod;
    extraction_status: TextExtractionStatus;
  }>;
  version: {
    family_key: string;
    rank: number;
    state: "canonical_candidate" | "superseded_candidate";
  };
  facts: ImportantDocumentFact[];
  monthly_actuals: [];
  missing_fields: string[];
  bzm_input_candidates: Array<{
    parameter_key: string;
    value: number | null;
    unit: "JPY";
    value_status: "observed" | "calculated" | "missing";
    information_date: string;
    temporal_scope: string;
    use_rule: string;
    source_fact_key: string;
    review_status: "candidate";
  }>;
  detected_at: string;
};

export type ImportantDocumentExtractionResult = {
  candidates: ImportantDocumentCandidate[];
  skipped: Array<{ file_id: string; reason: string }>;
  search_plan: ReturnType<typeof buildImportantDocumentSearchPlan>;
};

const PDF_MIME = "application/pdf";
const IMPORTANT_NAME_RE = /(事業報告|計算書類|附属明細|監査報告|決算|株主総会|取締役会)/;
const IMPORTANT_PARENT_RE = /(株主総会|取締役会|書面決議|決算|監査)/;
const BODY_MARKERS = ["事業報告", "貸借対照表", "損益計算書", "附属明細", "監査報告"];

export function normalizeDocumentText(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Drive collector が一語検索・更新順上位だけに偏らないための決定論的な探索面。
 * 実際の Drive/App connector は各 query をページングし、親フォルダも必ず解決してから
 * extractImportantDocuments に渡す。検索結果0件は正常、PDF本文未取得は missing として残す。
 */
export function buildImportantDocumentSearchPlan(project: ImportantDocumentProject) {
  const companyTerms = [...new Set([
    project.company_name,
    ...project.company_aliases,
    ...project.project_aliases,
  ].map((value) => value.trim()).filter(Boolean))];
  return {
    company_terms: companyTerms,
    filename_terms: ["事業報告", "計算書類", "附属明細", "監査報告", "決算"],
    parent_folder_terms: ["株主総会", "取締役会", "書面決議", "決算", "監査"],
    mime_types: [PDF_MIME, "application/vnd.google-apps.document"],
    body_terms: BODY_MARKERS,
    pagination_required: true,
    order_independent: true,
  } as const;
}

export function extractImportantDocuments(batch: ImportantDocumentBatch): ImportantDocumentExtractionResult {
  const skipped: ImportantDocumentExtractionResult["skipped"] = [];
  const classified: Array<{
    input: ImportantDocumentInput;
    text: string;
    contentHash: string;
    period: { start: string; end: string };
    audit: ReturnType<typeof parseAudit>;
  }> = [];

  for (const input of batch.documents) {
    const text = normalizeDocumentText(input.text);
    if (input.extraction_status === "missing" || !text) {
      skipped.push({ file_id: input.file_id, reason: "document_text_missing" });
      continue;
    }
    const period = parseReportingPeriod(text);
    const companyMatched = matchesCompany(batch.project, `${input.name}\n${input.parent_folders.join("\n")}\n${text}`);
    const bodyScore = BODY_MARKERS.filter((marker) => text.includes(marker)).length;
    const titleMatched = IMPORTANT_NAME_RE.test(input.name);
    const parentMatched = IMPORTANT_PARENT_RE.test(input.parent_folders.join(" "));
    const supportedMime = input.mime_type === PDF_MIME || input.mime_type === "application/vnd.google-apps.document";
    if (!supportedMime || !companyMatched || !period || bodyScore < 4 || (!titleMatched && !parentMatched)) {
      skipped.push({ file_id: input.file_id, reason: "not_annual_financial_package" });
      continue;
    }
    const suppliedHash = String(input.content_sha256 || "").toLowerCase();
    const contentHash = /^[0-9a-f]{64}$/.test(suppliedHash) ? suppliedHash : sha256(text);
    classified.push({ input, text, contentHash, period, audit: parseAudit(text) });
  }

  const contentGroups = new Map<string, typeof classified>();
  for (const item of classified) {
    const key = `${batch.project.project_id}:${item.contentHash}`;
    const group = contentGroups.get(key) || [];
    group.push(item);
    contentGroups.set(key, group);
  }

  const baseCandidates = [...contentGroups.values()].map((group) => buildCandidate(batch, group));
  const familyGroups = new Map<string, ImportantDocumentCandidate[]>();
  for (const candidate of baseCandidates) {
    const family = candidate.version.family_key;
    const values = familyGroups.get(family) || [];
    values.push(candidate);
    familyGroups.set(family, values);
  }
  for (const values of familyGroups.values()) {
    values.sort((a, b) => newestLineageTime(b).localeCompare(newestLineageTime(a)) || a.content_sha256.localeCompare(b.content_sha256));
    values.forEach((candidate, index) => {
      candidate.version.rank = index + 1;
      candidate.version.state = index === 0 ? "canonical_candidate" : "superseded_candidate";
    });
  }

  const candidates = baseCandidates.sort((a, b) =>
    a.project_id.localeCompare(b.project_id)
    || a.reporting_period_end.localeCompare(b.reporting_period_end)
    || a.content_sha256.localeCompare(b.content_sha256));
  return { candidates, skipped, search_plan: buildImportantDocumentSearchPlan(batch.project) };
}

export function toCoverageGapOutbox(result: ImportantDocumentExtractionResult) {
  return {
    contract: "amd-os-important-document-outbox-v1",
    generated_at: new Date().toISOString(),
    coverageGaps: result.candidates.map((candidate) => ({
      source: "drive",
      source_ref: `drive-file:${candidate.canonical_file_id}`,
      source_hash: candidate.source_hash,
      title: `重要書類候補: ${candidate.company_name} ${candidate.reporting_period_end.slice(0, 4)}年期`,
      summary: [
        `${candidate.document_class}を検出。`,
        `同一内容${candidate.lineage.length}所在を1候補へ集約。`,
        `対象期間${candidate.reporting_period_start}〜${candidate.reporting_period_end}。`,
        candidate.audited ? "監査報告あり。" : "監査報告は未確認。",
      ].join(""),
      salience_score: 0.98,
      proposed_target_l2: "important_document",
      gap_class: "extractor_miss",
      project_id: candidate.project_id,
      scope: "project",
      // 監査日や補助金の確定見込み日は文書内 fact に保持する。通知の期限へ流用しない。
      due_at: null,
      review_status: "candidate",
      evidence_refs_json: { important_document: candidate },
      detected_at: candidate.detected_at,
    })),
    skipped: result.skipped,
  };
}

function buildCandidate(
  batch: ImportantDocumentBatch,
  group: Array<{
    input: ImportantDocumentInput;
    text: string;
    contentHash: string;
    period: { start: string; end: string };
    audit: ReturnType<typeof parseAudit>;
  }>,
): ImportantDocumentCandidate {
  const sorted = [...group].sort((a, b) =>
    Number(b.input.canonical_preferred === true) - Number(a.input.canonical_preferred === true)
    || sortableTime(b.input).localeCompare(sortableTime(a.input))
    || a.input.file_id.localeCompare(b.input.file_id));
  const primary = sorted[0];
  const audit = sorted.find((item) => item.audit.audited)?.audit || primary.audit;
  const facts = extractFacts(primary, primary.period);
  const sourceHash = sha256(`important_document:${batch.project.project_id}:${primary.contentHash}`);
  const familyKey = [
    batch.project.project_id,
    "annual_financial_package",
    primary.period.start,
    primary.period.end,
  ].join(":");

  return {
    schema_version: 1,
    candidate_kind: "important_document",
    review_status: "candidate",
    project_id: batch.project.project_id,
    company_name: batch.project.company_name,
    document_class: "annual_financial_package",
    title: primary.input.name,
    mime_type: primary.input.mime_type,
    reporting_period_start: primary.period.start,
    reporting_period_end: primary.period.end,
    balance_sheet_date: primary.period.end,
    audited: audit.audited,
    audit_opinion: audit.opinion,
    audit_signed_on: audit.signedOn,
    content_sha256: primary.contentHash,
    source_hash: sourceHash,
    canonical_file_id: primary.input.file_id,
    lineage: sorted.map(({ input }) => ({
      file_id: input.file_id,
      parent_folders: [...input.parent_folders],
      created_at: input.created_at || null,
      modified_at: input.modified_at || null,
      extraction_method: input.extraction_method,
      extraction_status: input.extraction_status,
    })),
    version: { family_key: familyKey, rank: 1, state: "canonical_candidate" },
    facts,
    monthly_actuals: [],
    missing_fields: facts.filter((fact) => fact.value_status === "missing").map((fact) => fact.fact_key),
    bzm_input_candidates: buildBzmProjection(facts, primary.period.end),
    detected_at: batch.observed_at,
  };
}

function extractFacts(
  primary: { input: ImportantDocumentInput; text: string; contentHash: string },
  period: { start: string; end: string },
): ImportantDocumentFact[] {
  const specs: Array<{
    key: string;
    label: string;
    patterns: RegExp[];
    temporal: FinancialTemporalClass;
    section: string;
    status: ImportantDocumentFact["status"];
    treatment: string;
    revenue: boolean;
    companyValue: boolean;
  }> = [
    { key: "cash_and_deposits", label: "現金及び預金", patterns: [/現金(?:及び|および)預金\s*([\d,]+)\s*千円/, /現預金\s*([\d,]+)\s*千円/], temporal: "period_end_balance", section: "貸借対照表", status: "reported", treatment: "期末残高", revenue: false, companyValue: false },
    { key: "net_sales", label: "売上高", patterns: [/売上高\s*([\d,]+)\s*千円/, /売上\s*([\d,]+)\s*千円/], temporal: "annual_cumulative", section: "損益計算書", status: "reported", treatment: "年度累計の収益", revenue: true, companyValue: false },
    { key: "operating_loss", label: "営業損失", patterns: [/営業損失\s*([\d,]+)\s*千円/], temporal: "annual_cumulative", section: "損益計算書", status: "reported", treatment: "年度累計の損失", revenue: false, companyValue: false },
    { key: "net_loss", label: "当期純損失", patterns: [/(?:当期)?純損失\s*([\d,]+)\s*千円/], temporal: "annual_cumulative", section: "損益計算書", status: "reported", treatment: "年度累計の損失", revenue: false, companyValue: false },
    { key: "research_and_development_expense", label: "研究開発費", patterns: [/研究開発費\s*([\d,]+)\s*千円/], temporal: "annual_cumulative", section: "附属明細", status: "reported", treatment: "年度累計の費用", revenue: false, companyValue: false },
    { key: "capital_expenditure", label: "設備投資", patterns: [/設備投資(?:額)?\s*([\d,]+)\s*千円/], temporal: "annual_cumulative", section: "事業報告", status: "reported", treatment: "年度累計の投資支出", revenue: false, companyValue: false },
    { key: "jkiss_financing", label: "J-KISS調達", patterns: [/J[\s-]?KISS(?:による)?(?:調達|資金調達|発行)?(?:額|累計)?\s*([\d,]+)\s*千円/i], temporal: "financing_cash_flow", section: "事業報告", status: "reported", treatment: "資金調達CF。事業売上ではない", revenue: false, companyValue: false },
    { key: "borrowings", label: "借入", patterns: [/(?:借入金|借入)(?:額)?\s*([\d,]+)\s*千円/], temporal: "financing_cash_flow", section: "貸借対照表", status: "reported", treatment: "資金調達CF。負債を伴う", revenue: false, companyValue: false },
    { key: "subsidy_deposit_current", label: "補助金預り金（流動）", patterns: [/(?:流動|短期)(?:の)?(?:前受金|預り金|補助金預り金)\s*([\d,]+)\s*千円/], temporal: "grant_deposit", section: "貸借対照表", status: "received_on_account", treatment: "補助金の受領済み預り。売上未計上", revenue: false, companyValue: false },
    { key: "subsidy_deposit_long_term", label: "補助金預り金（長期）", patterns: [/(?:長期)(?:の)?(?:前受金|預り金|補助金預り金)\s*([\d,]+)\s*千円/], temporal: "grant_deposit", section: "貸借対照表", status: "received_on_account", treatment: "補助金の受領済み預り。売上未計上", revenue: false, companyValue: false },
    { key: "sbir_grant_cap", label: "SBIR上限", patterns: [/SBIR[^\n]{0,80}?(?:上限|最大)\s*([\d,.]+)\s*(億|百万円|千円|円)/i], temporal: "grant_commitment_cap", section: "事業報告", status: "conditional_cap", treatment: "採択上限。受領額・売上・会社価値ではない", revenue: false, companyValue: false },
    { key: "nedo_grant_cap", label: "NEDO上限", patterns: [/NEDO[^\n]{0,80}?(?:上限|最大)\s*([\d,.]+)\s*(億|百万円|千円|円)/i], temporal: "grant_commitment_cap", section: "事業報告", status: "conditional_cap", treatment: "採択上限。受領額・売上・会社価値ではない", revenue: false, companyValue: false },
    { key: "sushi_tech_grant_cap", label: "SusHi Tech上限", patterns: [/SusHi\s*Tech[^\n]{0,80}?(?:上限|最大)\s*([\d,.]+)\s*(億|百万円|千円|円)/i], temporal: "grant_commitment_cap", section: "事業報告", status: "conditional_cap", treatment: "採択上限。受領額・売上・会社価値ではない", revenue: false, companyValue: false },
  ];

  const facts: ImportantDocumentFact[] = specs.map((spec) => {
    const found = findAmount(primary.text, spec.patterns);
    const due = grantDue(primary.text, spec.key);
    return {
      fact_key: spec.key,
      label: spec.label,
      value_yen: found?.valueYen ?? null,
      value_status: found ? "observed" as const : "missing" as const,
      temporal_class: spec.temporal,
      period_start: spec.temporal === "period_end_balance" ? null : period.start,
      period_end: spec.temporal === "period_end_balance" ? null : period.end,
      as_of_date: spec.temporal === "period_end_balance" ? period.end : null,
      due_at: due?.date || null,
      due_precision: due?.precision || "none" as const,
      status: found ? spec.status : "missing" as const,
      accounting_treatment: spec.treatment,
      include_in_revenue: spec.revenue,
      include_in_company_value: spec.companyValue,
      provenance: found ? provenance(primary, spec.section, found.evidence) : null,
    } satisfies ImportantDocumentFact;
  });

  const current = facts.find((fact) => fact.fact_key === "subsidy_deposit_current");
  const longTerm = facts.find((fact) => fact.fact_key === "subsidy_deposit_long_term");
  const observedDepositCount = [current, longTerm].filter((fact) => fact?.value_yen != null).length;
  const depositTotal = current?.value_yen != null && longTerm?.value_yen != null
    ? current.value_yen + longTerm.value_yen
    : null;
  facts.push({
    fact_key: "subsidy_deposit_total",
    label: "補助金預り金合計",
    value_yen: depositTotal,
    value_status: observedDepositCount === 2 ? "calculated" : observedDepositCount > 0 ? "partial" : "missing",
    temporal_class: "grant_deposit",
    period_start: null,
    period_end: null,
    as_of_date: period.end,
    due_at: null,
    due_precision: "none",
    status: observedDepositCount > 0 ? "received_on_account" : "missing",
    accounting_treatment: "流動・長期の補助金預り金合計。売上未計上",
    include_in_revenue: false,
    include_in_company_value: false,
    provenance: null,
  });
  return facts;
}

function buildBzmProjection(facts: ImportantDocumentFact[], informationDate: string): ImportantDocumentCandidate["bzm_input_candidates"] {
  const get = (key: string) => facts.find((fact) => fact.fact_key === key);
  const entries = [
    ["cash_balance_at_period_end", "cash_and_deposits", "期末時点の観測値。現行valuation dateのC0へは時点補正なしで直結しない"],
    ["historical_annual_revenue", "net_sales", "過年度実績。月次実績や将来売上へ変換しない"],
    ["historical_annual_operating_loss", "operating_loss", "過年度実績。将来burn rateへ自動外挿しない"],
    ["historical_annual_r_and_d", "research_and_development_expense", "過年度実績。将来研究費へ自動外挿しない"],
    ["historical_annual_capex", "capital_expenditure", "過年度実績。将来設備投資へ自動外挿しない"],
    ["financing_cf_jkiss", "jkiss_financing", "資金調達CF。会社価値へ直加点しない"],
    ["financing_cf_debt", "borrowings", "負債性の資金調達CF。会社価値へ直加点しない"],
    ["grant_deposit_liquidity", "subsidy_deposit_total", "受領済み預りは流動性の観測だけに使い、売上・会社価値へ直加点しない"],
    ["grant_commitment_cap_sbir", "sbir_grant_cap", "条件付き上限。受領額として扱わない"],
    ["grant_commitment_cap_nedo", "nedo_grant_cap", "条件付き上限。受領額として扱わない"],
    ["grant_commitment_cap_sushi_tech", "sushi_tech_grant_cap", "条件付き上限。受領額として扱わない"],
  ] as const;
  return entries.map(([parameterKey, factKey, useRule]) => {
    const fact = get(factKey);
    return {
      parameter_key: parameterKey,
      value: fact?.value_yen ?? null,
      unit: "JPY" as const,
      value_status: fact?.value_status === "calculated" ? "calculated" as const : fact?.value_status === "observed" ? "observed" as const : "missing" as const,
      information_date: informationDate,
      temporal_scope: fact?.as_of_date || [fact?.period_start, fact?.period_end].filter(Boolean).join("/") || "unknown",
      use_rule: useRule,
      source_fact_key: factKey,
      review_status: "candidate" as const,
    };
  });
}

function parseReportingPeriod(text: string): { start: string; end: string } | null {
  const patterns = [
    /(?:対象期間|事業年度|自)\s*(\d{4})[年\-/\.](\d{1,2})[月\-/\.](\d{1,2})日?\s*(?:から|〜|~|至)\s*(\d{4})[年\-/\.](\d{1,2})[月\-/\.](\d{1,2})日?/,
    /(\d{4})-(\d{2})-(\d{2})\s*(?:から|〜|~)\s*(\d{4})-(\d{2})-(\d{2})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    return { start: ymd(match[1], match[2], match[3]), end: ymd(match[4], match[5], match[6]) };
  }
  return null;
}

function parseAudit(text: string): { audited: boolean; opinion: "unqualified" | "other" | "unknown"; signedOn: string | null } {
  const audited = /監査報告/.test(text);
  const opinion = /(?:適正|適法かつ正確|相当である)/.test(text) ? "unqualified" : audited ? "other" : "unknown";
  const match = text.match(/(?:監査報告[\s\S]{0,600}?)(\d{4})年(\d{1,2})月(\d{1,2})日/);
  return { audited, opinion, signedOn: match ? ymd(match[1], match[2], match[3]) : null };
}

function findAmount(text: string, patterns: RegExp[]): { valueYen: number; evidence: string } | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw = Number(String(match[1]).replaceAll(",", ""));
    if (!Number.isFinite(raw)) continue;
    const unit = match[2] || "千円";
    const multiplier = unit === "億" ? 100_000_000 : unit === "百万円" ? 1_000_000 : unit === "千円" ? 1_000 : 1;
    return { valueYen: raw * multiplier, evidence: match[0].replace(/\s+/g, " ").slice(0, 180) };
  }
  return null;
}

function grantDue(text: string, factKey: string): { date: string; precision: "month" | "fiscal_year" } | null {
  const label = factKey.startsWith("sbir") ? "SBIR" : factKey.startsWith("nedo") ? "NEDO" : factKey.startsWith("sushi") ? "SusHi\\s*Tech" : null;
  if (!label) return null;
  const near = text.match(new RegExp(`${label}[^\\n]{0,180}(?:最終(?:確定|精算|金額|支給|交付)|完了|終了)[^\\n]{0,80}?(20\\d{2})年(\\d{1,2})月`, "i"));
  if (near) return { date: `${near[1]}-${String(near[2]).padStart(2, "0")}-31`, precision: "month" };
  const fy = text.match(new RegExp(`${label}[^\\n]{0,180}?(20\\d{2})年度`, "i"));
  return fy ? { date: `${Number(fy[1]) + 1}-03-31`, precision: "fiscal_year" } : null;
}

function provenance(
  primary: { input: ImportantDocumentInput; contentHash: string },
  section: string,
  evidence: string,
): FieldProvenance {
  const page = primary.input.page_markers?.find((marker) => normalizeDocumentText(marker.text).includes(normalizeDocumentText(evidence)))?.page ?? null;
  return {
    file_id: primary.input.file_id,
    content_sha256: primary.contentHash,
    section,
    page,
    evidence_text: evidence,
    evidence_sha256: sha256(evidence),
    extraction_method: primary.input.extraction_method,
    observation_kind: "document",
  };
}

function matchesCompany(project: ImportantDocumentProject, text: string): boolean {
  const normalized = normalizeDocumentText(text).toLowerCase();
  return [project.company_name, ...project.company_aliases, ...project.project_aliases]
    .map((value) => normalizeDocumentText(value).toLowerCase())
    .filter((value) => value.length >= 2)
    .some((value) => normalized.includes(value));
}

function sortableTime(input: ImportantDocumentInput): string {
  return input.modified_at || input.created_at || "0000-00-00T00:00:00.000Z";
}

function newestLineageTime(candidate: ImportantDocumentCandidate): string {
  return candidate.lineage.reduce((latest, item) => {
    const value = item.modified_at || item.created_at || "0000-00-00T00:00:00.000Z";
    return value > latest ? value : latest;
  }, "0000-00-00T00:00:00.000Z");
}

function ymd(year: string, month: string, day: string): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
