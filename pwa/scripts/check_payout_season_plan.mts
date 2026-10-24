import assert from "node:assert/strict";
import { buildPayoutSeasonPlan, choosePayoutSeason, type SeasonBilling, type SeasonProject } from "../src/lib/payout-season-plan.ts";

const project: SeasonProject = { project_id: "test-a", project_name: "検証PJ", status: "active", fee_type: "monthly_fixed", fee_amount: 1000, start_ym: "202601", end_ym: "202603", payment_due_rule: "next_month_end", payment_due_day: null };
const plan = { project_id: project.project_id, plan_cycle_id: "test-season", status: "active", period_start_ym: "202601", period_end_ym: "202603" };
const cycles: SeasonBilling[] = ["202601", "202602", "202603"].map((ym, index) => ({
  project_id: project.project_id, ym, invoice_ym: "202606", status: "allocation_confirmed", reward_summary_json: { members: [
    { memberId: "external", totalPay: 600, regularPaidYen: 500, extraPaidYen: 100, stockYen: [100, 80, 50][index] },
    { memberId: "officer", totalPay: 900, stockYen: 900 },
    { memberId: "excluded", totalPay: 900, stockYen: 900 },
  ] },
}));
const base = { paymentYm: "202602", projects: [project], plans: [plan], cycles, members: [{ member_id: "external" }, { member_id: "officer", is_officer: true }, { member_id: "excluded", exclude_from_payout_notice: true }], extraRevenueRows: [] };
const actual = buildPayoutSeasonPlan(base);
const row = actual.projects[0];
assert.equal(row.cells["202602"].regularPay, 500, "支払月はPJ支払条件から決める");
assert.equal(row.cells["202606"].regularPay, 0, "請求月をメンバー支払月へ流用しない");
assert.equal(row.cells["202606"].income, 3000, "本契約入金は請求月を反映する");
assert.equal(row.totals.regularPay, 1500, "役員・通知対象外を外部支払に混ぜない");
assert.equal(row.totals.extraPay, 300);
assert.equal(row.totals.debt, 50, "未払残高を月間合算しない");
assert.equal(row.totals.net, 1200);
assert.equal(actual.months[0], "202601", "シーズン前半を省略しない");
assert.equal(actual.months.at(-1), "202606", "最終入金・支払まで表示する");

const missing = buildPayoutSeasonPlan({ ...base, cycles: cycles.filter((cycle) => cycle.ym !== "202602") });
assert.equal(missing.projects[0].cells["202603"].regularPay, null, "未計算を予算や0円で埋めない");
assert.equal(missing.projects[0].totals.net, null, "未計算がある収支合計を安全扱いしない");
assert.deepEqual(missing.projects[0].missingMonths, ["202602"]);
const zero = buildPayoutSeasonPlan({ ...base, cycles: cycles.map((cycle) => ({ ...cycle, reward_summary_json: { members: [] } })) });
assert.equal(zero.projects[0].totals.regularPay, 0, "0円の計算済みキャッシュは0円");
assert.equal(zero.projects[0].missingMonths.length, 0);
const unknownMember = buildPayoutSeasonPlan({ ...base, members: [] });
assert.equal(unknownMember.projects[0].totals.regularPay, null, "支払対象者を解決できなければ未確認");

const expenses = buildPayoutSeasonPlan({ ...base, expenses: [{ projectId: project.project_id, ym: "202602", amountYen: 101, kind: "reimbursement" }, { projectId: project.project_id, ym: "202603", amountYen: 99, kind: "other" }] });
assert.equal(expenses.projects[0].totals.net, 1000, "立替実費と追加支出を一度だけ控除する");
assert.equal(expenses.projects[0].totals.reimbursement, 101, "立替に消費税を再加算しない");

const old = { ...plan, plan_cycle_id: "old", period_start_ym: "202301", period_end_ym: "202312" };
assert.equal(choosePayoutSeason([old], project, "202610"), null, "対象月と無関係な過去シーズンを引き延ばさない");
assert.equal(choosePayoutSeason([plan, { ...plan, plan_cycle_id: "draft", status: "draft" }], project, "202602")?.plan_cycle_id, "test-season", "同期間のdraftより確定側を優先する");
const unconfigured = buildPayoutSeasonPlan({ ...base, projects: [...base.projects, { ...project, project_id: "no-season", project_name: "未設定PJ" }] });
assert.equal(unconfigured.projects.length, 2, "今月支払がなくても全PJを残す");
assert.equal(unconfigured.projects.find((item) => item.projectId === "no-season")?.planId, null);
console.log("支払通知書のシーズン収支: 月の区別・全期間・外部支払・立替・未計算・期末残高の検証に合格");
