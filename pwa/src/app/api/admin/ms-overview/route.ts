/**
 * Admin / MS Overview — 全PJのMS設計を一望する API
 *
 * 仕様正本: pwa/manual/6-8-admin-ms-overview-spec.md
 *
 * 全 active plan_cycle を横断して、各シーズンの MS 一覧 (pt順) と
 * メンバー別 年計 (本契約 + 別財布) を理論値 (plannedShare ベース) で返す。
 *
 * 計算ロジックは `pwa/src/lib/season-pl.ts` の computeSeasonPl をそのまま再利用する
 * (= 予実表と乖離しない)。memberYearTotals は computeSeasonPl が出す
 * regularPtUnitYen / extraPtUnitYen と、各メンバーの plannedShare ベース獲得pt
 * から組み立てる (実消化ではなく設計値を見たいので別途計算する)。
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
} from "@/lib/admin/ms-overview-types";

export const runtime = "nodejs";

// season-pl と揃える: cap/原資の母数になりうる plan cycle ステータス
const ACTIVE_PLAN_STATUSES = ["active", "confirmed", "fixed", "draft"];

// 別財布 (cap_extra) プールに属する MS の tag 集合。season-pl.ts と同一。
const CAP_EXTRA_MILESTONE_TAGS = new Set([
  "cap_extra",
  "extra_contract",
  "contract_extra",
  "cap_outside",
  "uncapped",
]);
function isCapExtraTag(tag: unknown): boolean {
  return CAP_EXTRA_MILESTONE_TAGS.has(String(tag ?? "").trim().toLowerCase());
}

const PLAN_CYCLE_SELECT =
  "plan_cycle_id, project_id, status, budget_yen, total_points, period_start_ym, period_end_ym, buffer_breakdown_json";
const PROJECT_SELECT =
  "project_id, project_name, client_name, fee_type, fee_amount, start_ym, end_ym, contract_terms_json";
const BILLING_SELECT =
  "project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, extra_budget_yen, reward_summary_json, payment_confirmed_at";
const MEMBER_SELECT =
  "member_id, code_name, member_name, is_officer, exclude_from_payout_notice";
const MILESTONE_SELECT =
  "milestone_id, title, points, tag, goal_level, sort_order, period_start_ym, target_ym";

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type {
  MsOverviewResponsibility,
  MsOverviewMilestone,
  MsOverviewMemberYearTotal,
  MsOverviewPlanCycle,
  MsOverviewResponse,
};

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
 * computeSeasonPl で原資・pt単価を確定させたあと、その単価で MS pt 価値と
 * メンバー年計 (plannedShare ベース理論値) を計算する。
 */
async function buildOverviewForPlanCycle(
  db: SupabaseClient,
  planCycle: PlanCycleInput,
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
  const milestones = ((milestoneRes.data ?? []) as MilestoneInput[]).filter(
    (ms) => String(ms.goal_level || "").toLowerCase() !== "monthly",
  );
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
        .select("milestone_id, member_id, share")
        .in("milestone_id", milestoneIds)
    : { data: [] as ResponsibilityInput[], error: null };
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;
  const responsibilities = (responsibilitiesRes.data ?? []) as ResponsibilityInput[];

  // ① 原資 / pt単価は season-pl の正本式で確定させる (= 予実表と乖離させない)。
  //    progress は空配列で渡す: MS Overview は「実消化」を見ない画面なので、
  //    plannedShare ベースの理論メンバー年計を別途下で組み立てる。
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
  const respByMs = new Map<string, ResponsibilityInput[]>();
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

  // ③ MS 一覧 (pt 降順)
  const msRows: MsOverviewMilestone[] = milestones
    .map((ms): MsOverviewMilestone => {
      const points = Math.round(numberValue(ms.points) * 100) / 100;
      const isCapExtra = isCapExtraTag(ms.tag);
      const unit = isCapExtra ? seasonPl.extraPtUnitYen : seasonPl.regularPtUnitYen;
      const ptValueYen = Math.round(points * unit);
      const resps = (respByMs.get(ms.milestone_id) ?? [])
        .map((r): MsOverviewResponsibility => ({
          memberId: r.member_id,
          codeName: codeNameByMember.get(r.member_id) || r.member_id,
          share: Math.round(numberValue(r.share) * 10000) / 10000,
        }))
        .sort((a, b) => b.share - a.share);
      return {
        milestoneId: ms.milestone_id,
        title: ms.title || ms.milestone_id,
        points,
        tag: String(ms.tag ?? "normal"),
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
  //    最後に pt単価を掛ける。active メンバー (project_members.is_active=true) のみ表示する。
  type Acc = { regularPt: number; extraPt: number };
  const acc = new Map<string, Acc>();
  for (const ms of milestones) {
    const points = numberValue(ms.points);
    if (points <= 0) continue;
    const isExtra = isCapExtraTag(ms.tag);
    const resps = respByMs.get(ms.milestone_id) ?? [];
    for (const r of resps) {
      if (!activeMemberIds.has(r.member_id)) continue;
      const share = numberValue(r.share);
      if (share <= 0) continue;
      const earnedPt = points * share;
      const a = acc.get(r.member_id) ?? { regularPt: 0, extraPt: 0 };
      if (isExtra) a.extraPt += earnedPt;
      else a.regularPt += earnedPt;
      acc.set(r.member_id, a);
    }
  }
  const memberYearTotals: MsOverviewMemberYearTotal[] = [...acc.entries()]
    .map(([memberId, a]): MsOverviewMemberYearTotal => {
      const regularYen = Math.round(a.regularPt * seasonPl.regularPtUnitYen);
      const extraYen = Math.round(a.extraPt * seasonPl.extraPtUnitYen);
      return {
        memberId,
        codeName: codeNameByMember.get(memberId) || memberId,
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
    regularPoints: Math.round((seasonPl.totalPoints - seasonPl.extraPointsSum) * 100) / 100,
    extraPoints: seasonPl.extraPointsSum,
    regularPtUnitYen: seasonPl.regularPtUnitYen,
    extraPtUnitYen: seasonPl.extraPtUnitYen,
    extraPoolBudgetYen: seasonPl.extraPoolBudgetYen,
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
    const planCycles = (
      await Promise.all(cycles.map((c) => buildOverviewForPlanCycle(db, c)))
    ).filter((row): row is MsOverviewPlanCycle => row !== null);

    // 表示順: budget_yen の大きい PJ から (= インパクトの大きい順)
    planCycles.sort((a, b) => b.budgetYen - a.budgetYen || a.projectId.localeCompare(b.projectId));

    return NextResponse.json({ ok: true, planCycles } satisfies MsOverviewResponse);
  } catch (err) {
    console.error("[admin ms-overview GET]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
