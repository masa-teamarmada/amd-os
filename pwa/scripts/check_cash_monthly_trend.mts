// 「現金と融資」03 月ごとの推移の検査。正本は manual/6-13-cash-and-loans-spec.md。
import assert from "node:assert/strict";
import { buildMonthlyTrend, classifyEntry, type TrendEntry, type TrendLoanEvent } from "../src/lib/finance/cash-monthly-trend.ts";

let n = 0;
const e = (account_id: string, entry_date: string, deposit: number, withdrawal: number, counterparty: string | null, extra: Partial<TrendEntry> = {}): TrendEntry => ({
  id: `r${n++}`, account_id, entry_date, seq: n, deposit, withdrawal, balance: null, source: "sheet:x", source_row: n,
  counterparty, transfer_name: null, isPlanned: false, ...extra,
});
const events: TrendLoanEvent[] = [
  { loanId: "sk", accountId: "shokochukin", eventDate: "2026-01-19", kind: "drawdown", amount: 5_000_000, principal: 5_000_000, isPlanned: false },
  { loanId: "sk", accountId: "shokochukin", eventDate: "2026-02-05", kind: "repayment", amount: 93_750, principal: 83_333, isPlanned: false },
  { loanId: "pp", accountId: "paypay", eventDate: "2026-09-04", kind: "drawdown", amount: 1_400_000, principal: 1_400_000, isPlanned: false },
];
const sk = { ledgerOnly: true, loanEvents: events };
const pp = { ledgerOnly: false, loanEvents: events };

// 自社口座どうしの移動は数えない。
assert.equal(classifyEntry(e("paypay", "2026-02-04", 0, 400_000, "チームアルマダ"), pp), "transfer");
assert.equal(classifyEntry(e("paypay", "2026-09-30", 0, 400_000, "振込 カ）チ−ムアルマダ"), pp), "transfer");
assert.equal(classifyEntry(e("shokochukin", "2026-02-04", 400_000, 0, null), sk), "transfer");
assert.equal(classifyEntry(e("shokochukin", "2026-01-19", 0, 5_000_000, null), sk), "transfer");
// 返済専用の口座は予定表と突き合わせる。手数料・利息はふつうの出入り。
assert.equal(classifyEntry(e("shokochukin", "2026-01-19", 4_929_098, 0, null), sk), "loan_in");
assert.equal(classifyEntry(e("shokochukin", "2026-02-05", 0, 93_750, null), sk), "loan_out");
assert.equal(classifyEntry(e("shokochukin", "2026-02-06", 0, 1_200, null), sk), "other_out");
// 相手先が書かれる口座は相手先で決める。借入の数日後の売上を借入にしない。
assert.equal(classifyEntry(e("paypay", "2026-09-04", 1_400_000, 0, "ビジネスローン借入"), pp), "loan_in");
assert.equal(classifyEntry(e("paypay", "2026-09-07", 1_152_800, 0, "振込 ダイ）エヒメダイガク"), pp), "income");
assert.equal(classifyEntry(e("paypay", "2026-09-30", 0, 30_000, "約定返済"), pp), "loan_out");
assert.equal(classifyEntry(e("paypay", "2026-09-25", 0, 561_292, "振込 ヤマジ　マサヒロ"), pp), "pay_masa");
assert.equal(classifyEntry(e("paypay", "2026-09-25", 0, 304_119, "PE シヤカイホケンリヨウトウ（コツコキン）"), pp), "tax");
assert.equal(classifyEntry(e("paypay", "2026-09-10", 0, 50_000, "JCBカード"), pp), "card");
assert.equal(classifyEntry(e("paypay", "2026-09-10", 0, 80_000, "りさ"), pp), "pay_members");

// 月末残高は銀行の残高を正にし、明細と合わない額を「明細の漏れ」に出す。
const rows = buildMonthlyTrend({
  accounts: [{ accountId: "paypay", ledgerOnly: false }, { accountId: "shokochukin", ledgerOnly: true }],
  entries: [
    e("paypay", "2026-01-05", 1_000_000, 0, "売上", { balance: 1_000_000 }),
    e("paypay", "2026-02-10", 0, 100_000, "りさ"),
    e("paypay", "2026-02-11", 0, 400_000, "チームアルマダ"),
    e("shokochukin", "2026-02-11", 400_000, 0, null, { balance: 400_000 }),
  ],
  loanEvents: [],
  startYm: "2026-01",
  today: "2026-02-20",
  bankBalances: new Map([["2026-01", 1_000_000], ["2026-02", 450_000]]),
});
assert.equal(rows.length, 2);
assert.equal(rows[1].partial, true);
assert.equal(rows[1].outflow, 100_000, "口座どうしの移動は出に入らない");
assert.equal(rows[1].endBalance, 850_000, "銀行 450,000 + 商工中金の明細 400,000");
assert.equal(rows[1].unexplained, -50_000, "銀行の残高が明細より 5万円少ない");

// 見込み: 予定のある月はきよの予定、無い月は直近3か月の中央値。返済は予定表、無ければ前回と同じ額。
const months = ["2026-06", "2026-07", "2026-08"];
const forecast = buildMonthlyTrend({
  accounts: [{ accountId: "paypay", ledgerOnly: false }],
  entries: [
    e("paypay", "2026-05-31", 1_000_000, 0, "売上", { balance: 1_000_000 }),
    ...months.map((m, i) => e("paypay", `${m}-10`, 0, [100_000, 2_000_000, 300_000][i], "りさ")),
    e("paypay", "2026-09-03", 0, 10_000, "りさ"),
    // 実績の最終日 (9/3) より後で、今日 (9/5) より前の予定も入れる。
    e("paypay", "2026-09-04", 0, 50_000, "JCBカード", { isPlanned: true }),
    e("paypay", "2026-10-25", 500_000, 0, "売上", { isPlanned: true }),
  ],
  loanEvents: [
    { loanId: "pp", accountId: "paypay", eventDate: "2026-08-31", kind: "repayment", amount: 30_000, principal: 16_000, isPlanned: false },
  ],
  startYm: "2026-06",
  today: "2026-09-05",
  forecastMonths: 2,
  mainAccountId: "paypay",
});
const [sep, oct, nov] = forecast.slice(-3);
assert.equal(sep.basis, "current");
assert.equal(sep.flows.card, 50_000, "実績の最終日から今日までの予定も今月に入る");
assert.equal(sep.flows.loan_out, 30_000, "予定表の無い借入は前回と同じ額を返す");
assert.equal(oct.basis, "plan");
assert.equal(oct.flows.income, 500_000);
assert.equal(oct.flows.pay_members, 0, "予定のある月は予定だけを使う");
assert.equal(nov.basis, "average");
assert.equal(nov.flows.pay_members, 300_000, "中央値なので 200 万円の一度きりの支払に引っ張られない");
assert.equal(nov.loanOutstanding - oct.loanOutstanding, -16_000);

console.log("cash monthly trend: ok");
