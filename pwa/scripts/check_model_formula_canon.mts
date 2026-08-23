// `/model/formulas`（現行モデルの式）の正本ポインタ検査。
// Run: npm run test:model-formula-canon
//
// 【なぜこの guard があるか】
// この画面は式を書き写さず、正本 `bzm/bzm-2-2-strategic-slack-and-propulsion.md` の
// 「どの見出しの、何番目の数式か」だけを指している。正本の見出しが変わったり、
// 節の中で式が増減・並べ替えされたりすると、ポインタは黙って別の式を指しうる。
// モデル正本の画面が黙って別の式を出すのは、`model/LOCK.json` の3層ロックが
// 防ごうとしている事故そのものなので、ここで機械的に止める。
//
// 検査するもの:
//   1. すべてのポインタが解決すること（見出しがある / その番号の式がある）
//   2. 解決した式が `expect` の TeX 断片をすべて含むこと（取り違え検出）
//   3. 正本に増えた未収録の数式を一覧すること（増分の見落とし検出。件数は基準線で固定）
//
// 3 の基準線を動かすときは、その式を一覧へ載せるか、載せない理由をここへ書く。

import assert from "node:assert/strict";
import { loadBzmFormulaCanon } from "@/app/(app)/model/formula-canon";

/**
 * 一覧へ載せていない数式グループの基準線。
 *
 * 現行の式そのものではなく、pilot 画面の操作契約（観測された選択と、
 * 試算差分の表示規約）を述べる §15 の2式だけを外している。
 * 新しい式が正本へ入ったらこの数を超えるので、そのとき載せるかどうかを判断する。
 */
const UNCOVERED_BASELINE = [
  "pilot画面のイベントと月次試算#1",
  "pilot画面のイベントと月次試算#2",
  "pilot画面の四指標#4",
];

const canon = loadBzmFormulaCanon();
assert.ok(canon, "正本 bzm/bzm-2-2-strategic-slack-and-propulsion.md を読めませんでした");

const problems: string[] = [];
let total = 0;

for (const layer of canon.layers) {
  for (const entry of layer.entries) {
    total += 1;
    if (!entry.resolved) {
      problems.push(`[${layer.title}] ${entry.label} (${entry.id}): ${entry.problem}`);
      continue;
    }
    if (entry.tex.length === 0) {
      problems.push(`[${layer.title}] ${entry.label} (${entry.id}): TeX が空です`);
    }
  }
}

if (problems.length > 0) {
  console.error("model formula canon: ポインタが正本と合っていません\n");
  for (const problem of problems) console.error("  - " + problem);
  console.error(
    "\n正本 (bzm/bzm-2-2-strategic-slack-and-propulsion.md) の見出しか数式の並びが変わっています。" +
      "\npwa/src/app/(app)/model/formula-canon.ts の section / group / expect を正本へ合わせ直してください。" +
      "\n式そのものをコードへ書き写して回避しないこと (model/README.md (e))。",
  );
  process.exit(1);
}

const uncoveredKeys = canon.uncovered.map((u) => `${u.section}#${u.group}`).sort();
const baseline = [...UNCOVERED_BASELINE].sort();
const added = uncoveredKeys.filter((k) => !baseline.includes(k));
const gone = baseline.filter((k) => !uncoveredKeys.includes(k));

if (added.length > 0) {
  console.error("model formula canon: 正本に未収録の数式が増えています\n");
  for (const key of added) {
    const found = canon.uncovered.find((u) => `${u.section}#${u.group}` === key);
    console.error(`  - ${key}  ${found?.head ?? ""}`);
  }
  console.error(
    "\n現行の式なら pwa/src/app/(app)/model/formula-canon.ts の層へ追加し、" +
      "\n一覧へ載せない式なら理由を添えて本スクリプトの UNCOVERED_BASELINE へ足してください。",
  );
  process.exit(1);
}

if (gone.length > 0) {
  console.error("model formula canon: 基準線に載っている未収録式が正本から消えています\n");
  for (const key of gone) console.error(`  - ${key}`);
  console.error("\nUNCOVERED_BASELINE から外してください。");
  process.exit(1);
}

console.log(`model formula canon ok (${total} formulas resolved, ${uncoveredKeys.length} uncovered as declared)`);
