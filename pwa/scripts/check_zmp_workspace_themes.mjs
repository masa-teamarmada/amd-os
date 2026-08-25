import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const pwaDir = path.resolve(scriptsDir, "..");
const repoDir = path.resolve(pwaDir, "..");
const readPwa = (relativePath) => readFileSync(path.join(pwaDir, relativePath), "utf8");
const readRepo = (relativePath) => readFileSync(path.join(repoDir, relativePath), "utf8");

const migration = readRepo(
  "ios/supabase/migrations/20260826150000_project_management_track_value_milestones.sql",
);
const bundle = readPwa("src/lib/project-workspace.ts");
const dashboard = readPwa("src/components/project-workspace/SxWeeklyControlDashboard.tsx");
const themeRoutes = readPwa("src/components/project-workspace/ProjectThemeRoutes.tsx");
const themeCss = readPwa("src/components/project-workspace/project-theme-routes.module.css");
const sharedPage = readPwa("src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx");

const THEMES = [
  ["okudoor", "OkuDoor", 3],
  ["katsushika_hydrogen", "葛飾水素循環", 2],
  ["kr_management_reform", "KR経営改革", 4],
];
const MILESTONE_TITLES = [
  "OkuDoor運営巻き取り戦略・契約スキーム設計",
  "OkuDoorシステム開発",
  "OkuDoor現地運用・オープン検証",
  "水素 助成金・補助金申請",
  "水素 産学連携・フェーズ2事業開発",
  "定例運営",
  "事務手続き（請求・経費精算）",
  "SEAMS変更登記準備（法人化中止につき終了）",
  "採用支援",
];

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.project_management_track_value_milestones/);
assert.match(migration, /UNIQUE \(project_id, milestone_id\)/, "同一PJの1成果目標は1テーマに限定する");
assert.match(
  migration,
  /JOIN public\.value_plan_cycles vpc[\s\S]*ms_project_id <> NEW\.project_id/,
  "bridgeのproject_idと成果目標のPJ一致をDBで強制する",
);
assert.match(migration, /FOR SELECT TO authenticated USING \(public\.amd_os_is_member\(\)\)/);
assert.match(migration, /FOR ALL TO authenticated USING \(public\.is_admin\(\)\)/);
assert.match(migration, /FOR ALL TO service_role USING \(true\) WITH CHECK \(true\)/);

for (const [key, label, count] of THEMES) {
  assert.ok(migration.includes(`'p19', '${key}', '${label}'`), `${label}をp19へseedする`);
  assert.match(
    migration,
    new RegExp(`track_key = '${key}'[\\s\\S]*?<> ${count}`),
    `${label}の成果目標件数を${count}件でassertする`,
  );
}
for (const title of MILESTONE_TITLES) {
  assert.ok(migration.includes(`vm.title = '${title}'`), `${title}を完全一致で接続する`);
}
assert.equal(
  [...migration.matchAll(/ON CONFLICT \(project_id, milestone_id\) DO UPDATE SET/g)].length,
  9,
  "9成果目標すべてを一意キーで冪等upsertする",
);
assert.equal(
  [...migration.matchAll(/track_key = EXCLUDED\.track_key/g)].length,
  9,
  "既存の誤ったテーマ接続も正しいテーマへ付け替える",
);

assert.match(bundle, /project_management_tracks/);
assert.match(bundle, /project_management_track_value_milestones/);
assert.match(bundle, /\.select\("milestone_id,track_key,sort_order"\)/);
assert.match(bundle, /\.select\("milestone_key,ym,progress_pct,source,confirmed_at,created_at"\)/);
assert.match(bundle, /themes: ProjectWorkspaceBundle\["themes"\]/);
assert.doesNotMatch(bundle, /milestoneRows \?\? \[\]\)\.slice\(0, 8\)/, "9件目を落とさない");

assert.match(dashboard, /themes: "theme-progress"/);
assert.match(dashboard, /tabs\.unshift\(\{ key: "themes", label: "テーマ進捗" \}\)/);
assert.match(dashboard, /\(\) => \(hasThemes \? "themes" : "weekly"\)/);
assert.ok(
  dashboard.indexOf("const fromHash = viewForHash") < dashboard.indexOf("window.localStorage.getItem"),
  "明示hashをlocalStorageより優先する",
);
assert.match(dashboard, /if \(hasThemes\) \{\s*setActiveView\("themes"\)/);
assert.match(
  dashboard,
  /\(access\.scope === "portfolio" \|\| access\.isAdmin\)[\s\S]*?href="\/dashboard"[\s\S]*?\/cockpit/,
  "内部portfolio/adminだけにAMD OSホームとコックピット導線を出す",
);

const externalBranch = sharedPage.indexOf('if (access.principal === "workspace_account")');
const internalDashboard = sharedPage.indexOf("<SxWeeklyControlDashboard");
assert.ok(externalBranch >= 0 && internalDashboard > externalBranch, "外部accountを内部dashboardより先に分岐する");
assert.doesNotMatch(
  sharedPage.slice(externalBranch, internalDashboard),
  /href="\/dashboard"|\/cockpit/,
  "外部accountの画面に内部導線を置かない",
);

assert.match(themeRoutes, /routine_auto: "予定進行"/);
assert.match(themeRoutes, /PM_LOCKED_SOURCES/);
assert.match(themeRoutes, /timeZone: "Asia\/Tokyo"/);
assert.match(themeRoutes, /月の月次値/);
assert.doesNotMatch(themeRoutes, /平均|average/i, "テーマ平均を偽の進捗として出さない");
assert.doesNotMatch(themeCss, /linear-gradient|radial-gradient/, "テーマ画面にgradientを持ち込まない");

console.log("zmp workspace themes contract: ok");
