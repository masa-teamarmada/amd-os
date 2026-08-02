import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(join(scriptDir, path), "utf8");

const page = read("../src/app/portfolio-preview/page.tsx");
const preview = read(
  "../src/components/portfolio-preview/PortfolioPreview.tsx",
);
const globalNav = read("../src/components/nav/GlobalNav.tsx");
const dashboard = read("../src/app/(app)/dashboard/page.tsx");
const previewSurface = `${page}\n${preview}`;

// 1. 仮設URLはAMD内部だけに閉じ、現行OSのrouteへ混ぜない。
assert.match(page, /getCurrentMemberAccess/);
assert.match(page, /access\.scope !== "portfolio"/);
assert.match(page, /calendarStatus !== "connected"/);
assert.match(page, /next=%2Fportfolio-preview/);
assert.doesNotMatch(globalNav, /\/portfolio-preview/);
assert.doesNotMatch(dashboard, /PortfolioPreview/);

// 2. 実データを読むだけで、書き込み・再計算APIを持たない。
assert.match(page, /createAdminClient\(\)/);
assert.match(page, /fetchErsBundle\(readClient\)/);
assert.match(page, /fetchAllResearchInstitutionSeeds\(readClient\)/);
assert.match(page, /fetchProjectsFromSupabase\(readClient\)/);
assert.match(preview, /initialData: PortfolioPreviewData/);
assert.match(preview, /data-preview-mode="read-only"/);
assert.doesNotMatch(
  previewSurface,
  /\.(?:insert|upsert|update|delete)\s*\(|method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i,
);

// 3. 研究機関・シーズを母集団、PJを契約後の運用レイヤーとして表す。
assert.match(preview, /label: "研究機関"/);
assert.match(preview, /label: "シーズ"/);
assert.match(preview, /label: "PJ運用"/);
assert.match(preview, /母集団から契約・実行へ/);
assert.match(preview, /OriginRibbon/);
assert.match(preview, /needsClassification: origins\.length === 0/);

// 4. ECRとSPSは別系列のまま扱い、既存の優先順位関数を再利用する。
assert.match(preview, /ECR評価済み/);
assert.match(preview, /SPS評価済み/);
assert.match(preview, /seedListPriority\(a\) - seedListPriority\(b\)/);
assert.match(preview, /institutionProjectLifecycle/);
assert.doesNotMatch(preview, /ECR\s*[+×*]\s*SPS|SPS\s*[+×*]\s*ECR/);

console.log("portfolio preview contract: ok");
