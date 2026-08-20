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

assert.match(cockpit, />会社名<\/th>/);
assert.match(cockpit, /const companyName = projectLink\?\.venture_name \?\? projectLink\?\.project_name \?\? null/);
assert.match(cockpit, /commercialization_stage === "pre_incorporation" \? "（未設立）" : ""/);
assert.match(cockpit, /: "未設立"/);
// PJ状態の独立列は廃止済み。会社名セル右上のバッジに統合した。
assert.doesNotMatch(cockpit, />PJ状態<\/th>/);
assert.match(cockpit, /absolute right-2 top-2[^`]*rounded-full[^`]*bg-indigo-600/);
assert.match(cockpit, /text-\[13px\] font-bold/);
assert.doesNotMatch(cockpit, /\{realized \? "PJ化済み"/);
assert.doesNotMatch(cockpit, /\{projectLink\.project_name\} · \{projectLink\.project_status\}/);
assert.match(seedDetail, /href=\{`\/project\/\$\{encodeURIComponent\(project\.project_id\)\}\/cockpit`\}/);
assert.match(seedDetail, /title="このPJのコックピットを開く"/);
assert.doesNotMatch(seedDetail, /href=\{`\/project\/\$\{encodeURIComponent\(project\.project_id\)\}\/workspace`\}/);
assert.doesNotMatch(seedDetail, /ワークスペース \(コックピット\)/);

console.log("seed list display contract: OK");
