import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { strToU8, zipSync } from "fflate";
import { extractSourceText } from "../src/lib/sources/source-material-text.ts";
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
const unread = generic.candidates.find((candidate) => candidate.canonical_source_ref === "drive-file:scanned-board");
assert.equal(unread?.text_read_required, true, "OCR未完を情報なしとして捨てない");
assert.equal(unread?.facts.length, 0, "未読本文から事実を捏造しない");

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
const routeSource = feedbackSource.slice(feedbackSource.indexOf("async function routeImportantEvidenceCoverageGap"), feedbackSource.indexOf("async function routeImportantDocumentCoverageGap"));
assert.match(routeSource, /\.from\("project_important_evidence"\)/);
assert.doesNotMatch(routeSource, /\.from\("bzm_2_1_/, "通知採用でもBZM現行revisionを直接更新しない");
assert.match(routeSource, /financing_cash_flow[\s\S]{0,150}grant_deposit[\s\S]{0,150}grant_commitment_cap/);

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
