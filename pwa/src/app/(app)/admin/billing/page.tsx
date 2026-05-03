import { createClient } from "@/lib/supabase/server";
import { AdminBillingMatrix, type BillingCycleRow, type BillingProjectRow, type ReimbursementRow } from "@/components/admin/AdminBillingMatrix";

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

export default async function AdminBillingPage() {
  const supabase = await createClient();
  const baseYm = currentYm();
  const yms = Array.from({ length: 13 }, (_, index) => addMonths(baseYm, index - 11));
  const firstYm = yms[0];
  const lastYm = yms[yms.length - 1];

  const { data: cycles, error: bcErr } = await supabase
    .from("billing_cycles")
    .select("*")
    .in("ym", yms)
    .order("ym", { ascending: false });

  const { data: projects, error: projectErr } = await supabase
    .from("projects")
    .select("project_id, project_name, status, project_type, end_ym")
    .in("status", ["active", "ended", "frozen"]);

  const { data: reimbursements, error: reimburseErr } = await supabase
    .from("reimbursements")
    .select("project_id, date, status")
    .gte("date", firstDay(firstYm))
    .lt("date", firstDay(addMonths(lastYm, 1)));

  const projectMap = new Map<string, BillingProjectRow>();
  for (const p of projects ?? []) {
    projectMap.set(p.project_id, {
      project_id: p.project_id,
      project_name: p.project_name,
      status: p.status,
      project_type: p.project_type ?? null,
      end_ym: p.end_ym ?? null,
    });
  }

  const rows: BillingCycleRow[] = (cycles ?? [])
    .filter((c) => {
      const project = projectMap.get(c.project_id);
      if (!project) return false;
      const status = (project.status || "").toLowerCase();
      if (status === "active" || status === "frozen") return true;
      if (status === "ended" && project.end_ym) return c.ym <= project.end_ym;
      return false;
    })
    .map((c) => ({
      id: c.id ?? `${c.project_id}_${c.ym}`,
      project_id: c.project_id,
      project_name: projectMap.get(c.project_id)?.project_name ?? c.project_id,
      project_type: projectMap.get(c.project_id)?.project_type ?? null,
      ym: c.ym,
      invoice_ym: c.invoice_ym ?? null,
      invoice_base_lines_json: c.invoice_base_lines_json ?? null,
      invoice_subject: c.invoice_subject ?? null,
      status: c.status ?? "not_started",
      budget_yen: c.budget_yen ?? null,
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

  if (bcErr) console.error("AdminBillingPage:", bcErr.message);
  if (projectErr) console.error("AdminBillingPage projects:", projectErr.message);
  if (reimburseErr) console.error("AdminBillingPage reimbursements:", reimburseErr.message);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-lg font-semibold">Billing Matrix</h1>
        <span className="text-sm text-muted-foreground">billing_cycles — {rows.length} 件</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">直近13か月</p>
      <AdminBillingMatrix cycles={rows} reimbursements={reimbursementRows} />
    </div>
  );
}
