/**
 * GET /api/invoice/preview?projectId=xxx&ym=202604
 * 請求書プレビューデータを取得
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/supabase/api-auth";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const ym = searchParams.get("ym");

    if (!projectId || !ym) {
      return NextResponse.json({ error: "projectId and ym required" }, { status: 400 });
    }

    // プロジェクト情報
    const { data: project } = await supabase
      .from("projects")
      .select("project_id, project_name, client_name, freee_partner_id")
      .eq("project_id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // BillingCycle
    const { data: bc } = await supabase
      .from("billing_cycles")
      .select("*")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .single();

    // デフォルト日付計算
    const year = parseInt(ym.slice(0, 4));
    const month = parseInt(ym.slice(4));
    const lastDay = new Date(year, month, 0).getDate();
    const defaultIssueDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

    // 翌月末
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextLastDay = new Date(nextYear, nextMonth, 0).getDate();
    const defaultDueDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${nextLastDay}`;

    const budget = bc?.budget_yen || 0;
    const alreadyIssued = !!bc?.invoice_issued_at;

    return NextResponse.json({
      ok: true,
      projectId,
      ym,
      projectName: project.project_name,
      clientName: project.client_name || "",
      budget,
      hasFreeeSettings: !!project.freee_partner_id,
      freeePartnerId: project.freee_partner_id,
      alreadyIssued,
      invoiceIssuedAt: bc?.invoice_issued_at || null,
      invoiceSentAt: bc?.invoice_sent_at || null,
      freeeInvoiceNumber: bc?.freee_invoice_number || null,
      defaultIssueDate,
      defaultDueDate,
      baseLines: [
        {
          description: `${project.project_name} ${ym.slice(0, 4)}年${parseInt(ym.slice(4))}月 業務委託報酬`,
          quantity: 1,
          unitPrice: budget,
        },
      ],
    });
  } catch (err) {
    console.error("Invoice preview error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
