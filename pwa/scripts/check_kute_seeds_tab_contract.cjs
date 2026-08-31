#!/usr/bin/env node
// KUTE (p25): 年度内ロードマップのデータを通常のガントへ統合し、
// 連携シーズ比較を専用 seeds タブへ移した契約を検査する。
// - KUTE の新配置 / 他PJ不変 / seeds URL の非KUTEフォールバック / ガント既存維持。
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const tabs = read("src/lib/cockpit-tabs.ts");
if (!tabs.includes('"seeds",')) throw new Error("COCKPIT_TABS must list seeds (共通URL一覧)");

const page = read("src/app/(app)/project/[projectId]/cockpit/page.tsx");
if (!page.includes('rawTab === "seeds" && projectId !== "p25"'))
  throw new Error("cockpit page.tsx must fall back non-KUTE ?tab=seeds to progress");

const cockpit = read("src/components/cockpit/CockpitView.tsx");
for (const anchor of [
  'const hasKuteSeedsTab = project.projectId === "p25";',
  '...(hasKuteSeedsTab ? [{ key: "seeds" as const, label: "シーズ" }] : []),',
  'aria-label="シーズ"',
  'hidden={activeTab !== "seeds"}',
  'activeTab === "progress" && project.projectId !== "p25" && <ProjectInstitutionSeeds',
  "hasVisitedSeeds",
  "hasKuteSeedsTab && hasVisitedSeeds",
])
  if (!cockpit.includes(anchor)) throw new Error(`CockpitView missing ${anchor}`);

// ガント既存の CockpitProjectControl は props 不変のまま維持する。
if (!cockpit.includes("<CockpitProjectControl") || !cockpit.includes("view={workspaceView}"))
  throw new Error("CockpitProjectControl workspace rendering must stay intact");

if (cockpit.includes("CockpitKuteAnnualRoadmap") || fs.existsSync(path.join(root, "src/components/cockpit/CockpitKuteAnnualRoadmap.tsx")))
  throw new Error("standalone roadmap must be retired; its data belongs to the existing gantt");
if (!/hasKuteSeedsTab && hasVisitedSeeds[\s\S]*?hidden=\{activeTab !== "seeds"\}[\s\S]*?<ProjectInstitutionSeeds/.test(cockpit))
  throw new Error("KUTE seeds must remain mounted in their own hidden panel after the first visit");

const migration = read("../ios/supabase/migrations/20260831223000_kute_annual_roadmap_gantt.sql");
const sql = migration.replace(/--[^\n]*/g, "");
if (/\b(UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(sql))
  throw new Error("KUTE seed migration must never overwrite user data or change schema");
if ((sql.match(/ON CONFLICT DO NOTHING/g) || []).length !== 5)
  throw new Error("every KUTE ledger insert must be idempotent");
if (/'p(?!25')[0-9]+'/.test(sql)) throw new Error("KUTE migration must not affect another PJ");
const taskValues = sql.slice(sql.lastIndexOf("FROM (VALUES"));
const expected = [
  ["301", "認定規程の着地", "2026-06-01", "2026-06-30", "6/22教授総会で通せる状態にする", "認定規程修正案 / 委員会規程 / 支援細則 / 想定問答"],
  ["302", "7規程の全体設計", "2026-07-01", "2026-07-31", "認定制度と残り6規程の接続を整理する", "規程マップ / 既存規程突合表 / 他大学比較 / 優先順位"],
  ["303", "残り6規程の素案化", "2026-08-01", "2026-08-31", "既存改訂・新規作成の条文たたきを作る", "兼業 / 新株予約権 / 共有機器 / 知財 / 共同研究 / 利益相反"],
  ["304", "学内議論・修正", "2026-09-01", "2026-11-30", "教授総会・関係部署・法務論点を反映する", "修正版 / 論点管理表 / 学内説明資料 / 施行準備メモ"],
  ["305", "規程整備完了", "2026-12-01", "2027-01-31", "条文だけでなく、運用に必要な付属物まで揃える", "施行版 / 様式 / 運用フロー / FAQ"],
  ["306", "シーズ発掘・after GTIE", "2026-06-01", "2027-03-31", "規程整備と並行して支援実務の型を作る", "桑折先生パイロット / ヒアリング設計 / 連携先マップ / 資金循環モデル"],
];
const tuples = [...taskValues.matchAll(/\('25000000-2026-4000-8000-000000000(30[1-6])',[\s\S]*?\)/g)];
if (tuples.length !== 6) throw new Error("roadmap must seed exactly six normal tasks");
for (const [id, ...texts] of expected) {
  const tuple = tuples.find(match => match[1] === id)?.[0] || "";
  for (const text of texts) if (!tuple.includes(`'${text}'`)) throw new Error(`roadmap ${id} lost ${text}`);
}
for (const anchor of ["'regulation', '制度整備'", "'seed', 'シーズ発掘・after GTIE'", "'2026-06-01', '2027-01-31'", "'2026-06-01', '2027-03-31'", "'unassessed', 0, 'provisional'", "月単位計画", "担当未確認"])
  if (!sql.includes(anchor)) throw new Error(`gantt migration missing ${anchor}`);
if ((sql.match(/'phase',/g) || []).length !== 2 || (sql.match(/'milestone',/g) || []).length !== 2)
  throw new Error("gantt needs two hidden date-domain containers and two terminal point milestones");
console.log("KUTE seeds tab and annual-roadmap gantt data contract OK");

// Run the actual pure row classifier without loading React/browser modules.
const vm = require("vm");
const timelineSource = read("src/components/project-workspace/SxUnifiedTimeline.tsx");
const classifyBody = timelineSource.match(/function classifyTask\([^\n]+\)\s*:\s*DisplayRow\["state"\]\s*\{([\s\S]*?)\n\}/)?.[1];
if (!classifyBody) throw new Error("classifyTask contract unavailable");
const classify = vm.runInNewContext(`(task, asOf) => {${classifyBody}}`);
const imported = {projectId:"p25",status:"unassessed",plannedEnd:"2026-06-30",dateCertainty:"provisional",sourceRef:"KUTE年度内ロードマップ / regulation-202606",progressPct:0};
for (const [task, expectedState] of [
  [imported, "unassessed"],
  [{...imported,status:"completed"}, "complete"],
  [{...imported,status:"blocked"}, "blocked"],
  [{...imported,status:"on_track"}, "overdue"],
  [{...imported,dateCertainty:"confirmed"}, "overdue"],
  [{...imported,projectId:"p21"}, "overdue"],
  [{...imported,sourceRef:"PWA共有管理画面"}, "overdue"],
]) if (classify(task, "2026-08-31") !== expectedState) throw new Error("KUTE month-plan status boundary failed");
if (!timelineSource.includes('projectId === "p25" ? `年度末 ${timeline.objectiveDate?.slice(0, 7)}（目途）`'))
  throw new Error("KUTE fiscal objective must not be labeled company founding or a confirmed day");
console.log("KUTE provisional month-plan status and fiscal objective labels OK");
