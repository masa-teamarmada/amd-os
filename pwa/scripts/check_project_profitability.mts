// PJ別 利益構造ダッシュボードの契約チェック (静的解析のみ、DB接続なし)。
// Run: npm run test:project-profitability
//
// 【なぜこの guard があるか】この画面は報酬モデルの前提を繰り返し取り違え、
// 2026-08-30 にまさから11点の指摘を受けて白紙から作り直した。指摘はどれも
// 「画面を見ただけでは気づけないのに、経営判断を逆へ倒す」種類のもの。機械で止める。
//
// 正本: pwa/spec/5-14-project-profitability-current-spec.md
//       pwa/manual/7-1-reward-calc-spec.md (65%・cap按分・payoutExcluded)
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

/**
 * コメントを落とす。「なぜこれを使わないか」を書いた説明文まで禁止語として落とすと、
 * 理由をコードに残せなくなるため、禁止語の検査はコード部分だけに掛ける。
 * 行コメントは `https://` を巻き込まないよう、直前が `:` のものを除く。
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const lib = read("../src/lib/project-profitability.ts");
const libCode = codeOnly(lib);
const client = read("../src/components/admin/AdminProjectProfitabilityClient.tsx");
const clientCode = codeOnly(client);
/** 画面の列見出し。「指標として列に出していないか」を見るのに使う。 */
const clientHeaders = [...client.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1]).join(" | ");
const page = read("../src/app/(app)/admin/project-profitability/page.tsx");
const spec = read("../spec/5-14-project-profitability-current-spec.md");
const shared = read("../src/lib/project-profitability-shared.ts");
const migration = read("./migrations/354_project_fee_payee.sql");

// --- 1. まさの稼働を織り込む -------------------------------------------------
// まさ「おれがどれだけ稼働しなきゃいけなかったかが折り込まれてなくない?」
// 現金が出ていかないだけの状態を利益と呼ばない。
assert.match(lib, /\bmasaHours\b/, "まさの投下時間を集計する");
assert.match(
  lib,
  /from\("tally_weekly_effort_entries"\)/,
  "まさの投下時間は tally_weekly_effort_entries から読む",
);
assert.match(
  lib,
  /\.eq\("member_id", MASA_MEMBER_ID\)/,
  "tally はまさ専用アプリ。member_id='ID001' で絞る",
);
assert.match(
  client,
  /profitYen = row\.companyCashLeftYen - masaCostYen/,
  "まさ込み利益 = 会社に残る現金 − まさの労働の対価",
);
assert.match(client, /まさ込み利益/, "画面に「まさ込み利益」の列を出す");

// --- 2. 時間単価は PJ 横断で1つ。画面で動かせる -------------------------------
// PJごとに変えると PJ 間の比較へ配分設計 (= ポイント) の差が混ざる。
assert.match(shared, /export const DEFAULT_MASA_HOURLY_RATE_YEN/, "時間単価の既定値は共有モジュールが正本");
assert.match(lib, /DEFAULT_MASA_HOURLY_RATE_YEN/, "サーバはその既定値を payload へ載せる");
// 画面は server-only の集計モジュールから「値」を import できない (型だけなら消える)。
// tsc は通るのに実行時に落ちるので、定数の置き場所を guard で固定する。
assert.doesNotMatch(
  clientCode,
  /import\s*\{[^}]*\}\s*from\s*"@\/lib\/project-profitability";/,
  "画面が server-only の集計モジュールから値を import しない (型は import type で取る)",
);
assert.match(lib, /import "server-only";/, "集計モジュールは server-only のままにする");
assert.doesNotMatch(codeOnly(shared), /server-only/, "共有モジュールは server-only にしない (画面から読むため)");
assert.doesNotMatch(
  libCode,
  /hourlyRate.*(?:\[|Map<|per(?:Project|Pj))/i,
  "時間単価をPJごとに持たない。PJ横断で1つの単価を使う",
);
assert.match(client, /type="range"/, "時間単価はスライダーで動かせる");
assert.match(
  shared,
  /export const MASA_HOURLY_RATE_MIN_YEN[\s\S]*export const MASA_HOURLY_RATE_MAX_YEN/,
  "スライダーの範囲も共有モジュールの定数にする",
);
// 単価を掛けた値をサーバが返すと、画面で単価を動かしても数字が変わらない。
assert.doesNotMatch(libCode, /\bprofitYen\b/, "単価を掛けた利益をサーバ側で確定させない (画面で掛ける)");

// --- 3. ポイント・稼働需要を指標にしない --------------------------------------
// まさ「ポイントなんて、ここで考慮する必要すらなくない?」
// 「マイルストーンをどのように設定しようが、原資を超える支出にならない設計じゃん」
for (const banned of ["grossDueYen", "totalGrossDueYen", "demandBudgetRatio", "demandOverBudget", "consumedPt", "earnedPt"]) {
  assert.doesNotMatch(libCode, new RegExp(`\\b${banned}\\b`), `${banned}: ポイント/稼働需要は会社の収支に効かない`);
  assert.doesNotMatch(clientCode, new RegExp(`\\b${banned}\\b`), `${banned}: 画面側にも出さない`);
}
assert.doesNotMatch(clientCode, /需要/, "「需要 N×」の警報を戻さない。原資を超える支出にはならない");
assert.doesNotMatch(clientCode, /ポイント/, "ポイントを収益率の指標として画面に出さない");

// --- 4. 未払残を混ぜない -------------------------------------------------------
// まさ「現状未払かどうかって、そのPJの収益率を見るうえでは邪魔な情報だと思う」
for (const banned of ["stockYen", "deferredYen", "carryInYen", "unpaidExternalYen"]) {
  assert.doesNotMatch(libCode, new RegExp(`\\b${banned}\\b`), `${banned}: 月次の未払残は収益率のノイズ`);
}
// 他画面 (/admin/season-pl) への案内として本文で触れるのは可。列にしないことだけを止める。
assert.doesNotMatch(clientHeaders, /未払残/, "未払残の列を戻さない");

// --- 5. 禁じられた語を戻さない --------------------------------------------------
for (const [word, why] of [
  ["持ち出し", "意味を定義せずに使い、中身が逆だった"],
  ["取り分ゼロ", "まさへの現金支払0円は設計どおり"],
  ["枠超え", "cap按分で必ず原資内に収まる。予算オーバーと誤読される"],
  ["未配分", "未計算を金額として出さない"],
] as const) {
  assert.doesNotMatch(clientCode, new RegExp(word), `画面に「${word}」を戻さない: ${why}`);
  assert.doesNotMatch(codeOnly(page), new RegExp(word), `ページ説明にも「${word}」を戻さない: ${why}`);
}

// --- 6. 未計算を「お金の状態」として語らない ------------------------------------
// まさ「報酬を渡すべき人には渡し終わってるよ。計算ができてないだけ」
assert.match(lib, /incompleteSeasons/, "報酬計算がそろっていないシーズンを別の区分にする");
assert.match(
  lib,
  /if \(members\.length === 0\) continue;/,
  "members が空の月は金額を足さない (計算が動いていない月)",
);
assert.match(
  lib,
  /monthsWithRewardCalc < months/,
  "全月そろっていないシーズンは金額を出す行に入れない",
);
assert.doesNotMatch(
  /** IncompleteSeasonRow の型定義から金額の列が生えていないこと */
  lib.slice(lib.indexOf("export type IncompleteSeasonRow"), lib.indexOf("export type ProjectProfitabilitySnapshot")),
  /Yen\b/,
  "そろっていないシーズンの行に金額フィールドを持たせない",
);

// --- 7. 会社に残る現金の定義を固定する ------------------------------------------
// クローザーは全PJまさ (project_members.is_closer 13行すべて ID001) なので35%枠も社外へ出ない。
assert.match(
  lib,
  /companyCashLeftYen: Math\.round\(revenueYen - contractBufferYen - externalCashOutYen\)/,
  "会社に残る現金 = 請求額 − 契約バッファ − 社外への現金支払",
);
assert.match(
  lib,
  /externalCashOutYen \+= Math\.max\(0, numberValue\(summary\.externalPayoutCapYen\)\)/,
  "社外へ出る現金は externalPayoutCapYen を使う",
);
assert.doesNotMatch(
  libCode,
  /\bis_officer\b/,
  "支払対象の判定に is_officer を使わない。正本は exclude_from_payout_notice (7-1章)",
);

// --- 8. 65%の二重適用と別財布の取りこぼしを止める --------------------------------
assert.match(
  lib,
  /const poolYen = regularPoolYen \+ extraPoolYen;/,
  "別財布 (cap_extra) の原資を請求額へ足す。ZMPのOkuDoor受託を落とさない",
);
assert.match(
  lib,
  /Math\.round\(poolYen \/ MEMBER_SHARE_RATE\) \+ contractBufferYen/,
  "請求額 = (本契約原資 + 別財布原資) ÷ 0.65 + 契約バッファ",
);
assert.match(client, /請求額<span[^>]*>\(推定\)/, "請求額の列見出しには (推定) を付ける");

// --- 9. シーズン単位で切る。年で切らない -----------------------------------------
assert.match(lib, /from\("value_plan_cycles"\)/, "シーズン(plan cycle)を正本にする");
assert.match(lib, /b\.ym >= startYm && b\.ym <= endYm/, "billing_cycles はシーズン期間で絞る");
assert.doesNotMatch(lib, /\bloadProjectProfitabilitySnapshot\(\s*year\b/, "年をキーにした集計へ戻さない");

// --- 10. まさ個人への報酬をコードへ直書きしない ------------------------------------
// まさ「CLGとLSTはそれぞれ月10万円がおれ個人に振り込まれてる」→ OS の正本に入れてから読む。
assert.match(lib, /fee_payee/, "まさ個人への報酬は projects.fee_payee で判定する");
assert.match(lib, /masa_personal/, "受け取り先の値は 'masa_personal'");
assert.doesNotMatch(libCode, /100000|100_000/, "月額をコードへ直書きしない。projects.fee_amount から読む");
assert.doesNotMatch(libCode, /\bp07\b|\bp24\b/, "PJ の ID をコードへ直書きしない");
assert.match(migration, /fee_payee/, "migration 354 が projects.fee_payee を作る");
assert.match(migration, /'p07', 'p24'/, "migration 354 が LST/CLG に月額と受け取り先を入れる");

// --- 11. 参照系キャッシュを画面から直接 fetch しない --------------------------------
assert.doesNotMatch(clientCode, /fetch\(/, "画面は project-profitability-client.ts (キャッシュ経由) を通す");

// --- 12. 日本語で書く。限界を隠さない -----------------------------------------------
assert.doesNotMatch(clientCode, /needs/i, "画面の日本語に英単語を混ぜない");
assert.match(
  client,
  /まさ以外のメンバーの労働を引いていない/,
  "まさ以外の労働を引けていないことを画面に明記する (まさ 2026-08-30 で了承済みだが黙って落とさない)",
);
assert.match(client, /masaHoursRecordedFrom/, "tally の記録開始月を画面に出す (それ以前は0時間になる)");

// --- 13. 仕様書が経緯を残している -----------------------------------------------------
assert.match(spec, /2026-08-30 まさ/, "仕様書に指摘の経緯を残す");
assert.match(spec, /まさ込み利益/, "仕様書に主指標の定義を書く");
assert.match(spec, /fee_payee/, "仕様書にまさ個人への報酬の出どころを書く");

console.log("PJ別 利益構造ダッシュボード 契約 OK");
