import assert from "node:assert/strict";
import {
  expandExtraRevenue,
  expandExtraRevenueCash,
} from "../src/lib/finance/extra-revenue.ts";

const okudoorRows = [{
  project_id: "p19",
  ym: "202603",
  invoice_ym: null,
  extra_revenue_json: [{
    label: "OkuDoorシステム開発",
    amount_tax_excl: 2_000_000,
    billing_date: "2026-03-31",
    period_start_ym: "202605",
    period_end_ym: "202610",
  }],
}];

assert.deepEqual(
  expandExtraRevenue(okudoorRows),
  [
    [202605, 333333],
    [202606, 333333],
    [202607, 333333],
    [202608, 333333],
    [202609, 333333],
    [202610, 333335],
  ].map(([ym, amount]) => ({ projectId: "p19", ym, amount, labels: ["OkuDoorシステム開発"] })),
);

assert.deepEqual(
  expandExtraRevenueCash(okudoorRows),
  [{ projectId: "p19", ym: 202604, amount: 2_000_000, labels: ["OkuDoorシステム開発"] }],
);

assert.deepEqual(
  expandExtraRevenueCash([{
    ...okudoorRows[0],
    extra_revenue_json: [{ ...okudoorRows[0].extra_revenue_json[0], payment_received_at: "2026-05-12T09:00:00+09:00" }],
  }]),
  [{ projectId: "p19", ym: 202605, amount: 2_000_000, labels: ["OkuDoorシステム開発"] }],
);

console.log("extra revenue cash timing checks passed");
