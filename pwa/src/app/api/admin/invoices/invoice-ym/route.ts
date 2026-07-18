import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * PWA invoice queue uses the logged-in admin's RLS session for invoice_ym.
 * Keep the native client on this same bearer-authenticated path: no service
 * role, no anonymous fallback, and no native direct-table write.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const projectId = text(body.projectId);
  const ym = text(body.ym);
  if (!projectId || projectId.length > 120 || !/^\d{6}$/.test(ym)) {
    return NextResponse.json({ ok: false, error: "projectId and ym are required" }, { status: 400 });
  }

  // Match the PWA queue's existing input behavior exactly: non-digits are
  // removed, at most six digits are saved, and blank restores the work month.
  const rawInvoiceYm = typeof body.invoiceYm === "string" ? body.invoiceYm : "";
  const invoiceYm = rawInvoiceYm.replace(/\D/g, "").slice(0, 6) || ym;

  const { data, error } = await auth.supabase
    .from("billing_cycles")
    .update({ invoice_ym: invoiceYm })
    .eq("project_id", projectId)
    .eq("ym", ym)
    .select("id, project_id, ym, invoice_ym");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length !== 1) {
    return NextResponse.json(
      { ok: false, error: data?.length ? "対象請求月が重複しているよ" : "対象請求月が見つからないよ" },
      { status: data?.length ? 409 : 404 }
    );
  }

  const row = data[0];
  return NextResponse.json({
    ok: true,
    updatedCycle: {
      id: row.id,
      projectId: row.project_id,
      ym: row.ym,
      invoiceYm: row.invoice_ym,
    },
  });
}
