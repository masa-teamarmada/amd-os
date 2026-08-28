// 排液の作文から成分名を拾う抽出の検査。
// 2026-08-28 まさ「表の中ではもっとシンプルに成分名だけを記載してほしい。文章で書くのやめて」。
// 表示を成分バッジだけにしたとき、作文しか無い行が全部「未整理」になって情報が消えた。
// 作文を隠すのではなく作文の中の成分名を表へ出す、が現在の契約。
// 期待値は 2026-08-28 時点の p21 実データ (project_management_partners.effluent_components)。
// Run: npm run test:effluent-extraction
import assert from "node:assert/strict";
import { sxExtractEffluentComponentsFromText } from "../src/lib/sx-partner-progress.ts";

const cases: Array<[string, string[]]> = [
  ["砂糖・醤油ベースの調味液が中心。糖分ばかりで分解対象となる成分がなく、色度が課題", ["色度", "糖分"]],
  ["油分（原水のノルマルヘキサン37）、BOD 8.3×10²・COD 4.2×10²。放流水はBOD 0.7・COD 7.5・SS 4・窒素17・リン2.6。重金属の話は出ていない", ["COD", "BOD", "SS", "リン", "窒素", "油分"]],
  ["中華わかめの緑色合成着色料でCODが悪化。BOD/COD・リンが基準超過。だしの素工程は塩分が最大20%と高い", ["COD", "BOD", "リン", "塩分"]],
  ["固体製品工場はリン負荷、液体製品工場はBOD/CODと油分。薬剤でリンを凝集する運用", ["COD", "BOD", "リン", "油分"]],
  ["タンパク質由来の低分子有機物がBOD源の可能性。詳細成分・濃度は未確認。", ["BOD"]],
  ["触媒分離後の水相にニッケルが数百ppm。活性汚泥へ入る排水には鉛・マンガン・クロムが低濃度で含まれ、ケースによりニッケル・アルミも。高CODや毒性を持つ系統もある", ["Al", "Ni", "Pb", "Cr", "Mn", "COD"]],
  ["油水分離後から調整槽流入部付近の食品製造排液（油分・リン・窒素の影響を含む）", ["リン", "窒素", "油分"]],
  // 否定文脈は拾わない (「重金属」は語として拾わない)
  ["受領済み排液の分析では重金属がほとんど検出されなかった", []],
  ["亜鉛のみ検出", ["Zn"]],
];

for (const [text, expected] of cases) {
  const got = sxExtractEffluentComponentsFromText(text);
  assert.deepEqual([...got].sort(), [...expected].sort(), `${text.slice(0, 28)} => [${got.join(",")}]`);
}
console.log("effluent component extraction ok");
