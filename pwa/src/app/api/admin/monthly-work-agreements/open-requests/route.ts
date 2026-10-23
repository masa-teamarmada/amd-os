import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

/** 管理者の画面上部に、未対応の月初合意修正要望を常時見せるための軽い読取口。 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const admin = createAdminClient();
  const rows: Array<{ ym: string; member_id: string }> = [];
  let total = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data, count, error } = await admin
      .from("member_monthly_work_agreement_requests")
      .select("ym, member_id", { count: "exact" })
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 999);
    if (error) return NextResponse.json({ ok: false, error: "修正要望を取得できませんでした" }, { status: 500 });
    total = count ?? 0;
    rows.push(...(data ?? []));
    if (rows.length >= total || !data?.length) break;
  }
  const monthMap = new Map<string, { ym: string; count: number; memberId: string | null }>();
  for (const row of rows) {
    const entry = monthMap.get(row.ym) ?? { ym: row.ym, count: 0, memberId: row.member_id };
    entry.count += 1;
    if (entry.count > 1) entry.memberId = null;
    monthMap.set(row.ym, entry);
  }
  return NextResponse.json({
    ok: true,
    count: total,
    months: [...monthMap.values()].sort((a, b) => b.ym.localeCompare(a.ym)),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
