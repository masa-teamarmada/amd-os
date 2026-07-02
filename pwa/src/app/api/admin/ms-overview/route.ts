/**
 * Admin / MS Overview — 全PJのMS設計を一望する API
 *
 * 仕様正本: pwa/manual/6-8-admin-ms-overview-spec.md
 *
 * 全 active plan_cycle を横断して、各シーズンの MS 一覧 (pt順) と
 * メンバー別 pt 配分 (plannedShare ベース) と設計額の目安を返す。
 *
 * この画面は MS 設計レビュー専用。支払確定額は返さず、
 * pt と plannedShare から見た「設計額」だけを返す。
 * 実際の支払額は reward-summary / season-pl / payouts 側を正本にする。
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import type { PlanCycleInput, MilestoneInput, ResponsibilityInput, MemberInput } from "@/lib/season-pl";
import type {
  MsOverviewMemberPointTotal,
  MsOverviewMilestone,
  MsOverviewPlanCycle,
  MsOverviewResponse,
  MsOverviewResponsibility,
  ProjectHealthState,
} from "@/lib/admin/ms-overview-types";
import { isCapExtraTag as isCapExtraTagShared } from "@/lib/admin/ms-overview-calc";
import { pointBasisForMilestonePeriod, regularPointBasisForCycle, roundPt } from "@/lib/season-point-basis";

export const runtime = "nodejs";

// season-pl と揃える: cap/原資の母数になりうる plan cycle ステータス
const ACTIVE_PLAN_STATUSES = ["active", "confirmed", "fixed", "draft"];

// 別財布 (cap_extra) 判定は ms-overview-calc.ts の正本 util に統一。
const isCapExtraTag = isCapExtraTagShared;

const PLAN_CYCLE_SELECT =
  "plan_cycle_id, project_id, status, budget_yen, total_points, period_start_ym, period_end_ym, buffer_breakdown_json";
const PROJECT_SELECT =
  "project_id, project_name, client_name";
const MEMBER_SELECT =
  "member_id, code_name, member_name, is_officer, exclude_from_payout_notice";
const MILESTONE_SELECT =
  "milestone_id, title, points, tag, goal_level, success_criteria, sort_order, period_start_ym, target_ym";
const BILLING_SELECT = "ym, extra_budget_yen";

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function effectiveMilestonePoints(ms: MilestoneInput): number {
  if (isCapExtraTag(ms.tag)) {
    const periodPoints = pointBasisForMilestonePeriod(ms);
    if (periodPoints > 0) return periodPoints;
  }
  return roundPt(Math.max(0, numberValue(ms.points)));
}

export type {
  MsOverviewResponsibility,
  MsOverviewMilestone,
  MsOverviewMemberPointTotal,
  MsOverviewPlanCycle,
  MsOverviewResponse,
  ProjectHealthState,
};

/** JST 起点の今月 YYYYMM (= AMD OS シーズン軸と一致) */
function currentYmJst(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const jst = new Date(utcMs + 9 * 60 * 60 * 1000);
  return `${jst.getFullYear()}${String(jst.getMonth() + 1).padStart(2, "0")}`;
}

type ProjectHealthRow = {
  project_id: string;
  status: string | null;
  freeze_from_ym: string | null;
};

type FreezePeriodRow = {
  project_id: string;
  freeze_from_ym: string | null;
  restart_ym: string | null;
  status: string | null;
};

type ResponsibilityRow = ResponsibilityInput & {
  role?: string | null;
  task_description?: string | null;
};

type ProjectRow = {
  project_id: string;
  project_name: string | null;
  client_name: string | null;
};

type BillingCycleMoneyRow = {
  ym: string;
  extra_budget_yen?: number | string | null;
};

/**
 * PJ 健全性を判定する。並び替え (= /admin/ms-overview の上中下) に使う。
 *   projects.status != 'active' → "inactive" (ended/suspended など、最下段)
 *   projects.status='active' AND 今月 freeze 期間内 → "frozen" (中段)
 *     freeze 期間 = projects.freeze_from_ym ≤ 今月 (restart_ym 未設定なので無期限)
 *               OR project_freeze_periods に status='active' で
 *                  freeze_from_ym ≤ 今月 < (restart_ym ?? 9999) の行がある
 *   それ以外 → "healthy" (上段、デフォルト)
 */
function deriveHealthState(
  project: ProjectHealthRow | null | undefined,
  freezePeriods: FreezePeriodRow[],
  currentYm: string,
): ProjectHealthState {
  const projectStatus = String(project?.status ?? "").toLowerCase();
  if (projectStatus && projectStatus !== "active") return "inactive";

  // projects.freeze_from_ym 軸: 今月以降なら freeze 状態
  const projectFreezeFrom = project?.freeze_from_ym ?? null;
  if (projectFreezeFrom && projectFreezeFrom <= currentYm) return "frozen";

  // project_freeze_periods overlay: status='active' で今月が freeze 期間内
  for (const row of freezePeriods) {
    const rowStatus = String(row.status ?? "").toLowerCase();
    if (rowStatus !== "active") continue;
    const from = row.freeze_from_ym ?? "";
    if (!from || from > currentYm) continue;
    const restart = row.restart_ym ?? "";
    if (!restart || restart > currentYm) return "frozen";
  }
  return "healthy";
}

async function loadPlanCycles(db: SupabaseClient): Promise<PlanCycleInput[]> {
  const res = await db
    .from("value_plan_cycles")
    .select(PLAN_CYCLE_SELECT)
    .in("status", ACTIVE_PLAN_STATUSES)
    .order("project_id", { ascending: true })
    .order("period_start_ym", { ascending: false });
  if (res.error) throw res.error;
  return (res.data ?? []) as PlanCycleInput[];
}

/**
 * 1 plan cycle 分の MS overview を組み立てる。
 * 支払額風の円換算は作らず、MS pt と plannedShare の pt 配分だけを計算する。
 */
async function buildOverviewForPlanCycle(
  db: SupabaseClient,
  planCycle: PlanCycleInput,
  health: { healthState: ProjectHealthState; projectStatus: string; projectFreezeFromYm: string | null },
): Promise<MsOverviewPlanCycle | null> {
  const projectId = planCycle.project_id;

  const [projectRes, milestoneRes, membersRes, projectMembersRes, billingRes] =
    await Promise.all([
      db.from("projects").select(PROJECT_SELECT).eq("project_id", projectId).maybeSingle(),
      db
        .from("value_milestones")
        .select(MILESTONE_SELECT)
        .eq("plan_cycle_id", planCycle.plan_cycle_id)
        .eq("is_active", true)
        .order("sort_order"),
      db.from("members").select(MEMBER_SELECT),
      db.from("project_members").select("member_id, is_active").eq("project_id", projectId),
      db
        .from("billing_cycles")
        .select(BILLING_SELECT)
        .eq("project_id", projectId)
        .gte("ym", planCycle.period_start_ym)
        .lte("ym", planCycle.period_end_ym),
    ]);
  if (projectRes.error) throw projectRes.error;
  if (milestoneRes.error) throw milestoneRes.error;
  if (membersRes.error) throw membersRes.error;
  if (projectMembersRes.error) throw projectMembersRes.error;
  if (billingRes.error) throw billingRes.error;

  const project = (projectRes.data ?? null) as ProjectRow | null;
  // season-pl と同じ: monthly goal_level は報酬対象外なので除外する
  const milestones = ((milestoneRes.data ?? []) as MilestoneInput[])
    .filter((ms) => String(ms.goal_level || "").toLowerCase() !== "monthly")
    .map((ms) => ({ ...ms, points: effectiveMilestonePoints(ms) }));
  const members = (membersRes.data ?? []) as MemberInput[];
  const activeMemberIds = new Set(
    ((projectMembersRes.data ?? []) as Array<{ member_id: string; is_active: boolean | null }>)
      .filter((row) => row.is_active !== false)
      .map((row) => row.member_id),
  );
  const regularPoints = regularPointBasisForCycle(planCycle);
  const extraPoints = roundPt(
    milestones.filter((ms) => isCapExtraTag(ms.tag)).reduce((sum, ms) => sum + effectiveMilestonePoints(ms), 0),
  );
  const extraDesignBudgetYen = extraPoints > 0
    ? ((billingRes.data ?? []) as BillingCycleMoneyRow[]).reduce((sum, billing) => {
        const raw = billing.extra_budget_yen;
        if (raw === null || raw === undefined || raw === "") return sum;
        return sum + Math.max(0, Math.round(numberValue(raw)));
      }, 0)
    : 0;
  const memberDesignBudgetYen = Math.round(numberValue(planCycle.budget_yen));
  const regularDesignUnitYen = regularPoints > 0
    ? Math.round(Math.max(0, memberDesignBudgetYen) / regularPoints)
    : 0;
  const extraDesignUnitYen = extraPoints > 0 && extraDesignBudgetYen > 0
    ? Math.round(extraDesignBudgetYen / extraPoints)
    : 0;

  const milestoneIds = milestones.map((ms) => ms.milestone_id);
  const responsibilitiesRes = milestoneIds.length > 0
    ? await db
        .from("milestone_responsibility")
        .select("milestone_id, member_id, share, role, task_description")
        .in("milestone_id", milestoneIds)
    : { data: [] as ResponsibilityRow[], error: null };
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;
  const responsibilities = (responsibilitiesRes.data ?? []) as ResponsibilityRow[];

  // ① 担当 lookup
  const respByMs = new Map<string, ResponsibilityRow[]>();
  for (const resp of responsibilities) {
    const arr = respByMs.get(resp.milestone_id) ?? [];
    arr.push(resp);
    respByMs.set(resp.milestone_id, arr);
  }

  // member_id → code_name
  const codeNameByMember = new Map<string, string>();
  for (const m of members) {
    codeNameByMember.set(m.member_id, m.code_name || m.member_name || m.member_id);
  }
  const projectMembers = [...activeMemberIds]
    .map((memberId) => ({
      memberId,
      codeName: codeNameByMember.get(memberId) || memberId,
    }))
    .sort((a, b) => a.codeName.localeCompare(b.codeName, "ja"));

  // ② MS 一覧 (pt 降順)
  const msRows: MsOverviewMilestone[] = milestones
    .map((ms): MsOverviewMilestone => {
      const points = effectiveMilestonePoints(ms);
      const isCapExtra = isCapExtraTag(ms.tag);
      const designUnitYen = isCapExtra ? extraDesignUnitYen : regularDesignUnitYen;
      // active メンバー (project_members.is_active=true) のみ責任者として残す。
      // milestone_responsibility に過去メンバーの share が残っていると、編集モードでは
      // recomputeMsOverview がその share を拾ってメンバー配分に inactive メンバーが
      // 現れ、閲覧モードと食い違うため (= 閲覧モードは memberPointTotals 段階で
      // activeMemberIds.has(...) チェックを噛ませている)。responsibilities 段階で
      // 両モードの入力を揃える。
      const resps = (respByMs.get(ms.milestone_id) ?? [])
        .filter((r) => activeMemberIds.has(r.member_id))
        .map((r): MsOverviewResponsibility => ({
          memberId: r.member_id,
          codeName: codeNameByMember.get(r.member_id) || r.member_id,
          share: Math.round(numberValue(r.share) * 10000) / 10000,
          role: String(r.role || "担当"),
          taskDescription: r.task_description ?? null,
        }))
        .sort((a, b) => b.share - a.share);
      return {
        milestoneId: ms.milestone_id,
        title: ms.title || ms.milestone_id,
        points,
        designAmountYen: Math.round(points * designUnitYen),
        tag: String(ms.tag ?? "normal"),
        goalLevel: String(ms.goal_level ?? "season"),
        successCriteria: String(ms.success_criteria ?? ""),
        sortOrder: Math.round(numberValue(ms.sort_order)),
        isCapExtra,
        periodStartYm: ms.period_start_ym ?? null,
        targetYm: ms.target_ym ?? null,
        responsibilities: resps,
      };
    })
    .sort((a, b) => b.points - a.points || a.sortOrder - b.sortOrder);

  // ③ メンバー別 pt 配分 (plannedShare ベース)
  //    各 MS について points × share を、tag が cap_extra か否かで regular/extra pt に振り分け、
  //    active メンバー (project_members.is_active=true) のみ表示する。
  type Acc = { regularPt: number; extraPt: number; regularDesignYen: number; extraDesignYen: number };
  const acc = new Map<string, Acc>();
  for (const ms of milestones) {
    const points = effectiveMilestonePoints(ms);
    if (points <= 0) continue;
    const isExtra = isCapExtraTag(ms.tag);
    const designUnitYen = isExtra ? extraDesignUnitYen : regularDesignUnitYen;
    const resps = respByMs.get(ms.milestone_id) ?? [];
    for (const r of resps) {
      if (!activeMemberIds.has(r.member_id)) continue;
      const share = numberValue(r.share);
      if (share <= 0) continue;
      const earnedPt = points * share;
      const a = acc.get(r.member_id) ?? { regularPt: 0, extraPt: 0, regularDesignYen: 0, extraDesignYen: 0 };
      if (isExtra) {
        a.extraPt += earnedPt;
        a.extraDesignYen += earnedPt * designUnitYen;
      } else {
        a.regularPt += earnedPt;
        a.regularDesignYen += earnedPt * designUnitYen;
      }
      acc.set(r.member_id, a);
    }
  }
  const memberPointTotals: MsOverviewMemberPointTotal[] = [...acc.entries()]
    .map(([memberId, a]): MsOverviewMemberPointTotal => {
      const regularPt = roundPt(a.regularPt);
      const extraPt = roundPt(a.extraPt);
      const regularDesignYen = Math.round(a.regularDesignYen);
      const extraDesignYen = Math.round(a.extraDesignYen);
      return {
        memberId,
        codeName: codeNameByMember.get(memberId) || memberId,
        regularPt,
        extraPt,
        totalPt: roundPt(regularPt + extraPt),
        regularDesignYen,
        extraDesignYen,
        totalDesignYen: regularDesignYen + extraDesignYen,
      };
    })
    .filter((row) => row.totalPt > 0)
    .sort((a, b) => b.totalPt - a.totalPt);

  return {
    planCycleId: planCycle.plan_cycle_id,
    projectId: planCycle.project_id,
    projectName: project?.project_name || planCycle.project_id,
    clientName: project?.client_name || "",
    status: planCycle.status || "active",
    periodStartYm: planCycle.period_start_ym,
    periodEndYm: planCycle.period_end_ym,
    budgetYen: memberDesignBudgetYen,
    extraDesignBudgetYen,
    regularDesignUnitYen,
    extraDesignUnitYen,
    totalPoints: roundPt(regularPoints + extraPoints),
    regularPoints,
    extraPoints,
    healthState: health.healthState,
    projectStatus: health.projectStatus,
    projectFreezeFromYm: health.projectFreezeFromYm,
    projectMembers,
    milestones: msRows,
    memberPointTotals,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  try {
    const db = createAdminClient();
    const cycles = await loadPlanCycles(db);

    // PJ 健全性を判定するための補助データを 1 度だけ取る (= 全 cycle で使い回す)。
    const projectIds = [...new Set(cycles.map((c) => c.project_id))];
    const [projectsHealthRes, freezePeriodsRes] = await Promise.all([
      projectIds.length > 0
        ? db
            .from("projects")
            .select("project_id, status, freeze_from_ym")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [] as ProjectHealthRow[], error: null }),
      projectIds.length > 0
        ? db
            .from("project_freeze_periods")
            .select("project_id, freeze_from_ym, restart_ym, status")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [] as FreezePeriodRow[], error: null }),
    ]);
    if (projectsHealthRes.error) throw projectsHealthRes.error;
    if (freezePeriodsRes.error) throw freezePeriodsRes.error;

    const healthByProject = new Map<string, ProjectHealthRow>();
    for (const row of (projectsHealthRes.data ?? []) as ProjectHealthRow[]) {
      healthByProject.set(row.project_id, row);
    }
    const freezeByProject = new Map<string, FreezePeriodRow[]>();
    for (const row of (freezePeriodsRes.data ?? []) as FreezePeriodRow[]) {
      const arr = freezeByProject.get(row.project_id) ?? [];
      arr.push(row);
      freezeByProject.set(row.project_id, arr);
    }
    const currentYm = currentYmJst();
    const resolveHealth = (projectId: string) => {
      const project = healthByProject.get(projectId);
      const freezePeriods = freezeByProject.get(projectId) ?? [];
      return {
        healthState: deriveHealthState(project, freezePeriods, currentYm),
        projectStatus: project?.status ?? "active",
        projectFreezeFromYm: project?.freeze_from_ym ?? null,
      };
    };

    const planCycles = (
      await Promise.all(cycles.map((c) => buildOverviewForPlanCycle(db, c, resolveHealth(c.project_id))))
    ).filter((row): row is MsOverviewPlanCycle => row !== null);

    // 表示順: healthy → frozen → inactive、各層内は budget_yen 降順 → project_id 昇順。
    const healthRank: Record<ProjectHealthState, number> = { healthy: 0, frozen: 1, inactive: 2 };
    planCycles.sort((a, b) => {
      if (healthRank[a.healthState] !== healthRank[b.healthState]) {
        return healthRank[a.healthState] - healthRank[b.healthState];
      }
      if (b.budgetYen !== a.budgetYen) return b.budgetYen - a.budgetYen;
      return a.projectId.localeCompare(b.projectId);
    });

    return NextResponse.json({ ok: true, planCycles } satisfies MsOverviewResponse);
  } catch (err) {
    console.error("[admin ms-overview GET]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
