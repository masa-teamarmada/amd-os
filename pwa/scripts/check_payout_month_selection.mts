import assert from "node:assert/strict";
import { defaultPayoutPaymentYm, selectablePayoutPaymentYms } from "../src/lib/payout-month-selection.ts";

assert.equal(defaultPayoutPaymentYm(new Date("2026-10-20T14:59:59Z")), "202610"); // 日本時間20日23:59
assert.equal(defaultPayoutPaymentYm(new Date("2026-10-20T15:00:00Z")), "202611"); // 日本時間21日00:00
assert.equal(defaultPayoutPaymentYm(new Date("2026-12-20T15:00:00Z")), "202701");
assert.equal(defaultPayoutPaymentYm(new Date("2026-10-30T03:00:00Z")), "202611");
const options = selectablePayoutPaymentYms("202611", new Date("2026-10-30T03:00:00Z"));
assert.deepEqual(options.slice(0, 4), ["202611", "202612", "202610", "202609"]);
assert.equal(options.at(-1), "202511");
assert.equal(selectablePayoutPaymentYms("202701", new Date("2026-10-30T03:00:00Z"))[0], "202701");
console.log("支払月初期表示: 日本時間20日/21日・年越し・URL指定月の検証に合格");
