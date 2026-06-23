/**
 * PUT /api/admin/ms-overview/[planCycleId]
 *
 * Admin / MS Overview の編集保存 API。
 * cockpit 側の MS 設計編集を閉じるため、MS 本体・期間・担当 share をここで一括保存する。
 *
 * total_points は MS 配分合計ではなく、正本ルールに戻す:
 *   本契約 regular = シーズン期間の月数 × 10pt
 *   total_points   = regular + Σ cap_extra MS points
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { syncRewardSummariesForProject } from "@/lib/reward-summary";
import { isCapExtraTag } from "@/lib/admin/ms-overview-calc";
import { totalPointBasisForCycle } from "@/lib/season-point-basis";

export const runtime = "nodejs";

type ResponsibilityPayload = {
  memberId: string;
  share: number;
  role?: string | null;
  taskDescription?: string | null;
};

type MilestonePayload = {
  milestoneId?: string | null;
  title: string;
  points: number;
  tag?: string | null;
  goalLevel?: string | null;
  successCriteria?: string | null;
  periodStartYm?: string | null;
  targetYm?: string | null;
  sortOrder?: number | null;
  responsibilities?: ResponsibilityPayload[];
};

type Body = {
  milestones: MilestonePayload[];
  deletedMilestoneIds?: string[];
};

type PlanRow = {
  plan_cycle_id: string;
  project_id: string;
  period_start_ym: string;
  period_end_ym: string;
  status: string | null;
};

type ExistingMilestoneRow = {
  milestone_id: string;
  plan_cycle_id: string;
  is_active: boolean | null;
};

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function cleanText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cleanOptionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function cleanYm(value: unknown): string | null {
  const text = cleanOptionalText(value);
  if (!text) return null;
  return /^\d{6}$/.test(text) ? text : "__INVALID_YM__";
}

function newMilestoneId(planCycleId: string, index: number): string {
  return `MS-${planCycleId}-${Date.now()}-${index + 1}`;
}

function normalizeShare(value: unknown): number {
  return Math.round(safeNumber(value) * 10000) / 10000;
}

function validatePayload(body: Body): string | null {
  if (!Array.isArray(body?.milestones)) return "milestones[] is required";
  if (body.milestones.length === 0 && (!Array.isArray(body.deletedMilestoneIds) || body.deletedMilestoneIds.length === 0)) {
    return "milestones[] or deletedMilestoneIds[] is required";
  }
  for (const [index, ms] of body.milestones.entries()) {
    if (!cleanText(ms.title)) return `title is required at milestones[${index}]`;
    if (safeNumber(ms.points) < 0) return `points must be >= 0 at milestones[${index}]`;
    const start = cleanYm(ms.periodStartYm);
    const target = cleanYm(ms.targetYm);
    if (start === "__INVALID_YM__") return `periodStartYm must be YYYYMM at milestones[${index}]`;
    if (target === "__INVALID_YM__") return `targetYm must be YYYYMM at milestones[${index}]`;
    if (start && target && start > target) return `periodStartYm must be <= targetYm at milestones[${index}]`;
    for (const [respIndex, resp] of (ms.responsibilities ?? []).entries()) {
      if (!cleanText(resp.memberId)) return `memberId is required at milestones[${index}].responsibilities[${respIndex}]`;
      const share = normalizeShare(resp.share);
      if (share < 0 || share > 1) return `share must be 0..1 at milestones[${index}].responsibilities[${respIndex}]`;
    }
  }
  return null;
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
  const payloadError = validatePayload(body);
  if (payloadError) return NextResponse.json({ ok: false, error: payloadError }, { status: 400 });

  try {
    const db = createAdminClient();

    const planRes = await db
      .from("value_plan_cycles")
      .select("plan_cycle_id, project_id, period_start_ym, period_end_ym, status")
      .eq("plan_cycle_id", planCycleId)
      .maybeSingle();
    if (planRes.error) throw planRes.error;
    const plan = planRes.data as PlanRow | null;
    if (!plan) {
      return NextResponse.json({ ok: false, error: "plan cycle not found" }, { status: 404 });
    }

    const existingRes = await db
      .from("value_milestones")
      .select("milestone_id, plan_cycle_id, is_active")
      .eq("plan_cycle_id", planCycleId);
    if (existingRes.error) throw existingRes.error;
    const existing = (existingRes.data ?? []) as ExistingMilestoneRow[];
    const existingIds = new Set(existing.map((row) => row.milestone_id));

    const deletedIds = [...new Set((body.deletedMilestoneIds ?? []).filter(Boolean))];
    for (const deletedId of deletedIds) {
      if (!existingIds.has(deletedId)) {
        return NextResponse.json({ ok: false, error: `milestone not found: ${deletedId}` }, { status: 404 });
      }
    }

    const savedRows = body.milestones.map((ms, index) => {
      const milestoneId = cleanOptionalText(ms.milestoneId) || newMilestoneId(planCycleId, index);
      if (ms.milestoneId && !existingIds.has(milestoneId)) {
        throw new Error(`milestone ${milestoneId} does not belong to plan cycle ${planCycleId}`);
      }
      const periodStartYm = cleanYm(ms.periodStartYm);
      const targetYm = cleanYm(ms.targetYm);
      return {
        milestone_id: milestoneId,
        plan_cycle_id: planCycleId,
        title: cleanText(ms.title),
        points: Math.round(safeNumber(ms.points) * 100) / 100,
        tag: cleanText(ms.tag, "normal"),
        goal_level: cleanText(ms.goalLevel, "season"),
        is_active: true,
        success_criteria: cleanOptionalText(ms.successCriteria),
        sort_order: Math.round(safeNumber(ms.sortOrder ?? index + 1)),
        period_start_ym: periodStartYm,
        target_ym: targetYm,
      };
    });

    if (deletedIds.length > 0) {
      const respDel = await db.from("milestone_responsibility").delete().in("milestone_id", deletedIds);
      if (respDel.error) throw respDel.error;
      const archive = await db
        .from("value_milestones")
        .update({ is_active: false })
        .eq("plan_cycle_id", planCycleId)
        .in("milestone_id", deletedIds);
      if (archive.error) throw archive.error;
    }

    if (savedRows.length > 0) {
      const upsert = await db.from("value_milestones").upsert(savedRows, { onConflict: "milestone_id" });
      if (upsert.error) throw upsert.error;

      const savedIds = savedRows.map((row) => row.milestone_id);
      const respDel = await db.from("milestone_responsibility").delete().in("milestone_id", savedIds);
      if (respDel.error) throw respDel.error;

      const responsibilityRows = body.milestones.flatMap((ms, index) => {
        const milestoneId = savedRows[index].milestone_id;
        return (ms.responsibilities ?? [])
          .map((resp) => ({
            milestone_id: milestoneId,
            member_id: cleanText(resp.memberId),
            share: normalizeShare(resp.share),
            role: cleanText(resp.role, "担当"),
            task_description: cleanOptionalText(resp.taskDescription),
          }))
          .filter((resp) => resp.share > 0);
      });
      if (responsibilityRows.length > 0) {
        const respIns = await db.from("milestone_responsibility").insert(responsibilityRows);
        if (respIns.error) throw respIns.error;
      }
    }

    const totalRes = await db
      .from("value_milestones")
      .select("points, tag, goal_level")
      .eq("plan_cycle_id", planCycleId)
      .eq("is_active", true);
    if (totalRes.error) throw totalRes.error;
    const extraPoints = Math.round(
      ((totalRes.data ?? []) as Array<{ points: number | string | null; tag: string | null; goal_level: string | null }>)
        .filter((row) => String(row.goal_level || "").toLowerCase() !== "monthly")
        .filter((row) => isCapExtraTag(row.tag))
        .reduce((sum, row) => sum + safeNumber(row.points), 0) * 100,
    ) / 100;
    const newTotal = totalPointBasisForCycle(plan, extraPoints);

    const planUpd = await db
      .from("value_plan_cycles")
      .update({ total_points: newTotal })
      .eq("plan_cycle_id", planCycleId);
    if (planUpd.error) throw planUpd.error;

    let syncedYms: string[] = [];
    try {
      const synced = await syncRewardSummariesForProject(db, plan.project_id);
      syncedYms = [...synced.keys()].sort();
    } catch (syncErr) {
      console.error("[admin ms-overview PUT] reward sync failed", syncErr);
    }

    return NextResponse.json({
      ok: true,
      planCycleId,
      projectId: plan.project_id,
      updatedMilestoneCount: savedRows.length,
      archivedMilestoneCount: deletedIds.length,
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
