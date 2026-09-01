import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cockpit = await readFile(
  new URL("../src/components/cockpit/CockpitKuteSeeds.tsx", import.meta.url),
  "utf8",
);
const seedDetail = await readFile(
  new URL("../src/components/seeds/SeedDetailModal.tsx", import.meta.url),
  "utf8",
);

assert.match(cockpit, />会社名<\/ResizableTh>/);
assert.match(cockpit, />シーズNo\.<\/ResizableTh>/);
assert.match(cockpit, />追加研究による市場創出案<\/ResizableTh>/);
assert.match(cockpit, /role="separator"/);
assert.match(cockpit, /setPointerCapture/);
assert.match(cockpit, /SEED_TABLE_WIDTHS_KEY = "amd-os:seed-table-column-widths:v1"/);
assert.match(cockpit, /String\(seed\.seed_no\)\.padStart\(2, "0"\)/);
assert.match(seedDetail, /追加研究による市場創出案（AMD仮説・未検証）/);
assert.match(cockpit, /const companyName = projectLink\?\.venture_name \?\? projectLink\?\.project_name \?\? null/);
assert.match(cockpit, /commercialization_stage === "pre_incorporation" \? "（未設立）" : ""/);
assert.match(cockpit, /: "未設立"/);
// PJ状態の独立列は廃止済み。会社名セル右上のバッジに統合した。
assert.doesNotMatch(cockpit, />PJ状態<\/th>/);
assert.match(cockpit, /absolute right-2 top-2[^`]*rounded-full[^`]*bg-indigo-600/);
assert.match(cockpit, /text-\[13px\] font-bold/);
// シーズ名の左には、faviconではなくdomain_laneの意味を持つLucideアイコンを表示する。
assert.match(cockpit, /const SEED_DOMAIN_VISUAL: Record<SeedDomainLane/);
for (const domain of ["gx_energy", "gx_circular", "life", "materials", "robo", "ict", "other"]) {
  assert.match(cockpit, new RegExp(`${domain}: \\{ Icon:`));
}
assert.match(cockpit, /<SeedDomainIcon domain=\{seed\.domain_lane\} \/>/);
assert.match(cockpit, /aria-label=\{label\}/);
assert.match(cockpit, /data-seed-domain=\{domain \?\? "other"\}/);
assert.doesNotMatch(cockpit, /\{realized \? "PJ化済み"/);
assert.doesNotMatch(cockpit, /\{projectLink\.project_name\} · \{projectLink\.project_status\}/);
assert.match(seedDetail, /href=\{`\/project\/\$\{encodeURIComponent\(project\.project_id\)\}\/cockpit`\}/);
assert.match(seedDetail, /title="このPJのコックピットを開く"/);
assert.doesNotMatch(seedDetail, /href=\{`\/project\/\$\{encodeURIComponent\(project\.project_id\)\}\/workspace`\}/);
assert.doesNotMatch(seedDetail, /ワークスペース \(コックピット\)/);

console.log("seed list display contract: OK");
