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

const migration = read("../ios/supabase/migrations/20260901184500_kute_fy2026_task_rebuild.sql");
const sql = migration.replace(/--[^\n]*/g, "");
if (/'p(?!25')[0-9]+'/.test(sql)) throw new Error("KUTE task rebuild must not affect another PJ");
for (const anchor of [
  "KUTE old task preflight failed",
  "KUTE has active tasks outside the reviewed six-row import",
  "deleted_by = 'kute-fy2026-task-rebuild'",
  "KUTE rebuilt task count is not 38",
  "KUTE completed task count is not 9",
  "認定規程と内規の決裁結果を確認する",
  "株式と新株予約権の取得管理ルールを原案にする",
  "研究者への接触と情報共有の承認手順を決める",
  "実証を受け入れる事業会社を探す",
  "大学の支援運営費と収入源を整理する",
  "今期3領域の業務成果報告書を提出する",
]) if (!sql.includes(anchor)) throw new Error(`KUTE rebuilt ledger missing ${anchor}`);
const taskIds = [...sql.matchAll(/'25000000-2026-4000-8000-000000000(4\d\d)'/g)]
  .map(match => match[1])
  .filter(id => Number(id) >= 401 && Number(id) <= 438);
if (new Set(taskIds).size !== 38) throw new Error("KUTE rebuilt ledger must define 38 stable task IDs");
if ((sql.match(/,'completed','confirmed'/g) || []).length !== 9)
  throw new Error("KUTE rebuilt ledger must mark exactly nine evidence-backed tasks complete");
for (const track of ["認定制度", "関連6規程", "シーズ発掘", "桑折先生", "自走化・連携", "年度報告"])
  if (!sql.includes(`'${track}'`)) throw new Error(`KUTE rebuilt ledger missing track ${track}`);
console.log("KUTE seeds tab and reviewed FY2026 gantt data contract OK");

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
