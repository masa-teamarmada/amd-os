/**
 * POST /api/progress/batch-save
 * 複数MSの進捗をまとめて保存（Editモード）
 * body: { projectId, ym, milestones: [{milestoneKey, progressPct}] }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/supabase/api-auth";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json();
  const { projectId: _projectId, ym, milestones } = body;

  if (!ym || !Array.isArray(milestones)) {
    return NextResponse.json({ error: "ym and milestones required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  let saved = 0;
  for (const item of milestones) {
    const { milestoneKey, progressPct } = item;
    if (!milestoneKey || progressPct === undefined) continue;

    const adjustedPct = Math.max(0, Math.min(100, Number(progressPct)));

    const { data: msRows } = await supabase
      .from("value_milestones")
      .select("points")
      .eq("milestone_id", milestoneKey)
      .limit(1);
    const points = Number(msRows?.[0]?.points || 0);
    const consumedPt = Math.round(points * adjustedPct / 100 * 100) / 100;

    const { error } = await supabase
      .from("milestone_monthly_progress")
      .upsert(
        {
          milestone_key: milestoneKey,
          ym,
          progress_pct: adjustedPct,
          consumed_pt: consumedPt,
          source: "pm_manual",
          confirmed_at: now,
          note: "一括編集",
        },
        { onConflict: "milestone_key,ym" }
      );

    if (!error) saved++;
  }

  return NextResponse.json({ ok: true, saved });
}
