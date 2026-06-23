import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMonthlyWorkAgreementBundle,
  isMonthlyWorkAgreementPayoutGateMigrationYm,
} from "@/lib/monthly-work-agreement";

const OVERRIDE_REASON_MIN_LENGTH = 8;

export type PayoutAgreementGateTargetAction =
  | "view"
  | "save_payout_data"
  | "issue_notice_pdf"
  | "preview_notice_pdf"
  | "bulk_issue_notice_pdf"
  | "bulk_preview_notice_pdf"
  | "send_notice_email"
  | "mark_notice_sent"
  | "cron_payout_notice_prebuild";

export type PayoutAgreementGateStatus =
  | "not_required"
  | "pending"
  | "agreed"
  | "stale"
  | "revision_requested"
  | "admin_override";

export type PayoutAgreementGateBlockerStatus = Extract<
  PayoutAgreementGateStatus,
  "pending" | "stale" | "revision_requested"
>;

export type PayoutAgreementGateEntry = {
  project_id: string;
  ym: string;
  member_id: string;
  total_pay?: number | string | null;
};

export type PayoutAgreementGateMember = {
  member_id: string;
  code_name?: string | null;
  member_name?: string | null;
  contractor_name?: string | null;
  is_officer?: boolean | null;
  exclude_from_payout_notice?: boolean | null;
};

export type PayoutAgreementGateProject = {
  project_id: string;
  project_name?: string | null;
  client_name?: string | null;
  status?: string | null;
  start_ym?: string | null;
  end_ym?: string | null;
  freeze_from_ym?: string | null;
  restart_expected_ym?: string | null;
};

export type PayoutAgreementGateRow = {
  key: string;
  paymentYm: string;
  sourceYm: string;
  memberId: string;
  memberName: string;
  projectId: string;
  projectName: string;
  totalPay: number;
  required: boolean;
  status: PayoutAgreementGateStatus;
  reason: string;
  latestAgreedAt: string | null;
  snapshotHash: string | null;
  currentHash: string | null;
  requestId: string | null;
  requestCreatedAt: string | null;
};

export type PayoutAgreementGateSummary = {
  paymentYm: string;
  targetAction: PayoutAgreementGateTargetAction;
  checkedAt: string;
  totalTargets: number;
  requiredCount: number;
  notRequiredCount: number;
  agreedCount: number;
  blockedCount: number;
  overrideCount: number;
  allowed: boolean;
  rows: PayoutAgreementGateRow[];
  blockers: PayoutAgreementGateRow[];
};

type BuildOptions = {
  paymentYm: string;
  targetAction: PayoutAgreementGateTargetAction;
  entries: PayoutAgreementGateEntry[];
  members: PayoutAgreementGateMember[];
  projects: PayoutAgreementGateProject[];
};

type EnforceOptions = BuildOptions & {
  overrideReason?: string | null;
  actorEmail?: string | null;
};

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function yenValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
}

function inYmRange(ym: string, project: PayoutAgreementGateProject | undefined): boolean {
  if (!project) return true;
  if (project.start_ym && ym < project.start_ym) return false;
  if (project.end_ym && ym > project.end_ym) return false;
  return true;
}

function memberName(member: PayoutAgreementGateMember | undefined, memberId: string): string {
  return textValue(member?.contractor_name) || textValue(member?.code_name) || textValue(member?.member_name) || memberId;
}

function projectName(project: PayoutAgreementGateProject | undefined, projectId: string): string {
  return textValue(project?.project_name) || textValue(project?.client_name) || projectId;
}

function projectIsExcluded(project: PayoutAgreementGateProject | undefined, sourceYm: string): string | null {
  const status = textValue(project?.status).toLowerCase();
  if (status === "frozen") return "frozen PJ は月初合意・支払 gate の対象外";
  if (status === "lost") return "終了/lost PJ は月初合意・支払 gate の対象外";
  if (project?.freeze_from_ym && project.freeze_from_ym <= sourceYm) {
    return "freeze_from_ym 到達後の PJ は月初合意・支払 gate の対象外";
  }
  if (!inYmRange(sourceYm, project)) return "PJ の active 期間外なので月初合意・支払 gate の対象外";
  return null;
}

function openRevisionRequest(bundle: Awaited<ReturnType<typeof buildMonthlyWorkAgreementBundle>>, projectId: string) {
  return bundle.revisionRequests.find(
    (request) => request.status === "open" && (request.projectId == null || request.projectId === projectId)
  );
}

function dedupeTargets(entries: PayoutAgreementGateEntry[]): PayoutAgreementGateEntry[] {
  const byKey = new Map<string, PayoutAgreementGateEntry>();
  for (const entry of entries) {
    const totalPay = yenValue(entry.total_pay);
    if (totalPay <= 0) continue;
    const key = `${entry.project_id}:${entry.ym}:${entry.member_id}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { ...entry, total_pay: totalPay });
    } else {
      byKey.set(key, { ...current, total_pay: yenValue(current.total_pay) + totalPay });
    }
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.ym !== b.ym) return a.ym.localeCompare(b.ym);
    if (a.member_id !== b.member_id) return a.member_id.localeCompare(b.member_id);
    return a.project_id.localeCompare(b.project_id);
  });
}

function isBlocker(row: PayoutAgreementGateRow): row is PayoutAgreementGateRow & { status: PayoutAgreementGateBlockerStatus } {
  return row.status === "pending" || row.status === "stale" || row.status === "revision_requested";
}

export function payoutAgreementGateErrorMessage(summary: PayoutAgreementGateSummary): string {
  if (summary.blockedCount <= 0) return "";
  const preview = summary.blockers
    .slice(0, 3)
    .map((row) => `${row.memberName}/${row.projectName}/${row.sourceYm}:${row.reason}`)
    .join(" / ");
  const suffix = summary.blockedCount > 3 ? ` 他${summary.blockedCount - 3}件` : "";
  return `月初合意が未完了の支払対象があるため処理を止めた: ${preview}${suffix}`;
}

export async function buildPayoutAgreementGateSummary(
  supabase: SupabaseClient,
  options: BuildOptions
): Promise<PayoutAgreementGateSummary> {
  const membersById = new Map(options.members.map((member) => [member.member_id, member]));
  const projectsById = new Map(options.projects.map((project) => [project.project_id, project]));
  const bundleCache = new Map<string, Awaited<ReturnType<typeof buildMonthlyWorkAgreementBundle>>>();
  const rows: PayoutAgreementGateRow[] = [];

  for (const entry of dedupeTargets(options.entries)) {
    const totalPay = yenValue(entry.total_pay);
    const member = membersById.get(entry.member_id);
    const project = projectsById.get(entry.project_id);
    const base = {
      key: `${entry.member_id}:${entry.project_id}:${entry.ym}`,
      paymentYm: options.paymentYm,
      sourceYm: entry.ym,
      memberId: entry.member_id,
      memberName: memberName(member, entry.member_id),
      projectId: entry.project_id,
      projectName: projectName(project, entry.project_id),
      totalPay,
      latestAgreedAt: null,
      snapshotHash: null,
      currentHash: null,
      requestId: null,
      requestCreatedAt: null,
    };

    if (isMonthlyWorkAgreementPayoutGateMigrationYm(entry.ym)) {
      rows.push({
        ...base,
        required: true,
        status: "agreed",
        reason: "月初合意の導入前/移行月のため合意済み扱い",
      });
      continue;
    }

    if (member?.is_officer || member?.exclude_from_payout_notice) {
      rows.push({
        ...base,
        required: false,
        status: "not_required",
        reason: "役員または支払通知対象外メンバー",
      });
      continue;
    }

    const projectExclusionReason = projectIsExcluded(project, entry.ym);
    if (projectExclusionReason) {
      rows.push({
        ...base,
        required: false,
        status: "not_required",
        reason: projectExclusionReason,
      });
      continue;
    }

    const cacheKey = `${entry.member_id}:${entry.ym}`;
    let bundle = bundleCache.get(cacheKey);
    try {
      if (!bundle) {
        bundle = await buildMonthlyWorkAgreementBundle(supabase, {
          ym: entry.ym,
          memberId: entry.member_id,
        });
        bundleCache.set(cacheKey, bundle);
      }
    } catch (err) {
      rows.push({
        ...base,
        required: true,
        status: "pending",
        reason: err instanceof Error ? `月初合意 snapshot を取得できない: ${err.message}` : "月初合意 snapshot を取得できない",
      });
      continue;
    }

    const snapshotProject = bundle.snapshot.projects.find((item) => item.projectId === entry.project_id);
    const request = openRevisionRequest(bundle, entry.project_id);
    const agreementBase = {
      ...base,
      latestAgreedAt: bundle.latestAgreement?.agreedAt ?? null,
      snapshotHash: bundle.latestAgreement?.snapshotHash ?? null,
      currentHash: bundle.currentHash,
      requestId: request?.id ?? null,
      requestCreatedAt: request?.createdAt ?? null,
    };

    if (request) {
      rows.push({
        ...agreementBase,
        required: true,
        status: "revision_requested",
        reason: request.projectId ? "このPJに open 修正要望がある" : "メンバー全体の open 修正要望がある",
      });
      continue;
    }

    if (!bundle.tableReady) {
      rows.push({
        ...agreementBase,
        required: true,
        status: "pending",
        reason: "月初合意テーブルが未適用",
      });
      continue;
    }

    if (!snapshotProject) {
      rows.push({
        ...agreementBase,
        required: true,
        status: "pending",
        reason: "支払対象だが月初合意 snapshot にこのPJが無い",
      });
      continue;
    }

    if (bundle.status === "pending") {
      rows.push({
        ...agreementBase,
        required: true,
        status: "pending",
        reason: "本人の月初合意が未完了",
      });
      continue;
    }

    if (bundle.status === "needs_reagreement") {
      rows.push({
        ...agreementBase,
        required: true,
        status: "stale",
        reason: "合意後に月初条件 snapshot hash が更新された",
      });
      continue;
    }

    rows.push({
      ...agreementBase,
      required: true,
      status: "agreed",
      reason: "月初合意済み",
    });
  }

  const blockers = rows.filter(isBlocker);
  const requiredRows = rows.filter((row) => row.required);
  return {
    paymentYm: options.paymentYm,
    targetAction: options.targetAction,
    checkedAt: new Date().toISOString(),
    totalTargets: rows.length,
    requiredCount: requiredRows.length,
    notRequiredCount: rows.filter((row) => !row.required).length,
    agreedCount: rows.filter((row) => row.status === "agreed").length,
    blockedCount: blockers.length,
    overrideCount: rows.filter((row) => row.status === "admin_override").length,
    allowed: blockers.length === 0,
    rows,
    blockers,
  };
}

function isMissingOverrideTableError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null | undefined;
  return err?.code === "42P01" || /member_monthly_work_agreement_payout_overrides/i.test(err?.message ?? "");
}

async function recordOverrides(
  supabase: SupabaseClient,
  summary: PayoutAgreementGateSummary,
  reason: string,
  actorEmail: string
) {
  if (summary.blockers.length === 0) return;
  const rows = summary.blockers.map((row) => ({
    payment_ym: row.paymentYm,
    source_ym: row.sourceYm,
    member_id: row.memberId,
    project_id: row.projectId,
    target_action: summary.targetAction,
    blocker_status: row.status,
    reason,
    actor_email: actorEmail,
    snapshot_hash: row.snapshotHash,
    current_hash: row.currentHash,
    request_id: row.requestId,
    metadata_json: {
      memberName: row.memberName,
      projectName: row.projectName,
      totalPay: row.totalPay,
      blockerReason: row.reason,
      checkedAt: summary.checkedAt,
    },
  }));
  const { error } = await supabase.from("member_monthly_work_agreement_payout_overrides").insert(rows);
  if (error) {
    if (isMissingOverrideTableError(error)) {
      throw new Error("member_monthly_work_agreement_payout_overrides table is missing; admin override cannot be audited");
    }
    throw error;
  }
}

export async function enforcePayoutAgreementGate(
  supabase: SupabaseClient,
  options: EnforceOptions
): Promise<PayoutAgreementGateSummary> {
  const summary = await buildPayoutAgreementGateSummary(supabase, options);
  if (summary.allowed) return summary;

  const reason = textValue(options.overrideReason);
  if (!reason || reason.length < OVERRIDE_REASON_MIN_LENGTH) return summary;

  const actorEmail = textValue(options.actorEmail);
  if (!actorEmail) return summary;

  await recordOverrides(supabase, summary, reason, actorEmail);
  const rows = summary.rows.map((row): PayoutAgreementGateRow => {
    if (!isBlocker(row)) return row;
    return {
      ...row,
      status: "admin_override",
      reason: `admin override: ${reason}`,
    };
  });
  return {
    ...summary,
    rows,
    blockers: [],
    blockedCount: 0,
    overrideCount: summary.blockers.length,
    allowed: true,
  };
}
