/**
 * Admin / MS Overview — 全PJのMS設計を一望する API
 *
 * 仕様正本: pwa/manual/6-8-admin-ms-overview-spec.md
 *
 * 全 active plan_cycle を横断して、各シーズンの MS 一覧 (pt順) と
 * メンバー別 年計 (pt×単価) を plannedShare ベースで返す。
 *
 * ここで出す円額は「表示用に丸めたpt×単価」ではなく、reward-summary.ts と同じく
 * MSごとに earnedPt を2桁丸め → 円丸め → メンバー合算する。
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  computeSeasonPl,
  type PlanCycleInput,
  type ProjectInput,
  type BillingInput,
  type MilestoneInput,
  type ResponsibilityInput,
  type MemberInput,
} from "@/lib/season-pl";
import type {
  MsOverviewMemberYearTotal,
  MsOverviewMilestone,
  MsOverviewPlanCycle,
  MsOverviewResponse,
  MsOverviewResponsibility,
  ProjectHealthState,
} from "@/lib/admin/ms-overview-types";
import { isCapExtraTag as isCapExtraTagShared } from "@/lib/admin/ms-overview-calc";
import { pointBasisForMilestonePeriod, roundPt } from "@/lib/season-point-basis";

export const runtime = "nodejs";

// season-pl と揃える: cap/原資の母数になりうる plan cycle ステータス
const ACTIVE_PLAN_STATUSES = ["active", "confirmed", "fixed", "draft"];

// 別財布 (cap_extra) 判定は ms-overview-calc.ts の正本 util に統一。
const isCapExtraTag = isCapExtraTagShared;

const PLAN_CYCLE_SELECT =
  "plan_cycle_id, project_id, status, budget_yen, total_points, period_start_ym, period_end_ym, buffer_breakdown_json";
const PROJECT_SELECT =
  "project_id, project_name, client_name, fee_type, fee_amount, start_ym, end_ym, contract_terms_json";
const BILLING_SELECT =
  "project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, extra_budget_yen, reward_summary_json, payment_confirmed_at";
const MEMBER_SELECT =
  "member_id, code_name, member_name, is_officer, exclude_from_payout_notice";
const MILESTONE_SELECT =
  "milestone_id, title, points, tag, goal_level, success_criteria, sort_order, period_start_ym, target_ym";

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeShare(value: unknown): number {
  const n = numberValue(value);
  const normalized = n > 1 && n <= 100 ? n / 100 : n;
  return Math.max(0, Math.min(1, normalized));
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
  MsOverviewMemberYearTotal,
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
 * pt単価は season-pl の正本式で確定させ、メンバー年計は reward-summary と同じ
 * 「MS単位でpt丸め→円丸め→合算」の順で計算する。
 */
async function buildOverviewForPlanCycle(
  db: SupabaseClient,
  planCycle: PlanCycleInput,
  health: { healthState: ProjectHealthState; projectStatus: string; projectFreezeFromYm: string | null },
): Promise<MsOverviewPlanCycle | null> {
  const projectId = planCycle.project_id;

  const [projectRes, billingRes, milestoneRes, membersRes, projectMembersRes] =
    await Promise.all([
      db.from("projects").select(PROJECT_SELECT).eq("project_id", projectId).maybeSingle(),
      db
        .from("billing_cycles")
        .select(BILLING_SELECT)
        .eq("project_id", projectId)
        .gte("ym", planCycle.period_start_ym)
        .lte("ym", planCycle.period_end_ym)
        .order("ym", { ascending: true }),
      db
        .from("value_milestones")
        .select(MILESTONE_SELECT)
        .eq("plan_cycle_id", planCycle.plan_cycle_id)
        .eq("is_active", true)
        .order("sort_order"),
      db.from("members").select(MEMBER_SELECT),
      db.from("project_members").select("member_id, is_active").eq("project_id", projectId),
    ]);
  if (projectRes.error) throw projectRes.error;
  if (billingRes.error) throw billingRes.error;
  if (milestoneRes.error) throw milestoneRes.error;
  if (membersRes.error) throw membersRes.error;
  if (projectMembersRes.error) throw projectMembersRes.error;

  const project = (projectRes.data ?? null) as ProjectInput | null;
  const billings = (billingRes.data ?? []) as BillingInput[];
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

  const milestoneIds = milestones.map((ms) => ms.milestone_id);
  const responsibilitiesRes = milestoneIds.length > 0
    ? await db
        .from("milestone_responsibility")
        .select("milestone_id, member_id, share, role, task_description")
        .in("milestone_id", milestoneIds)
    : { data: [] as ResponsibilityRow[], error: null };
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;
  const responsibilities = (responsibilitiesRes.data ?? []) as ResponsibilityRow[];

  // ① 原資 / pt単価は season-pl の正本式で確定させる (= 予実表と乖離させない)。
  //    progress は空配列で渡す: MS Overview は「実消化」ではなく設計値を見る。
  const seasonPl = computeSeasonPl({
    planCycle,
    project,
    billings,
    milestones,
    progress: [],
    responsibilities,
    members,
    activeMemberIds,
  });

  // ② 担当 lookup
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

  const activeRespsForMs = (milestoneId: string): ResponsibilityRow[] => {
    const planned = (respByMs.get(milestoneId) ?? [])
      .map((resp) => ({ ...resp, share: normalizeShare(resp.share) }))
      .filter((resp) => numberValue(resp.share) > 0);
    const active = planned.filter((resp) => activeMemberIds.has(resp.member_id));
    if (active.length === planned.length) return active;
    const total = active.reduce((sum, resp) => sum + numberValue(resp.share), 0);
    if (total <= 0) return [];
    return active.map((resp) => ({
      ...resp,
      share: Math.round((numberValue(resp.share) / total) * 10000) / 10000,
    }));
  };

  // ③ MS 一覧 (pt 降順)
  const msRows: MsOverviewMilestone[] = milestones
    .map((ms): MsOverviewMilestone => {
      const points = effectiveMilestonePoints(ms);
      const isCapExtra = isCapExtraTag(ms.tag);
      const unit = isCapExtra ? seasonPl.extraPtUnitYen : seasonPl.regularPtUnitYen;
      const ptValueYen = Math.round(points * unit);
      // active メンバー (project_members.is_active=true) のみ責任者として残す。
      // milestone_responsibility に過去メンバーの share が残っていると、編集モードでは
      // recomputeMsOverview がその share を拾ってメンバー年計に inactive メンバーが
      // 現れ、閲覧モードと食い違うため (= 閲覧モードは memberYearTotals 段階で
      // activeMemberIds.has(...) チェックを噛ませている)。responsibilities 段階で
      // 両モードの入力を揃える。
      const resps = activeRespsForMs(ms.milestone_id)
        .map((r): MsOverviewResponsibility => ({
          memberId: r.member_id,
          codeName: codeNameByMember.get(r.member_id) || r.member_id,
          share: Math.round(normalizeShare(r.share) * 10000) / 10000,
          role: String(r.role || "担当"),
          taskDescription: r.task_description ?? null,
        }))
        .sort((a, b) => b.share - a.share);
      return {
        milestoneId: ms.milestone_id,
        title: ms.title || ms.milestone_id,
        points,
        tag: String(ms.tag ?? "normal"),
        goalLevel: String(ms.goal_level ?? "season"),
        successCriteria: String(ms.success_criteria ?? ""),
        sortOrder: Math.round(numberValue(ms.sort_order)),
        isCapExtra,
        periodStartYm: ms.period_start_ym ?? null,
        targetYm: ms.target_ym ?? null,
        ptValueYen,
        responsibilities: resps,
      };
    })
    .sort((a, b) => b.points - a.points || b.ptValueYen - a.ptValueYen);

  // ④ メンバー年計 (plannedShare ベース理論値)
  //    各 MS について points × share を、tag が cap_extra か否かで regular/extra pt に振り分け、
  //    MS単位で earnedPt / payYen を丸めてから合算する。reward-summary.ts の丸め順と揃える。
  type Acc = { regularPt: number; extraPt: number; regularYen: number; extraYen: number };
  const acc = new Map<string, Acc>();
  for (const ms of milestones) {
    const points = effectiveMilestonePoints(ms);
    if (points <= 0) continue;
    const isExtra = isCapExtraTag(ms.tag);
    const unit = isExtra ? seasonPl.extraPtUnitYen : seasonPl.regularPtUnitYen;
    const resps = activeRespsForMs(ms.milestone_id);
    for (const r of resps) {
      const share = normalizeShare(r.share);
      if (share <= 0) continue;
      const earnedPt = roundPt(points * share);
      const earnedYen = Math.round(earnedPt * unit);
      const a = acc.get(r.member_id) ?? { regularPt: 0, extraPt: 0, regularYen: 0, extraYen: 0 };
      if (isExtra) {
        a.extraPt += earnedPt;
        a.extraYen += earnedYen;
      } else {
        a.regularPt += earnedPt;
        a.regularYen += earnedYen;
      }
      acc.set(r.member_id, a);
    }
  }
  const memberYearTotals: MsOverviewMemberYearTotal[] = [...acc.entries()]
    .map(([memberId, a]): MsOverviewMemberYearTotal => {
      const regularPt = roundPt(a.regularPt);
      const extraPt = roundPt(a.extraPt);
      const regularYen = Math.round(a.regularYen);
      const extraYen = Math.round(a.extraYen);
      return {
        memberId,
        codeName: codeNameByMember.get(memberId) || memberId,
        regularPt,
        extraPt,
        totalPt: roundPt(regularPt + extraPt),
        regularYen,
        extraYen,
        totalYen: regularYen + extraYen,
      };
    })
    .filter((row) => row.totalYen > 0)
    .sort((a, b) => b.totalYen - a.totalYen);

  return {
    planCycleId: planCycle.plan_cycle_id,
    projectId: planCycle.project_id,
    projectName: project?.project_name || planCycle.project_id,
    clientName: project?.client_name || "",
    status: planCycle.status || "active",
    periodStartYm: planCycle.period_start_ym,
    periodEndYm: planCycle.period_end_ym,
    budgetYen: seasonPl.memberBudgetYen,
    totalPoints: seasonPl.totalPoints,
    regularPoints: roundPt(seasonPl.totalPoints - seasonPl.extraPointsSum),
    extraPoints: seasonPl.extraPointsSum,
    regularPtUnitYen: seasonPl.regularPtUnitYen,
    extraPtUnitYen: seasonPl.extraPtUnitYen,
    extraPoolBudgetYen: seasonPl.extraPoolBudgetYen,
    healthState: health.healthState,
    projectStatus: health.projectStatus,
    projectFreezeFromYm: health.projectFreezeFromYm,
    projectMembers,
    milestones: msRows,
    memberYearTotals,
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
