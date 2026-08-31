#!/usr/bin/env node
// KUTE (p25) 限定のコックピットタブ移設 (2026-08-31): 年次ロードマップをガントタブへ、
// 連携シーズ比較を専用 seeds タブへ移した回帰を検査する。
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
  'activeTab === "gantt" && project.projectId === "p25"',
  "hasVisitedSeeds",
  "hasKuteSeedsTab && hasVisitedSeeds",
])
  if (!cockpit.includes(anchor)) throw new Error(`CockpitView missing ${anchor}`);

// ガント既存の CockpitProjectControl は props 不変のまま維持する。
if (!cockpit.includes("<CockpitProjectControl") || !cockpit.includes("view={workspaceView}"))
  throw new Error("CockpitProjectControl workspace rendering must stay intact");

// 進捗タブ直下からロードマップの旧描画が消えていること (ガントへ移設済み、他PJの
// ProjectInstitutionSeeds 表示 = 現行progress配置は残す)。
if (cockpit.includes('activeTab === "progress" && project.projectId === "p25" && <CockpitKuteAnnualRoadmap'))
  throw new Error("annual roadmap must no longer render inside the progress tab");

if ((cockpit.match(/<CockpitKuteAnnualRoadmap\b/g) || []).length !== 1)
  throw new Error("annual roadmap must have exactly one render location");
if (cockpit.indexOf('<CockpitKuteAnnualRoadmap') < cockpit.indexOf('role="tablist"'))
  throw new Error("annual roadmap must render below the cockpit tabs");
if (!/hasKuteSeedsTab && hasVisitedSeeds[\s\S]*?hidden=\{activeTab !== "seeds"\}[\s\S]*?<ProjectInstitutionSeeds/.test(cockpit))
  throw new Error("KUTE seeds must remain mounted in their own hidden panel after the first visit");

console.log("kute seeds tab cockpit contract OK");
