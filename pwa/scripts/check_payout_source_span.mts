#!/usr/bin/env node
/**
 * 支払通知書の摘要2行目 (`payoutTargetText`) と、繰越の鎖を遡る内部計算 (`resolvePayoutSourceSpan` /
 * `allocatePaidMonths`) の回帰テスト。
 *
 * 2026-10-29 まさ指摘 (かる・ちこの10月支払通知書の摘要が先月のまま。「4〜5月っておかしくない？」) を
 * 受けて、摘要2行目は「古い稼働月の発生分から順に払う」という**表示上の仮定**(`paidMonths`) を
 * 確定的な稼働月として出すのをやめた。報酬計算はどの月の発生分から払ったかの実績を持っていないため、
 * この仮定を正式PDFの対象月欄へ断定表示するのは不適切。代わりに、計算が実際に確定している唯一の対象
 * `span.endYm` (= `sourceYm`、`billing_cycles.ym` の月次精算) を出し、繰越があれば「繰越分を含む」を
 * 添える。`paidMonths` / 内部のFIFO配分と繰越追跡は内訳モーダルの表示用に保持し、計算は変えない。
 *
 * 範囲に入れるのは本契約 (regular) の繰越だけ。別財布 (cap_extra) は支払条件が本契約と別で、
 * ZMP の OkuDoor 開発は完了月に一括で払う。混ぜると、本契約を毎月満額払っていても
 * 別財布の積立だけで繰越ありと誤判定してしまう (まさ指摘 2026-08-28)。
 *
 * 実行: npm run test:payout-source-span
 */
import assert from "node:assert/strict";
import {
  regularPoolAmounts,
  resolvePayoutSourceSpan,
  payoutLineDescription,
  payoutTargetText,
  ymPeriodLabel,
  ymSpanLabel,
  type RegularPoolAmounts,
} from "../src/lib/payout-source-span.ts";

function span(rows: Record<string, RegularPoolAmounts>, sourceYm: string, floorYm: string | null = null) {
  return resolvePayoutSourceSpan(new Map(Object.entries(rows)), sourceYm, floorYm);
}

// 1. 繰越なし: 本契約を毎月満額払っている月は、その月の月次精算だけを対象と書く
{
  const result = span(
    {
      "202605": { carryIn: 0, grossDue: 37050, stock: 0 },
      "202606": { carryIn: 0, grossDue: 36660, stock: 0 },
      "202607": { carryIn: 0, grossDue: 40170, stock: 0 },
    },
    "202607",
  );
  assert.equal(result.startYm, "202607");
  assert.equal(result.endYm, "202607");
  assert.equal(ymSpanLabel(result.startYm, result.endYm), "7月稼働分");
  assert.equal(payoutTargetText(result), "対象：2026年7月の月次精算");
}

// 2. 繰越あり: 本契約に繰越があっても、摘要に出すのは今回の sourceYm (= 月次精算の対象)。
//    割り戻した稼働月の範囲 (4〜6月) を対象ラベルへ出さない。範囲は内訳モーダル用に保持する。
{
  const result = span(
    {
      "202604": { carryIn: 0, grossDue: 200293, stock: 200293 },
      "202605": { carryIn: 200293, grossDue: 401056, stock: 401056 },
      "202606": { carryIn: 401056, grossDue: 601349, stock: 455774 },
    },
    "202606",
  );
  assert.equal(result.startYm, "202604", "内部の繰越遡りは維持する");
  assert.equal(ymSpanLabel(result.startYm, result.endYm), "4〜6月稼働分", "内訳モーダル用の範囲ラベルは維持する");
  assert.equal(result.grossDueYen, 601349);
  assert.equal(result.stockYen, 455774);
  assert.equal(payoutTargetText(result), "対象：2026年6月の月次精算（繰越分を含む）");
}

// 2b. かる・ちこの実データ (まさ指摘 2026-10-29)。4〜5月は支払0円、6月に 87,185円、7月に 87,378円。
//     6月精算→9月支払、7月精算→10月支払という過去の支払月との対応はこのモジュールの対象外
//     (月次精算 sourceYm と支払月 paymentYm の対応は /api/admin/payouts 側の billing_cycles 解決)。
//     ここでは paidMonths が4〜5月の範囲でも、摘要に出すのは常に sourceYm=7月の月次精算であることを確認する。
{
  const rows = {
    "202604": { carryIn: 0, grossDue: 119893, stock: 119893 },
    "202605": { carryIn: 119893, grossDue: 239786, stock: 239786 },
    "202606": { carryIn: 239786, grossDue: 360149, stock: 272964 },
    "202607": { carryIn: 272964, grossDue: 346311, stock: 258933 },
    "202608": { carryIn: 258933, grossDue: 333220, stock: 245493 },
  };
  // 6月精算 (9月支払相当)。割り戻しは4月の発生分に当たるが、対象は6月の月次精算と書く
  const june = span(rows, "202606");
  assert.equal(june.startYm, "202604");
  assert.deepEqual(june.paidMonths, [{ ym: "202604", paidYen: 87185, startedBefore: false, completed: false }]);
  assert.equal(payoutTargetText(june), "対象：2026年6月の月次精算（繰越分を含む）");

  // 7月精算 (10月支払相当)。割り戻しは4〜5月の発生分に当たるが、対象は7月の月次精算と書く
  // (= まさ指摘の「4〜5月っておかしくない？」に対応。paidMonths が複数月でも sourceYm は単一月)
  const july = span(rows, "202607");
  assert.deepEqual(july.paidMonths, [
    { ym: "202604", paidYen: 32708, startedBefore: true, completed: true },
    { ym: "202605", paidYen: 54670, startedBefore: false, completed: false },
  ]);
  assert.equal(payoutTargetText(july), "対象：2026年7月の月次精算（繰越分を含む）");

  const august = span(rows, "202608");
  assert.equal(payoutTargetText(august), "対象：2026年8月の月次精算（繰越分を含む）");
}

// 2c. 繰越が今月で払い終わっても、対象は今月の月次精算 (繰越の有無は startYm<endYm で判定する)
{
  const rows = {
    "202604": { carryIn: 0, grossDue: 100000, stock: 60000 },
    "202605": { carryIn: 60000, grossDue: 160000, stock: 100000 },
  };
  assert.equal(payoutTargetText(span(rows, "202605")), "対象：2026年5月の月次精算（繰越分を含む）");

  // 年またぎの繰越も startYm<endYm で判定できる
  const rows3 = {
    "202512": { carryIn: 0, grossDue: 100000, stock: 100000 },
    "202601": { carryIn: 100000, grossDue: 200000, stock: 50000 },
  };
  const yearCrossing = span(rows3, "202601");
  assert.equal(yearCrossing.startYm, "202512");
  assert.equal(payoutTargetText(yearCrossing), "対象：2026年1月の月次精算（繰越分を含む）");
}

// 3. plan cycle の開始月より前へは遡らない (繰越の鎖はサイクルをまたがない) → 繰越なし扱い
{
  const result = span(
    {
      "202601": { carryIn: 5000, grossDue: 10000, stock: 5000 },
      "202602": { carryIn: 5000, grossDue: 15000, stock: 5000 },
    },
    "202602",
    "202602",
  );
  assert.equal(result.startYm, "202602");
  assert.equal(payoutTargetText(result), "対象：2026年2月の月次精算");
}

// 4. 年をまたぐ範囲の内訳ラベル (内訳モーダル用。摘要には使わない) は年を付ける
{
  assert.equal(ymSpanLabel("202512", "202603"), "2025年12月〜2026年3月稼働分");
}

// 5. 別財布の繰越は範囲に効かない (regular 値がある snapshot)
//    ZMP のあび 2026年7月: 本契約は毎月満額、未払い10万は全部 OkuDoor の積立
{
  const july = regularPoolAmounts({
    carryInYen: 66600,
    grossDueYen: 140170,
    stockYen: 100000,
    regularCarryInYen: 0,
    regularGrossDueYen: 40170,
    regularStockYen: 0,
    extraCarryInYen: 66600,
    extraGrossDueYen: 100000,
    extraStockYen: 100000,
  });
  assert.deepEqual(july, { carryIn: 0, grossDue: 40170, stock: 0 });
  const result = span(
    {
      "202605": { carryIn: 0, grossDue: 37050, stock: 0 },
      "202606": { carryIn: 0, grossDue: 36660, stock: 0 },
      "202607": july,
    },
    "202607",
  );
  assert.equal(ymSpanLabel(result.startYm, result.endYm), "7月稼働分", "別財布の積立で範囲を伸ばさない");
  assert.equal(result.stockYen, 0, "本契約の未払いだけを残額として出す");
  assert.equal(payoutTargetText(result), "対象：2026年7月の月次精算", "別財布だけの未払いを繰越ありと誤判定しない");
}

// 6. regular 値を持たない古い snapshot は、混在値から別財布分を引いて代用する
{
  const amounts = regularPoolAmounts({
    carryInYen: 66600,
    grossDueYen: 140170,
    stockYen: 100000,
    extraCarryInYen: 66600,
    extraGrossDueYen: 100000,
    extraStockYen: 100000,
  });
  assert.deepEqual(amounts, { carryIn: 0, grossDue: 40170, stock: 0 });
}

// 7. 別財布の値が無い snapshot は混在値をそのまま本契約として読む
{
  const amounts = regularPoolAmounts({ carryInYen: 401056, grossDueYen: 601349, stockYen: 455774 });
  assert.deepEqual(amounts, { carryIn: 401056, grossDue: 601349, stock: 455774 });
}

// 8. 摘要1行目は支払月で書く (まさ確定 2026-10-03)。「発生分の一部」のような書き方をしない
{
  assert.equal(payoutLineDescription("SOL", "202610"), "SOL 業務委託料（10月お支払分）");
  assert.equal(ymPeriodLabel("202604", "202604"), "2026年4月");
}

// 9. 摘要の3行目 (未払い残高) は 2026-10-28 に廃止 (まさ確定)。復活させない。
// かつては「未払い残高 272,964円（税抜、翌月以降にお支払いします）」を3行目に出していた。
// 摘要は「支払月の1行目」と「対象の月次精算の2行目」の2行まで。未払い残高をPDFへ戻さない。
{
  const mod = await import("../src/lib/payout-source-span.ts");
  assert.ok(!("payoutRemainingText" in mod), "payoutRemainingText を復活させない");
  const rows = {
    "202604": { carryIn: 0, grossDue: 119893, stock: 119893 },
    "202605": { carryIn: 119893, grossDue: 239786, stock: 239786 },
    "202606": { carryIn: 239786, grossDue: 360149, stock: 272964 },
  };
  const june = span(rows, "202606");
  // 未払いが残っていても、出すのは2行目の対象月次精算まで (未払い残高を書かない)
  assert.ok(june.stockYen > 0, "この月は未払いが残っている");
  assert.equal(payoutTargetText(june), "対象：2026年6月の月次精算（繰越分を含む）");
}

console.log("payout source span: ok");
