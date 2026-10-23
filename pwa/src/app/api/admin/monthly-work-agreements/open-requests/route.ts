import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

/** 管理者の画面上部に、未対応の月初合意修正要望を常時見せるための軽い読取口。 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { data, count, error } = await createAdminClient()
    .from("member_monthly_work_agreement_requests")
    .select("ym, member_id", { count: "exact" })
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return NextResponse.json({ ok: false, error: "修正要望を取得できませんでした" }, { status: 500 });
  return NextResponse.json({
    ok: true,
    count: count ?? 0,
    latest: data?.[0] ?? null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
