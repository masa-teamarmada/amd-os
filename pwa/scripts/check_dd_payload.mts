// 純関数の検査: DDの表示データ（dd-payload の shape*）。
// 中身はワークスペースと同じ（部品が表示に使う値は削らない）。部品が表示しない社内の値だけを送らない。
// 社内の作成者・メモ・重複した summary に目印（CANARY_）を仕込み、DDの表示データに1つも残らないことを確かめる。
// 実行: npm run test:dd-package

import assert from "node:assert/strict";
import {
  ddCapitalPolicyUnverified,
  ddCostModelUnverified,
  ddFundingPlanUnverified,
  ddTechTopicUnverified,
  shapeDdCapitalPolicy,
  shapeDdCostModel,
  shapeDdDocument,
  shapeDdFundingPlan,
  shapeDdTechTopic,
} from "@/lib/dd-payload";
import type { TechEntry, TechTopic } from "@/lib/project-tech";
import type { CapitalPlan } from "@/lib/capital-plan";
import type { CostModelBundle } from "@/lib/project-cost-model";
import type { FundingPlan } from "@/lib/project-funding-plan";

function assertNoCanary(value: unknown, label: string) {
  const json = JSON.stringify(value);
  const found = json.match(/CANARY_[A-Z_]+/g);
  assert.equal(found, null, `${label} に部品が表示しない社内の値が混ざっている: ${found?.join(", ")}`);
}

// --- 技術台帳のページ --------------------------------------------------------
const topic: TechTopic = {
  tech_topic_id: "ptt_test",
  project_id: "p21",
  block_kind: "record",
  title: "装置と実験の到達実績",
  summary: "要約",
  body_md: "本文",
  tech_domain: "培養",
  sort_order: 1,
  status: "active",
  confidentiality: "internal",
  source_kind: "meeting",
  source_ref: "定例 2026-09-02",
  source_url: "https://drive.example/source",
  needs_check: true,
  check_reason: "実測がない",
  presentation: null,
  created_by: "CANARY_TOPIC_AUTHOR",
  updated_by: "CANARY_TOPIC_EDITOR",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-14T00:00:00Z",
};
const entry = (overrides: Partial<TechEntry>): TechEntry => ({
  tech_entry_id: "pte_a",
  tech_topic_id: "ptt_test",
  project_id: "p21",
  row_label: "装置",
  col_label: null,
  value_min: null,
  value_max: null,
  value_text: "47L",
  unit: null,
  rating: null,
  condition_text: "試運転できる状態",
  observed_on: "2026-05-01",
  confidence: "high",
  source_kind: "meeting",
  source_ref: "定例 2026-05-01",
  source_url: null,
  note: "行の備考",
  needs_check: false,
  check_reason: null,
  sort_order: 1,
  created_by: "CANARY_ENTRY_AUTHOR",
  updated_by: "CANARY_ENTRY_EDITOR",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-02T00:00:00Z",
  ...overrides,
});
{
  const data = shapeDdTechTopic("p21", topic, [
    entry({}),
    entry({ tech_entry_id: "pte_b", row_label: "排液の試験", sort_order: 2, needs_check: true, check_reason: "COD 未測定" }),
    entry({ tech_entry_id: "pte_other", tech_topic_id: "ptt_other", row_label: "CANARY_OTHER_TOPIC_ROW" }),
  ]);
  assertNoCanary(data, "技術台帳のページ");
  assert.equal(data.entries.length, 2, "別のページの行は送らない");
  // ワークスペースの TopicCard が表示する値（出典・行の備考・要確認）は、そのまま送る（どこから見ても同じ内容）。
  assert.equal(data.topic.source_ref, "定例 2026-09-02");
  assert.equal(data.entries[0].note, "行の備考");
  assert.equal(data.topic.summary, "要約");
  assert.deepEqual(ddTechTopicUnverified(data), ["このページ全体：実測がない", "排液の試験：COD 未測定"]);
  assert.equal(topic.created_by, "CANARY_TOPIC_AUTHOR", "元データ（入力）を書き換えない");
}

// --- 資料 -------------------------------------------------------------------
assert.equal(shapeDdDocument({ fileName: "a.html", mimeType: "text/html", sizeBytes: 10 }).preview, "html");
assert.equal(shapeDdDocument({ fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10 }).preview, "pdf");
assert.equal(shapeDdDocument({ fileName: "a.png", mimeType: "image/png", sizeBytes: 10 }).preview, "image");
assert.equal(shapeDdDocument({ fileName: "a.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 10 }).preview, null);

// --- 資金計画 -------------------------------------------------------------------
{
  const plan = {
    summary: {
      version: "v1",
      asOf: "2026-09-30",
      startYm: "2027-04",
      endYm: "2027-04",
      nextRoundYm: "2028-07",
      nextRoundAmountYen: null,
      seedAmountYen: 100000000,
      postMoneyCapYen: 500000000,
      discount: 0.2,
      conversionTriggerYen: 100000000,
      reserveYen: 0,
      improvementTargetYen: 10000000,
      bridgeEnvelopeYen: 50000000,
      loanFacilityTargetYen: 30000000,
      assumptions: ["2027年4月1日設立・シード1億円入金を目標とする。"],
      bridgePolicy: ["不採択時は採否判明時に再計画する。"],
      cases: [{ key: "adopted", description: "基本ケース" }],
      monthlyCosts: [{ label: "大学共同研究費", amountYen: 830000, status: "今回指定" }],
      equipment: [{ label: "有償PoC装置 1号機", amountYen: 6600000, orderYm: "2027-10", deliveryYm: "2027-12", note: "装置販売を想定" }],
      source: { workbookSha256: "abc", adoptedMaterial: "お願い資料 v3.3", cutoff: "2028年6月までを今回改定。" },
    },
    // 初月の行には summary の全文がもう1つ入っている（元データの形そのまま）。
    months: [{ ym: "2027-04", planning_details_json: { version: "v1", scenarios: [], summary: { bridgePolicy: ["CANARY_MONTH_SUMMARY_COPY"] } } }],
  } as unknown as FundingPlan;
  const data = shapeDdFundingPlan(plan);
  assertNoCanary(data, "資金計画");
  // 表示部品が読む summary は削らない（試算表タブと同じ内容）。
  assert.deepEqual(data.plan.summary, plan.summary);
  assert.equal(data.plan.months[0].planning_details_json.summary, null, "月の行の summary の写しは送らない");
  assert.ok(plan.months[0].planning_details_json.summary !== null, "元データ（入力）を書き換えない");
  assert.deepEqual(ddFundingPlanUnverified(data), [
    "シリーズAの新規調達額は未確定（必要額を再精査中）",
    "融資相談枠の目安3,000万円は未合意",
    "純改善目標1,000万円は実行月未定で、月次の残高に入れていない",
  ]);
}

// --- 資本政策 -----------------------------------------------------------------
const capitalPlan: CapitalPlan = {
  id: "plan-1",
  name: "SOL 資本政策",
  holders: [
    { id: "ceo", name: "代表", kind: "founder", note: "CANARY_HOLDER_NOTE" },
    { id: "prof", name: "研究者", kind: "founder" },
    { id: "seed", name: "シード投資家（配分未定）", kind: "investor" },
  ],
  events: [
    {
      id: "inc",
      type: "incorporation",
      label: "設立",
      order: 1,
      date: "2027-04-01",
      status: "planned",
      calculationBasis: "manual",
      note: "CANARY_EVENT_NOTE",
      allocations: [
        { id: "a1", holderId: "ceo", shareClass: "common", shares: { value: 81000, source: "input", note: "CANARY_VALUE_NOTE" }, note: "CANARY_ALLOC_NOTE" },
        { id: "a2", holderId: "prof", shareClass: "common", shares: { value: 27000, source: "input" } },
      ],
    },
    {
      id: "seed",
      type: "convertible_issue",
      label: "シード（J-KISS）",
      order: 2,
      date: "2027-04-01",
      status: "planned",
      calculationBasis: "manual",
      conversionCap: { value: 500000000, source: "input" },
      conversionDiscount: { value: 0.2, source: "input" },
      allocations: [
        { id: "a3", holderId: "seed", shareClass: "convertible", shares: { value: 27000, source: "input" }, amount: { value: 100000000, source: "input" } },
      ],
    },
    {
      id: "series-a",
      type: "equity_issue",
      label: "シリーズA",
      order: 3,
      date: "2028-07-01",
      status: "planned",
      calculationBasis: "manual",
      note: "CANARY_SERIES_A_NOTE",
      allocations: [],
    },
  ],
};
{
  const data = shapeDdCapitalPolicy(capitalPlan, { basis: "working", planRevision: 8, frozenVersion: null });
  assertNoCanary(data, "資本政策");
  // 数字・株主・ラウンドは削らない（資本政策表タブと同じ表を描く）。
  assert.equal(data.plan.holders.length, 3);
  assert.equal(data.plan.events.length, 3);
  assert.equal(data.plan.events[1].conversionCap?.value, 500000000);
  assert.equal(data.plan.events[0].allocations[0].shares.value, 81000);
  assert.equal(capitalPlan.holders[0].note, "CANARY_HOLDER_NOTE", "元データ（入力）を書き換えない");
  const notes = ddCapitalPolicyUnverified(data);
  assert.ok(notes.some((note) => note.includes("作業中の案（第8版）")));
  assert.ok(notes.includes("シリーズA：調達額・評価額・投資家配分は未定"));
  assert.ok(notes.some((note) => note.startsWith("シード（J-KISS）：株式数・持株比率は、転換上限")), "転換型の株式数は仮の試算だと示す");
  const frozen = shapeDdCapitalPolicy(capitalPlan, { basis: "frozen", planRevision: 8, frozenVersion: 2 });
  assert.ok(!ddCapitalPolicyUnverified(frozen).some((note) => note.includes("作業中の案")), "凍結版には作業中の注記を付けない");
}

// --- 採算（コスト試算） ----------------------------------------------------------
const bundle: CostModelBundle = {
  model: {
    costModelId: "cm_test",
    projectId: "p21",
    title: "コスト試算",
    caseKind: "dye_degradation",
    caseLabel: "排水処理",
    versionLabel: "260930",
    status: "active",
    sourceUrl: null,
    sourceNote: null,
    summaryMd: "要約",
    systemScopeMd: "想定する系",
    targetTotalCostPerUnit: null,
    targetMarginRate: null,
    targetNote: null,
    unitBasisLabel: "m³",
    visibility: "amd_internal",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  assumptions: [],
  items: [],
  tasks: [],
  questions: [
    { costQuestionId: "q1", addressee: "研究者", question: "菌体の使用回数は何回か", whyItMatters: null, impactLow: 1, impactHigh: 2, status: "open", answer: null, answeredOn: null, linkedAssumptionId: null, visibility: "amd_internal", sortOrder: 1 },
    { costQuestionId: "q2", addressee: "x", question: "回答済みの問い", whyItMatters: null, impactLow: null, impactHigh: null, status: "answered", answer: "回答", answeredOn: "2026-09-01", linkedAssumptionId: null, visibility: "amd_internal", sortOrder: 2 },
  ],
  notes: [],
};
{
  const data = shapeDdCostModel("p21", "default", bundle);
  // コスト試算タブと同じ試算をそのまま渡す（明細・単価・確認事項もワークスペースと同じ）。
  assert.deepEqual(data.bundle, bundle);
  assert.equal(data.costKind, "default");
  assert.deepEqual(ddCostModelUnverified(bundle), ["菌体の使用回数は何回か"], "未解決の確認事項の問いだけを拾う");
}

console.log("dd live payload: ok");
