/** Read-only reconciliation of every displayed month against the owning records. */
import assert from "node:assert/strict";
import { createAdminClient } from "../src/lib/supabase/admin.ts";
import { loadPayoutSeasonPlan } from "../src/lib/payout-season-plan-data.ts";
import { contractBackedClientAmount } from "../src/lib/contract-money.ts";
import { expandExtraRevenue } from "../src/lib/finance/extra-revenue.ts";
import { isNonCashAllocationMember } from "../src/lib/reward-finance-summary.ts";
import { SEASON_METRICS, type SeasonBilling, type SeasonProject, type SeasonMember } from "../src/lib/payout-season-plan.ts";

const db = createAdminClient();
async function read(table: string, columns: string, order: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from(table).select(columns).order(order).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
const paymentYm = process.argv[2] ?? "202612";
const [plan, cycles, snapshots, profiles, projects, reimbursements, obligations, policies] = await Promise.all([
  loadPayoutSeasonPlan(paymentYm),
  read("billing_cycles", "project_id,ym,invoice_ym,status,budget_reported_amount,reward_summary_json,invoice_issued_at,invoice_sent_at,payment_confirmed_at,extra_revenue_json", "id"),
  read("monthly_reward_payout", "project_id,ym,member_id,total_pay", "id"),
  read("members", "member_id,exclude_from_payout_notice", "member_id"),
  read("projects", "project_id,project_name,status,fee_type,fee_amount,start_ym,end_ym,contract_terms_json,payment_due_rule,payment_due_day,invoice_send_deadline_rule", "project_id"),
  read("reimbursements", "reimbursement_id,project_id,date,admin_approved_at,status,amount", "reimbursement_id"),
  read("company_payment_obligations", "amount_yen,amount_status,due_date,expected_payment_ym,status,cashflow_treatment,source_kind,category,payload", "id"),
  read("project_fixed_monthly_rewards", "project_id,effective_from_ym,member_amounts_json", "effective_from_ym"),
]);
const profile = new Map(profiles.map(m => [m.member_id, m]));
const projectMap = new Map(projects.map(p => [p.project_id, p]));
function accrued(m: any) {
  const total = m.basePay ?? m.base_pay;
  const extra = m.extraBasePay ?? m.extra_base_pay ?? 0;
  const regular = m.regularBasePay ?? m.regular_base_pay ?? (total == null ? null : Number(total) - Number(extra));
  assert.ok(regular != null && Number.isFinite(Number(regular)) && Number(regular) >= 0, "本契約の発生報酬が未確認");
  assert.ok(Number.isFinite(Number(extra)) && Number(extra) >= 0, "別財布の発生報酬が未確認");
  if (total != null) assert.equal(Math.round(Number(regular)) + Math.round(Number(extra)), Math.round(Number(total)), "発生報酬の内訳不一致");
  return { regular: Math.round(Number(regular)), extra: Math.round(Number(extra)) };
}
let checks = 0;
function equal(actual: unknown, expected: unknown, label: string) { assert.equal(actual, expected, label); checks++; }
for (const row of plan.projects.filter(p => p.planId)) {
  const project = projectMap.get(row.projectId) as SeasonProject;
  const sourceCycles = cycles.filter(c => c.project_id === row.projectId && c.ym >= row.startYm! && c.ym <= row.endYm!);
  const income = new Map<string, number>(), debt = new Map<string, number>(), amounts = new Map<string, number>();
  for (const c of sourceCycles) {
    const value = contractBackedClientAmount({ ym: c.ym, project, reportedAmount: c.budget_reported_amount, cycleStatus: c.status, hasInvoiceEvidence: !!c.invoice_issued_at });
    income.set(c.ym, (income.get(c.ym) ?? 0) + value);
    let stock = 0;
    for (const m of c.reward_summary_json?.members ?? []) {
      const id = m.memberId ?? m.member_id;
      if (!profile.has(id) || profile.get(id).exclude_from_payout_notice || isNonCashAllocationMember(m)) continue;
      stock += Math.round(Number(m.stockYen ?? m.stock_yen ?? m.deferredYen ?? m.deferred_yen ?? 0));
      const p = accrued(m);
      for (const [metric, value] of [["regularAccrued", p.regular], ["extraAccrued", p.extra]] as const) {
        const k = `${id}:${c.ym}:${metric}`;
        amounts.set(k, (amounts.get(k) ?? 0) + value);
      }
    }
    debt.set(c.ym, stock);
  }
  const extra = expandExtraRevenue(cycles.filter(c => c.project_id === row.projectId).map(c => ({ ...c, extra_revenue_json: (c.extra_revenue_json ?? []).filter((e: any) => (e.period_start_ym ?? c.ym) <= row.endYm! && (e.period_end_ym ?? e.period_start_ym ?? c.ym) >= row.startYm!) })), { minYm: Number(row.startYm), maxYm: Number(row.endYm) });
  let cumulative = 0;
  for (const month of plan.months) {
    const cell = row.cells[month];
    equal(cell.income, income.get(month) ?? 0, `${row.projectName} ${month}: 本契約入金`);
    equal(cell.extraIncome, extra.filter(e => String(e.ym) === month).reduce((s,e) => s+e.amount,0), `${row.projectName} ${month}: 別契約入金`);
    equal(cell.debt, debt.get(month) ?? 0, `${row.projectName} ${month}: 稼働月末残高`);
    for (const metric of ["regularAccrued", "extraAccrued"] as const) {
      for (const m of row.memberPayments) equal(m.cells[month][metric], amounts.get(`${m.memberId}:${month}:${metric}`) ?? 0, `${row.projectName} ${month} ${m.memberName}: ${metric}`);
      equal(cell[metric], row.memberPayments.reduce((s,m) => s + (m.cells[month][metric] ?? 0),0), `${row.projectName} ${month}: 個人合計`);
    }
    const actualReimbursement = reimbursements.filter(r => r.project_id === row.projectId && r.status === "approved" && (r.date ?? r.admin_approved_at)?.slice(0, 7).replace("-", "") === month).reduce((s,r) => s + Math.round(Number(r.amount ?? 0)),0);
    equal(cell.reimbursement, actualReimbursement, `${row.projectName} ${month}: 利用月の立替経費`);
    const other = obligations.filter(o => o.status !== "cancelled" && o.cashflow_treatment === "additive" && !["payout_notice","reimbursement"].includes(o.source_kind) && !["reward","reimbursement"].includes(o.category) && (o.payload?.project_id ?? o.payload?.projectId) === row.projectId && (o.expected_payment_ym ?? o.due_date?.slice(0,7).replace("-","")) === month);
    equal(cell.other, other.reduce((s,o) => s + Number(o.amount_yen ?? 0),0), `${row.projectName} ${month}: 追加支出`);
    const net = cell.income! + cell.extraIncome! - cell.regularAccrued! - cell.extraAccrued! - cell.reimbursement! - cell.other!;
    cumulative += net;
    equal(cell.net, net, `${row.projectName} ${month}: 差引`);
    equal(cell.cumulative, cumulative, `${row.projectName} ${month}: 累計`);
  }
  for (const [metric,, kind] of SEASON_METRICS) equal(row.totals[metric], kind === "flow" ? plan.months.reduce((s,month) => s + row.cells[month][metric]!,0) : metric === "debt" ? debt.get(row.endYm!) ?? 0 : cumulative, `${row.projectName}: ${metric} シーズン計`);
}
for (const month of plan.months) for (const [metric] of SEASON_METRICS) equal(plan.totalCells[month][metric], plan.projects.filter(p=>p.planId).reduce((s,p)=>s+p.cells[month][metric]!,0), `${month} ${metric}: 全PJ合計`);
console.log(JSON.stringify({ paymentYm, projects: plan.projects.filter(p=>p.planId).length, months: plan.months.length, checkedValues: checks, savedDetails: snapshots.length, unconfiguredProjects: plan.projects.filter(p=>!p.planId).map(p=>p.projectName), november: plan.totalCells["202611"], fixedMonthlyRules: policies, result: "PASS" }));
