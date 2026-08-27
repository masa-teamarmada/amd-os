/**
 * 「請求書」— 状態を読むだけ。
 *
 * billing_cycles に本体が書いた請求書の状態（freee番号 / 発行日 / 送付日 / 入金確認日）を
 * そのまま読む。金額も本体が確定させた budget_yen をそのまま出す。
 *
 * ⚠️ 発行はここでやらない。freee に実際の請求書を作る操作なので本体
 *    （/admin/kiyo?task=invoices）の責務。ここは確認専用。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { cleanYm, shiftYm } from "@/lib/ym";

export const runtime = "nodejs";

type CycleRow = {
  project_id: string;
  ym: string;
  status: string | null;
  budget_yen: number | string | null;
  invoice_ym: string | null;
  invoice_subject: string | null;
  invoice_issued_at: string | null;
  invoice_sent_at: string | null;
  freee_invoice_number: string | null;
  payment_confirmed_at: string | null;
};

type ProjectRow = {
  project_id: string;
  project_name: string | null;
  client_name: string | null;
};

function yenValue(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const ym = cleanYm(req.nextUrl.searchParams.get("ym"));
  if (!ym) {
    return NextResponse.json({ ok: false, error: "valid ym is required" }, { status: 400 });
  }
  // 対象月とその前後1ヶ月を出す。請求月と稼働月がずれる案件を取りこぼさないため。
  const yms = [shiftYm(ym, -1), ym, shiftYm(ym, 1)];

  try {
    const db = createAdminClient();
    const [cyclesRes, projectsRes] = await Promise.all([
      db
        .from("billing_cycles")
        .select(
          "project_id, ym, status, budget_yen, invoice_ym, invoice_subject, invoice_issued_at, invoice_sent_at, freee_invoice_number, payment_confirmed_at"
        )
        .in("ym", yms)
        .order("ym", { ascending: false }),
      db.from("projects").select("project_id, project_name, client_name"),
    ]);
    if (cyclesRes.error) throw cyclesRes.error;
    if (projectsRes.error) throw projectsRes.error;

    const projectById = new Map<string, ProjectRow>();
    for (const project of (projectsRes.data ?? []) as ProjectRow[]) {
      projectById.set(project.project_id, project);
    }

    const rows = ((cyclesRes.data ?? []) as CycleRow[]).map((cycle) => {
      const project = projectById.get(cycle.project_id);
      return {
        projectId: cycle.project_id,
        projectName: project?.project_name || project?.client_name || cycle.project_id,
        clientName: project?.client_name ?? null,
        ym: cycle.ym,
        invoiceYm: cycle.invoice_ym,
        status: cycle.status,
        amountYen: yenValue(cycle.budget_yen),
        subject: cycle.invoice_subject,
        freeeInvoiceNumber: cycle.freee_invoice_number,
        issuedAt: cycle.invoice_issued_at,
        sentAt: cycle.invoice_sent_at,
        paymentConfirmedAt: cycle.payment_confirmed_at,
      };
    });

    return NextResponse.json({
      ok: true,
      ym,
      rows,
      summary: {
        cycleCount: rows.length,
        issuedCount: rows.filter((row) => row.issuedAt).length,
        sentCount: rows.filter((row) => row.sentAt).length,
        paidCount: rows.filter((row) => row.paymentConfirmedAt).length,
        totalAmountYen: rows.reduce((sum, row) => sum + row.amountYen, 0),
      },
    });
  } catch (err) {
    console.error("[kiyo invoices GET]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
