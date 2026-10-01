import assert from "node:assert/strict";
import { syncRewardSummaryForCycle, syncRewardSummariesForBillingCycles } from "../src/lib/reward-summary.ts";

const saved = { members: [{ memberId: "A", earnedPt: 1, basePay: 55551, bonusPt: 0, totalPay: 50001,
  regularStockYen: 5550, stockYen: 5550, breakdown: [] }] };
function mock(kind: "flag" | "payout" | "notice" | "missing") {
  let writes = 0;
  const tables: Record<string, any[]> = {
    billing_cycles: [{ project_id: "pANY", ym: "202610", reward_summary_json: kind === "missing" ? null : saved,
      reward_paid_at: kind === "flag" || kind === "missing" ? "2026-11-01" : null }],
    projects: [{ project_id: "pANY", payment_due_rule: "next_month_eom" }],
    value_plan_cycles: [], members: [],
    monthly_reward_payout: kind === "payout" ? [{ project_id: "pANY", ym: "202610", member_id: "A" }] : [],
    payout_notices: kind === "notice" ? [{ ym: "202611", member_id: "A", notice_no: "OFFICIAL", pdf_url: "https://example.invalid/notice.pdf" }] : [],
  };
  const db: any = { from(table: string) {
    let rows = structuredClone(tables[table] || []); let single = false;
    const q: any = {};
    q.select = () => q; q.order = () => q;
    q.eq = (key: string, value: unknown) => { rows = rows.filter(r => r[key] === value); return q; };
    q.in = (key: string, values: unknown[]) => { rows = rows.filter(r => values.includes(r[key])); return q; };
    q.range = (from: number, to: number) => { rows = rows.slice(from, to + 1); return q; };
    q.maybeSingle = () => { single = true; return q; };
    q.update = () => { writes++; throw Error("保護月への書込禁止"); };
    q.then = (resolve: any, reject: any) => Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject);
    return q;
  } };
  return { db, writes: () => writes };
}
for (const kind of ["flag", "payout", "notice"] as const) {
  const m = mock(kind);
  const result = await syncRewardSummaryForCycle(m.db, "pANY", "202610");
  assert.deepEqual(result.rewardSummary, saved, kind);
  assert.equal(result.skippedReason, "payout_protected", kind);
  // cronの呼出元に保護列がなくても下層で確定額を守る。
  await syncRewardSummariesForBillingCycles(m.db, [{ project_id: "pANY", ym: "202610" }]);
  assert.equal(m.writes(), 0);
}
await assert.rejects(() => syncRewardSummaryForCycle(mock("missing").db, "pANY", "202610"), /protected reward snapshot missing/);
console.log("common payout protection: flags / saved payouts / issued notices / missing snapshot / no writes OK");
