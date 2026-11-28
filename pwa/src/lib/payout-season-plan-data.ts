import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyPayoutAmountOverridesToCycles, type ConfirmedPayoutAmountEventRow, type PayoutAmountOverrideEventRow } from "@/lib/payout-amount-overrides";
import type { ReimbursementRow } from "@/lib/finance/payout-reimbursements";
import { buildPayoutSeasonPlan, type SeasonProject, type SeasonPlan, type SeasonBilling, type SeasonMember, type SeasonExpense } from "@/lib/payout-season-plan";
import type { ExtraRevenueSourceRow } from "@/lib/finance/extra-revenue";
import { applyPayoutSnapshotsToCycles, type PayoutSnapshot } from "@/lib/payout-season-allocation";

export async function loadPayoutSeasonPlan(paymentYm: string) {
  const db = createAdminClient();
  async function read<T>(table: string, columns: string, order: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = db.from(table).select(columns);
      for (const column of order.split(",")) query = query.order(column);
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw new Error(`${table} の収支予定を取得できませんでした`);
      rows.push(...(data as unknown as T[]));
      if (data.length < 1000) return rows;
    }
  }
  const [projects, plans, rawCycles, members, extraRevenueRows, reimbursements, overrides, confirmedAmounts, obligations, snapshots] = await Promise.all([
    read<SeasonProject>("projects", "project_id,project_name,status,fee_type,fee_amount,start_ym,end_ym,contract_terms_json,payment_due_rule,payment_due_day,invoice_send_deadline_rule", "project_id"),
    read<SeasonPlan>("value_plan_cycles", "project_id,plan_cycle_id,status,period_start_ym,period_end_ym,budget_yen", "plan_cycle_id"),
    read<SeasonBilling>("billing_cycles", "project_id,ym,invoice_ym,status,budget_reported_amount,reward_summary_json,invoice_issued_at,invoice_sent_at,payment_confirmed_at,extra_budget_yen,budget_yen", "id"),
    read<SeasonMember>("members", "member_id,code_name,member_name,is_officer,exclude_from_payout_notice", "member_id"),
    read<ExtraRevenueSourceRow>("billing_cycles", "project_id,ym,extra_revenue_json", "id"),
    read<ReimbursementRow>("reimbursements", "reimbursement_id,project_id,date,amount,status,admin_approved_at", "reimbursement_id"),
    read<PayoutAmountOverrideEventRow>("legacy_reward_payout_amount_override_events", "id,project_id,source_ym,member_id,action,amount_yen,reason,authorized_by,created_at", "id"),
    read<ConfirmedPayoutAmountEventRow>("member_payout_amount_confirmation_events", "id,event_key,project_id,source_ym,payment_ym,member_id,action,amount_yen,reason,authorized_by,created_at", "id"),
    read<{ amount_yen: number | null; amount_status: string; due_date: string | null; expected_payment_ym: string | null; status: string; cashflow_treatment: string; source_kind: string; category: string; payload: Record<string, unknown> }>("company_payment_obligations", "amount_yen,amount_status,due_date,expected_payment_ym,status,cashflow_treatment,source_kind,category,payload", "id"),
    read<PayoutSnapshot>("monthly_reward_payout", "project_id,ym,member_id,total_pay", "id"),
  ]);
  const expenses: SeasonExpense[] = reimbursements.flatMap((row) => {
    if (row.status !== "approved" || !row.project_id) return [];
    const date = row.date ?? row.admin_approved_at;
    const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(date ?? "");
    const amount = Number(row.amount ?? 0);
    if (!match || !Number.isFinite(amount) || amount <= 0) return [];
    return [{ projectId: row.project_id, ym: `${match[1]}${match[2]}`, amountYen: Math.round(amount), kind: "reimbursement" as const }];
  });
  let unallocatedExpenses = 0;
  for (const obligation of obligations) {
    if (obligation.status === "cancelled" || obligation.cashflow_treatment !== "additive") continue;
    if (["payout_notice", "reimbursement"].includes(obligation.source_kind) || ["reward", "reimbursement"].includes(obligation.category)) continue;
    const projectId = String(obligation.payload?.project_id ?? obligation.payload?.projectId ?? "");
    const ym = obligation.expected_payment_ym ?? obligation.due_date?.slice(0, 7).replace("-", "");
    if (!projectId || !ym) { unallocatedExpenses += 1; continue; }
    expenses.push({ projectId, ym, amountYen: obligation.amount_status === "unknown" ? null : obligation.amount_yen, kind: "other" });
  }
  return {
    ...buildPayoutSeasonPlan({ paymentYm, projects, plans, cycles: applyPayoutAmountOverridesToCycles(applyPayoutSnapshotsToCycles(rawCycles, snapshots), overrides, confirmedAmounts), members, extraRevenueRows, expenses }),
    unallocatedExpenses,
  };
}
