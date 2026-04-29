import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingRow } from "@/types/dashboard";

export interface BillingDetail {
  id: string;
  project_id: string;
  ym: string;
  status: string;
  budget_total: number | null;
  budget_confirmed_at: string | null;
  budget_reported_amount: number | null;
  fixed_total_yen: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceDetail {
  id: string;
  billing_cycle_id: string;
  invoice_ym: string | null;
  freee_invoice_id: string | null;
  freee_invoice_no: string | null;
  pdf_url: string | null;
  issued_at: string | null;
  sent_at: string | null;
  status: string | null;
}

export interface PaymentDetail {
  billing_cycle_id: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  note: string | null;
}

export interface MeetingDetail {
  billing_cycle_id: string;
  start_at: string | null;
  end_at: string | null;
  html_link: string | null;
  skipped: boolean;
}

export interface ProjectInfo {
  id: string;
  project_code: string;
  name: string;
  client_name: string | null;
  freee_partner_id: string | null;
  freee_invoice_template_id: string | null;
  payment_due_rule: string | null;
}

/** 全PJの billing dashboard（指定月） */
export async function getBillingDashboard(
  supabase: SupabaseClient,
  ym: string
): Promise<BillingRow[]> {
  const { data } = await supabase
    .from("v_billing_dashboard")
    .select("*")
    .eq("ym", ym)
    .order("project_code");
  return (data ?? []) as BillingRow[];
}

/** 指定PJの billing cycles（直近12ヶ月） */
export async function getProjectBillingHistory(
  supabase: SupabaseClient,
  projectCode: string,
  limit = 12
) {
  // project_code → project_id
  const { data: project } = await supabase
    .from("projects")
    .select("id, project_code, name, client_name, freee_partner_id, freee_invoice_template_id, payment_due_rule")
    .eq("project_code", projectCode)
    .single();

  if (!project) return { project: null, cycles: [] };

  const { data: cycles } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("project_id", project.id)
    .order("ym", { ascending: false })
    .limit(limit);

  // 各cycleの invoice + payment + meeting を取得
  const cycleIds = (cycles ?? []).map((c) => c.id);

  const [invoicesRes, paymentsRes, meetingsRes] = await Promise.all([
    cycleIds.length
      ? supabase.from("invoices").select("*").in("billing_cycle_id", cycleIds)
      : { data: [] },
    cycleIds.length
      ? supabase.from("payment_confirmations").select("*").in("billing_cycle_id", cycleIds)
      : { data: [] },
    cycleIds.length
      ? supabase.from("billing_meetings").select("*").in("billing_cycle_id", cycleIds)
      : { data: [] },
  ]);

  const invoiceMap = new Map(
    (invoicesRes.data ?? []).map((i) => [i.billing_cycle_id, i])
  );
  const paymentMap = new Map(
    (paymentsRes.data ?? []).map((p) => [p.billing_cycle_id, p])
  );
  const meetingMap = new Map(
    (meetingsRes.data ?? []).map((m) => [m.billing_cycle_id, m])
  );

  const enriched = (cycles ?? []).map((c) => ({
    ...c,
    invoice: invoiceMap.get(c.id) || null,
    payment: paymentMap.get(c.id) || null,
    meeting: meetingMap.get(c.id) || null,
  }));

  return { project: project as ProjectInfo, cycles: enriched };
}

// ─── 請求書ウィザード用 ───

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
}

/** 前月のym（"YYYY-MM"） */
function prevYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 月番号インクリメント: 説明文中の「N月分」を+1する
 * "2026年3月分　業務委託費" → "2026年4月分　業務委託費"
 * "12月分" → "1月分"（年もインクリメント）
 */
function incrementMonthInDescription(desc: string, targetYm: string): string {
  const [y, m] = targetYm.split("-").map(Number);
  // "YYYY年M月分" パターン
  const fullPattern = /(\d{4})年(\d{1,2})月分/;
  if (fullPattern.test(desc)) {
    return desc.replace(fullPattern, `${y}年${m}月分`);
  }
  // "M月分" パターン（年なし）
  const shortPattern = /(\d{1,2})月分/;
  if (shortPattern.test(desc)) {
    return desc.replace(shortPattern, `${m}月分`);
  }
  return desc;
}

/** 前月の請求書明細を取得してプレフィル用に加工 */
export async function getInvoicePrefill(
  supabase: SupabaseClient,
  projectId: string,
  ym: string
): Promise<{
  base_lines: InvoiceLine[];
  subject: string;
  remark: string;
  reimb_prefix: string;
}> {
  const prev = prevYm(ym);

  // 前月のbilling_cycle
  const { data: prevCycle } = await supabase
    .from("billing_cycles")
    .select("invoice_base_lines_json, invoice_subject, invoice_remark, invoice_reimb_prefix")
    .eq("project_id", projectId)
    .eq("ym", prev)
    .single();

  // プロジェクトのテンプレート（fallback）
  const { data: project } = await supabase
    .from("projects")
    .select("invoice_base_lines_template_json, client_name, name")
    .eq("id", projectId)
    .single();

  let baseLines: InvoiceLine[] = [];
  let subject = "";
  let remark = "";
  let reimbPrefix = "[立替]";

  // 前月のデータがあれば使う
  if (prevCycle?.invoice_base_lines_json) {
    const raw = prevCycle.invoice_base_lines_json;
    const arr = Array.isArray(raw) ? raw : [];
    baseLines = arr.map((l: Record<string, unknown>) => ({
      description: incrementMonthInDescription(String(l.description || ""), ym),
      quantity: Number(l.quantity || 1),
      unit_price: Number(l.unit_price || 0),
    }));
    subject = prevCycle.invoice_subject
      ? incrementMonthInDescription(String(prevCycle.invoice_subject), ym)
      : "";
    remark = String(prevCycle.invoice_remark || "");
    reimbPrefix = String(prevCycle.invoice_reimb_prefix || "[立替]");
  }
  // プロジェクトテンプレートでfallback
  else if (project?.invoice_base_lines_template_json) {
    const raw = project.invoice_base_lines_template_json;
    const arr = Array.isArray(raw) ? raw : [];
    baseLines = arr.map((l: Record<string, unknown>) => ({
      description: incrementMonthInDescription(String(l.description || ""), ym),
      quantity: Number(l.quantity || 1),
      unit_price: Number(l.unit_price || 0),
    }));
  }

  // fallback: デフォルト明細
  if (baseLines.length === 0) {
    const [y, m] = ym.split("-").map(Number);
    const clientName = project?.client_name || project?.name || "";
    baseLines = [
      {
        description: `${y}年${m}月分　業務委託費`,
        quantity: 1,
        unit_price: 0,
      },
    ];
    if (!subject && clientName) {
      subject = `${clientName} ${y}年${m}月分　業務委託費`;
    }
  }

  return { base_lines: baseLines, subject, remark, reimb_prefix: reimbPrefix };
}

/** 入金待ちサイクル一覧 */
export async function getPaymentPendingList(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("v_billing_dashboard")
    .select("*")
    .eq("status", "invoiced")
    .order("ym", { ascending: false });
  return (data ?? []) as BillingRow[];
}
