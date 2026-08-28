import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveCumPctForYm as scheduledEffectiveCumPctForYm,
  milestonePeriod,
  PM_LOCKED_PROGRESS_SOURCES,
  type ProgressAnchor,
} from "@/lib/ms-schedule-shared";
import {
  candidateSourceYmsForPaymentYm,
  memberPayoutYmForCycle,
} from "@/lib/payment-groups";
import type {
  MonthlyAgreementAmountChangeReason,
  MonthlyAgreementStatus,
  MonthlyWorkAgreementRevisionRequest,
  MonthlyWorkAgreementBundle,
  MonthlyWorkAgreementMember,
  MonthlyWorkAgreementMilestone,
  MonthlyWorkAgreementPayoutScheduleEntry,
  MonthlyWorkAgreementProject,
  MonthlyWorkAgreementRecord,
  MonthlyWorkAgreementSnapshot,
} from "@/lib/monthly-work-agreement-types";
import {
  diffMonthlyAgreementTerms,
  explainExpectedRewardChanges,
  isV2Snapshot,
  monthlyAgreementTerms,
  projectIdsWithExpectedRewardChange,
} from "@/lib/monthly-work-agreement-diff";

type JsonRecord = Record<string, unknown>;

type MonthlyRewardPayoutSnapshotRow = JsonRecord & {
  project_id?: string | null;
  ym?: string | null;
  member_id?: string | null;
  earned_pt?: unknown;
  base_pay?: unknown;
  bonus_pt?: unknown;
  total_pay?: unknown;
  created_at?: string | null;
};

const SNAPSHOT_VERSION = "monthly_work_agreement.v2" as const;
/**
 * この稼働月から、月初合意を支払の条件にする。これより前は導入前/移行月として合意済み扱い。
 *
 * 202607 まで移行月に含める (まさ確定 2026-08-28)。2026-08-28 まで、請求ステータスや進捗率の
 * ような内部の状態が動くたびに再合意を求める実装だったため、7月稼働分の合意が成立しないまま
 * 支払時期を迎えた。まさ「月初合意のシステムが整いきってなかったので、特別に残り3人にも
 * 支払うことにした」。202608 稼働分から通常どおり合意を条件にする。
 */
export const MONTHLY_WORK_AGREEMENT_PAYOUT_GATE_START_YM = "202608";

export function isMonthlyWorkAgreementPayoutGateMigrationYm(ym: string): boolean {
  return /^\d{6}$/.test(ym) && ym < MONTHLY_WORK_AGREEMENT_PAYOUT_GATE_START_YM;
}

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

export function hashMonthlyAgreementTerms(snapshot: MonthlyWorkAgreementSnapshot): string {
  return createHash("sha256").update(stableJson(monthlyAgreementTerms(snapshot))).digest("hex");
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

function addMonths(ym: string, delta: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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

function projectHasMonthlyReward(status: unknown): boolean {
  const normalized = String(status ?? "").toLowerCase();
  return normalized !== "lost" && normalized !== "frozen";
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

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(asRecord(item))) : [];
}

function rewardSummaryMember(cycle: JsonRecord | undefined, memberId: string): JsonRecord | null {
  const summary = asRecord(cycle?.reward_summary_json);
  const members = recordArray(summary?.members);
  return members.find((member) => (member.memberId ?? member.member_id) === memberId) ?? null;
}

function rewardSummaryReady(cycle: JsonRecord | undefined): boolean {
  return Boolean(asRecord(cycle?.reward_summary_json));
}

function rewardCycleProtected(cycle: JsonRecord | undefined): boolean {
  return Boolean(cycle?.reward_paid_at || cycle?.payout_notice_uploaded_at || cycle?.payment_confirmed_at);
}

function rewardCycleHasVerifiedPaidEvidence(cycle: JsonRecord | undefined): boolean {
  const by = typeof cycle?.reward_paid_by === "string" ? cycle.reward_paid_by.trim() : "";
  return by.startsWith("freee_wallet_txn_verified:");
}

function yenFromRecord(row: JsonRecord | null, keys: string[]): number | null {
  if (!row) return null;
  for (const key of keys) {
    const value = toNumber(row[key]);
    if (value != null) return Math.max(0, Math.round(value));
  }
  return null;
}

function taxIncludedYen(taxExcludedYen: number): number {
  return Math.max(0, Math.round(taxExcludedYen * 1.1));
}

function hasNumericValue(value: unknown): boolean {
  return toNumber(value) != null;
}

function splitBasePayFromRecord(row: JsonRecord | null): number | null {
  const regular = yenFromRecord(row, ["regularBasePay", "regular_base_pay"]);
  const extra = yenFromRecord(row, ["extraBasePay", "extra_base_pay"]);
  if (regular == null && extra == null) return null;
  return (regular ?? 0) + (extra ?? 0);
}

function cleanYm(value: unknown): string | null {
  const ym = String(value ?? "").trim();
  return /^\d{6}$/.test(ym) ? ym : null;
}

function ymToMonthIndex(ym: string | null | undefined): number | null {
  if (!ym || !/^\d{6}$/.test(ym)) return null;
  return Number(ym.slice(0, 4)) * 12 + Number(ym.slice(4, 6)) - 1;
}

function cycleMonthCount(plan: JsonRecord | undefined): number {
  const start = ymToMonthIndex(typeof plan?.period_start_ym === "string" ? plan.period_start_ym : null);
  const end = ymToMonthIndex(typeof plan?.period_end_ym === "string" ? plan.period_end_ym : null);
  if (start == null || end == null || end < start) return 1;
  return end - start + 1;
}

function monthlyAgreementBudgetYen({
  cycle,
  project,
  plan,
}: {
  cycle: JsonRecord | undefined;
  project: JsonRecord;
  plan: JsonRecord | undefined;
}): number | null {
  if (hasNumericValue(cycle?.budget_yen)) {
    return Math.max(0, Math.round(toNumber(cycle?.budget_yen) ?? 0));
  }
  const feeAmount = toNumber(project.fee_amount ?? project.feeAmount);
  if (feeAmount != null && feeAmount > 0) return Math.round(feeAmount * 0.65);
  const cycleBudget = toNumber(plan?.budget_yen);
  if (cycleBudget != null && cycleBudget > 0) return Math.round(cycleBudget / cycleMonthCount(plan));
  return null;
}

function paymentRuleProject(project: JsonRecord) {
  return {
    payment_due_rule: typeof project.payment_due_rule === "string" ? project.payment_due_rule : null,
    payment_due_day: toNumber(project.payment_due_day),
    invoice_send_deadline_rule:
      typeof project.invoice_send_deadline_rule === "string" ? project.invoice_send_deadline_rule : null,
  };
}

function paymentRuleCycle(cycle: JsonRecord, fallbackYm: string) {
  const cycleYm = cleanYm(cycle.ym) ?? fallbackYm;
  return {
    ym: cycleYm,
    invoice_ym: cleanYm(cycle.invoice_ym),
    invoice_sent_at: typeof cycle.invoice_sent_at === "string" ? cycle.invoice_sent_at : null,
    invoice_issued_at: typeof cycle.invoice_issued_at === "string" ? cycle.invoice_issued_at : null,
    payment_confirmed_at: typeof cycle.payment_confirmed_at === "string" ? cycle.payment_confirmed_at : null,
    reward_paid_at: typeof cycle.reward_paid_at === "string" ? cycle.reward_paid_at : null,
  };
}

function rewardPaymentRuleCycle(cycle: JsonRecord, fallbackYm: string) {
  const base = paymentRuleCycle(cycle, fallbackYm);
  return {
    ...base,
    // billing_cycles.invoice_ym is the client invoice month. Monthly agreement
    // payout explanations must use the member payment timing instead.
    invoice_ym: null,
  };
}

/**
 * メンバーへの支払月。`/admin/payouts` (支払通知書) と同じ関数を使う。
 * ここが別実装だと、同じ稼働月なのに月初合意と支払通知書で金額が食い違う
 * (まさ指摘 2026-08-26)。判定は `memberPayoutYmForCycle` 一本に寄せる。
 */
function effectiveRewardPaymentYmForCycle(cycle: JsonRecord, project: JsonRecord, fallbackYm: string): string {
  return memberPayoutYmForCycle(rewardPaymentRuleCycle(cycle, fallbackYm), paymentRuleProject(project));
}

function payoutSnapshotKey(projectId: string, ym: string): string {
  return `${projectId}:${ym}`;
}

function payoutSnapshotByProjectYm(rows: MonthlyRewardPayoutSnapshotRow[]): Map<string, MonthlyRewardPayoutSnapshotRow> {
  const map = new Map<string, MonthlyRewardPayoutSnapshotRow>();
  for (const row of rows) {
    const projectId = typeof row.project_id === "string" ? row.project_id : "";
    const ym = cleanYm(row.ym);
    if (!projectId || !ym) continue;
    map.set(payoutSnapshotKey(projectId, ym), row);
  }
  return map;
}

function payoutSnapshotForCycle(
  cycle: JsonRecord | undefined,
  snapshots: Map<string, MonthlyRewardPayoutSnapshotRow>,
): MonthlyRewardPayoutSnapshotRow | null {
  const projectId = typeof cycle?.project_id === "string" ? cycle.project_id : "";
  const ym = cleanYm(cycle?.ym);
  if (!projectId || !ym) return null;
  return snapshots.get(payoutSnapshotKey(projectId, ym)) ?? null;
}

function memberPayoutYenFromCycle(
  cycle: JsonRecord | undefined,
  memberId: string,
  payoutSnapshots: Map<string, MonthlyRewardPayoutSnapshotRow>,
): number {
  const snapshotTotal = yenFromRecord(payoutSnapshotForCycle(cycle, payoutSnapshots), ["total_pay"]);
  if (snapshotTotal != null) return snapshotTotal;
  return yenFromRecord(rewardSummaryMember(cycle, memberId), ["totalPay", "total_pay"]) ?? 0;
}

function shareTotal(shares: Map<string, number> | undefined): number {
  if (!shares) return 0;
  return [...shares.values()].reduce((sum, share) => sum + Math.max(0, share), 0);
}

function payoutScheduleEntryFromCycle(
  cycle: JsonRecord,
  project: JsonRecord,
  memberId: string,
  currentYm: string,
  payoutSnapshots: Map<string, MonthlyRewardPayoutSnapshotRow>,
): MonthlyWorkAgreementPayoutScheduleEntry | null {
  const rewardMember = rewardSummaryMember(cycle, memberId);
  const payoutSnapshot = payoutSnapshotForCycle(cycle, payoutSnapshots);
  if (!rewardMember && !payoutSnapshot) return null;
  const basePayYen =
    yenFromRecord(rewardMember, ["basePay", "base_pay"]) ??
    splitBasePayFromRecord(rewardMember) ??
    yenFromRecord(payoutSnapshot, ["base_pay"]) ??
    0;
  const carryInYen = yenFromRecord(rewardMember, ["carryInYen", "carry_in_yen"]) ?? 0;
  const grossDueYen = yenFromRecord(rewardMember, ["grossDueYen", "gross_due_yen"]) ?? basePayYen + carryInYen;
  const cachedTotalPayYen = yenFromRecord(rewardMember, ["totalPay", "total_pay"]) ?? 0;
  const cachedStockYen = yenFromRecord(rewardMember, ["stockYen", "stock_yen", "deferredYen", "deferred_yen"]) ?? 0;
  const snapshotTotalPayYen = yenFromRecord(payoutSnapshot, ["total_pay"]);
  const isProtected = rewardCycleProtected(cycle);
  const isActualPaid = Boolean(snapshotTotalPayYen != null && rewardCycleHasVerifiedPaidEvidence(cycle));
  const isUnverifiedPaid = Boolean(cycle.reward_paid_at && !isActualPaid);
  const totalPayYen = snapshotTotalPayYen ?? cachedTotalPayYen;
  const totalPayTaxIncludedYen = taxIncludedYen(totalPayYen);
  const stockYen = snapshotTotalPayYen == null ? cachedStockYen : Math.max(0, grossDueYen - totalPayYen);
  if (basePayYen <= 0 && carryInYen <= 0 && grossDueYen <= 0 && totalPayYen <= 0 && stockYen <= 0) return null;
  const sourceYm = cleanYm(cycle.ym) ?? currentYm;
  const amountSource: MonthlyWorkAgreementPayoutScheduleEntry["amountSource"] =
    isActualPaid
      ? "actual_paid"
      : isUnverifiedPaid
        ? "unverified_paid"
        : snapshotTotalPayYen != null
          ? "payout_snapshot"
          : isProtected
            ? "protected_reward_cache"
            : "reward_cache";
  return {
    sourceYm,
    paymentYm: effectiveRewardPaymentYmForCycle(cycle, project, sourceYm),
    status: typeof cycle.status === "string" ? cycle.status : null,
    basePayYen,
    carryInYen,
    grossDueYen,
    totalPayYen,
    totalPayTaxIncludedYen,
    stockYen,
    isCurrentYm: sourceYm === currentYm,
    isProtected,
    isActualPaid,
    amountSource,
  };
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
    snapshotJson: row.snapshot_json,
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

export function isMissingMonthlyAgreementAmountChangeReasonTableError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null | undefined;
  return err?.code === "42P01" || /member_monthly_work_agreement_amount_change_reasons/i.test(err?.message ?? "");
}

function toAmountChangeReason(row: JsonRecord): MonthlyAgreementAmountChangeReason {
  return {
    id: String(row.id ?? ""),
    ym: String(row.ym ?? ""),
    memberId: String(row.member_id ?? ""),
    projectId: String(row.project_id ?? ""),
    agreementSnapshotHash: String(row.agreement_snapshot_hash ?? ""),
    reason: String(row.reason ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedBy: typeof row.updated_by === "string" ? row.updated_by : null,
    updatedAt: String(row.updated_at ?? ""),
  };
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
    resolvedBy: typeof row.resolved_by === "string" ? row.resolved_by : null,
    resolutionNote: typeof row.resolution_note === "string" ? row.resolution_note : null,
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

  if (isMonthlyWorkAgreementPayoutGateMigrationYm(ym)) {
    const snapshot: MonthlyWorkAgreementSnapshot = {
      schemaVersion: SNAPSHOT_VERSION,
      ym,
      member: snapshotMember,
      projects: [],
      totals: {
        expectedRewardYen: 0,
        currentMonthAccrualYen: 0,
        carryInYen: 0,
        stockYen: 0,
        paidActualYen: 0,
        unverifiedPaidYen: 0,
        futurePayoutYen: 0,
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
      canRequestRevision: false,
      canAgree: false,
      exclusionReason: "月初合意の導入前/移行月のため、この月の合意は不要です。",
      changeSummary: null,
      amountChangeReasons: [],
      amountChangeReasonRequiredProjectIds: [],
      missingAmountChangeReasonProjectIds: [],
      expectedRewardChangeExplanations: [],
    };
  }

  if (member.exclude_from_payout_notice === true && member.is_admin !== true) {
    const snapshot: MonthlyWorkAgreementSnapshot = {
      schemaVersion: SNAPSHOT_VERSION,
      ym,
      member: snapshotMember,
      projects: [],
      totals: {
        expectedRewardYen: 0,
        currentMonthAccrualYen: 0,
        carryInYen: 0,
        stockYen: 0,
        paidActualYen: 0,
        unverifiedPaidYen: 0,
        futurePayoutYen: 0,
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
      canRequestRevision: false,
      canAgree: false,
      exclusionReason: "支払通知対象外メンバーのため、月初合意は不要です。",
      changeSummary: null,
      amountChangeReasons: [],
      amountChangeReasonRequiredProjectIds: [],
      missingAmountChangeReasonProjectIds: [],
      expectedRewardChangeExplanations: [],
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
  const scheduleStartYm = addMonths(ym, -6);
  const scheduleEndYm = addMonths(ym, 12);
  const paymentCandidateSourceYms = candidateSourceYmsForPaymentYm(ym);

  const [
    projectsRes,
    freezePeriodsRes,
    cyclesRes,
    payoutCandidateCyclesRes,
    scheduleCyclesRes,
    payoutSnapshotsRes,
    plansRes,
  ] = await Promise.all([
    projectIds.length
      ? supabase
          .from("projects")
          .select("project_id, project_name, status, start_ym, end_ym, freeze_from_ym, restart_expected_ym, project_type, project_category, fee_type, fee_amount, payment_due_rule, payment_due_day, invoice_send_deadline_rule")
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
          .from("billing_cycles")
          .select("*")
          .in("project_id", projectIds)
          .in("ym", paymentCandidateSourceYms)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase
          .from("billing_cycles")
          .select("*")
          .in("project_id", projectIds)
          .gte("ym", scheduleStartYm)
          .lte("ym", scheduleEndYm)
          .order("ym", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase
          .from("monthly_reward_payout")
          .select("project_id, ym, member_id, earned_pt, base_pay, bonus_pt, total_pay, created_at")
          .eq("member_id", params.memberId)
          .in("project_id", projectIds)
          .gte("ym", scheduleStartYm)
          .lte("ym", scheduleEndYm)
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
  if (payoutCandidateCyclesRes.error) throw payoutCandidateCyclesRes.error;
  if (scheduleCyclesRes.error) throw scheduleCyclesRes.error;
  if (payoutSnapshotsRes.error) throw payoutSnapshotsRes.error;
  if (plansRes.error) throw plansRes.error;

  const freezePeriodsByProject = new Map<string, JsonRecord[]>();
  for (const row of (freezePeriodsRes.data ?? []) as Array<JsonRecord>) {
    const projectId = row.project_id as string;
    const list = freezePeriodsByProject.get(projectId) ?? [];
    list.push(row);
    freezePeriodsByProject.set(projectId, list);
  }

  const projects = ((projectsRes.data ?? []) as Array<JsonRecord>)
    .filter((row) => projectHasMonthlyReward(row.status))
    .filter((row) => !projectFrozenForYm(row, freezePeriodsByProject.get(row.project_id as string), ym))
    .filter((row) => inYmRange(ym, { start_ym: row.start_ym as string | null, end_ym: row.end_ym as string | null }));
  const projectMap = new Map(projects.map((row) => [row.project_id as string, row]));
  const cyclesByProject = new Map(((cyclesRes.data ?? []) as Array<JsonRecord>).map((row) => [row.project_id as string, row]));
  const payoutSnapshots = payoutSnapshotByProjectYm((payoutSnapshotsRes.data ?? []) as MonthlyRewardPayoutSnapshotRow[]);
  const payoutScheduleByProject = new Map<string, MonthlyWorkAgreementPayoutScheduleEntry[]>();
  for (const row of (scheduleCyclesRes.data ?? []) as Array<JsonRecord>) {
    const projectId = row.project_id as string;
    const project = projectMap.get(projectId);
    if (!project) continue;
    const entry = payoutScheduleEntryFromCycle(row, project, params.memberId, ym, payoutSnapshots);
    if (!entry) continue;
    const list = payoutScheduleByProject.get(projectId) ?? [];
    list.push(entry);
    payoutScheduleByProject.set(projectId, list);
  }
  for (const [projectId, list] of payoutScheduleByProject.entries()) {
    payoutScheduleByProject.set(
      projectId,
      list.sort((a, b) => a.sourceYm.localeCompare(b.sourceYm) || a.paymentYm.localeCompare(b.paymentYm)),
    );
  }
  const payoutYenByProject = new Map<string, number>();
  for (const row of (payoutCandidateCyclesRes.data ?? []) as Array<JsonRecord>) {
    const projectId = row.project_id as string;
    const project = projectMap.get(projectId);
    if (!project) continue;
    const paymentYm = effectiveRewardPaymentYmForCycle(row, project, cleanYm(row.ym) ?? ym);
    if (paymentYm !== ym) continue;
    payoutYenByProject.set(
      projectId,
      (payoutYenByProject.get(projectId) ?? 0) + memberPayoutYenFromCycle(row, params.memberId, payoutSnapshots),
    );
  }

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
      const rewardMember = rewardSummaryMember(cycle, params.memberId);
      const payoutSnapshot = payoutSnapshotForCycle(cycle, payoutSnapshots);
      const hasRewardSummary = rewardSummaryReady(cycle);
      const currentCyclePayoutYen =
        yenFromRecord(payoutSnapshot, ["total_pay"]) ??
        yenFromRecord(rewardMember, ["totalPay", "total_pay"]) ??
        (hasRewardSummary ? 0 : null);
      const paymentYm = cycle
        ? effectiveRewardPaymentYmForCycle(cycle, project, ym)
        : null;
      const payoutYen = payoutYenByProject.get(projectId) ?? 0;
      const stockYen =
        yenFromRecord(rewardMember, ["stockYen", "stock_yen", "deferredYen", "deferred_yen"]) ??
        (hasRewardSummary ? 0 : null);
      const grossDueYen =
        yenFromRecord(rewardMember, ["grossDueYen", "gross_due_yen"]) ??
        (hasRewardSummary ? 0 : null);
      const carryInYen = yenFromRecord(rewardMember, ["carryInYen", "carry_in_yen"]) ?? (hasRewardSummary ? 0 : null);
      const roleMilestones: MonthlyWorkAgreementMilestone[] = [];
      const projectPlans = plansByProject.get(projectId) ?? [];
      const plan =
        projectPlans.find((p) => String(p.status) === "fixed" && ym >= String(p.period_start_ym) && ym <= String(p.period_end_ym)) ??
        projectPlans.find((p) => ym >= String(p.period_start_ym) && ym <= String(p.period_end_ym)) ??
        projectPlans[0];
      const planMilestones = plan ? milestonesByPlan.get(plan.plan_cycle_id as string) ?? [] : [];
      const agreementBudgetYen = monthlyAgreementBudgetYen({ cycle, project, plan });
      const activeProjectMemberIds = activeMemberIdsByProject.get(projectId) ?? new Set<string>([params.memberId]);
      const monthlyConsumedByMs = new Map<string, { progressPct: number | null; monthlyProgressPct: number | null; consumedPt: number }>();
      const normalizedSharesByMs = new Map<string, Map<string, number>>();

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

      const projectEarnedPt = planMilestones.reduce((sum, ms) => {
        const monthly = monthlyConsumedByMs.get(ms.milestone_id as string);
        const shares = normalizedSharesByMs.get(ms.milestone_id as string);
        return sum + (monthly?.consumedPt ?? 0) * shareTotal(shares);
      }, 0);

      for (const ms of planMilestones) {
        const milestoneId = ms.milestone_id as string;
        const respRows = (responsibilitiesByMs.get(milestoneId) ?? []).filter((row) => row.member_id === params.memberId);
        const plannedShare = respRows.reduce((sum, row) => sum + (toNumber(row.share) ?? 0), 0);
        const normalizedShare = normalizedSharesByMs.get(milestoneId)?.get(params.memberId) ?? 0;
        if (plannedShare <= 0 && normalizedShare <= 0) continue;
        const monthly = monthlyConsumedByMs.get(milestoneId) ?? { progressPct: null, monthlyProgressPct: null, consumedPt: 0 };
        const earnedPt = Math.round(monthly.consumedPt * normalizedShare * 100) / 100;
        const expectedRewardYen =
          agreementBudgetYen == null || projectEarnedPt <= 0
            ? null
            : Math.round((agreementBudgetYen * earnedPt) / projectEarnedPt);
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
          state: monthly.progressPct == null || agreementBudgetYen == null ? "review_required" : "ready",
        });
      }

      const sortedMilestones = roleMilestones.sort((a, b) => a.milestoneId.localeCompare(b.milestoneId));
      // 当月のMS消化から発生する額。合意額そのものではなく、内訳として見せる数字。
      const currentMonthAccrualYen = sortedMilestones.some((ms) => ms.expectedRewardYen == null)
        ? null
        : sortedMilestones.reduce((sum, ms) => sum + (ms.expectedRewardYen ?? 0), 0);
      // 合意する額 = この稼働月として実際に払う額。過去の未払いの返済分を含み、月次の支払枠を通した後の値。
      // 支払通知書とまったく同じ計算 (billing_cycles.reward_summary_json の totalPay) を使う。
      // 別計算にすると、合意した額と実際に払う額が食い違う (まさ確定 2026-08-27
      // 「次回払う金額が月初合意の段階で計算されてないといけない」)。
      const expectedRewardYen = currentCyclePayoutYen;
      const payoutSchedule = payoutScheduleByProject.get(projectId) ?? [];
      const hasDisplayableReward =
        (expectedRewardYen ?? 0) > 0 ||
        (currentCyclePayoutYen ?? 0) > 0 ||
        (payoutYen ?? 0) > 0 ||
        (stockYen ?? 0) > 0 ||
        (grossDueYen ?? 0) > 0 ||
        payoutSchedule.length > 0;

      if (!hasDisplayableReward && roleMilestones.length === 0) return null;

      const reviewReasons: string[] = [];
      if (!cycle) reviewReasons.push("billing_cycles が未作成");
      if (agreementBudgetYen == null) reviewReasons.push("月初合意用の月次予算が未設定");
      if (!hasRewardSummary) reviewReasons.push("支払説明が未生成");
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
        currentMonthAccrualYen,
        payoutYen,
        currentCyclePayoutYen,
        paymentYm,
        stockYen,
        grossDueYen,
        carryInYen,
        earnedPt: sortedMilestones.reduce((sum, ms) => sum + (ms.earnedPt ?? 0), 0),
        conditionState,
        conditions: [],
        reviewReasons,
        milestones: sortedMilestones,
        payoutSchedule,
        routineExpectations: routineExpectations(membership),
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
      currentMonthAccrualYen: snapshotProjects.reduce((sum, project) => sum + (project.currentMonthAccrualYen ?? 0), 0),
      carryInYen: snapshotProjects.reduce((sum, project) => sum + (project.carryInYen ?? 0), 0),
      stockYen: snapshotProjects.reduce((sum, project) => sum + (project.stockYen ?? 0), 0),
      paidActualYen: snapshotProjects.reduce(
        (sum, project) =>
          sum + project.payoutSchedule
            .filter((entry) => entry.isActualPaid)
            .reduce((projectSum, entry) => projectSum + entry.totalPayTaxIncludedYen, 0),
        0,
      ),
      unverifiedPaidYen: snapshotProjects.reduce(
        (sum, project) =>
          sum + project.payoutSchedule
            .filter((entry) => entry.amountSource === "unverified_paid")
            .reduce((projectSum, entry) => projectSum + entry.totalPayTaxIncludedYen, 0),
        0,
      ),
      futurePayoutYen: snapshotProjects.reduce(
        (sum, project) =>
          sum + project.payoutSchedule
            .filter((entry) => !entry.isActualPaid && entry.amountSource !== "unverified_paid")
            .reduce((projectSum, entry) => projectSum + entry.totalPayTaxIncludedYen, 0),
        0,
      ),
      projectCount: snapshotProjects.length,
      reviewRequiredCount: snapshotProjects.filter((project) => project.conditionState === "review_required").length,
    },
  };
  const currentHash = hashMonthlyAgreementSnapshot(snapshot);

  let latestAgreement: MonthlyWorkAgreementRecord | null = null;
  let tableReady = true;
  const { data: agreementData, error: agreementError } = await supabase
    .from("member_monthly_work_agreements")
    .select("id, ym, member_id, status, agreed_at, agreed_by, snapshot_json, snapshot_hash, current_hash, invalidated_at, invalidation_reason")
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
    .select("id, ym, member_id, project_id, request_type, body, status, snapshot_hash, created_at, resolved_at, resolved_by, resolution_note")
    .eq("ym", ym)
    .eq("member_id", params.memberId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (requestError) {
    if (!isMissingMonthlyAgreementRequestTableError(requestError)) throw requestError;
  } else {
    revisionRequests = ((requestData ?? []) as Array<JsonRecord>).map(toRevisionRequest);
  }

  let amountChangeReasons: MonthlyAgreementAmountChangeReason[] = [];
  const { data: reasonData, error: reasonError } = await supabase
    .from("member_monthly_work_agreement_amount_change_reasons")
    .select("id, ym, member_id, project_id, agreement_snapshot_hash, reason, created_by, created_at, updated_by, updated_at")
    .eq("ym", ym)
    .eq("member_id", params.memberId)
    .eq("agreement_snapshot_hash", currentHash);
  if (reasonError) {
    if (!isMissingMonthlyAgreementAmountChangeReasonTableError(reasonError)) throw reasonError;
  } else {
    amountChangeReasons = ((reasonData ?? []) as Array<JsonRecord>).map(toAmountChangeReason);
  }

  // 合意した「担当する仕事」と「受け取る額」が変わっていなければ、内部の状態が動いても再合意を求めない。
  // snapshot 全体の hash だけで見ていた頃は、請求ステータスや入金確認が動くたびに条件更新ありが立っていた。
  const agreedTermsHash = isV2Snapshot(latestAgreement?.snapshotJson)
    ? hashMonthlyAgreementTerms(latestAgreement.snapshotJson)
    : null;
  const currentTermsHash = hashMonthlyAgreementTerms(snapshot);
  const agreedTermsUnchanged = agreedTermsHash != null && agreedTermsHash === currentTermsHash;
  const agreementStatus: MonthlyAgreementStatus =
    latestAgreement?.status === "agreed" &&
    (latestAgreement.snapshotHash === currentHash || agreedTermsUnchanged)
      ? "agreed"
      : latestAgreement?.status === "agreed"
        ? "needs_reagreement"
        : "pending";
  const status: MonthlyAgreementStatus = agreementStatus;
  const amountChangeReasonRequiredProjectIds =
    agreementStatus === "needs_reagreement"
      ? projectIdsWithExpectedRewardChange(latestAgreement?.snapshotJson, snapshot)
      : [];
  const reasonProjectIds = new Set(
    amountChangeReasons
      .filter((item) => item.reason.trim().length >= 8)
      .map((item) => item.projectId),
  );
  // 予定額はMS消化pt・繰越・支払枠から自動計算されるので、変わるたびに人間の理由入力を
  // 必須にすると、書ける人がいないまま合意が止まり、支払通知書も出せなくなる。
  // OSが要因を数値で示せたPJは、管理側の理由入力なしで合意できるようにする (2026-08-28)。
  const expectedRewardChangeExplanations =
    agreementStatus === "needs_reagreement"
      ? explainExpectedRewardChanges(latestAgreement?.snapshotJson, snapshot)
      : [];
  const autoExplainedProjectIds = new Set(
    expectedRewardChangeExplanations.filter((item) => item.explained).map((item) => item.projectId),
  );
  const missingAmountChangeReasonProjectIds = amountChangeReasonRequiredProjectIds.filter(
    (projectId) => !reasonProjectIds.has(projectId) && !autoExplainedProjectIds.has(projectId),
  );
  const canRequestRevision = tableReady && (!params.viewerMemberId || params.viewerMemberId === params.memberId);
  const reasonWaitMessage =
    missingAmountChangeReasonProjectIds.length > 0
      ? "予定額が変更された理由を管理側で確認中です。理由の確認後に合意できます。"
      : null;

  return {
    ym,
    member: snapshotMember,
    snapshot,
    currentHash,
    status,
    latestAgreement,
    revisionRequests,
    tableReady,
    canRequestRevision,
    canAgree: canRequestRevision && missingAmountChangeReasonProjectIds.length === 0,
    exclusionReason: reasonWaitMessage,
    // メンバーへ見せる変更点は合意の対象だけ。内部の状態が動いただけの差分は出さない
    changeSummary:
      agreementStatus === "needs_reagreement"
        ? diffMonthlyAgreementTerms(latestAgreement?.snapshotJson, snapshot)
        : null,
    amountChangeReasons,
    amountChangeReasonRequiredProjectIds,
    missingAmountChangeReasonProjectIds,
    expectedRewardChangeExplanations,
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
      supabase.from("members").select("member_id, status, is_admin, exclude_from_payout_notice").eq("status", "active"),
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
      .filter((row) => row.exclude_from_payout_notice !== true || row.is_admin === true)
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
