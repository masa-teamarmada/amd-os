// 《組織》セクションの判定条件が、モデル正本とずれていないか見張る。
//
// 経営チームの機能の一覧そのものは正本（model/MODEL_VERSION_LEDGER.md §6.B-1）から実行時に読むので、
// 版が上がれば画面は自動で追随する。追随しないのは**充足の判定条件**（§6.B-2）で、
// これは計算なので team-fulfillment.ts に数字として書いてある。
// 正本の本文が変わったのにコード側が古い数字のままだと、画面は静かに間違った判定を出し続ける。
//
//   node scripts/check_team_function_contract.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const pwaRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(pwaRoot, "..");

const ledger = readFileSync(path.join(repoRoot, "model", "MODEL_VERSION_LEDGER.md"), "utf8");
const rule = readFileSync(path.join(pwaRoot, "src", "lib", "bzm30", "team-fulfillment.ts"), "utf8");

// 1. 機能表が読める形で正本にあること（見出しの番号ごと変わっていたら画面から機能表が消える）。
const headingIndex = ledger.split("\n").findIndex((line) => /^#{2,6}\s+6\.B-1\b/.test(line.trim()));
assert.ok(headingIndex >= 0, "正本に 6.B-1（八機能）の見出しが無い。機能表が画面から消える");

const afterHeading = ledger.split("\n").slice(headingIndex + 1);
const tableEnd = afterHeading.findIndex((line) => /^#{2,6}\s/.test(line.trim()));
const tableRows = afterHeading
  .slice(0, tableEnd < 0 ? afterHeading.length : tableEnd)
  .filter((line) => line.trim().startsWith("|"))
  .filter((line) => Number.isInteger(Number.parseInt(line.trim().replace(/^\|/, "").split("|")[0].trim(), 10)));
assert.ok(
  tableRows.length >= 1,
  "6.B-1 の表から機能の行を1つも読めない。表の形が変わったら team-functions.ts の抽出も直す",
);

// 2. 充足の判定条件（§6.B-2）が正本の本文と一致していること。
//    正本の言い回しが変わっただけでも落ちる。落ちたら、数字が変わったのか言い方が変わったのかを見て直す。
const b2Index = ledger.split("\n").findIndex((line) => /^#{2,6}\s+6\.B-2\b/.test(line.trim()));
assert.ok(b2Index >= 0, "正本に 6.B-2（充足の判定）の見出しが無い");
const b2Body = ledger
  .split("\n")
  .slice(b2Index + 1, b2Index + 40)
  .join("\n");

const expectations = [
  { canon: "直近12か月以内", code: "recencyMonths: 12", label: "直近性" },
  { canon: "2時点以上", code: "minOccasions: 2", label: "複数時点の数" },
  { canon: "3か月以上離れた", code: "minGapMonths: 3", label: "複数時点の間隔" },
];
for (const { canon, code, label } of expectations) {
  assert.ok(b2Body.includes(canon), `正本 §6.B-2 に「${canon}」が見つからない（${label}の条件が変わった可能性）`);
  assert.ok(rule.includes(code), `team-fulfillment.ts に ${code} が無い（${label}）`);
}

// 3. 出所の下限。エバンジェリスト機能だけ第三者証言・相手方の記録を必須にしている。
assert.ok(
  b2Body.includes("エバンジェリストは第三者証言または相手方の記録"),
  "正本 §6.B-2 の出所の規定が変わった。thirdPartyRequiredFunctions を見直す",
);
assert.ok(
  rule.includes("thirdPartyRequiredFunctions: [1]"),
  "team-fulfillment.ts の thirdPartyRequiredFunctions が機能1 になっていない",
);

// 4. 肩書で充足にしない規律が正本に残っていること（役職の台帳を判定の入力にしないことの根拠）。
assert.ok(
  ledger.includes("肩書・名義・意思表明では充足にしない"),
  "正本から「肩書・名義・意思表明では充足にしない」が消えた。役職台帳を判定へ入れてよいか見直す",
);

console.log(`OK: 機能表 ${tableRows.length} 行、充足の判定条件は正本と一致している`);
