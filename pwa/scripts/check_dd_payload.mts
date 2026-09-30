// 純関数の検査: DDの公開版 payload は、許可した項目だけを写す。
// 社内の出典・作成者・内部メモ・明細に目印（CANARY_）を仕込み、公開版の JSON に1つも残らないことを確かめる。
// 実行: npm run test:dd-package

import assert from "node:assert/strict";
import {
  ddCapitalPolicyUnverified,
  ddCostModelUnverified,
  ddTechTopicUnverified,
  projectDdCapitalPolicy,
  projectDdCostModel,
  projectDdDocument,
  projectDdTechTopic,
} from "@/lib/dd-payload";
import type { TechEntry, TechTopic } from "@/lib/project-tech";
import type { CapitalPlan } from "@/lib/capital-plan";
import type { CostModelBundle } from "@/lib/project-cost-model";

function assertNoCanary(value: unknown, label: string) {
  const json = JSON.stringify(value);
  const found = json.match(/CANARY_[A-Z_]+/g);
  assert.equal(found, null, `${label} に社内向けの値が混ざっている: ${found?.join(", ")}`);
}

// --- 技術台帳のページ --------------------------------------------------------
const topic: TechTopic = {
  tech_topic_id: "ptt_test",
  project_id: "p21",
  block_kind: "matrix",
  title: "競合の会社との星取り表",
  summary: "要約",
  body_md: "本文",
  tech_domain: "競合比較",
  sort_order: 1,
  status: "active",
  confidentiality: "public",
  source_kind: "meeting",
  source_ref: "CANARY_TOPIC_SOURCE_REF",
  source_url: "https://drive.example/CANARY_TOPIC_URL",
  needs_check: true,
  check_reason: "実測がない",
  presentation: { heading: "見出し", self_col: "SolvioraX", highlight_rows: ["色"], secret: "CANARY_PRESENTATION_EXTRA" },
  created_by: "CANARY_TOPIC_AUTHOR",
  updated_by: "CANARY_TOPIC_EDITOR",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-14T00:00:00Z",
};
const entry = (overrides: Partial<TechEntry>): TechEntry => ({
  tech_entry_id: "CANARY_ENTRY_ID",
  tech_topic_id: "ptt_test",
  project_id: "p21",
  row_label: "色",
  col_label: "SolvioraX",
  value_min: null,
  value_max: null,
  value_text: "分解できる",
  unit: null,
  rating: "excellent",
  condition_text: null,
  observed_on: "2026-09-01",
  confidence: "high",
  source_kind: "measurement",
  source_ref: "CANARY_ENTRY_SOURCE_REF",
  source_url: "https://drive.example/CANARY_ENTRY_URL",
  note: "注記",
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
  const payload = projectDdTechTopic(topic, [
    entry({}),
    entry({ row_label: "金属", needs_check: true, check_reason: "文献値のみ" }),
    entry({ tech_topic_id: "ptt_other", row_label: "CANARY_OTHER_TOPIC_ROW" }),
  ]);
  assertNoCanary(payload, "技術台帳のページ");
  assert.equal(payload.entries.length, 2, "別のページの行は写さない");
  assert.ok(payload.entries.every((row) => row.source_ref === null && row.source_url === null && row.created_by === null));
  assert.equal(payload.topic.presentation?.heading, "見出し");
  const notes = ddTechTopicUnverified(payload);
  assert.deepEqual(notes, ["このページ全体：実測がない", "金属（SolvioraX）：文献値のみ"]);
}

// --- 資料 -------------------------------------------------------------------
assert.deepEqual(projectDdDocument({ fileName: "a.html", mimeType: "text/html", sizeBytes: 10 }).preview, "html");
assert.deepEqual(projectDdDocument({ fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10 }).preview, "pdf");
assert.deepEqual(projectDdDocument({ fileName: "a.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 10 }).preview, null);

// --- 資本政策 -----------------------------------------------------------------
const plan: CapitalPlan = {
  id: "plan-1",
  name: "SOL 資本政策",
  holders: [
    { id: "ceo", name: "代表", kind: "founder", note: "CANARY_HOLDER_NOTE" },
    { id: "prof", name: "研究者", kind: "founder" },
    { id: "seed", name: "シード投資家（配分未定）", kind: "investor" },
    { id: "unused", name: "CANARY_UNUSED_HOLDER", kind: "other" },
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
        { id: "a1", holderId: "ceo", shareClass: "common", shares: { value: 81000, source: "input" }, note: "CANARY_ALLOC_NOTE" },
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
  const payload = projectDdCapitalPolicy(plan, { basis: "working", planRevision: 8, frozenVersion: null });
  assertNoCanary(payload, "資本政策");
  assert.deepEqual(payload.events.map((event) => event.label), ["設立", "シード（J-KISS）", "シリーズA"]);
  assert.deepEqual(payload.holders.map((holder) => holder.id), ["ceo", "prof", "seed"], "株を持たない株主は載せない");
  assert.equal(payload.events[1].conversionCap, 500000000);
  assert.equal(payload.events[1].conversionDiscount, 0.2);
  const notes = ddCapitalPolicyUnverified(payload);
  assert.ok(notes.some((note) => note.includes("作業中の案（第8版）")));
  assert.ok(notes.includes("シリーズA：調達額・評価額・投資家配分は未定"));
  const cut = projectDdCapitalPolicy(plan, { basis: "working", planRevision: 8, frozenVersion: null }, { lastEventId: "seed" });
  assert.deepEqual(cut.events.map((event) => event.id), ["inc", "seed"], "選んだラウンドまでに絞る");
  assert.deepEqual(cut.standings.map((standing) => standing.eventId), ["inc", "seed"]);
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
    sourceUrl: "https://drive.example/CANARY_MODEL_SOURCE",
    sourceNote: "CANARY_MODEL_SOURCE_NOTE",
    summaryMd: "要約",
    systemScopeMd: "想定する系",
    targetTotalCostPerUnit: null,
    targetMarginRate: null,
    targetNote: "CANARY_TARGET_NOTE",
    unitBasisLabel: "m³",
    visibility: "amd_internal",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  assumptions: [
    { costAssumptionId: "a1", groupLabel: "事業", label: "売価", value: 500, valueText: null, unit: "円/m³", confidence: "B", sourceKind: "CANARY_ASSUMPTION_SOURCE", owner: "CANARY_OWNER", isKey: true, roleKey: "sale_price", note: "CANARY_ASSUMPTION_NOTE", visibility: "amd_internal", sortOrder: 1, strain: null, application: null },
    { costAssumptionId: "a2", groupLabel: "CANARY_NONKEY_GROUP", label: "CANARY_NONKEY_LABEL", value: 1, valueText: null, unit: null, confidence: null, sourceKind: null, owner: null, isKey: false, roleKey: null, note: null, visibility: "amd_internal", sortOrder: 2, strain: null, application: null },
  ],
  items: [
    { costItemId: "i1", scenario: "共通", costType: "OPEX", groupLabel: "CANARY_ITEM_GROUP", midLabel: "CANARY_ITEM_MID", leafLabel: "CANARY_ITEM_LEAF", basis: "毎m³比例", quantity: 1, quantityUnit: null, unitPrice: 12.5, unitPriceUnit: "円/m³", priceRule: null, annualFactor: 1, usefulLifeYears: null, isBreakdown: false, confidence: "C", sourceKind: "CANARY_ITEM_SOURCE", owner: "CANARY_ITEM_OWNER", note: "CANARY_ITEM_NOTE", visibility: "amd_internal", sortOrder: 1, strain: null, application: null, bearer: "sx" },
  ],
  tasks: [],
  questions: [
    { costQuestionId: "q1", addressee: "CANARY_ADDRESSEE", question: "菌体の使用回数は何回か", whyItMatters: "CANARY_WHY", impactLow: 1, impactHigh: 2, status: "open", answer: null, answeredOn: null, linkedAssumptionId: null, visibility: "amd_internal", sortOrder: 1 },
    { costQuestionId: "q2", addressee: "x", question: "CANARY_ANSWERED_QUESTION", whyItMatters: null, impactLow: null, impactHigh: null, status: "answered", answer: "CANARY_ANSWER", answeredOn: "2026-09-01", linkedAssumptionId: null, visibility: "amd_internal", sortOrder: 2 },
  ],
  notes: [
    { costNoteId: "n1", section: "caveat", title: "量産の値下がりは入れていない", bodyMd: "本文", sourceUrl: "https://drive.example/CANARY_NOTE_URL", sourceLabel: "CANARY_NOTE_LABEL", visibility: "amd_internal", sortOrder: 1 },
    { costNoteId: "n2", section: "history", title: "CANARY_HISTORY_TITLE", bodyMd: "CANARY_HISTORY_BODY", sourceUrl: null, sourceLabel: null, visibility: "amd_internal", sortOrder: 2 },
  ],
};
{
  const payload = projectDdCostModel(bundle);
  assertNoCanary(payload, "採算（コスト試算）");
  assert.deepEqual(payload.keyAssumptions.map((row) => row.label), ["売価"], "主要な前提（isKey）だけを写す");
  assert.deepEqual(payload.caveats.map((row) => row.title), ["量産の値下がりは入れていない"], "注意書き（caveat）だけを写す");
  assert.deepEqual(ddCostModelUnverified(bundle), ["菌体の使用回数は何回か"], "未解決の確認事項の問いだけを拾う");
  for (const strain of payload.strains) {
    for (const scenario of strain.scenarios) {
      assert.equal(scenario.breakdown.length, 6, "内訳は6区分の集計だけ（明細の行は写さない）");
    }
  }
}

console.log("dd payload allowlist: ok");
