/**
 * BZM 2.2 獲得台帳への抽出由来書き込みの契約テスト。
 * 正本: pwa/spec/4-6-bzm-22-acquisition-ledger-current-spec.md §2 / §6
 *
 * 守らせること:
 *   - 抽出由来の行は必ず display_only。第1段では計算へ入れない
 *   - 閉じた条件 / 消費 / 行動の増減は空のまま (未取得を「無し」に見せない)
 *   - 1つの正規化事象 = 1行。content hash が同じなら同じ canonical_event_key
 *   - 件数・合計を作らない
 *   - 採用された候補からしか書かない
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBzm22AcquisitionFromImportantEvidence } from "../src/lib/bzm-2-2-acquisition-from-evidence.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const SHA = "a".repeat(64);

function candidateFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    content_sha256: SHA,
    source: "drive",
    document_class: "共同研究契約書",
    title: "香川大学との共同研究契約",
    canonical_source_ref: "drive:file:xxxx",
    importance: { score: 80, categories: ["contract", "financial"] },
    lineage: [{ source: "drive", source_ref: "drive:file:xxxx", extraction_status: "available", modified_at: "2026-05-02T10:00:00Z" }],
    audit_signed_on: "2026-04-30",
    text_read_required: false,
    ...overrides,
  };
}

const base = buildBzm22AcquisitionFromImportantEvidence({
  candidate: candidateFixture(),
  projectId: "p12",
  importantEvidenceId: "11111111-1111-1111-1111-111111111111",
  confirmedOn: "2026-08-14",
});
assert.ok(base, "採用済み候補からは1行導出できる");

// 第1段の不変条件。ここが崩れたら台帳が黙って計算へ入る。
assert.equal(base.numeric_binding, "display_only");
assert.equal(base.bound_target, "");
assert.equal(base.source_origin, "extraction");
assert.equal(base.status, "active");
assert.deepEqual(base.closed_constraints, [], "どの制約が動いたかは抽出では判定しない");
assert.deepEqual(base.consumed, [], "消費は抽出では判定しない");
assert.deepEqual(base.action_delta, [], "行動集合の増減は抽出では判定しない");

// 正規化事象キーは content hash 由来 = 再採用しても増えない。
assert.equal(base.canonical_event_key, `important_evidence:${SHA}`);
const again = buildBzm22AcquisitionFromImportantEvidence({
  candidate: candidateFixture({ title: "別の表題で再採用" }),
  projectId: "p12",
  importantEvidenceId: "22222222-2222-2222-2222-222222222222",
  confirmedOn: "2026-09-01",
});
assert.equal(again?.canonical_event_key, base.canonical_event_key, "同じ内容hashは同じ事象へ畳む");

// 監査タグと状態8層は多重付与。量へ変換しない。
assert.deepEqual([...base.audit_tags].sort(), ["financial", "legal-regulatory", "relational"].sort());
assert.deepEqual([...base.state_effects.map((effect) => effect.layer)].sort(), ["k", "n", "r"]);
for (const effect of base.state_effects) {
  assert.doesNotMatch(effect.effect, /\d/, "状態への効きを数値で書かない");
}

// 証拠段階。文書日付があり全文読取済みのときだけ observed。
assert.equal(base.evidence_stage, "observed");
assert.equal(base.occurred_on, "2026-04-30");
const partial = buildBzm22AcquisitionFromImportantEvidence({
  candidate: candidateFixture({ text_read_required: true }),
  projectId: "p12", importantEvidenceId: null, confirmedOn: "2026-08-14",
});
assert.equal(partial?.evidence_stage, "estimated", "部分読取を観測へ昇格させない");
const noDocumentDate = buildBzm22AcquisitionFromImportantEvidence({
  candidate: candidateFixture({ audit_signed_on: null, balance_sheet_date: null, effective_period_end: null }),
  projectId: "p12", importantEvidenceId: null, confirmedOn: "2026-08-14",
});
assert.equal(noDocumentDate?.evidence_stage, "estimated", "資料日付から採った事象日は推定");
assert.equal(noDocumentDate?.occurred_on, "2026-05-02");

// 導出できない入力では null を返し、正本化自体は止めない。
assert.equal(buildBzm22AcquisitionFromImportantEvidence({
  candidate: candidateFixture({ content_sha256: "" }), projectId: "p12", importantEvidenceId: null, confirmedOn: "2026-08-14",
}), null);
assert.equal(buildBzm22AcquisitionFromImportantEvidence({
  candidate: candidateFixture(), projectId: "", importantEvidenceId: null, confirmedOn: "2026-08-14",
}), null);

// 原文・URL・連絡先を台帳へ持ち込まない。
const leaky = buildBzm22AcquisitionFromImportantEvidence({
  candidate: candidateFixture({ title: "契約 https://example.com/secret 連絡先 masa@example.com" }),
  projectId: "p12", importantEvidenceId: null, confirmedOn: "2026-08-14",
});
assert.doesNotMatch(leaky?.title ?? "", /https?:\/\//, "URLを台帳へ残さない");
assert.doesNotMatch(leaky?.title ?? "", /@example\.com/, "メールアドレスを台帳へ残さない");

// mapper 本体が集計を作らないこと (件数・合計列を持たない)。
const mapperSource = fs.readFileSync(path.join(here, "../src/lib/bzm-2-2-acquisition-from-evidence.ts"), "utf8");
assert.doesNotMatch(mapperSource, /total|_count|reduce\(/, "獲得台帳の行に合計・件数を作らない");

// 通知採用の書き込み経路。採用時だけ、しかも display_only のまま入る。
const feedbackSource = fs.readFileSync(path.join(here, "../src/app/api/notifications/feedback/route.ts"), "utf8");
const routeSource = feedbackSource.slice(
  feedbackSource.indexOf("async function upsertBzm22AcquisitionFromEvidence"),
  feedbackSource.indexOf("async function routeImportantDocumentCoverageGap"));
assert.match(routeSource, /\.from\("project_bzm_2_2_acquisitions"\)/);
assert.match(routeSource, /onConflict: "project_id,canonical_event_key"/, "再採用で行が増えない");
assert.doesNotMatch(routeSource, /numeric_binding: "bound"/, "抽出経路からboundへ上げない");
assert.match(routeSource, /catch[\s\S]{0,200}獲得台帳への反映は失敗/, "台帳失敗で正本化を巻き戻さない");
assert.match(feedbackSource, /review_status\) !== "candidate"[\s\S]{0,4000}project_bzm_2_2_acquisitions|project_bzm_2_2_acquisitions[\s\S]{0,6000}review_status\) !== "candidate"/,
  "候補検査を通った採用時だけ台帳へ書く");

console.log(JSON.stringify({
  ok: true,
  canonical_event_key: base.canonical_event_key,
  audit_tags: base.audit_tags,
  state_layers: base.state_effects.map((effect) => effect.layer),
  evidence_stage: base.evidence_stage,
}, null, 2));
