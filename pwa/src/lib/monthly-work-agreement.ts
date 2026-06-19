import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveCumPctForYm as scheduledEffectiveCumPctForYm,
  milestonePeriod,
  PM_LOCKED_PROGRESS_SOURCES,
  type ProgressAnchor,
} from "@/lib/ms-schedule-shared";
import type {
  MonthlyAgreementStatus,
  MonthlyWorkAgreementRevisionRequest,
  MonthlyWorkAgreementBundle,
  MonthlyWorkAgreementMember,
  MonthlyWorkAgreementMilestone,
  MonthlyWorkAgreementProject,
  MonthlyWorkAgreementRecord,
  MonthlyWorkAgreementSnapshot,
} from "@/lib/monthly-work-agreement-types";

type JsonRecord = Record<string, unknown>;

const SNAPSHOT_VERSION = "monthly_work_agreement.v1" as const;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(obj[key])}`)
    .join(",")}}`;
}

export function hashMonthlyAgreementSnapshot(snapshot: MonthlyWorkAgreementSnapshot): string {
  return createHash("sha256").update(stableJson(snapshot)).digest("hex");
}

export function currentYmJst(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function prevYm(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return m === 1 ? `${y - 1}12` : `${y}${String(m - 1).padStart(2, "0")}`;
}

function inYmRange(
  ym: string,
  row: { start_ym?: string | null; end_ym?: string | null; join_ym?: string | null; leave_ym?: string | null },
) {
  if (row.start_ym && ym < row.start_ym) return false;
  if (row.end_ym && ym > row.end_ym) return false;
  if (row.join_ym && ym < row.join_ym) return false;
  if (row.leave_ym && ym > row.leave_ym) return false;
  return true;
}

function isProjectFrozenForYm(project: JsonRecord, ym: string): boolean {
  if (String(project.status ?? "").toLowerCase() === "frozen") return true;
  const freezeFromYm = typeof project.freeze_from_ym === "string" ? project.freeze_from_ym : null;
  return !!freezeFromYm && ym >= freezeFromYm;
}

function projectHasMonthlyReward(project: JsonRecord, ym: string): boolean {
  const normalized = String(project.status ?? "").toLowerCase();
  return normalized !== "lost" && !isProjectFrozenForYm(project, ym);
}

function projectFreezeActiveForYm(row: JsonRecord, ym: string): boolean {
  const status = String(row.status ?? "").toLowerCase();
  if (status !== "active") return false;
  const freezeFromYm = typeof row.freeze_from_ym === "string" ? row.freeze_from_ym : null;
  const restartYm = typeof row.restart_ym === "string" ? row.restart_ym : null;
  return Boolean(freezeFromYm && freezeFromYm <= ym && (!restartYm || restartYm > ym));
}

function projectCacheFrozenForYm(row: JsonRecord, ym: string): boolean {
  const freezeFromYm = typeof row.freeze_from_ym === "string" ? row.freeze_from_ym : null;
  return Boolean(freezeFromYm && freezeFromYm <= ym);
}

function projectFrozenForYm(project: JsonRecord, freezeRows: JsonRecord[] | undefined, ym: string): boolean {
  return projectCacheFrozenForYm(project, ym) || (freezeRows ?? []).some((row) => projectFreezeActiveForYm(row, ym));
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function yenFromRecord(row: JsonRecord | null, keys: string[]): number | null {
  if (!row) return null;
  for (const key of keys) {
    const value = toNumber(row[key]);
    if (value != null) return Math.max(0, Math.round(value));
  }
  return null;
}

function operatingExpectations(role: { is_pm?: boolean | null; is_pl?: boolean | null }): string[] {
  if (role.is_pm) {
    return [
      "進捗や報酬条件が実態と違う場合はPJコックピットの月次モーダルでPM確認または修正依頼を出す",
      "報告書確認の軽い連絡はSlackで扱う",
    ];
  }
  if (role.is_pl) {
    return ["契約・報酬額に違和感がある場合だけ修正要望で確認する"];
  }
  return ["担当MS/活動ログに沿って当月の遂行内容を進める"];
}

function isPmLockedProgress(row: JsonRecord): boolean {
  return PM_LOCKED_PROGRESS_SOURCES.has(String(row.source ?? ""));
}

function progressRowPct(row: JsonRecord, points: number): number {
  const consumed = toNumber(row.consumed_pt);
  if (consumed != null && points > 0) return Math.max(0, Math.min(100, (consumed / points) * 100));
  return Math.max(0, Math.min(100, toNumber(row.progress_pct) ?? 0));
}

function effectiveCumPctForYm({
  ms,
  plan,
  rows,
  ym,
}: {
  ms: JsonRecord;
  plan: JsonRecord | undefined;
  rows: JsonRecord[];
  ym: string;
}): number | null {
  const { startYm, endYm } = milestonePeriod(
    {
      period_start_ym: typeof ms.period_start_ym === "string" ? ms.period_start_ym : null,
      target_ym: typeof ms.target_ym === "string" ? ms.target_ym : null,
    },
    {
      period_start_ym: typeof plan?.period_start_ym === "string" ? plan.period_start_ym : null,
      period_end_ym: typeof plan?.period_end_ym === "string" ? plan.period_end_ym : null,
    },
  );
  if (!startYm || !endYm) return null;

  const points = toNumber(ms.points) ?? 0;
  const lockedRows = rows
    .filter((row) => String(row.ym ?? "") <= ym)
    .filter(isPmLockedProgress)
    .sort((a, b) => String(a.ym ?? "").localeCompare(String(b.ym ?? "")));
  const exactLocked = lockedRows.find((row) => row.ym === ym);

  const anchorBefore = (targetYm: string): ProgressAnchor | null => {
    let found: ProgressAnchor | null = null;
    for (const row of lockedRows) {
      const rowYm = String(row.ym ?? "");
      if (rowYm >= targetYm) break;
      found = { ym: rowYm, pct: progressRowPct(row, points) };
    }
    return found;
  };
  return scheduledEffectiveCumPctForYm(
    ym,
    startYm,
    endYm,
    anchorBefore(ym),
    exactLocked ? progressRowPct(exactLocked, points) : null
  );
}

function normalizeActiveShares(rows: JsonRecord[], activeMemberIds: Set<string>): Map<string, number> {
  const activeRows = rows
    .map((row) => ({ memberId: String(row.member_id ?? ""), share: toNumber(row.share) ?? 0 }))
    .filter((row) => row.memberId && activeMemberIds.has(row.memberId) && row.share > 0);
  const total = activeRows.reduce((sum, row) => sum + row.share, 0);
  const shares = new Map<string, number>();
  if (total <= 0) return shares;
  for (const row of activeRows) {
    shares.set(row.memberId, Math.round((row.share / total) * 10000) / 10000);
  }
  return shares;
}

function rewardMemberId(member: JsonRecord): string {
  return String(member.memberId ?? member.member_id ?? "").trim();
}

function rewardMemberAgreementPay(member: JsonRecord | null): number | null {
  const basePay = toNumber(member?.basePay ?? member?.base_pay);
  if (basePay != null) return Math.max(0, Math.round(basePay));
  const totalPay = toNumber(member?.totalPay ?? member?.total_pay);
  return totalPay == null ? null : Math.max(0, Math.round(totalPay));
}

function rewardBreakdownMsKey(row: JsonRecord): string {
  return String(row.msKey ?? row.ms_key ?? row.milestoneId ?? row.milestone_id ?? "").trim();
}

function rewardBreakdownPayYen(row: JsonRecord): number {
  return Math.max(0, Math.round(toNumber(row.payYen ?? row.pay_yen) ?? 0));
}

function rewardBreakdownEarnedPt(row: JsonRecord): number | null {
  const earnedPt = toNumber(row.earnedPt ?? row.earned_pt);
  return earnedPt == null ? null : Math.round(earnedPt * 100) / 100;
}

function rewardBreakdownByMs(member: JsonRecord | null): Map<string, { payYen: number; earnedPt: number | null }> {
  const map = new Map<string, { payYen: number; earnedPt: number | null }>();
  const breakdown = Array.isArray(member?.breakdown) ? member.breakdown : [];
  for (const entry of breakdown) {
    const row = asRecord(entry);
    if (!row) continue;
    const milestoneId = rewardBreakdownMsKey(row);
    if (!milestoneId) continue;
    const current = map.get(milestoneId) ?? { payYen: 0, earnedPt: null };
    current.payYen += rewardBreakdownPayYen(row);
    const earnedPt = rewardBreakdownEarnedPt(row);
    if (earnedPt != null) current.earnedPt = Math.round(((current.earnedPt ?? 0) + earnedPt) * 100) / 100;
    map.set(milestoneId, current);
  }
  return map;
}

function toAgreementRecord(row: JsonRecord): MonthlyWorkAgreementRecord {
  return {
    id: String(row.id ?? ""),
    ym: String(row.ym ?? ""),
    memberId: String(row.member_id ?? ""),
    status: String(row.status ?? ""),
    agreedAt: typeof row.agreed_at === "string" ? row.agreed_at : null,
    agreedBy: typeof row.agreed_by === "string" ? row.agreed_by : null,
    snapshotHash: String(row.snapshot_hash ?? ""),
    currentHash: typeof row.current_hash === "string" ? row.current_hash : null,
    invalidatedAt: typeof row.invalidated_at === "string" ? row.invalidated_at : null,
    invalidationReason: typeof row.invalidation_reason === "string" ? row.invalidation_reason : null,
  };
}

export function isMissingMonthlyAgreementTableError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null | undefined;
  return err?.code === "42P01" || /member_monthly_work_agreements/i.test(err?.message ?? "");
}

export function isMissingMonthlyAgreementRequestTableError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null | undefined;
  return err?.code === "42P01" || /member_monthly_work_agreement_requests/i.test(err?.message ?? "");
}

function toRevisionRequest(row: JsonRecord): MonthlyWorkAgreementRevisionRequest {
  return {
    id: String(row.id ?? ""),
    ym: String(row.ym ?? ""),
    memberId: String(row.member_id ?? ""),
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    requestType: String(row.request_type ?? "other"),
    body: String(row.body ?? ""),
    status: String(row.status ?? "open"),
    snapshotHash: typeof row.snapshot_hash === "string" ? row.snapshot_hash : null,
    createdAt: String(row.created_at ?? ""),
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
  };
}

export async function resolveMemberForEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<MonthlyWorkAgreementMember | null> {
  const { data, error } = await supabase
    .from("members")
    .select("member_id, code_name, email, is_admin, exclude_from_payout_notice")
    .ilike("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    memberId: data.member_id,
    codeName: data.code_name || data.member_id,
    email: data.email,
    isAdmin: Boolean(data.is_admin),
    excludeFromPayoutNotice: Boolean(data.exclude_from_payout_notice),
  };
}

export async function buildMonthlyWorkAgreementBundle(
  supabase: SupabaseClient,
  params: { ym: string; memberId: string; viewerMemberId?: string | null },
): Promise<MonthlyWorkAgreementBundle> {
  const ym = params.ym || currentYmJst();
  const prev = prevYm(ym);

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("member_id, code_name, email, is_admin, exclude_from_payout_notice")
    .eq("member_id", params.memberId)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) throw new Error(`member not found: ${params.memberId}`);

  const snapshotMember: MonthlyWorkAgreementMember = {
    memberId: member.member_id,
    codeName: member.code_name || member.member_id,
    email: member.email,
    isAdmin: Boolean(member.is_admin),
    excludeFromPayoutNotice: Boolean(member.exclude_from_payout_notice),
  };

  if (member.exclude_from_payout_notice === true) {
    const snapshot: MonthlyWorkAgreementSnapshot = {
      schemaVersion: SNAPSHOT_VERSION,
      ym,
      member: snapshotMember,
      projects: [],
      totals: {
        expectedRewardYen: 0,
        stockYen: 0,
        projectCount: 0,
        reviewRequiredCount: 0,
      },
    };
    return {
      ym,
      member: snapshotMember,
      snapshot,
      currentHash: hashMonthlyAgreementSnapshot(snapshot),
      status: "not_required",
      latestAgreement: null,
      revisionRequests: [],
      tableReady: true,
      canAgree: false,
      exclusionReason: "支払通知対象外メンバーのため、月初合意は不要です。",
    };
  }

  const { data: projectMembers, error: pmError } = await supabase
    .from("project_members")
    .select("project_id, member_id, role, role_label, is_active, is_pm, is_pl, join_ym, leave_ym")
    .eq("member_id", params.memberId)
    .eq("is_active", true);
  if (pmError) throw pmError;

  const activeMemberships = ((projectMembers ?? []) as Array<JsonRecord>)
    .filter((row) => typeof row.project_id === "string")
    .filter((row) => inYmRange(ym, { join_ym: row.join_ym as string | null, leave_ym: row.leave_ym as string | null }));
  const projectIds = Array.from(new Set(activeMemberships.map((row) => row.project_id as string)));

  const [
    projectsRes,
    freezePeriodsRes,
    cyclesRes,
    plansRes,
  ] = await Promise.all([
    projectIds.length
      ? supabase
          .from("projects")
          .select("project_id, project_name, status, start_ym, end_ym, freeze_from_ym, restart_expected_ym, project_type, project_category, fee_type, fee_amount")
          .in("project_id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase
          .from("project_freeze_periods")
          .select("project_id, freeze_from_ym, restart_ym, status")
          .in("project_id", projectIds)
          .eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase.from("billing_cycles").select("*").in("project_id", projectIds).eq("ym", ym)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase
          .from("value_plan_cycles")
          .select("plan_cycle_id, project_id, status, budget_yen, total_points, period_start_ym, period_end_ym")
          .in("project_id", projectIds)
          .in("status", ["fixed", "confirmed", "active", "draft"])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (freezePeriodsRes.error) throw freezePeriodsRes.error;
  if (cyclesRes.error) throw cyclesRes.error;
  if (plansRes.error) throw plansRes.error;

  const freezePeriodsByProject = new Map<string, JsonRecord[]>();
  for (const row of (freezePeriodsRes.data ?? []) as Array<JsonRecord>) {
    const projectId = row.project_id as string;
    const list = freezePeriodsByProject.get(projectId) ?? [];
    list.push(row);
    freezePeriodsByProject.set(projectId, list);
  }

  const projects = ((projectsRes.data ?? []) as Array<JsonRecord>)
    .filter((row) => projectHasMonthlyReward(row, ym))
    .filter((row) => !projectFrozenForYm(row, freezePeriodsByProject.get(row.project_id as string), ym))
    .filter((row) => inYmRange(ym, { start_ym: row.start_ym as string | null, end_ym: row.end_ym as string | null }));
  const projectMap = new Map(projects.map((row) => [row.project_id as string, row]));
  const cyclesByProject = new Map(((cyclesRes.data ?? []) as Array<JsonRecord>).map((row) => [row.project_id as string, row]));

  const plans = (plansRes.data ?? []) as Array<JsonRecord>;
  const plansByProject = new Map<string, JsonRecord[]>();
  for (const plan of plans) {
    const list = plansByProject.get(plan.project_id as string) ?? [];
    list.push(plan);
    plansByProject.set(plan.project_id as string, list);
  }

  const planIds = plans.map((plan) => plan.plan_cycle_id).filter((id): id is string => typeof id === "string");
  const milestonesRes = planIds.length
    ? await supabase
        .from("value_milestones")
        .select("plan_cycle_id, milestone_id, title, points, tag, is_active, success_criteria, period_start_ym, target_ym")
        .in("plan_cycle_id", planIds)
        .eq("is_active", true)
    : { data: [], error: null };
  if (milestonesRes.error) throw milestonesRes.error;

  const milestones = (milestonesRes.data ?? []) as Array<JsonRecord>;
  const milestoneIds = milestones.map((ms) => ms.milestone_id).filter((id): id is string => typeof id === "string");

  const [responsibilityRes, progressRes, projectActiveMembersRes] = await Promise.all([
    milestoneIds.length
      ? supabase
          .from("milestone_responsibility")
          .select("milestone_id, member_id, share, role, task_description")
          .in("milestone_id", milestoneIds)
      : Promise.resolve({ data: [], error: null }),
    milestoneIds.length
      ? supabase
          .from("milestone_monthly_progress")
          .select("milestone_key, ym, progress_pct, consumed_pt, source, note")
          .in("milestone_key", milestoneIds)
          .lte("ym", ym)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase
          .from("project_members")
          .select("project_id, member_id, is_active, join_ym, leave_ym")
          .in("project_id", projectIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (responsibilityRes.error) throw responsibilityRes.error;
  if (progressRes.error) throw progressRes.error;
  if (projectActiveMembersRes.error) throw projectActiveMembersRes.error;

  const responsibilitiesByMs = new Map<string, JsonRecord[]>();
  for (const row of (responsibilityRes.data ?? []) as Array<JsonRecord>) {
    const milestoneId = row.milestone_id as string;
    const list = responsibilitiesByMs.get(milestoneId) ?? [];
    list.push(row);
    responsibilitiesByMs.set(milestoneId, list);
  }
  const progressByMs = new Map<string, JsonRecord[]>();
  for (const row of (progressRes.data ?? []) as Array<JsonRecord>) {
    const milestoneId = row.milestone_key as string;
    const list = progressByMs.get(milestoneId) ?? [];
    list.push(row);
    progressByMs.set(milestoneId, list);
  }
  const milestonesByPlan = new Map<string, JsonRecord[]>();
  for (const ms of milestones) {
    const list = milestonesByPlan.get(ms.plan_cycle_id as string) ?? [];
    list.push(ms);
    milestonesByPlan.set(ms.plan_cycle_id as string, list);
  }
  const activeMemberIdsByProject = new Map<string, Set<string>>();
  for (const row of (projectActiveMembersRes.data ?? []) as Array<JsonRecord>) {
    if (!inYmRange(ym, { join_ym: row.join_ym as string | null, leave_ym: row.leave_ym as string | null })) continue;
    const projectId = row.project_id as string;
    const set = activeMemberIdsByProject.get(projectId) ?? new Set<string>();
    set.add(row.member_id as string);
    activeMemberIdsByProject.set(projectId, set);
  }

  const snapshotProjects: MonthlyWorkAgreementProject[] = activeMemberships
    .filter((membership) => projectMap.has(membership.project_id as string))
    .map((membership): MonthlyWorkAgreementProject | null => {
      const projectId = membership.project_id as string;
      const project = projectMap.get(projectId)!;
      const cycle = cyclesByProject.get(projectId);
      const roleMilestones: MonthlyWorkAgreementMilestone[] = [];
      const projectPlans = plansByProject.get(projectId) ?? [];
      const plan =
        projectPlans.find((p) => String(p.status) === "fixed" && ym >= String(p.period_start_ym) && ym <= String(p.period_end_ym)) ??
        projectPlans.find((p) => ym >= String(p.period_start_ym) && ym <= String(p.period_end_ym)) ??
        projectPlans[0];
      const planMilestones = plan ? milestonesByPlan.get(plan.plan_cycle_id as string) ?? [] : [];
      const activeProjectMemberIds = activeMemberIdsByProject.get(projectId) ?? new Set<string>([params.memberId]);
      const monthlyConsumedByMs = new Map<string, { progressPct: number | null; monthlyProgressPct: number | null; consumedPt: number }>();
      const normalizedSharesByMs = new Map<string, Map<string, number>>();
      const rewardSummary = asRecord(cycle?.reward_summary_json);
      const rewardSummaryMembers = Array.isArray(rewardSummary?.members)
        ? (rewardSummary.members as unknown[]).map(asRecord).filter((member): member is JsonRecord => member != null)
        : null;
      const rewardMember = rewardSummaryMembers?.find((member) => rewardMemberId(member) === params.memberId) ?? null;
      const payoutYen = yenFromRecord(rewardMember, ["totalPay", "total_pay"]);
      const stockYen = yenFromRecord(rewardMember, ["stockYen", "stock_yen", "deferredYen", "deferred_yen"]);
      const grossDueYen = yenFromRecord(rewardMember, ["grossDueYen", "gross_due_yen"]);
      const carryInYen = yenFromRecord(rewardMember, ["carryInYen", "carry_in_yen"]);
      const rewardBreakdown = rewardBreakdownByMs(rewardMember);
      const rewardSummaryReady = rewardSummaryMembers != null;
      const memberAgreementPay = rewardMember
        ? rewardMemberAgreementPay(rewardMember)
        : rewardSummaryReady
          ? 0
          : null;

      for (const ms of planMilestones) {
        const milestoneId = ms.milestone_id as string;
        const points = toNumber(ms.points) ?? 0;
        const progressRows = progressByMs.get(milestoneId) ?? [];
        const progressPct = effectiveCumPctForYm({ ms, plan, rows: progressRows, ym });
        const prevPct = effectiveCumPctForYm({ ms, plan, rows: progressRows, ym: prev }) ?? 0;
        const monthlyProgressPct = progressPct == null ? null : Math.max(0, progressPct - prevPct);
        const consumedPt = monthlyProgressPct == null
          ? 0
          : Math.round(Math.max(0, (points * monthlyProgressPct) / 100) * 100) / 100;
        monthlyConsumedByMs.set(milestoneId, { progressPct, monthlyProgressPct, consumedPt });

        const shares = normalizeActiveShares(responsibilitiesByMs.get(milestoneId) ?? [], activeProjectMemberIds);
        normalizedSharesByMs.set(milestoneId, shares);
      }

      for (const ms of planMilestones) {
        const milestoneId = ms.milestone_id as string;
        const respRows = (responsibilitiesByMs.get(milestoneId) ?? []).filter((row) => row.member_id === params.memberId);
        const plannedShare = respRows.reduce((sum, row) => sum + (toNumber(row.share) ?? 0), 0);
        const normalizedShare = normalizedSharesByMs.get(milestoneId)?.get(params.memberId) ?? 0;
        if (plannedShare <= 0 && normalizedShare <= 0) continue;
        const monthly = monthlyConsumedByMs.get(milestoneId) ?? { progressPct: null, monthlyProgressPct: null, consumedPt: 0 };
        const fallbackEarnedPt = Math.round(monthly.consumedPt * normalizedShare * 100) / 100;
        const rewardLine = rewardBreakdown.get(milestoneId);
        const earnedPt = rewardLine?.earnedPt ?? fallbackEarnedPt;
        const expectedRewardYen = rewardSummaryReady ? rewardLine?.payYen ?? 0 : null;
        roleMilestones.push({
          milestoneId,
          title: String(ms.title ?? milestoneId),
          points: toNumber(ms.points) ?? 0,
          plannedShare: plannedShare > 0 ? plannedShare : null,
          role: respRows.map((row) => String(row.role ?? "")).filter(Boolean).join(" / ") || null,
          taskDescription:
            respRows.map((row) => String(row.task_description ?? "")).filter(Boolean).join(" / ") || null,
          progressPct: monthly.progressPct,
          monthlyProgressPct: monthly.monthlyProgressPct,
          expectedRewardYen,
          earnedPt,
          conditions: [],
          state: monthly.progressPct == null || !rewardSummaryReady ? "review_required" : "ready",
        });
      }

      const sortedMilestones = roleMilestones.sort((a, b) => a.milestoneId.localeCompare(b.milestoneId));
      let assignedReward = 0;
      const pricedMilestones = sortedMilestones.filter((ms) => ms.expectedRewardYen != null);
      const rewardfulMilestones = pricedMilestones.filter((ms) => (ms.expectedRewardYen ?? 0) > 0);
      const breakdownRewardYen = rewardfulMilestones.reduce((sum, ms) => sum + (ms.expectedRewardYen ?? 0), 0);
      const expectedRewardYen = pricedMilestones.length > 0
        ? pricedMilestones.reduce((sum, ms) => sum + (ms.expectedRewardYen ?? 0), 0)
        : null;
      const lastRewardId = rewardfulMilestones[rewardfulMilestones.length - 1]?.milestoneId;
      const displayMilestones = expectedRewardYen == null
        ? sortedMilestones
        : sortedMilestones.map((ms) => {
            if (ms.expectedRewardYen == null || ms.expectedRewardYen <= 0) return ms;
            const rounded = ms.milestoneId === lastRewardId
              ? Math.max(0, expectedRewardYen - assignedReward)
              : ms.expectedRewardYen;
            assignedReward += rounded;
            return { ...ms, expectedRewardYen: rounded };
          });

      if (expectedRewardYen == null && roleMilestones.length === 0) return null;

      const reviewReasons: string[] = [];
      if (!cycle) reviewReasons.push("billing_cycles が未作成");
      if (!rewardSummaryReady) reviewReasons.push("報酬キャッシュが未作成");
      if (memberAgreementPay != null && memberAgreementPay > 0 && breakdownRewardYen <= 0) {
        reviewReasons.push("報酬キャッシュのMS別内訳が未設定");
      }
      if (memberAgreementPay != null && breakdownRewardYen > 0 && Math.abs(memberAgreementPay - breakdownRewardYen) > 1) {
        reviewReasons.push("報酬キャッシュのPJ合計とMS別内訳が不一致");
      }
      if (plan == null) reviewReasons.push("value plan が未設定");
      if (roleMilestones.length === 0 && plan) reviewReasons.push("当月の担当MS/shareが未設定");

      const conditionState: MonthlyWorkAgreementProject["conditionState"] =
        reviewReasons.length > 0 || roleMilestones.some((ms) => ms.state === "review_required")
          ? "review_required"
          : "ready";

      return {
        projectId,
        projectName: String(project.project_name ?? projectId),
        projectStatus: String(project.status ?? "unknown"),
        roleLabel: String(membership.role_label ?? membership.role ?? "") || null,
        isPm: membership.is_pm === true,
        isPl: membership.is_pl === true,
        billingStatus: typeof cycle?.status === "string" ? cycle.status : null,
        allocationStatus: cycle?.budget_confirmed_at ? "confirmed" : cycle?.budget_reported_at ? "reported" : "not_set",
        expectedRewardYen,
        payoutYen,
        stockYen,
        grossDueYen,
        carryInYen,
        earnedPt: sortedMilestones.reduce((sum, ms) => sum + (ms.earnedPt ?? 0), 0),
        conditionState,
        conditions: [],
        reviewReasons,
        milestones: displayMilestones,
        operatingExpectations: operatingExpectations(membership),
      };
    })
    .filter((project): project is MonthlyWorkAgreementProject => project != null)
    .sort((a, b) => (b.expectedRewardYen ?? 0) - (a.expectedRewardYen ?? 0) || a.projectId.localeCompare(b.projectId));

  const snapshot: MonthlyWorkAgreementSnapshot = {
    schemaVersion: SNAPSHOT_VERSION,
    ym,
    member: snapshotMember,
    projects: snapshotProjects,
    totals: {
      expectedRewardYen: snapshotProjects.reduce((sum, project) => sum + (project.expectedRewardYen ?? 0), 0),
      stockYen: snapshotProjects.reduce((sum, project) => sum + (project.stockYen ?? 0), 0),
      projectCount: snapshotProjects.length,
      reviewRequiredCount: snapshotProjects.filter((project) => project.conditionState === "review_required").length,
    },
  };
  const currentHash = hashMonthlyAgreementSnapshot(snapshot);

  let latestAgreement: MonthlyWorkAgreementRecord | null = null;
  let tableReady = true;
  const { data: agreementData, error: agreementError } = await supabase
    .from("member_monthly_work_agreements")
    .select("id, ym, member_id, status, agreed_at, agreed_by, snapshot_hash, current_hash, invalidated_at, invalidation_reason")
    .eq("ym", ym)
    .eq("member_id", params.memberId)
    .in("status", ["agreed", "superseded", "revoked"])
    .order("agreed_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (agreementError) {
    if (isMissingMonthlyAgreementTableError(agreementError)) {
      tableReady = false;
    } else {
      throw agreementError;
    }
  } else if (agreementData?.[0]) {
    latestAgreement = toAgreementRecord(agreementData[0] as JsonRecord);
  }

  let revisionRequests: MonthlyWorkAgreementRevisionRequest[] = [];
  const { data: requestData, error: requestError } = await supabase
    .from("member_monthly_work_agreement_requests")
    .select("id, ym, member_id, project_id, request_type, body, status, snapshot_hash, created_at, resolved_at")
    .eq("ym", ym)
    .eq("member_id", params.memberId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (requestError) {
    if (!isMissingMonthlyAgreementRequestTableError(requestError)) throw requestError;
  } else {
    revisionRequests = ((requestData ?? []) as Array<JsonRecord>).map(toRevisionRequest);
  }

  const status: MonthlyAgreementStatus =
    latestAgreement?.status === "agreed" && latestAgreement.snapshotHash === currentHash
      ? "agreed"
      : latestAgreement?.status === "agreed"
        ? "needs_reagreement"
        : "pending";

  return {
    ym,
    member: snapshotMember,
    snapshot,
    currentHash,
    status,
    latestAgreement,
    revisionRequests,
    tableReady,
    canAgree: tableReady && (!params.viewerMemberId || params.viewerMemberId === params.memberId),
  };
}

export async function listActiveAgreementMemberIds(supabase: SupabaseClient, ym: string): Promise<string[]> {
  const [
    { data: members, error: membersError },
    { data: projectMembers, error: pmError },
    { data: projects, error: projectsError },
    { data: freezePeriods, error: freezePeriodsError },
  ] =
    await Promise.all([
      supabase.from("members").select("member_id, status, exclude_from_payout_notice").eq("status", "active"),
      supabase.from("project_members").select("project_id, member_id, is_active, join_ym, leave_ym").eq("is_active", true),
      supabase
        .from("projects")
        .select("project_id, status, start_ym, end_ym, freeze_from_ym, restart_expected_ym")
        .neq("status", "lost")
        .neq("status", "frozen"),
      supabase
        .from("project_freeze_periods")
        .select("project_id, freeze_from_ym, restart_ym, status")
        .eq("status", "active"),
    ]);
  if (membersError) throw membersError;
  if (pmError) throw pmError;
  if (projectsError) throw projectsError;
  if (freezePeriodsError) throw freezePeriodsError;

  const activeMembers = new Set(
    ((members ?? []) as Array<JsonRecord>)
      .filter((row) => row.exclude_from_payout_notice !== true)
      .map((row) => row.member_id as string),
  );
  const freezePeriodsByProject = new Map<string, JsonRecord[]>();
  for (const row of (freezePeriods ?? []) as Array<JsonRecord>) {
    const projectId = row.project_id as string;
    const list = freezePeriodsByProject.get(projectId) ?? [];
    list.push(row);
    freezePeriodsByProject.set(projectId, list);
  }
  const activeProjects = new Set(
    ((projects ?? []) as Array<JsonRecord>)
      .filter((row) => projectHasMonthlyReward(row, ym))
      .filter((row) => inYmRange(ym, { start_ym: row.start_ym as string | null, end_ym: row.end_ym as string | null }))
      .filter((row) => !projectFrozenForYm(row, freezePeriodsByProject.get(row.project_id as string), ym))
      .map((row) => row.project_id as string),
  );

  return Array.from(
    new Set(
      ((projectMembers ?? []) as Array<JsonRecord>)
        .filter((row) => activeMembers.has(row.member_id as string))
        .filter((row) => activeProjects.has(row.project_id as string))
        .filter((row) => inYmRange(ym, { join_ym: row.join_ym as string | null, leave_ym: row.leave_ym as string | null }))
        .map((row) => row.member_id as string),
    ),
  ).sort();
}
