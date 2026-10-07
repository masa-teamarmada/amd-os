/**
 * PJ概要タブ（PJ管理）の標準フォーマットと、事業の一言の入口の契約検査（spec 3-23 §9）。
 *
 * まさ確定 2026-10-04「1で進めて」（PJの定義5項目・今の状態4項目）。
 * 前段の指摘「そもそも概要って、PJ作ったときに作ったら、それ以降書き換えることはないのでは？」に対し、
 * 事業の一言を書き換えられる入口の数で止める（入口は会社概要の1つだけ）。
 *
 * 1. 組み立ての純関数（目的・次のMS・まだ決まっていないこと・段階・収支・期間・報酬形態）が正しく返すか
 * 2. 報酬形態の種類が、定義（project-formats.ts）と DB の CHECK（migration 468）で同じか
 * 3. 画面が定義の9項目を全部描き、読み込み層を通しているか。コックピットの PJ概要がこの画面か
 * 4. 事業の一言（project_ventures.short_description / long_description）を書く入口が増えていないか
 *    （つくよみの追記マージ・チャットの道具・Venture Map の分類の編集から外した。正本は会社概要の1つだけ）
 * 5. PJの定義と事業の概要を書くのは、管理者だけが通れる2つの API だけか
 *
 * 実行: node --experimental-strip-types scripts/check_project_overview_contract.mts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AMD_REVENUE_KINDS, PROJECT_OVERVIEW_GROUPS, PROJECT_OVERVIEW_SECTIONS } from "../src/lib/project-formats.ts";
import {
  normalizeRevenueStreams,
  overviewNextMilestone,
  overviewOpenItems,
  overviewPeriod,
  overviewPurpose,
  overviewSeason,
  overviewStage,
  type ProjectOverviewPayload,
} from "../src/lib/project-overview.ts";
import type { ProposalNode, QuestionNode } from "../src/lib/question-tree-types.ts";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));
let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function q(partial: Partial<QuestionNode> & { id: string }): QuestionNode {
  return {
    parentId: null,
    title: partial.id,
    questionKind: "open",
    status: "open",
    isProposed: false,
    dueDate: null,
    nextDueDate: null,
    isOverdue: false,
    sortOrder: 0,
    ...partial,
  } as unknown as QuestionNode;
}

const TODAY = "2026-10-04";
const tree = {
  allQuestions: [
    q({ id: "goal-a", questionKind: "goal", title: "2027年9月にシリーズAを終える", dueDate: "2027-09-30" }),
    q({ id: "goal-b", questionKind: "goal", title: "承認待ちの到達点", isProposed: true }),
    q({ id: "goal-dropped", questionKind: "goal", status: "dropped" }),
    q({ id: "ms-past", questionKind: "milestone", parentId: "goal-a", dueDate: "2026-09-01" }),
    q({ id: "ms-next", questionKind: "milestone", parentId: "goal-a", dueDate: "2026-12-01" }),
    q({ id: "ms-later", questionKind: "milestone", parentId: "goal-a", dueDate: "2027-03-01" }),
    q({ id: "ms-proposed", questionKind: "milestone", parentId: "goal-a", dueDate: "2026-10-10", isProposed: true }),
    q({ id: "ms-done", questionKind: "milestone", parentId: "goal-a", dueDate: "2026-10-05", status: "answered" }),
    q({ id: "open-1", parentId: "ms-next", nextDueDate: "2026-11-01", isOverdue: false }),
    q({ id: "open-2", parentId: "ms-next", questionKind: "hypothesis", dueDate: "2026-09-20", isOverdue: true }),
    q({ id: "open-answered", parentId: "ms-next", status: "answered" }),
    q({ id: "open-proposed", parentId: "ms-next", isProposed: true }),
  ],
  proposals: [
    { kind: "question", id: "goal-b" },
    { kind: "question", id: "open-proposed" },
    { kind: "action", id: "todo-1" },
  ] as unknown as ProposalNode[],
};

check("PJの目的はゴールツリーの根の到達点（承認済みと承認待ちを分け、中止は出さない）", () => {
  const purpose = overviewPurpose(tree);
  assert.deepEqual(purpose.accepted.map((x) => x.id), ["goal-a"]);
  assert.deepEqual(purpose.proposed.map((x) => x.id), ["goal-b"]);
  assert.deepEqual(overviewPurpose(null), { accepted: [], proposed: [] });
});

check("次のMSは、承認済みで開いているMSのうち今日以降でいちばん近いもの", () => {
  const ms = overviewNextMilestone(tree, TODAY);
  assert.equal(ms.next?.id, "ms-next");
  assert.deepEqual(ms.overdue.map((x) => x.id), ["ms-past"]);
  assert.equal(ms.total, 3);
  assert.equal(overviewNextMilestone(null, TODAY).next, null);
});

check("まだ決まっていないことは、承認済みで開いている論点・仮説と承認待ちの数", () => {
  const open = overviewOpenItems(tree);
  assert.equal(open.openCount, 2);
  assert.equal(open.overdueCount, 1);
  assert.deepEqual(open.top.map((x) => x.id), ["open-2", "open-1"]);
  assert.equal(open.proposalCount, 3);
  assert.equal(open.proposalQuestions, 2);
  assert.equal(open.proposalActions, 1);
});

const base: ProjectOverviewPayload = {
  projectId: "pX",
  identity: { projectName: "X", displayName: null, clientName: "物質・材料研究機構", status: "active", projectCategory: "dtsu", startYm: "202606", endYm: null },
  venture: { lane: "gx_energy", outcomePattern: "planning", foundedAt: "2027-01-01", originOrg: "NIMS", originPi: "研究者", amdRole: "founder_studio", supportStartedAt: "2025-11-01", supportEndedAt: null },
  company: { legalStatus: "pre_incorporation", legalName: "仮", incorporatedOn: null },
  definition: null,
  members: [],
  seeds: [],
  signals: [],
};

check("段階と設立は、会社概要の登記を先に、無ければ Venture Map の設立年月（未来なら予定）", () => {
  assert.deepEqual(overviewStage(base, TODAY).founding, { kind: "planned", date: "2027-01-01" });
  assert.equal(overviewStage(base, TODAY).outcome, "計画中（Before 0）");
  assert.equal(overviewStage(base, TODAY).status, "稼働中");
  assert.deepEqual(overviewStage({ ...base, company: { legalStatus: "incorporated", legalName: "株式会社X", incorporatedOn: "2024-04-01" } }, TODAY).founding, { kind: "founded", date: "2024-04-01" });
  assert.deepEqual(overviewStage({ ...base, venture: null, company: null }, TODAY).founding, { kind: "none", date: null });
  // CX: 会社概要は設立前で、設立日の欄に計画の日付（2027-01-01）が入っている → 設立済みと言わない
  assert.deepEqual(
    overviewStage({ ...base, company: { legalStatus: "pre_incorporation", legalName: "仮", incorporatedOn: "2027-01-01" } }, TODAY).founding,
    { kind: "planned", date: "2027-01-01" },
  );
  // 設立前のまま予定日を過ぎても、設立済みとは言わない（会社概要の法人状態が正）
  assert.deepEqual(
    overviewStage({ ...base, company: { legalStatus: "pre_incorporation", legalName: "仮", incorporatedOn: "2026-04-01" } }, TODAY).founding,
    { kind: "planned", date: "2026-04-01" },
  );
  // 会社概要が無く、Venture Map の設立年月が過去なら設立済み
  assert.deepEqual(overviewStage({ ...base, company: null, venture: { ...base.venture!, foundedAt: "2019-04-01" } }, TODAY).founding, { kind: "founded", date: "2019-04-01" });
});

check("AMDが関わる期間は、Venture Map の参画期間を先に、無ければ PJ の期間", () => {
  assert.deepEqual(overviewPeriod(base), { start: "2025-11", end: null, source: "venture" });
  assert.deepEqual(overviewPeriod({ ...base, venture: null }), { start: "2026-06", end: null, source: "project" });
  assert.equal(overviewPeriod({ ...base, venture: null, identity: { ...base.identity, startYm: null } }), null);
});

check("収支は今のシーズン（無ければ直近）。消化は「収支」タブの棒と同じく支払済み＋未払い残", () => {
  const seasons = [
    { periodStartYm: "202604", periodEndYm: "202609", invoiceTotalYen: 6_000_000, memberBudgetYen: 3_000_000, paidSumYen: 2_000_000, finalStockSumYen: 400_000 },
    { periodStartYm: "202610", periodEndYm: "202703", invoiceTotalYen: 7_200_000, memberBudgetYen: 3_600_000, paidSumYen: 360_000, finalStockSumYen: 0 },
  ];
  const now = overviewSeason(seasons, "202610");
  assert.equal(now?.isCurrent, true);
  assert.equal(now?.periodStartYm, "202610");
  assert.equal(now?.consumedShare, 0.1);
  const after = overviewSeason(seasons, "202706");
  assert.equal(after?.isCurrent, false);
  assert.equal(after?.periodEndYm, "202703");
  assert.equal(overviewSeason([], "202610"), null);
});

check("報酬形態は定義にある種類だけ。中身は文字列", () => {
  assert.deepEqual(
    normalizeRevenueStreams([{ kind: "contract_fee", note: " NIMSからの業務委託 " }, { kind: "unknown", note: "x" }, { kind: "equity" }, "bad"]),
    [{ kind: "contract_fee", note: "NIMSからの業務委託" }, { kind: "equity", note: "" }],
  );
  assert.deepEqual(normalizeRevenueStreams(null), []);
});

check("報酬形態の種類が、定義（鍵付き）と DB の CHECK（migration 468）で同じ並び", () => {
  const sql = read("scripts/migrations/468_project_overview_definitions.sql");
  const match = sql.match(/ANY \(ARRAY\[([^\]]+)\]\)/);
  assert.ok(match, "migration 468 に報酬形態の種類の CHECK がある");
  const dbKinds = match[1].split(",").map((part) => part.trim().replace(/^'|'$/g, ""));
  assert.deepEqual(dbKinds, AMD_REVENUE_KINDS.map((kind) => kind.key));
});

check("PJ概要は2つのまとまり・9項目（PJの定義5・今の状態4）", () => {
  assert.deepEqual(PROJECT_OVERVIEW_GROUPS.map((g) => g.key), ["definition", "status"]);
  assert.equal(PROJECT_OVERVIEW_SECTIONS.length, 9);
  assert.equal(PROJECT_OVERVIEW_SECTIONS.filter((s) => s.group === "definition").length, 5);
  assert.equal(PROJECT_OVERVIEW_SECTIONS.filter((s) => s.group === "status").length, 4);
});

check("画面は定義の9項目を全部描き、読み込み層を通す。コックピットの PJ概要はこの画面", () => {
  const view = read("src/components/cockpit/ProjectOverviewFormat.tsx");
  assert.match(view, /PROJECT_OVERVIEW_GROUPS\.map\(/, "まとまりは定義の順に描く");
  assert.match(view, /PROJECT_OVERVIEW_SECTIONS\.filter\(/, "項目は定義の順に描く");
  assert.match(view, /data-overview-section=\{section\.key\}/);
  for (const section of PROJECT_OVERVIEW_SECTIONS) {
    assert.match(view, new RegExp(`\\b${section.key}: ${section.key}Body\\b`), `項目「${section.label}」の中身がある`);
  }
  for (const loader of ["loadProjectOverview", "loadQuestionTree", "loadSeasonBudget", "saveProjectDefinition"]) {
    assert.ok(view.includes(loader), `${loader} を通す`);
  }
  assert.doesNotMatch(view, /fetch\(/, "画面から素の fetch をしない（spec 5-10）");
  const cockpit = read("src/components/cockpit/CockpitView.tsx");
  assert.ok(cockpit.includes("<ProjectOverviewFormat key={project.projectId} project={project} onSelectTab={selectTab} />"), "PJ概要タブはこの画面を描く");
  assert.doesNotMatch(cockpit, /sections="identity"/, "旧い見出し（事業の一言のマージ付き）を PJ概要に描かない");
  assert.ok(read("src/components/cockpit/CockpitCompanyOverview.tsx").includes("<CompanyBusinessSummarySection"), "会社概要に事業の概要を描く");
});

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|mts|mjs)$/.test(entry.name) ? [full] : [];
  });
}

/** `.update(` などの引数を、括弧の対応をたどって切り出す。 */
function callArguments(source: string, method: string): string[] {
  const out: string[] = [];
  const needle = `.${method}(`;
  let index = source.indexOf(needle);
  while (index !== -1) {
    let depth = 0;
    let end = index + needle.length - 1;
    for (; end < source.length; end += 1) {
      const ch = source[end];
      if (ch === "(" || ch === "{" || ch === "[") depth += 1;
      else if (ch === ")" || ch === "}" || ch === "]") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push(source.slice(index, end + 1));
    index = source.indexOf(needle, end);
  }
  return out;
}

check("事業の一言を書く入口は会社概要の1つだけ（ほかのコードから short_description / long_description を書かない）", () => {
  assert.ok(!exists("src/app/api/project-ventures/[projectId]/description-merge/route.ts"), "つくよみの追記マージの API は無い");
  assert.ok(!exists("src/components/cockpit/CockpitDescriptionDetailModal.tsx"), "追記マージの画面は無い");
  const tsukuyomi = read("src/app/api/tsukuyomi/chat/route.ts");
  assert.doesNotMatch(tsukuyomi, /name: "update_short_long_description"/, "つくよみのチャットに概要を書き換える道具が無い");
  const meta = read("src/lib/venture-status-data.ts").match(/export interface VentureMetaPatch \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(meta, "VentureMetaPatch がある");
  assert.doesNotMatch(meta, /\b(short|long)_description\?:/, "Venture Map の分類の保存に事業の一言を混ぜない");
  const offenders: string[] = [];
  for (const full of walk(path.join(ROOT, "src"))) {
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    const source = fs.readFileSync(full, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (/\b[A-Za-z_$][\w$]*\.(short|long)_description\s*=(?!=)/.test(source)) offenders.push(`${rel}（代入）`);
    for (const method of ["update", "upsert", "insert"]) {
      for (const args of callArguments(source, method)) {
        if (/\b(short|long)_description\b/.test(args)) offenders.push(`${rel}（.${method}）`);
      }
    }
  }
  assert.deepEqual(offenders, [], `事業の一言を書くコード: ${offenders.join(", ")}。正本は project_business_summaries（会社概要・管理者だけ）`);
});

check("migration 468 より後は、project_ventures の事業の一言を直に書き換えない", () => {
  const dir = path.join(ROOT, "scripts/migrations");
  const offenders = fs
    .readdirSync(dir)
    .filter((name) => Number(name.match(/^(\d+)_/)?.[1] ?? 0) > 468)
    .filter((name) => /update\s+(public\.)?project_ventures\b[\s\S]{0,600}?\b(short|long)_description\b/i.test(fs.readFileSync(path.join(dir, name), "utf8")));
  assert.deepEqual(offenders, [], `${offenders.join(", ")}: 事業の一言は project_business_summaries を書き換える（控えはトリガーが写す）`);
  const sql = read("scripts/migrations/468_project_overview_definitions.sql");
  assert.match(sql, /CREATE TRIGGER project_ventures_business_summary_guard/);
  assert.match(sql, /CREATE TRIGGER project_business_summaries_sync_venture/);
});

check("PJの定義と事業の概要は、それぞれ認可された専用 API だけが書く", () => {
  const allowed = new Map([
    ["project_definitions", "src/app/api/project/[projectId]/overview/route.ts"],
    ["project_business_summaries", "src/app/api/project/[projectId]/business-summary/route.ts"],
  ]);
  for (const [table, route] of allowed) {
    const source = read(route);
    if (table === "project_definitions") {
      assert.match(source, /export async function PATCH[\s\S]*?requireAdmin\(\)/, `${route} の定義変更は管理者だけ`);
    } else {
      assert.match(source, /export async function PATCH[\s\S]*?requireProjectContentEditor\(req,\s*projectId\)/, `${route} の事業概要変更は対象PJのコンテンツ編集者だけ`);
    }
    for (const full of walk(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, full).split(path.sep).join("/");
      if (rel === route) continue;
      const text = fs.readFileSync(full, "utf8");
      const writes = new RegExp(`from\\(\\s*["'\`]${table}["'\`]\\s*\\)\\s*\\.(update|upsert|insert|delete)\\(`).test(text);
      assert.ok(!writes, `${rel} が ${table} を書いている（書くのは ${route} だけ）`);
    }
  }
});

console.log(`✓ PJ概要の標準フォーマットと事業の一言の入口 ${passed}件`);
