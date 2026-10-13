// 口座の入出金明細から残高を積み上げる純関数の検査。正本は manual/6-13-cash-and-loans-spec.md。
// 商工中金のように freee とつなげない口座は、ここで積み上げた残高が月末残高の正になる。
import assert from "node:assert/strict";
import { computeLedgerRunning, ledgerBalanceOn, type LedgerRow } from "../src/lib/finance/ledger-running-balance.ts";

const row = (id: string, date: string, deposit: number, withdrawal: number, extra: Partial<LedgerRow> = {}): LedgerRow => ({
  id, entry_date: date, seq: 0, deposit, withdrawal, balance: null, source: "sheet:商工中金", source_row: null, ...extra,
});

// 期首残高は「残高が入っている最初の行」から逆算する。
const running = computeLedgerRunning([
  row("a", "2026-08-05", 0, 93897, { balance: 166216, source_row: 10 }),
  row("b", "2026-08-05", 0, 1200, { source_row: 11 }),
  row("c", "2026-09-07", 0, 93897, { source_row: 12 }),
  row("d", "2026-09-30", 400000, 0, { source_row: 13 }),
  // OS 上で手入力した行 (取り込み元の行番号なし) は、その日の最後に並ぶ。
  row("e", "2026-09-30", 400000, 0, { source: "manual", seq: 1 }),
  row("f", "2026-10-05", 0, 93897, { source_row: 14 }),
]);

assert.equal(ledgerBalanceOn(running, "2026-08-04"), null, "最初の行より前は残高なし");
assert.equal(ledgerBalanceOn(running, "2026-08-31"), 165016, "8月末は会費 1,200 円を引いた額");
assert.equal(ledgerBalanceOn(running, "2026-09-30"), 871119, "9月末は 40万×2 回の入金を含む");
assert.equal(ledgerBalanceOn(running, "2026-10-13"), 777222, "10/5 の引き落とし後");

// freee 由来の行は、銀行の実残高で合わせ直す。
const withFreee = computeLedgerRunning([
  row("x", "2026-09-01", 1000, 0, { balance: 1000, source_row: 1 }),
  row("y", "2026-09-02", 0, 100, { source: "freee", balance: 850, source_row: 2 }),
  row("z", "2026-09-03", 50, 0, { source_row: 3 }),
]);
assert.equal(ledgerBalanceOn(withFreee, "2026-09-03"), 900);
assert.equal(withFreee.gapStepById.get("y"), -50);

console.log("ledger running balance: ok");
