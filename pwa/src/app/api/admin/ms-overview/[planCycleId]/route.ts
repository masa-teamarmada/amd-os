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
import {
  calculateRewardSummaryForCycle,
  isRewardCycleProtected,
  syncRewardSummariesForProject,
  type RewardSummary,
} from "@/lib/reward-summary";
import { isCapExtraTag } from "@/lib/admin/ms-overview-calc";
import { pointBasisForPeriod, totalPointBasisForCycle } from "@/lib/season-point-basis";

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

type ProtectedBillingCycleRow = {
  project_id: string;
  ym: string;
  reward_summary_json: unknown;
  reward_paid_at?: string | null;
  payout_notice_uploaded_at?: string | null;
  payment_confirmed_at?: string | null;
};

type RewardBaseByPool = {
  memberName?: string;
  regularBaseYen: number;
  extraBaseYen: number;
};

type RewardRevisionSummary = {
  protectedCycleCount: number;
  offsetCount: number;
  totalOffsetYen: number;
  positiveOffsetYen: number;
  negativeOffsetYen: number;
  missingApplyYmCount: number;
  skippedMissingBeforeSummaryCount: number;
  voidedPreviousOffsetCount: number;
  sourceYms: string[];
  applyYms: string[];
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isMissingOffsetTableError(error: unknown): boolean {
  const record = asRecord(error);
  const code = String(record?.code ?? "");
  const message = String(record?.message ?? "");
  return code === "42P01" || code === "PGRST205" || message.includes("reward_member_liability_offsets");
}

function asRewardSummary(value: unknown): RewardSummary | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return asRewardSummary(JSON.parse(value));
    } catch {
      return null;
    }
  }
  const record = asRecord(value);
  if (!record || !Array.isArray(record.members)) return null;
  return value as RewardSummary;
}

function rewardBaseByMember(summary: RewardSummary | null): Map<string, RewardBaseByPool> {
  const map = new Map<string, RewardBaseByPool>();
  const members = Array.isArray(summary?.members) ? summary.members : [];
  for (const member of members as unknown as Array<Record<string, unknown>>) {
    const memberId = cleanOptionalText(member.memberId ?? member.member_id);
    if (!memberId) continue;
    const memberName = cleanOptionalText(member.memberName ?? member.member_name) ?? undefined;
    const baseYen = Math.round(safeNumber(member.basePay ?? member.base_pay));
    const extraBaseYen = Math.round(safeNumber(member.extraBasePay ?? member.extra_base_pay));
    const explicitRegularBaseYen = member.regularBasePay ?? member.regular_base_pay;
    const regularBaseYen = explicitRegularBaseYen == null
      ? Math.max(0, baseYen - extraBaseYen)
      : Math.round(safeNumber(explicitRegularBaseYen));
    map.set(memberId, { memberName, regularBaseYen, extraBaseYen });
  }
  return map;
}

function findNextUnprotectedYm(sourceYm: string, cycles: ProtectedBillingCycleRow[]): string | null {
  return cycles
    .filter((cycle) => cycle.ym > sourceYm && !isRewardCycleProtected(cycle))
    .sort((a, b) => a.ym.localeCompare(b.ym))[0]?.ym ?? null;
}

async function reconcileRewardLiabilityOffsets({
  db,
  plan,
  cycles,
  protectedCycles,
  actorEmail,
}: {
  db: ReturnType<typeof createAdminClient>;
  plan: PlanRow;
  cycles: ProtectedBillingCycleRow[];
  protectedCycles: ProtectedBillingCycleRow[];
  actorEmail: string;
}): Promise<RewardRevisionSummary> {
  if (protectedCycles.length === 0) {
    return {
      protectedCycleCount: 0,
      offsetCount: 0,
      totalOffsetYen: 0,
      positiveOffsetYen: 0,
      negativeOffsetYen: 0,
      missingApplyYmCount: 0,
      skippedMissingBeforeSummaryCount: 0,
      voidedPreviousOffsetCount: 0,
      sourceYms: [],
      applyYms: [],
    };
  }

  const now = new Date().toISOString();
  const revisionId = crypto.randomUUID();
  const sourceYms = protectedCycles.map((cycle) => cycle.ym);
  let skippedMissingBeforeSummaryCount = 0;
  const offsetRows: Array<Record<string, unknown>> = [];

  for (const cycle of protectedCycles) {
    const beforeSummary = asRewardSummary(cycle.reward_summary_json);
    if (!beforeSummary) {
      skippedMissingBeforeSummaryCount += 1;
      continue;
    }

    const afterResult = await calculateRewardSummaryForCycle(db, plan.project_id, cycle.ym, {
      includeLiabilityOffsets: false,
    });
    const afterSummary = afterResult.rewardSummary;
    if (!afterSummary) continue;

    const beforeByMember = rewardBaseByMember(beforeSummary);
    const afterByMember = rewardBaseByMember(afterSummary);
    const memberIds = new Set([...beforeByMember.keys(), ...afterByMember.keys()]);
    const applyYm = findNextUnprotectedYm(cycle.ym, cycles);

    for (const memberId of memberIds) {
      const before = beforeByMember.get(memberId) ?? { regularBaseYen: 0, extraBaseYen: 0 };
      const after = afterByMember.get(memberId) ?? { regularBaseYen: 0, extraBaseYen: 0 };
      const memberName = after.memberName || before.memberName || memberId;
      const poolDeltas = [
        {
          pool: "regular",
          beforeBaseYen: before.regularBaseYen,
          afterBaseYen: after.regularBaseYen,
          offsetYen: after.regularBaseYen - before.regularBaseYen,
        },
        {
          pool: "cap_extra",
          beforeBaseYen: before.extraBaseYen,
          afterBaseYen: after.extraBaseYen,
          offsetYen: after.extraBaseYen - before.extraBaseYen,
        },
      ];

      for (const delta of poolDeltas) {
        if (delta.offsetYen === 0) continue;
        offsetRows.push({
          project_id: plan.project_id,
          plan_cycle_id: plan.plan_cycle_id,
          source_ym: cycle.ym,
          apply_ym: applyYm,
          member_id: memberId,
          pool: delta.pool,
          offset_yen: delta.offsetYen,
          before_base_yen: delta.beforeBaseYen,
          after_base_yen: delta.afterBaseYen,
          status: "pending",
          origin_type: "ms_overview_edit",
          reason: "MS design revision on protected billing cycle",
          revision_id: revisionId,
          created_by_email: actorEmail,
          metadata_json: {
            memberName,
            protectedFlags: {
              rewardPaidAt: cycle.reward_paid_at ?? null,
              payoutNoticeUploadedAt: cycle.payout_notice_uploaded_at ?? null,
              paymentConfirmedAt: cycle.payment_confirmed_at ?? null,
            },
            editedAt: now,
            beforeSummaryVersion: beforeSummary.meta?.version ?? null,
            afterSummaryVersion: afterSummary.meta?.version ?? null,
          },
        });
      }
    }
  }

  const voidRes = await db
    .from("reward_member_liability_offsets")
    .update({ status: "voided", voided_at: now })
    .eq("project_id", plan.project_id)
    .eq("plan_cycle_id", plan.plan_cycle_id)
    .eq("origin_type", "ms_overview_edit")
    .eq("status", "pending")
    .in("source_ym", sourceYms)
    .select("id");
  if (voidRes.error) throw voidRes.error;

  if (offsetRows.length > 0) {
    const insertRes = await db.from("reward_member_liability_offsets").insert(offsetRows);
    if (insertRes.error) throw insertRes.error;
  }

  const totalOffsetYen = offsetRows.reduce((sum, row) => sum + Math.round(safeNumber(row.offset_yen)), 0);
  const positiveOffsetYen = offsetRows
    .filter((row) => safeNumber(row.offset_yen) > 0)
    .reduce((sum, row) => sum + Math.round(safeNumber(row.offset_yen)), 0);
  const negativeOffsetYen = offsetRows
    .filter((row) => safeNumber(row.offset_yen) < 0)
    .reduce((sum, row) => sum + Math.round(safeNumber(row.offset_yen)), 0);
  const applyYms = [...new Set(offsetRows.map((row) => cleanOptionalText(row.apply_ym)).filter(Boolean) as string[])].sort();

  return {
    protectedCycleCount: protectedCycles.length,
    offsetCount: offsetRows.length,
    totalOffsetYen,
    positiveOffsetYen,
    negativeOffsetYen,
    missingApplyYmCount: offsetRows.filter((row) => !cleanOptionalText(row.apply_ym)).length,
    skippedMissingBeforeSummaryCount,
    voidedPreviousOffsetCount: voidRes.data?.length ?? 0,
    sourceYms,
    applyYms,
  };
}

function normalizedMilestonePoints(
  ms: Pick<MilestonePayload, "points" | "tag">,
  periodStartYm: string | null,
  targetYm: string | null,
): number {
  if (isCapExtraTag(ms.tag)) {
    const periodPoints = pointBasisForPeriod(periodStartYm, targetYm);
    if (periodPoints > 0) return periodPoints;
  }
  return Math.round(Math.max(0, safeNumber(ms.points)) * 100) / 100;
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

    const cyclesRes = await db
      .from("billing_cycles")
      .select("project_id, ym, reward_summary_json, reward_paid_at, payout_notice_uploaded_at, payment_confirmed_at")
      .eq("project_id", plan.project_id)
      .gte("ym", plan.period_start_ym)
      .lte("ym", plan.period_end_ym)
      .order("ym", { ascending: true });
    if (cyclesRes.error) throw cyclesRes.error;
    const cycles = (cyclesRes.data ?? []) as ProtectedBillingCycleRow[];
    const protectedCycles = cycles.filter(isRewardCycleProtected);
    if (protectedCycles.length > 0) {
      const offsetTableProbe = await db.from("reward_member_liability_offsets").select("id").limit(1);
      if (offsetTableProbe.error) {
        if (isMissingOffsetTableError(offsetTableProbe.error)) {
          return NextResponse.json(
            {
              ok: false,
              error: "reward_member_liability_offsets migration is required before editing MS with protected billing cycles",
            },
            { status: 409 },
          );
        }
        throw offsetTableProbe.error;
      }
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
        points: normalizedMilestonePoints(ms, periodStartYm, targetYm),
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
      .select("points, tag, goal_level, period_start_ym, target_ym")
      .eq("plan_cycle_id", planCycleId)
      .eq("is_active", true);
    if (totalRes.error) throw totalRes.error;
    const extraPoints = Math.round(
      ((totalRes.data ?? []) as Array<{
        points: number | string | null;
        tag: string | null;
        goal_level: string | null;
        period_start_ym: string | null;
        target_ym: string | null;
      }>)
        .filter((row) => String(row.goal_level || "").toLowerCase() !== "monthly")
        .filter((row) => isCapExtraTag(row.tag))
        .reduce((sum, row) => {
          const periodPoints = pointBasisForPeriod(row.period_start_ym, row.target_ym);
          return sum + (periodPoints > 0 ? periodPoints : safeNumber(row.points));
        }, 0) * 100,
    ) / 100;
    const newTotal = totalPointBasisForCycle(plan, extraPoints);

    const planUpd = await db
      .from("value_plan_cycles")
      .update({ total_points: newTotal })
      .eq("plan_cycle_id", planCycleId);
    if (planUpd.error) throw planUpd.error;

    const rewardRevision = await reconcileRewardLiabilityOffsets({
      db,
      plan,
      cycles,
      protectedCycles,
      actorEmail: auth.user.email,
    });

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
      rewardRevision,
    });
  } catch (err) {
    console.error("[admin ms-overview PUT]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
