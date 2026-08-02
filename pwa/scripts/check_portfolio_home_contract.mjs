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

// 2. GlobalNav は研究ポートフォリオ (ホーム/研究機関/シーズ/PJ運用) を最上位グループに持ち、
//    既存の探索・自分・Admin・資料導線は落とさない。
assert.match(globalNav, /label: "研究ポートフォリオ"/);
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

// 5. 研究機関・シーズを母集団、PJを契約後の運用レイヤーとして表す。実routeへ接続する
//    (表示だけの偽ボタン禁止)。PJパネルは3番目 (研究機関・シーズという母集団を先に見せる)。
assert.match(pulseComponent, /研究機関 — PJ化検討中/);
assert.match(pulseComponent, /シーズ — 検討中・SPS評価済み/);
assert.match(pulseComponent, /PJ運用 — 稼働中/);
assert.match(pulseComponent, /actionHref="\/institutions"/);
assert.match(pulseComponent, /actionHref="\/seeds"/);
assert.match(pulseComponent, /\/project\/\$\{encodeURIComponent\(row\.project\.projectId\)\}\/cockpit/);
assert.ok(
  pulseComponent.indexOf("研究機関 — PJ化検討中") < pulseComponent.indexOf("PJ運用 — 稼働中"),
  "研究機関パネルはPJ運用パネルより先に描画される必要がある",
);
assert.ok(
  pulseComponent.indexOf("シーズ — 検討中・SPS評価済み") < pulseComponent.indexOf("PJ運用 — 稼働中"),
  "シーズパネルはPJ運用パネルより先に描画される必要がある",
);

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
assert.match(dashboard, /xl:grid-cols-\[minmax\(620px,1fr\)_minmax\(360px,400px\)\]/);
assert.match(dashboard, /xl:sticky/);
assert.match(dashboard, /xl:max-h-\[calc\(100vh-1\.5rem\)\]/);
assert.match(dashboard, /xl:overflow-y-auto/);

console.log("portfolio home contract: ok");
