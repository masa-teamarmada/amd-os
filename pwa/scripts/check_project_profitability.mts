// PJ別 利益構造ダッシュボードの契約チェック (静的解析のみ、DB接続なし)。
// Run: npm run test:project-profitability
//
// 【なぜこの guard があるか】この画面は報酬モデルの読み違いを3回やっている (2026-08-30)。
//   1. billing_cycles.budget_yen を「売上」として扱い、比率の分母へさらに × 0.65 を掛けた。
//      budget_yen は既に65%後なので二重適用。ZMPを2.78×、CXを1.67×と誤表示して誤警報を出した。
//   2. まさの grossDueYen>0 かつ totalPay=0 を「持ち出し」として赤で警報にした。
//      実際はまさがポイントを消化して現金流出を抑えている望ましい状態で、意味が逆。
//   3. 年で切って月次の未払残を出した。シーズンで払う総額は最初から決まっていて、
//      月ごとの支払は「いつ払うか」でしかない。未払残は収益率を見るうえでノイズ。
//      シーズンは年をまたぐ (SX 202604-202703) ので、年で切ると1シーズンが分断される。
// どれも画面を見ただけでは気づけず、経営判断を逆へ倒す。機械で止める。
//
// 正本: pwa/spec/5-14-project-profitability-current-spec.md
//       pwa/manual/7-1-reward-calc-spec.md (65%・cap按分・payoutExcluded)
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const lib = read("../src/lib/project-profitability.ts");
const client = read("../src/components/admin/AdminProjectProfitabilityClient.tsx");
const page = read("../src/app/(app)/admin/project-profitability/page.tsx");
const spec = read("../spec/5-14-project-profitability-current-spec.md");

// --- 1. シーズン単位で集計する。年で切らない -------------------------------------------
assert.match(
  lib,
  /from\("value_plan_cycles"\)/,
  "シーズン(plan cycle)を正本にする。原資は value_plan_cycles.budget_yen",
);
assert.match(
  lib,
  /seasonBudgetYen = Math\.max\(0, numberValue\(cycle\.budget_yen\)\)/,
  "シーズン原資は value_plan_cycles.budget_yen をそのまま使う (月次 budget_yen の合計ではない)",
);
assert.match(
  lib,
  /b\.ym >= start && b\.ym <= end/,
  "billing_cycles はシーズンの period_start_ym〜period_end_ym で絞る",
);
assert.doesNotMatch(
  lib,
  /\bloadProjectProfitabilitySnapshot\(\s*year\b/,
  "年をキーにした集計へ戻さない。シーズンは年をまたぐ",
);

// --- 2. 月次の未払残を収益率へ混ぜない ---------------------------------------------------
for (const banned of ["unpaidExternalYen", "monthUnpaidExternal"]) {
  assert.doesNotMatch(lib, new RegExp(`\\b${banned}\\b`), `${banned}: 月次の未払残は収益率のノイズ`);
}
assert.doesNotMatch(client, /未払残/, "未払残の列を戻さない (まさ指摘 2026-08-30)");
assert.doesNotMatch(lib, /\bstockYen\b/, "stockYen (残高) をこの画面の指標に使わない");

// --- 3. 「持ち出し」「枠超え」を復活させない --------------------------------------------
for (const banned of ["payoutGap", "payoutGapMonths", "computePayoutGap"]) {
  assert.doesNotMatch(lib, new RegExp(`\\b${banned}\\b`), `${banned}: 意味が逆の警報を戻さない`);
  assert.doesNotMatch(client, new RegExp(`\\b${banned}\\b`), `${banned}: 画面側にも戻さない`);
}
assert.doesNotMatch(client, /持ち出し/, "「持ち出し」という表示を戻さない");
assert.doesNotMatch(client, /枠超え/, "「枠超え」という表示を戻さない。予算オーバーと誤読される");
assert.doesNotMatch(page, /枠を?超え/, "画面上部の説明にも「枠を超え」を戻さない");

// --- 4. 65%の二重適用を止める -----------------------------------------------------------
assert.doesNotMatch(
  lib,
  /grossDueYen\s*\/\s*\([^)]*(MEMBER_SHARE_RATE|0\.65)/,
  "比率の分母へ 0.65 を掛けない。原資は既に65%後の額なので二重適用になる",
);
assert.match(
  lib,
  /estimatedRevenueYen = Math\.round\(seasonBudgetYen \/ MEMBER_SHARE_RATE\)/,
  "請求額はシーズン原資からの逆算 (推定値)",
);
assert.match(client, /請求額<span[^>]*>\(推定\)/, "請求額の列見出しには (推定) を付ける");

// --- 5. 列の出どころを固定する -----------------------------------------------------------
assert.match(
  lib,
  /externalPaidYen \+= Math\.max\(0, numberValue\(summary\.externalPayoutCapYen\)\)/,
  "外部への現金支払は externalPayoutCapYen を使う",
);
assert.match(
  lib,
  /retainedYen \+= Math\.max\(0, numberValue\(summary\.companyReserveYen\)\)/,
  "会社に残る分は companyReserveYen を使う",
);
assert.match(lib, /payoutExcluded/, "現金支払対象かどうかは payoutExcluded で判定する");
assert.doesNotMatch(
  lib,
  /\bis_officer\b/,
  "支払対象の判定に is_officer を使わない。正本は exclude_from_payout_notice (7-1章)",
);

// --- 6. 参照系キャッシュを画面から直接 fetch しない ---------------------------------------
assert.doesNotMatch(client, /fetch\(/, "画面は project-profitability-client.ts (キャッシュ経由) を通す");

// --- 7. 日本語で書く ---------------------------------------------------------------------
assert.doesNotMatch(client, /needs/i, "画面の日本語に英単語を混ぜない");

// --- 8. 仕様書が経緯を残している ---------------------------------------------------------
assert.match(spec, /2026-08-30 まさ確定/, "仕様書にシーズン単位へ変えた経緯を残す");
assert.match(spec, /value_plan_cycles/, "仕様書にシーズン原資の出どころを書く");

console.log("PJ別 利益構造ダッシュボード 契約 OK");
