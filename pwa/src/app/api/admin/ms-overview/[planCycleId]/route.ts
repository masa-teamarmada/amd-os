/**
 * PUT /api/admin/ms-overview/[planCycleId]
 *
 * MS Overview の編集モードで動かした MS.points を確定する API.
 * 1. value_milestones.points を一括更新 (同じ plan_cycle 内の指定 MS のみ)
 * 2. value_plan_cycles.total_points = Σ MS.points (= 全 active MS の points 合計、
 *    goal_level=monthly は除外、season-pl.ts と一致) を再計算して反映
 * 3. syncRewardSummariesForProject で全月の reward_summary を再計算 (PAID 月は自動 skip)
 *
 * share の変更は今フェーズではスコープ外 (pt のみ).
 * 仕様は pwa/manual/6-8-admin-ms-overview-spec.md "編集モード" 章を参照.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { syncRewardSummariesForProject } from "@/lib/reward-summary";

export const runtime = "nodejs";

type Body = {
  milestones: Array<{ milestoneId: string; points: number }>;
};

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ planCycleId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { planCycleId } = await ctx.params;
  if (!planCycleId) {
    return NextResponse.json({ ok: false, error: "planCycleId is required" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body?.milestones) || body.milestones.length === 0) {
    return NextResponse.json({ ok: false, error: "milestones[] is required" }, { status: 400 });
  }

  // 入力 validation: 各 pt は 0 以上の有限数. 上限は server 側では強制しない
  // (= client の slider で常識範囲に縛る). ただし負数や NaN は弾く.
  for (const m of body.milestones) {
    if (!m?.milestoneId) {
      return NextResponse.json({ ok: false, error: "milestoneId missing in payload" }, { status: 400 });
    }
    const pt = safeNumber(m.points);
    if (pt < 0) {
      return NextResponse.json(
        { ok: false, error: `points must be >= 0 (got ${m.points} for ${m.milestoneId})` },
        { status: 400 },
      );
    }
  }

  try {
    const db = createAdminClient();

    // plan_cycle が存在し project_id を引けることを先に確認
    const planRes = await db
      .from("value_plan_cycles")
      .select("plan_cycle_id, project_id, period_start_ym, period_end_ym, status")
      .eq("plan_cycle_id", planCycleId)
      .maybeSingle();
    if (planRes.error) throw planRes.error;
    const plan = planRes.data as
      | { plan_cycle_id: string; project_id: string; period_start_ym: string; period_end_ym: string; status: string | null }
      | null;
    if (!plan) {
      return NextResponse.json({ ok: false, error: "plan cycle not found" }, { status: 404 });
    }

    // payload の milestone が本当に同じ plan_cycle に属する is_active=true MS かを検査
    // (= 他 PJ の MS を間違って更新させない)
    const milestoneIds = body.milestones.map((m) => m.milestoneId);
    const existingRes = await db
      .from("value_milestones")
      .select("milestone_id, plan_cycle_id, is_active, goal_level")
      .in("milestone_id", milestoneIds);
    if (existingRes.error) throw existingRes.error;
    const existing = (existingRes.data ?? []) as Array<{
      milestone_id: string;
      plan_cycle_id: string;
      is_active: boolean | null;
      goal_level: string | null;
    }>;
    const existingMap = new Map(existing.map((m) => [m.milestone_id, m]));
    for (const m of body.milestones) {
      const row = existingMap.get(m.milestoneId);
      if (!row) {
        return NextResponse.json(
          { ok: false, error: `milestone not found: ${m.milestoneId}` },
          { status: 404 },
        );
      }
      if (row.plan_cycle_id !== planCycleId) {
        return NextResponse.json(
          { ok: false, error: `milestone ${m.milestoneId} does not belong to plan cycle ${planCycleId}` },
          { status: 400 },
        );
      }
    }

    // ① value_milestones.points 一括更新 (1 行ずつ. PostgREST は IN 句での個別値 update を持たないため)
    for (const m of body.milestones) {
      const upd = await db
        .from("value_milestones")
        .update({ points: safeNumber(m.points) })
        .eq("milestone_id", m.milestoneId)
        .eq("plan_cycle_id", planCycleId);
      if (upd.error) throw upd.error;
    }

    // ② total_points 再計算 (= 全 active MS の points 合計、season-pl.ts と同じ「goal_level≠monthly」フィルタ).
    const totalRes = await db
      .from("value_milestones")
      .select("points, goal_level")
      .eq("plan_cycle_id", planCycleId)
      .eq("is_active", true);
    if (totalRes.error) throw totalRes.error;
    const newTotal = Math.round(
      ((totalRes.data ?? []) as Array<{ points: number | string | null; goal_level: string | null }>)
        .filter((r) => String(r.goal_level || "").toLowerCase() !== "monthly")
        .reduce((sum, r) => sum + safeNumber(r.points), 0) * 100,
    ) / 100;

    const planUpd = await db
      .from("value_plan_cycles")
      .update({ total_points: newTotal })
      .eq("plan_cycle_id", planCycleId);
    if (planUpd.error) throw planUpd.error;

    // ③ reward_summary を全月再計算 (PAID 月は内部で自動 skip).
    let syncedYms: string[] = [];
    try {
      const synced = await syncRewardSummariesForProject(db, plan.project_id);
      syncedYms = [...synced.keys()].sort();
    } catch (syncErr) {
      // sync 失敗は表示更新を完全には妨げない (admin 側で復旧)。エラーは記録しつつ、
      // 更新自体は成功扱いで返す。
      console.error("[admin ms-overview PUT] reward sync failed", syncErr);
    }

    return NextResponse.json({
      ok: true,
      planCycleId,
      projectId: plan.project_id,
      updatedMilestoneCount: body.milestones.length,
      newTotalPoints: newTotal,
      rewardSummariesSyncedYms: syncedYms,
    });
  } catch (err) {
    console.error("[admin ms-overview PUT]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
