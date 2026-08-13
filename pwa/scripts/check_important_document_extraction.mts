import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { strToU8, zipSync } from "fflate";
import { extractSourceText } from "../src/lib/sources/source-material-text.ts";
import {
  importantEvidenceFactMustExcludeFromValue,
  normalizeImportantEvidenceMaterialKind,
  normalizeImportantEvidenceTemporalClass,
  sanitizeImportantEvidenceText,
} from "../src/lib/important-evidence-text.ts";
import {
  extractImportantEvidence,
  toImportantEvidenceOutbox,
  type ImportantEvidenceBatch,
} from "./lib/important_evidence_extraction.mts";
import {
  extractImportantDocuments,
  type ImportantDocumentBatch,
} from "./lib/important_document_extraction.mts";

const here = path.dirname(fileURLToPath(import.meta.url));
const legacyFixture = JSON.parse(fs.readFileSync(path.join(here, "__fixtures__/important_document_lst_financial_package.json"), "utf8")) as ImportantDocumentBatch;

// LST is the first regression case, not a hard-coded exception.
const lstResult = extractImportantDocuments(legacyFixture);
assert.equal(lstResult.candidates.length, 1, "同一内容3コピーは1候補へ束ねる");
assert.equal(lstResult.skipped.length, 0);
const lst = lstResult.candidates[0];
assert.equal(lst.candidate_kind, "important_evidence");
assert.equal(lst.project_id, "p07");
assert.equal(lst.document_class, "annual_financial_package");
assert.equal(lst.effective_period_start, "2025-04-01");
assert.equal(lst.effective_period_end, "2026-03-31");
assert.equal(lst.audited, true);
assert.equal(lst.audit_signed_on, "2026-05-28");
assert.equal(lst.lineage.length, 3);
assert.deepEqual(lst.lineage.map((item) => item.parent_folders[0]).sort(), [
  "260616_取締役会書面決議",
  "260624_第3回定時株主総会",
  "260710_第3回定時株主総会",
]);
assert.equal(lst.canonical_source_ref, "drive-file:fixture-lst-copy-b");
assert.ok(lst.importance.categories.includes("financial"));
assert.ok(lst.importance.categories.includes("funding"));
assert.ok(lst.importance.categories.includes("grant"));

const facts = new Map(lst.facts.map((fact) => [fact.fact_key, fact]));
const expectFact = (key: string, value: number, temporalClass: string) => {
  const fact = facts.get(key);
  assert.ok(fact, `${key} must exist`);
  assert.equal(fact.value_yen, value, `${key} value`);
  assert.equal(fact.value_status, key === "subsidy_deposit_total" ? "calculated" : "observed");
  assert.equal(fact.temporal_class, temporalClass);
  if (fact.value_status === "observed") {
    assert.ok(fact.provenance?.section, `${key} section provenance`);
    assert.match(fact.provenance?.evidence_sha256 || "", /^[0-9a-f]{64}$/);
    assert.equal(fact.provenance?.observation_kind, "observed");
  }
};
expectFact("cash_and_deposits", 46_080_000, "period_end_balance");
expectFact("net_sales", 450_000, "annual_cumulative");
expectFact("operating_loss", 348_873_000, "annual_cumulative");
expectFact("net_loss", 351_426_000, "annual_cumulative");
expectFact("research_and_development_expense", 302_089_000, "annual_cumulative");
expectFact("capital_expenditure", 121_912_000, "annual_cumulative");
expectFact("jkiss_financing", 110_000_000, "financing_cash_flow");
expectFact("borrowings", 83_000_000, "financing_cash_flow");
expectFact("subsidy_deposit_total", 571_678_000, "grant_deposit");
expectFact("sbir_grant_cap", 1_500_000_000, "grant_commitment_cap");
expectFact("nedo_grant_cap", 300_000_000, "grant_commitment_cap");
expectFact("sushi_tech_grant_cap", 200_000_000, "grant_commitment_cap");
for (const key of ["jkiss_financing", "borrowings", "subsidy_deposit_total", "sbir_grant_cap", "nedo_grant_cap", "sushi_tech_grant_cap"]) {
  assert.equal(facts.get(key)?.include_in_revenue, false, `${key} is not revenue`);
  assert.equal(facts.get(key)?.include_in_company_value, false, `${key} is not direct company value`);
}
assert.equal(facts.get("sbir_grant_cap")?.due_at, "2028-03-31");
assert.equal(facts.get("sushi_tech_grant_cap")?.due_at, null, "根拠のない締切を0や推定日で埋めない");
assert.equal(lst.bzm_input_candidates.find((item) => item.parameter_key === "financing_cf_jkiss")?.value, 110_000_000);
assert.match(lst.bzm_input_candidates.find((item) => item.parameter_key === "financing_cf_jkiss")?.use_rule || "", /会社価値へ直加点しない/);

// PDF由来の空白と和暦でも期間・監査日を読める。
const spaced = structuredClone(legacyFixture);
spaced.documents = [{
  ...spaced.documents[0],
  file_id: "spaced-pdf",
  content_sha256: null,
  text: spaced.documents[0].text
    .replace("2025年4月1日から2026年3月31日", "令 和 7 年 4 月 1 日 か ら 令 和 8 年 3 月 31 日")
    .replace("2026年5月28日", "令 和 8 年 5 月 28 日"),
}];
const spacedCandidate = extractImportantDocuments(spaced).candidates[0];
assert.equal(spacedCandidate.effective_period_start, "2025-04-01");
assert.equal(spacedCandidate.effective_period_end, "2026-03-31");
assert.equal(spacedCandidate.audit_signed_on, "2026-05-28");

// Office stored files are real binary fixtures, not MIME-only placeholders.
const docxBytes = zipSync({
  "word/document.xml": strToU8("<w:document><w:body><w:p><w:r><w:t>LiSTie株式会社 技術報告 量産試作の性能評価を完了</w:t></w:r></w:p></w:body></w:document>"),
});
const xlsxBytes = zipSync({
  "xl/sharedStrings.xml": strToU8("<sst><si><t>LiSTie株式会社</t></si><si><t>資金計画</t></si></sst>"),
  "xl/worksheets/sheet1.xml": strToU8("<worksheet><sheetData><row><c t=\"s\"><v>0</v></c><c t=\"s\"><v>1</v></c><c><v>120000</v></c></row></sheetData></worksheet>"),
});
const pptxBytes = zipSync({
  "ppt/slides/slide1.xml": strToU8("<p:sld><a:p><a:r><a:t>LiSTie株式会社 事業計画 ロードマップ</a:t></a:r></a:p></p:sld>"),
});
const [docx, xlsx, pptx] = await Promise.all([
  extractSourceText({ bytes: docxBytes, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename: "技術報告.docx" }),
  extractSourceText({ bytes: xlsxBytes, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "資金計画.xlsx" }),
  extractSourceText({ bytes: pptxBytes, mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", filename: "事業計画.pptx" }),
]);
assert.equal(docx.method, "office_text");
assert.match(docx.text, /技術報告/);
assert.match(xlsx.text, /資金計画/);
assert.match(pptx.text, /ロードマップ/);
const xlsm = await extractSourceText({ bytes: xlsxBytes, mimeType: "application/vnd.ms-excel.sheet.macroenabled.12", filename: "承認済事業計画.xlsm" });
assert.equal(xlsm.method, "office_text", "macro-enabled Excelも同じOffice本文経路で読む");
assert.match(xlsm.text, /資金計画/);
const docxByFilename = await extractSourceText({ bytes: docxBytes, mimeType: "application/octet-stream", filename: "技術報告.docx" });
const xlsmByFilename = await extractSourceText({ bytes: xlsxBytes, mimeType: "application/octet-stream", filename: "承認済事業計画.xlsm" });
assert.equal(docxByFilename.method, "office_text", "汎用MIMEでも標準Office拡張子を退行させない");
assert.equal(xlsmByFilename.method, "office_text", "汎用MIMEでもmacro-enabled Office拡張子を読む");

const pdfDocument = await PDFDocument.create();
const pdfPage = pdfDocument.addPage();
const font = await pdfDocument.embedFont(StandardFonts.Helvetica);
pdfPage.drawText("NDA contract signed", { x: 40, y: 700, font, size: 12 });
const pdfText = await extractSourceText({ bytes: new Uint8Array(await pdfDocument.save()), mimeType: "application/pdf", filename: "contract.pdf" });
assert.equal(pdfText.method, "pdf_text");
assert.match(pdfText.text, /NDA contract signed/);

const scannedPdf = await PDFDocument.create();
scannedPdf.addPage();
const ocrText = await extractSourceText({
  bytes: new Uint8Array(await scannedPdf.save()),
  mimeType: "application/pdf",
  filename: "scan.pdf",
  ocr: async () => ({ text: "LiSTie株式会社 取締役会書面決議 承認済み" }),
});
assert.equal(ocrText.method, "ocr");
assert.equal(ocrText.needsOcr, false);

// 決算書以外・Drive以外も同じ共通分類へ入る。
const batch: ImportantEvidenceBatch = {
  project: { project_id: "p07", company_name: "LiSTie株式会社", company_aliases: ["LiSTie", "リスティ"], project_aliases: ["LST"], drive_folder_id: "p07-root" },
  observed_at: "2026-08-12T00:00:00.000Z",
  materials: [
    { source: "drive", source_ref: "drive-file:tech-docx", material_kind: "document", title: "技術報告.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", parent_folders: ["LST", "技術"], project_root_matched: true, text: docx.text, extraction_method: "office_text", extraction_status: "available" },
    { source: "drive", source_ref: "drive-file:plan-xlsx", material_kind: "document", title: "資金計画.xlsx", mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", parent_folders: ["LST", "経営"], project_root_matched: true, text: xlsx.text, extraction_method: "office_text", extraction_status: "available" },
    { source: "gmail", source_ref: "gmail-message:contract", material_kind: "message", title: "NDA契約書の押印依頼", mime_type: "text/plain", text: "LiSTie株式会社 御中\nNDA契約書の押印を2026年8月20日までに回答してください。", extraction_method: "native_text", extraction_status: "available" },
    { source: "calendar", source_ref: "calendar-event:board", material_kind: "event", title: "LiSTie 取締役会", text: "LiSTie株式会社 取締役会 量産計画を決議", extraction_method: "native_text", extraction_status: "available" },
    { source: "slack", source_ref: "slack:funding", material_kind: "thread", title: "LiSTie 資金調達方針", text: "LiSTie株式会社のJ-KISSラウンド条件を協議", extraction_method: "native_text", extraction_status: "available" },
    { source: "notion", source_ref: "notion-page:research", material_kind: "page", title: "LiSTie 研究メモ", project_root_matched: true, text: "LiSTie株式会社の触媒耐久試験で寿命が従来比2倍になった。", extraction_method: "native_text", extraction_status: "available", semantic_classification: { salient: true, categories: ["technical"], reasons: ["性能を変える再現試験結果"], proposed_targets: ["strategy_signal"], observations: [{ fact_key: "catalyst_lifetime", label: "触媒寿命", value_text: "従来比2倍", value_number: 2, unit: "ratio", observation_kind: "observed", section: "試験結果", evidence_text: "触媒耐久試験で寿命が従来比2倍になった。", status: "reported" }] } },
    { source: "drive", source_ref: "drive-file:scanned-board", material_kind: "document", title: "取締役会書面決議.pdf", mime_type: "application/pdf", parent_folders: ["260812_取締役会"], project_root_matched: true, text: "", extraction_method: "metadata_only", extraction_status: "missing", extraction_warning: "pdf_text_missing" },
  ],
};
const generic = extractImportantEvidence(batch);
assert.equal(generic.candidates.length, 7);
assert.ok(generic.candidates.some((candidate) => candidate.document_class === "technical_record" && candidate.mime_type?.includes("wordprocessingml")), "Word本文から技術情報を候補化");
assert.ok(generic.candidates.some((candidate) => candidate.document_class === "project_plan" && candidate.mime_type?.includes("spreadsheetml")), "Excel本文から計画を候補化");
assert.ok(generic.candidates.some((candidate) => candidate.source === "gmail" && candidate.proposed_targets.includes("contract_signal")));
assert.ok(generic.candidates.some((candidate) => candidate.source === "calendar" && candidate.proposed_targets.includes("shareholder_meeting")));
assert.ok(generic.candidates.some((candidate) => candidate.source === "slack" && candidate.proposed_targets.includes("strategy_signal")));
const notion = generic.candidates.find((candidate) => candidate.source === "notion");
assert.equal(notion?.facts.find((fact) => fact.fact_key === "catalyst_lifetime")?.value_number, 2);
assert.equal(notion?.facts.find((fact) => fact.fact_key === "catalyst_lifetime")?.temporal_class, "not_applicable", "未指定の時間分類だけをnot_applicableへ補完する");
const ungrounded = extractImportantEvidence({
  project: batch.project,
  observed_at: "2026-08-12T00:00:00.000Z",
  materials: [{
    source: "notion",
    source_ref: "notion-page:ungrounded",
    material_kind: "page",
    title: "LiSTie 技術報告",
    project_root_matched: true,
    text: "LiSTie株式会社の耐久試験を実施した。",
    extraction_method: "native_text",
    extraction_status: "available",
    semantic_classification: {
      salient: true,
      categories: ["technical"],
      reasons: ["技術結果"],
      observations: [{
        fact_key: "invented_result",
        label: "捏造防止",
        value_text: "従来比10倍",
        value_number: 10,
        unit: "ratio",
        observation_kind: "observed",
        section: "試験結果",
        evidence_text: "LiSTie株式会社の耐久試験を実施した。",
      }],
    },
  }],
});
assert.equal(ungrounded.candidates[0]?.facts.length, 0, "原文根拠に値がない意味抽出fieldは保存しない");
assert.equal(notion?.facts.find((fact) => fact.fact_key === "catalyst_lifetime")?.provenance?.observation_kind, "observed");
const planInference = extractImportantEvidence({
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [{
    source: "notion", source_ref: "notion-page:forecast", material_kind: "page", title: "LiSTie 事業計画", project_root_matched: true,
    text: "2028年に商業化する計画。", extraction_method: "native_text", extraction_status: "available",
    semantic_classification: { salient: true, categories: ["project_plan"], reasons: ["明示された計画"], observations: [{ fact_key: "commercialization_plan", label: "商業化計画", value_text: "2028年", observation_kind: "observed", section: "事業計画", evidence_text: "2028年に商業化する計画。", status: "planned" }] },
  }],
});
assert.equal(planInference.candidates[0]?.facts[0]?.value_status, "inferred", "原文にある計画・予測を実績observedへ昇格しない");
const observedUnverified = extractImportantEvidence({
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [{
    source: "drive", source_ref: "drive-file:observed-term", material_kind: "document", title: "LiSTie 契約書", project_root_matched: true,
    text: "契約金額は1,000万円。", extraction_method: "native_text", extraction_status: "available",
    semantic_classification: { salient: true, categories: ["contract"], reasons: ["契約条項"], observations: [{ fact_key: "contract_amount", label: "契約金額", value_text: "1,000万円", observation_kind: "observed", section: "契約条項", evidence_text: "契約金額は1,000万円。", status: "contract_term_execution_unverified" }] },
  }],
});
assert.equal(observedUnverified.candidates[0]?.facts[0]?.value_status, "observed", "原文で確認した契約条項は履行未確認でも推定へ落とさない");
const observedRisk = extractImportantEvidence({
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [{
    source: "notion", source_ref: "notion-page:observed-risk", material_kind: "page", title: "LiSTie 安全報告", project_root_matched: true,
    text: "強アルカリ液の漏出事故を2件確認し、安全上の課題として報告した。", extraction_method: "native_text", extraction_status: "available",
    semantic_classification: { salient: true, categories: ["risk_compliance"], reasons: ["安全事故"], observations: [{ fact_key: "alkaline_incidents", label: "強アルカリ漏出事故", value_text: "2件", value_number: 2, unit: "件", observation_kind: "observed", section: "安全報告", evidence_text: "強アルカリ液の漏出事故を2件確認し、安全上の課題として報告した。", status: "reported" }] },
  }],
});
assert.equal(observedRisk.candidates[0]?.facts[0]?.value_status, "observed", "原文で確認した事故やリスク認識は、語だけで推定へ落とさない");
const explicitObservedStatuses = extractImportantEvidence({
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [{
    source: "drive", source_ref: "drive-file:explicit-observed-statuses", material_kind: "document", title: "LiSTie 進捗報告", project_root_matched: true,
    text: "開発費不足を確認し、予算計画の再整理を依頼済み。膜寿命は未確定で、追加測定を予定している。出力目標を達成した。", extraction_method: "office_text", extraction_status: "available",
    semantic_classification: { salient: true, categories: ["technical", "project_plan", "risk_compliance"], reasons: ["直接確認した進捗"], observations: [
      { fact_key: "budget_shortfall_observed", label: "開発費不足", observation_kind: "observed", section: "進捗", evidence_text: "開発費不足を確認し、予算計画の再整理を依頼済み。", status: "observed_reported_risk" },
      { fact_key: "lifetime_missing_observed", label: "膜寿命未確定", observation_kind: "observed", section: "進捗", evidence_text: "膜寿命は未確定で、追加測定を予定している。", status: "observed_missing_measurement" },
      { fact_key: "target_achievement_observed", label: "出力目標達成", observation_kind: "observed", section: "進捗", evidence_text: "出力目標を達成した。", status: "observed_reported_achievement" },
    ] },
  }],
});
assert.deepEqual(
  explicitObservedStatuses.candidates[0]?.facts.map((fact) => fact.value_status),
  ["observed", "observed", "observed"],
  "明示observed_*は根拠文の計画・予定・目標だけでinferredへ誤降格しない",
);
const financialClassFromTitle = extractImportantEvidence({
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [{
    source: "drive", source_ref: "drive-file:historical-financial", material_kind: "document", title: "LiSTie 第2期事業報告・計算書類.docx", project_root_matched: true,
    text: "LiSTie株式会社。対象期間2024年4月1日から2025年3月31日。売上高は0千円。", text_is_excerpt: true, extraction_method: "office_text", extraction_status: "partial",
    semantic_classification: { salient: true, categories: ["financial"], reasons: ["正式な年度実績"] },
  }],
});
assert.equal(financialClassFromTitle.candidates[0]?.document_class, "annual_financial_package", "本文抜粋に書類名がなくても正式なファイル名を分類へ使う");
const financingClassification = extractImportantEvidence({
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [{
    source: "slack", source_ref: "slack:financing-no-flags", material_kind: "thread", title: "LiSTie 資金調達", project_root_matched: true,
    text: "LiSTie株式会社はJ-KISSで5,000万円を調達する計画。", extraction_method: "native_text", extraction_status: "available",
    semantic_classification: { salient: true, categories: ["funding"], reasons: ["資金調達計画"], observations: [{ fact_key: "jkiss_plan", label: "J-KISS調達計画", value_text: "5,000万円", value_number: 50_000_000, unit: "JPY", observation_kind: "observed", temporal_class: "financing_cash_flow", section: "資金調達", evidence_text: "LiSTie株式会社はJ-KISSで5,000万円を調達する計画。", status: "planned" }] },
  }],
});
const financingFact = financingClassification.candidates[0]?.facts[0];
assert.equal(financingFact?.value_status, "inferred", "調達計画を着金実績にしない");
assert.equal(financingFact?.include_in_revenue, false, "調達はフラグ未指定でも売上へ入れない");
assert.equal(financingFact?.include_in_company_value, false, "調達はフラグ未指定でも会社価値へ直加点しない");

// 本番候補で発覚した14件のroute阻害を、raw本文を持たない最小fixtureで固定する。
// source_hashは同じcandidateの回帰識別用。説明的な時間分類は実績へ昇格させず、
// SBIR/NEDOの制度名だけを理由に技術目標・契約状態へ財務flagを要求しない。
const routeRegressionCandidates = [
  { source_hash: "22d6284e98529d5f033a3d6884197c75a8e03ac82af6c5961f8e9b445262e4e6", facts: [
    { fact_key: "sbir_contract_listie_internal_approval", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "sbir_contract_qst_internal_approval", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "sbir_contract_signature_state", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
  ] },
  { source_hash: "ffd882bde6d6e7a3d2bce3d8f2191091fdeb4ed656da7dea26f087220f690467", facts: [
    { fact_key: "tyk_nedo_contract_adjustment_2026", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "tyk_nedo_budget_plan_2026", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
  ] },
  { source_hash: "0cb94ef41e62e7f78e76f9e094abe032a6b71fe66859291a606d3e834598099c", facts: [
    { fact_key: "sbir_formal_project_end", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
  ] },
  { source_hash: "0528f294e52c138824e8f1259aff93500affbcb245682c8d35126ea11839a7cf", facts: [
    { fact_key: "sbir_purity_target", temporal_class: "not_applicable", value_number: 99.99, unit: "percent", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "sbir_stage_gate_2025", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "sbir_stage_gate_2026", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "sbir_stage_gate_2027", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "sbir_business_model", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "sbir_cost_comparison_risk", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
  ] },
  { source_hash: "ea3944176b14e04e506fb245f95fa76a07d4b3e0b02920680202364467f8e3c3", facts: [
    { fact_key: "sbir_reproducibility_risk", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "sbir_standard_cell_plan", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
    { fact_key: "sbir_supplier_pipeline_plan", temporal_class: "not_applicable", include_in_revenue: null, include_in_company_value: null },
  ] },
  { source_hash: "e30584df4e5132963f13c8534b3afa4047a20a35830492b1a1a728b7ea744912", facts: [
    { fact_key: "unit_2_payment_schedule_2026", temporal_class: "capital_expenditure_cash_schedule", include_in_revenue: false, include_in_company_value: false },
    { fact_key: "sbir_reimbursement_timing_risk_unit_2_2026", temporal_class: "grant_reimbursement_timing", include_in_revenue: false, include_in_company_value: false },
  ] },
  { source_hash: "dcf280319f5085519ca0e7e57b091735a3cc786699622c3032e0c500f46d3758", facts: [
    { fact_key: "small_lismic_unit_price_plan_2025", temporal_class: "planned_product_price", include_in_revenue: false, include_in_company_value: false },
  ] },
  { source_hash: "444507a449bdd1a60126949550e8aaa9287ff311f532e1b2d2e445480c7ce15c", facts: [
    { fact_key: "nedo_dtsu_development_cost_early_estimate_2025", temporal_class: "planned_project_cost_estimate", include_in_revenue: false, include_in_company_value: false },
  ] },
  { source_hash: "b1f890bde623daf0254d3add71ae6bded08d50535b79373bfc2a1796f97e2080", facts: [
    { fact_key: "monthly_burn_rate_reported_2026_07", temporal_class: "monthly_actual_or_management_estimate", include_in_revenue: false, include_in_company_value: false },
  ] },
  { source_hash: "5eee9f65143d2c84a471159d7814b1302a95e1796336a730a0c8f5cb71333dd4", facts: [
    { fact_key: "sbir_temporary_facility_cost_breakdown_2024", temporal_class: "planned_project_cost_estimate", include_in_revenue: false, include_in_company_value: false },
    { fact_key: "sbir_temporary_facility_deposit_excluded_2024", temporal_class: "excluded_cost_component", include_in_revenue: false, include_in_company_value: false },
  ] },
  { source_hash: "6ac5a550e177ad0800175f78717ba89b7c89017633066fea062bb559bd6e17b9", facts: [
    { fact_key: "membrane_acceptance_test_cell_approved_2026", temporal_class: "capital_expenditure_commitment", include_in_revenue: false, include_in_company_value: false },
    { fact_key: "waste_li_target_cost_vs_market_2026", temporal_class: "unit_cost_target", include_in_revenue: false, include_in_company_value: false },
  ] },
  { source_hash: "7effc75e000c8d04942a69c28f86ebd34f066cd26b28c588116b15dcfbbf61bd", facts: [
    { fact_key: "membrane_unit_cost_current_and_target_2025", temporal_class: "unit_cost_estimate", include_in_revenue: false, include_in_company_value: false },
    { fact_key: "new_site_contract_cash_need_2025", temporal_class: "planned_contract_cash_outflow", include_in_revenue: false, include_in_company_value: false },
  ] },
  { source_hash: "59dae3cb5eefa60b95e9afec7244d6dffe944d507e078077a615d87cf745be42", facts: [
    { fact_key: "demonstration_unit_2_quote_2026_06", temporal_class: "capital_expenditure_estimate", include_in_revenue: false, include_in_company_value: false },
  ] },
  { source_hash: "9fb3d317b58e6a1872b800d096e739b727c1669be4965699d60a4a38269334b3", facts: [
    { fact_key: "umi_investment_review_stopped_2023", temporal_class: "financing_process_event", include_in_revenue: false, include_in_company_value: false },
  ] },
] as const;
assert.equal(routeRegressionCandidates.length, 14);
for (const candidate of routeRegressionCandidates) {
  for (const fact of candidate.facts) {
    assert.ok(normalizeImportantEvidenceTemporalClass(fact.temporal_class), `${candidate.source_hash}:${fact.fact_key} temporal_class`);
    const excluded = importantEvidenceFactMustExcludeFromValue(fact);
    assert.ok(!excluded || (fact.include_in_revenue === false && fact.include_in_company_value === false), `${candidate.source_hash}:${fact.fact_key} finance flags`);
  }
}
assert.equal(normalizeImportantEvidenceTemporalClass("unbounded_new_class"), null, "未知の分類を無制限に受け入れない");
const semanticTemporalAliasBatch = {
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [{
    source: "notion", source_ref: "notion-page:temporal-alias", material_kind: "page", title: "LiSTie 価格計画", project_root_matched: true,
    text: "LiSTie株式会社の小型装置価格を計画した。", extraction_method: "native_text", extraction_status: "available",
    semantic_classification: { salient: true, categories: ["commercial"], reasons: ["価格計画"], observations: [{ fact_key: "planned_price", label: "価格計画", observation_kind: "observed", temporal_class: "planned_product_price", section: "価格", evidence_text: "小型装置価格を計画した。", status: "planned" }] },
  }],
} as unknown as ImportantEvidenceBatch;
assert.equal(extractImportantEvidence(semanticTemporalAliasBatch).candidates[0]?.facts[0]?.temporal_class, "not_applicable", "既知aliasは実績へ昇格させず有限分類へ畳む");
const unknownSemanticTemporalBatch = structuredClone(semanticTemporalAliasBatch) as unknown as { materials: Array<{ semantic_classification: { observations: Array<{ temporal_class: string }> } }> };
unknownSemanticTemporalBatch.materials[0].semantic_classification.observations[0].temporal_class = "unbounded_new_class";
assert.throws(
  () => extractImportantEvidence(unknownSemanticTemporalBatch as unknown as ImportantEvidenceBatch),
  /unsupported important evidence temporal_class: unbounded_new_class/,
  "未知の非空分類は黙ってnot_applicableへ落とさない",
);
const messageThreadRegressionCandidates = [
  "444507a449bdd1a60126949550e8aaa9287ff311f532e1b2d2e445480c7ce15c",
  "5eee9f65143d2c84a471159d7814b1302a95e1796336a730a0c8f5cb71333dd4",
  "eb1f17ddcf79a71c6aab536a78bae7ccfd079bb8879229abfa48ec7ba9ef9209",
  "7f6626844c9fe05ea8c28d8c347f3fc713751ef560a7acd4287ea7cf3da71486",
  "04dbada4a6c5dcbd2abd7794d17b0bd2dc22a5706ee9a6ec66536d8f14d899be",
];
for (const sourceHash of messageThreadRegressionCandidates) {
  assert.equal(normalizeImportantEvidenceMaterialKind("message_thread"), "thread", `${sourceHash}:message_thread`);
}
assert.equal(normalizeImportantEvidenceMaterialKind("unbounded_new_kind"), null, "未知の資料種別を無制限に受け入れない");
assert.equal(importantEvidenceFactMustExcludeFromValue({ fact_key: "sbir_purity_target", temporal_class: "not_applicable", value_number: 99.99, unit: "percent" }), false, "制度名だけで技術目標を資金CF扱いしない");
assert.equal(importantEvidenceFactMustExcludeFromValue({ fact_key: "sbir_capacity_target", temporal_class: "not_applicable" }), false, "capacity中のcapを補助金上限と誤認しない");
for (const actualCashFact of [
  { fact_key: "jkiss_financing", temporal_class: "financing_cash_flow" },
  { fact_key: "borrowings", temporal_class: "financing_cash_flow" },
  { fact_key: "sbir_grant_cap", temporal_class: "grant_commitment_cap" },
  { fact_key: "subsidy_deposit", temporal_class: "grant_deposit" },
  { fact_key: "sbir_award_amount", temporal_class: "not_applicable", value_number: 100_000_000, value_yen: 100_000_000, unit: "JPY" },
]) {
  assert.equal(importantEvidenceFactMustExcludeFromValue(actualCashFact), true, `${actualCashFact.fact_key} must stay outside revenue/value`);
}
const unread = generic.candidates.find((candidate) => candidate.canonical_source_ref === "drive-file:scanned-board");
assert.equal(unread?.text_read_required, true, "OCR未完を情報なしとして捨てない");
assert.equal(unread?.facts.length, 0, "未読本文から事実を捏造しない");

// 個人情報を残さない抜粋handoffは、全文hashがある時だけ同一内容へ束ねる。
const excerptHash = "b".repeat(64);
const excerptBatch: ImportantEvidenceBatch = {
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [
    { source: "drive", source_ref: "drive-file:excerpt-copy-a", material_kind: "document", title: "LiSTie 事業計画A", project_root_matched: true, text: "LiSTie株式会社 事業計画を承認", text_is_excerpt: true, content_sha256: excerptHash, extraction_method: "native_text", extraction_status: "partial" },
    { source: "drive", source_ref: "drive-file:excerpt-copy-b", material_kind: "document", title: "LiSTie 事業計画B", project_root_matched: true, text: "LiSTie株式会社 事業計画を承認", text_is_excerpt: true, content_sha256: excerptHash, extraction_method: "native_text", extraction_status: "partial" },
    { source: "slack", source_ref: "slack:excerpt-same-words", material_kind: "thread", title: "LiSTie 事業計画", text: "LiSTie株式会社 事業計画を承認", text_is_excerpt: true, extraction_method: "native_text", extraction_status: "partial" },
  ],
};
const excerptResult = extractImportantEvidence(excerptBatch);
assert.equal(excerptResult.candidates.length, 2, "全文hash一致の2コピーだけを束ね、同文の別sourceは分ける");
assert.equal(excerptResult.candidates.find((candidate) => candidate.content_sha256 === excerptHash)?.lineage.length, 2);
assert.equal(excerptResult.candidates.find((candidate) => candidate.content_sha256 === excerptHash)?.text_read_required, true, "取得状態partialは保存抜粋の有無にかかわらず全文未確認にする");

const readCompleteExcerptText = "LiSTie株式会社 研究開発の量産試作を承認";
const readCompleteExcerptHash = crypto.createHash("sha256").update(readCompleteExcerptText).digest("hex");
const readCompleteExcerptResult = extractImportantEvidence({
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [
    { source: "drive", source_ref: "drive-file:available-stored-excerpt", material_kind: "document", title: "LiSTie 取締役会 技術報告", project_root_matched: true, text: readCompleteExcerptText, text_is_excerpt: true, content_sha256: readCompleteExcerptHash, extraction_method: "office_text", extraction_status: "available", extraction_warning: "stored_excerpt_from_full_text" },
    { source: "drive", source_ref: "drive-file:partial-full-text", material_kind: "document", title: "LiSTie 取締役会 技術報告", project_root_matched: true, text: readCompleteExcerptText, extraction_method: "office_text", extraction_status: "partial" },
  ],
});
const readCompleteExcerpt = readCompleteExcerptResult.candidates[0];
assert.equal(readCompleteExcerpt?.canonical_source_ref, "drive-file:available-stored-excerpt", "保存抜粋でも原文取得済みをpartialより優先する");
assert.equal(readCompleteExcerpt?.lineage[0]?.extraction_status, "available", "原文取得・解析完了statusを保存抜粋と分けて残す");
assert.equal(readCompleteExcerpt?.lineage[0]?.text_is_excerpt, true, "保存payloadが抜粋であることをlineageへ明示する");
assert.equal(readCompleteExcerpt?.lineage[0]?.extraction_warning, "stored_excerpt_from_full_text", "保存payloadが抜粋であることは別fieldへ残す");
assert.equal(readCompleteExcerpt?.text_read_required, false, "全文fetch・parse成功なら保存payloadが抜粋でも再読取不要にする");
assert.doesNotMatch(toImportantEvidenceOutbox(readCompleteExcerptResult).coverageGaps[0]?.summary || "", /全文は未確認/);

const availablePreferred = extractImportantEvidence({
  project: batch.project,
  observed_at: batch.observed_at,
  materials: [
    { source: "drive", source_ref: "drive-file:partial-new", material_kind: "document", title: "LiSTie 取締役会 技術報告", project_root_matched: true, canonical_preferred: true, modified_at: "2026-08-12T00:00:00.000Z", text: "LiSTie株式会社 取締役会で研究開発の量産試作を承認", extraction_method: "office_text", extraction_status: "partial" },
    { source: "drive", source_ref: "drive-file:available-old", material_kind: "document", title: "LiSTie 取締役会 技術報告", project_root_matched: true, modified_at: "2026-08-01T00:00:00.000Z", text: "LiSTie株式会社 取締役会で研究開発の量産試作を承認", extraction_method: "office_text", extraction_status: "available" },
  ],
}).candidates[0];
assert.equal(availablePreferred?.canonical_source_ref, "drive-file:available-old", "新しい部分読取より本文読取済みを正本候補にする");
assert.equal(availablePreferred?.text_read_required, false);

const sanitized = sanitizeImportantEvidenceText("契約先 https://example.invalid/private 担当 person@example.invalid 電話 03-1234-5678 token:demo-value sk-abcdefgh12345678");
assert.doesNotMatch(sanitized, /https:\/\/|person@|03-1234-5678|demo-value|sk-abcdefgh/);
assert.match(sanitized, /\[URL省略\].*\[メール省略\].*\[電話番号省略\].*\[認証情報省略\]/);

// 会社名が本文の後半に偶然出るだけでは、別PJへ誤帰属させない。
const wrongProject = extractImportantEvidence({
  project: { project_id: "p00", company_name: "株式会社チームアルマダ", company_aliases: ["チームアルマダ", "AMD"], project_aliases: ["AMD"] },
  observed_at: batch.observed_at,
  materials: [{
    source: "drive", source_ref: "drive-file:lst-found-by-amd-search", material_kind: "document", title: "LiSTie事業報告.pdf", mime_type: "application/pdf", parent_folders: ["LiSTie 第3回株主総会"], project_root_matched: false,
    text: `LiSTie株式会社 事業報告 計算書類 ${"技術開発。".repeat(300)} 支援先として株式会社チームアルマダを記載`, extraction_method: "pdf_text", extraction_status: "available",
  }],
});
assert.equal(wrongProject.candidates.length, 0);
assert.equal(wrongProject.skipped[0]?.reason, "project_ownership_not_anchored");

// 同期間の改訂版は別内容hash・同familyで版管理する。
const versions = structuredClone(legacyFixture);
versions.documents.push({ ...structuredClone(legacyFixture.documents[0]), file_id: "fixture-lst-revision-old", modified_at: "2026-05-01T00:00:00.000Z", content_sha256: "a".repeat(64), text: legacyFixture.documents[0].text.replace("売上高 450千円", "売上高 400千円") });
const versioned = extractImportantDocuments(versions).candidates;
assert.equal(versioned.length, 2);
assert.deepEqual(versioned.map((candidate) => candidate.version.rank).sort(), [1, 2]);

const outbox = toImportantEvidenceOutbox(lstResult, "2026-08-12T00:00:00.000Z");
assert.equal(outbox.coverageGaps.length, 1);
assert.equal(outbox.coverageGaps[0].proposed_target_l2, "important_evidence");
assert.equal(outbox.coverageGaps[0].review_status, "candidate");
assert.equal(outbox.coverageGaps[0].due_at, null, "補助金の確定見込みを本人の対応期限へ流用しない");
assert.match(outbox.coverageGaps[0].source_hash, /^[0-9a-f]{64}$/);

const helperSource = fs.readFileSync(path.join(here, "ms_progress_review_tool.mjs"), "utf8");
assert.match(helperSource, /\["important_document", "important_evidence"\]/);
assert.match(helperSource, /const written = fresh\.length > 0/, "空payloadは保存先へ送らない");
assert.match(helperSource, /existing[\s\S]{0,260}review_status === "candidate"/, "通知失敗後はcandidate再投入で回復する");

const feedbackSource = fs.readFileSync(path.join(here, "../src/app/api/notifications/feedback/route.ts"), "utf8");
const importantEvidenceBoundarySource = fs.readFileSync(path.join(here, "../src/lib/important-evidence-text.ts"), "utf8");
const routeSource = feedbackSource.slice(feedbackSource.indexOf("async function routeImportantEvidenceCoverageGap"), feedbackSource.indexOf("async function routeImportantDocumentCoverageGap"));
assert.match(routeSource, /\.from\("project_important_evidence"\)/);
assert.doesNotMatch(routeSource, /\.from\("bzm_2_1_/, "通知採用でもBZM現行revisionを直接更新しない");
assert.match(importantEvidenceBoundarySource, /function importantEvidenceFactMustExcludeFromValue[\s\S]{0,350}financing_cash_flow[\s\S]{0,120}grant_deposit[\s\S]{0,120}grant_commitment_cap/);
assert.match(feedbackSource, /normalizeImportantEvidenceTemporalClass\(item\.temporal_class\)/, "正本化routeも共通の有限分類を使う");
assert.match(routeSource, /normalizeImportantEvidenceMaterialKind\(candidate\.material_kind\)/, "Slack threadも共通の有限資料種別へ正規化する");
assert.match(feedbackSource, /text_is_excerpt: item\.text_is_excerpt === true/, "保存抜粋flagを取得完了statusと分けてlineageへ残す");
assert.match(routeSource, /include_in_revenue !== false \|\| fact\.include_in_company_value !== false/, "調達・補助金は除外フラグ未設定も拒否する");
assert.match(feedbackSource, /action === "yes"[\s\S]{0,180}l2Kind === "coverage_gap"[\s\S]{0,220}!applyResult\.applied/);

const notificationsSource = fs.readFileSync(path.join(here, "../src/components/notifications/NotificationsClient.tsx"), "utf8");
assert.match(notificationsSource, /重要情報として保存する？/);
assert.match(notificationsSource, /重要情報として保存/);
assert.match(notificationsSource, /保存しない/);
assert.match(notificationsSource, /保存候補の事実と根拠/);
assert.match(notificationsSource, /元資料、既存の月次実績、会社価値、BZMの計算値は自動で書き換えない/);
assert.match(notificationsSource, /重要情報の確認/);
assert.doesNotMatch(notificationsSource, /D-15 重要情報の採否/);

const migrationSource = fs.readFileSync(path.join(here, "migrations/268_project_important_evidence.sql"), "utf8");
assert.match(migrationSource, /UNIQUE \(project_id, content_sha256\)/);
assert.match(migrationSource, /guard_project_important_evidence_immutable/);
assert.match(migrationSource, /text_read_required/);

console.log(JSON.stringify({
  ok: true,
  lst_candidates: lstResult.candidates.length,
  lst_lineage: lst.lineage.length,
  lst_facts: lst.facts.length,
  generic_candidates: generic.candidates.length,
  sources: [...new Set(generic.candidates.map((candidate) => candidate.source))].sort(),
  office_formats: [docx.method, xlsx.method, pptx.method],
  scanned_pdf: unread?.text_read_required ? "needs_ocr" : "unexpected",
}));
