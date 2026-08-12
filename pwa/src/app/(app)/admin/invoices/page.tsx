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

function ymLabel(ym: string) {
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function ymFromDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[1]}${match[2]}` : null;
}

function arrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function isWithinWorkWindow(c: { ym: string }, project: InvoiceProjectRow) {
  if (project.start_ym && c.ym < project.start_ym) return false;
  if (project.end_ym && c.ym > project.end_ym) return false;
  if (project.freeze_from_ym && c.ym >= project.freeze_from_ym) return false;
  return true;
}

export default async function AdminInvoicesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const currentEmail = authData.user?.email?.toLowerCase() ?? "";
  const baseYm = currentYm();
  const lastClosedYm = addMonths(baseYm, -1);
  const yms = Array.from({ length: 13 }, (_, index) => addMonths(lastClosedYm, index - 12));
  const firstYm = yms[0] ?? lastClosedYm;
  const lastYm = yms[yms.length - 1] ?? lastClosedYm;

  const { data: cycles, error: bcErr } = await supabase
    .from("billing_cycles")
    .select("*")
    .in("ym", yms)
    .order("ym", { ascending: false });

  const { data: projects, error: projectErr } = await supabase
    .from("projects")
    .select("project_id, project_name, client_name, status, project_type, start_ym, end_ym, freeze_from_ym, fee_type, fee_amount, freee_partner_id, monthly_report_required, monthly_report_scope, contract_terms_json, payment_due_rule, payment_due_day")
    .in("status", ["active", "ended", "frozen"]);

  const { data: activeMembers } = await supabase
    .from("members")
    .select("member_id, email, code_name, is_admin, status")
    .eq("status", "active");
  const currentMember = (activeMembers ?? []).find((member) => String(member.email ?? "").toLowerCase() === currentEmail) ?? null;
  const memberLabelByEmail = new Map(
    (activeMembers ?? []).map((member) => [String(member.email ?? "").toLowerCase(), member.code_name || "メンバー"]),
  );

  const projectMap = new Map<string, InvoiceProjectRow>();
  for (const p of projects ?? []) {
    projectMap.set(p.project_id, {
      project_id: p.project_id,
      project_name: p.project_name,
      client_name: p.client_name ?? null,
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
      contract_terms_json: p.contract_terms_json ?? null,
      payment_due_rule: p.payment_due_rule ?? null,
      payment_due_day: p.payment_due_day ?? null,
    });
  }

  const projectIds = Array.from(projectMap.keys());
  const { data: pmMemberships } = currentMember && projectIds.length
    ? await supabase
        .from("project_members")
        .select("project_id")
        .eq("member_id", currentMember.member_id)
        .eq("is_active", true)
        .eq("is_pm", true)
        .in("project_id", projectIds)
    : { data: [] };
  const viewerPmProjectIds = (pmMemberships ?? []).map((row) => String(row.project_id));

  const { data: reimbursements, error: reimburseErr } = projectIds.length
    ? await supabase
        .from("reimbursements")
        .select("reimbursement_id, project_id, project_name, date, category, amount, tax_rate, description, status, created_by, pm_approved_by, pm_approved_at, admin_approved_by, admin_approved_at, billed_ym, receipt_storage_paths, receipt_file_names, receipt_drive_links")
        .in("project_id", projectIds)
    : { data: [], error: null };
  if (reimburseErr) console.error("AdminInvoicesPage reimbursements:", reimburseErr.message);

  const reimbursementsByProjectYm = new Map<string, ReimbursementRow[]>();
  for (const r of reimbursements ?? []) {
    const ym = /^\d{6}$/.test(r.billed_ym ?? "") ? r.billed_ym! : ymFromDate(r.date);
    if (!ym || !yms.includes(ym)) continue;
    const key = `${r.project_id}_${ym}`;
    const list = reimbursementsByProjectYm.get(key) ?? [];
    list.push({
      reimbursement_id: r.reimbursement_id,
      project_id: r.project_id,
      date: r.date ?? null,
      category: r.category ?? null,
      amount: r.amount ?? 0,
      description: r.description ?? null,
      status: r.status ?? "submitted",
      created_by_label: memberLabelByEmail.get(String(r.created_by ?? "").toLowerCase()) ?? "メンバー",
      receipt_count: Math.max(
        arrayCount(r.receipt_storage_paths),
        arrayCount(r.receipt_file_names),
        arrayCount(r.receipt_drive_links),
      ),
      ym,
    });
    reimbursementsByProjectYm.set(key, list);
  }

  const cycleMap = new Map((cycles ?? []).map((cycle) => [`${cycle.project_id}_${cycle.ym}`, cycle]));
  const rows: BillingCycleRow[] = Array.from(projectMap.values()).flatMap((project) =>
    yms.filter((ym) => isWithinWorkWindow({ ym }, project)).map((ym) => {
      const c = cycleMap.get(`${project.project_id}_${ym}`);
      return {
        id: c?.id ?? `missing_${project.project_id}_${ym}`,
        cycle_exists: Boolean(c),
        project_id: project.project_id,
        project_name: project.project_name,
        client_name: project.client_name,
        project_type: project.project_type,
        fee_type: project.fee_type,
        fee_amount: project.fee_amount,
        start_ym: project.start_ym,
        end_ym: project.end_ym,
        contract_terms_json: project.contract_terms_json ?? null,
        payment_due_rule: project.payment_due_rule,
        payment_due_day: project.payment_due_day,
        freee_partner_id: project.freee_partner_id,
        monthly_report_required: project.monthly_report_required,
        monthly_report_scope: project.monthly_report_scope,
        ym,
        invoice_ym: c?.invoice_ym ?? null,
        invoice_base_lines_json: c?.invoice_base_lines_json ?? null,
        invoice_subject: c?.invoice_subject ?? null,
        freee_invoice_number: c?.freee_invoice_number ?? null,
        invoice_pdf_url: c?.invoice_pdf_url ?? null,
        status: c?.status ?? "not_started",
        budget_reported_amount: c?.budget_reported_amount ?? null,
        budget_confirmed_at: c?.budget_confirmed_at ?? null,
        meeting_event_id: c?.meeting_event_id ?? null,
        meeting_start_at: c?.meeting_start_at ?? null,
        report_fixed_at: c?.report_fixed_at ?? null,
        invoice_issued_at: c?.invoice_issued_at ?? null,
        invoice_sent_at: c?.invoice_sent_at ?? null,
        payout_notice_uploaded_at: c?.payout_notice_uploaded_at ?? null,
        payment_confirmed_at: c?.payment_confirmed_at ?? null,
        reward_paid_at: c?.reward_paid_at ?? null,
        reimbursements: (reimbursementsByProjectYm.get(`${project.project_id}_${ym}`) ?? [])
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      };
    })
  );

  if (bcErr) console.error("AdminInvoicesPage:", bcErr.message);
  if (projectErr) console.error("AdminInvoicesPage projects:", projectErr.message);

  return (
    <div>
      {embedded ? (
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          {ymLabel(firstYm)}〜{ymLabel(lastYm)} 稼働分 — {rows.length} 件。契約、請求実績、全立替を照合し、発行条件がそろった月をここから発行。
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-4">
            <h1 className="text-lg font-semibold">請求書発行</h1>
            <span className="text-sm text-muted-foreground">{ymLabel(firstYm)}〜{ymLabel(lastYm)} 稼働分 — {rows.length} 件</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            契約条件、13か月の請求実績、当月の全立替を同じ作業面で照合し、必要な承認を終えて freee 発行まで進める。
          </p>
        </>
      )}
      <AdminInvoiceIssueQueue
        cycles={rows}
        targetYm={lastClosedYm}
        viewerIsAdmin={Boolean(currentMember?.is_admin)}
        viewerPmProjectIds={viewerPmProjectIds}
      />
    </div>
  );
}
