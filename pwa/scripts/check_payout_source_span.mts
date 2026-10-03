#!/usr/bin/env node
/**
 * 支払通知書の「稼働月の範囲」の回帰テスト。
 *
 * 範囲に入れるのは本契約 (regular) の繰越だけ。別財布 (cap_extra) は支払条件が本契約と別で、
 * ZMP の OkuDoor 開発は完了月に一括で払う。混ぜると、本契約を毎月満額払っていても
 * 別財布の積立だけで「5〜7月稼働分」と書いてしまう (まさ指摘 2026-08-28)。
 *
 * 実行: npm run test:payout-source-span
 */
import assert from "node:assert/strict";
import {
  regularPoolAmounts,
  resolvePayoutSourceSpan,
  payoutLineDescription,
  payoutRemainingText,
  payoutTargetText,
  ymPeriodLabel,
  ymSpanLabel,
  type RegularPoolAmounts,
} from "../src/lib/payout-source-span.ts";

function span(rows: Record<string, RegularPoolAmounts>, sourceYm: string, floorYm: string | null = null) {
  return resolvePayoutSourceSpan(new Map(Object.entries(rows)), sourceYm, floorYm);
}

// 1. 本契約を毎月満額払っている月は、その月だけの範囲になる
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
  assert.equal(payoutTargetText(result), "対象：2026年7月の稼働");
  assert.equal(payoutRemainingText(result), "", "未払いが無い月は3行目を出さない");
}

// 2. 本契約に繰越があれば、繰越が 0 になる月まで遡る
{
  const result = span(
    {
      "202604": { carryIn: 0, grossDue: 200293, stock: 200293 },
      "202605": { carryIn: 200293, grossDue: 401056, stock: 401056 },
      "202606": { carryIn: 401056, grossDue: 601349, stock: 455774 },
    },
    "202606",
  );
  assert.equal(result.startYm, "202604");
  assert.equal(ymSpanLabel(result.startYm, result.endYm), "4〜6月稼働分");
  assert.equal(result.grossDueYen, 601349);
  assert.equal(result.stockYen, 455774);
  // 145,575円は4月の発生分 (200,293円) にも届かない。範囲全体の「4〜6月」と書かない
  assert.equal(payoutTargetText(result), "対象：2026年4月の稼働");
}

// 2b. ちこの SX (まさ指摘 2026-10-02)。4〜5月は支払0円、6月に 87,185円、7月に 87,378円
{
  const rows = {
    "202604": { carryIn: 0, grossDue: 119893, stock: 119893 },
    "202605": { carryIn: 119893, grossDue: 239786, stock: 239786 },
    "202606": { carryIn: 239786, grossDue: 360149, stock: 272964 },
    "202607": { carryIn: 272964, grossDue: 346311, stock: 258933 },
    "202608": { carryIn: 258933, grossDue: 333220, stock: 245493 },
  };
  const june = span(rows, "202606");
  assert.equal(june.startYm, "202604");
  assert.deepEqual(june.paidMonths, [{ ym: "202604", paidYen: 87185, startedBefore: false, completed: false }]);
  assert.equal(payoutTargetText(june), "対象：2026年4月の稼働");
  // 稼働月だけだと4月の報酬が87,185円で全部に見えるので、未払い残高を添える (まさ確定 2026-10-03)
  assert.equal(payoutRemainingText(june), "未払い残高 272,964円（税抜、翌月以降にお支払いします）");

  // 4月の残り 32,708円 + 5月の 54,670円
  const july = span(rows, "202607");
  assert.deepEqual(july.paidMonths, [
    { ym: "202604", paidYen: 32708, startedBefore: true, completed: true },
    { ym: "202605", paidYen: 54670, startedBefore: false, completed: false },
  ]);
  assert.equal(payoutTargetText(july), "対象：2026年4〜5月の稼働");

  const august = span(rows, "202608");
  // これまでの支払 174,563円で4月を払い終え5月の途中。5月の残り 65,223円 + 6月の 22,504円
  assert.equal(payoutTargetText(august), "対象：2026年5〜6月の稼働");
}

// 2c. 前回の続きから払い終える月・次の月の途中まで払う月も、当たる月の範囲だけを書く
{
  const rows = {
    "202604": { carryIn: 0, grossDue: 100000, stock: 60000 },
    "202605": { carryIn: 60000, grossDue: 160000, stock: 100000 },
  };
  assert.equal(payoutTargetText(span(rows, "202605")), "対象：2026年4月の稼働");
  const rows2 = {
    "202604": { carryIn: 0, grossDue: 100000, stock: 60000 },
    "202605": { carryIn: 60000, grossDue: 160000, stock: 0 },
  };
  assert.equal(payoutTargetText(span(rows2, "202605")), "対象：2026年4〜5月の稼働");
  // 年またぎは年を付ける
  const rows3 = {
    "202512": { carryIn: 0, grossDue: 100000, stock: 100000 },
    "202601": { carryIn: 100000, grossDue: 200000, stock: 50000 },
  };
  assert.equal(payoutTargetText(span(rows3, "202601")), "対象：2025年12月〜2026年1月の稼働");
}

// 3. plan cycle の開始月より前へは遡らない (繰越の鎖はサイクルをまたがない)
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
}

// 4. 年をまたぐ範囲は年を付ける
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

// 8. 摘要は支払月で書く (まさ確定 2026-10-03)。「発生分の一部」のような書き方をしない
{
  assert.equal(payoutLineDescription("SOL", "202610"), "SOL 業務委託料（10月お支払分）");
  assert.equal(ymPeriodLabel("202604", "202604"), "2026年4月");
}

console.log("payout source span: ok");
