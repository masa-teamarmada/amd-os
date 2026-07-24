import assert from "node:assert/strict";
import { nominalizeSxActionLabel, nominalizeSxNextActionLabel } from "../src/lib/sx-action-label.ts";

const cases = [
  ["NDAを締結する", "NDA締結"],
  ["契約書を確認する", "契約書確認"],
  ["金額を確定する", "金額確定"],
  ["内容を検証する", "内容検証"],
  ["資料を整理する", "資料整理"],
  ["議事録を作成する", "議事録作成"],
  ["請求書を提出する", "請求書提出"],
  ["施策を実施する", "施策実施"],
  ["対応を完了する", "対応完了"],
  ["検討を開始する", "検討開始"],
  ["方針を決定する", "方針決定"],
  ["証憑を取得する", "証憑取得"],
  ["業務を引き継ぐ", "業務引継ぎ"],
  ["リアクター構成を再検証する", "リアクター構成を再検証"],
  ["オンサイトPoCをTRL5ゲートへ接続する", "オンサイトPoCをTRL5ゲートへ接続"],
  ["設立主体・役割・知財・大学側条件を論点化する", "設立主体・役割・知財・大学側条件を論点化"],
  ["EWIRの定義と参画メリットを固める", "EWIRの定義と参画メリット確定"],
  ["投資家候補との条件を整理する", "投資家候補との条件整理"],
  ["処理コストを用途別に精緻化する", "処理コストを用途別に精緻化"],
  ["必要資金・支出前提・次の資金手段を並べる", "必要資金・支出前提・次の資金手段整理"],
  ["条件を揃える", "条件整備"],
  ["山路へ引き継ぐ", "山路への引継ぎ"],
];

for (const [input, expected] of cases) {
  const actual = nominalizeSxActionLabel(input);
  assert.equal(actual, expected, `expected "${input}" -> "${expected}", got "${actual}"`);
}

const unchanged = [
  "a".repeat(81) + "を締結する",
  "NDAを締結する\nつづき",
  "NDAを締結する。",
  "NDAを締結する、後で確認",
  "NDAを締結する!",
  "NDAを締結する?",
  "NDAを締結する.",
  "NDAを締結する,",
  "NDAを確認しておく",
  "特に変化なし",
];

for (const input of unchanged) {
  const actual = nominalizeSxActionLabel(input);
  assert.equal(actual, input, `expected unchanged for "${input}", got "${actual}"`);
}

// nominalizeSxActionLabel must not touch prose containing 、 even if the
// clauses themselves look like next-action strings.
const actionLabelPunctuationCases = [
  "ダイキアクシスが試作リアクターを納品し、SXが受入確認する",
  "石原先生から窓口変更を案内し、まさへ引き継ぐ",
];
for (const input of actionLabelPunctuationCases) {
  const actual = nominalizeSxActionLabel(input);
  assert.equal(actual, input, `expected unchanged for "${input}", got "${actual}"`);
}

const nextActionCases = [
  ["候補先別の次の約束を作る", "候補先別の次の約束作成"],
  [
    "ダイキアクシスが試作リアクターを納品し、SXが受入確認する",
    "ダイキアクシスが試作リアクター納品・SXが受入確認",
  ],
  [
    "石原先生から窓口変更を案内し、まさへ引き継ぐ",
    "石原先生から窓口変更案内・まさへの引継ぎ",
  ],
  ["NDAを締結する", "NDA締結"],
];

for (const [input, expected] of nextActionCases) {
  const actual = nominalizeSxNextActionLabel(input);
  assert.equal(actual, expected, `expected "${input}" -> "${expected}", got "${actual}"`);
}

const nextActionUnchanged = [
  "a".repeat(81) + "を締結する",
  "NDAを締結する\nつづき",
  "NDAを締結する。",
  "NDAを締結する!",
  "NDAを締結する?",
  "NDAを締結する.",
  "NDAを締結する,",
  "A、B、Cの三段階で進める",
  "候補先へ提案し、承諾を得て、契約する",
  "特に変化なし",
];

for (const input of nextActionUnchanged) {
  const actual = nominalizeSxNextActionLabel(input);
  assert.equal(actual, input, `expected unchanged for "${input}", got "${actual}"`);
}

console.log(
  `sx-action-label: ${
    cases.length +
    unchanged.length +
    actionLabelPunctuationCases.length +
    nextActionCases.length +
    nextActionUnchanged.length
  } cases passed`,
);
