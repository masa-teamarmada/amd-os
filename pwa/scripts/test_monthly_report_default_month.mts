import assert from "node:assert/strict";
import { getDefaultMonthlyReportYm } from "../src/lib/monthly-report-default-month.ts";

for (const [instant, expected] of [
  ["2026-10-06T12:00:00+09:00", "202609"],
  ["2026-10-24T23:59:59.999+09:00", "202609"],
  ["2026-10-25T00:00:00.000+09:00", "202610"],
  ["2026-10-31T23:59:59+09:00", "202610"],
  ["2026-11-01T00:00:00+09:00", "202610"],
  ["2027-01-24T23:59:59+09:00", "202612"],
  ["2027-01-25T00:00:00+09:00", "202701"],
  ["2028-02-24T23:59:59+09:00", "202801"],
  ["2028-02-25T00:00:00+09:00", "202802"],
  ["2028-02-29T23:59:59+09:00", "202802"],
  ["2026-10-24T14:59:59.999Z", "202609"],
  ["2026-10-24T15:00:00.000Z", "202610"],
] as const) {
  assert.equal(getDefaultMonthlyReportYm(new Date(instant)), expected, instant);
}
console.log("monthly report default month: JST cutoff and calendar rollover ok");
