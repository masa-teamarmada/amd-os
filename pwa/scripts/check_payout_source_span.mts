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

console.log("payout source span: ok");
