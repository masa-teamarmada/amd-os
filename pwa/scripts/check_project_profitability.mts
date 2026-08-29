// PJ別 利益構造ダッシュボードの契約チェック (静的解析のみ、DB接続なし)。
// Run: npm run test:project-profitability
//
// 【なぜこの guard があるか】
// 初版は報酬モデルを取り違えて2つの誤りを出していた (2026-08-30 まさ訂正)。
//   1. `billing_cycles.budget_yen` を「売上」として扱い、需要/枠 の分母に `× 0.65` を掛けた。
//      budget_yen は既に請求額の65%後なので、65%の二重適用になる。
//      これで 2026年 ZMP を 2.78×、CX を 1.67× と表示し、両方に誤った枠超過警報を点けていた
//      (正しくは 1.01× と 1.08× でどちらも枠内)。
//   2. まさの `grossDueYen>0` かつ `totalPay=0` を「持ち出し」として赤で警報にしていた。
//      実際はまさがポイントを消化して外部への現金流出を抑えられている望ましい状態で、意味が逆。
// どちらも画面を見ただけでは気づけず、経営判断を逆へ倒す。機械で止める。
//
// 正本: pwa/spec/5-14-project-profitability-current-spec.md
//       pwa/manual/7-1-reward-calc-spec.md (65%・cap按分・payoutExcluded)
import assert from "node:assert/strict";
import fs from "node:fs";

const lib = fs.readFileSync(new URL("../src/lib/project-profitability.ts", import.meta.url), "utf8");
const client = fs.readFileSync(
  new URL("../src/components/admin/AdminProjectProfitabilityClient.tsx", import.meta.url),
  "utf8",
);
const spec = fs.readFileSync(
  new URL("../spec/5-14-project-profitability-current-spec.md", import.meta.url),
  "utf8",
);

// --- 1. 需要/枠 の分母は実効枠。65%を二重に掛けない ---------------------------------
assert.match(
  lib,
  /demandCapRatio\s*=\s*effectiveCapYen\s*>\s*0\s*\?\s*grossDueYen\s*\/\s*effectiveCapYen/,
  "需要/枠 の分母は effectiveCapBudgetYen の合計 (実効枠) を使う",
);
assert.doesNotMatch(
  lib,
  /grossDueYen\s*\/\s*\([^)]*(MEMBER_SHARE_RATE|0\.65)/,
  "需要/枠 の分母へ 0.65 を掛けない。budget_yen は既に65%後の額なので二重適用になる",
);
assert.match(
  lib,
  /effectiveCapYen\s*\+=\s*Math\.max\(0,\s*numberValue\(summary\.effectiveCapBudgetYen\)\)/,
  "実効枠は reward_summary_json.effectiveCapBudgetYen から積む (未使用枠の繰越を含む)",
);

// --- 2. 「持ち出し」警報を復活させない ------------------------------------------------
for (const banned of ["payoutGap", "payoutGapMonths", "PAYOUT_GAP_MIN_MONTHS", "computePayoutGap"]) {
  assert.doesNotMatch(
    lib,
    new RegExp(`\\b${banned}\\b`),
    `${banned}: まさの totalPay=0 を異常扱いする警報を戻さない (意味が逆)`,
  );
  assert.doesNotMatch(client, new RegExp(`\\b${banned}\\b`), `${banned}: 画面側にも戻さない`);
}
assert.doesNotMatch(client, /持ち出し/, "「持ち出し」という表示を画面へ戻さない");

// --- 3. 列の出どころを固定する ---------------------------------------------------------
assert.match(
  lib,
  /externalPaidYen\s*\+=\s*Math\.max\(0,\s*numberValue\(summary\.externalPayoutCapYen\)\)/,
  "外部への現金支払は externalPayoutCapYen (支払対象メンバーへ実際に出た額) を使う",
);
assert.match(
  lib,
  /retainedYen\s*\+=\s*Math\.max\(0,\s*numberValue\(summary\.companyReserveYen\)\)/,
  "会社に残った分は companyReserveYen (支払対象外メンバーへの非現金配賦) を使う",
);
assert.match(
  lib,
  /payoutExcluded/,
  "メンバー明細は payoutExcluded で現金支払対象かどうかを示す (is_officer で分類しない)",
);
assert.doesNotMatch(
  lib,
  /\bis_officer\b/,
  "支払対象の判定に is_officer を使わない。正本は exclude_from_payout_notice (7-1章 2026-07-29 訂正)",
);

// --- 4. 「売上」と言い切らない -----------------------------------------------------------
assert.match(
  lib,
  /estimatedRevenueYen\s*=\s*Math\.round\(capBudgetYen\s*\/\s*MEMBER_SHARE_RATE\)/,
  "請求額は配分枠から逆算した推定値として持つ",
);
assert.match(client, /請求額<span[^>]*>\(推定\)/, "請求額の列見出しには (推定) を付ける");
assert.match(client, /配分枠 65%/, "配分枠の列は65%後の額と分かる見出しにする");

// --- 5. 参照系キャッシュを画面から直接 fetch しない -------------------------------------
assert.doesNotMatch(
  client,
  /fetch\(/,
  "画面は project-profitability-client.ts (reference-data-cache 経由) を通す",
);

// --- 6. 仕様書が誤りの経緯を残している ---------------------------------------------------
assert.match(spec, /2026-08-30 まさ訂正/, "仕様書に訂正の経緯を残す");
assert.match(spec, /effectiveCapBudgetYen/, "仕様書に需要/枠 の正しい分母を書く");

console.log("PJ別 利益構造ダッシュボード 契約 OK");
