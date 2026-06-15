import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
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

function findRewardMember(summary: unknown, memberId: string): JsonRecord | null {
  const json = summary as JsonRecord | null | undefined;
  const members = json?.members;
  if (Array.isArray(members)) {
    return (members.find((m) => (m as JsonRecord).memberId === memberId) as JsonRecord | undefined) ?? null;
  }
  if (members && typeof members === "object") {
    const byId = (members as Record<string, unknown>)[memberId];
    return byId && typeof byId === "object" ? (byId as JsonRecord) : null;
  }
  return null;
}

function formatRewardSource(cycle: JsonRecord | undefined, reward: JsonRecord | null, allocation: number | null) {
  if (reward) return "reward_summary_json.members";
  if (allocation != null) return "member_allocations_json";
  if (!cycle) return "billing_cycles 未作成";
  return "報酬キャッシュ未生成";
}

function projectHasMonthlyReward(status: unknown): boolean {
  const normalized = String(status ?? "").toLowerCase();
  return normalized !== "lost" && normalized !== "frozen";
}

function routineExpectations(role: { is_pm?: boolean | null; is_pl?: boolean | null }): string[] {
  if (role.is_pm) {
    return [
      "請求額確定、報告会日程調整、月次報告書FIX、請求書発行/送付の月次ルーティンを進める",
      "進捗や報酬条件が実態と違う場合はPJコックピットの月次モーダルでPM確定または修正依頼を出す",
    ];
  }
  if (role.is_pl) {
    return ["請求額確定のPL確認が必要な場合に対応する"];
  }
  return ["担当MS/活動ログに沿って当月の遂行内容を進める"];
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
    .select("member_id, code_name, email, is_admin")
    .ilike("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    memberId: data.member_id,
    codeName: data.code_name || data.member_id,
    email: data.email,
    isAdmin: Boolean(data.is_admin),
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
    .select("member_id, code_name, email, is_admin")
    .eq("member_id", params.memberId)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) throw new Error(`member not found: ${params.memberId}`);

  const snapshotMember: MonthlyWorkAgreementMember = {
    memberId: member.member_id,
    codeName: member.code_name || member.member_id,
    email: member.email,
    isAdmin: Boolean(member.is_admin),
  };

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
    cyclesRes,
    plansRes,
  ] = await Promise.all([
    projectIds.length
      ? supabase
          .from("projects")
          .select("project_id, project_name, status, start_ym, end_ym, project_type, project_category, fee_amount")
          .in("project_id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase.from("billing_cycles").select("*").in("project_id", projectIds).eq("ym", ym)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase
          .from("value_plan_cycles")
          .select("plan_cycle_id, project_id, status, total_points, period_start_ym, period_end_ym")
          .in("project_id", projectIds)
          .in("status", ["fixed", "confirmed", "active", "draft"])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (cyclesRes.error) throw cyclesRes.error;
  if (plansRes.error) throw plansRes.error;

  const projects = ((projectsRes.data ?? []) as Array<JsonRecord>)
    .filter((row) => projectHasMonthlyReward(row.status))
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
        .select("plan_cycle_id, milestone_id, title, points, tag, is_active, success_criteria")
        .in("plan_cycle_id", planIds)
        .eq("is_active", true)
    : { data: [], error: null };
  if (milestonesRes.error) throw milestonesRes.error;

  const milestones = (milestonesRes.data ?? []) as Array<JsonRecord>;
  const milestoneIds = milestones.map((ms) => ms.milestone_id).filter((id): id is string => typeof id === "string");

  const [responsibilityRes, progressRes] = await Promise.all([
    milestoneIds.length
      ? supabase
          .from("milestone_responsibility")
          .select("milestone_id, member_id, share, role, task_description")
          .eq("member_id", params.memberId)
          .in("milestone_id", milestoneIds)
      : Promise.resolve({ data: [], error: null }),
    milestoneIds.length
      ? supabase
          .from("milestone_monthly_progress")
          .select("milestone_key, ym, progress_pct, source, note")
          .in("milestone_key", milestoneIds)
          .in("ym", [ym, prev])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (responsibilityRes.error) throw responsibilityRes.error;
  if (progressRes.error) throw progressRes.error;

  const responsibilitiesByMs = new Map<string, JsonRecord[]>();
  for (const row of (responsibilityRes.data ?? []) as Array<JsonRecord>) {
    const milestoneId = row.milestone_id as string;
    const list = responsibilitiesByMs.get(milestoneId) ?? [];
    list.push(row);
    responsibilitiesByMs.set(milestoneId, list);
  }
  const progressByKey = new Map(
    ((progressRes.data ?? []) as Array<JsonRecord>).map((row) => [`${row.milestone_key}_${row.ym}`, row]),
  );
  const milestonesByPlan = new Map<string, JsonRecord[]>();
  for (const ms of milestones) {
    const list = milestonesByPlan.get(ms.plan_cycle_id as string) ?? [];
    list.push(ms);
    milestonesByPlan.set(ms.plan_cycle_id as string, list);
  }

  const snapshotProjects: MonthlyWorkAgreementProject[] = activeMemberships
    .filter((membership) => projectMap.has(membership.project_id as string))
    .map((membership) => {
      const projectId = membership.project_id as string;
      const project = projectMap.get(projectId)!;
      const cycle = cyclesByProject.get(projectId);
      const allocJson = cycle?.member_allocations_json as JsonRecord | null | undefined;
      const allocation = toNumber(allocJson?.[params.memberId]);
      const reward = findRewardMember(cycle?.reward_summary_json, params.memberId);
      const expectedRewardYen = toNumber(reward?.totalPay) ?? allocation;
      const earnedPt = toNumber(reward?.earnedPt);
      const roleMilestones: MonthlyWorkAgreementMilestone[] = [];
      const projectPlans = plansByProject.get(projectId) ?? [];
      const plan =
        projectPlans.find((p) => String(p.status) === "fixed" && ym >= String(p.period_start_ym) && ym <= String(p.period_end_ym)) ??
        projectPlans.find((p) => ym >= String(p.period_start_ym) && ym <= String(p.period_end_ym)) ??
        projectPlans[0];
      const rewardBreakdown = Array.isArray(reward?.breakdown) ? (reward?.breakdown as JsonRecord[]) : [];
      const rewardByMs = new Map(rewardBreakdown.map((row) => [String(row.msKey ?? row.milestoneId ?? ""), row]));

      for (const ms of plan ? milestonesByPlan.get(plan.plan_cycle_id as string) ?? [] : []) {
        const milestoneId = ms.milestone_id as string;
        const respRows = responsibilitiesByMs.get(milestoneId) ?? [];
        const rewardRow = rewardByMs.get(milestoneId);
        if (respRows.length === 0 && !rewardRow) continue;
        const current = progressByKey.get(`${milestoneId}_${ym}`);
        const previous = progressByKey.get(`${milestoneId}_${prev}`);
        const progressPct = toNumber(current?.progress_pct);
        const prevPct = toNumber(previous?.progress_pct) ?? 0;
        const monthlyProgressPct = progressPct == null ? null : Math.max(0, progressPct - prevPct);
        const plannedShare = respRows.reduce((sum, row) => sum + (toNumber(row.share) ?? 0), 0);
        const conditions = [
          `MS進捗 source: ${String(current?.source ?? "未生成")}`,
          typeof ms.success_criteria === "string" && ms.success_criteria.trim()
            ? `成功条件: ${ms.success_criteria.trim()}`
            : "成功条件未設定",
        ];
        roleMilestones.push({
          milestoneId,
          title: String(ms.title ?? milestoneId),
          points: toNumber(ms.points) ?? 0,
          plannedShare: plannedShare > 0 ? plannedShare : null,
          role: respRows.map((row) => String(row.role ?? "")).filter(Boolean).join(" / ") || null,
          taskDescription:
            respRows.map((row) => String(row.task_description ?? "")).filter(Boolean).join(" / ") || null,
          progressPct,
          monthlyProgressPct,
          expectedRewardYen: toNumber(rewardRow?.basePay ?? rewardRow?.totalPay),
          earnedPt: toNumber(rewardRow?.earnedPt),
          conditions,
          state: progressPct == null ? "review_required" : "ready",
        });
      }

      const reviewReasons: string[] = [];
      if (!cycle) reviewReasons.push("billing_cycles が未作成");
      if (!reward && allocation == null) reviewReasons.push("報酬キャッシュが未生成");
      if (plan == null) reviewReasons.push("固定 value plan が未設定");
      if (roleMilestones.length === 0 && plan) reviewReasons.push("当月の担当MS/shareが未設定");

      const conditions = [
        `報酬表示 source: ${formatRewardSource(cycle, reward, allocation)}`,
        "報酬計算そのものはこの合意では変更しない",
      ];
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
        earnedPt,
        conditionState,
        conditions,
        reviewReasons,
        milestones: roleMilestones.sort((a, b) => a.milestoneId.localeCompare(b.milestoneId)),
        routineExpectations: routineExpectations(membership),
      };
    })
    .sort((a, b) => (b.expectedRewardYen ?? 0) - (a.expectedRewardYen ?? 0) || a.projectId.localeCompare(b.projectId));

  const snapshot: MonthlyWorkAgreementSnapshot = {
    schemaVersion: SNAPSHOT_VERSION,
    ym,
    member: snapshotMember,
    projects: snapshotProjects,
    totals: {
      expectedRewardYen: snapshotProjects.reduce((sum, project) => sum + (project.expectedRewardYen ?? 0), 0),
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
  const [{ data: members, error: membersError }, { data: projectMembers, error: pmError }, { data: projects, error: projectsError }] =
    await Promise.all([
      supabase.from("members").select("member_id, status").eq("status", "active"),
      supabase.from("project_members").select("project_id, member_id, is_active, join_ym, leave_ym").eq("is_active", true),
      supabase.from("projects").select("project_id, status, start_ym, end_ym").neq("status", "lost").neq("status", "frozen"),
    ]);
  if (membersError) throw membersError;
  if (pmError) throw pmError;
  if (projectsError) throw projectsError;

  const activeMembers = new Set(((members ?? []) as Array<JsonRecord>).map((row) => row.member_id as string));
  const activeProjects = new Set(
    ((projects ?? []) as Array<JsonRecord>)
      .filter((row) => inYmRange(ym, { start_ym: row.start_ym as string | null, end_ym: row.end_ym as string | null }))
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
