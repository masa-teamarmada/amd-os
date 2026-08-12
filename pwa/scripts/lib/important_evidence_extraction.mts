import crypto from "node:crypto";
import { sanitizeImportantEvidenceText } from "../../src/lib/important-evidence-text.ts";

export type RawSourceKind = "gmail" | "drive" | "calendar" | "slack" | "notion";
export type MaterialKind = "document" | "message" | "event" | "thread" | "page";
export type TextExtractionMethod = "native_text" | "pdf_text" | "office_text" | "plain_text" | "ocr" | "metadata_only" | "unavailable";
export type TextExtractionStatus = "available" | "partial" | "missing";
export type ReviewStatus = "candidate" | "confirmed" | "rejected" | "archived";
export type ObservationKind = "observed" | "inferred" | "calculated" | "missing";
export type ImportanceCategory =
  | "financial"
  | "governance"
  | "contract"
  | "funding"
  | "grant"
  | "technical"
  | "project_plan"
  | "commercial"
  | "risk_compliance"
  | "personnel"
  | "deadline"
  | "other";
export type ProposedL2Target = "action_item" | "shareholder_meeting" | "contract_signal" | "strategy_signal" | "important_evidence" | "unclassified";
export type FinancialTemporalClass = "monthly_actual" | "period_end_balance" | "annual_cumulative" | "financing_cash_flow" | "grant_deposit" | "grant_commitment_cap" | "not_applicable";

export type FieldProvenance = {
  source: RawSourceKind;
  source_ref: string;
  content_sha256: string;
  section: string;
  page: number | null;
  evidence_text: string;
  evidence_sha256: string;
  extraction_method: TextExtractionMethod;
  observation_kind: ObservationKind;
};

export type SemanticObservation = {
  fact_key: string;
  label: string;
  value_text?: string | null;
  value_number?: number | null;
  unit?: string | null;
  observation_kind: Exclude<ObservationKind, "missing">;
  section: string;
  evidence_text: string;
  temporal_class?: FinancialTemporalClass;
  period_start?: string | null;
  period_end?: string | null;
  as_of_date?: string | null;
  due_at?: string | null;
  status?: string;
  include_in_revenue?: boolean | null;
  include_in_company_value?: boolean | null;
};

export type SemanticClassification = {
  salient: boolean;
  categories: ImportanceCategory[];
  reasons: string[];
  proposed_targets?: ProposedL2Target[];
  observations?: SemanticObservation[];
};

export type ImportantEvidenceInput = {
  source: RawSourceKind;
  source_ref: string;
  material_kind: MaterialKind;
  title: string;
  mime_type?: string | null;
  parent_folders?: string[];
  project_root_matched?: boolean;
  created_at?: string | null;
  modified_at?: string | null;
  content_sha256?: string | null;
  text_is_excerpt?: boolean;
  text: string;
  extraction_method: TextExtractionMethod;
  extraction_status: TextExtractionStatus;
  extraction_warning?: string | null;
  page_markers?: Array<{ page: number; text: string }>;
  canonical_preferred?: boolean;
  semantic_classification?: SemanticClassification;
};

export type ImportantEvidenceProject = {
  project_id: string;
  company_name: string;
  company_aliases: string[];
  project_aliases: string[];
  drive_folder_id?: string | null;
};

export type ImportantEvidenceBatch = {
  project: ImportantEvidenceProject;
  observed_at: string;
  materials: ImportantEvidenceInput[];
};

export type ImportantEvidenceFact = {
  fact_key: string;
  label: string;
  value_text: string | null;
  value_number: number | null;
  value_yen: number | null;
  unit: string | null;
  value_status: ObservationKind;
  temporal_class: FinancialTemporalClass;
  period_start: string | null;
  period_end: string | null;
  as_of_date: string | null;
  due_at: string | null;
  due_precision: "day" | "month" | "fiscal_year" | "none";
  status: string;
  accounting_treatment: string | null;
  include_in_revenue: boolean | null;
  include_in_company_value: boolean | null;
  provenance: FieldProvenance | null;
};

export type ImportantEvidenceCandidate = {
  schema_version: 2;
  candidate_kind: "important_evidence";
  review_status: ReviewStatus;
  project_id: string;
  company_name: string;
  source: RawSourceKind;
  material_kind: MaterialKind;
  document_class: string;
  title: string;
  mime_type: string | null;
  importance: {
    score: number;
    categories: ImportanceCategory[];
    matched_signals: Array<{ category: ImportanceCategory; location: "title" | "parent" | "body" | "semantic"; evidence_text: string; evidence_sha256: string }>;
    semantic_reasons: string[];
  };
  ownership: {
    status: "confirmed" | "candidate";
    anchors: Array<{ kind: "project_root" | "title" | "parent" | "issuer_header" | "semantic"; evidence_text: string; evidence_sha256: string }>;
  };
  effective_period_start: string | null;
  effective_period_end: string | null;
  balance_sheet_date: string | null;
  audited: boolean;
  audit_opinion: "unqualified" | "other" | "unknown";
  audit_signed_on: string | null;
  content_sha256: string;
  source_hash: string;
  canonical_source_ref: string;
  lineage: Array<{
    source: RawSourceKind;
    source_ref: string;
    parent_folders: string[];
    created_at: string | null;
    modified_at: string | null;
    extraction_method: TextExtractionMethod;
    extraction_status: TextExtractionStatus;
    extraction_warning: string | null;
  }>;
  version: { family_key: string; rank: number; state: "canonical_candidate" | "superseded_candidate" };
  facts: ImportantEvidenceFact[];
  due_items: Array<{ due_at: string; precision: "day" | "month"; label: string; status: "observed"; provenance: FieldProvenance }>;
  proposed_targets: ProposedL2Target[];
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
  missing_fields: string[];
  text_read_required: boolean;
  detected_at: string;
};

export type ImportantEvidenceExtractionResult = {
  candidates: ImportantEvidenceCandidate[];
  skipped: Array<{ source_ref: string; reason: string }>;
  search_plan: ReturnType<typeof buildImportantEvidenceSearchPlan>;
};

type CategorySpec = { category: ImportanceCategory; patterns: RegExp[]; target: ProposedL2Target; weight: number };

const CATEGORY_SPECS: CategorySpec[] = [
  { category: "financial", patterns: [/(?:事業報告|計算書類|決算書|貸借対照表|損益計算書|キャッシュフロー|資金繰り|月次実績)/], target: "important_evidence", weight: 0.28 },
  { category: "governance", patterns: [/(?:株主総会|取締役会|書面決議|招集通知|議決権|委任状|定款変更|登記|監査報告)/], target: "shareholder_meeting", weight: 0.3 },
  { category: "contract", patterns: [/(?:契約書|契約締結|押印|電子署名|クラウドサイン|DocuSign|基本合意|MOU|NDA|解約|解除)/i], target: "contract_signal", weight: 0.28 },
  { category: "funding", patterns: [/(?:資金調達|投資契約|株主間契約|優先株|新株予約権|J[\s-]?KISS|バリュエーション|ラウンド)/i], target: "strategy_signal", weight: 0.27 },
  { category: "grant", patterns: [/(?:採択|交付決定|補助金|助成金|委託事業|SBIR|NEDO|公募要領)/i], target: "strategy_signal", weight: 0.27 },
  { category: "technical", patterns: [/(?:実験結果|試験結果|性能評価|検証結果|技術報告|研究成果|特許|発明|知財|TRL|量産試作)/i], target: "strategy_signal", weight: 0.24 },
  { category: "project_plan", patterns: [/(?:事業計画|資金計画|予算案|実行計画|ロードマップ|マイルストーン|開発計画|量産計画)/], target: "strategy_signal", weight: 0.23 },
  { category: "commercial", patterns: [/(?:受注|発注|売買|販売開始|PoC開始|共同開発|業務提携|顧客合意|見積承認)/i], target: "strategy_signal", weight: 0.22 },
  { category: "risk_compliance", patterns: [/(?:訴訟|クレーム|督促|事故報告|不具合|リコール|監査指摘|法令違反|資金ショート|債務超過)/], target: "strategy_signal", weight: 0.3 },
  { category: "personnel", patterns: [/(?:代表取締役|取締役就任|取締役退任|採用決定|退職|人事異動|組織変更)/], target: "strategy_signal", weight: 0.23 },
  { category: "deadline", patterns: [/(?:提出期限|回答期限|申請期限|支払期限|振込期限|締切|までに提出|までに回答)/], target: "action_item", weight: 0.3 },
];

const SUPPORTED_MIMES = [
  "application/pdf",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/csv",
];

export function normalizeEvidenceText(value: string): string {
  return String(value || "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\r\n?/g, "\n").replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function buildImportantEvidenceSearchPlan(project: ImportantEvidenceProject) {
  const companyTerms = unique([project.company_name, ...project.company_aliases, ...project.project_aliases]);
  return {
    sources: ["gmail", "drive", "calendar", "slack", "notion"] as RawSourceKind[],
    company_terms: companyTerms,
    drive_root_id: project.drive_folder_id || null,
    importance_terms: CATEGORY_SPECS.flatMap((spec) => spec.patterns.map((pattern) => pattern.source)),
    filename_and_parent_are_signals_not_gates: true,
    mime_types: SUPPORTED_MIMES,
    inspect_body: true,
    resolve_parent_lineage: true,
    pagination_required: true,
    order_independent: true,
    scanned_pdf_policy: "ocr_then_surface_missing",
    legacy_office_policy: "convert_or_surface_missing",
  } as const;
}

export function extractImportantEvidence(batch: ImportantEvidenceBatch): ImportantEvidenceExtractionResult {
  const skipped: ImportantEvidenceExtractionResult["skipped"] = [];
  const classified: Array<{
    input: ImportantEvidenceInput;
    text: string;
    contentHash: string;
    category: ReturnType<typeof classifyImportance>;
    ownership: NonNullable<ReturnType<typeof resolveOwnership>>;
    period: { start: string; end: string } | null;
    audit: ReturnType<typeof parseAudit>;
  }> = [];

  for (const input of batch.materials) {
    const text = normalizeEvidenceText(input.text);
    const category = classifyImportance(input, text);
    if (!category.salient) {
      skipped.push({ source_ref: sanitizeImportantEvidenceText(input.source_ref, 500), reason: "not_salient" });
      continue;
    }
    const ownership = resolveOwnership(batch.project, input, text);
    if (!ownership) {
      skipped.push({ source_ref: sanitizeImportantEvidenceText(input.source_ref, 500), reason: "project_ownership_not_anchored" });
      continue;
    }
    const suppliedHash = String(input.content_sha256 || "").toLowerCase();
    const suppliedHashIsValid = /^[0-9a-f]{64}$/.test(suppliedHash);
    // 全文を保持しないcollectorは、判定用抜粋とは別に原文/原ファイルhashを渡す。
    // 抜粋しかない場合はsource identityも混ぜ、偶然同じ短文の別資料を重複扱いしない。
    const contentHash = input.text_is_excerpt
      ? suppliedHashIsValid
        ? suppliedHash
        : sha256(`excerpt:${input.source}:${input.source_ref}:${text}`)
      : text
        ? sha256(text)
        : suppliedHashIsValid
          ? suppliedHash
          : sha256(`${input.source}:${input.source_ref}:${input.title}:${(input.parent_folders || []).join("/")}`);
    classified.push({ input, text, contentHash, category, ownership, period: parseEffectivePeriod(text), audit: parseAudit(text) });
  }

  const contentGroups = new Map<string, typeof classified>();
  for (const item of classified) {
    const key = `${batch.project.project_id}:${item.contentHash}`;
    contentGroups.set(key, [...(contentGroups.get(key) || []), item]);
  }

  const candidates = [...contentGroups.values()].map((group) => buildCandidate(batch, group));
  const families = new Map<string, ImportantEvidenceCandidate[]>();
  for (const candidate of candidates) families.set(candidate.version.family_key, [...(families.get(candidate.version.family_key) || []), candidate]);
  for (const values of families.values()) {
    values.sort((a, b) => newestLineageTime(b).localeCompare(newestLineageTime(a)) || a.content_sha256.localeCompare(b.content_sha256));
    values.forEach((candidate, index) => {
      candidate.version.rank = index + 1;
      candidate.version.state = index === 0 ? "canonical_candidate" : "superseded_candidate";
    });
  }
  candidates.sort((a, b) => a.project_id.localeCompare(b.project_id) || a.document_class.localeCompare(b.document_class) || a.content_sha256.localeCompare(b.content_sha256));
  return { candidates, skipped, search_plan: buildImportantEvidenceSearchPlan(batch.project) };
}

export function toImportantEvidenceOutbox(result: ImportantEvidenceExtractionResult, generatedAt = new Date().toISOString()) {
  return {
    contract: "amd-os-important-evidence-outbox-v2",
    generated_at: generatedAt,
    coverageGaps: result.candidates.map((candidate) => ({
      source: candidate.source,
      source_ref: candidate.canonical_source_ref,
      source_hash: candidate.source_hash,
      title: `重要情報候補: ${candidate.company_name} / ${candidate.title}`,
      summary: [
        `${candidate.importance.categories.map(categoryLabel).join("・")}の重要情報を検出。`,
        `同一内容${candidate.lineage.length}所在を1候補へ集約。`,
        candidate.text_read_required
          ? candidate.facts.some((fact) => fact.value_status !== "missing")
            ? `抜粋・部分読取から根拠付き項目${candidate.facts.filter((fact) => fact.value_status !== "missing").length}件。全文は未確認。`
            : "本文は未読のためOCRまたは変換が必要。"
          : `根拠付き項目${candidate.facts.filter((fact) => fact.value_status !== "missing").length}件。`,
        candidate.due_items.length > 0 ? `期限${candidate.due_items[0].due_at}を検出。` : "",
      ].filter(Boolean).join(""),
      salience_score: candidate.importance.score,
      proposed_target_l2: "important_evidence",
      gap_class: "extractor_miss",
      project_id: candidate.project_id,
      scope: "project",
      due_at: candidate.due_items[0]?.due_at || null,
      review_status: "candidate",
      evidence_refs_json: { important_evidence: candidate },
      detected_at: candidate.detected_at,
    })),
    skipped: result.skipped,
  };
}

function buildCandidate(batch: ImportantEvidenceBatch, group: Array<{
  input: ImportantEvidenceInput;
  text: string;
  contentHash: string;
  category: ReturnType<typeof classifyImportance>;
  ownership: NonNullable<ReturnType<typeof resolveOwnership>>;
  period: { start: string; end: string } | null;
  audit: ReturnType<typeof parseAudit>;
}>): ImportantEvidenceCandidate {
  const sorted = [...group].sort((a, b) =>
    extractionPriority(b.input) - extractionPriority(a.input)
    || Number(b.input.canonical_preferred === true) - Number(a.input.canonical_preferred === true)
    || sortableTime(b.input).localeCompare(sortableTime(a.input))
    || a.input.source_ref.localeCompare(b.input.source_ref));
  const primary = sorted[0];
  const categories = unique(sorted.flatMap((item) => item.category.categories)) as ImportanceCategory[];
  const safeTitle = sanitizeImportantEvidenceText(primary.input.title, 500) || "重要情報";
  const documentClass = classifyDocument(categories, `${safeTitle} ${primary.text}`, primary.input.material_kind);
  const period = sorted.find((item) => item.period)?.period || null;
  const audit = sorted.find((item) => item.audit.audited)?.audit || primary.audit;
  const facts = extractFacts(primary, period);
  const dueItems = extractDueItems(primary, facts);
  const proposedTargets = routeTargets(categories, primary.input.semantic_classification?.proposed_targets);
  const contentHash = primary.contentHash;
  const sourceHash = sha256(`important_evidence:${batch.project.project_id}:${contentHash}`);
  const familyKey = [batch.project.project_id, documentClass, period?.start || "no-period", period?.end || normalizeTitleFamily(safeTitle)].join(":");
  return {
    schema_version: 2,
    candidate_kind: "important_evidence",
    review_status: "candidate",
    project_id: batch.project.project_id,
    company_name: batch.project.company_name,
    source: primary.input.source,
    material_kind: primary.input.material_kind,
    document_class: documentClass,
    title: safeTitle,
    mime_type: primary.input.mime_type || null,
    importance: {
      score: Math.max(...sorted.map((item) => item.category.score)),
      categories,
      matched_signals: dedupeBy(sorted.flatMap((item) => item.category.matchedSignals), (value) => `${value.category}:${value.location}:${value.evidence_sha256}`).slice(0, 30),
      semantic_reasons: unique(sorted.flatMap((item) => item.input.semantic_classification?.reasons || []).map((value) => sanitizeImportantEvidenceText(value, 300))).slice(0, 20),
    },
    ownership: primary.ownership,
    effective_period_start: period?.start || null,
    effective_period_end: period?.end || null,
    balance_sheet_date: categories.includes("financial") ? period?.end || null : null,
    audited: audit.audited,
    audit_opinion: audit.opinion,
    audit_signed_on: audit.signedOn,
    content_sha256: contentHash,
    source_hash: sourceHash,
    canonical_source_ref: sanitizeImportantEvidenceText(primary.input.source_ref, 500),
    lineage: sorted.map(({ input }) => ({
      source: input.source,
      source_ref: sanitizeImportantEvidenceText(input.source_ref, 500),
      parent_folders: [...(input.parent_folders || [])].map((value) => sanitizeImportantEvidenceText(value, 300)),
      created_at: input.created_at || null,
      modified_at: input.modified_at || null,
      extraction_method: input.extraction_method,
      extraction_status: input.extraction_status,
      extraction_warning: sanitizeImportantEvidenceText(input.extraction_warning || (input.text_is_excerpt ? "excerpt_only" : ""), 180) || null,
    })),
    version: { family_key: familyKey, rank: 1, state: "canonical_candidate" },
    facts,
    due_items: dueItems,
    proposed_targets: proposedTargets,
    bzm_input_candidates: categories.includes("financial") && period ? buildBzmProjection(facts, period.end) : [],
    missing_fields: facts.filter((fact) => fact.value_status === "missing").map((fact) => fact.fact_key),
    text_read_required: primary.input.extraction_status !== "available" || primary.input.text_is_excerpt === true || !primary.text,
    detected_at: batch.observed_at,
  };
}

function classifyImportance(input: ImportantEvidenceInput, text: string) {
  const title = normalizeEvidenceText(input.title);
  const parent = normalizeEvidenceText((input.parent_folders || []).join(" "));
  const matchedSignals: ImportantEvidenceCandidate["importance"]["matched_signals"] = [];
  const categories = new Set<ImportanceCategory>();
  let score = 0;
  for (const spec of CATEGORY_SPECS) {
    for (const [location, value, multiplier] of [["title", title, 1.25], ["parent", parent, 1.05], ["body", text, 1]] as const) {
      const pattern = spec.patterns.find((candidate) => candidate.test(value));
      if (!pattern) continue;
      categories.add(spec.category);
      score += spec.weight * multiplier;
      const evidence = sanitizeImportantEvidenceText(snippetForPattern(value, pattern), 240);
      matchedSignals.push({ category: spec.category, location, evidence_text: evidence, evidence_sha256: sha256(evidence) });
      break;
    }
  }
  const semantic = input.semantic_classification;
  if (semantic?.salient) {
    for (const category of semantic.categories) {
      categories.add(category);
      const evidence = sanitizeImportantEvidenceText(semantic.reasons.find(Boolean) || `semantic:${category}`, 240);
      matchedSignals.push({ category, location: "semantic", evidence_text: evidence, evidence_sha256: sha256(evidence) });
    }
    score += 0.45;
  }
  if (input.extraction_status === "missing" && (matchedSignals.some((item) => item.location !== "body") || semantic?.salient)) score += 0.12;
  const bounded = Math.min(0.99, Number(score.toFixed(2)));
  return { salient: categories.size > 0 && bounded >= 0.25, categories: [...categories], score: bounded, matchedSignals };
}

function resolveOwnership(project: ImportantEvidenceProject, input: ImportantEvidenceInput, text: string): ImportantEvidenceCandidate["ownership"] | null {
  const aliases = unique([project.company_name, ...project.company_aliases, ...project.project_aliases]).map(normalizeAlias).filter((value) => value.length >= 2);
  const anchors: ImportantEvidenceCandidate["ownership"]["anchors"] = [];
  if (input.project_root_matched) addAnchor(anchors, "project_root", project.drive_folder_id ? `project-root:${project.drive_folder_id}` : "project-root:matched");
  const title = normalizeEvidenceText(input.title).toLowerCase();
  const parent = normalizeEvidenceText((input.parent_folders || []).join(" ")).toLowerCase();
  // issuer anchor は先頭領域だけを見る。本文後半の支援先・取引先名で別PJへ誤帰属させない。
  const header = normalizeEvidenceText(text).slice(0, 700).toLowerCase();
  const titleAlias = aliases.find((alias) => title.includes(alias));
  const parentAlias = aliases.find((alias) => parent.includes(alias));
  const headerAlias = aliases.find((alias) => header.includes(alias));
  if (titleAlias) addAnchor(anchors, "title", titleAlias);
  if (parentAlias) addAnchor(anchors, "parent", parentAlias);
  if (headerAlias) addAnchor(anchors, "issuer_header", headerAlias);
  if (input.semantic_classification?.salient && input.project_root_matched) addAnchor(anchors, "semantic", "semantic classification under project root");
  if (anchors.some((anchor) => anchor.kind === "project_root" || anchor.kind === "title" || anchor.kind === "parent")) return { status: "confirmed", anchors };
  if (anchors.some((anchor) => anchor.kind === "issuer_header")) return { status: "candidate", anchors };
  return null;
}

function addAnchor(anchors: ImportantEvidenceCandidate["ownership"]["anchors"], kind: ImportantEvidenceCandidate["ownership"]["anchors"][number]["kind"], evidence: string) {
  const sanitized = sanitizeImportantEvidenceText(evidence, 240);
  anchors.push({ kind, evidence_text: sanitized, evidence_sha256: sha256(sanitized) });
}

function extractFacts(primary: { input: ImportantEvidenceInput; text: string; contentHash: string }, period: { start: string; end: string } | null): ImportantEvidenceFact[] {
  const facts: ImportantEvidenceFact[] = [];
  if (period && /(?:貸借対照表|損益計算書|計算書類|決算|事業報告)/.test(primary.text)) facts.push(...extractFinancialFacts(primary, period));
  for (const observed of primary.input.semantic_classification?.observations || []) {
    if (!semanticObservationIsGrounded(primary.text, observed)) continue;
    const observationKind = normalizeSemanticObservationKind(observed.observation_kind, observed.status, observed.evidence_text);
    const excludeFromValue = factMustNotAffectRevenueOrCompanyValue(observed);
    facts.push({
      fact_key: sanitizeImportantEvidenceText(observed.fact_key, 180),
      label: sanitizeImportantEvidenceText(observed.label, 240),
      value_text: observed.value_text == null ? null : sanitizeImportantEvidenceText(observed.value_text, 300),
      value_number: observed.value_number ?? null,
      value_yen: observed.unit === "JPY" || observed.unit === "円" ? observed.value_number ?? null : null,
      unit: observed.unit == null ? null : sanitizeImportantEvidenceText(observed.unit, 80),
      value_status: observationKind,
      temporal_class: observed.temporal_class || "not_applicable",
      period_start: observed.period_start || null,
      period_end: observed.period_end || null,
      as_of_date: observed.as_of_date || null,
      due_at: observed.due_at || null,
      due_precision: observed.due_at ? "day" : "none",
      status: sanitizeImportantEvidenceText(observed.status || "reported", 100),
      accounting_treatment: null,
      include_in_revenue: excludeFromValue ? false : observed.include_in_revenue ?? null,
      include_in_company_value: excludeFromValue ? false : observed.include_in_company_value ?? null,
      provenance: provenance(primary, observed.section, observed.evidence_text, observationKind),
    });
  }
  return dedupeBy(facts, (fact) => fact.fact_key);
}

function normalizeSemanticObservationKind(
  observationKind: SemanticObservation["observation_kind"],
  status: string | undefined,
  evidenceText: string,
): SemanticObservation["observation_kind"] {
  if (observationKind !== "observed") return observationKind;
  const value = `${String(status || "").toLowerCase()} ${normalizeEvidenceText(evidenceText)}`;
  if (/(?:plan|planned|forecast|estimate|target|expected|intent|proposed|draft|pending|screening|application|計画|予定|見込み|見込|見通し|予測|予想|目標|想定|推定|試算|概算|ドラフト|意向|検討中|未確定|審査中|申請中|協議中|交渉中)/.test(value)) return "inferred";
  return "observed";
}

function factMustNotAffectRevenueOrCompanyValue(observed: SemanticObservation): boolean {
  if (["financing_cash_flow", "grant_deposit", "grant_commitment_cap"].includes(observed.temporal_class || "")) return true;
  return /(?:fund|financ|loan|borrow|debt|investment|grant|subsid|jkiss|capital|資金調達|出資|投資|融資|借入|借入金|補助金|助成金|交付|概算払い|新株予約権|設備投資)/i
    .test(`${observed.fact_key} ${observed.label} ${observed.status || ""}`);
}

function extractFinancialFacts(primary: { input: ImportantEvidenceInput; text: string; contentHash: string }, period: { start: string; end: string }): ImportantEvidenceFact[] {
  const compact = primary.text.replace(/\s+/g, "");
  const specs = [
    ["cash_and_deposits", "現金及び預金", [/(?:現金(?:及び|および)預金|現預金)([\d,]+)(千円|百万円|億円|円)?/], "period_end_balance", "貸借対照表", "期末残高", false, false],
    ["net_sales", "売上高", [/(?:売上高|売上)([\d,]+)(千円|百万円|億円|円)?/], "annual_cumulative", "損益計算書", "年度累計の収益", true, false],
    ["operating_loss", "営業損失", [/営業損失(?:金)?([\d,]+)(千円|百万円|億円|円)?/], "annual_cumulative", "損益計算書", "年度累計の損失", false, false],
    ["net_loss", "当期純損失", [/(?:当期)?純損失(?:金)?([\d,]+)(千円|百万円|億円|円)?/], "annual_cumulative", "損益計算書", "年度累計の損失", false, false],
    ["research_and_development_expense", "研究開発費", [/研究開発費(?:総額)?([\d,]+)(千円|百万円|億円|円)?/], "annual_cumulative", "附属明細", "年度累計の費用", false, false],
    ["capital_expenditure", "設備投資", [/設備投資(?:額)?([\d,]+)(千円|百万円|億円|円)?/], "annual_cumulative", "事業報告", "年度累計の投資支出", false, false],
    ["jkiss_financing", "J-KISS調達", [/J[\s-]?KISS(?:による)?(?:調達|資金調達|発行)?(?:額|累計)?([\d,]+)(千円|百万円|億円|円)?/i], "financing_cash_flow", "事業報告", "資金調達CF。事業売上ではない", false, false],
    ["borrowings", "借入", [/(?:借入金|借入)(?:額)?([\d,]+)(千円|百万円|億円|円)?/], "financing_cash_flow", "貸借対照表", "資金調達CF。負債を伴う", false, false],
    ["subsidy_deposit_current", "補助金預り金（流動）", [/(?:流動|短期)(?:の)?(?:前受金|預り金|補助金預り金)([\d,]+)(千円|百万円|億円|円)?/], "grant_deposit", "貸借対照表", "受領済み預り。売上未計上", false, false],
    ["subsidy_deposit_long_term", "補助金預り金（長期）", [/(?:長期)(?:の)?(?:前受金|預り金|補助金預り金)([\d,]+)(千円|百万円|億円|円)?/], "grant_deposit", "貸借対照表", "受領済み預り。売上未計上", false, false],
    ["sbir_grant_cap", "SBIR上限", [/SBIR[^\n]{0,100}?(?:上限|最大)([\d,.]+)(億円|億|百万円|千円|円)/i], "grant_commitment_cap", "事業報告", "条件付き上限。受領額ではない", false, false],
    ["nedo_grant_cap", "NEDO上限", [/NEDO[^\n]{0,100}?(?:上限|最大)([\d,.]+)(億円|億|百万円|千円|円)/i], "grant_commitment_cap", "事業報告", "条件付き上限。受領額ではない", false, false],
    ["sushi_tech_grant_cap", "SusHi Tech上限", [/SusHiTech[^\n]{0,100}?(?:上限|最大)([\d,.]+)(億円|億|百万円|千円|円)/i], "grant_commitment_cap", "事業報告", "条件付き上限。受領額ではない", false, false],
  ] as const;
  const facts: ImportantEvidenceFact[] = specs.map(([key, label, patterns, temporal, section, treatment, revenue, companyValue]) => {
    const found = findAmount(compact, patterns);
    const due = grantDue(compact, key);
    return {
      fact_key: key, label, value_text: found?.evidence || null, value_number: found?.valueYen ?? null, value_yen: found?.valueYen ?? null, unit: "JPY",
      value_status: found ? "observed" : "missing", temporal_class: temporal,
      period_start: temporal === "period_end_balance" ? null : period.start,
      period_end: temporal === "period_end_balance" ? null : period.end,
      as_of_date: temporal === "period_end_balance" ? period.end : null,
      due_at: due?.date || null, due_precision: due?.precision || "none", status: found ? temporal === "grant_commitment_cap" ? "conditional_cap" : temporal === "grant_deposit" ? "received_on_account" : "reported" : "missing",
      accounting_treatment: treatment, include_in_revenue: revenue, include_in_company_value: companyValue,
      provenance: found ? provenance(primary, section, found.evidence, "observed") : null,
    };
  });
  const current = facts.find((fact) => fact.fact_key === "subsidy_deposit_current");
  const longTerm = facts.find((fact) => fact.fact_key === "subsidy_deposit_long_term");
  const count = [current, longTerm].filter((fact) => fact?.value_yen != null).length;
  const total = current?.value_yen != null && longTerm?.value_yen != null ? current.value_yen + longTerm.value_yen : null;
  facts.push({ fact_key: "subsidy_deposit_total", label: "補助金預り金合計", value_text: null, value_number: total, value_yen: total, unit: "JPY", value_status: count === 2 ? "calculated" : count ? "inferred" : "missing", temporal_class: "grant_deposit", period_start: null, period_end: null, as_of_date: period.end, due_at: null, due_precision: "none", status: count ? "received_on_account" : "missing", accounting_treatment: "流動・長期の補助金預り金合計。売上未計上", include_in_revenue: false, include_in_company_value: false, provenance: null });
  return facts;
}

function extractDueItems(primary: { input: ImportantEvidenceInput; text: string; contentHash: string }, facts: ImportantEvidenceFact[]) {
  const out: ImportantEvidenceCandidate["due_items"] = [];
  for (const fact of facts) {
    if (!fact.due_at || !fact.provenance) continue;
    // 補助金の完了・確定見込みは事実の時間属性であり、まさへの対応期限ではない。
    if (fact.temporal_class === "grant_commitment_cap") continue;
    out.push({ due_at: fact.due_at, precision: fact.due_precision === "month" ? "month" : "day", label: fact.label, status: "observed", provenance: fact.provenance });
  }
  const compact = primary.text.replace(/\s+/g, "");
  const matches = [
    ...compact.matchAll(/(?:提出期限|回答期限|申請期限|支払期限|振込期限|締切)[:：]?((?:令和\d+年|20\d{2}年)\d{1,2}月\d{1,2}日)/g),
    ...compact.matchAll(/((?:令和\d+年|20\d{2}年)\d{1,2}月\d{1,2}日)までに(?:提出|回答|申請|支払|振込)/g),
  ];
  for (const match of matches.slice(0, 20)) {
    const dueAt = parseJapaneseDate(match[1]);
    if (!dueAt) continue;
    const evidence = match[0].slice(0, 220);
    out.push({ due_at: dueAt, precision: "day", label: "期限", status: "observed", provenance: provenance(primary, "期限", evidence, "observed") });
  }
  return dedupeBy(out, (item) => `${item.due_at}:${item.provenance.evidence_sha256}`).sort((a, b) => a.due_at.localeCompare(b.due_at));
}

function buildBzmProjection(facts: ImportantEvidenceFact[], informationDate: string): ImportantEvidenceCandidate["bzm_input_candidates"] {
  const entries = [
    ["cash_balance_at_period_end", "cash_and_deposits", "期末時点の観測値。現行評価日の現預金へ時点補正なしで直結しない"],
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
    const fact = facts.find((item) => item.fact_key === factKey);
    return { parameter_key: parameterKey, value: fact?.value_yen ?? null, unit: "JPY", value_status: fact?.value_status === "calculated" ? "calculated" : fact?.value_status === "observed" ? "observed" : "missing", information_date: informationDate, temporal_scope: fact?.as_of_date || [fact?.period_start, fact?.period_end].filter(Boolean).join("/") || "unknown", use_rule: useRule, source_fact_key: factKey, review_status: "candidate" };
  });
}

function parseEffectivePeriod(text: string): { start: string; end: string } | null {
  const compact = normalizeEvidenceText(text).replace(/\s+/g, "");
  const date = "((?:令和|平成)?\\d{1,4}年\\d{1,2}月\\d{1,2}日|20\\d{2}[-/.]\\d{1,2}[-/.]\\d{1,2})";
  const match = compact.match(new RegExp(`(?:対象期間|事業年度)?(?:自)?${date}(?:から|〜|~|至)${date}`));
  if (!match) return null;
  const start = parseJapaneseDate(match[1]);
  const end = parseJapaneseDate(match[2]);
  return start && end && start <= end ? { start, end } : null;
}

function parseAudit(text: string): { audited: boolean; opinion: "unqualified" | "other" | "unknown"; signedOn: string | null } {
  const compact = normalizeEvidenceText(text).replace(/\s+/g, "");
  const audited = /監査報告/.test(compact);
  const opinion = /(?:適正|適法かつ正確|相当である)/.test(compact) ? "unqualified" : audited ? "other" : "unknown";
  const match = compact.match(/監査報告[\s\S]{0,800}?((?:令和|平成)?\d{1,4}年\d{1,2}月\d{1,2}日)/);
  return { audited, opinion, signedOn: match ? parseJapaneseDate(match[1]) : null };
}

function findAmount(text: string, patterns: readonly RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw = Number(String(match[1]).replaceAll(",", ""));
    if (!Number.isFinite(raw)) continue;
    const before = text.slice(Math.max(0, (match.index || 0) - 500), match.index || 0);
    const unit = match[2] || [...before.matchAll(/単位[:：]?(億円|百万円|千円|円)/g)].at(-1)?.[1];
    if (!unit) continue;
    const multiplier = unit.startsWith("億") ? 100_000_000 : unit === "百万円" ? 1_000_000 : unit === "千円" ? 1_000 : 1;
    return { valueYen: raw * multiplier, evidence: match[0].slice(0, 220) };
  }
  return null;
}

function grantDue(text: string, factKey: string): { date: string; precision: "month" | "fiscal_year" } | null {
  const label = factKey.startsWith("sbir") ? "SBIR" : factKey.startsWith("nedo") ? "NEDO" : factKey.startsWith("sushi") ? "SusHiTech" : null;
  if (!label) return null;
  const near = text.match(new RegExp(`${label}.{0,220}?(?:最終(?:確定|精算|金額|支給|交付)|完了|終了).{0,80}?((?:令和|平成)?\\d{1,4}年\\d{1,2}月)`));
  if (near) {
    const parsed = parseJapaneseMonth(near[1]);
    if (parsed) return { date: endOfMonth(parsed), precision: "month" };
  }
  const fy = text.match(new RegExp(`${label}.{0,220}?(20\\d{2})年度`));
  return fy ? { date: `${Number(fy[1]) + 1}-03-31`, precision: "fiscal_year" } : null;
}

function provenance(primary: { input: ImportantEvidenceInput; contentHash: string }, section: string, evidenceValue: string, observationKind: ObservationKind): FieldProvenance {
  const rawEvidence = normalizeEvidenceText(evidenceValue).slice(0, 300);
  const compactEvidence = rawEvidence.replace(/\s+/g, "");
  const page = primary.input.page_markers?.find((marker) => normalizeEvidenceText(marker.text).replace(/\s+/g, "").includes(compactEvidence))?.page ?? null;
  const evidence = sanitizeImportantEvidenceText(rawEvidence, 300);
  return {
    source: primary.input.source,
    source_ref: sanitizeImportantEvidenceText(primary.input.source_ref, 500),
    content_sha256: primary.contentHash,
    section: sanitizeImportantEvidenceText(section, 240),
    page,
    evidence_text: evidence,
    evidence_sha256: sha256(evidence),
    extraction_method: primary.input.extraction_method,
    observation_kind: observationKind,
  };
}

function routeTargets(categories: ImportanceCategory[], semantic: ProposedL2Target[] | undefined): ProposedL2Target[] {
  const targets = new Set<ProposedL2Target>(["important_evidence"]);
  for (const category of categories) {
    const target = CATEGORY_SPECS.find((spec) => spec.category === category)?.target;
    if (target) targets.add(target);
  }
  for (const target of semantic || []) targets.add(target);
  return [...targets];
}

function classifyDocument(categories: ImportanceCategory[], text: string, materialKind: MaterialKind): string {
  if (categories.includes("financial") && /(?:事業報告|計算書類|貸借対照表|損益計算書)/.test(text)) return "annual_financial_package";
  if (categories.includes("financial")) return "financial_record";
  if (categories.includes("governance")) return "governance_record";
  if (categories.includes("contract")) return "contract_record";
  if (categories.includes("funding")) return "funding_record";
  if (categories.includes("grant")) return "grant_record";
  if (categories.includes("technical")) return "technical_record";
  if (categories.includes("project_plan")) return "project_plan";
  if (categories.includes("risk_compliance")) return "risk_record";
  if (categories.includes("personnel")) return "personnel_record";
  if (categories.includes("commercial")) return "commercial_record";
  return materialKind === "document" ? "other_important_document" : "important_correspondence";
}

function parseJapaneseDate(value: string): string | null {
  const normalized = String(value || "").normalize("NFKC").replace(/\s+/g, "");
  const western = normalized.match(/^(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (western) return validYmd(Number(western[1]), Number(western[2]), Number(western[3]));
  const era = normalized.match(/^(令和|平成)(\d{1,2})年(\d{1,2})月(\d{1,2})日$/);
  if (!era) return null;
  const year = Number(era[2]) + (era[1] === "令和" ? 2018 : 1988);
  return validYmd(year, Number(era[3]), Number(era[4]));
}

function parseJapaneseMonth(value: string): string | null {
  const normalized = String(value || "").normalize("NFKC").replace(/\s+/g, "");
  const western = normalized.match(/^(20\d{2})年(\d{1,2})月$/);
  if (western) return `${western[1]}-${String(western[2]).padStart(2, "0")}`;
  const era = normalized.match(/^(令和|平成)(\d{1,2})年(\d{1,2})月$/);
  if (!era) return null;
  return `${Number(era[2]) + (era[1] === "令和" ? 2018 : 1988)}-${String(era[3]).padStart(2, "0")}`;
}

function endOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}

function semanticObservationIsGrounded(text: string, observed: SemanticObservation): boolean {
  const evidence = normalizeEvidenceText(observed.evidence_text || "");
  if (!evidence || !text.includes(evidence)) return false;
  const compactEvidence = evidence.replace(/[\s,，]/g, "").toLowerCase();
  const valueText = normalizeEvidenceText(observed.value_text || "").replace(/[\s,，]/g, "").toLowerCase();
  if (valueText) return compactEvidence.includes(valueText);
  if (observed.value_number == null) return true;
  return compactEvidence.includes(String(observed.value_number).replace(/[\s,，]/g, ""));
}

function validYmd(year: number, month: number, day: number): string | null {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() + 1 !== month || value.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function snippetForPattern(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match || match.index == null) return pattern.source.slice(0, 180);
  return text.slice(Math.max(0, match.index - 70), Math.min(text.length, match.index + match[0].length + 120)).replace(/\s+/g, " ").slice(0, 240);
}

function normalizeAlias(value: string): string {
  return normalizeEvidenceText(value).toLowerCase().replace(/株式会社|合同会社|有限会社|一般社団法人|inc\.?|corp\.?/gi, "").replace(/\s+/g, "").trim();
}

function normalizeTitleFamily(value: string): string {
  return normalizeEvidenceText(value).toLowerCase().replace(/(?:コピー|copy|複製|最終|final|確定|改訂|rev\.?\s*\d+|v\d+(?:\.\d+)*)/gi, "").replace(/[\s_\-（）()\[\]]+/g, "").slice(0, 120) || "untitled";
}

function sortableTime(input: ImportantEvidenceInput): string { return input.modified_at || input.created_at || "0000-00-00T00:00:00.000Z"; }
function extractionPriority(input: ImportantEvidenceInput): number {
  if (input.extraction_status === "available" && input.text_is_excerpt !== true) return 4;
  if (input.extraction_status === "partial" && input.text_is_excerpt !== true) return 3;
  if (input.extraction_status === "available") return 2;
  if (input.extraction_status === "partial") return 1;
  return 0;
}
function newestLineageTime(candidate: ImportantEvidenceCandidate): string {
  return candidate.lineage.reduce((latest, item) => {
    const value = item.modified_at || item.created_at || "0000-00-00T00:00:00.000Z";
    return value > latest ? value : latest;
  }, "0000-00-00T00:00:00.000Z");
}
function unique(values: string[]): string[] { return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]; }
function dedupeBy<T>(values: T[], key: (value: T) => string): T[] { const seen = new Set<string>(); return values.filter((value) => { const k = key(value); if (seen.has(k)) return false; seen.add(k); return true; }); }
function categoryLabel(value: ImportanceCategory): string { return ({ financial: "決算・財務", governance: "会社運営", contract: "契約", funding: "資金調達", grant: "補助金・採択", technical: "技術・知財", project_plan: "事業計画", commercial: "事業進展", risk_compliance: "リスク・法令", personnel: "人事", deadline: "期限", other: "その他" } as Record<ImportanceCategory, string>)[value]; }
