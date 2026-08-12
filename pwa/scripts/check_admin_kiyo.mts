import assert from "node:assert/strict";
import { buildKiyoOverviewRows } from "../src/lib/admin-kiyo.ts";

const projects = [
  { project_id: "p1", project_name: "Active A", status: "active" },
  { project_id: "p2", project_name: "Active B", status: "active" },
  { project_id: "p3", project_name: "Ended", status: "ended" },
];

const rows = buildKiyoOverviewRows({
  projects,
  payoutCycles: [{ project_id: "p1", reward_summary_json: { members: [] } }, { project_id: "p2", reward_summary_json: null }],
  payoutEntries: [{ project_id: "p1", total_pay: 120000 }],
  billingCycles: [
    { project_id: "p1", invoice_sent_at: "2026-08-10T01:00:00Z", invoice_sent_by: "other@example.com" },
    { project_id: "p2", invoice_sent_at: "2026-08-11T01:00:00Z", invoice_sent_by: null },
  ],
  billingLogs: [
    { project_id: "p1", action: "invoice_sent", actor: "keiri@team-armada.jp" },
    { project_id: "p2", action: "budget_approved", actor: "keiri@team-armada.jp" },
  ],
  reimbursements: [
    { reimbursement_id: "r1", project_id: "p1", status: "approved" },
    { reimbursement_id: "r2", project_id: "p1", status: "submitted" },
  ],
  availability: { payout: true, billing: true, billingLogs: true, reimbursements: true },
});

assert.deepEqual(rows.map((row) => row.projectId), ["p1", "p2"], "active PJだけを表示する");
assert.equal(rows[0].payout.amountYen, 120000, "payoutsの確定entryをPJ別に集計する");
assert.equal(rows[0].reimbursement.label, "要対応 1件", "未完了立替を完了扱いにしない");
assert.equal(rows[0].invoice.label, "経理確認", "請求書送付actionと経理actorの証跡で経理確認にする");
assert.equal(rows[1].payout.label, "未取得", "reward summary欠測を0円にしない");
assert.equal(rows[1].invoice.label, "要確認", "無関係な経理actorログを送付証跡にしない");

const unavailable = buildKiyoOverviewRows({
  projects: [projects[0]], payoutCycles: [], payoutEntries: [],
  billingCycles: [{ project_id: "p1", invoice_sent_at: "2026-08-10T01:00:00Z" }],
  billingLogs: [], reimbursements: [],
  availability: { payout: false, billing: true, billingLogs: false, reimbursements: false },
})[0];

assert.equal(unavailable.payout.label, "取得失敗", "支払取得失敗を0円にしない");
assert.equal(unavailable.reimbursement.label, "取得失敗", "立替取得失敗を対象なしにしない");
assert.equal(unavailable.invoice.label, "証跡未取得", "log取得失敗を要確認に確定しない");

console.log("admin kiyo contract: ok");
