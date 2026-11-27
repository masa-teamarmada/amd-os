import assert from "node:assert/strict";
import { defaultPayoutPaymentYm, selectablePayoutPaymentYms, payoutSeasonFocusYm } from "../src/lib/payout-month-selection.ts";

assert.equal(defaultPayoutPaymentYm(new Date("2026-10-20T14:59:59Z")), "202610"); // 日本時間20日23:59
assert.equal(defaultPayoutPaymentYm(new Date("2026-10-20T15:00:00Z")), "202610"); // 日本時間21日00:00も当月
assert.equal(defaultPayoutPaymentYm(new Date("2026-11-27T03:00:00Z")), "202611");
assert.equal(defaultPayoutPaymentYm(new Date("2026-10-31T14:59:59Z")), "202610");
assert.equal(defaultPayoutPaymentYm(new Date("2026-10-31T15:00:00Z")), "202611"); // 日本時間11月1日00:00
assert.equal(defaultPayoutPaymentYm(new Date("2026-12-31T15:00:00Z")), "202701");
const options = selectablePayoutPaymentYms("202611", new Date("2026-10-30T03:00:00Z"));
assert.deepEqual(options.slice(0, 4), ["202611", "202612", "202610", "202609"]);
assert.equal(options.at(-1), "202511");
assert.equal(selectablePayoutPaymentYms("202701", new Date("2026-10-30T03:00:00Z"))[0], "202701");
console.log("支払月初期表示: 日本時間の当月・月末境界・年越し・URL指定月の検証に合格");

assert.equal(payoutSeasonFocusYm("202612"), "202611", "12月の支払準備では11月から比較する");
assert.equal(payoutSeasonFocusYm("202701"), "202612", "年初は前年12月から比較する");
assert.equal(payoutSeasonFocusYm("202603"), "202602");
