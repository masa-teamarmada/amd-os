export const KIYO_ACCOUNTING_EMAIL = "keiri@team-armada.jp";

export type KiyoProjectInput = { project_id: string; project_name: string; client_name?: string | null; status?: string | null };
export type KiyoPayoutCycleInput = { project_id: string; reward_summary_json?: unknown };
export type KiyoPayoutEntryInput = { project_id: string; total_pay?: number | string | null };
export type KiyoBillingCycleInput = { project_id: string; invoice_sent_at?: string | null; invoice_sent_by?: string | null };
export type KiyoBillingLogInput = { project_id: string; action?: string | null; actor?: string | null };
export type KiyoReimbursementInput = { reimbursement_id: string; project_id: string; status?: string | null };
export type KiyoCellState = "done" | "attention" | "pending" | "empty" | "unknown";

export type KiyoOverviewRow = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  payout: { state: KiyoCellState; amountYen: number | null; label: string };
  reimbursement: { state: KiyoCellState; totalCount: number | null; pendingCount: number | null; label: string };
  invoice: { state: KiyoCellState; sentAt: string | null; label: string };
};

export type BuildKiyoOverviewInput = {
  projects: KiyoProjectInput[];
  payoutCycles: KiyoPayoutCycleInput[];
  payoutEntries: KiyoPayoutEntryInput[];
  billingCycles: KiyoBillingCycleInput[];
  billingLogs: KiyoBillingLogInput[];
  reimbursements: KiyoReimbursementInput[];
  availability: { payout: boolean; billing: boolean; billingLogs: boolean; reimbursements: boolean };
};

const CLOSED_REIMBURSEMENT_STATUSES = new Set(["approved", "rejected", "paid"]);

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function hasRewardSummary(value: unknown): boolean {
  if (typeof value === "string") {
    try {
      return hasRewardSummary(JSON.parse(value));
    } catch {
      return false;
    }
  }
  return Boolean(value && typeof value === "object" && Array.isArray((value as { members?: unknown }).members));
}

function numeric(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function billingLogHasKiyoEvidence(log: KiyoBillingLogInput): boolean {
  if (normalize(log.actor) !== KIYO_ACCOUNTING_EMAIL) return false;
  const action = normalize(log.action);
  const isInvoiceAction = action.includes("invoice") || action.includes("請求");
  const isSentAction = action.includes("sent") || action.includes("send") || action.includes("送付");
  return isInvoiceAction && isSentAction;
}

function payoutCell(projectId: string, cycles: KiyoPayoutCycleInput[], entries: KiyoPayoutEntryInput[], available: boolean): KiyoOverviewRow["payout"] {
  if (!available) return { state: "unknown", amountYen: null, label: "取得失敗" };
  const projectCycles = cycles.filter((cycle) => cycle.project_id === projectId);
  if (projectCycles.length === 0 || projectCycles.some((cycle) => !hasRewardSummary(cycle.reward_summary_json))) {
    return { state: "unknown", amountYen: null, label: "未取得" };
  }
  const amountYen = Math.round(entries.filter((entry) => entry.project_id === projectId).reduce((sum, entry) => sum + numeric(entry.total_pay), 0));
  return { state: "done", amountYen, label: amountYen === 0 ? "支払なし" : "集計済み" };
}

function reimbursementCell(projectId: string, rows: KiyoReimbursementInput[], available: boolean): KiyoOverviewRow["reimbursement"] {
  if (!available) return { state: "unknown", totalCount: null, pendingCount: null, label: "取得失敗" };
  const projectRows = rows.filter((row) => row.project_id === projectId);
  if (projectRows.length === 0) return { state: "empty", totalCount: 0, pendingCount: 0, label: "対象なし" };
  const pendingCount = projectRows.filter((row) => !CLOSED_REIMBURSEMENT_STATUSES.has(normalize(row.status))).length;
  return pendingCount > 0
    ? { state: "pending", totalCount: projectRows.length, pendingCount, label: `要対応 ${pendingCount}件` }
    : { state: "done", totalCount: projectRows.length, pendingCount: 0, label: `完了 ${projectRows.length}件` };
}

function invoiceCell(projectId: string, cycles: KiyoBillingCycleInput[], logs: KiyoBillingLogInput[], billingAvailable: boolean, logsAvailable: boolean): KiyoOverviewRow["invoice"] {
  if (!billingAvailable) return { state: "unknown", sentAt: null, label: "取得失敗" };
  const cycle = cycles.find((row) => row.project_id === projectId);
  if (!cycle) return { state: "unknown", sentAt: null, label: "未登録" };
  if (!cycle.invoice_sent_at) return { state: "pending", sentAt: null, label: "未送付" };
  if (normalize(cycle.invoice_sent_by) === KIYO_ACCOUNTING_EMAIL) return { state: "done", sentAt: cycle.invoice_sent_at, label: "経理確認" };
  if (!logsAvailable) return { state: "unknown", sentAt: cycle.invoice_sent_at, label: "証跡未取得" };
  const hasLogEvidence = logs.some((log) => log.project_id === projectId && billingLogHasKiyoEvidence(log));
  return hasLogEvidence
    ? { state: "done", sentAt: cycle.invoice_sent_at, label: "経理確認" }
    : { state: "attention", sentAt: cycle.invoice_sent_at, label: "要確認" };
}

export function buildKiyoOverviewRows(input: BuildKiyoOverviewInput): KiyoOverviewRow[] {
  return input.projects
    .filter((project) => normalize(project.status) === "active")
    .sort((a, b) => a.project_name.localeCompare(b.project_name, "ja"))
    .map((project) => ({
      projectId: project.project_id,
      projectName: project.project_name,
      clientName: project.client_name ?? null,
      payout: payoutCell(project.project_id, input.payoutCycles, input.payoutEntries, input.availability.payout),
      reimbursement: reimbursementCell(project.project_id, input.reimbursements, input.availability.reimbursements),
      invoice: invoiceCell(project.project_id, input.billingCycles, input.billingLogs, input.availability.billing, input.availability.billingLogs),
    }));
}
