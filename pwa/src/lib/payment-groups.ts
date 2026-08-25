import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computePaymentDueDateByRule,
  computePaymentYmByRule,
  paymentDueRuleLabel,
} from "@/lib/payment-rules";
import { contractBackedClientAmount, isWithinContractPeriod } from "@/lib/contract-money";

const YM_RE = /^[0-9]{6}$/;

export type PaymentCycleRow = {
  project_id: string;
  ym: string;
  status: string | null;
  budget_yen: number | null;
  budget_reported_amount: number | null;
  invoice_ym: string | null;
  invoice_base_lines_json: string | null;
  invoice_subject: string | null;
  invoice_issued_at: string | null;
  invoice_sent_at: string | null;
  freee_invoice_number: string | null;
  payment_confirmed_at: string | null;
};

export type PaymentProjectRow = {
  project_id: string;
  project_name: string;
  client_name: string | null;
  status: string | null;
  fee_type?: string | null;
  fee_amount?: number | string | null;
  start_ym?: string | null;
  end_ym?: string | null;
  freee_partner_id: string | null;
  payment_due_rule: string | null;
  payment_due_day: number | null;
  invoice_send_deadline_rule?: string | null;
};

export type PaymentConfirmationGroup = {
  key: string;
  projectId: string;
  projectName: string;
  clientName: string | null;
  projectStatus: string | null;
  freeePartnerId: string | null;
  invoiceYm: string;
  sourceYms: string[];
  dueDate: string;
  dueRuleLabel: string;
  expectedNetAmountYen: number;
  expectedGrossAmountYen: number;
  freeeInvoiceNumbers: string[];
  cycles: PaymentCycleRow[];
};

function addMonths(ym: string, delta: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentYmJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function cleanYm(value: string | null | undefined): string | null {
  const ym = (value ?? "").trim();
  return YM_RE.test(ym) ? ym : null;
}

export function candidateSourceYmsForPaymentYm(paymentYm: string): string[] {
  return [paymentYm, addMonths(paymentYm, -1), addMonths(paymentYm, -2), addMonths(paymentYm, -3)];
}

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function invoiceLinesNet(raw: string | null): number {
  if (!raw?.trim()) return 0;
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return 0;
    return Math.round(
      parsed.reduce((sum, row) => {
        if ((row.type ?? "item") === "text") return sum;
        const quantity = numberValue(row.quantity) || 1;
        const unitPrice = numberValue(row.unit_price);
        return sum + quantity * unitPrice;
      }, 0)
    );
  } catch {
    return 0;
  }
}

function expectedNetForCycle(cycle: PaymentCycleRow, project: PaymentProjectRow): number {
  const invoiceNet = invoiceLinesNet(cycle.invoice_base_lines_json);
  if ((cycle.invoice_issued_at || cycle.freee_invoice_number) && invoiceNet > 0) return invoiceNet;
  const reportedOrFixed = contractBackedClientAmount({
    ym: cycle.ym,
    project,
    reportedAmount: cycle.budget_reported_amount,
    cycleStatus: cycle.status,
    hasInvoiceEvidence: Boolean(cycle.invoice_issued_at || cycle.freee_invoice_number || cycle.invoice_base_lines_json),
  });
  if (reportedOrFixed > 0) return reportedOrFixed;
  if (invoiceNet > 0 && isWithinContractPeriod(project, cycle.ym)) return invoiceNet;
  const budget = Math.round(numberValue(cycle.budget_yen));
  return budget > 0 && isWithinContractPeriod(project, cycle.ym) ? Math.round(budget / 0.65) : 0;
}

function expectedGrossFromNet(net: number): number {
  return Math.round(net * 1.1);
}

function invoiceDeadlineDay(rule: string | null | undefined): number | null {
  const match = String(rule ?? "").match(/\d{1,2}/);
  if (!match) return null;
  const day = Number(match[0]);
  return Number.isFinite(day) ? Math.max(1, Math.min(31, day)) : null;
}

function isoForYmDay(ym: string, day: number): string | null {
  if (!YM_RE.test(ym)) return null;
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function paymentRuleReferenceDate(
  cycle: Pick<PaymentCycleRow, "ym"> & Partial<Pick<PaymentCycleRow, "invoice_sent_at" | "invoice_issued_at">>,
  project: Pick<PaymentProjectRow, "payment_due_rule" | "invoice_send_deadline_rule"> | undefined
): string | null {
  if (cycle.invoice_sent_at) return cycle.invoice_sent_at;
  if (cycle.invoice_issued_at) return cycle.invoice_issued_at;
  if (project?.payment_due_rule !== "invoice_received_60_days") return null;
  const deadlineDay = invoiceDeadlineDay(project.invoice_send_deadline_rule);
  return deadlineDay ? isoForYmDay(addMonths(cycle.ym, 1), deadlineDay) : null;
}

export function effectivePaymentYmForCycle(
  cycle: Pick<PaymentCycleRow, "invoice_ym" | "ym"> & Partial<Pick<PaymentCycleRow, "invoice_sent_at" | "invoice_issued_at">>,
  project: Pick<PaymentProjectRow, "payment_due_rule" | "payment_due_day" | "invoice_send_deadline_rule"> | undefined
): string {
  const explicit = cleanYm(cycle.invoice_ym);
  if (explicit) return explicit;
  return computePaymentYmByRule(
    cycle.ym,
    project?.payment_due_rule ?? null,
    project?.payment_due_day ?? null,
    paymentRuleReferenceDate(cycle, project)
  );
}

/**
 * メンバーへの支払月。
 *
 * 既定は PJ の支払条件からの推定だが、**クライアントからの入金が確認できている稼働月は、
 * 推定より早ければ入金月をそのまま支払月にする**。
 * 「請求書受領後60日」のような条件は、請求書を実際にいつ送ったかが台帳に無いと
 * 「翌月◯日に送る」という保守的な推定になり、実際にはもう入金があるのに支払月が
 * 1か月後ろへずれる (SX 2026年6月分で発生。まさ指摘 2026-08-26)。入金という
 * 事実がある以上、推定より事実を優先する。
 *
 * すでにメンバーへ支払った月 (`reward_paid_at`) は動かさない。
 */
export function effectiveMemberPayoutYmForCycle(
  cycle: Pick<PaymentCycleRow, "invoice_ym" | "ym"> &
    Partial<Pick<PaymentCycleRow, "invoice_sent_at" | "invoice_issued_at" | "payment_confirmed_at">> & {
      reward_paid_at?: string | null;
    },
  project: Pick<PaymentProjectRow, "payment_due_rule" | "payment_due_day" | "invoice_send_deadline_rule"> | undefined
): string {
  // invoice_ym is the client invoice month. Member payouts use the PJ payment rule.
  const estimated = computePaymentYmByRule(
    cycle.ym,
    project?.payment_due_rule ?? null,
    project?.payment_due_day ?? null,
    paymentRuleReferenceDate(cycle, project)
  );

  if (cycle.reward_paid_at) return estimated;
  const confirmedYm = cleanYm(String(cycle.payment_confirmed_at ?? "").slice(0, 7).replace("-", ""));
  if (!confirmedYm) return estimated;
  return confirmedYm < estimated ? confirmedYm : estimated;
}

export async function loadPaymentConfirmationGroups(
  db: SupabaseClient,
  paymentYm: string,
  options: { includeConfirmed?: boolean } = {}
): Promise<PaymentConfirmationGroup[]> {
  const targetYm = cleanYm(paymentYm);
  if (!targetYm) throw new Error("valid paymentYm is required");

  const cycleSelect = [
    "project_id",
    "ym",
    "status",
    "budget_yen",
    "budget_reported_amount",
    "invoice_ym",
    "invoice_base_lines_json",
    "invoice_subject",
    "invoice_issued_at",
    "invoice_sent_at",
    "freee_invoice_number",
    "payment_confirmed_at",
  ].join(", ");

  const candidates = candidateSourceYmsForPaymentYm(targetYm);
  const [projectsRes, explicitRes, unsetRes] = await Promise.all([
    db
      .from("projects")
      .select("project_id, project_name, client_name, status, fee_type, fee_amount, start_ym, end_ym, freee_partner_id, payment_due_rule, payment_due_day, invoice_send_deadline_rule"),
    db.from("billing_cycles").select(cycleSelect).eq("invoice_ym", targetYm),
    db.from("billing_cycles").select(cycleSelect).in("ym", candidates).is("invoice_ym", null),
  ]);

  if (projectsRes.error) throw projectsRes.error;
  if (explicitRes.error) throw explicitRes.error;
  if (unsetRes.error) throw unsetRes.error;

  const projectMap = new Map<string, PaymentProjectRow>();
  for (const project of (projectsRes.data ?? []) as PaymentProjectRow[]) {
    projectMap.set(project.project_id, project);
  }

  const cycles = new Map<string, PaymentCycleRow>();
  for (const cycle of ((explicitRes.data ?? []) as unknown as PaymentCycleRow[])) {
    cycles.set(`${cycle.project_id}:${cycle.ym}`, cycle);
  }
  for (const cycle of ((unsetRes.data ?? []) as unknown as PaymentCycleRow[])) {
    const project = projectMap.get(cycle.project_id);
    if (effectivePaymentYmForCycle(cycle, project) === targetYm) {
      cycles.set(`${cycle.project_id}:${cycle.ym}`, cycle);
    }
  }

  const groupMap = new Map<string, PaymentConfirmationGroup>();
  for (const cycle of [...cycles.values()].sort((a, b) => a.ym.localeCompare(b.ym))) {
    if (!options.includeConfirmed && cycle.payment_confirmed_at) continue;
    const project = projectMap.get(cycle.project_id);
    if (!project) continue;
    if ((project.status ?? "").toLowerCase() === "lost") continue;

    const invoiceYm = effectivePaymentYmForCycle(cycle, project);
    if (invoiceYm !== targetYm) continue;
    const key = `${cycle.project_id}:${invoiceYm}`;
    const referenceDate = paymentRuleReferenceDate(cycle, project);
    const dueDate = computePaymentDueDateByRule(cycle.ym, project.payment_due_rule, project.payment_due_day, referenceDate);
    const current =
      groupMap.get(key) ??
      {
        key,
        projectId: cycle.project_id,
        projectName: project.project_name || cycle.project_id,
        clientName: project.client_name ?? null,
        projectStatus: project.status ?? null,
        freeePartnerId: project.freee_partner_id ?? null,
        invoiceYm,
        sourceYms: [],
        dueDate,
        dueRuleLabel: paymentDueRuleLabel(project.payment_due_rule, project.payment_due_day),
        expectedNetAmountYen: 0,
        expectedGrossAmountYen: 0,
        freeeInvoiceNumbers: [],
        cycles: [],
      };

    current.sourceYms.push(cycle.ym);
    current.cycles.push(cycle);
    current.expectedNetAmountYen += expectedNetForCycle(cycle, project);
    if (cycle.freee_invoice_number) current.freeeInvoiceNumbers.push(cycle.freee_invoice_number);
    if (cycle.ym > current.cycles[0].ym) {
      current.dueDate = computePaymentDueDateByRule(cycle.ym, project.payment_due_rule, project.payment_due_day, referenceDate);
    }
    groupMap.set(key, current);
  }

  return [...groupMap.values()]
    .map((group) => ({
      ...group,
      sourceYms: [...new Set(group.sourceYms)].sort(),
      freeeInvoiceNumbers: [...new Set(group.freeeInvoiceNumbers)].sort(),
      expectedNetAmountYen: Math.round(group.expectedNetAmountYen),
      expectedGrossAmountYen: expectedGrossFromNet(group.expectedNetAmountYen),
    }))
    .filter((group) => group.expectedNetAmountYen > 0 || group.cycles.length > 0)
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.projectId.localeCompare(b.projectId);
    });
}
