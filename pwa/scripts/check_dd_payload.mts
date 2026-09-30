// 純関数の検査: DDの公開版 payload は、許可した項目だけを写す。
// 社内の出典・作成者・内部メモ・明細に目印（CANARY_）を仕込み、公開版の JSON に1つも残らないことを確かめる。
// 実行: npm run test:dd-package

import assert from "node:assert/strict";
import {
  ddCapitalPolicyUnverified,
  ddCostModelUnverified,
  ddTechTopicUnverified,
  listDdCostModelParts,
  listDdFundingPlanParts,
  listDdTechTopicParts,
  projectDdCapitalPolicy,
  projectDdCostModel,
  projectDdDocument,
  projectDdFundingPlan,
  projectDdTechTopic,
  splitDdMarkdownSections,
} from "@/lib/dd-payload";
import { isDdPartKey, readDdIncludedParts } from "@/lib/dd-package-core";
import type { TechEntry, TechTopic } from "@/lib/project-tech";
import type { CapitalPlan } from "@/lib/capital-plan";
import type { CostModelBundle } from "@/lib/project-cost-model";
import type { FundingPlan } from "@/lib/project-funding-plan";

/** 選べる範囲の key をすべて選んだときは、範囲を選ばない（null）ときと同じ公開版になる。 */
function allKeys(parts: Array<{ key: string }>): Set<string> {
  for (const part of parts) assert.ok(isDdPartKey(part.key), `載せる範囲の key の形が検査を通らない: ${part.key}`);
  assert.equal(new Set(parts.map((part) => part.key)).size, parts.length, "載せる範囲の key が重なっている");
  return new Set(parts.map((part) => part.key));
}

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
  assert.ok(payload.entries.some((row) => row.note === "注記"), "公開可のページは行の備考を写す");
  const internalPayload = projectDdTechTopic({ ...topic, confidentiality: "internal" }, [entry({ note: "CANARY_INTERNAL_ROW_NOTE" })]);
  assertNoCanary(internalPayload, "社内のページの行の備考");
  const notes = ddTechTopicUnverified(payload);
  assert.deepEqual(notes, ["このページ全体：実測がない", "金属（SolvioraX）：文献値のみ"]);
  assert.equal(payload.topic.summary, null, "ページの要約は画面に出さないので写さない");

  // 載せる範囲: 星取り表は観点の行ごとに選ぶ。外した行は、備考・要確認ごと payload に入らない。
  const matrixEntries = [entry({}), entry({ row_label: "CANARY_EXCLUDED_ROW", needs_check: true, check_reason: "CANARY_EXCLUDED_REASON" })];
  const parts = listDdTechTopicParts(topic, matrixEntries);
  assert.deepEqual(parts.map((part) => part.group), ["表の補足", "表の行", "表の行"]);
  const keep = new Set(parts.filter((part) => part.label !== "CANARY_EXCLUDED_ROW").map((part) => part.key));
  const picked = projectDdTechTopic(topic, matrixEntries, keep);
  assertNoCanary(picked, "外した行");
  assertNoCanary(ddTechTopicUnverified(picked), "外した行の要確認");
  assert.deepEqual(picked.entries.map((row) => row.row_label), ["色"]);
  assert.deepEqual(projectDdTechTopic(topic, matrixEntries, allKeys(parts)), projectDdTechTopic(topic, matrixEntries), "全部選ぶと未選択と同じ");
  assert.equal(projectDdTechTopic(topic, matrixEntries, new Set()).entries.length, 0, "空の選択は何も載せない");
  assert.equal(projectDdTechTopic(topic, matrixEntries, new Set()).topic.bodyMd, null);
}

// --- 本文の節 -------------------------------------------------------------------
{
  const body = [
    "**一言でいうと** — 冒頭の段落。",
    "",
    "### 事業全体の流れ",
    "",
    "```pictogram",
    "### コードブロックの中の見出しは切らない",
    "```",
    "",
    "#### 下位の見出しは親の節に含める",
    "本文。",
    "",
    "### 成り立つための条件",
    "",
    "CANARY_INTERNAL_SECTION",
    "",
  ].join("\n");
  const sections = splitDdMarkdownSections(body);
  assert.deepEqual(sections.map((section) => section.label), ["冒頭（最初の見出しより前）", "事業全体の流れ", "成り立つための条件"]);
  assert.equal(sections.map((section) => section.text).join(""), body, "節をつなげると元の本文に戻る");
  assert.ok(sections[1].text.includes("コードブロックの中の見出しは切らない") && sections[1].text.includes("下位の見出し"));
  assert.deepEqual(splitDdMarkdownSections("見出しのない本文").map((section) => section.label), ["本文"]);

  const article: TechTopic = { ...topic, block_kind: "article", confidentiality: "internal", body_md: body, presentation: null };
  const parts = listDdTechTopicParts(article, []);
  assert.deepEqual(parts.map((part) => part.group), ["本文", "本文", "本文"]);
  const withoutConditions = new Set(parts.filter((part) => part.label !== "成り立つための条件").map((part) => part.key));
  const picked = projectDdTechTopic(article, [], withoutConditions);
  assertNoCanary(picked, "外した本文の節");
  assert.ok(picked.topic.bodyMd?.includes("### 事業全体の流れ") && picked.topic.bodyMd.includes("冒頭の段落"));
  assert.equal(projectDdTechTopic(article, [], allKeys(parts)).topic.bodyMd, body);
  // 見出しの文言が変わった節は別の key になり、選び直すまで載らない。
  const renamed = projectDdTechTopic({ ...article, body_md: body.replace("### 事業全体の流れ", "### 事業の流れ（改）") }, [], withoutConditions);
  assert.ok(!renamed.topic.bodyMd?.includes("事業の流れ（改）"), "書き換わった節は選び直すまで載らない");

  // 表の1行ずつ選ぶ種類（record）は、行の識別子で選ぶ。
  const record: TechTopic = { ...topic, block_kind: "record", body_md: null, presentation: null };
  const rows = [entry({ tech_entry_id: "pte_a", row_label: "装置" }), entry({ tech_entry_id: "pte_b", row_label: "CANARY_RECORD_ROW" })];
  assert.deepEqual(listDdTechTopicParts(record, rows).map((part) => part.key).sort(), ["entry:pte_a", "entry:pte_b"]);
  assertNoCanary(projectDdTechTopic(record, rows, new Set(["entry:pte_a"])), "外した記録の行");
}

// --- 載せる範囲の読み取り --------------------------------------------------------------
assert.equal(readDdIncludedParts({}), null, "範囲が未選択なら null（すべて載せる）");
assert.equal(readDdIncludedParts({ includedParts: "scope" }), null);
assert.deepEqual([...(readDdIncludedParts({ includedParts: ["scope", "<script>", 3, "caveat:cn_1"] }) ?? [])], ["scope", "caveat:cn_1"], "既知の形の key だけを読む");
for (const bad of ["", "body:", "body:xyz", "entry:", "entry:a b", "caveat:../x", "policy:123", "scopes", "row:ABCDEF12"]) {
  assert.equal(isDdPartKey(bad), false, `不正な key を通さない: ${bad}`);
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
  assert.ok(notes.some((note) => note.startsWith("シード（J-KISS）：株式数・持株比率は、転換上限")), "転換型の株式数は仮の試算だと示す");
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
      assert.match(scenario.label, /^(オンサイト|オフサイト)・/, "方式名に処理場所を付ける（同じ方式名が並ばないように）");
    }
  }
  assert.equal(payload.model.summaryMd, null, "試算の要約は画面に出さないので写さない");

  // 載せる範囲: 説明文・主要な前提・注意書き1件ずつを外せる。方式ごとの総コストの表は常に載せる。
  const scoped: CostModelBundle = {
    ...bundle,
    model: { ...bundle.model, systemScopeMd: "CANARY_SCOPE_TEXT" },
    notes: [...bundle.notes, { costNoteId: "n3", section: "caveat", title: "CANARY_EXCLUDED_CAVEAT", bodyMd: "CANARY_EXCLUDED_BODY", sourceUrl: null, sourceLabel: null, visibility: "amd_internal", sortOrder: 3 }],
  };
  const parts = listDdCostModelParts(scoped);
  assert.deepEqual(parts.map((part) => part.key), ["scope", "assumptions", "caveat:n1", "caveat:n3"]);
  const picked = projectDdCostModel(scoped, new Set(["assumptions", "caveat:n1"]));
  assertNoCanary(picked, "外した説明文・注意書き");
  assert.deepEqual(picked.caveats.map((row) => row.title), ["量産の値下がりは入れていない"]);
  assert.equal(picked.keyAssumptions.length, 1);
  assert.ok(picked.strains.length > 0 && picked.strains.every((strain) => strain.scenarios.length > 0), "総コストの表は範囲によらず載せる");
  assert.equal(projectDdCostModel(scoped, new Set(["scope"])).keyAssumptions.length, 0, "主要な前提を外せる");
  assert.deepEqual(projectDdCostModel(scoped, allKeys(parts)), projectDdCostModel(scoped), "全部選ぶと未選択と同じ");
}

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
      assumptions: ["2027年4月1日設立・シード1億円入金を目標とする。", "CANARY_EXCLUDED_ASSUMPTION"],
      bridgePolicy: ["不採択時は採否判明時に再計画する。", "CANARY_DILUTION_STANCE"],
      cases: [{ key: "adopted", description: "基本ケース" }],
      monthlyCosts: [{ label: "大学共同研究費", amountYen: 830000, status: "今回指定" }],
      equipment: [{ label: "有償PoC装置 1号機", amountYen: 6600000, orderYm: "2027-10", deliveryYm: "2027-12", note: "CANARY_EQUIPMENT_NOTE" }],
      source: { workbookSha256: "CANARY_WORKBOOK_HASH", adoptedMaterial: "CANARY_BANK_REQUEST_DOC", cutoff: "2028年6月までを今回改定。" },
    },
    // 初月の行には summary の全文がもう1つ入っている（元データの形そのまま）。
    months: [{ ym: "2027-04", planning_details_json: { version: "v1", scenarios: [], summary: { bridgePolicy: ["CANARY_MONTH_SUMMARY_COPY"] } } }],
  } as unknown as FundingPlan;
  const parts = listDdFundingPlanParts(plan);
  assert.deepEqual(parts.map((part) => part.group), [
    "採択・不採択時の調達方針",
    "採択・不採択時の調達方針",
    "STS対象経費・支払時期・未確定条件",
    "STS対象経費・支払時期・未確定条件",
    "その他",
    "その他",
  ]);
  const keep = new Set(parts.filter((part) => !part.label.includes("CANARY") && part.key !== "source" && part.key !== "equipmentNotes").map((part) => part.key));
  const picked = projectDdFundingPlan(plan, keep);
  assertNoCanary(picked, "外した方針・前提・採用資料・備考");
  assert.deepEqual(picked.plan.summary.bridgePolicy, ["不採択時は採否判明時に再計画する。"]);
  assert.equal(picked.plan.summary.source.cutoff, "2028年6月までを今回改定。", "改定範囲の説明は残す");
  const all = projectDdFundingPlan(plan, allKeys(parts));
  assert.deepEqual(all, projectDdFundingPlan(plan), "全部選ぶと未選択と同じ");
  assert.equal(all.plan.summary.source.workbookSha256, "", "元の試算表の hash は写さない");
  assert.equal(plan.summary.bridgePolicy.length, 2, "元データ（入力）を書き換えない");
  assert.equal(picked.plan.months[0].planning_details_json.summary, null, "月の行に入っている summary の写しは写さない");
  assert.ok(plan.months[0].planning_details_json.summary !== null, "元データの月の行を書き換えない");
}

console.log("dd payload allowlist: ok");
