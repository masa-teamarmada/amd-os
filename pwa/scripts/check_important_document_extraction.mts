import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractImportantDocuments,
  toCoverageGapOutbox,
  type ImportantDocumentBatch,
} from "./lib/important_document_extraction.mts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, "__fixtures__/important_document_lst_financial_package.json"), "utf8")) as ImportantDocumentBatch;
const result = extractImportantDocuments(fixture);

assert.equal(result.candidates.length, 1, "同一内容3コピーは1候補へ束ねる");
assert.equal(result.skipped.length, 0);
const candidate = result.candidates[0];
assert.equal(candidate.project_id, "p07");
assert.equal(candidate.company_name, "LiSTie株式会社");
assert.equal(candidate.document_class, "annual_financial_package");
assert.equal(candidate.reporting_period_start, "2025-04-01");
assert.equal(candidate.reporting_period_end, "2026-03-31");
assert.equal(candidate.audited, true);
assert.equal(candidate.audit_opinion, "unqualified");
assert.equal(candidate.audit_signed_on, "2026-05-28");
assert.equal(candidate.review_status, "candidate");
assert.equal(candidate.lineage.length, 3);
assert.deepEqual(candidate.lineage.map((item) => item.parent_folders[0]).sort(), [
  "260616_取締役会書面決議",
  "260624_第3回定時株主総会",
  "260710_第3回定時株主総会",
]);
assert.equal(candidate.canonical_file_id, "fixture-lst-copy-b", "更新日時が最も新しい所在を代表候補にする");
assert.equal(candidate.monthly_actuals.length, 0, "年度書類から月次実績を捏造しない");

const facts = new Map(candidate.facts.map((fact) => [fact.fact_key, fact]));
const expectFact = (key: string, value: number, temporalClass: string) => {
  const fact = facts.get(key);
  assert.ok(fact, `${key} must exist`);
  assert.equal(fact.value_yen, value, `${key} value`);
  assert.equal(fact.value_status, key === "subsidy_deposit_total" ? "calculated" : "observed");
  assert.equal(fact.temporal_class, temporalClass);
  if (fact.value_status === "observed") {
    assert.ok(fact.provenance?.section, `${key} section provenance`);
    assert.match(fact.provenance?.evidence_sha256 || "", /^[0-9a-f]{64}$/);
    assert.equal(fact.provenance?.observation_kind, "document");
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
expectFact("subsidy_deposit_current", 8_001_000, "grant_deposit");
expectFact("subsidy_deposit_long_term", 563_677_000, "grant_deposit");
expectFact("subsidy_deposit_total", 571_678_000, "grant_deposit");
expectFact("sbir_grant_cap", 1_500_000_000, "grant_commitment_cap");
expectFact("nedo_grant_cap", 300_000_000, "grant_commitment_cap");
expectFact("sushi_tech_grant_cap", 200_000_000, "grant_commitment_cap");

for (const key of ["jkiss_financing", "borrowings", "subsidy_deposit_total", "sbir_grant_cap", "nedo_grant_cap", "sushi_tech_grant_cap"]) {
  assert.equal(facts.get(key)?.include_in_revenue, false, `${key} is not revenue`);
  assert.equal(facts.get(key)?.include_in_company_value, false, `${key} is not direct company value`);
}
assert.equal(facts.get("sbir_grant_cap")?.due_at, "2028-03-31");
assert.equal(facts.get("sbir_grant_cap")?.due_precision, "month");
assert.equal(facts.get("nedo_grant_cap")?.due_at, "2027-03-31");
assert.equal(facts.get("sushi_tech_grant_cap")?.due_at, null, "根拠のない締切を0や推定日で埋めない");
assert.equal(facts.get("sushi_tech_grant_cap")?.due_precision, "none");

const bzm = new Map(candidate.bzm_input_candidates.map((item) => [item.parameter_key, item]));
assert.equal(bzm.get("cash_balance_at_period_end")?.value, 46_080_000);
assert.match(bzm.get("cash_balance_at_period_end")?.use_rule || "", /時点補正なしで直結しない/);
assert.match(bzm.get("financing_cf_jkiss")?.use_rule || "", /会社価値へ直加点しない/);
assert.match(bzm.get("grant_deposit_liquidity")?.use_rule || "", /売上・会社価値へ直加点しない/);
assert.ok([...bzm.values()].every((item) => item.review_status === "candidate"));

const outbox = toCoverageGapOutbox(result);
assert.equal(outbox.coverageGaps.length, 1);
assert.equal(outbox.coverageGaps[0].proposed_target_l2, "important_document");
assert.equal(outbox.coverageGaps[0].review_status, "candidate");
assert.equal(outbox.coverageGaps[0].due_at, null, "監査日やgrant見込み日を通知期限へ流用しない");
assert.match(outbox.coverageGaps[0].source_hash, /^[0-9a-f]{64}$/);

const versionFixture = structuredClone(fixture);
versionFixture.documents.push({
  ...structuredClone(fixture.documents[0]),
  file_id: "fixture-lst-revision-old",
  modified_at: "2026-05-01T00:00:00.000Z",
  content_sha256: "a".repeat(64),
  text: fixture.documents[0].text.replace("売上高 450千円", "売上高 400千円"),
});
const versioned = extractImportantDocuments(versionFixture).candidates;
assert.equal(versioned.length, 2, "同じ期間でも内容hashが違えば版候補を分ける");
assert.equal(versioned.filter((item) => item.version.state === "canonical_candidate").length, 1);
assert.equal(versioned.filter((item) => item.version.state === "superseded_candidate").length, 1);
assert.deepEqual(versioned.map((item) => item.version.rank).sort(), [1, 2]);

const missingTextFixture = structuredClone(fixture);
missingTextFixture.documents = [{
  ...structuredClone(fixture.documents[0]),
  file_id: "fixture-pdf-without-text",
  text: "",
  extraction_method: "unavailable",
  extraction_status: "missing",
}];
const missingText = extractImportantDocuments(missingTextFixture);
assert.equal(missingText.candidates.length, 0);
assert.deepEqual(missingText.skipped, [{ file_id: "fixture-pdf-without-text", reason: "document_text_missing" }]);

const helperSource = fs.readFileSync(path.join(here, "ms_progress_review_tool.mjs"), "utf8");
assert.match(helperSource, /"coverage_gap",\n\]\);/, "coverage_gap通知は採否可能なkindとしてapplierで許可する");
assert.match(helperSource, /results\.coverageGaps = await upsertCoverageGaps\(payload\.coverageGaps\)/);
assert.match(helperSource, /const written = fresh\.length > 0/, "空payloadはDBへ送らない");
assert.match(helperSource, /body: fresh,[\s\S]{0,80}: \[\];/);
assert.match(helperSource, /existing[\s\S]{0,220}review_status === "candidate"/, "insert後の通知失敗はcandidate再投入で回復する");

const feedbackSource = fs.readFileSync(path.join(here, "../src/app/api/notifications/feedback/route.ts"), "utf8");
const importantRoute = feedbackSource.slice(
  feedbackSource.indexOf("async function routeImportantDocumentCoverageGap"),
  feedbackSource.indexOf("async function routeGovernanceMeetingCoverageGap"),
);
assert.match(importantRoute, /\.from\("project_important_documents"\)/);
assert.doesNotMatch(importantRoute, /\.from\("bzm_2_1_/, "通知採用でもBZM現行revisionを直接更新しない");
assert.match(importantRoute, /financing_cash_flow[\s\S]{0,120}grant_deposit[\s\S]{0,120}grant_commitment_cap/);

const migrationSource = fs.readFileSync(path.join(here, "migrations/266_project_important_documents.sql"), "utf8");
assert.match(migrationSource, /UNIQUE \(project_id, content_sha256\)/);
assert.match(migrationSource, /guard_project_important_document_evidence_immutable/);
assert.match(migrationSource, /status IN \('confirmed', 'archived'\)/);

console.log(JSON.stringify({
  ok: true,
  candidate_count: result.candidates.length,
  lineage_count: candidate.lineage.length,
  fact_count: candidate.facts.length,
  bzm_candidate_count: candidate.bzm_input_candidates.length,
  version_candidate_count: versioned.length,
}));
