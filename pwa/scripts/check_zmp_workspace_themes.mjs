import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const pwaDir = path.resolve(scriptsDir, "..");
const repoDir = path.resolve(pwaDir, "..");
const readPwa = (relativePath) => readFileSync(path.join(pwaDir, relativePath), "utf8");
const readRepo = (relativePath) => readFileSync(path.join(repoDir, relativePath), "utf8");

// 20260826150000 is unchanged history — its own seed (3 themes: okudoor/katsushika_hydrogen/
// kr_management_reform, 3/2/4) is retained below exactly as originally asserted. It is superseded
// at RUNTIME by 20260831120000 (which renames/splits those same tracks into the current 4 via
// UPDATE, not by editing this file), so both migrations' own content stay independently correct
// and both get checked.
const migration = readRepo(
  "ios/supabase/migrations/20260826150000_project_management_track_value_milestones.sql",
);
const themeHubMigration = readRepo("ios/supabase/migrations/20260831120000_project_theme_hub.sql");
const hydrogenLedgerMigration = readRepo("ios/supabase/migrations/20260901153000_zmp_hydrogen_management_ledger.sql");
const objectiveBranchMigration = readRepo("ios/supabase/migrations/20260901223000_zmp_objective_branch_history.sql");
const bundle = readPwa("src/lib/project-workspace.ts");
const dashboard = readPwa("src/components/project-workspace/SxWeeklyControlDashboard.tsx");
const themeRoutes = readPwa("src/components/project-workspace/ProjectThemeRoutes.tsx");
const objectiveMap = readPwa("src/components/project-workspace/SxObjectiveMap.tsx");
const objectiveMapCss = readPwa("src/components/project-workspace/sx-objective-map.module.css");
const partnerPipeline = readPwa("src/components/project-workspace/SxPartnerPipeline.tsx");
const themeCss = readPwa("src/components/project-workspace/project-theme-routes.module.css");
const sharedPage = readPwa("src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx");
const sharedAccess = readPwa("src/lib/project-shared-workspace-access.ts");
const themeHubRoute = readPwa("src/app/api/project-workspace/[projectId]/theme/[trackKey]/route.ts");
const themeHubLib = readPwa("src/lib/project-theme-hub.ts");

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

// 現行(20260831120000): 4テーマ、正確なラベル・並び順・9件のマッピング(4/2/2/1)。
assert.match(
  themeHubMigration,
  /SET sort_order = 1, updated_at = now\(\)\s*WHERE project_id = 'p19' AND track_key = 'kr_management_reform'/,
  "KR経営改革はsort_order=1",
);
assert.match(
  themeHubMigration,
  /SET label = '水素循環PJ', short_label = '水素', sort_order = 2/,
  "水素循環PJはラベル変更+sort_order=2",
);
assert.match(
  themeHubMigration,
  /SET track_key = 'okudoor_operations', label = 'OkuDoor運営'[\s\S]{0,80}sort_order = 3/,
  "旧okudoorをokudoor_operations/OkuDoor運営へリネーム、sort_order=3",
);
assert.match(
  themeHubMigration,
  /VALUES \('p19', 'okudoor_system', 'OkuDoorシステム開発＆運用', 'システム', '#4c6a8f', 4\)/,
  "新規okudoor_system(OkuDoorシステム開発＆運用)をsort_order=4でinsert",
);
assert.match(themeHubMigration, /v_kr <> 4 THEN RAISE EXCEPTION/, "KR経営改革は4件のまま");
assert.match(themeHubMigration, /v_h2 <> 2 THEN RAISE EXCEPTION/, "水素循環PJは2件のまま");
assert.match(themeHubMigration, /v_ops <> 2 THEN RAISE EXCEPTION/, "OkuDoor運営は2件");
assert.match(themeHubMigration, /v_sys <> 1 THEN RAISE EXCEPTION/, "OkuDoorシステムは1件(旧okudoor運営から付け替え)");
assert.match(themeHubMigration, /CREATE TABLE IF NOT EXISTS public\.project_theme_profiles/);
assert.match(themeHubMigration, /CREATE TABLE IF NOT EXISTS public\.project_theme_meetings/);
assert.match(themeHubMigration, /CREATE TABLE IF NOT EXISTS public\.project_theme_documents/);
assert.match(themeHubMigration, /CREATE TABLE IF NOT EXISTS public\.project_theme_deliverables/);
assert.match(themeHubMigration, /CREATE TABLE IF NOT EXISTS public\.project_theme_work_links/);
assert.match(themeHubMigration, /amd_os_can_access_project\(project_id\)/, "テーマ関連4+1テーブルはproject-scoped SELECTを使う(旧amd_os_is_memberの広すぎるゲートに戻さない)");
assert.doesNotMatch(themeHubMigration, /USING \(public\.amd_os_is_member\(\)\)/, "新規テーマテーブルにamd_os_is_memberの広いSELECTを残さない");

assert.match(bundle, /project_management_tracks/);
assert.match(bundle, /project_management_track_value_milestones/);
assert.match(bundle, /\.select\("milestone_id,track_key,sort_order"\)/);
assert.match(bundle, /\.select\("milestone_key,ym,progress_pct,source,confirmed_at,created_at"\)/);
assert.match(bundle, /themes: ProjectWorkspaceBundle\["themes"\]/);
assert.doesNotMatch(bundle, /milestoneRows \?\? \[\]\)\.slice\(0, 8\)/, "9件目を落とさない");

assert.match(dashboard, /themes: "theme-progress"/, "既存hash(#theme-progress)は互換のため維持する");
assert.match(dashboard, /tabs\.unshift\(\{ key: "themes", label: "テーマ" \}\)/, "テーマ進捗→テーマへラベル変更(root review)");
assert.match(dashboard, /externalViewer \? externalDefaultView : hasThemes \? "themes" : "weekly"/);
assert.ok(
  dashboard.indexOf("const fromHash = viewForHash") < dashboard.indexOf("window.localStorage.getItem"),
  "明示hashをlocalStorageより優先する",
);
assert.match(dashboard, /if \(hasThemes\) \{\s*setActiveView\("themes"\)/);
// project-workspace.tsはproject_management_tracksが定義されている全PJ(p19/p21/p30)で
// themes配列を常に組み立てる(価値計画の有無に依存しない)。UI完成フェーズのroot指摘
// ("ZMP must default to themes even without valuePlan; non-ZMP initial view stays unchanged")
// により、既定タブの判定を「価値MSが実在するか」(=価値計画に依存する暗黙の推測)から、
// 明示的なプロジェクトID許可リストへ変更した。財務MSが0件でもZMPは既定でthemesへ着地し、
// SX/EHMは許可リストに無いので常に週次差分のままになる。
assert.match(
  dashboard,
  /const THEME_HUB_DEFAULT_PROJECT_IDS = new Set<string>\(\["p19"\]\);/,
  "テーマ既定ナビゲーションの許可リストはp19を明示的に含む",
);
assert.match(
  dashboard,
  /const hasThemes = THEME_HUB_DEFAULT_PROJECT_IDS\.has\(bundle\.project\.projectId\) && bundle\.themes\.length > 0;/,
  "既定タブの判定は許可リスト所属で行う(財務MSの有無に依存しない)",
);

// テーマ作業ハブの書き込みルート(root review 8件の指摘を反映済み)。
assert.match(themeHubRoute, /isSameOriginWorkspaceMutation/, "same-origin検証を経由する");
assert.match(themeHubRoute, /access\.scope !== "portfolio" && !access\.isAdmin/, "manager権限(portfolio/admin)を要求する");
assert.match(themeHubLib, /export function pickPresent/, "PATCHは省略フィールドを保持する(pickPresent)");
assert.match(themeHubLib, /requiredUuid/, "client_tokenはサーバ側で生成せず必須入力にする");
assert.match(themeHubLib, /CANONICAL_FK_PAIRS/, "issue-milestone等は既存FKを使い、work_linksへ複製しない");
assert.doesNotMatch(themeHubLib, /randomUUID/, "client_tokenのサーバ側フォールバック生成を残さない");
assert.match(
  dashboard,
  /\(access\.scope === "portfolio" \|\| access\.isAdmin\)[\s\S]*?href="\/dashboard"[\s\S]*?\/cockpit/,
  "内部portfolio/adminだけにAMD OSホームとコックピット導線を出す",
);

assert.match(sharedPage, /access\.principal === "workspace_account"[\s\S]*?<SharedWorkspaceScopeRibbon/, "外部PJメンバーには外部スコープ表示を残す");
assert.match(sharedPage, /<SxWeeklyControlDashboard bundle=\{bundle\} access=\{access\}/, "内部・外部とも同じPJワークスペースを読む");
assert.doesNotMatch(sharedPage, /共有資料をひとつの場所で|PJの内部管理情報は表示しない/, "外部を資料室だけへ閉じる旧分岐を残さない");
assert.match(sharedAccess, /memberId: null;[\s\S]*?canManage: false;/, "外部PJメンバーは閲覧専用のまま");
assert.match(dashboard, /access\.principal === "workspace_account"[\s\S]*?tab\.key === "gantt"[\s\S]*?tab\.key === "partners"[\s\S]*?tab\.key === "drive"/, "外部PJメンバーの共有ナビはテーマ・ガント・関係先・資料へ限定する");

assert.match(themeRoutes, /routine_auto: "予定進行"/);
assert.match(themeRoutes, /PM_LOCKED_SOURCES/);
assert.match(themeRoutes, /timeZone: "Asia\/Tokyo"/);
assert.match(themeRoutes, /月の月次値/);
assert.doesNotMatch(themeRoutes, /平均|average/i, "テーマ平均を偽の進捗として出さない");
assert.doesNotMatch(themeCss, /linear-gradient|radial-gradient/, "テーマ画面にgradientを持ち込まない");

// 水素循環PJの混在履歴を、時間軸(ガント)と相手軸(関係先)へ正規化する。
assert.match(hydrogenLedgerMigration, /都内で水素をつくる・ためる・つかう/, "最上位目的をseedする");
for (const title of ["水素供給元の確保", "水素ステーション建設", "助成金・整備資金の確保", "シーズリスト作成"]) {
  assert.ok(hydrogenLedgerMigration.includes(title), `${title}をガント正本へseedする`);
}
assert.match(hydrogenLedgerMigration, /'東京理科大学・堂脇先生'[\s\S]*?'on_hold', 'on_hold'/, "堂脇先生は一旦停止");
assert.match(hydrogenLedgerMigration, /'pHydrogen'[\s\S]*?'information_exchange', 'waiting_internal'/, "pHydrogenは当方アクション待ち");
assert.match(hydrogenLedgerMigration, /'sx', NULL, '供給量・時期・単価・稼働枠/, "pHydrogenの現在ボールはAMD側");
assert.match(hydrogenLedgerMigration, /history_rows = '\[\]'::jsonb/, "既知7行の重複履歴はテーマ概要から外す");
assert.match(hydrogenLedgerMigration, /jsonb_array_length\(history_rows\) = 7/, "後続の手編集履歴を無条件で消さない");

assert.match(objectiveBranchMigration, /ADD COLUMN IF NOT EXISTS partner_id uuid/, "タスクから関係先正本へ直接接続する");
for (const title of ["東京理科大学・堂脇先生へのアプローチ", "pHydrogenへのアプローチ", "その他の供給候補を探索"]) {
  assert.ok(objectiveBranchMigration.includes(title), `${title}をシーズリスト作成の子へseedする`);
}
for (const event of ["コンタクト", "MTG実施", "やりとり継続・返答待ち", "先方からレスなし・一旦停止"]) {
  assert.ok(objectiveBranchMigration.includes(event), `堂脇先生の時系列に${event}を残す`);
}
assert.match(objectiveBranchMigration, /branch_count <> 3/, "シーズリスト作成からの3分岐をassertする");
assert.match(objectiveBranchMigration, /linked_count <> 2/, "2アプローチを関係先へ接続する");

// テーマは索引、ガントタブ内で時間軸と目的からの逆算を切替える。
assert.doesNotMatch(themeRoutes, /<ThemeHistory|import \{ ThemeHistory \}/, "テーマ面に重複する履歴台帳を残さない");
assert.match(themeRoutes, /onOpenControlView\?\.\("gantt", selectedTheme\.themeKey\)/, "テーマから目的構造へ遷移する");
assert.match(themeRoutes, /onOpenControlView\?\.\("partners", selectedTheme\.themeKey\)/, "テーマから関係先へ遷移する");
assert.match(dashboard, /"timeline" \| "objective"/, "ガントと目的構造の表示モードを持つ");
assert.match(dashboard, /<SxObjectiveMap/, "ガントタブ内に目的構造を描く");
assert.match(dashboard, />ガント<\/button>/, "ガント切替を出す");
assert.match(dashboard, />目的構造<\/button>/, "目的構造切替を出す");
assert.match(objectiveMap, /最上位の目的/);
assert.match(objectiveMap, /成立条件/);
assert.match(objectiveMap, /接点の経緯/);
assert.match(objectiveMap, /AMD側ボール/);
assert.match(objectiveMap, /一旦停止/);
assert.match(objectiveMap, /draggable=\{canManage/, "管理権限時にタスクカードをドラッグできる");
assert.match(objectiveMap, /＋ 子タスク/, "各カードから子タスクを手動追加できる");
assert.match(objectiveMap, /接続変更/, "接続先を明示選択できる");
assert.match(objectiveMap, /taskHasDescendant/, "循環参照になる接続をUIでも除外する");
assert.doesNotMatch(objectiveMapCss, /calc\(50%\s*\/|--branch-count|branchGrid/, "雑な全幅コネクタへ戻さない");
assert.match(objectiveMapCss, /\.treeBranch::before[\s\S]*?\.treeBranch::after/, "コネクタは各親子枝が所有する");
assert.match(objectiveMapCss, /--tree-accent:\s*var\(--amd-action\)/, "目的構造の主色はAMD OS共通の操作色を使う");
assert.match(objectiveMapCss, /\.nodeState\[data-state="completed"\][\s\S]*?var\(--amd-success\)/, "greenは完了状態に限定する");
assert.doesNotMatch(objectiveMapCss, /#0f766e|#ecf8f5|#0f675f|#185e56/i, "水素の連想から独自teal主色を復活させない");
assert.match(dashboard, /onMoveTask=\{moveObjectiveTask\}/, "接続変更を既存management writerへ保存する");
assert.match(dashboard, /parentTaskId: parentTask\.id/, "子タスク追加は親をフォームへ事前入力する");
assert.match(partnerPipeline, /activeTrack\?: SxTrackKey \| null/, "関係先リストは同じ正本をテーマで絞れる");
assert.match(partnerPipeline, /partner\.tracks\.some\(\(track\) => track\.track === activeTrack\)/, "副track所属もテーマ絞り込みへ含める");

// UI完成フェーズ (phase-ui.md / acceptance.md): 旧カードグリッドではなく、実際に作成/編集できる
// 機能面へ置き換わっていること。タスク/運用MS/論点/決定/アクションは既存のダッシュボード編集
// オーバーレイをそのまま開く(コピーではなく実カノニカルレコードの既存writer)。
assert.match(themeRoutes, /onOpenEditor\?\.\(\{ kind: "edit_task", task: t, hubOrigin: true \}\)/, "タスク編集は既存エディタをhubOrigin付きで開く");
assert.match(
  themeRoutes,
  /onOpenEditor\?\.\(\{ kind: "create_task", laneKey: selectedTheme\.themeKey, allowStandalone: true, hubOrigin: true \}\)/,
  "タスク作成は既存エディタをallowStandalone\\+hubOrigin付きで開く",
);
assert.match(
  themeRoutes,
  /onOpenEditor\?\.\(\{ kind: "create_milestone", track: selectedTheme\.themeKey, laneKey: selectedTheme\.themeKey, timelineKind: "milestone", plannedDate: null, outcomeId: null, allowStandalone: true, hubOrigin: true \}\)/,
  "運用マイルストーンはtimeline_kind='milestone'(planned_start=planned_end)の単一予定日として、allowStandalone\\+hubOrigin付きで作成する",
);
// root review (second pass): 楽観更新で即クローズする既存の高速パスは、テーマハブ発の
// タスク/MS作成・編集では使わない — 実書き込みをawaitして、失敗時はダイアログとドラフトを
// 保持する(汎用のawait/setErrorパスへフォールスルーする)。
assert.match(dashboard, /hubOrigin\?: boolean;/, "create_milestone/create_task/edit_task/edit_milestoneにhubOriginがある");
assert.match(
  dashboard,
  /const isHubOriginTaskOrMilestone =[\s\S]*?editor\.hubOrigin === true;/,
  "hubOrigin判定はcreate\\/edit両方のtask\\/milestoneを対象にする",
);
assert.match(
  dashboard,
  /if \(!isHubOriginTaskOrMilestone && isPatch && definition\.id\) \{/,
  "PATCHの楽観クローズはhubOrigin以外だけに残す",
);
assert.match(
  dashboard,
  /!isHubOriginTaskOrMilestone &&\s*\(editor\.kind === "create_task" \|\| editor\.kind === "create_milestone"\)/,
  "新規作成の楽観クローズはhubOrigin以外だけに残す",
);
// UI root review (root review point 13): edit_issueは単なる項目編集フォームで議論/仮説/決定/
// アクションが出ない。テーマハブの論点行は「既存の管理画面(issuesタブ)と同一のIssueWorkbench」
// をそのまま開く — コピーのフォームではなく、issuesタブが使うのと同じselectedIssueId state
// setterをそのまま渡してもらう(setEditorではなく別コールバック)。
assert.match(themeRoutes, /onOpenIssueWorkbench\?\.\(i\.id\)/, "次の仕事サマリーの論点は既存workbenchを開く");
assert.match(themeRoutes, /onOpenIssueWorkbench\?\.\(issue\.id\)/, "論点・判断グループの論点行は既存workbenchを開く");
assert.match(themeRoutes, /onOpenIssueWorkbench\?: \(issueId: string\) => void;/, "onOpenIssueWorkbenchはprops契約に明示されている");
assert.match(dashboard, /onOpenIssueWorkbench=\{setSelectedIssueId\}/, "issuesタブのIssueWorkbenchと同じselectedIssueId stateをそのまま渡す");
assert.match(themeRoutes, /import type \{ EditorState \} from "\.\/SxWeeklyControlDashboard"/, "type-onlyインポートで循環importを避ける");
assert.match(dashboard, /export type EditorState =/, "EditorStateをテーマ画面から再利用できるようexportする");
assert.match(dashboard, /onOpenEditor=\{setEditor\}/, "テーマ画面からダッシュボードの既存エディタ状態を直接開ける");
assert.match(dashboard, /onManagementChange=\{setManagement\}/, "テーマ画面の保存後にダッシュボード共有stateを更新する");

// 会議・資料・予定成果物・作業間の関連はテーマ作業ハブ専用ルートへ書く(既存の /management とは別)。
assert.match(themeRoutes, /resource: "meeting"/, "MTG作成/編集はテーマハブの meeting resource");
assert.match(themeRoutes, /resource: "meeting_link"/, "既存MTG紐付けは meeting_link resource");
assert.match(themeRoutes, /resource: "document_link"/, "既存資料紐付けは document_link resource");
assert.match(themeRoutes, /resource: "deliverable"/, "予定成果物は deliverable resource");
assert.match(themeRoutes, /resource: "work_link"/, "作業間の関連は work_link resource");
assert.match(themeRoutes, /api\/workspace-documents\/\$\{encodeURIComponent\([^)]*\)\}\/open\?download=0/, "資料は既存の認可付き形式別openを使う（Markdown専用routeへHTMLを送らない）");
assert.match(themeRoutes, /useStableClientToken/, "作成フォームは開いている間ずっと同じclient_tokenを使い回す");
assert.match(themeRoutes, /useState\(\(\) => crypto\.randomUUID\(\)\)/, "client_tokenは送信の都度ではなくフォームの初回マウントで1回だけ生成する");

// root review (UI completion phase, point 1): .limit(5000)はPostgRESTの実max_rows(1000)を
// 超えられず、無音の切り捨てになる。テーマブリッジ4表+全MTGは実レンジページングへ置き換え済み。
assert.doesNotMatch(bundle, /project_theme_\w+"\)[\s\S]{0,240}?\.limit\(5000\)/, "テーマブリッジクエリに.limit(5000)を残さない");
assert.doesNotMatch(bundle, /project_meeting_summaries"\)[\s\S]{0,240}?\.limit\(5000\)/, "全MTGクエリに.limit(5000)を残さない");
assert.match(bundle, /async function fetchAllRows/, "実レンジページング(range loop)のヘルパーを持つ");
assert.match(bundle, /fetchAllRows\(\(from, to\) =>[\s\S]*?project_theme_profiles/, "project_theme_profilesはfetchAllRows経由");
assert.match(bundle, /fetchAllRows\(\(from, to\) =>[\s\S]*?project_meeting_summaries/, "project_meeting_summariesはfetchAllRows経由(全MTG履歴)");

// root review (UI completion phase, point 2): ZMPの既定ナビゲーションは価値計画の有無に
// 依存しない明示許可リストへ移した(すでに上のhasThemesアサーションで確認済み)。

// root review (UI completion phase, point 3): client_token retry-safetyをtaskだけでなく
// milestone/issue/hypothesis/decision/actionへ拡張。DBに新規列+partial unique indexが必要。
const clientTokenMigration = readRepo(
  "ios/supabase/migrations/20260901120000_project_theme_hub_client_token_extend.sql",
);
assert.match(clientTokenMigration, /project_management_milestones\s*\n\s*ADD COLUMN IF NOT EXISTS client_token uuid/);
assert.match(clientTokenMigration, /project_management_issues\s*\n\s*ADD COLUMN IF NOT EXISTS client_token uuid/);
assert.match(clientTokenMigration, /project_management_hypotheses\s*\n\s*ADD COLUMN IF NOT EXISTS client_token uuid/);
assert.match(clientTokenMigration, /project_management_decisions\s*\n\s*ADD COLUMN IF NOT EXISTS client_token uuid/);
assert.match(clientTokenMigration, /project_management_action_items\s*\n\s*ADD COLUMN IF NOT EXISTS client_token uuid/);
assert.match(clientTokenMigration, /NOT applied by this worker\. Root reviews and applies\./);
const managementRoute = readPwa("src/app/api/project-workspace/[projectId]/management/route.ts");
assert.match(
  managementRoute,
  /const CLIENT_TOKEN_RESOURCES: readonly Resource\[\] = \["task", "milestone", "issue", "hypothesis", "decision", "action"\];/,
  "5リソース(milestone/issue/hypothesis/decision/action)がtaskと同じretry-safe dedupe経路に乗る",
);
assert.match(managementRoute, /optionalClientToken\(\)/, "milestone/issue/hypothesis/decision/actionのcreateForがclient_tokenを検証する");
assert.doesNotMatch(
  managementRoute.slice(managementRoute.indexOf("CLIENT_TOKEN_RESOURCES")),
  /title.*===.*title|同じタイトル|同じ時刻/i,
  "タイトル/時刻ヒューリスティックの重複判定を使わない",
);

// --- UI root review (/tmp/amie-zmp-theme.imx1hK/ui-root-review.md) targeted fixes ---

// point 9: p19 has 0 objectives/outcomes and 0 lane-backed milestones, so the shared editor's
// own "no basis to place a MS/task in this lane" gate must not block the theme hub's standalone
// creation — only when the editor explicitly says so (allowStandalone), never for the gantt's own
// "MSを置く"/task-add flow which keeps its original hard error.
assert.match(dashboard, /allowStandalone\?: boolean;/, "create_milestone/create_taskにallowStandaloneがある");
assert.match(
  dashboard,
  /editor\.kind === "create_milestone" &&\s*!selectedMilestoneOutcome &&\s*!editor\.allowStandalone/,
  "MS作成の空基準ガードはallowStandaloneのときだけ通す",
);
assert.match(
  dashboard,
  /editor\.kind === "create_task" &&\s*!selectedTaskMilestone &&\s*!editor\.allowStandalone/,
  "タスク作成の空基準ガードはallowStandaloneのときだけ通す",
);
assert.match(themeRoutes, /allowStandalone: true/, "テーマハブのMS\/タスク作成はallowStandaloneを渡す");

// point 10: create_issueのtrack初期値prefillと、共有エディタ自身が生成するclient_token。
assert.match(dashboard, /track: editor\.track \|\| management\.tracks\[0\]\?\.key \|\| ""/, "create_issueはeditor.trackを優先してprefillする");
assert.match(themeRoutes, /onOpenEditor\?\.\(\{ kind: "create_issue", track: selectedTheme\.themeKey \}\)/, "論点作成は選択中テーマのtrackを渡す");
assert.match(dashboard, /const \[clientToken\] = useState\(\(\) => crypto\.randomUUID\(\)\);/, "共有エディタは1マウントにつき1回だけclient_tokenを生成する");
assert.match(dashboard, /fields\.client_token = clientToken;/, "共有エディタの新規作成は生成したclient_tokenを送る");

// point 11: テーマ所属はtheme.taskIds等の古いスナップショットではなく、常にライブの
// sxManagement propから再計算する(共有ダッシュボードの保存が即座に反映される)。
assert.doesNotMatch(themeRoutes, /new Set\(theme\.taskIds\)/, "所属判定にtheme.taskIdsを使わない(ライブ再計算へ置換済み)");
assert.doesNotMatch(themeRoutes, /new Set\(theme\.operationalMilestoneIds\)/, "所属判定にtheme.operationalMilestoneIdsを使わない");
assert.doesNotMatch(themeRoutes, /new Set\(theme\.issueIds\)/, "所属判定にtheme.issueIdsを使わない");
assert.match(themeRoutes, /milestone\.track === theme\.themeKey/, "運用MS所属はsx.milestonesのtrackから毎回再計算する");

// point 12: 関連の両端は実タイトル+実遷移、canonical FKペアはUIでも弾く。
assert.match(themeRoutes, /function resolveLinkEndpoint/, "関連の両端タイトルを実データから解決する");
assert.match(themeRoutes, /const CANONICAL_FK_PAIRS = new Set/, "テーマハブ側でも既存FKペアの組み合わせを弾く");
assert.match(themeRoutes, /この関連を外すよ。この記録が他のテーマにも出ている場合、そこからも見えなくなるよ/, "関連の解除は全テーマへの影響を警告する");

// point 13: 議論(issue_discussions)は仮説の代用ではなく、実際の議論作成経路にリトライ安全性を
// 持たせる(client_token列の新migrationではなく、供給uuidをPKへ使う)。
assert.match(managementRoute, /project_management_issue_discussions/, "議論は仮説テーブルの代用ではない");
assert.match(managementRoute, /clientId = fields\.id == null/, "議論作成はクライアント供給idをPKとして受け付ける");
assert.match(dashboard, /onAddDiscussion\(issue\.id, summary, discussionId\)/, "議論フォームは安定idを送る");

// point 14: canManage=falseの閲覧者はどの行からもライブ編集ダイアログへ到達できない。
assert.match(themeRoutes, /function RowButton/, "行クリックはcanManageガード付きの共通コンポーネントを通す");
assert.doesNotMatch(
  themeRoutes.replace(/RowButton/g, ""),
  /<button type="button" className=\{styles\.detailRowMain\}/,
  "detailRowMainの生button(canManageガード無し)を残さない",
);

// point 15: 既存レコードpickerは保存中に多重発火しない。
assert.match(themeRoutes, /disabled\?: boolean;/, "SearchPickerListはdisabled propを持つ");
assert.match(themeRoutes, /if \(saving\) return;/, "pickハンドラはsaving中の再入を防ぐ");

// point 16: 資料をひもづける操作は未保存の編集内容ごとatomicに保存し、外す/差し替えもできる。
assert.match(
  themeRoutes,
  /title, description_md: descriptionMd \|\| null, owner_member_id: ownerMemberId \|\| null,\s*due_on: dueOn \|\| null, linked_document_id: doc\.documentId, status: "linked",/,
  "予定成果物の資料ひもづけは未保存の編集内容も同じPATCHで送る",
);
assert.match(themeRoutes, /async function unlinkDocument\(\)/, "資料のひもづけ解除(差し替え前段)がある");

// point 18: JSTのtoday計算(UTC ISO sliceは深夜0-9時に日付がずれるバグ)。
assert.doesNotMatch(themeRoutes, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/, "today計算にUTC ISO sliceを残さない");
assert.match(themeRoutes, /function todayJst\(\)/, "today計算はJST基準のヘルパーを使う");

// point 19: 見出しはプロジェクトによらない簡潔な「テーマ」、件数はハードコードしない。
assert.match(themeRoutes, /<h2 className=\{styles\.pageTitle\}>テーマ<\/h2>/, "見出しは「テーマ」(「テーマ航路」ではない)");
assert.match(themeRoutes, /\{localThemes\.length\}つのテーマごとに/, "説明文のテーマ数はハードコードしない");
assert.match(themeRoutes, /role="alert"/, "エラー表示はrole=alertを持つ");

// point 6: 資料一覧の.limit(3000)を実レンジページングへ置換。
const workspaceDocumentsRoute = readPwa("src/app/api/workspace-documents/route.ts");
assert.doesNotMatch(workspaceDocumentsRoute, /\.limit\(3000\)/, ".limit(3000)を残さない");
assert.match(workspaceDocumentsRoute, /function buildPage\(from: number, to: number\)/, "実レンジページングへ置換済み");
assert.match(themeRoutes, /const UUID_RE = /, "月次帳票などの仮想entryをuuid形式でない限り弾く");
assert.match(themeRoutes, /UUID_RE\.test\(d\.documentId\) && d\.entryKind !== "folder"/, "document_linkが拒否する仮想/folder entryを事前に弾く");

// --- second-pass browser review (/tmp/amie-zmp-theme.imx1hK/visual-root-review.md) ---

// 見出しは常に「テーマ」(「テーマ航路」の再発を防ぐ)。
assert.doesNotMatch(themeRoutes, /テーマ航路/, "テーマ航路という見出しを残さない");

// 読み取り専用の閲覧者は行クリック自体をブロックされるのではなく、実際の読み取り専用詳細へ
// 到達できる — RowButtonはcanManageで分岐しない(タスク/MS/論点は既存エディタ/workbenchが
// 自前でcanManageを見て編集UIを隠す。MTG/予定成果物は独自ダイアログにreadOnly propを渡す)。
assert.doesNotMatch(themeRoutes, /function RowButton\(\{\s*canManage,/, "RowButtonはもうcanManageで行自体をブロックしない");
assert.match(themeRoutes, /readOnly: boolean;\s*onClose: \(\) => void;\s*onSaved: \(\) => Promise<void>;\s*\}\) \{/, "MTG\/予定成果物ダイアログはreadOnly propを持つ");
assert.match(themeRoutes, /readOnly=\{!canManage\}/, "呼び出し側はcanManageの否定をreadOnlyとして渡す");
assert.match(themeRoutes, /const fieldsDisabled = saving \|\| readOnly;/, "readOnly時は入力欄も無効化する");

// 資料が無いのに"linked"を選べる状態を作らない。
assert.match(
  themeRoutes,
  /const statusOptions = Object\.entries\(DELIVERABLE_STATUS_LABEL\)\.filter\(\s*\(\[value\]\) => value !== "linked" \|\| deliverable\?\.linkedDocumentId,/,
  "資料がひもづいていない予定成果物にlinked状態を選ばせない",
);

// 生のDB識別子(draft/file等)を翻訳せず出さない。
assert.match(themeRoutes, /function prepStatusLabel/, "MTG準備状態を日本語ラベルへ変換する");
assert.match(themeRoutes, /function entryKindLabel/, "資料entry_kindを日本語ラベルへ変換する");
assert.doesNotMatch(themeRoutes, /\$\{m\.prepStatus \|\| /, "生のprepStatusをそのまま表示しない");
assert.doesNotMatch(themeRoutes, /\{doc\.entryKind\}/, "生のentryKindをそのまま表示しない");

// mobileでダイアログのfooterが画面外へ切れないよう、max-height+スクロールを持つ。
assert.match(themeRoutes, /\$\{styles\.scrollDialog\}/, "ダイアログはscrollDialogでmax-height制約を持つ");
assert.match(themeCss, /\.scrollDialog \{/, "scrollDialogのCSSが定義されている");
assert.match(themeCss, /\.scrollDialogBody \{/, "scrollDialogBodyのCSSが定義されている");

// mobileのテーマ選択行が縦に4枚積み上がる「壁」にならない、圧縮されたレイアウトを持つ。
assert.match(themeCss, /テーマ選択行が縦に4枚積み上がり/, "mobile選択行の圧縮対応コメントがある(実装の目印)");

// テーマハブ発のタスク/MS標準作成はNULLを明示送信する(空文字でなく)。
assert.match(dashboard, /fields\.milestone_id = selectedTaskMilestone\?\.id \?\? null;/, "milestone_idは空文字でなくnullを送る");
assert.match(dashboard, /if \(!values\.parent_task_id\) fields\.parent_task_id = null;/, "parent_task_idは空文字でなくnullを送る");

// --- release checkpoint (/tmp/amie-zmp-theme.imx1hK/release-root-review.md) ---

// 安全な部分リリース: MTGの新規作成・編集はAPI側で独立してfail-closed、UIも同じ定数を使う。
const rollout = readPwa("src/lib/theme-hub-rollout.ts");
assert.match(rollout, /export const THEME_HUB_MEETING_WRITE_ENABLED = false;/, "既定はfalse(fail-closed)");
assert.match(rollout, /export const THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE =\s*\n?\s*"MTG記録の作成・編集は公開範囲の確認待ち";/, "UI/APIで共有する固定メッセージ");
assert.match(themeHubRoute, /from "@\/lib\/theme-hub-rollout"/, "テーマAPIルートが共有定数を読み込む");
assert.match(
  themeHubRoute,
  /case "meeting": \{[\s\S]*?if \(!THEME_HUB_MEETING_WRITE_ENABLED\) \{\s*throw new ThemeHubError\(THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE, 403\);/,
  "POST meetingはRPC呼び出し前にfail-closedする",
);
assert.match(
  themeHubRoute,
  /if \(deleting\) \{[\s\S]{0,200}?await unlinkMeeting[\s\S]{0,400}?\} else \{\s*if \(!THEME_HUB_MEETING_WRITE_ENABLED\) \{\s*throw new ThemeHubError\(THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE, 403\);/,
  "PATCH meetingは編集(delete=falseの分岐)だけfail-closed、テーマからの解除(delete=true)は許可のまま",
);
assert.match(themeRoutes, /from "@\/lib\/theme-hub-rollout"/, "テーマ画面(UI)が同じ共有定数を読み込む");
assert.match(themeRoutes, /\{THEME_HUB_MEETING_WRITE_ENABLED && \(\s*<DropdownMenuItem onClick=\{\(\) => onPick\("meeting"\)\}>MTGを記録<\/DropdownMenuItem>/, "「MTGを記録」メニュー項目はゲート中は出さない");
assert.match(themeRoutes, /const writeBlocked = !THEME_HUB_MEETING_WRITE_ENABLED;/, "MTGダイアログはブロック状態を保持する");
assert.match(themeRoutes, /\{writeBlocked && <div className=\{styles\.formError\} role="alert">\{THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE\}<\/div>\}/, "ブロック中はメッセージを表示する");
assert.match(themeRoutes, /コックピットのMTGカードで開く/, "既存の正本カード(コックピット)への遷移リンクを持つ");
assert.match(themeRoutes, /\/project\/\$\{encodeURIComponent\(projectId\)\}\/cockpit\?meeting=\$\{encodeURIComponent\(meeting\.meetingId\)\}/, "?meeting=ディープリンクは既存のCockpitMeetingSummaryが解決する");

// point1: 議論の23505リトライ復旧はproject_id/issue_idも絞り込む(他PJ/他論点のidを誤成功にしない)。
assert.match(
  managementRoute,
  /\.eq\("id", clientId\)\s*\.eq\("project_id", projectId\)\s*\.eq\("issue_id", issueId\)/,
  "議論の23505復旧SELECTはid単独でなくproject_id/issue_idも絞る",
);

// point5: テーマハブ発の運用MS作成に担当を追加(旧ガントの複数グループ選択フォームは変えない)。
assert.match(dashboard, /const hubFields: FormField\[\] = editor\.hubOrigin/, "hubOrigin時はグループ選択フィールドを出さない");
assert.match(dashboard, /key: "owner_label", label: "担当", type: "owner" as const, required: false/, "hubOrigin時は担当フィールドを追加する");
assert.doesNotMatch(
  dashboard.slice(0, dashboard.indexOf("const hubFields")),
  /key: "owner_label", label: "担当", type: "owner" as const, required: false/,
  "旧ガント経路のcreate_milestoneフォームには担当フィールドを追加しない",
);

// point6: resolveLinkEndpointは選択中テーマだけでなく全テーマ(同じ認可済みbundle内)から探す。
assert.match(themeRoutes, /function resolveLinkEndpoint\(kind: string, id: string, allThemes: ThemeData\[\], sx: SxManagementBundle\)/, "resolveLinkEndpointは複数テーマを受け取る");
assert.match(themeRoutes, /allThemes\.flatMap\(\(t\) => t\.meetings\)/, "MTGは全テーマから探す");
assert.match(themeRoutes, /allThemes\.flatMap\(\(t\) => t\.documents\)/, "資料は全テーマから探す");
assert.match(themeRoutes, /allThemes\.flatMap\(\(t\) => t\.deliverables\)/, "予定成果物は全テーマから探す");
assert.match(themeRoutes, /resolveLinkEndpoint\(link\.fromKind, link\.fromId, localThemes, sxManagement\)/, "呼び出し側はlocalThemes全体を渡す");
// 予定成果物の編集は実際の所有テーマのtrack_keyで送る(選択中テーマで固定すると別テーマ所有の
// 予定成果物への編集が0件ヒットになり、偽の409(先に更新された)を返す)。
assert.match(
  themeRoutes,
  /localThemes\.find\(\(t\) => t\.deliverables\.some\(\(d\) => d\.id === activeDialog\.deliverable\.id\)\)\?\.themeKey \?\? selectedTheme\.themeKey/,
  "予定成果物ダイアログのtrackKeyは所有テーマを解決してから渡す",
);

// point7: archived行への23505/byTokenリトライは成功を返さない。
assert.match(themeHubLib, /if \(current\.deleted_at != null\) throw new ThemeHubError\("この予定成果物は削除済みだよ/, "createDeliverableの23505復旧はdeleted_atを見る");
assert.match(themeHubLib, /if \(byToken\?\.deleted_at != null\) throw new ThemeHubError\("この関連は削除済みだよ/, "createWorkLinkのbyToken復旧はdeleted_atを見る");
assert.match(themeHubLib, /\.eq\("version", version\)\s*\.is\("deleted_at", null\)\s*\.select\("id"\)\s*\.maybeSingle\(\);\s*\n\s*if \(error\) throw new ThemeHubError\(`予定成果物を更新できなかったよ/, "updateDeliverableはdeleted_at IS NULLも要求する");

// point8 (blocking): IssueEditorは自前でcanManageをゲートし、読み取り専用時は編集不能・Save非表示。
assert.match(dashboard, /const isReadOnly = !management\.canManage;/, "IssueEditorはmanagement.canManageから読み取り専用を導出する");
assert.match(dashboard, /if \(isReadOnly\) return;/, "save\\(\\)は読み取り専用なら早期returnする");
assert.match(dashboard, /<fieldset disabled=\{isReadOnly\} style=\{\{ border: 0, margin: 0, padding: 0 \}\}>/, "全フィールドをfieldset disabledでまとめて無効化する");
assert.match(dashboard, /\) : isReadOnly \? \(\s*<button\s*type="button"\s*className=\{styles\.secondaryButton\}\s*onClick=\{onClose\}\s*>\s*閉じる/, "読み取り専用時は保存ボタンの代わりに閉じるボタンだけを出す");
assert.doesNotMatch(themeRoutes, /IssueEditorが.*自前でcanManageを見て編集UIを隠す/, "実装していない前提を主張するコメントを残さない");

console.log("zmp workspace themes contract: ok");
