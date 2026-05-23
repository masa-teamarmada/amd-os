import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { syncRewardSummaryForCycle } from "@/lib/reward-summary";

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

async function jsonWithRewardSync(
  supabase: ReturnType<typeof getServiceClient>,
  projectId: string,
  ym: string,
  payload: Record<string, unknown>
) {
  try {
    const result = await syncRewardSummaryForCycle(supabase, projectId, ym);
    return NextResponse.json({ ...payload, rewardSummary: result.rewardSummary });
  } catch (err) {
    return NextResponse.json({
      ...payload,
      rewardSummary: null,
      rewardSyncError: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * POST /api/progress/confirm
 * GAS cockpit_api_handleEstimateAction に相当
 * body: { projectId, ym, milestoneKey, action: "adopt"|"reject"|"modify", reason?, newPct? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json();
  const { projectId, ym, milestoneKey, action, reason, newPct } = body;

  if (!projectId || !ym || !milestoneKey || !action) {
    return NextResponse.json({ error: "projectId, ym, milestoneKey, action required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  // 現在の tsukuyomi_estimate レコードを取得（manual 以外で必要）
  const { data: currRows } = await supabase
    .from("milestone_monthly_progress")
    .select("milestone_key, progress_pct, consumed_pt, note")
    .eq("milestone_key", milestoneKey)
    .eq("ym", ym)
    .eq("source", "tsukuyomi_estimate")
    .limit(1);

  const target = currRows?.[0];
  if (!target && action !== "manual") {
    return NextResponse.json({ error: "対象の推定行が見つからない" }, { status: 404 });
  }

  if (action === "adopt") {
    // 採用: source → pm_confirmed
    const { error } = await supabase
      .from("milestone_monthly_progress")
      .upsert(
        {
          milestone_key: milestoneKey,
          ym,
          progress_pct: Number(target!.progress_pct),
          consumed_pt: Number(target!.consumed_pt),
          source: "pm_confirmed",
          confirmed_at: now,
          note: target!.note || "",
        },
        { onConflict: "milestone_key,ym" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return jsonWithRewardSync(supabase, projectId, ym, { ok: true, action: "adopt", milestoneKey, newPct: Number(target!.progress_pct) });

  } else if (action === "reject") {
    // 不採用: 前月値に戻して source → pm_rejected
    const pym = prevYm(ym);
    const { data: prevRows } = await supabase
      .from("milestone_monthly_progress")
      .select("progress_pct")
      .eq("milestone_key", milestoneKey)
      .lte("ym", pym)
      .order("ym", { ascending: false })
      .limit(1);

    const revertPct = Number(prevRows?.[0]?.progress_pct || 0);

    // MS のポイントを取得して consumed_pt を再計算
    const { data: msRows } = await supabase
      .from("value_milestones")
      .select("points")
      .eq("milestone_id", milestoneKey)
      .limit(1);
    const points = Number(msRows?.[0]?.points || 0);
    const revertConsumed = Math.round(points * revertPct / 100 * 100) / 100;

    const { error } = await supabase
      .from("milestone_monthly_progress")
      .upsert(
        {
          milestone_key: milestoneKey,
          ym,
          progress_pct: revertPct,
          consumed_pt: revertConsumed,
          source: "pm_rejected",
          confirmed_at: now,
          note: `不採用: ${reason || "理由なし"}`,
        },
        { onConflict: "milestone_key,ym" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return jsonWithRewardSync(supabase, projectId, ym, { ok: true, action: "reject", milestoneKey, revertedPct: revertPct });

  } else if (action === "modify") {
    // 修正: 指定値で pm_confirmed
    const adjustedPct = Math.max(0, Math.min(100, Number(newPct || 0)));

    const { data: msRows } = await supabase
      .from("value_milestones")
      .select("points")
      .eq("milestone_id", milestoneKey)
      .limit(1);
    const points = Number(msRows?.[0]?.points || 0);
    const newConsumed = Math.round(points * adjustedPct / 100 * 100) / 100;

    const { error } = await supabase
      .from("milestone_monthly_progress")
      .upsert(
        {
          milestone_key: milestoneKey,
          ym,
          progress_pct: adjustedPct,
          consumed_pt: newConsumed,
          source: "pm_confirmed",
          confirmed_at: now,
          note: `修正: ${reason || ""}（AI推定: ${Number(target?.progress_pct ?? 0)}%）`,
        },
        { onConflict: "milestone_key,ym" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return jsonWithRewardSync(supabase, projectId, ym, { ok: true, action: "modify", milestoneKey, newPct: adjustedPct });

  } else if (action === "manual") {
    // 手動編集: source → pm_manual（tsukuyomi_estimateの有無に関わらず使える）
    const adjustedPct = Math.max(0, Math.min(100, Number(newPct || 0)));

    const { data: msRows } = await supabase
      .from("value_milestones")
      .select("points")
      .eq("milestone_id", milestoneKey)
      .limit(1);
    const points = Number(msRows?.[0]?.points || 0);
    const newConsumed = Math.round(points * adjustedPct / 100 * 100) / 100;

    const { error } = await supabase
      .from("milestone_monthly_progress")
      .upsert(
        {
          milestone_key: milestoneKey,
          ym,
          progress_pct: adjustedPct,
          consumed_pt: newConsumed,
          source: "pm_manual",
          confirmed_at: now,
          note: reason || "",
        },
        { onConflict: "milestone_key,ym" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return jsonWithRewardSync(supabase, projectId, ym, { ok: true, action: "manual", milestoneKey, newPct: adjustedPct });

  } else {
    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }
}
