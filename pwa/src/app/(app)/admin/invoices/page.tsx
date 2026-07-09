import { createClient } from "@/lib/supabase/server";
import { AdminInvoiceIssueQueue, type BillingCycleRow, type InvoiceProjectRow, type ReimbursementRow } from "@/components/admin/AdminInvoiceIssueQueue";

function currentYm() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym: string, delta: number) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function firstDay(ym: string) {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}

function ymLabel(ym: string) {
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function parseInvoiceLines(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Array<{
      type?: string;
      quantity?: string | number;
      qty?: string | number;
      unit_price?: string | number;
      unitPrice?: string | number;
      amount?: string | number;
    }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function invoiceNetAmount(c: {
  invoice_base_lines_json?: string | null;
  budget_reported_amount?: number | string | null;
  fee_type?: string | null;
  fee_amount?: number | string | null;
}) {
  const totalFromLines = parseInvoiceLines(c.invoice_base_lines_json ?? null).reduce((sum, line) => {
    if (line.type === "text") return sum;
    const quantity = Number(line.quantity ?? line.qty ?? 1) || 1;
    const unitPrice = Number(line.unit_price ?? line.unitPrice ?? line.amount ?? 0) || 0;
    return sum + quantity * unitPrice;
  }, 0);
  if (totalFromLines > 0) return Math.round(totalFromLines);
  const reported = Number(c.budget_reported_amount ?? 0);
  if (reported > 0) return Math.round(reported);
  const fixedFee = Number(c.fee_amount ?? 0);
  if (c.fee_type === "monthly_fixed" && fixedFee > 0) return Math.round(fixedFee);
  return 0;
}

function isWithinWorkWindow(c: { ym: string }, project: InvoiceProjectRow) {
  if (project.start_ym && c.ym < project.start_ym) return false;
  if (project.end_ym && c.ym > project.end_ym) return false;
  if (project.freeze_from_ym && c.ym >= project.freeze_from_ym) return false;
  return true;
}

export default async function AdminInvoicesPage() {
  const supabase = await createClient();
  const baseYm = currentYm();
  const lastClosedYm = addMonths(baseYm, -1);
  const yms = Array.from({ length: 13 }, (_, index) => addMonths(lastClosedYm, index - 12));
  const firstYm = yms[0];
  const lastYm = yms[yms.length - 1];

  const { data: cycles, error: bcErr } = await supabase
    .from("billing_cycles")
    .select("*")
    .in("ym", yms)
    .order("ym", { ascending: false });

  const { data: projects, error: projectErr } = await supabase
    .from("projects")
    .select("project_id, project_name, status, project_type, start_ym, end_ym, freeze_from_ym, fee_type, fee_amount, freee_partner_id, monthly_report_required, monthly_report_scope")
    .in("status", ["active", "ended", "frozen"]);

  const { data: reimbursements, error: reimburseErr } = await supabase
    .from("reimbursements")
    .select("project_id, date, status")
    .gte("date", firstDay(firstYm))
    .lt("date", firstDay(addMonths(lastYm, 1)));

  const projectMap = new Map<string, InvoiceProjectRow>();
  for (const p of projects ?? []) {
    projectMap.set(p.project_id, {
      project_id: p.project_id,
      project_name: p.project_name,
      status: p.status,
      project_type: p.project_type ?? null,
      start_ym: p.start_ym ?? null,
      end_ym: p.end_ym ?? null,
      freeze_from_ym: p.freeze_from_ym ?? null,
      fee_type: p.fee_type ?? null,
      fee_amount: p.fee_amount ?? null,
      freee_partner_id: p.freee_partner_id ?? null,
      monthly_report_required: Boolean(p.monthly_report_required),
      monthly_report_scope: p.monthly_report_scope ?? "none",
    });
  }

  const rows: BillingCycleRow[] = (cycles ?? [])
    .filter((c) => {
      const project = projectMap.get(c.project_id);
      if (!project) return false;
      const amount = invoiceNetAmount({
        ...c,
        fee_type: project.fee_type,
        fee_amount: project.fee_amount,
      });
      if (c.ym > lastClosedYm) return false;
      if (!isWithinWorkWindow(c, project)) return false;
      if (amount <= 0) return false;
      return true;
    })
    .map((c) => ({
      id: c.id ?? `${c.project_id}_${c.ym}`,
      project_id: c.project_id,
      project_name: projectMap.get(c.project_id)?.project_name ?? c.project_id,
      project_type: projectMap.get(c.project_id)?.project_type ?? null,
      fee_type: projectMap.get(c.project_id)?.fee_type ?? null,
      fee_amount: projectMap.get(c.project_id)?.fee_amount ?? null,
      freee_partner_id: projectMap.get(c.project_id)?.freee_partner_id ?? null,
      monthly_report_required: projectMap.get(c.project_id)?.monthly_report_required ?? false,
      monthly_report_scope: projectMap.get(c.project_id)?.monthly_report_scope ?? "none",
      ym: c.ym,
      invoice_ym: c.invoice_ym ?? null,
      invoice_base_lines_json: c.invoice_base_lines_json ?? null,
      invoice_subject: c.invoice_subject ?? null,
      freee_invoice_number: c.freee_invoice_number ?? null,
      invoice_pdf_url: c.invoice_pdf_url ?? null,
      status: c.status ?? "not_started",
      budget_yen: c.budget_yen ?? null,
      budget_reported_amount: c.budget_reported_amount ?? null,
      budget_confirmed_at: c.budget_confirmed_at ?? null,
      meeting_event_id: c.meeting_event_id ?? null,
      meeting_start_at: c.meeting_start_at ?? null,
      report_fixed_at: c.report_fixed_at ?? null,
      invoice_issued_at: c.invoice_issued_at ?? null,
      invoice_sent_at: c.invoice_sent_at ?? null,
      payout_notice_uploaded_at: c.payout_notice_uploaded_at ?? null,
      payment_confirmed_at: c.payment_confirmed_at ?? null,
      reward_paid_at: c.reward_paid_at ?? null,
    }));

  const reimbursementRows: ReimbursementRow[] = (reimbursements ?? []).map((r) => ({
    project_id: r.project_id,
    date: r.date,
    status: r.status ?? null,
  }));

  if (bcErr) console.error("AdminInvoicesPage:", bcErr.message);
  if (projectErr) console.error("AdminInvoicesPage projects:", projectErr.message);
  if (reimburseErr) console.error("AdminInvoicesPage reimbursements:", reimburseErr.message);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-lg font-semibold">請求書発行</h1>
        <span className="text-sm text-muted-foreground">{ymLabel(firstYm)}〜{ymLabel(lastYm)} 稼働分 — {rows.length} 件</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        締め済みで請求額がある稼働分だけを表示し、発行待ちから freee 発行まで進める。設定不足やきよ確認が残るものは、発行待ちとは分けて扱う。
      </p>
      <AdminInvoiceIssueQueue cycles={rows} reimbursements={reimbursementRows} targetYm={lastClosedYm} />
    </div>
  );
}
