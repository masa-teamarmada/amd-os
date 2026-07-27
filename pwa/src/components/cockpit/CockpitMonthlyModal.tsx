"use client";

import { useState, useEffect, Fragment } from "react";
import {
  effectiveCumPctForYm as scheduledEffectiveCumPctForYm,
  PM_LOCKED_PROGRESS_SOURCES,
  type ProgressAnchor,
} from "@/lib/ms-schedule-shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// PJ別の提出版テンプレート。print pipeline (route.ts) の PRINT_TEMPLATES と対応させる。
const PRINT_TEMPLATE_BY_PROJECT: Record<string, { template: string; label: string }> = {
  p20: { template: "nims-cx", label: "NIMS提出版" },
  p21: { template: "ehime-sx", label: "愛媛大提出版" },
  p25: { template: "kogakuin-kute", label: "工学院提出版" },
};
function printLinkForProject(projectId: string): { template: string; label: string } {
  return PRINT_TEMPLATE_BY_PROJECT[projectId] || { template: "internal", label: "社内版プレビュー" };
}

// ─── 型定義 ─────────────────────────────────────────────────────────────────

interface Report {
  draftExcerpt: string;
  finalExcerpt: string;
  hasDraft: boolean;
  hasFinal: boolean;
  status: string;
  generatedAt: string | null;
  fixedAt: string | null;
}

interface RewardBreakdown {
  msKey: string;
  title: string;
  share: number;
  earnedPt: number;
  msConsumedPt: number;
  pool?: "regular" | "cap_extra";
  ptUnit?: number;
  payYen?: number;
}

interface RewardMember {
  memberId: string;
  memberName?: string;
  earnedPt: number;
  basePay: number;
  bonusPt: number;
  totalPay: number;
  cappedFrom?: number;
  carryInYen?: number;
  deferredYen?: number;
  grossDueYen?: number;
  stockYen?: number;
  regularEarnedPt?: number;
  extraEarnedPt?: number;
  regularBasePay?: number;
  extraBasePay?: number;
  regularPaidYen?: number;
  extraPaidYen?: number;
  regularGrossDueYen?: number;
  extraGrossDueYen?: number;
  regularStockYen?: number;
  extraStockYen?: number;
  breakdown: RewardBreakdown[];
}

interface RewardSummary {
  ptUnit?: number;
  totalPaySum?: number;
  totalGrossDueYen?: number;
  capBudgetYen?: number;
  capped?: boolean;
  carryInYen?: number;
  carryOverYen?: number;
  monthlyBudget65?: number;
  regularPtUnit?: number;
  extraPtUnit?: number;
  regularCapBudgetYen?: number;
  extraCapBudgetYen?: number;
  regularTotalGrossDueYen?: number;
  extraTotalGrossDueYen?: number;
  regularCarryOverYen?: number;
  extraCarryOverYen?: number;
  members: RewardMember[];
  meta?: Record<string, unknown>;
}

interface Billing {
  status: string;
  budgetYen: number;
  meetingStartAt: string | null;
  reportFixedAt: string | null;
  invoiceSentAt: string | null;
  paymentConfirmedAt: string | null;
  budgetReportedAmount: number;
  msProgressSummaryJson?: unknown;
  rewardSummaryJson?: RewardSummary | null;
}

interface MilestoneInfo {
  milestoneId: string;
  title: string;
  points: number;
  tag: string;
  successCriteria?: string;
  sortOrder?: number;
}

interface MsScheduleInfo {
  milestoneId: string;
  periodStartYm: string;
  targetYm: string;
  msMonths: number;
  expectedCumPct: number;
  monthlyPt: number;
}

interface ProgressInfo {
  milestoneKey: string;
  ym: string;
  progressPct: number;
  consumedPt: number;
  source?: string;
  note?: string | null;
}

interface Responsibility {
  milestoneId: string;
  memberId: string;
  share: number;
}

interface SubItem {
  subItemId: string;
  milestoneId: string;
  title: string;
  weight: number;
  status: string;
  assignee: string;
}

interface PlanCycleShape {
  planCycleId: string;
  status: string;
  budgetYen: number;
  totalPoints: number;
  periodStartYm: string;
  periodEndYm: string;
}

interface UnconfirmedEstimate {
  milestoneKey: string;
  progressPct: number;
  prevPct: number;
  reason: string;
}

interface ProgressEvent {
  eventId: string;
  memberId?: string | null;
  milestoneId?: string | null;
  title?: string | null;
  contentPreview?: string | null;
  itemDate?: string | null;
  eventTitle: string;
  eventDescription?: string;
  status: string;
  initiativeOrigin?: string;
  impact?: number;
  depth?: number;
  rejectReason?: string;
  originLostReason?: string;
  responsibilities?: Array<{ memberName?: string; memberId: string; responsibility: number }>;
}

interface ReimburseItem {
  id?: string;
  description: string;
  amount: number;
  memberName?: string;
  date?: string;
}

interface MemberMsActivityInfo {
  memberId: string;
  milestoneId: string;
  ym: string;
  narrative?: string | null;
  learnedAddendum?: string | null;
  generatedAt?: string | null;
}

interface MemberActivityInfo {
  id: string;
  memberId: string;
  projectId: string;
  ym: string;
  source: string;
  sourceItemId: string;
  milestoneId?: string | null;
  title?: string | null;
  contentPreview?: string | null;
  itemDate?: string | null;
  extractedAt: string;
}

interface MsRevisionMessage {
  id: string;
  revisionId: string;
  senderKind: "pm" | "tsukuyomi";
  body: string;
  createdAt?: string | null;
}

interface MsRevision {
  id: string;
  projectId: string;
  milestoneId: string;
  ym: string;
  currentPct?: number | null;
  currentNote?: string | null;
  revisedPct?: number | null;
  revisedNote?: string | null;
  status: "pending" | "confirmed" | "discarded";
  messages: MsRevisionMessage[];
}

// レポートタブは v0.33.0 で廃止。印刷ビューと二重に存在するため、編集が必要なときは
// モーダル内の「レポート本文を編集」アコーディオンを開く運用に統一。
// 互換のため型エイリアスは残す (= 外部呼び出し: CockpitView.openMonthlyModal の initialTab) が、
// 値は受け取っても無視する (= 開いた瞬間に編集アコーディオンを展開する用)。
type MonthlyModalTab = "reward" | "report";

interface Props {
  ym: string;
  projectId: string;
  report: Report | null;
  billing: Billing | null;
  milestones: MilestoneInfo[];
  progress: ProgressInfo[];
  responsibilities: Responsibility[];
  memberMap: Record<string, string>;
  planCycle: PlanCycleShape | null;
  subItems: SubItem[];
  msActivities?: MemberMsActivityInfo[];
  memberActivities?: MemberActivityInfo[];
  currentYm: string;
  initialTab?: MonthlyModalTab;
  projectFeeType?: string | null;
  projectFeeAmount?: number | null;
  usesMsProgress?: boolean;
  onProgressSaved?: (patches: ProgressInfo[]) => void;
  onClose: () => void;
}

// ─── ユーティリティ ──────────────────────────────────────────────────────────

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

function formatYenValue(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function formatSignedYenValue(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  if (rounded < 0) return `-¥${Math.abs(rounded).toLocaleString("ja-JP")}`;
  return `¥${rounded.toLocaleString("ja-JP")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  if (iso === "done") return "✓";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "✓";
    return d.toLocaleDateString("ja-JP");
  } catch {
    return "—";
  }
}

function ymToMonths(ym: string): number {
  return parseInt(ym.slice(0, 4), 10) * 12 + parseInt(ym.slice(4, 6), 10);
}

function prevYmStr(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}${String(pm).padStart(2, "0")}`;
}

function cycleMonthCount(planCycle: PlanCycleShape | null): number {
  if (!planCycle) return 1;
  return Math.max(1, ymToMonths(planCycle.periodEndYm) - ymToMonths(planCycle.periodStartYm) + 1);
}

const CAP_EXTRA_MILESTONE_TAGS = new Set(["cap_extra", "extra_contract", "contract_extra", "cap_outside", "uncapped"]);

function isCapExtraMilestoneInfo(ms: Pick<MilestoneInfo, "tag">): boolean {
  return CAP_EXTRA_MILESTONE_TAGS.has((ms.tag || "").trim().toLowerCase());
}

function rewardPointBasisForUnit(milestones: MilestoneInfo[], planCycle: PlanCycleShape | null): number {
  const hasCapExtra = milestones.some(isCapExtraMilestoneInfo);
  if (!hasCapExtra) return planCycle?.totalPoints || milestones.reduce((sum, ms) => sum + ms.points, 0);
  const extraPoints = milestones.filter(isCapExtraMilestoneInfo).reduce((sum, ms) => sum + ms.points, 0);
  if (planCycle && planCycle.totalPoints > extraPoints) return planCycle.totalPoints - extraPoints;
  return milestones.filter((ms) => !isCapExtraMilestoneInfo(ms)).reduce((sum, ms) => sum + ms.points, 0);
}

function deriveRewardBudgetForPt({
  billing,
  planCycle,
  projectFeeType,
  projectFeeAmount,
}: {
  billing?: Billing | null;
  planCycle: PlanCycleShape | null;
  projectFeeType?: string | null;
  projectFeeAmount?: number | null;
}): number {
  if (planCycle?.budgetYen && planCycle.budgetYen > 0) return planCycle.budgetYen;
  if ((projectFeeType || "").toLowerCase() === "monthly_fixed" && projectFeeAmount && projectFeeAmount > 0) {
    return Math.round(projectFeeAmount * 0.65 * cycleMonthCount(planCycle));
  }
  return billing?.budgetYen && billing.budgetYen > 0 ? billing.budgetYen : 0;
}

function deriveMonthlyRewardBudget({
  billing,
  planCycle,
  projectFeeType,
  projectFeeAmount,
}: {
  billing?: Billing | null;
  planCycle: PlanCycleShape | null;
  projectFeeType?: string | null;
  projectFeeAmount?: number | null;
}): number {
  if (billing?.budgetYen && billing.budgetYen > 0) return Math.round(billing.budgetYen);
  if ((projectFeeType || "").toLowerCase() === "monthly_fixed" && projectFeeAmount && projectFeeAmount > 0) {
    return Math.round(projectFeeAmount * 0.65);
  }
  if (planCycle?.budgetYen && planCycle.budgetYen > 0) {
    return Math.round(planCycle.budgetYen / cycleMonthCount(planCycle));
  }
  return 0;
}

function computeExpectedPct(planCycle: PlanCycleShape, ym: string): number {
  const cycleMonths = ymToMonths(planCycle.periodEndYm) - ymToMonths(planCycle.periodStartYm) + 1;
  const elapsed = ymToMonths(ym) - ymToMonths(planCycle.periodStartYm) + 1;
  if (cycleMonths <= 0) return 0;
  return Math.min(100, Math.round((elapsed / cycleMonths) * 100));
}

function computeSignal(expectedPct: number, overallPct: number): string {
  const diff = expectedPct - overallPct;
  if (diff <= 10) return "🟢";
  if (diff <= 25) return "🟡";
  return "🔴";
}

function latestProgressBefore(progress: ProgressInfo[], milestoneId: string, ym: string): ProgressInfo | null {
  let latest: ProgressInfo | null = null;
  for (const p of progress) {
    if (p.milestoneKey !== milestoneId || p.ym > ym) continue;
    if (!latest || p.ym > latest.ym) latest = p;
  }
  return latest;
}

function isPmLockedProgress(row: ProgressInfo): boolean {
  return PM_LOCKED_PROGRESS_SOURCES.has(String(row.source || ""));
}

function rowProgressPct(row: ProgressInfo, points: number): number {
  if (Number.isFinite(row.consumedPt) && points > 0) {
    return Math.max(0, Math.min(100, (row.consumedPt / points) * 100));
  }
  return Math.max(0, Math.min(100, row.progressPct || 0));
}

function effectiveProgressPct(
  progress: ProgressInfo[],
  milestone: MilestoneInfo,
  ym: string,
  schedule?: MsScheduleInfo
): number {
  if (!schedule?.periodStartYm || !schedule.targetYm) {
    return latestProgressBefore(progress, milestone.milestoneId, ym)?.progressPct || 0;
  }

  const lockedRows = progress
    .filter((row) => row.milestoneKey === milestone.milestoneId && row.ym <= ym && isPmLockedProgress(row))
    .sort((a, b) => a.ym.localeCompare(b.ym));
  const exactLocked = lockedRows.find((row) => row.ym === ym);
  const anchorBefore = (targetYm: string): ProgressAnchor | null => {
    let found: ProgressAnchor | null = null;
    for (const row of lockedRows) {
      if (row.ym >= targetYm) break;
      found = { ym: row.ym, pct: rowProgressPct(row, milestone.points) };
    }
    return found;
  };
  return scheduledEffectiveCumPctForYm(
    ym,
    schedule.periodStartYm,
    schedule.targetYm,
    anchorBefore(ym),
    exactLocked ? rowProgressPct(exactLocked, milestone.points) : null
  );
}

function buildEffectiveProgressMap(
  progress: ProgressInfo[],
  milestones: MilestoneInfo[],
  ym: string,
  schedules: Record<string, MsScheduleInfo> = {}
): Map<string, number> {
  const map = new Map<string, number>();
  for (const ms of milestones) {
    map.set(ms.milestoneId, effectiveProgressPct(progress, ms, ym, schedules[ms.milestoneId]));
  }
  return map;
}

function buildEffectiveConsumedMap(
  progress: ProgressInfo[],
  milestones: MilestoneInfo[],
  ym: string,
  schedules: Record<string, MsScheduleInfo> = {}
): Map<string, number> {
  const map = new Map<string, number>();
  for (const ms of milestones) {
    const pct = effectiveProgressPct(progress, ms, ym, schedules[ms.milestoneId]);
    map.set(ms.milestoneId, Math.round((ms.points * pct) / 100 * 100) / 100);
  }
  return map;
}

function monthRangeUntil(planCycle: PlanCycleShape | null, targetYm: string): string[] {
  if (!planCycle?.periodStartYm || planCycle.periodStartYm > targetYm) return [targetYm];
  const start = ymToMonths(planCycle.periodStartYm);
  const end = ymToMonths(targetYm);
  const months: string[] = [];
  for (let i = start; i <= end; i += 1) {
    const zeroBased = i - 1;
    const y = Math.floor(zeroBased / 12);
    const m = (zeroBased % 12) + 1;
    months.push(`${y}${String(m).padStart(2, "0")}`);
  }
  return months.length > 0 ? months : [targetYm];
}

function buildCarryOnlyReward(memberMap: Record<string, string>, carryStock: Map<string, number>, ptUnit: number): RewardSummary | null {
  const members = Array.from(carryStock.entries())
    .filter(([, amount]) => amount > 0)
    .map(([memberId, amount]) => ({
      memberId,
      memberName: memberMap[memberId] || memberId,
      earnedPt: 0,
      basePay: 0,
      bonusPt: 0,
      totalPay: 0,
      carryInYen: Math.round(amount),
      grossDueYen: Math.round(amount),
      breakdown: [],
    }));
  if (members.length === 0) return null;
  return { ptUnit, totalPaySum: 0, members };
}

function applyRewardCapForMonth(
  reward: RewardSummary,
  capBudgetYen: number,
  carryStock: Map<string, number>
): RewardSummary {
  const cap = Math.round(Number(capBudgetYen || 0));
  const membersWithGross = reward.members.map((member) => {
    const currentEarned = Math.round(member.totalPay || member.basePay || 0);
    const carryIn = Math.round(carryStock.get(member.memberId) || member.carryInYen || 0);
    const grossDue = Math.max(0, currentEarned + carryIn);
    return {
      ...member,
      basePay: Math.round(member.basePay || currentEarned),
      carryInYen: carryIn,
      grossDueYen: grossDue,
      totalPay: currentEarned,
    };
  });

  const totalGrossDue = membersWithGross.reduce((sum, member) => sum + (member.grossDueYen || 0), 0);
  const carryInTotal = membersWithGross.reduce((sum, member) => sum + (member.carryInYen || 0), 0);
  if (cap <= 0 || totalGrossDue <= cap) {
    const paidMembers = membersWithGross.map((member) => ({
      ...member,
      totalPay: member.grossDueYen || 0,
      deferredYen: 0,
      stockYen: 0,
    }));
    return {
      ...reward,
      members: paidMembers,
      totalPaySum: paidMembers.reduce((sum, member) => sum + member.totalPay, 0),
      totalGrossDueYen: totalGrossDue,
      capBudgetYen: cap,
      capped: false,
      carryInYen: carryInTotal,
      carryOverYen: 0,
      monthlyBudget65: cap,
    };
  }

  let remainingCap = cap;
  let remainingGross = totalGrossDue;
  const paidMembers = membersWithGross.map((member, index) => {
    const grossDue = member.grossDueYen || 0;
    const isLast = index === membersWithGross.length - 1;
    const proportional = remainingGross > 0 ? Math.round((remainingCap * grossDue) / remainingGross) : 0;
    const paid = Math.min(grossDue, Math.max(0, isLast ? remainingCap : proportional));
    remainingCap -= paid;
    remainingGross -= grossDue;
    const deferred = Math.max(0, grossDue - paid);
    return {
      ...member,
      cappedFrom: grossDue,
      totalPay: paid,
      deferredYen: deferred,
      stockYen: deferred,
    };
  });

  return {
    ...reward,
    members: paidMembers,
    totalPaySum: paidMembers.reduce((sum, member) => sum + member.totalPay, 0),
    totalGrossDueYen: totalGrossDue,
    capBudgetYen: cap,
    capped: true,
    carryInYen: carryInTotal,
    carryOverYen: paidMembers.reduce((sum, member) => sum + (member.stockYen || 0), 0),
    monthlyBudget65: cap,
  };
}

function buildRewardPreviewUncapped({
  ym,
  milestones,
  progress,
  responsibilities,
  memberMap,
  billing,
  planCycle,
  projectFeeType,
  projectFeeAmount,
  schedules = {},
}: {
  ym: string;
  milestones: MilestoneInfo[];
  progress: ProgressInfo[];
  responsibilities: Responsibility[];
  memberMap: Record<string, string>;
  billing: Billing;
  planCycle: PlanCycleShape | null;
  projectFeeType?: string | null;
  projectFeeAmount?: number | null;
  schedules?: Record<string, MsScheduleInfo>;
}): RewardSummary | null {
  if (milestones.length === 0 || responsibilities.length === 0) return null;

  const prevYm = prevYmStr(ym);
  const prevConsumedMap = buildEffectiveConsumedMap(progress, milestones, prevYm, schedules);
  const currConsumedMap = buildEffectiveConsumedMap(progress, milestones, ym, schedules);
  const msById = new Map(milestones.map((ms) => [ms.milestoneId, ms]));
  const totalPt = planCycle?.totalPoints || milestones.reduce((sum, ms) => sum + ms.points, 0);
  const payoutBudget = deriveRewardBudgetForPt({ billing, planCycle, projectFeeType, projectFeeAmount });
  const ptUnit = totalPt > 0 ? Math.round(payoutBudget / totalPt) : 0;
  const memberPt = new Map<string, number>();
  const memberBreakdown = new Map<string, RewardBreakdown[]>();

  for (const ms of milestones) {
    const curr = currConsumedMap.get(ms.milestoneId) || 0;
    const prev = prevConsumedMap.get(ms.milestoneId) || 0;
    const msConsumedPt = Math.round(Math.max(0, curr - prev) * 100) / 100;
    if (msConsumedPt <= 0) continue;

    const resps = responsibilities.filter((resp) => resp.milestoneId === ms.milestoneId && resp.share > 0);
    for (const resp of resps) {
      const earnedPt = Math.round(msConsumedPt * resp.share * 100) / 100;
      memberPt.set(resp.memberId, (memberPt.get(resp.memberId) || 0) + earnedPt);
      const list = memberBreakdown.get(resp.memberId) || [];
      list.push({
        msKey: ms.milestoneId,
        title: msById.get(ms.milestoneId)?.title || ms.title,
        msConsumedPt,
        share: resp.share,
        earnedPt,
      });
      memberBreakdown.set(resp.memberId, list);
    }
  }

  const members = Array.from(memberPt.entries())
    .map(([memberId, earned]) => {
      const earnedPt = Math.round(earned * 100) / 100;
      const basePay = Math.round(earnedPt * ptUnit);
      return {
        memberId,
        memberName: memberMap[memberId] || memberId,
        earnedPt,
        basePay,
        bonusPt: 0,
        totalPay: basePay,
        breakdown: memberBreakdown.get(memberId) || [],
      };
    })
    .filter((member) => member.earnedPt > 0)
    .sort((a, b) => b.earnedPt - a.earnedPt);

  if (members.length === 0) return null;

  return {
    ptUnit,
    totalPaySum: members.reduce((sum, member) => sum + member.totalPay, 0),
    members,
  };
}

function buildRewardPreview({
  ym,
  milestones,
  progress,
  responsibilities,
  memberMap,
  billing,
  planCycle,
  projectFeeType,
  projectFeeAmount,
  schedules = {},
}: {
  ym: string;
  milestones: MilestoneInfo[];
  progress: ProgressInfo[];
  responsibilities: Responsibility[];
  memberMap: Record<string, string>;
  billing: Billing;
  planCycle: PlanCycleShape | null;
  projectFeeType?: string | null;
  projectFeeAmount?: number | null;
  schedules?: Record<string, MsScheduleInfo>;
}): RewardSummary | null {
  const monthlyCap = deriveMonthlyRewardBudget({ billing, planCycle, projectFeeType, projectFeeAmount });
  const totalPt = planCycle?.totalPoints || milestones.reduce((sum, ms) => sum + ms.points, 0);
  const payoutBudget = deriveRewardBudgetForPt({ billing, planCycle, projectFeeType, projectFeeAmount });
  const ptUnit = totalPt > 0 ? Math.round(payoutBudget / totalPt) : 0;
  const carryStock = new Map<string, number>();
  let result: RewardSummary | null = null;

  for (const month of monthRangeUntil(planCycle, ym)) {
    const uncapped = buildRewardPreviewUncapped({
      ym: month,
      milestones,
      progress,
      responsibilities,
      memberMap,
      billing,
      planCycle,
      projectFeeType,
      projectFeeAmount,
      schedules,
    }) || buildCarryOnlyReward(memberMap, carryStock, ptUnit);

    if (!uncapped) continue;
    const capped = applyRewardCapForMonth(uncapped, monthlyCap, carryStock);
    carryStock.clear();
    for (const member of capped.members) {
      if ((member.stockYen || 0) > 0) carryStock.set(member.memberId, member.stockYen || 0);
    }
    if (month === ym) result = capped;
  }

  return result;
}

function normalizeTextForMatch(text: string) {
  return text.replace(/[のをにへとがはもで、。・（）()[\]\s]/g, "").toLowerCase();
}

function milestoneKeywords(title: string) {
  const normalized = normalizeTextForMatch(title);
  const chunks = title
    .split(/[のをにへとがはもで、。・（）()[\]\s]+/)
    .map((s) => normalizeTextForMatch(s))
    .filter((s) => s.length >= 2);
  return Array.from(new Set([normalized, ...chunks])).filter((s) => s.length >= 2);
}

// extractReportSnippets は正本仕様外 (design/cockpit.md L105 / manual/2-3-pj-cockpit.md L111)。
// MS 展開「現状」欄は `milestone_monthly_progress.note` + `member_ms_activities` + `member_activities`
// の 3 ソースが正本で、monthly_reports.final_content からのキーワード抽出はしない。
// (2026-07-01 まさ確定、KUTE 準拠新プロンプト導入後の table 大量出力で MS カードが破綻したため削除)

// シンプルなMarkdownレンダラー（react-markdown不要）
function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      )}
    </>
  );
}

function SimpleMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return <h4 key={i} className="text-sm font-semibold mt-3 mb-0.5">{line.slice(4)}</h4>;
        }
        if (line.startsWith("## ")) {
          return <h3 key={i} className="text-base font-semibold mt-4 mb-1 text-foreground">{line.slice(3)}</h3>;
        }
        if (line.startsWith("# ")) {
          return <h2 key={i} className="text-lg font-bold mt-4 mb-1">{line.slice(2)}</h2>;
        }
        if (line.match(/^[-*] /)) {
          return (
            <div key={i} className="flex gap-1.5 ml-2 my-0.5">
              <span className="text-muted-foreground shrink-0 mt-px">•</span>
              <span>{parseBold(line.slice(2))}</span>
            </div>
          );
        }
        if (line.startsWith("> ")) {
          return (
            <blockquote key={i} className="text-sm border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground my-1">
              {line.slice(2)}
            </blockquote>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        return <p key={i} className="my-0.5">{parseBold(line)}</p>;
      })}
    </div>
  );
}

// ─── メインコンポーネント ────────────────────────────────────────────────────

export function CockpitMonthlyModal({
  ym,
  projectId,
  report,
  billing,
  milestones,
  progress,
  responsibilities,
  memberMap,
  planCycle,
  subItems,
  msActivities = [],
  memberActivities = [],
  currentYm,
  initialTab,
  projectFeeType,
  projectFeeAmount,
  usesMsProgress = true,
  onProgressSaved,
  onClose,
}: Props) {
  // v0.33.0: タブを廃止。initialTab='report' で開かれたら編集アコーディオンを開く。
  const [reportEditorOpen, setReportEditorOpen] = useState<boolean>(() => initialTab === "report");

  // 総合進捗（シグナル計算用）
  // まさ判断 (2026-05-22 #4): buffer タグ MS は加重平均から除外する。
  const ymProgressMap = buildEffectiveProgressMap(progress, milestones, ym);
  const overallCounted = milestones.filter((m) => (m.tag || "").toLowerCase() !== "buffer");
  const totalPts = overallCounted.reduce((s, m) => s + m.points, 0);
  const weightedPct = totalPts > 0
    ? overallCounted.reduce((s, m) => s + (ymProgressMap.get(m.milestoneId) || 0) * m.points, 0) / totalPts
    : 0;
  const overallPct = Math.round(weightedPct);
  const expectedPct = planCycle ? computeExpectedPct(planCycle, ym) : null;
  const signal = expectedPct !== null ? computeSignal(expectedPct, overallPct) : null;

  // 閉じる時: （将来: GASキャッシュリフレッシュ）
  const handleClose = () => {
    onClose();
  };

  const isFuture = ym > currentYm;

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="!max-w-[1400px] sm:!max-w-[1400px] w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formatYm(ym)}
            {signal && (
              <span className="text-base" title={`期待進捗率: ${expectedPct}% / 実績: ${overallPct}%`}>
                {signal}
              </span>
            )}
            {isFuture && (
              <span className="text-xs text-muted-foreground">(予定)</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setReportEditorOpen((v) => !v)}
                className="text-xs px-2.5 py-1 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
                title="月次報告書本文を生成・編集・確定する"
              >
                社内版を編集
              </button>
              <a
                href={`/project/${projectId}/report/${ym}/print?template=${printLinkForProject(projectId).template}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2.5 py-1 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
                title="Cmd+P で PDF 保存できます"
              >
                📄 {printLinkForProject(projectId).label}
              </a>
            </div>
          </DialogTitle>
        </DialogHeader>

        {reportEditorOpen && (
          <div className="border border-border rounded-lg p-4 mb-4 bg-muted/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">📝 月次報告書 本文 (印刷ビュー §02 で参照)</h3>
              <button
                onClick={() => setReportEditorOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                閉じる ✕
              </button>
            </div>
            <ReportTab report={report} projectId={projectId} ym={ym} />
          </div>
        )}

        <RewardTab
          billing={billing}
          milestones={milestones}
          progress={progress}
          ym={ym}
          projectId={projectId}
          report={report}
          responsibilities={responsibilities}
          memberMap={memberMap}
          planCycle={planCycle}
          subItems={subItems}
          msActivities={msActivities}
          memberActivities={memberActivities}
          currentYm={currentYm}
          expectedPct={expectedPct}
          projectFeeType={projectFeeType}
          projectFeeAmount={projectFeeAmount}
          usesMsProgress={usesMsProgress}
          onProgressSaved={onProgressSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── RewardTab ───────────────────────────────────────────────────────────────

function RewardTab({
  billing,
  milestones,
  progress,
  ym,
  projectId,
  report,
  responsibilities,
  memberMap,
  planCycle,
  subItems,
  msActivities,
  memberActivities,
  currentYm,
  expectedPct,
  projectFeeType,
  projectFeeAmount,
  usesMsProgress,
  onProgressSaved,
}: {
  billing: Billing | null;
  milestones: MilestoneInfo[];
  progress: ProgressInfo[];
  ym: string;
  projectId: string;
  report: Report | null;
  responsibilities: Responsibility[];
  memberMap: Record<string, string>;
  planCycle: PlanCycleShape | null;
  subItems: SubItem[];
  msActivities: MemberMsActivityInfo[];
  memberActivities: MemberActivityInfo[];
  currentYm: string;
  expectedPct: number | null;
  projectFeeType?: string | null;
  projectFeeAmount?: number | null;
  usesMsProgress: boolean;
  onProgressSaved?: (patches: ProgressInfo[]) => void;
}) {
  const [localProgress, setLocalProgress] = useState<ProgressInfo[]>(progress);
  const [estimating, setEstimating] = useState(false);
  const [estimateMsg, setEstimateMsg] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<UnconfirmedEstimate[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modifyingKey, setModifyingKey] = useState<string | null>(null);
  const [modifyPct, setModifyPct] = useState<string>("0");
  const [modifyReason, setModifyReason] = useState<string>("");
  const [manualEditKey, setManualEditKey] = useState<string | null>(null);
  const [manualEditPct, setManualEditPct] = useState<string>("0");
  const [revisions, setRevisions] = useState<MsRevision[]>([]);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<string | null>(null);
  const [revisionText, setRevisionText] = useState("");
  const [revisionMsg, setRevisionMsg] = useState<string | null>(null);
  const [localMemberActivities, setLocalMemberActivities] = useState<MemberActivityInfo[]>(memberActivities);
  const [msSchedules, setMsSchedules] = useState<Record<string, MsScheduleInfo>>({});
  const [syncedReward, setSyncedReward] = useState<RewardSummary | null>(null);
  const [hasSyncedReward, setHasSyncedReward] = useState(false);
  const [rewardSyncing, setRewardSyncing] = useState(false);
  const [rewardSyncMsg, setRewardSyncMsg] = useState<string | null>(null);

  // 全体Editモード
  const [editMode, setEditMode] = useState(false);
  const [editPcts, setEditPcts] = useState<Record<string, number>>({});
  const [savingBatch, setSavingBatch] = useState(false);

  // 進捗イベント
  const [events, setEvents] = useState<ProgressEvent[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);

  // 立替精算
  const [reimburse, setReimburse] = useState<ReimburseItem[] | null>(null);
  const [reimburseLoading, setReimburseLoading] = useState(false);

  // 月次ノート (= MS なし PJ でも進捗を残せる自由記述、project_monthly_notes)
  const [monthlyNote, setMonthlyNote] = useState<string>("");
  const [monthlyNoteOriginal, setMonthlyNoteOriginal] = useState<string>("");
  const [monthlyNoteUpdatedAt, setMonthlyNoteUpdatedAt] = useState<string | null>(null);
  const [monthlyNoteUpdatedBy, setMonthlyNoteUpdatedBy] = useState<string | null>(null);
  const [monthlyNoteLoading, setMonthlyNoteLoading] = useState(false);
  const [monthlyNoteSaving, setMonthlyNoteSaving] = useState(false);
  const [monthlyNoteSavedAt, setMonthlyNoteSavedAt] = useState<number | null>(null);

  const isFuture = ym > currentYm;
  const rewardMilestoneSignature = milestones
    .map((ms) => `${ms.milestoneId}:${ms.points}:${ms.tag}`)
    .join("|");
  const rewardResponsibilitySignature = responsibilities
    .map((resp) => `${resp.milestoneId}:${resp.memberId}:${resp.share}`)
    .sort()
    .join("|");
  const rewardMemberSignature = Object.entries(memberMap)
    .map(([memberId, name]) => `${memberId}:${name}`)
    .sort()
    .join("|");

  function applySyncedReward(rewardSummary: unknown) {
    const reward = rewardSummary && typeof rewardSummary === "object" && Array.isArray((rewardSummary as RewardSummary).members)
      ? (rewardSummary as RewardSummary)
      : null;
    setSyncedReward(reward?.members?.length ? reward : null);
    setHasSyncedReward(true);
    return reward?.members?.length ? reward : null;
  }

  async function syncRewardSummary() {
    if (!billing || milestones.length === 0 || responsibilities.length === 0) {
      applySyncedReward(null);
      return null;
    }
    setRewardSyncing(true);
    try {
      const res = await fetch("/api/rewards/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "reward sync failed");
      const reward = applySyncedReward(data.rewardSummary);
      setRewardSyncMsg(null);
      return reward;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRewardSyncMsg(`報酬サマリーのSupabase保存に失敗: ${message}`);
      return null;
    } finally {
      setRewardSyncing(false);
    }
  }

  const upsertLocalProgress = (patches: ProgressInfo[]) => {
    setLocalProgress((prev) => {
      const map = new Map(prev.map((p) => [`${p.milestoneKey}_${p.ym}`, p]));
      for (const patch of patches) {
        const key = `${patch.milestoneKey}_${patch.ym}`;
        map.set(key, { ...map.get(key), ...patch });
      }
      return Array.from(map.values());
    });
    onProgressSaved?.(patches);
    void syncRewardSummary();
  };

  useEffect(() => {
    setLocalProgress(progress);
  }, [progress, ym]);

  useEffect(() => {
    setLocalMemberActivities(memberActivities);
  }, [memberActivities, ym]);

  useEffect(() => {
    setSyncedReward(null);
    setHasSyncedReward(false);
    setRewardSyncMsg(null);
    void syncRewardSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projectId,
    ym,
    billing?.budgetYen,
    billing?.rewardSummaryJson,
    rewardMilestoneSignature,
    rewardResponsibilitySignature,
    rewardMemberSignature,
  ]);

  // 未確認推定
  const fetchUnconfirmed = async () => {
    try {
      const res = await fetch(`/api/progress/unconfirmed?projectId=${projectId}&ym=${ym}`);
      const data = await res.json();
      if (data.ok) setUnconfirmed(data.unconfirmed || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchUnconfirmed();
    loadMsSchedules();
    loadEvents();
    loadReimburse();
    loadRevisions();
    loadMonthlyNote();
  }, [projectId, ym]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMsSchedules = async () => {
    if (!planCycle) {
      setMsSchedules({});
      return;
    }
    try {
      const res = await fetch(`/api/progress/ms-schedule?projectId=${projectId}&startYm=${planCycle.periodStartYm}&ym=${ym}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "schedule load failed");
      const map: Record<string, MsScheduleInfo> = {};
      for (const item of data.schedules || []) {
        map[item.milestoneId] = item;
      }
      setMsSchedules(map);
    } catch {
      setMsSchedules({});
    }
  };

  // 月次ノート取得
  const loadMonthlyNote = async () => {
    setMonthlyNoteLoading(true);
    try {
      const res = await fetch(`/api/project/monthly-note?projectId=${projectId}&ym=${ym}`);
      const data = await res.json();
      const body = data?.note?.body ?? "";
      setMonthlyNote(body);
      setMonthlyNoteOriginal(body);
      setMonthlyNoteUpdatedAt(data?.note?.updated_at ?? null);
      setMonthlyNoteUpdatedBy(data?.note?.updated_by ?? null);
    } catch {
      setMonthlyNote("");
      setMonthlyNoteOriginal("");
    } finally {
      setMonthlyNoteLoading(false);
    }
  };

  const saveMonthlyNote = async () => {
    setMonthlyNoteSaving(true);
    try {
      const res = await fetch(`/api/project/monthly-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym, body: monthlyNote }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMonthlyNoteOriginal(monthlyNote);
      setMonthlyNoteUpdatedAt(new Date().toISOString());
      setMonthlyNoteSavedAt(Date.now());
      setTimeout(() => setMonthlyNoteSavedAt(null), 2500);
    } catch (err) {
      console.error("[monthly-note] save error:", err);
      alert(`保存に失敗しました: ${err}`);
    } finally {
      setMonthlyNoteSaving(false);
    }
  };

  const loadRevisions = async () => {
    setRevisionLoading(true);
    try {
      const res = await fetch(`/api/progress/revisions?projectId=${projectId}&ym=${ym}`);
      const data = await res.json();
      setRevisions(data.ok ? data.revisions || [] : []);
    } catch {
      setRevisions([]);
    } finally {
      setRevisionLoading(false);
    }
  };

  // 進捗イベント取得（展開時）
  const loadEvents = async (force = false) => {
    if (!force && events !== null) return;
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/progress/events?projectId=${projectId}&ym=${ym}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  // 立替精算取得（展開時）
  const loadReimburse = async () => {
    if (reimburse !== null) return;
    setReimburseLoading(true);
    try {
      const res = await fetch(`/api/progress/reimbursement?projectId=${projectId}&ym=${ym}`);
      const data = await res.json();
      setReimburse(data.items || []);
    } catch {
      setReimburse([]);
    } finally {
      setReimburseLoading(false);
    }
  };

  // AI再推定
  const handleEstimate = async () => {
    setEstimating(true);
    setEstimateMsg(null);
    try {
      const res = await fetch("/api/progress/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "推定に失敗しました");

      if (data.details?.length > 0) {
        const patches: ProgressInfo[] = [];
        for (const d of data.details) {
          if (d.skipped || d.cumulative === 0) continue;
          const msPts = milestones.find((m) => m.milestoneId === d.milestoneKey)?.points || 0;
          patches.push({
            milestoneKey: d.milestoneKey,
            ym,
            progressPct: d.cumulative,
            consumedPt: Math.round(msPts * d.cumulative / 100 * 100) / 100,
            source: "tsukuyomi_estimate",
            note: d.reason || null,
          });
        }
        if (patches.length > 0) {
          upsertLocalProgress(patches);
          for (const patch of patches) {
            setUnconfirmed((prev) => {
              const others = prev.filter((u) => u.milestoneKey !== patch.milestoneKey);
              const previous = prevProgress.get(patch.milestoneKey) || 0;
              return [
                ...others,
                {
                  milestoneKey: patch.milestoneKey,
                  progressPct: patch.progressPct,
                  prevPct: previous,
                  reason: patch.note || "",
                },
              ];
            });
          }
        }
      }

      const msg = data.message
        ? `⚠ ${data.message}`
        : `✓ ${data.saved}件のMS進捗を更新しました`;
      setEstimateMsg(msg);
      await fetchUnconfirmed();

      const reasonMap: Record<string, string> = {};
      for (const d of data.details || []) {
        if (d.reason) reasonMap[d.milestoneKey] = d.reason;
      }
      if (Object.keys(reasonMap).length > 0) {
        setUnconfirmed((prev) => prev.map((u) => ({
          ...u, reason: reasonMap[u.milestoneKey] || u.reason,
        })));
      }
    } catch (e) {
      setEstimateMsg(`❌ ${e instanceof Error ? e.message : "エラー"}`);
    } finally {
      setEstimating(false);
    }
  };

  // 推定アクション（採用/不採用/修正）
  const handleAction = async (
    milestoneKey: string,
    action: "adopt" | "reject" | "modify" | "manual",
    options?: { reason?: string; newPct?: number }
  ) => {
    setActionLoading(milestoneKey);
    try {
      const res = await fetch("/api/progress/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym, milestoneKey, action, ...options }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if ("rewardSummary" in data) applySyncedReward(data.rewardSummary);

      setUnconfirmed((prev) => prev.filter((u) => u.milestoneKey !== milestoneKey));
      setModifyingKey(null);
      setManualEditKey(null);

      if (action === "reject" && data.revertedPct !== undefined) {
        const msPts = milestones.find((m) => m.milestoneId === milestoneKey)?.points || 0;
        upsertLocalProgress([{
          milestoneKey,
          ym,
          progressPct: data.revertedPct,
          consumedPt: Math.round(msPts * data.revertedPct / 100 * 100) / 100,
          source: "pm_rejected",
        }]);
      } else if ((action === "adopt" || action === "modify" || action === "manual") && data.newPct !== undefined) {
        const msPts = milestones.find((m) => m.milestoneId === milestoneKey)?.points || 0;
        const newConsumed = Math.round(msPts * data.newPct / 100 * 100) / 100;
        upsertLocalProgress([{
          milestoneKey,
          ym,
          progressPct: data.newPct,
          consumedPt: newConsumed,
          source: action === "manual" ? "pm_manual" : "pm_confirmed",
          note: options?.reason || null,
        }]);
      }
    } catch (e) {
      console.error("action error:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const submitRevision = async (milestoneId: string, existingRevisionId?: string) => {
    const requestText = revisionText.trim();
    if (!requestText) return;
    setRevisionMsg("つくよみに送信中...");
    try {
      const ms = milestones.find((m) => m.milestoneId === milestoneId);
      const res = await fetch("/api/progress/revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          milestoneId,
          ym,
          requestText,
          currentPct: ymProgress.get(milestoneId) || 0,
          currentNote: progressDetailMap.get(milestoneId)?.note || "",
          milestoneTitle: ms?.title || milestoneId,
          revisionId: existingRevisionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "送信に失敗しました");
      if (Array.isArray(data.activities) && data.activities.length > 0) {
        setLocalMemberActivities((prev) => {
          const map = new Map(prev.map((a) => [a.id, a]));
          for (const activity of data.activities) map.set(activity.id, activity);
          return Array.from(map.values());
        });
      }
      setRevisionTarget(null);
      setRevisionText("");
      const collected = Number(data.collection?.saved || 0);
      const extracted = Number(data.activities?.length || 0);
      setRevisionMsg(collected > 0 || extracted > 0
        ? `つくよみが提案を返したよ（Gmail収集 ${collected}件 / 活動抽出 ${extracted}件）`
        : "つくよみが提案を返したよ");
      await loadRevisions();
    } catch (e) {
      setRevisionMsg(`エラー: ${e instanceof Error ? e.message : "送信失敗"}`);
    }
  };

  const updateRevision = async (revisionId: string, action: "confirm" | "discard") => {
    setRevisionMsg(action === "confirm" ? "確定中..." : "破棄中...");
    try {
      const res = await fetch("/api/progress/revisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新に失敗しました");
      if ("rewardSummary" in data) applySyncedReward(data.rewardSummary);
      if (action === "confirm" && data.progress) {
        upsertLocalProgress([data.progress]);
      }
      setRevisionMsg(action === "confirm" ? "確定して学習したよ" : "破棄したよ");
      await loadRevisions();
    } catch (e) {
      setRevisionMsg(`エラー: ${e instanceof Error ? e.message : "更新失敗"}`);
    }
  };

  // 全体Editモード: 開始
  const enterEditMode = () => {
    const pcts: Record<string, number> = {};
    for (const ms of milestones) {
      pcts[ms.milestoneId] = ymProgress.get(ms.milestoneId) || 0;
    }
    setEditPcts(pcts);
    setEditMode(true);
  };

  // 全体Editモード: 一括保存
  const handleBatchSave = async () => {
    setSavingBatch(true);
    try {
      const payload = Object.entries(editPcts).map(([milestoneKey, progressPct]) => ({
        milestoneKey,
        progressPct,
      }));
      const res = await fetch("/api/progress/batch-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym, milestones: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if ("rewardSummary" in data) applySyncedReward(data.rewardSummary);

      // ローカル進捗を更新（consumedPt も再計算して報酬予定額に即時反映）
      const msPtsMap = new Map(milestones.map((m) => [m.milestoneId, m.points]));
      const patches = Object.entries(editPcts).map(([msKey, pct]) => {
        const msPts = msPtsMap.get(msKey) || 0;
        return {
          milestoneKey: msKey,
          ym,
          progressPct: pct,
          consumedPt: Math.round(msPts * pct / 100 * 100) / 100,
          source: "pm_manual",
          note: "一括編集",
        };
      });
      upsertLocalProgress(patches);
      setEditMode(false);
    } catch (e) {
      console.error("batch save error:", e);
    } finally {
      setSavingBatch(false);
    }
  };

  if (!billing) {
    return <p className="text-sm text-muted-foreground py-4">この月の請求データがありません</p>;
  }

  // ── 進捗計算 ──
  const ymProgress = buildEffectiveProgressMap(localProgress, milestones, ym, msSchedules);

  // 前月進捗（今月消化pt計算用）
  const prevYm = prevYmStr(ym);
  const prevConsumedMap = buildEffectiveConsumedMap(localProgress, milestones, prevYm, msSchedules);
  const currConsumedMap = buildEffectiveConsumedMap(localProgress, milestones, ym, msSchedules);
  const monthConsumedPt = milestones.reduce((s, m) => {
    const curr = currConsumedMap.get(m.milestoneId) || 0;
    const prev = prevConsumedMap.get(m.milestoneId) || 0;
    return s + Math.max(0, curr - prev);
  }, 0);
  const cumulativeConsumedPt = milestones.reduce((s, m) => s + (currConsumedMap.get(m.milestoneId) || 0), 0);

  const respMap = new Map<string, Responsibility[]>();
  for (const r of responsibilities) {
    const arr = respMap.get(r.milestoneId) || [];
    arr.push(r);
    respMap.set(r.milestoneId, arr);
  }

  const subItemsMap = new Map<string, SubItem[]>();
  for (const si of subItems) {
    const arr = subItemsMap.get(si.milestoneId) || [];
    arr.push(si);
    subItemsMap.set(si.milestoneId, arr);
  }

  const progressDetailMap = new Map<string, ProgressInfo>();
  for (const p of localProgress) {
    if (p.ym === ym) progressDetailMap.set(p.milestoneKey, p);
  }

  const activityMap = new Map<string, MemberMsActivityInfo[]>();
  for (const activity of msActivities) {
    if (activity.ym !== ym) continue;
    const arr = activityMap.get(activity.milestoneId) || [];
    arr.push(activity);
    activityMap.set(activity.milestoneId, arr);
  }

  const memberActivityMap = new Map<string, MemberActivityInfo[]>();
  for (const activity of localMemberActivities) {
    if (activity.ym !== ym || !activity.milestoneId) continue;
    const arr = memberActivityMap.get(activity.milestoneId) || [];
    arr.push(activity);
    memberActivityMap.set(activity.milestoneId, arr);
  }

  const unconfirmedMap = new Map<string, UnconfirmedEstimate>();
  for (const u of unconfirmed) unconfirmedMap.set(u.milestoneKey, u);
  const prevProgress = buildEffectiveProgressMap(localProgress, milestones, prevYm, msSchedules);
  const revisionsByMs = new Map<string, MsRevision[]>();
  for (const revision of revisions) {
    const arr = revisionsByMs.get(revision.milestoneId) || [];
    arr.push(revision);
    revisionsByMs.set(revision.milestoneId, arr);
  }

  // まさ判断 (2026-05-22 #4): buffer タグ MS は加重平均から除外する。
  const overallCounted = milestones.filter((m) => (m.tag || "").toLowerCase() !== "buffer");
  const totalPts = overallCounted.reduce((s, m) => s + m.points, 0);
  const weightedPct = totalPts > 0
    ? overallCounted.reduce((s, m) => s + (ymProgress.get(m.milestoneId) || 0) * m.points, 0) / totalPts
    : 0;
  const overallPct = Math.round(weightedPct);

  // ptUnit 計算
  const rewardBudgetForPt = deriveRewardBudgetForPt({ billing, planCycle, projectFeeType, projectFeeAmount });
  const monthlyRewardBudget = deriveMonthlyRewardBudget({ billing, planCycle, projectFeeType, projectFeeAmount });
  const rewardPointBasis = rewardPointBasisForUnit(milestones, planCycle);
  const planPtUnit = rewardPointBasis > 0 && rewardBudgetForPt > 0
    ? Math.round(rewardBudgetForPt / rewardPointBasis)
    : billing.rewardSummaryJson?.ptUnit || 0;
  const storedReward = billing.rewardSummaryJson?.members?.length ? billing.rewardSummaryJson : null;
  const displayReward = hasSyncedReward ? syncedReward : storedReward;
  const isRewardPreview = false;

  // MS分類
  const msNormal = milestones.filter((m) => {
    const tag = (m.tag || "").toLowerCase();
    return tag !== "routine" && tag !== "buffer";
  });
  const msExtra = milestones.filter(isCapExtraMilestoneInfo);
  const msRoutine = milestones.filter((m) => (m.tag || "").toLowerCase() === "routine");
  const msBuffer = milestones.filter((m) => (m.tag || "").toLowerCase() === "buffer");
  const bufferPt = msBuffer.reduce((s, m) => s + m.points, 0);

  return (
    <div className="space-y-4">
      {/* ── プラン情報バー ── */}
      {planCycle && (
        <div className="text-[12px] text-muted-foreground bg-muted/20 rounded-lg px-3 py-2 flex flex-wrap gap-3 items-center">
          <span>{formatYm(planCycle.periodStartYm)} 〜 {formatYm(planCycle.periodEndYm)}</span>
          <span>全 {planCycle.totalPoints}pt</span>
          {msExtra.length > 0 && <span>通常単価対象 {rewardPointBasis}pt</span>}
          {planPtUnit > 0 && <span>1pt = ¥{planPtUnit.toLocaleString()}</span>}
          {bufferPt > 0 && (
            <span className="text-[11px] text-muted-foreground/70">バッファ: {bufferPt}pt</span>
          )}
        </div>
      )}

      {/* ── 5指標ステータス行 ── */}
      <div className="grid grid-cols-5 gap-2">
        <StatCard
          label={isFuture ? "消化予定" : "今月消化"}
          value={`${Math.round(monthConsumedPt * 10) / 10}pt`}
        />
        <StatCard
          label="累計消化"
          value={totalPts > 0
            ? `${Math.round(cumulativeConsumedPt * 10) / 10}/${totalPts}pt`
            : `${Math.round(cumulativeConsumedPt * 10) / 10}pt`
          }
        />
        <StatCard label="進捗率" value={`${overallPct}%`} />
        {expectedPct !== null && (
          <StatCard label="期待進捗率" value={`${expectedPct}%`} />
        )}
        <StatCard label="会議" value={formatDate(billing.meetingStartAt)} />
      </div>

      {/* ── 未確認推定バナー ── */}
      {unconfirmed.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span className="text-amber-600 text-[13px] font-medium">
            🤖 つくよみ推定（未確認 {unconfirmed.length}件）各MSの右側で確認してね
          </span>
        </div>
      )}

      {/* ── AI再推定 + MS改定 + Editボタン ── */}
      {milestones.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleEstimate}
            disabled={estimating}
            className="text-xs px-3 py-1.5 rounded-md border border-[#007aff]/40 text-[#007aff] hover:bg-[#007aff]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {estimating ? "推定中…" : "🤖 AIで再推定"}
          </button>
          <button
            disabled
            title="MS改定: 次のセッションで実装予定"
            className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground opacity-50 cursor-not-allowed"
          >
            🔄 MS改定
          </button>
          <button
            onClick={editMode ? () => setEditMode(false) : enterEditMode}
            className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            {editMode ? "✏️ 閉じる" : "✏️ Edit"}
          </button>
          {estimateMsg && (
            <span className={`text-[12px] ${estimateMsg.startsWith("❌") ? "text-red-500" : estimateMsg.startsWith("⚠") ? "text-amber-600" : "text-emerald-600"}`}>
              {estimateMsg}
            </span>
          )}
        </div>
      )}

      {/* ── MS全体Editモード ── */}
      {editMode && (
        <div className="border border-border rounded-lg p-4 bg-muted/10 space-y-3">
          <p className="text-[12px] text-muted-foreground">各MSの累計進捗率（%）を入力</p>
          {milestones.filter((m) => (m.tag || "").toLowerCase() !== "buffer").map((ms) => {
            const pct = editPcts[ms.milestoneId] ?? ymProgress.get(ms.milestoneId) ?? 0;
            const earnedPt = Math.round(ms.points * pct / 100 * 10) / 10;
            return (
              <div key={ms.milestoneId} className="flex items-center gap-2">
                <span className="text-[12px] min-w-[180px] max-w-[200px] truncate flex-shrink-0">
                  {ms.title}
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={pct}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setEditPcts((prev) => ({ ...prev, [ms.milestoneId]: v }));
                  }}
                  className="flex-1 min-w-[80px] accent-[#0066cc]"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={pct}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setEditPcts((prev) => ({ ...prev, [ms.milestoneId]: v }));
                  }}
                  className="w-14 text-center text-[12px] border border-border rounded px-1 py-0.5"
                />
                <span className="text-[11px] text-muted-foreground">%</span>
                <span className="text-[11px] text-[#0066cc] min-w-[44px] text-right">{earnedPt}pt</span>
              </div>
            );
          })}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => setEditMode(false)}
              className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted/30"
            >
              キャンセル
            </button>
            <button
              onClick={handleBatchSave}
              disabled={savingBatch}
              className="text-xs px-3 py-1.5 rounded-md bg-[#0066cc] text-white hover:bg-[#0055aa] disabled:opacity-50"
            >
              {savingBatch ? "保存中…" : "💾 保存"}
            </button>
          </div>
        </div>
      )}

      {/* ── 全体進捗バー ── */}
      {milestones.length > 0 && !editMode && (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium">MS進捗（加重平均）</span>
            <div className="flex items-center gap-2">
              {expectedPct !== null && (
                <span className="text-[11px] text-muted-foreground">期待: {expectedPct}%</span>
              )}
              <span className={`text-[14px] font-semibold ${
                overallPct >= 80 ? "text-emerald-600" : overallPct > 0 ? "text-[#0066cc]" : "text-muted-foreground"
              }`}>
                {overallPct}%
              </span>
            </div>
          </div>
          <div className="relative h-2.5 bg-[#e5e7eb] rounded-full overflow-hidden">
            {/* 期待進捗マーカー */}
            {expectedPct !== null && expectedPct > 0 && (
              <div
                className="absolute top-0 h-full w-0.5 bg-muted-foreground/40 z-10"
                style={{ left: `${Math.min(expectedPct, 100)}%` }}
                title={`期待: ${expectedPct}%`}
              />
            )}
            <div
              className={`h-full rounded-full transition-all ${
                overallPct >= 80 ? "bg-emerald-500" : overallPct > 0 ? "bg-[#0066cc]" : "bg-[#d1d5db]"
              }`}
              style={{ width: `${Math.min(overallPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── MS別進捗 ── */}
      {milestones.length > 0 && !editMode && (
        <div className="space-y-2">
          <p className="text-[12px] text-muted-foreground font-medium">MS別進捗</p>

          {/* ノーマルMS */}
          {msNormal.map((ms) => (
            <MsBarRow
              key={ms.milestoneId}
              ms={ms}
              pct={ymProgress.get(ms.milestoneId) || 0}
              resps={respMap.get(ms.milestoneId) || []}
              est={unconfirmedMap.get(ms.milestoneId)}
              memberMap={memberMap}
              subItems={subItemsMap.get(ms.milestoneId) || []}
              progressNote={progressDetailMap.get(ms.milestoneId)?.note || null}
              activities={activityMap.get(ms.milestoneId) || []}
              memberActivities={memberActivityMap.get(ms.milestoneId) || []}
              prevPct={prevProgress.get(ms.milestoneId) || 0}
              schedule={msSchedules[ms.milestoneId]}
              expectedPct={msSchedules[ms.milestoneId]?.expectedCumPct ?? expectedPct}
              monthlyDeltaPct={Math.max(0, (ymProgress.get(ms.milestoneId) || 0) - (prevProgress.get(ms.milestoneId) || 0))}
              revisions={revisionsByMs.get(ms.milestoneId) || []}
              revisionLoading={revisionLoading}
              revisionTarget={revisionTarget}
              revisionText={revisionText}
              revisionMsg={revisionMsg}
              isManualEditing={manualEditKey === ms.milestoneId}
              manualEditPct={manualEditPct}
              isModifying={modifyingKey === ms.milestoneId}
              modifyPct={modifyPct}
              modifyReason={modifyReason}
              actionLoading={actionLoading}
              onManualEdit={() => {
                setManualEditKey(ms.milestoneId);
                setManualEditPct(String(ymProgress.get(ms.milestoneId) || 0));
              }}
              onManualEditCancel={() => setManualEditKey(null)}
              onManualEditPctChange={setManualEditPct}
              onManualSave={() => handleAction(ms.milestoneId, "manual", { newPct: Number(manualEditPct || 0) })}
              onAdopt={() => handleAction(ms.milestoneId, "adopt")}
              onReject={() => handleAction(ms.milestoneId, "reject")}
              onModifyStart={() => {
                setModifyingKey(ms.milestoneId);
                setModifyPct(String(ymProgress.get(ms.milestoneId) || 0));
                setModifyReason("");
              }}
              onModifyCancel={() => setModifyingKey(null)}
              onModifyPctChange={setModifyPct}
              onModifyReasonChange={setModifyReason}
              onModifySave={() => handleAction(ms.milestoneId, "modify", {
                newPct: Number(modifyPct || 0), reason: modifyReason,
              })}
              onRevisionStart={() => {
                setRevisionTarget(ms.milestoneId);
                setRevisionText("");
                setRevisionMsg(null);
              }}
              onRevisionCancel={() => setRevisionTarget(null)}
              onRevisionTextChange={setRevisionText}
              onRevisionSubmit={(revisionId) => submitRevision(ms.milestoneId, revisionId)}
              onRevisionConfirm={(revisionId) => updateRevision(revisionId, "confirm")}
              onRevisionDiscard={(revisionId) => updateRevision(revisionId, "discard")}
            />
          ))}

          {/* ルーティンMS（区切り線付き） */}
          {msRoutine.length > 0 && (
            <div className="pt-2 mt-2 border-t border-dashed border-border">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">🔄 定常業務</p>
              {msRoutine.map((ms) => (
                <MsBarRow
                  key={ms.milestoneId}
                  ms={ms}
                  pct={ymProgress.get(ms.milestoneId) || 0}
                  resps={respMap.get(ms.milestoneId) || []}
                  est={unconfirmedMap.get(ms.milestoneId)}
                  memberMap={memberMap}
                  subItems={subItemsMap.get(ms.milestoneId) || []}
                  progressNote={progressDetailMap.get(ms.milestoneId)?.note || null}
                  activities={activityMap.get(ms.milestoneId) || []}
                  memberActivities={memberActivityMap.get(ms.milestoneId) || []}
                      prevPct={prevProgress.get(ms.milestoneId) || 0}
                  schedule={msSchedules[ms.milestoneId]}
                  expectedPct={msSchedules[ms.milestoneId]?.expectedCumPct ?? expectedPct}
                  monthlyDeltaPct={Math.max(0, (ymProgress.get(ms.milestoneId) || 0) - (prevProgress.get(ms.milestoneId) || 0))}
                  revisions={revisionsByMs.get(ms.milestoneId) || []}
                  revisionLoading={revisionLoading}
                  revisionTarget={revisionTarget}
                  revisionText={revisionText}
                  revisionMsg={revisionMsg}
                  isManualEditing={manualEditKey === ms.milestoneId}
                  manualEditPct={manualEditPct}
                  isModifying={modifyingKey === ms.milestoneId}
                  modifyPct={modifyPct}
                  modifyReason={modifyReason}
                  actionLoading={actionLoading}
                  onManualEdit={() => {
                    setManualEditKey(ms.milestoneId);
                    setManualEditPct(String(ymProgress.get(ms.milestoneId) || 0));
                  }}
                  onManualEditCancel={() => setManualEditKey(null)}
                  onManualEditPctChange={setManualEditPct}
                  onManualSave={() => handleAction(ms.milestoneId, "manual", { newPct: Number(manualEditPct || 0) })}
                  onAdopt={() => handleAction(ms.milestoneId, "adopt")}
                  onReject={() => handleAction(ms.milestoneId, "reject")}
                  onModifyStart={() => {
                    setModifyingKey(ms.milestoneId);
                    setModifyPct(String(ymProgress.get(ms.milestoneId) || 0));
                    setModifyReason("");
                  }}
                  onModifyCancel={() => setModifyingKey(null)}
                  onModifyPctChange={setModifyPct}
                  onModifyReasonChange={setModifyReason}
                  onModifySave={() => handleAction(ms.milestoneId, "modify", {
                    newPct: Number(modifyPct || 0), reason: modifyReason,
                  })}
                  onRevisionStart={() => {
                    setRevisionTarget(ms.milestoneId);
                    setRevisionText("");
                    setRevisionMsg(null);
                  }}
                  onRevisionCancel={() => setRevisionTarget(null)}
                  onRevisionTextChange={setRevisionText}
                  onRevisionSubmit={(revisionId) => submitRevision(ms.milestoneId, revisionId)}
                  onRevisionConfirm={(revisionId) => updateRevision(revisionId, "confirm")}
                  onRevisionDiscard={(revisionId) => updateRevision(revisionId, "discard")}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 💰 メンバー報酬 ── */}
      {rewardSyncing && (
        <p className="text-[11px] text-muted-foreground">報酬サマリーをSupabaseへ保存中...</p>
      )}
      {rewardSyncMsg && !rewardSyncing && (
        <p className="text-[11px] text-red-600">{rewardSyncMsg}</p>
      )}
      {displayReward?.members && displayReward.members.length > 0 && (
        <MemberPayoutSection
          reward={displayReward}
          memberMap={memberMap}
          isPreview={isRewardPreview}
          pjBudgetYen={monthlyRewardBudget}
          missingBudget={monthlyRewardBudget <= 0}
        />
      )}

      {/* ── 進捗イベント ── */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 text-[12px] font-medium border-b border-border bg-muted/10">
          📝 進捗イベント
          {events !== null && ` (${events.filter((e) => e.status !== "rejected").length}件)`}
        </div>
        <div className="px-4 pb-4">
          {eventsLoading ? (
            <p className="text-[12px] text-muted-foreground py-2">読み込み中...</p>
          ) : (
            // 2026-05-12 まさ「先手力の表示が消えてる」: events 0 件でも EventsSection に渡して、
            // 内部で「先手力 —」+「イベントデータなし」両方表示する形に変更
            <EventsSection
              events={events ?? []}
              milestones={milestones}
              projectId={projectId}
              ym={ym}
              onUpdated={() => loadEvents(true)}
            />
          )}
        </div>
      </div>

      {/* ── 月次ノート (= MS なし PJ でも進捗を残せる自由記述) ──
          2026-05-12 まさタスク 3。MS plan_cycle 未設定の PJ では MS タブが消えるため、
          ここが進捗記録の主要場所になる。MS あり PJ でも MS に紐付かない補足メモとして利用可。 */}
      <MonthlyNoteSection
        loading={monthlyNoteLoading}
        saving={monthlyNoteSaving}
        savedAt={monthlyNoteSavedAt}
        body={monthlyNote}
        original={monthlyNoteOriginal}
        updatedAt={monthlyNoteUpdatedAt}
        updatedBy={monthlyNoteUpdatedBy}
        hasMs={usesMsProgress && !!planCycle && milestones.length > 0}
        usesMsProgress={usesMsProgress}
        onChange={setMonthlyNote}
        onSave={saveMonthlyNote}
      />

      {/* ── 立替精算 ── */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 text-[12px] font-medium border-b border-border bg-muted/10">
          🧾 立替精算
          {reimburse !== null && reimburse.length > 0 && ` (${reimburse.length}件)`}
        </div>
        <div className="px-4 pb-4">
          {reimburseLoading ? (
            <p className="text-[12px] text-muted-foreground py-2">読み込み中...</p>
          ) : reimburse === null || reimburse.length === 0 ? (
            <p className="text-[12px] text-muted-foreground py-2">精算データなし</p>
          ) : (
            <ReimburseSection items={reimburse} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MS進捗バー行 ────────────────────────────────────────────────────────────

function MsBarRow({
  ms, pct, resps, est, memberMap, subItems,
  progressNote, activities, memberActivities, prevPct, schedule, expectedPct, monthlyDeltaPct,
  revisions, revisionLoading, revisionTarget, revisionText, revisionMsg,
  isManualEditing, manualEditPct, isModifying, modifyPct, modifyReason, actionLoading,
  onManualEdit, onManualEditCancel, onManualEditPctChange, onManualSave,
  onAdopt, onReject, onModifyStart, onModifyCancel, onModifyPctChange, onModifyReasonChange, onModifySave,
  onRevisionStart, onRevisionCancel, onRevisionTextChange, onRevisionSubmit, onRevisionConfirm, onRevisionDiscard,
}: {
  ms: MilestoneInfo;
  pct: number;
  resps: Responsibility[];
  est: UnconfirmedEstimate | undefined;
  memberMap: Record<string, string>;
  subItems: SubItem[];
  progressNote?: string | null;
  activities: MemberMsActivityInfo[];
  memberActivities: MemberActivityInfo[];
  prevPct: number;
  schedule?: MsScheduleInfo;
  expectedPct: number | null;
  monthlyDeltaPct: number;
  revisions: MsRevision[];
  revisionLoading: boolean;
  revisionTarget: string | null;
  revisionText: string;
  revisionMsg: string | null;
  isManualEditing: boolean;
  manualEditPct: string;
  isModifying: boolean;
  modifyPct: string;
  modifyReason: string;
  actionLoading: string | null;
  onManualEdit: () => void;
  onManualEditCancel: () => void;
  onManualEditPctChange: (v: string) => void;
  onManualSave: () => void;
  onAdopt: () => void;
  onReject: () => void;
  onModifyStart: () => void;
  onModifyCancel: () => void;
  onModifyPctChange: (v: string) => void;
  onModifyReasonChange: (v: string) => void;
  onModifySave: () => void;
  onRevisionStart: () => void;
  onRevisionCancel: () => void;
  onRevisionTextChange: (v: string) => void;
  onRevisionSubmit: (revisionId?: string) => void;
  onRevisionConfirm: (revisionId: string) => void;
  onRevisionDiscard: (revisionId: string) => void;
}) {
  const isUnconfirmed = !!est;
  const basePct = Math.max(0, Math.min(100, isUnconfirmed ? est.prevPct : prevPct));
  const displayedPct = Math.max(0, Math.min(100, isUnconfirmed ? est.progressPct : pct));
  const actualDeltaPct = isUnconfirmed ? 0 : Math.max(0, displayedPct - basePct);
  const estimateDeltaPct = isUnconfirmed ? Math.max(0, displayedPct - basePct) : 0;
  const pctColor = displayedPct > 0 ? "text-[#0066cc]" : "text-muted-foreground";
  const tagLower = (ms.tag || "").toLowerCase();
  const tagBadge = tagLower === "routine" ? (
    <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">定常</span>
  ) : tagLower === "buffer" ? (
    <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">バッファ</span>
  ) : null;
  const hasWork = !!progressNote?.trim()
    || activities.some((a) => a.narrative?.trim() || a.learnedAddendum?.trim())
    || memberActivities.some((a) => a.contentPreview?.trim() || a.title?.trim());
  const pendingRevision = revisions.find((r) => r.status === "pending");
  const isRevisionEditing = revisionTarget === ms.milestoneId;
  const scheduleLabel = schedule
    ? schedule.periodStartYm === schedule.targetYm
      ? `期間 ${formatYm(schedule.targetYm)}`
      : `期間 ${formatYm(schedule.periodStartYm)}〜${formatYm(schedule.targetYm)}`
    : null;

  return (
    <div className="mb-2">
      <div className="flex gap-3 items-stretch">
        {/* 左: 進捗バー */}
        <div className="w-[520px] shrink-0 bg-muted/20 rounded-lg px-3 py-2">
          <div className="mb-1.5">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug break-words">
                {ms.title}
              </span>
              {!isUnconfirmed && (
                <button
                  onClick={onManualEdit}
                  className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                  title="手動で編集"
                >
                  ✏️
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {tagBadge}
              {scheduleLabel && (
                <span
                  className="text-[9px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded"
                  title={`このMSの実施期間。期待進捗: ${schedule?.expectedCumPct ?? 0}%`}
                >
                  {scheduleLabel}
                </span>
              )}
              {resps.map((r) => (
                <span key={r.memberId} className="text-[10px] text-[#007aff] bg-[#007aff]/8 px-1 rounded">
                  {memberMap[r.memberId] || "PM"}
                  {resps.length > 1 && r.share > 0 && (
                    <span className="text-[9px] opacity-70"> {Math.round(r.share * 100)}%</span>
                  )}
                </span>
              ))}
              <span className="text-[11px] text-muted-foreground">{ms.points}pt</span>
              <span className={`text-[12px] font-semibold ${pctColor}`}>
                {displayedPct}%
              </span>
            </div>
          </div>

          {/* 進捗バー */}
          <div className="relative h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
            {basePct > 0 && (
              <div
                className="absolute top-0 left-0 h-full bg-[#94a3b8]"
                style={{ width: `${basePct}%` }}
                title={`前月まで: ${basePct}%`}
              />
            )}
            {actualDeltaPct > 0 && (
              <div
                className="absolute top-0 h-full bg-[#007aff]"
                style={{ left: `${basePct}%`, width: `${Math.min(actualDeltaPct, 100 - basePct)}%` }}
                title={`今月分: +${actualDeltaPct}%`}
              />
            )}
            {estimateDeltaPct > 0 && (
              <div
                className="absolute top-0 h-full"
                style={{
                  left: `${basePct}%`,
                  width: `${Math.min(estimateDeltaPct, 100 - basePct)}%`,
                  background: "repeating-linear-gradient(45deg,#f59e0b,#f59e0b 3px,#fde68a 3px,#fde68a 6px)",
                }}
                title={`つくよみ推定: +${estimateDeltaPct}%`}
              />
            )}
            {expectedPct !== null && expectedPct > 0 && (
              <div
                className="absolute top-0 h-full w-0.5 bg-[#1d1d1f] z-10"
                style={{ left: `${Math.min(expectedPct, 100)}%` }}
                title={`期待進捗: ${expectedPct}%`}
              />
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>前月 {basePct}%</span>
            {actualDeltaPct > 0 && <span className="text-[#007aff]">今月 +{actualDeltaPct}%</span>}
            {estimateDeltaPct > 0 && <span className="text-amber-600">推定 +{estimateDeltaPct}%</span>}
            {expectedPct !== null && <span>期待 {expectedPct}%</span>}
          </div>

          {/* 手動編集インライン */}
          {isManualEditing && (
            <div className="mt-2 flex items-center gap-1.5">
              <input
                type="text" inputMode="numeric" value={manualEditPct}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  onManualEditPctChange(v === "" ? "" : String(Math.min(100, Number(v))));
                }}
                onFocus={(e) => e.target.select()}
                className="w-14 text-center text-[12px] border border-border rounded px-1 py-0.5"
              />
              <span className="text-[11px] text-muted-foreground">%</span>
              <button
                onClick={onManualSave}
                disabled={!!actionLoading}
                className="text-[10px] px-2 py-0.5 rounded border border-[#0066cc] text-[#0066cc] hover:bg-blue-50 disabled:opacity-50"
              >
                保存
              </button>
              <button
                onClick={onManualEditCancel}
                className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted/30"
              >
                ✕
              </button>
            </div>
          )}

          {/* サブアイテム / 成功基準 */}
          {subItems.length > 0 ? (
            <div className="mt-1.5 space-y-0.5">
              {subItems.map((si) => (
                <div key={si.subItemId} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{si.status === "done" ? "✅" : "○"}</span>
                  <span className={si.status === "done" ? "line-through opacity-60" : ""}>{si.title}</span>
                  {si.weight > 0 && <span className="opacity-60">{Math.round(si.weight * 100)}%</span>}
                </div>
              ))}
            </div>
          ) : ms.successCriteria ? (
            <div className="mt-1.5 text-[10px] text-muted-foreground/70 leading-tight whitespace-pre-line line-clamp-2">
              {ms.successCriteria}
            </div>
          ) : null}
        </div>

        {/* 右: その月の仕事 / 推定カード */}
        <div className="flex-1 min-w-0 space-y-2">
          {isUnconfirmed && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] text-amber-600 font-medium">🤖 推定根拠</span>
                <span className="text-[10px] text-amber-500">{basePct}% → {displayedPct}%</span>
              </div>
              {est.reason && (
                <p className="text-[11px] text-slate-600 leading-snug mb-2">{est.reason}</p>
              )}
              {isModifying ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text" inputMode="numeric" value={modifyPct}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "");
                        onModifyPctChange(v === "" ? "" : String(Math.min(100, Number(v))));
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-16 text-center text-[12px] border border-border rounded px-1 py-0.5"
                    />
                    <span className="text-[11px] text-muted-foreground">%</span>
                  </div>
                  <input
                    type="text" placeholder="修正理由（任意）" value={modifyReason}
                    onChange={(e) => onModifyReasonChange(e.target.value)}
                    className="w-full text-[11px] border border-border rounded px-2 py-0.5"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={onModifySave}
                      disabled={!!actionLoading}
                      className="text-[10px] px-2 py-0.5 rounded border border-[#0066cc] text-[#0066cc] hover:bg-blue-50 disabled:opacity-50"
                    >
                      確定
                    </button>
                    <button
                      onClick={onModifyCancel}
                      className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted/30"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={onAdopt}
                    disabled={!!actionLoading}
                    className="text-[10px] px-2 py-0.5 rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {actionLoading === ms.milestoneId ? "…" : "✅ 採用"}
                  </button>
                  <button
                    onClick={onReject}
                    disabled={!!actionLoading}
                    className="text-[10px] px-2 py-0.5 rounded border border-red-400 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {actionLoading === ms.milestoneId ? "…" : "❌ 不採用"}
                  </button>
                  <button
                    onClick={onModifyStart}
                    disabled={!!actionLoading}
                    className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted/30 disabled:opacity-50"
                  >
                    ✏️ 修正
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-border rounded-lg px-3 py-2 min-h-[72px]">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-[10px] text-muted-foreground font-medium">この月の仕事</div>
              <button
                type="button"
                onClick={onRevisionStart}
                className="ml-auto text-[10px] px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                つくよみに修正依頼
              </button>
            </div>
            {hasWork ? (
              <div className="space-y-1.5">
                {progressNote?.trim() && (
                  <p className="text-[11px] text-slate-700 leading-snug whitespace-pre-wrap">{progressNote.trim()}</p>
                )}
                {activities.map((activity, index) => {
                  const body = activity.narrative?.trim() || activity.learnedAddendum?.trim();
                  if (!body) return null;
                  return (
                    <p key={`${activity.memberId}_${index}`} className="text-[11px] text-muted-foreground leading-snug whitespace-pre-wrap">
                      <span className="font-medium text-slate-600">{memberMap[activity.memberId] || "PM"}: </span>{body}
                    </p>
                  );
                })}
                {memberActivities.map((activity) => {
                  const body = activity.contentPreview?.trim() || activity.title?.trim();
                  if (!body) return null;
                  return (
                    <p key={activity.id} className="text-[11px] text-muted-foreground leading-snug whitespace-pre-wrap">
                      <span className="font-medium text-slate-600">{memberMap[activity.memberId] || "PM"}: </span>
                      {activity.title?.trim() && activity.contentPreview?.trim()
                        ? `${activity.title.trim()} - ${activity.contentPreview.trim()}`
                        : body}
                    </p>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/70">
                {monthlyDeltaPct > 0 ? `作業本文未抽出（進捗 +${Math.round(monthlyDeltaPct)}%）` : "この月の新規作業なし"}
              </p>
            )}
          </div>

          {(isRevisionEditing || revisions.length > 0 || revisionLoading) && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg px-3 py-2 space-y-2">
              <div className="text-[10px] text-indigo-700 font-medium">
                つくよみ修正依頼
                {revisionLoading ? " 読み込み中..." : ""}
              </div>
              {revisions.map((revision) => (
                <div key={revision.id} className="bg-white/80 border border-indigo-100 rounded-md px-2 py-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold ${
                      revision.status === "pending" ? "text-amber-700" :
                      revision.status === "confirmed" ? "text-emerald-700" : "text-slate-500"
                    }`}>
                      {revision.status === "pending" ? "確認待ち" : revision.status === "confirmed" ? "確定済" : "破棄"}
                    </span>
                    {revision.revisedPct != null && (
                      <span
                        className="text-[10px] text-indigo-700"
                        title="OK確定すると、このMSの当月時点の累積進捗率として保存される値"
                      >
                        {revision.currentPct != null ? `現 ${Math.round(revision.currentPct)}% → ` : ""}
                        累計提案 {Math.round(revision.revisedPct)}%
                      </span>
                    )}
                  </div>
                  {revision.messages.map((msg) => (
                    <p key={msg.id} className={`text-[11px] leading-snug whitespace-pre-wrap ${
                      msg.senderKind === "pm" ? "text-slate-700" : "text-indigo-800"
                    }`}>
                      <span className="font-medium">{msg.senderKind === "pm" ? "PM" : "つくよみ"}: </span>{msg.body}
                    </p>
                  ))}
                  {revision.revisedNote && (
                    <p className="text-[11px] text-slate-700 leading-snug whitespace-pre-wrap">{revision.revisedNote}</p>
                  )}
                  {revision.status === "pending" && (
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={onRevisionStart}
                        className="text-[10px] px-2 py-0.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                      >
                        再依頼
                      </button>
                      <button
                        type="button"
                        onClick={() => onRevisionDiscard(revision.id)}
                        className="text-[10px] px-2 py-0.5 rounded border border-red-300 text-red-600 hover:bg-red-50"
                      >
                        破棄
                      </button>
                      <button
                        type="button"
                        onClick={() => onRevisionConfirm(revision.id)}
                        className="text-[10px] px-2 py-0.5 rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                      >
                        OK確定
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {isRevisionEditing && (
                <div className="space-y-1.5">
                  <textarea
                    value={revisionText}
                    onChange={(e) => onRevisionTextChange(e.target.value)}
                    placeholder="どう直してほしいかを書く"
                    className="w-full min-h-20 text-[12px] border border-indigo-200 rounded-md px-2 py-1.5 bg-white"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRevisionSubmit(pendingRevision?.id)}
                      disabled={!revisionText.trim()}
                      className="text-[11px] px-2.5 py-1 rounded bg-indigo-600 text-white disabled:opacity-50"
                    >
                      送信
                    </button>
                    <button
                      type="button"
                      onClick={onRevisionCancel}
                      className="text-[11px] px-2.5 py-1 rounded border border-border text-muted-foreground"
                    >
                      キャンセル
                    </button>
                    {revisionMsg && <span className="text-[10px] text-muted-foreground">{revisionMsg}</span>}
                  </div>
                </div>
              )}
              {!isRevisionEditing && revisionMsg && <p className="text-[10px] text-muted-foreground">{revisionMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 進捗イベントセクション ──────────────────────────────────────────────────

const ORIGIN_LABELS: Record<string, string> = {
  amd_proposed: "AMD提案",
  co_decided: "協議決定",
  partner_proposed: "先方提案",
  client_requested: "先方提案",
  external: "外部発生",
  unknown: "不明",
};

const ORIGIN_COLORS: Record<string, string> = {
  amd_proposed: "bg-blue-100 text-blue-700",
  co_decided: "bg-emerald-100 text-emerald-700",
  partner_proposed: "bg-amber-100 text-amber-700",
  client_requested: "bg-amber-100 text-amber-700",
  external: "bg-gray-100 text-gray-600",
  unknown: "bg-gray-100 text-gray-500",
};

function EventsSection({
  events,
  milestones,
  projectId,
  ym,
  onUpdated,
}: {
  events: ProgressEvent[];
  milestones: MilestoneInfo[];
  projectId: string;
  ym: string;
  onUpdated: () => void;
}) {
  const activeEvents = events.filter((e) => e.status !== "rejected");
  const rejectedEvents = events.filter((e) => e.status === "rejected");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftMilestoneId, setDraftMilestoneId] = useState("");
  const [draftOrigin, setDraftOrigin] = useState("unknown");
  const [draftImpact, setDraftImpact] = useState("0");
  const [draftDepth, setDraftDepth] = useState("0");
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (event: ProgressEvent) => {
    setEditingId(event.eventId);
    setDraftTitle(event.title || event.eventTitle || "");
    setDraftContent(event.contentPreview || "");
    setDraftMilestoneId(event.milestoneId || "");
    setDraftOrigin(event.initiativeOrigin || "unknown");
    setDraftImpact(String(event.impact ?? 0));
    setDraftDepth(String(event.depth ?? 0));
  };

  const saveEventEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/progress/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: editingId,
          projectId,
          ym,
          title: draftTitle,
          contentPreview: draftContent,
          milestoneId: draftMilestoneId || null,
          initiativeOrigin: draftOrigin,
          impact: Number(draftImpact || 0),
          depth: Number(draftDepth || 0),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setEditingId(null);
      onUpdated();
    } catch (err) {
      alert(`進捗イベントの保存に失敗した: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // 先手力計算
  const orTotal = activeEvents.length;
  const orExternal = activeEvents.filter((e) => e.initiativeOrigin === "external").length;
  const orJudgeable = orTotal - orExternal;
  const orAmdCo = activeEvents.filter(
    (e) => e.initiativeOrigin === "amd_proposed" || e.initiativeOrigin === "co_decided"
  ).length;
  const senshoryoku = orJudgeable >= 1 ? Math.round((orAmdCo / orJudgeable) * 100) : null;

  // 起点集計
  const originCount: Record<string, number> = {};
  for (const e of activeEvents) {
    const o = e.initiativeOrigin || "unknown";
    originCount[o] = (originCount[o] || 0) + 1;
  }

  return (
    <div className="space-y-2 pt-1">
      {/* 先手力 + 起点サマリ
          2026-05-12 まさ「先手力の表示が消えてる」復活: senshoryoku === null (= 判定可能 events 0) でも
          ラベルは必ず描画する。null の時は「先手力 ―」(= 計算不能) を表示 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${
          senshoryoku === null ? "text-muted-foreground bg-muted/40" :
          senshoryoku >= 90 ? "text-emerald-700 bg-emerald-50" :
          senshoryoku >= 70 ? "text-amber-700 bg-amber-50" : "text-red-600 bg-red-50"
        }`}
          title={senshoryoku === null ? "判定可能なイベントがまだ無いので計算不能 (= 外部起点以外の events が 0)" : "AMD 起案 + 共同決定 / 判定可能 events"}>
          先手力 {senshoryoku === null ? "—" : `${senshoryoku}%`}
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">起点:</span>
        {Object.entries(originCount).map(([key, count]) => (
          <span key={key} className={`text-[10px] px-1.5 py-0.5 rounded ${ORIGIN_COLORS[key] || "bg-gray-100 text-gray-500"}`}>
            {ORIGIN_LABELS[key] || key} {count}
          </span>
        ))}
      </div>

      {/* events 0 件時のメッセージ (= 先手力ラベルは上で必ず表示済) */}
      {activeEvents.length === 0 && (
        <p className="text-[11.5px] text-muted-foreground py-1">イベントデータなし</p>
      )}

      {/* イベントカード */}
	      {activeEvents.map((ev) => {
	        const origin = ev.initiativeOrigin || "unknown";
	        const statusIcon = ev.status === "confirmed" ? "✅" : "📝";
	        const impact = ev.impact ?? 0;
	        const isHighImpact = impact >= 4;
	        const isEditing = editingId === ev.eventId;
	        return (
	          <div
	            key={ev.eventId}
	            className={`border rounded-lg px-3 py-2 ${
	              isHighImpact ? "bg-amber-50 border-amber-300" : "bg-muted/10 border-border"
	            }`}
	          >
	            <div className="flex items-center gap-1.5 flex-wrap">
	              <span className={`text-[12px] ${isHighImpact ? "font-bold text-amber-900" : ""}`}>
	                {statusIcon} {isHighImpact && "🔥 "}{ev.eventTitle || "(無題)"}
	              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${ORIGIN_COLORS[origin] || "bg-gray-100 text-gray-500"}`}>
                {ORIGIN_LABELS[origin] || origin}
              </span>
              {typeof ev.impact === "number" && ev.impact >= 3 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isHighImpact ? "bg-amber-200 text-amber-900" : "bg-orange-50 text-orange-700"
                  }`}
                  title="LLM が推論した重要度 (1-5)"
	                >
	                  impact {ev.impact}
	                </span>
	              )}
	              <button
	                type="button"
	                onClick={() => isEditing ? setEditingId(null) : startEdit(ev)}
	                className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/40"
	              >
	                {isEditing ? "閉じる" : "編集"}
	              </button>
	            </div>
	            {isEditing && (
	              <div className="mt-2 grid gap-2 rounded-md border border-border bg-background/80 p-2">
	                <input
	                  value={draftTitle}
	                  onChange={(event) => setDraftTitle(event.target.value)}
	                  className="w-full rounded border border-border px-2 py-1 text-[12px]"
	                  placeholder="イベントタイトル"
	                />
	                <textarea
	                  value={draftContent}
	                  onChange={(event) => setDraftContent(event.target.value)}
	                  className="min-h-[64px] w-full rounded border border-border px-2 py-1 text-[12px]"
	                  placeholder="進捗イベントの内容"
	                />
	                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.5fr_1fr_80px_80px]">
	                  <select
	                    value={draftMilestoneId}
	                    onChange={(event) => setDraftMilestoneId(event.target.value)}
	                    className="rounded border border-border bg-background px-2 py-1 text-[12px]"
	                  >
	                    <option value="">MS未紐付け</option>
	                    {milestones.map((ms) => (
	                      <option key={ms.milestoneId} value={ms.milestoneId}>{ms.title}</option>
	                    ))}
	                  </select>
	                  <select
	                    value={draftOrigin}
	                    onChange={(event) => setDraftOrigin(event.target.value)}
	                    className="rounded border border-border bg-background px-2 py-1 text-[12px]"
	                  >
	                    {Object.keys(ORIGIN_LABELS).map((key) => (
	                      <option key={key} value={key}>{ORIGIN_LABELS[key]}</option>
	                    ))}
	                  </select>
	                  <input
	                    type="number"
	                    min="0"
	                    max="5"
	                    step="1"
	                    value={draftImpact}
	                    onChange={(event) => setDraftImpact(event.target.value)}
	                    className="rounded border border-border px-2 py-1 text-[12px]"
	                    aria-label="impact"
	                  />
	                  <input
	                    type="number"
	                    min="0"
	                    max="1"
	                    step="0.1"
	                    value={draftDepth}
	                    onChange={(event) => setDraftDepth(event.target.value)}
	                    className="rounded border border-border px-2 py-1 text-[12px]"
	                    aria-label="depth"
	                  />
	                </div>
	                <div className="flex justify-end gap-2">
	                  <button
	                    type="button"
	                    onClick={() => setEditingId(null)}
	                    className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/30"
	                  >
	                    キャンセル
	                  </button>
	                  <button
	                    type="button"
	                    onClick={saveEventEdit}
	                    disabled={savingEdit}
	                    className="rounded bg-[#0066cc] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
	                  >
	                    {savingEdit ? "保存中..." : "保存"}
	                  </button>
	                </div>
	              </div>
	            )}
	            {ev.eventDescription && (
	              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{ev.eventDescription}</p>
	            )}
            {ev.responsibilities && ev.responsibilities.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                担当: {ev.responsibilities.map((r) => `${r.memberName || r.memberId}(${r.responsibility})`).join(", ")}
              </p>
            )}
            {ev.originLostReason && (
              <div className="mt-1 text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded">
                ⚠️ 先手を逃した理由: {ev.originLostReason}
              </div>
            )}
          </div>
        );
      })}

      {/* 除外済み */}
      {rejectedEvents.length > 0 && (
        <>
          <div className="text-center text-[11px] text-muted-foreground border-t border-dashed border-border pt-2 mt-2">
            ーーー 除外済み（{rejectedEvents.length}件）ーーー
          </div>
          {rejectedEvents.map((ev) => (
            <div key={ev.eventId} className="opacity-50 bg-muted/10 border border-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12px]">❌ {ev.eventTitle || "(無題)"}</span>
              </div>
              {ev.rejectReason && (
                <p className="text-[10px] text-red-600 mt-1">除外理由: {ev.rejectReason}</p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── 月次ノートセクション (= MS なし PJ で進捗を残せる自由記述) ─────────────

function MonthlyNoteSection({
  loading,
  saving,
  savedAt,
  body,
  original,
  updatedAt,
  updatedBy,
  hasMs,
  usesMsProgress,
  onChange,
  onSave,
}: {
  loading: boolean;
  saving: boolean;
  savedAt: number | null;
  body: string;
  original: string;
  updatedAt: string | null;
  updatedBy: string | null;
  hasMs: boolean;
  usesMsProgress: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  const dirty = body !== original;
  const headerLabel = hasMs ? "📔 月次ノート (補足)" : "📔 月次ノート";
  const headerHint = hasMs
    ? "MS に紐付かない補足メモ"
    : !usesMsProgress
      ? "MS進捗の対象外なので、ここに今月の動きを残してください"
    : "MS が未設定なので、ここに今月の動きを残してください";
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 text-[12px] font-medium border-b border-border bg-muted/10 flex items-center justify-between gap-2">
        <span>{headerLabel}</span>
        <span className="text-[10.5px] font-normal text-muted-foreground">{headerHint}</span>
      </div>
      <div className="p-3 space-y-2">
        {loading ? (
          <p className="text-[12px] text-muted-foreground py-1">読み込み中...</p>
        ) : (
          <>
            <textarea
              value={body}
              onChange={(e) => onChange(e.target.value)}
              placeholder={hasMs
                ? "例: 4/14 の杉浦先生面談で、量子センサ向け試作仕様の合意。請求書送付遅延のお詫びを行った。"
                : !usesMsProgress
                  ? "例: 今月の定例対応、顧客との合意事項、次月に持ち越す確認事項などを箇条書きで。"
                  : "例: 顧客 A から導入意向ヒアリング、CEO 候補 B と方針合意、補助金 X に申請書ドラフト提出 など、今月の動きを箇条書きで。"}
              rows={hasMs ? 4 : 7}
              className="w-full text-[12.5px] leading-relaxed border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10.5px] text-muted-foreground">
                {updatedAt ? (
                  <>
                    最終更新: {new Date(updatedAt).toLocaleString("ja-JP")}
                    {updatedBy && ` · by ${updatedBy}`}
                  </>
                ) : (
                  "未入力"
                )}
              </div>
              <div className="flex items-center gap-2">
                {savedAt !== null && (
                  <span className="text-[10.5px] text-emerald-600">✓ 保存しました</span>
                )}
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!dirty || saving}
                  className="text-[11.5px] px-3 py-1 rounded-md border border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "保存中..." : dirty ? "保存" : "変更なし"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 立替精算セクション ──────────────────────────────────────────────────────

function ReimburseSection({ items }: { items: ReimburseItem[] }) {
  const total = items.reduce((s, i) => s + (i.amount || 0), 0);
  return (
    <div className="space-y-2 pt-1">
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/20 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">内容</th>
              <th className="text-left px-3 py-1.5 font-medium w-20">担当者</th>
              <th className="text-right px-3 py-1.5 font-medium w-24">金額</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id || i} className="border-t border-border">
                <td className="px-3 py-1.5">{item.description}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{item.memberName || "—"}</td>
                <td className="px-3 py-1.5 text-right">¥{(item.amount || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/10">
            <tr>
              <td colSpan={2} className="px-3 py-1.5 text-right font-medium text-[12px]">合計</td>
              <td className="px-3 py-1.5 text-right font-semibold">¥{total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── メンバー報酬セクション ──────────────────────────────────────────────────

function MemberPayoutSection({
  reward,
  memberMap,
  isPreview = false,
  pjBudgetYen = 0,
  missingBudget = false,
}: {
  reward: RewardSummary;
  memberMap: Record<string, string>;
  isPreview?: boolean;
  pjBudgetYen?: number;
  missingBudget?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const ptUnit = reward.regularPtUnit || reward.ptUnit || 0;
  const extraPtUnit = reward.extraPtUnit || ptUnit;
  const totalPay = Math.round(
    reward.totalPaySum ?? reward.members.reduce((sum, member) => sum + (member.totalPay || member.basePay || 0), 0)
  );
  const capBudget = Math.round(reward.capBudgetYen ?? pjBudgetYen);
  const regularCapBudget = Math.round(reward.regularCapBudgetYen ?? capBudget);
  const extraCapBudget = Math.round(reward.extraCapBudgetYen ?? 0);
  const extraGrossDue = Math.round(reward.extraTotalGrossDueYen ?? reward.members.reduce((sum, member) => sum + (member.extraGrossDueYen || 0), 0));
  const totalGrossDue = Math.round(
    reward.totalGrossDueYen ?? reward.members.reduce((sum, member) => sum + (member.grossDueYen || member.totalPay || member.basePay || 0), 0)
  );
  const carryInYen = Math.round(reward.carryInYen ?? reward.members.reduce((sum, member) => sum + (member.carryInYen || 0), 0));
  const stockYen = Math.round(reward.carryOverYen ?? reward.members.reduce((sum, member) => sum + (member.stockYen || member.deferredYen || 0), 0));
  const remainingYen = capBudget > 0 ? capBudget - totalPay : null;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium">💰 メンバー報酬</p>
          {isPreview && (
            <p className="mt-0.5 text-[10.5px] text-amber-700">
              報酬キャッシュ未生成のため、月次進捗と担当割合からプレビュー表示中
              {missingBudget ? "（PJ予算未設定）" : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 text-[10px]">
          <span className="rounded bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
            {ptUnit > 0 ? `1pt = ¥${ptUnit.toLocaleString()}` : "1pt単価未設定"}
          </span>
          {extraGrossDue > 0 && (
            <span className="rounded bg-cyan-100 px-1.5 py-0.5 font-semibold text-cyan-900">
              追加枠 {formatYenValue(extraCapBudget)}
            </span>
          )}
          <span className="rounded bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
            通常cap {formatYenValue(regularCapBudget)}
          </span>
          {extraCapBudget > 0 && (
            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
              PJ予算 {formatYenValue(capBudget)}
            </span>
          )}
          {carryInYen > 0 && (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800">
              繰越入 {formatYenValue(carryInYen)}
            </span>
          )}
          {reward.capped && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800">
              キャップ発動 {formatYenValue(totalGrossDue)} → {formatYenValue(totalPay)}
            </span>
          )}
          {stockYen > 0 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
              現ストック {formatYenValue(stockYen)}
            </span>
          )}
          <span className="rounded bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
            要支払 {formatYenValue(totalGrossDue)}
          </span>
          <span className="rounded bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
            支払 {formatYenValue(totalPay)}
          </span>
          <span className={`rounded px-1.5 py-0.5 font-semibold ${
            remainingYen == null
              ? "bg-zinc-100 text-zinc-500"
              : remainingYen < 0
                ? "bg-red-100 text-red-800"
                : "bg-emerald-100 text-emerald-800"
          }`}>
            残り {remainingYen == null ? "—" : formatSignedYenValue(remainingYen)}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/30 text-[11px] text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">メンバー</th>
              <th className="text-right px-3 py-1.5 font-medium w-20">獲得pt</th>
              <th className="text-right px-3 py-1.5 font-medium w-24">基本報酬</th>
              <th className="text-right px-3 py-1.5 font-medium w-24">ボーナス</th>
              <th className="text-right px-3 py-1.5 font-medium w-28">合計</th>
              <th className="text-right px-3 py-1.5 font-medium w-16"></th>
            </tr>
          </thead>
          <tbody>
            {reward.members.map((mb, idx) => {
              const rowId = `${mb.memberId}-${idx}`;
              const isOpen = expanded.has(rowId);
              const codeName = memberMap[mb.memberId] || "PM";
              const stock = Math.round(mb.stockYen || mb.deferredYen || 0);
              const carryIn = Math.round(mb.carryInYen || 0);
              const grossDue = Math.round(mb.grossDueYen || mb.cappedFrom || mb.totalPay || mb.basePay || 0);
              const extraPaid = Math.round(mb.extraPaidYen || 0);
              const extraStock = Math.round(mb.extraStockYen || 0);
              return (
                <Fragment key={rowId}>
                  <tr
                    className="border-t border-border cursor-pointer hover:bg-muted/20"
                    onClick={() => toggle(rowId)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{codeName}</div>
                      {(carryIn > 0 || stock > 0 || extraPaid > 0 || extraStock > 0) && (
                        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                          {carryIn > 0 && <span className="rounded bg-sky-100 px-1 text-sky-800">繰越入 {formatYenValue(carryIn)}</span>}
                          {stock > 0 && <span className="rounded bg-amber-100 px-1 text-amber-900">ストック {formatYenValue(stock)}</span>}
                          {(extraPaid > 0 || extraStock > 0) && <span className="rounded bg-cyan-100 px-1 text-cyan-900">追加枠 {formatYenValue(extraPaid)}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{mb.earnedPt}pt</td>
                    <td className="px-3 py-2 text-right">¥{mb.basePay.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">¥{(mb.bonusPt || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <div>¥{(mb.totalPay || mb.basePay).toLocaleString()}</div>
                      {grossDue > (mb.totalPay || mb.basePay || 0) && (
                        <div className="text-[10px] font-normal text-muted-foreground">
                          要支払 ¥{grossDue.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-[10px] text-muted-foreground">
                      {isOpen ? "▼" : "▶"} 内訳
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/10">
                      <td colSpan={6} className="px-3 py-2">
                        {!mb.breakdown || mb.breakdown.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">内訳データなし</p>
                        ) : (
                          <table className="w-full text-[11px]">
                            <thead className="text-muted-foreground">
                              <tr>
                                <th className="text-left font-normal py-1 pl-2">MS</th>
                                <th className="text-right font-normal py-1 px-2 w-20">消化pt</th>
                                <th className="text-right font-normal py-1 px-2 w-16">share</th>
                                <th className="text-right font-normal py-1 px-2 w-20">獲得pt</th>
                                <th className="text-right font-normal py-1 px-2 w-24">獲得額</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mb.breakdown.map((bd, bi) => (
                                <tr key={`${bd.msKey}-${bi}`} className="border-t border-border/50">
                                  <td className="py-1 pl-2 truncate max-w-[280px]">
                                    {bd.title}
                                    {bd.pool === "cap_extra" && <span className="ml-1 rounded bg-cyan-100 px-1 text-[10px] text-cyan-900">追加枠</span>}
                                  </td>
                                  <td className="py-1 px-2 text-right">{bd.msConsumedPt}pt</td>
                                  <td className="py-1 px-2 text-right">{Math.round((bd.share || 0) * 100)}%</td>
                                  <td className="py-1 px-2 text-right">{bd.earnedPt}pt</td>
                                  <td className="py-1 px-2 text-right">
                                    ¥{Math.round(bd.payYen ?? ((bd.earnedPt || 0) * (bd.ptUnit || (bd.pool === "cap_extra" ? extraPtUnit : ptUnit)))).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ReportTab ───────────────────────────────────────────────────────────────

function ReportTab({ report, projectId, ym }: { report: Report | null; projectId: string; ym: string }) {
  const [generating, setGenerating] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [content, setContent] = useState(report?.finalExcerpt || report?.draftExcerpt || "");
  const [status, setStatus] = useState(report?.status || "");
  const [error, setError] = useState("");
  const [showMarkdown, setShowMarkdown] = useState(true);

  const isFixed = status === "fixed" || (report?.hasFinal && !!report?.fixedAt);

  const handleGenerate = async (feedbackText?: string) => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym, ...(feedbackText ? { feedback: feedbackText } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");
      setContent(data.draftContent);
      setStatus("draft");
      if (feedbackText) {
        setShowFeedback(false);
        setFeedback("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleFix = async () => {
    setFixing(true);
    setError("");
    try {
      const res = await fetch("/api/report/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "確定に失敗しました");
      setStatus("fixed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* ステータス + アクション */}
      <div className="flex items-center gap-2 flex-wrap">
        {content && (
          <span className={`text-xs px-2 py-0.5 rounded ${
            isFixed ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
          }`}>
            {isFixed ? "確定済" : "ドラフト"}
          </span>
        )}

        {!isFixed && (
          <>
            <button
              onClick={() => handleGenerate()}
              disabled={generating}
              className="text-xs px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? "生成中..." : content ? "再生成" : "報告書を生成"}
            </button>

            {content && (
              <>
                <button
                  onClick={() => setShowFeedback(!showFeedback)}
                  className="text-xs px-3 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  修正指示
                </button>
                <button
                  onClick={handleFix}
                  disabled={fixing}
                  className="text-xs px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {fixing ? "確定中..." : "FIX（確定）"}
                </button>
              </>
            )}
          </>
        )}

        {isFixed && (
          <button
            onClick={() => handleGenerate(feedback || undefined)}
            disabled={generating}
            className="text-xs px-3 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
            title="確定後も再生成可能"
          >
            {generating ? "再生成中..." : "再生成"}
          </button>
        )}

        {/* 印刷プレビュー (PJ別に提出版/社内版を出し分け) */}
        <a
          href={`/project/${projectId}/report/${ym}/print?template=${printLinkForProject(projectId).template}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Cmd+P で PDF 保存できます"
          className="text-xs px-3 py-1 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
        >
          📄 {printLinkForProject(projectId).label}
        </a>

        {/* 表示切り替え */}
        {content && (
          <button
            onClick={() => setShowMarkdown(!showMarkdown)}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            {showMarkdown ? "プレーンテキスト" : "Markdown"}
          </button>
        )}
      </div>

      {/* 修正指示 */}
      {showFeedback && (
        <div className="space-y-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="修正指示を入力（例: 「概要をもっと簡潔に」「技術的な成果を強調して」）"
            className="w-full text-sm border rounded-lg p-3 min-h-[80px] resize-y focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => handleGenerate(feedback)}
            disabled={!feedback.trim() || generating}
            className="text-xs px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {generating ? "修正中..." : "修正を適用"}
          </button>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</div>
      )}

      {/* コンテンツ表示 */}
      {content ? (
        <div className="bg-muted/30 rounded-lg p-4 max-h-[480px] overflow-y-auto">
          {showMarkdown ? (
            <SimpleMarkdown text={content} />
          ) : (
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{content}</div>
          )}
        </div>
      ) : !generating ? (
        <p className="text-sm text-muted-foreground py-4">
          報告書がまだ作成されていません。「報告書を生成」ボタンで自動生成できます。
        </p>
      ) : null}
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
