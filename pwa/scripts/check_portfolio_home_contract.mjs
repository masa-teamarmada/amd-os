import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(join(scriptDir, path), "utf8");

const redirectPage = read("../src/app/portfolio-preview/page.tsx");
const globalNav = read("../src/components/nav/GlobalNav.tsx");
const dashboard = read("../src/app/(app)/dashboard/page.tsx");
const pulseLib = read("../src/lib/portfolio-pulse.ts");
const pulseComponent = read("../src/components/dashboard/PortfolioPulse.tsx");
const pulseRoute = read("../src/app/api/dashboard/portfolio-pulse/route.ts");

// 1. 旧 /portfolio-preview は独立シェルではなく /dashboard への恒久 redirect だけを持つ
//    (2026-08-02 まさ確定: 研究ポートフォリオ中心IAをホームへ正式採用)。
assert.match(redirectPage, /redirect\("\/dashboard"\)/);
assert.doesNotMatch(redirectPage, /getCurrentMemberAccess/);

// 2. GlobalNav は PJポートフォリオ (ホーム/研究機関/シーズ/PJ運用) を最上位グループに持ち、
//    既存の探索・自分・Admin・資料導線は落とさない。
assert.match(globalNav, /label: "PJポートフォリオ"/);
assert.match(globalNav, /label: "ホーム"[\s\S]*?href: "\/dashboard"/);
assert.match(globalNav, /label: "研究機関"[\s\S]*?href: "\/institutions"/);
assert.match(globalNav, /label: "シーズ"[\s\S]*?href: "\/seeds"/);
assert.match(globalNav, /label: "PJ運用"[\s\S]*?href: "\/dashboard#pj-operations"/);
for (const stillPresent of [
  'label: "Scholar"',
  'label: "Venture Map"',
  'label: "PoC"',
  'label: "VC"',
  'label: "マイページ"',
  'label: "通知"',
  'label: "立替"',
  'label: "教科書"',
  'label: "マニュアル"',
]) {
  assert.match(globalNav, new RegExp(stillPresent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

// 3. /dashboard は研究機関・シーズの全件表を直接持たず (= 正本は /institutions /seeds)、
//    PortfolioPulse 経由でのみ読む。PJ運用の全件は #pj-operations アンカーへ実接続する。
assert.doesNotMatch(dashboard, /fetchErsBundle/);
assert.doesNotMatch(dashboard, /InstitutionReadinessList/);
assert.match(dashboard, /<PortfolioPulse/);
assert.match(dashboard, /id="pj-operations"/);
assert.match(dashboard, /<MyPageContent embedded showMonthlyProjects=\{false\}/);

// 4. データ取得は server-side service client 経由の API route だけを使う。
//    default/anon browser client を直接叩くと migration 213 の RLS closure でシーズ0件になる
//    既知障害があるため、PortfolioPulse からの直接 fetchErsBundle/fetchAllResearchInstitutionSeeds
//    呼び出しを禁止する。
assert.doesNotMatch(pulseComponent, /fetchErsBundle\(/);
assert.doesNotMatch(pulseComponent, /fetchAllResearchInstitutionSeeds\(/);
assert.match(pulseComponent, /fetch\("\/api\/dashboard\/portfolio-pulse"/);
assert.match(pulseRoute, /createAdminClient\(\)/);
assert.match(pulseRoute, /requireMember\(\)/);
assert.match(pulseRoute, /getCurrentMemberAccess\(\)/);
assert.match(pulseRoute, /access\.scope !== "portfolio"/);
assert.match(pulseRoute, /status: 403/);
assert.ok(
  pulseRoute.indexOf('access.scope !== "portfolio"') < pulseRoute.indexOf("createAdminClient()"),
  "portfolio scope gate must run before the service client is created",
);
assert.match(pulseRoute, /Promise\.allSettled/);
assert.match(pulseRoute, /fetchErsBundle\(readClient\)/);
assert.match(pulseRoute, /fetchAllResearchInstitutionSeeds\(readClient\)/);

// 5. PJになる前の候補を、研究機関から来たものとシーズから来たものの2枚で表す。
//    実routeへ接続する (表示だけの偽ボタン禁止)。研究機関が先。
//    稼働中PJの再掲パネルは 2026-08-27 まさ確定で撤去した — すぐ下のPJ一覧と
//    統計stripの「PJ運用」セルに同じものが出ていて三重になっていたため。復活させない。
assert.match(pulseComponent, /title="研究機関PJ"/);
assert.match(pulseComponent, /title="シーズPJ"/);
assert.match(pulseComponent, /title="事業会社PJ"/);
assert.doesNotMatch(pulseComponent, /PJ運用 — 稼働中/);
assert.match(pulseComponent, /actionHref="\/institutions"/);
assert.match(pulseComponent, /actionHref="\/seeds"/);
assert.ok(
  pulseComponent.indexOf('title="研究機関PJ"') < pulseComponent.indexOf('title="シーズPJ"'),
  "研究機関PJパネルはシーズPJパネルより先に描画される必要がある",
);
assert.ok(
  pulseComponent.indexOf('title="シーズPJ"') < pulseComponent.indexOf('title="事業会社PJ"'),
  "シーズPJパネルは事業会社PJパネルより先に描画される必要がある",
);
// 事業会社PJ = 研究機関にもシーズにも紐づかない稼働中PJ。
// このパネルが無いと ZMP のようなPJがホームのどのリストにも出ない (2026-08-27 まさ指摘)。
assert.match(pulseComponent, /row\.needsClassification && row\.project\.status === "active"/);
// 両パネルはPJ化済み (= 稼働中PJに紐づく) と PJ化検討中の両方を出す (まさ確定 2026-08-27)。
// "considering" だけに絞ると、正式にPJ化した研究機関 (KUTE/NIMS/EHM) が1件も出なくなる。
assert.match(pulseComponent, /row\.projectLink\?\.projectStatus === "active" \|\| row\.lifecycle === "considering"/);
assert.match(pulseComponent, /link\.project_status === "active"/);
// 統計stripの「PJ運用」セルは #pj-operations への実接続を保つ (パネル撤去後の唯一の入口)。
assert.match(pulseComponent, /label: "PJ運用", value: model\.counts\.projects, href: "#pj-operations"/);

// 6. ECRとSPSは別系列のまま扱い、既存の優先順位関数を再利用する。
assert.match(pulseLib, /institutionEcrReady/);
assert.match(pulseLib, /seedSpsReady/);
assert.match(pulseLib, /seedListPriority\(a\) - seedListPriority\(b\)/);
assert.match(pulseLib, /institutionProjectLifecycle/);
assert.doesNotMatch(pulseLib, /ECR\s*[+×*]\s*SPS|SPS\s*[+×*]\s*ECR/);

// 7. amd-home-page-skin は borders-only (box-shadowを持ち込まない)。
const globalsCss = read("../src/app/globals.css");
const skinBlockMatch = globalsCss.match(/\.amd-home-page-skin[\s\S]*?(?=\n\/\* Business-card capture)/);
assert.ok(skinBlockMatch, "amd-home-page-skin block not found in globals.css");
const shadowDeclarations = [...skinBlockMatch[0].matchAll(/box-shadow:\s*([^;]+);/g)];
for (const [, value] of shadowDeclarations) {
  assert.equal(value.trim(), "none", `amd-home-page-skin must stay borders-only, found box-shadow: ${value}`);
}

// 8. 右マイページは約380pxに留め、左の研究ポートフォリオ判断領域を主役にする。
//    左trackの最小値は 600px。ナビ256px + 外周padding32px + gap16px を足すと 1264px で、
//    xl (1280px) の発火幅に収まる。620px にすると 1280〜1283px で親を4px溢れ、
//    body に横スクロールが出て sticky の左ナビが流れる (2026-08-27 実測)。
assert.match(dashboard, /xl:grid-cols-\[minmax\(600px,1fr\)_minmax\(360px,400px\)\]/);
assert.match(dashboard, /xl:sticky/);
assert.match(dashboard, /xl:max-h-\[calc\(100vh-1\.5rem\)\]/);
assert.match(dashboard, /xl:overflow-y-auto/);

// 9. 右マイページの sticky 可動域は「自分の行」ではなく grid コンテナ全体になる。
//    2カラム grid の中へ全幅要素 (col-span-2) を置くと、右カラムがその要素の右側を
//    最後まで覆い隠す。2026-08-27 に会社の記録の写真列が読めなくなった事故の再発防止。
//    全幅で敷きたい節は grid の外に兄弟として置く。
assert.doesNotMatch(dashboard, /col-span-2/);
assert.match(dashboard, /id="company-content"/);

// 10. 会社の記録 (名簿・沿革・メディア掲載・写真) は参照系。ブラウザから素のクエリを
//     投げ直さず、キャッシュ層 (lib/company-content-client.ts) 経由で読む。
assert.doesNotMatch(dashboard, /from\("media_assets"\)/);
assert.doesNotMatch(dashboard, /from\("company_history_events"\)/);
assert.match(dashboard, /loadCompanyContent/);

console.log("portfolio home contract: ok");
