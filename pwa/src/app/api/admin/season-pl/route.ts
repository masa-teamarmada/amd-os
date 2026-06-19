import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  computeSeasonPl,
  toListRow,
  type SeasonPl,
  type SeasonPlListRow,
  type PlanCycleInput,
  type ProjectInput,
  type BillingInput,
  type MilestoneInput,
  type ProgressInput,
  type ResponsibilityInput,
  type MemberInput,
} from "@/lib/season-pl";

export const runtime = "nodejs";

// reward-summary.ts と揃える: cap/原資の母数になりうる plan cycle ステータス。
const ACTIVE_PLAN_STATUSES = ["active", "confirmed", "fixed", "draft"];

const PLAN_CYCLE_SELECT =
  "plan_cycle_id, project_id, status, budget_yen, total_points, period_start_ym, period_end_ym, buffer_breakdown_json";
const PROJECT_SELECT =
  "project_id, project_name, client_name, fee_type, fee_amount, start_ym, end_ym, contract_terms_json";
const BILLING_SELECT =
  "project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, reward_summary_json, payment_confirmed_at";
const MEMBER_SELECT = "member_id, code_name, member_name, is_officer, exclude_from_payout_notice";

type PlanCycleRow = PlanCycleInput;
type ProjectRow = ProjectInput;
type BillingRow = BillingInput;
type MilestoneRow = MilestoneInput;
type ProgressRow = ProgressInput;
type ResponsibilityRow = ResponsibilityInput;
type MemberRow = MemberInput;

/** active plan cycle を全件、または 1 件だけ読む。 */
async function loadPlanCycles(
  db: SupabaseClient,
  planCycleId: string | null
): Promise<PlanCycleRow[]> {
  let query = db.from("value_plan_cycles").select(PLAN_CYCLE_SELECT).in("status", ACTIVE_PLAN_STATUSES);
  if (planCycleId) query = query.eq("plan_cycle_id", planCycleId);
  const res = await query.order("project_id", { ascending: true }).order("period_start_ym", { ascending: false });
  if (res.error) throw res.error;
  return (res.data ?? []) as PlanCycleRow[];
}

/**
 * 1 plan cycle 分のシーズン予実表を計算するために必要な周辺データを読んで computeSeasonPl を呼ぶ。
 * 一覧でも詳細でも同じ計算をするので共通化する (一覧は toListRow で軽量化して返す)。
 */
async function computeForPlanCycle(db: SupabaseClient, planCycle: PlanCycleRow): Promise<SeasonPl | null> {
  const projectId = planCycle.project_id;

  const [projectRes, billingRes, milestoneRes, membersRes, projectMembersRes] = await Promise.all([
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
      .select("milestone_id, title, points, tag, goal_level, sort_order, period_start_ym, target_ym")
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

  const project = (projectRes.data ?? null) as ProjectRow | null;
  const billings = (billingRes.data ?? []) as BillingRow[];
  // reward-summary 同様、monthly goal_level の MS は報酬対象外。
  const milestones = ((milestoneRes.data ?? []) as MilestoneRow[]).filter(
    (ms) => String(ms.goal_level || "").toLowerCase() !== "monthly"
  );
  const members = (membersRes.data ?? []) as MemberRow[];

  const milestoneIds = milestones.map((ms) => ms.milestone_id);
  const [progressRes, responsibilitiesRes] = await Promise.all([
    milestoneIds.length > 0
      ? db
          .from("milestone_monthly_progress")
          .select("milestone_key, ym, progress_pct, consumed_pt, source")
          .in("milestone_key", milestoneIds)
          .order("ym", { ascending: true })
      : Promise.resolve({ data: [] as ProgressRow[], error: null }),
    milestoneIds.length > 0
      ? db
          .from("milestone_responsibility")
          .select("milestone_id, member_id, share")
          .in("milestone_id", milestoneIds)
      : Promise.resolve({ data: [] as ResponsibilityRow[], error: null }),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;

  const activeMemberIds = new Set(
    ((projectMembersRes.data ?? []) as Array<{ member_id: string; is_active: boolean | null }>)
      .filter((row) => row.is_active !== false)
      .map((row) => row.member_id)
  );

  return computeSeasonPl({
    planCycle,
    project,
    billings,
    milestones,
    progress: (progressRes.data ?? []) as ProgressRow[],
    responsibilities: (responsibilitiesRes.data ?? []) as ResponsibilityRow[],
    members,
    activeMemberIds,
  });
}

export type SeasonPlListResponse = {
  ok: true;
  mode: "list";
  rows: SeasonPlListRow[];
};

export type SeasonPlDetailResponse = {
  ok: true;
  mode: "detail";
  detail: SeasonPl;
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const planCycleId = req.nextUrl.searchParams.get("planCycleId");

  try {
    const db = createAdminClient();

    if (planCycleId) {
      const cycles = await loadPlanCycles(db, planCycleId);
      const planCycle = cycles[0];
      if (!planCycle) {
        return NextResponse.json({ ok: false, error: "plan cycle not found or not active" }, { status: 404 });
      }
      const detail = await computeForPlanCycle(db, planCycle);
      if (!detail) {
        return NextResponse.json({ ok: false, error: "failed to compute season PL" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, mode: "detail", detail } satisfies SeasonPlDetailResponse);
    }

    // 一覧: 全 active plan cycle を計算して軽量行に畳む。
    const cycles = await loadPlanCycles(db, null);
    const details = await Promise.all(cycles.map((cycle) => computeForPlanCycle(db, cycle)));
    const rows = details
      .filter((detail): detail is SeasonPl => detail !== null)
      .map(toListRow)
      // 請求額の大きい順 → PJ 順。警告ありを上にしたいので警告を最優先で持ち上げる。
      .sort((a, b) => {
        if (a.hasWarning !== b.hasWarning) return a.hasWarning ? -1 : 1;
        if (b.invoiceTotalYen !== a.invoiceTotalYen) return b.invoiceTotalYen - a.invoiceTotalYen;
        return a.projectId.localeCompare(b.projectId);
      });
    return NextResponse.json({ ok: true, mode: "list", rows } satisfies SeasonPlListResponse);
  } catch (err) {
    console.error("[admin season-pl GET]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
