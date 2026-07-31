import assert from "node:assert/strict";
import {
  buildFreeeCashActualRows,
  type MatchedDealPayment,
  type WalletTxn,
  type Walletable,
} from "../src/lib/finance/freee-cash-balances.ts";

const walletables = new Map<string, Walletable>([
  ["bank_account:1", { id: 1, type: "bank_account", name: "テスト口座" }],
]);

const accountItems = new Map([
  ["loan", "短期借入金"],
  ["interest", "支払利息"],
  ["ctax", "未払消費税等"],
]);

const payments: MatchedDealPayment[] = [
  {
    key: "loan-out",
    dealId: "loan-out",
    date: "2026-07-15",
    amount: 102_000,
    direction: "expense",
    walletKey: "bank_account:1",
    dealAmount: 102_000,
    details: [
      { account_item_id: "loan", amount: 100_000 },
      { account_item_id: "interest", amount: 2_000 },
    ],
  },
  {
    key: "loan-in",
    dealId: "loan-in",
    date: "2026-07-20",
    amount: 500_000,
    direction: "income",
    walletKey: "bank_account:1",
    dealAmount: 500_000,
    details: [{ account_item_id: "loan", amount: 500_000 }],
  },
  {
    key: "ctax",
    dealId: "ctax",
    date: "2026-07-25",
    amount: 30_000,
    direction: "expense",
    walletKey: "bank_account:1",
    dealAmount: 30_000,
    details: [{ account_item_id: "ctax", amount: 30_000 }],
  },
];

const txns: WalletTxn[] = [
  { id: "loan-out", date: "2026-07-15", walletable_type: "bank_account", walletable_id: 1, amount: 102_000, entry_side: "expense", deal_id: "loan-out" },
  { id: "loan-in", date: "2026-07-20", walletable_type: "bank_account", walletable_id: 1, amount: 500_000, entry_side: "income", deal_id: "loan-in" },
  { id: "ctax", date: "2026-07-25", walletable_type: "bank_account", walletable_id: 1, amount: 30_000, entry_side: "expense", deal_id: "ctax" },
  // 口座間振替は実績費目にも月次CFにも混ぜない。
  { id: "transfer", date: "2026-07-26", walletable_type: "bank_account", walletable_id: 1, amount: 10_000, entry_side: "expense", transfer_id: "t1" },
  // 勘定科目との一意な突合ができない取引はCFだけに残し、費目には混ぜない。
  { id: "unknown", date: "2026-07-27", walletable_type: "bank_account", walletable_id: 1, amount: 4_000, entry_side: "expense" },
];

const { rows, result } = buildFreeeCashActualRows(
  ["202607"],
  txns,
  walletables,
  payments,
  accountItems,
  { startDate: "2026-07-01", endDate: "2026-07-31" }
);

const amount = (category: string) => rows.find((row) => row.category === category)?.actual_amount_yen;
assert.equal(amount("cash_inflow"), 500_000, "all observed inbound wallet cash is used for actual CF");
assert.equal(amount("cash_outflow"), 136_000, "unclassified outflow remains in actual CF but not in a fee category");
assert.equal(amount("loan_disbursement"), 500_000);
assert.equal(amount("loan_payment"), 102_000, "loan payment includes interest once");
assert.equal(amount("loan_interest"), 2_000, "interest is an informational breakdown only");
assert.equal(amount("tax_payment_consumption"), 30_000);
assert.equal(result.classifiedTxnCount, 3);
assert.equal(result.unclassifiedTxnCount, 1);
assert.equal(result.transferTxnCount, 1);
assert.ok(rows.every((row) => !JSON.stringify(row.payload).includes("テスト口座")), "wallet identity is not persisted in summary payload");

const ambiguous = buildFreeeCashActualRows(
  ["202607"],
  [{ id: "ambiguous", date: "2026-07-28", walletable_type: "bank_account", walletable_id: 1, amount: 100_000, entry_side: "expense" }],
  walletables,
  [
    { ...payments[0], key: "ambiguous-a", dealId: "ambiguous-a", date: "2026-07-28", amount: 100_000, dealAmount: 100_000, details: [{ account_item_id: "loan", amount: 100_000 }] },
    { ...payments[0], key: "ambiguous-b", dealId: "ambiguous-b", date: "2026-07-28", amount: 100_000, dealAmount: 100_000, details: [{ account_item_id: "loan", amount: 100_000 }] },
  ],
  accountItems,
  { startDate: "2026-07-01", endDate: "2026-07-31" }
);
assert.equal(ambiguous.result.unclassifiedTxnCount, 1, "ambiguous bank transaction is not guessed into a loan category");
assert.equal(ambiguous.rows.find((row) => row.category === "loan_payment"), undefined);

console.log("freee cash actual classification: ok");
