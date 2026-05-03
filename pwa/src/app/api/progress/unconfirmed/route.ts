import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/supabase/api-auth";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function prevYm(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const pm = m - 1 < 1 ? 12 : m - 1;
  const py = m - 1 < 1 ? y - 1 : y;
  return `${py}${String(pm).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const ym = searchParams.get("ym");
  if (!projectId || !ym) {
    return NextResponse.json({ error: "projectId, ym required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const pym = prevYm(ym);

  // アクティブなMSを取得
  const { data: pcRows } = await supabase
    .from("value_plan_cycles")
    .select("plan_cycle_id")
    .eq("project_id", projectId)
    .in("status", ["active", "confirmed", "fixed", "draft"])
    .lte("period_start_ym", ym)
    .gte("period_end_ym", ym)
    .order("period_start_ym", { ascending: false })
    .limit(1);

  if (!pcRows || pcRows.length === 0) {
    return NextResponse.json({ ok: true, unconfirmed: [] });
  }

  const { data: msRows } = await supabase
    .from("value_milestones")
    .select("milestone_id, tag")
    .eq("plan_cycle_id", pcRows[0].plan_cycle_id)
    .eq("is_active", true);

  const msKeys = (msRows || [])
    .filter((m) => m.tag !== "routine")
    .map((m) => m.milestone_id);

  if (msKeys.length === 0) {
    return NextResponse.json({ ok: true, unconfirmed: [] });
  }

  // 当月のtsukuyomi_estimateレコードを取得
  const { data: currRows } = await supabase
    .from("milestone_monthly_progress")
    .select("milestone_key, progress_pct, note, confirmed_at")
    .in("milestone_key", msKeys)
    .eq("ym", ym)
    .eq("source", "tsukuyomi_estimate");

  if (!currRows || currRows.length === 0) {
    return NextResponse.json({ ok: true, unconfirmed: [] });
  }

  // 前月の確定進捗を取得（prevPct計算用）
  const unconfirmedKeys = currRows.map((r) => r.milestone_key);
  const { data: prevRows } = await supabase
    .from("milestone_monthly_progress")
    .select("milestone_key, progress_pct")
    .in("milestone_key", unconfirmedKeys)
    .lte("ym", pym)
    .order("ym", { ascending: false });

  const prevMap: Record<string, number> = {};
  for (const p of prevRows || []) {
    if (prevMap[p.milestone_key] == null) {
      prevMap[p.milestone_key] = Number(p.progress_pct || 0);
    }
  }

  const unconfirmed = currRows.map((r) => ({
    milestoneKey: r.milestone_key,
    progressPct: Number(r.progress_pct || 0),
    prevPct: prevMap[r.milestone_key] || 0,
    reason: r.note || "",
    confirmedAt: r.confirmed_at || "",
  }));

  return NextResponse.json({ ok: true, unconfirmed });
}
