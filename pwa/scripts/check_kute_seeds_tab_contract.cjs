#!/usr/bin/env node
// 研究機関PJ: 年度内ロードマップのデータを通常のガントへ統合し、
// 連携シーズ比較を専用 seeds グループへ置いた契約を検査する。
// - institution_projects による動的判定 / 通常PJのフォールバック / ガント既存維持。
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const tabs = read("src/lib/cockpit-tabs.ts");
if (!tabs.includes('"seeds",')) throw new Error("COCKPIT_TABS must list seeds (共通URL一覧)");

// タブの並びはPJタイプ（projects.project_category = ecosystem）で決める。研究機関との結び付き
// （institution_projects）は、シーズ一覧・規程の中身を読むのにだけ使う（2026-10-03 まさ「全部統一してないとだめ」、spec 3-23）。
const page = read("src/app/(app)/project/[projectId]/cockpit/page.tsx");
if (page.includes("resolveCockpitTab(") || page.includes("fetchInstitutionIdForProject"))
  throw new Error("cockpit page.tsx must not decide tabs by institution linkage; CockpitView resolves by PJ type");

const formats = read("src/lib/project-formats.ts");
if (!formats.includes('{ group: "seeds-group", tabs: ["seeds"] },'))
  throw new Error("ecosystem format must keep the seeds group");

const cockpit = read("src/components/cockpit/CockpitView.tsx");
for (const anchor of [
  "resolveCockpitTabForType(requestedTab, formatType)",
  'seeds: "シーズ一覧"',
  'aria-label="シーズ一覧"',
  'hidden={activeTab !== "seeds"}',
  "hasVisitedSeeds",
  'resolvedInstitutionId === undefined ? (',
  "このPJは研究機関と結び付いていないため、シーズ一覧は未登録。",
])
  if (!cockpit.includes(anchor)) throw new Error(`CockpitView missing ${anchor}`);

// ガント既存の CockpitProjectControl は props 不変のまま維持する。
if (!cockpit.includes("<CockpitProjectControl") || !cockpit.includes("view={workspaceView}"))
  throw new Error("CockpitProjectControl workspace rendering must stay intact");

if (cockpit.includes("CockpitKuteAnnualRoadmap") || fs.existsSync(path.join(root, "src/components/cockpit/CockpitKuteAnnualRoadmap.tsx")))
  throw new Error("standalone roadmap must be retired; its data belongs to the existing gantt");
if (!/\(activeTab === "seeds" \|\| hasVisitedSeeds\)[\s\S]*?hidden=\{activeTab !== "seeds"\}[\s\S]*?<ProjectInstitutionSeeds/.test(cockpit))
  throw new Error("institution seeds must remain mounted in their own hidden panel after the first visit");

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
// 仮の日付（provisional）で状況を確かめていない（unassessed）作業は、期限切れではなく未確認。
// 2026-10-03 まさ「全部統一してないとだめ。OSの大原則」で、KUTE の取り込みだけの規則から全PJ同じ規則にした（spec 3-23）。
const imported = {projectId:"p25",status:"unassessed",plannedEnd:"2026-06-30",dateCertainty:"provisional",sourceRef:"KUTE年度内ロードマップ / regulation-202606",progressPct:0};
for (const [task, expectedState] of [
  [imported, "unassessed"],
  [{...imported,status:"completed"}, "complete"],
  [{...imported,status:"blocked"}, "blocked"],
  [{...imported,status:"on_track"}, "overdue"],
  [{...imported,dateCertainty:"confirmed"}, "overdue"],
  [{...imported,projectId:"p21"}, "unassessed"],
  [{...imported,sourceRef:"PWA共有管理画面"}, "unassessed"],
]) if (classify(task, "2026-08-31") !== expectedState) throw new Error("provisional month-plan status boundary failed");
if (/projectId === "p\d+"/.test(timelineSource))
  throw new Error("timeline must not branch on PJ numbers (spec 3-23)");
if (!timelineSource.includes("到達目標 {sxFormatDate(timeline.objectiveDate)}"))
  throw new Error("objective marker label must be the same for every PJ");
console.log("Provisional month-plan status and uniform objective label OK");
