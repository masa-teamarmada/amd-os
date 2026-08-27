"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CockpitMonthlyModal } from "@/components/cockpit/CockpitMonthlyModal";
import { MemberPayoutBreakdownModal } from "@/components/admin/MemberPayoutBreakdownModal";
import { fetchCockpitFromSupabase, type CockpitData } from "@/lib/supabase-data";
import { expandExtraRevenueCash, type ExtraRevenueSourceRow } from "@/lib/finance/extra-revenue";
import { basePayoutCapYen, contractBackedClientAmount } from "@/lib/contract-money";
import { memberPayoutYmForCycle } from "@/lib/payment-groups";
import type { AppliedPayoutAmountOverride } from "@/lib/payout-amount-overrides";

type Member = {
  member_id: string;
  code_name: string;
  member_name: string | null;
  contractor_name?: string | null;
  member_address?: string | null;
  invoice_registration_number?: string | null;
  bank_info?: string | null;
  email: string | null;
  status: string;
  is_officer?: boolean | null;
  exclude_from_payout_notice?: boolean | null;
  updated_at?: string | null;
};

type Project = {
  project_id: string;
  project_name: string;
  client_name?: string | null;
  status: string | null;
  fee_type?: string | null;
  fee_amount?: number | string | null;
  start_ym?: string | null;
  end_ym?: string | null;
  freee_partner_id?: string | null;
  payment_due_rule: string | null;
  payment_due_day: number | null;
  invoice_send_deadline_rule?: string | null;
};

type ProjectMember = {
  project_id: string;
  member_id: string;
  is_active?: boolean | null;
};

type RewardMember = {
  memberId?: string;
  member_id?: string;
  memberName?: string;
  member_name?: string;
  earnedPt?: number;
  earned_pt?: number;
  basePay?: number;
  base_pay?: number;
  bonusPt?: number;
  bonus_pt?: number;
  totalPay?: number;
  total_pay?: number;
  cappedFrom?: number;
  capped_from?: number;
  carryInYen?: number;
  carry_in_yen?: number;
  deferredYen?: number;
  deferred_yen?: number;
  grossDueYen?: number;
  gross_due_yen?: number;
  stockYen?: number;
  stock_yen?: number;
  regularBasePay?: number;
  regular_base_pay?: number;
  extraBasePay?: number;
  extra_base_pay?: number;
  regularPaidYen?: number;
  regular_paid_yen?: number;
  extraPaidYen?: number;
  extra_paid_yen?: number;
  regularGrossDueYen?: number;
  regular_gross_due_yen?: number;
  extraGrossDueYen?: number;
  extra_gross_due_yen?: number;
  regularStockYen?: number;
  regular_stock_yen?: number;
  extraStockYen?: number;
  extra_stock_yen?: number;
  companyReserveYen?: number;
  company_reserve_yen?: number;
  regularCompanyReserveYen?: number;
  regular_company_reserve_yen?: number;
  extraCompanyReserveYen?: number;
  extra_company_reserve_yen?: number;
  officerReserveYen?: number;
  officer_reserve_yen?: number;
  payoutAmountOverride?: AppliedPayoutAmountOverride;
};

type RewardSummary = {
  totalPaySum?: number;
  carryOverYen?: number;
  regularCapBudgetYen?: number;
  extraCapBudgetYen?: number;
  finalCapTopUpYen?: number;
  regularFinalCapTopUpYen?: number;
  extraFinalCapTopUpYen?: number;
  members?: RewardMember[];
};

type BillingCycle = {
  project_id: string;
  ym: string;
  status: string | null;
  budget_yen: number | null;
  budget_reported_amount?: number | null;
  budget_buffer_amount?: number | null;
  /** 別財布 (cap_extra) プールの当月支払上限。NULL=未設定 / 0=全額繰越 / N=上限 */
  extra_budget_yen?: number | null;
  invoice_ym: string | null;
  invoice_issued_at?: string | null;
  invoice_sent_at?: string | null;
  reward_summary_json: unknown;
  payout_notice_uploaded_at?: string | null;
  payment_confirmed_at?: string | null;
  reward_paid_at?: string | null;
};

type ForecastPlanCycle = {
  project_id: string;
  plan_cycle_id?: string | null;
  status: string | null;
  budget_yen: number | string | null;
  total_points?: number | string | null;
  period_start_ym: string;
  period_end_ym: string;
};

// 将来月の「cap使用予定」(capped) を reward_summary_json キャッシュから集計した値。
// route が billing_cycles.reward_summary_json を読み、通常GETでは再計算せず返す。
// cappedRegularYen は本契約capの使用額で、外部支払だけでなく役員会社留保も含む。
// cappedExtraYen は別財布(cap_extra)の使用額。
// carryOverYen は外部メンバーへの未払い残だけを入れる。役員分は会社留保側で扱う。
type ForecastCappedRow = {
  projectId: string;
  ym: string;
  cappedTotalYen: number;
  cappedRegularYen?: number;
  cappedExtraYen?: number;
  cappedRegularExternalYen?: number;
  cappedExtraExternalYen?: number;
  regularCompanyReserveYen?: number;
  extraCompanyReserveYen?: number;
  regularGrossDueYen?: number;
  extraGrossDueYen?: number;
  carryOverYen?: number;
  finalCapTopUpYen?: number;
  regularFinalCapTopUpYen?: number;
  extraFinalCapTopUpYen?: number;
};

type MonthlyRewardPayout = {
  project_id: string;
  ym: string;
  member_id: string;
  earned_pt: number | string | null;
  base_pay: number | string | null;
  bonus_pt: number | string | null;
  total_pay: number | string | null;
  created_at?: string | null;
};

type PayoutNotice = {
  member_id: string;
  ym: string;
  sent_at: string | null;
  notice_no: string | null;
  pdf_url: string | null;
  total_yen: number | null;
  reimbursement_yen?: number | null;
  last_generated_at?: string | null;
  /** freee の出金から自動で確認した実際の振込日と金額 (/api/cron/freee-member-payout-sync) */
  paid_on?: string | null;
  paid_amount_yen?: number | null;
};

type BulkNoticeResultEntry = {
  memberId: string;
  status: "generated" | "skipped" | "failed";
  reason?: string;
  noticeNo?: string;
  pdfUrl?: string;
  totalYen?: number;
  lastGeneratedAt?: string;
  error?: string;
};

type BulkNoticeSummary = {
  targetCount: number;
  generated: number;
  skipped: number;
  failed: number;
  results: BulkNoticeResultEntry[];
};

export type PayableReimbursementRow = {
  reimbursementId: string;
  memberId: string;
  projectId: string | null;
  projectName: string | null;
  date: string | null;
  category: string | null;
  description: string | null;
  amountYen: number;
  approvedAt: string | null;
  billedYm: string | null;
};

export type PayoutData = {
  ym: string;
  members: Member[];
  projects: Project[];
  projectMembers?: ProjectMember[];
  cycles: BillingCycle[];
  forecastMonths?: string[];
  forecastCycles?: BillingCycle[];
  forecastPaymentCycles?: BillingCycle[];
  forecastPlanCycles?: ForecastPlanCycle[];
  forecastCapped?: ForecastCappedRow[];
  payouts: MonthlyRewardPayout[];
  notices: PayoutNotice[];
  extraRevenueRows?: ExtraRevenueSourceRow[];
  expectedEntries?: unknown[];
  /** 承認済みで、この支払月の通知書へ合算する立替精算 (メンバーID -> 明細) */
  reimbursements?: Record<string, PayableReimbursementRow[]>;
  payoutAgreementGate?: PayoutAgreementGateSummary | null;
  refreshedRewards?: boolean;
};

type PayoutEntry = {
  projectId: string;
  ym: string;
  invoiceYm: string;
  memberId: string;
  memberName: string;
  earnedPt: number;
  basePay: number;
  bonusPt: number;
  totalPay: number;
  regularBasePay: number;
  extraBasePay: number;
  regularPaidYen: number;
  extraPaidYen: number;
  regularStockYen: number;
  extraStockYen: number;
  regularGrossDueYen: number;
  extraGrossDueYen: number;
  grossDueYen: number;
  carryInYen: number;
  stockYen: number;
  cappedFrom: number;
  payoutAmountOverride?: AppliedPayoutAmountOverride;
};

type PayoutAgreementGateStatus =
  | "not_required"
  | "pending"
  | "agreed"
  | "stale"
  | "revision_requested"
  | "admin_override";

type PayoutAgreementGateRow = {
  key: string;
  paymentYm: string;
  sourceYm: string;
  memberId: string;
  memberName: string;
  projectId: string;
  projectName: string;
  totalPay: number;
  required: boolean;
  migrationBypass?: boolean;
  status: PayoutAgreementGateStatus;
  reason: string;
  latestAgreedAt: string | null;
  snapshotHash: string | null;
  currentHash: string | null;
  requestId: string | null;
  requestCreatedAt: string | null;
};

type PayoutAgreementGateSummary = {
  paymentYm: string;
  targetAction: string;
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

type BudgetAuditItem = {
  key: string;
  projectId: string;
  ym: string;
  invoiceYm: string;
  projectName: string;
  projectStatus: string | null;
  baseClientAmountYen: number;
  bufferYen: number;
  baseCapYen: number;
  extraPayoutYen: number;
  budgetYen: number;
  payoutYen: number;
  stockYen: number;
  grossDueYen: number;
  paymentConfirmed: boolean;
};

type ProjectFinanceCycleLine = {
  key: string;
  ym: string;
  invoiceYm: string;
  baseClientAmountYen: number;
  bufferYen: number;
  baseCapYen: number;
  extraPayoutYen: number;
  budgetYen: number;
  payoutYen: number;
  officerPayoutYen: number;
  officerOffsetYen: number;
  finalBalanceYen: number;
};

type ProjectFinanceMemberLine = {
  key: string;
  ym: string;
  invoiceYm: string;
  memberId: string;
  memberName: string;
  amountYen: number;
  isOfficer: boolean;
  offsetYen: number;
  netEffectYen: number;
};

type ProjectFinanceGroup = {
  projectId: string;
  projectName: string;
  projectStatus: string | null;
  baseClientAmountYen: number;
  bufferYen: number;
  baseCapYen: number;
  extraPayoutYen: number;
  budgetYen: number;
  payoutYen: number;
  officerPayoutYen: number;
  officerOffsetYen: number;
  finalBalanceYen: number;
  cycles: ProjectFinanceCycleLine[];
  memberLines: ProjectFinanceMemberLine[];
};

type ProjectMonthlyFinanceCell = {
  projectId: string;
  projectName: string;
  ym: string;
  baseClientAmountYen: number;
  budgetYen: number;
  /** 別財布（別契約）売上の当月按分額 (税抜)。本契約の budgetYen とは別枠で収支に加算する。 */
  extraRevenueYen: number;
  /** 本契約capの使用額。外部支払と役員会社留保を含む。 */
  payoutYen: number;
  /** 別財布の使用額。外部支払と役員会社留保を含む。 */
  extraPayoutYen: number;
  /** 本契約capから外部メンバーへ実際に支払う額。会社留保は含めない。 */
  regularExternalPayoutYen: number;
  /** 別財布から外部メンバーへ実際に支払う額。会社留保は含めない。 */
  extraExternalPayoutYen: number;
  /** 本契約capで役員稼働分として内部留保される額。 */
  regularCompanyReserveYen: number;
  /** 別財布で役員稼働分として内部留保される額。 */
  extraCompanyReserveYen: number;
  officerPayoutYen: number;
  stockYen: number;
  /** シーズン最終月に未払残をゼロへ閉じるため追加された精算枠。 */
  finalCapTopUpYen: number;
  regularFinalCapTopUpYen: number;
  extraFinalCapTopUpYen: number;
  regularGrossDueYen: number;
  extraGrossDueYen: number;
  grossDueYen: number;
  finalBalanceYen: number;
  extraBalanceYen: number;
};

type ProjectMonthlyFinanceRow = {
  projectId: string;
  projectName: string;
  cells: ProjectMonthlyFinanceCell[];
  totals: Omit<ProjectMonthlyFinanceCell, "projectId" | "projectName" | "ym">;
};

type RewardDebtSource =
  | "pre_contract"
  | "carry_and_current"
  | "carry_only"
  | "cap_deferred"
  | "cap_extra_deferred";

type RewardDebtLedgerRow = {
  key: string;
  projectId: string;
  projectName: string;
  projectStartYm: string | null;
  ym: string;
  invoiceYm: string;
  memberId: string;
  memberName: string;
  /** 本契約 (regular) プールか別財布 (cap_extra) プールか。別財布は本契約capと突合しない */
  pool: "regular" | "cap_extra";
  carryInYen: number;
  accruedYen: number;
  paidYen: number;
  endingStockYen: number;
  grossDueYen: number;
  budgetYen: number;
  source: RewardDebtSource;
  sourceLabel: string;
  sourceClassName: string;
  note: string;
};

type MemberPayoutRow = {
  memberId: string;
  memberName: string;
  noticeExcluded: boolean;
  notice: PayoutNotice | null;
  noticeProfileStale: boolean;
  totalPay: number;
  savedTotal: number;
  regularBasePay: number;
  extraBasePay: number;
  regularPaidYen: number;
  extraPaidYen: number;
  carryInYen: number;
  stockYen: number;
  entries: PayoutEntry[];
  /** この支払月の通知書へ合算する立替精算 (実費・税込) */
  reimbursements: PayableReimbursementRow[];
  reimbursementYen: number;
  isSaved: boolean;
};

type MemberMonthlyPayoutProjectLine = PayoutEntry & {
  projectName: string;
};

type MemberMonthlyPayoutCell = {
  memberId: string;
  memberName: string;
  ym: string;
  totalPay: number;
  regularPaidYen: number;
  extraPaidYen: number;
  entries: MemberMonthlyPayoutProjectLine[];
};

type MemberMonthlyPayoutRow = {
  memberId: string;
  memberName: string;
  totalPay: number;
  regularPaidYen: number;
  extraPaidYen: number;
  cells: MemberMonthlyPayoutCell[];
};

type SelectedMemberMonthlyPayoutCell = {
  memberId: string;
  ym: string;
};

type ModalTarget = {
  projectId: string;
  ym: string;
  label: string;
};

type NoticeSavePatch = {
  markSent?: boolean;
  clearSent?: boolean;
};

type NoticeMailPreview = {
  memberId: string;
  memberName: string;
  to: string;
  from: string;
  subject: string;
  bcc: string[];
  body: string;
  dueDateText: string;
  pdfUrl: string;
  pdfDriveFileId: string;
  totalYen: number;
  alreadySentAt: string | null;
  pdfPreparedBeforeSend?: boolean;
};

type NoticeMailModalState = {
  row: MemberPayoutRow;
  preview: NoticeMailPreview;
  editedBody: string;
  editing: boolean;
};

interface Props {
  initialYm: string;
  ymOptions: string[];
  initialData?: PayoutData | null;
}

const BC_STATUS_LABEL: Record<string, string> = {
  not_started: "未着手",
  reported: "報告済",
  budget_confirmed: "予算確定",
  allocation_confirmed: "予算確定",
  invoice_sent: "請求書送付",
  payment_confirmed: "着金確認",
  reward_paid: "報酬支払済",
};

const BC_STATUS_COLOR: Record<string, string> = {
  not_started: "border-zinc-200 bg-zinc-50 text-zinc-500",
  reported: "border-blue-200 bg-blue-50 text-blue-700",
  budget_confirmed: "border-amber-200 bg-amber-50 text-amber-700",
  allocation_confirmed: "border-amber-200 bg-amber-50 text-amber-700",
  invoice_sent: "border-violet-200 bg-violet-50 text-violet-700",
  payment_confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  reward_paid: "border-emerald-300 bg-emerald-100 text-emerald-800",
};

const PAYOUT_AGREEMENT_STATUS_LABEL: Record<PayoutAgreementGateStatus, string> = {
  not_required: "対象外",
  pending: "未合意",
  agreed: "合意済",
  stale: "条件更新あり",
  revision_requested: "修正要望中",
  admin_override: "admin override",
};

const PAYOUT_AGREEMENT_STATUS_CLASS: Record<PayoutAgreementGateStatus, string> = {
  not_required: "border-zinc-200 bg-zinc-50 text-zinc-600",
  pending: "border-red-200 bg-red-50 text-red-700",
  agreed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  stale: "border-amber-200 bg-amber-50 text-amber-800",
  revision_requested: "border-rose-200 bg-rose-50 text-rose-700",
  admin_override: "border-sky-200 bg-sky-50 text-sky-800",
};

function fmtYm(ym: string) {
  return ym && ym.length === 6 ? `${ym.slice(0, 4)}/${ym.slice(4)}` : ym;
}

function payoutDataHint(nextYm: string, payload: PayoutData, refreshRewards = false) {
  return `${fmtYm(nextYm)} / ${refreshRewards ? "再計算済" : "キャッシュ表示"} / 対象${payload.cycles.length}件 / 報酬${payload.expectedEntries?.length ?? 0}明細`;
}

function fmtRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 0) return "数秒以内";
  if (diffSec < 60) return `${diffSec}秒前`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

function noticeIsOlderThanMemberProfile(notice: PayoutNotice | null | undefined, member: Member | null | undefined) {
  if (!notice?.pdf_url || notice.sent_at) return false;
  if (!notice.last_generated_at || !member?.updated_at) return false;
  const generatedMs = new Date(notice.last_generated_at).getTime();
  const memberUpdatedMs = new Date(member.updated_at).getTime();
  return Number.isFinite(generatedMs) && Number.isFinite(memberUpdatedMs) && memberUpdatedMs > generatedMs;
}

function fmtYen(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n > 0 && Number.isFinite(n) ? `¥${Math.round(n).toLocaleString("ja-JP")}` : "—";
}

function fmtTaxIncludedYen(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n > 0 && Number.isFinite(n) ? fmtYen(Math.round(n * 1.1)) : "—";
}

function fmtFlowYen(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function fmtSignedYen(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  if (rounded < 0) return `-¥${Math.abs(rounded).toLocaleString("ja-JP")}`;
  return `¥${rounded.toLocaleString("ja-JP")}`;
}

function fmtPt(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? `${Math.round(n * 100) / 100}pt` : "—";
}

type ProjectMonthlyFinanceAggregate = Omit<ProjectMonthlyFinanceCell, "projectId" | "projectName" | "ym"> & {
  ym?: string;
};

type ProjectMonthlyFinanceCellLike = ProjectMonthlyFinanceCell | ProjectMonthlyFinanceAggregate;

function totalInYen(cell: ProjectMonthlyFinanceCellLike) {
  return cell.budgetYen + cell.extraRevenueYen;
}

function externalPayoutYen(cell: ProjectMonthlyFinanceCellLike) {
  return cell.regularExternalPayoutYen + cell.extraExternalPayoutYen;
}

function capUsageYen(cell: ProjectMonthlyFinanceCellLike) {
  return cell.payoutYen + cell.extraPayoutYen;
}

function companyReserveIncreaseYen(cell: ProjectMonthlyFinanceCellLike) {
  return totalInYen(cell) - externalPayoutYen(cell);
}

function officerReserveYen(cell: ProjectMonthlyFinanceCellLike) {
  return cell.regularCompanyReserveYen + cell.extraCompanyReserveYen;
}

function capGapYen(cell: ProjectMonthlyFinanceCellLike) {
  return totalInYen(cell) - cell.grossDueYen;
}

function hasAnyForwardFinanceData(cell: ProjectMonthlyFinanceCellLike) {
  return totalInYen(cell) > 0 || capUsageYen(cell) > 0 || cell.grossDueYen > 0 || cell.stockYen > 0;
}

function MetricLines({
  main,
  mainClassName = "text-foreground",
  lines,
  footer,
}: {
  main: ReactNode;
  mainClassName?: string;
  lines: ReactNode[];
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-1 text-right leading-tight tabular-nums">
      <div className={`text-[12px] font-semibold ${mainClassName}`}>{main}</div>
      <div className="space-y-0.5 text-[10px] text-muted-foreground">{lines}</div>
      {footer ? <div className="text-[10px]">{footer}</div> : null}
    </div>
  );
}

function asRewardSummary(value: BillingCycle["reward_summary_json"]): RewardSummary | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return asRewardSummary(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value;
}

function memberIdOf(member: RewardMember) {
  return (member.memberId || member.member_id || "").trim();
}

function memberNameOf(member: RewardMember) {
  return (member.memberName || member.member_name || "").trim();
}

function numberValue(value: unknown) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function hasExplicitNumber(value: unknown) {
  if (value == null || value === "") return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n);
}

function baseClientAmountForCycle(cycle: BillingCycle, project?: Project) {
  return contractBackedClientAmount({
    ym: cycle.ym,
    project,
    reportedAmount: cycle.budget_reported_amount,
    cycleStatus: cycle.status,
  });
}

function baseCapYenFor(baseClientAmountYen: number, bufferYen: number) {
  return basePayoutCapYen(baseClientAmountYen, bufferYen);
}

function findRewardPlanCycle(projectId: string, ym: string, planCycles: ForecastPlanCycle[]) {
  return planCycles
    .filter((plan) => plan.project_id === projectId && plan.period_start_ym <= ym && plan.period_end_ym >= ym)
    .filter((plan) => ["active", "confirmed", "fixed"].includes(String(plan.status || "").toLowerCase()))
    .sort((a, b) => b.period_start_ym.localeCompare(a.period_start_ym) || b.period_end_ym.localeCompare(a.period_end_ym))[0] ?? null;
}

function hasRewardBearingPlan(projectId: string, ym: string, planCycles: ForecastPlanCycle[]) {
  const plan = findRewardPlanCycle(projectId, ym, planCycles);
  return Boolean(plan && numberValue(plan.budget_yen) > 0);
}

function entryKey(entry: Pick<PayoutEntry, "projectId" | "ym" | "memberId">) {
  return `${entry.projectId}:${entry.ym}:${entry.memberId}`;
}

function payoutKey(row: Pick<MonthlyRewardPayout, "project_id" | "ym" | "member_id">) {
  return `${row.project_id}:${row.ym}:${row.member_id}`;
}

function cockpitModalContext(cockpit: CockpitData, ym: string) {
  const report = cockpit.reports.find((item) => item.ym === ym) ?? null;
  const billing = cockpit.billingCycles.find((item) => item.ym === ym) ?? null;
  const bundles = [
    ...(cockpit.planCycle
      ? [{
          planCycle: cockpit.planCycle,
          milestones: cockpit.milestones,
          progress: cockpit.progress,
          subItems: cockpit.subItems || [],
          responsibilities: cockpit.responsibilities || [],
          msActivities: cockpit.msActivities || [],
          memberActivities: cockpit.memberActivities || [],
        }]
      : []),
    ...(cockpit.pastPlanCycles || []),
  ];
  const bundle = bundles.find((item) => ym >= item.planCycle.periodStartYm && ym <= item.planCycle.periodEndYm);
  const reportOnly = !!report && !billing;

  return {
    report,
    billing,
    planCycle: reportOnly ? null : (bundle?.planCycle || cockpit.planCycle),
    milestones: reportOnly ? [] : (bundle?.milestones || cockpit.milestones),
    progress: reportOnly ? [] : (bundle?.progress || cockpit.progress),
    subItems: reportOnly ? [] : (bundle?.subItems || cockpit.subItems || []),
    responsibilities: reportOnly ? [] : (bundle?.responsibilities || cockpit.responsibilities || []),
    msActivities: reportOnly ? [] : (bundle?.msActivities || cockpit.msActivities || []),
    memberActivities: reportOnly ? [] : (bundle?.memberActivities || cockpit.memberActivities || []),
  };
}

function buildEntries(
  cycles: BillingCycle[],
  memberMap: Map<string, string>,
  excludedMemberIds: Set<string> = new Set(),
  options: { useCompanyReserveYen?: boolean; projectMap?: Map<string, Project> } = {}
): PayoutEntry[] {
  const entries: PayoutEntry[] = [];

  for (const cycle of cycles) {
    const cycleEntries: PayoutEntry[] = [];
    const summary = asRewardSummary(cycle.reward_summary_json);
    const project = options.projectMap?.get(cycle.project_id);
    const invoiceYm = options.projectMap
      ? memberPayoutYmForCycle(cycle, project)
      : cycle.invoice_ym || cycle.ym;
    for (const member of summary?.members ?? []) {
      const memberId = memberIdOf(member);
      if (!memberId) continue;
      if (excludedMemberIds.has(memberId)) continue;

      const companyReserveYen = Math.round(numberValue(
        member.companyReserveYen ?? member.company_reserve_yen ?? member.officerReserveYen ?? member.officer_reserve_yen
      ));
      const regularCompanyReserveYen = Math.round(numberValue(
        member.regularCompanyReserveYen ?? member.regular_company_reserve_yen
      ));
      const extraCompanyReserveYen = Math.round(numberValue(
        member.extraCompanyReserveYen ?? member.extra_company_reserve_yen
      ));
      const totalPay = options.useCompanyReserveYen
        ? companyReserveYen || Math.round(numberValue(member.totalPay ?? member.total_pay))
        : Math.round(numberValue(member.totalPay ?? member.total_pay));
      const carryInYen = Math.round(numberValue(member.carryInYen ?? member.carry_in_yen));
      const stockYen = Math.round(numberValue(member.stockYen ?? member.stock_yen ?? member.deferredYen ?? member.deferred_yen));
      const grossDueYen = Math.round(numberValue(member.grossDueYen ?? member.gross_due_yen ?? member.cappedFrom ?? member.capped_from ?? totalPay));
      const cappedFrom = Math.round(numberValue(member.cappedFrom ?? member.capped_from));
      const extraBasePay = Math.round(numberValue(member.extraBasePay ?? member.extra_base_pay));
      const extraPaidYen = Math.round(numberValue(member.extraPaidYen ?? member.extra_paid_yen));
      const regularStockYen = Math.round(numberValue(member.regularStockYen ?? member.regular_stock_yen));
      const extraStockYen = Math.round(numberValue(member.extraStockYen ?? member.extra_stock_yen));
      const explicitExtraGrossDueYen = hasExplicitNumber(member.extraGrossDueYen ?? member.extra_gross_due_yen);
      const extraGrossDueYen = explicitExtraGrossDueYen
        ? Math.round(numberValue(member.extraGrossDueYen ?? member.extra_gross_due_yen))
        : Math.max(0, extraPaidYen + extraStockYen);
      const regularGrossDueYen = hasExplicitNumber(member.regularGrossDueYen ?? member.regular_gross_due_yen)
        ? Math.round(numberValue(member.regularGrossDueYen ?? member.regular_gross_due_yen))
        : Math.max(0, grossDueYen - extraGrossDueYen);
      const basePay = Math.round(numberValue(member.basePay ?? member.base_pay));
      const regularBasePay = hasExplicitNumber(member.regularBasePay ?? member.regular_base_pay)
        ? Math.round(numberValue(member.regularBasePay ?? member.regular_base_pay))
        : Math.max(0, basePay - extraBasePay);
      const regularPaidYen = options.useCompanyReserveYen
        ? regularCompanyReserveYen || Math.max(0, totalPay - extraCompanyReserveYen)
        : hasExplicitNumber(member.regularPaidYen ?? member.regular_paid_yen)
          ? Math.round(numberValue(member.regularPaidYen ?? member.regular_paid_yen))
          : Math.max(0, totalPay - extraPaidYen);
      const resolvedExtraPaidYen = options.useCompanyReserveYen ? extraCompanyReserveYen : extraPaidYen;
      const payoutAmountOverride = member.payoutAmountOverride;
      if (totalPay <= 0 && stockYen <= 0 && grossDueYen <= 0 && !payoutAmountOverride) continue;

      cycleEntries.push({
        projectId: cycle.project_id,
        ym: cycle.ym,
        invoiceYm,
        memberId,
        memberName: memberNameOf(member) || memberMap.get(memberId) || memberId,
        earnedPt: numberValue(member.earnedPt ?? member.earned_pt),
        basePay,
        bonusPt: Math.round(numberValue(member.bonusPt ?? member.bonus_pt)),
        totalPay,
        regularBasePay,
        extraBasePay,
        regularPaidYen,
        extraPaidYen: resolvedExtraPaidYen,
        regularStockYen,
        extraStockYen,
        regularGrossDueYen,
        extraGrossDueYen,
        grossDueYen,
        carryInYen,
        stockYen,
        cappedFrom,
        payoutAmountOverride,
      });
    }
    entries.push(...cycleEntries);
  }

  return entries.sort((a, b) => {
    if (a.memberName !== b.memberName) return a.memberName.localeCompare(b.memberName, "ja");
    if (a.ym !== b.ym) return a.ym.localeCompare(b.ym);
    return a.projectId.localeCompare(b.projectId);
  });
}

function buildProjectMonthlyFinanceRows({
  months,
  cycles,
  extraRevenueRows,
  projectMap,
  memberMap,
  payoutExcludedMemberIds,
  officerMemberIds,
  planCycles,
  payoutEligibleProjectIds,
  forecastCapped,
}: {
  months: string[];
  cycles: BillingCycle[];
  extraRevenueRows: ExtraRevenueSourceRow[];
  projectMap: Map<string, Project>;
  memberMap: Map<string, string>;
  payoutExcludedMemberIds: Set<string>;
  officerMemberIds: Set<string>;
  planCycles: ForecastPlanCycle[];
  payoutEligibleProjectIds: Set<string>;
  forecastCapped: ForecastCappedRow[];
}): ProjectMonthlyFinanceRow[] {
  // 将来月の「本契約cap使用 / 別財布使用」(capped) を (projectId:ym) で引けるようにする。
  // 値 0 も「使用なし」という正しい結果なので、未計算 (key 無し) と区別する。
  const cappedByPjYm = new Map<string, {
    regularYen: number;
    extraYen: number;
    totalYen: number;
    regularExternalYen: number;
    extraExternalYen: number;
    regularCompanyReserveYen: number;
    extraCompanyReserveYen: number;
    regularGrossDueYen: number;
    extraGrossDueYen: number;
    carryOverYen: number;
    finalCapTopUpYen: number;
    regularFinalCapTopUpYen: number;
    extraFinalCapTopUpYen: number;
  }>();
  for (const row of forecastCapped) {
    const totalYen = Math.round(numberValue(row.cappedTotalYen));
    const extraYen = Math.round(numberValue(row.cappedExtraYen));
    const regularYen = hasExplicitNumber(row.cappedRegularYen)
      ? Math.round(numberValue(row.cappedRegularYen))
      : Math.max(0, totalYen - extraYen);
    const regularCompanyReserveYen = Math.round(numberValue(row.regularCompanyReserveYen));
    const extraCompanyReserveYen = Math.round(numberValue(row.extraCompanyReserveYen));
    const regularExternalYen = hasExplicitNumber(row.cappedRegularExternalYen)
      ? Math.round(numberValue(row.cappedRegularExternalYen))
      : Math.max(0, regularYen - regularCompanyReserveYen);
    const extraExternalYen = hasExplicitNumber(row.cappedExtraExternalYen)
      ? Math.round(numberValue(row.cappedExtraExternalYen))
      : Math.max(0, extraYen - extraCompanyReserveYen);
    cappedByPjYm.set(`${row.projectId}:${row.ym}`, {
      regularYen,
      extraYen,
      totalYen,
      regularExternalYen,
      extraExternalYen,
      regularCompanyReserveYen,
      extraCompanyReserveYen,
      regularGrossDueYen: Math.round(numberValue(row.regularGrossDueYen)),
      extraGrossDueYen: Math.round(numberValue(row.extraGrossDueYen)),
      carryOverYen: Math.round(numberValue(row.carryOverYen)),
      finalCapTopUpYen: Math.round(numberValue(row.finalCapTopUpYen)),
      regularFinalCapTopUpYen: Math.round(numberValue(row.regularFinalCapTopUpYen)),
      extraFinalCapTopUpYen: Math.round(numberValue(row.extraFinalCapTopUpYen)),
    });
  }
  const nonOfficerEntries = buildEntries(cycles, memberMap, new Set([...payoutExcludedMemberIds, ...officerMemberIds]), { projectMap });
  const officerEntries = buildEntries(
    cycles,
    memberMap,
    new Set([...memberMap.keys()].filter((memberId) => !officerMemberIds.has(memberId))),
    { useCompanyReserveYen: true, projectMap }
  );
  const nonOfficerByCycle = new Map<string, PayoutEntry[]>();
  const officerByCycle = new Map<string, PayoutEntry[]>();
  for (const entry of nonOfficerEntries) {
    const key = `${entry.projectId}:${entry.ym}`;
    const list = nonOfficerByCycle.get(key) ?? [];
    list.push(entry);
    nonOfficerByCycle.set(key, list);
  }
  for (const entry of officerEntries) {
    const key = `${entry.projectId}:${entry.ym}`;
    const list = officerByCycle.get(key) ?? [];
    list.push(entry);
    officerByCycle.set(key, list);
  }

  // 別財布（別契約）売上を現金入金月で展開し (projectId:ym) ごとに引けるようにする。
  // 按分元行の ym は表示期間より前のこともあるので、絞り込みは展開後の minYm/maxYm で行う
  // (= live-monthly-pl-inputs と同じ共通ヘルパー expandExtraRevenueCash を共用)。
  const monthInts = months.map((ym) => Number(ym)).filter((n) => Number.isFinite(n));
  const minMonth = monthInts.length > 0 ? Math.min(...monthInts) : undefined;
  const maxMonth = monthInts.length > 0 ? Math.max(...monthInts) : undefined;
  const extraByPjYm = new Map<string, { amount: number; labels: string[] }>();
  for (const ex of expandExtraRevenueCash(extraRevenueRows, {
    minYm: minMonth,
    maxYm: maxMonth,
    paymentTermsByProjectId: projectMap,
  })) {
    extraByPjYm.set(`${ex.projectId}:${ex.ym}`, { amount: ex.amount, labels: ex.labels });
  }
  const takeExtra = (projectId: string, ym: string): { amount: number; labels: string[] } => {
    const key = `${projectId}:${ym}`;
    const hit = extraByPjYm.get(key);
    if (!hit) return { amount: 0, labels: [] };
    extraByPjYm.delete(key); // cycle に乗せたら二重計上を防ぐため消す
    return hit;
  };

  const rows = new Map<string, ProjectMonthlyFinanceRow>();
  const ensureRow = (projectId: string) => {
    const project = projectMap.get(projectId);
    const current =
      rows.get(projectId) ??
      {
        projectId,
        projectName: project?.project_name ?? projectId,
        cells: [],
        totals: {
          baseClientAmountYen: 0,
          budgetYen: 0,
          extraRevenueYen: 0,
          payoutYen: 0,
          extraPayoutYen: 0,
          regularExternalPayoutYen: 0,
          extraExternalPayoutYen: 0,
          regularCompanyReserveYen: 0,
          extraCompanyReserveYen: 0,
          officerPayoutYen: 0,
          stockYen: 0,
          finalCapTopUpYen: 0,
          regularFinalCapTopUpYen: 0,
          extraFinalCapTopUpYen: 0,
          regularGrossDueYen: 0,
          extraGrossDueYen: 0,
          grossDueYen: 0,
          finalBalanceYen: 0,
          extraBalanceYen: 0,
        },
      };
    rows.set(projectId, current);
    return current;
  };

  for (const cycle of cycles) {
    const row = ensureRow(cycle.project_id);
    const key = `${cycle.project_id}:${cycle.ym}`;
    const project = projectMap.get(cycle.project_id);
    const entries = nonOfficerByCycle.get(key) ?? [];
    const officerReserve = officerByCycle.get(key) ?? [];
    const baseClientAmountYen = baseClientAmountForCycle(cycle, project);
    const baseCapYen = baseCapYenFor(baseClientAmountYen, Math.round(numberValue(cycle.budget_buffer_amount)));
    const budgetYen = baseCapYen > 0
      ? baseCapYen
      : hasExplicitNumber(cycle.budget_yen)
        ? Math.round(numberValue(cycle.budget_yen))
        : 0;
    const regularExternalPayoutYen = entries.reduce((sum, entry) => sum + entry.regularPaidYen, 0);
    const extraExternalPayoutYen = entries.reduce((sum, entry) => sum + entry.extraPaidYen, 0);
    const regularOfficerReserveYen = officerReserve.reduce((sum, entry) => sum + entry.regularPaidYen, 0);
    const extraOfficerReserveYen = officerReserve.reduce((sum, entry) => sum + entry.extraPaidYen, 0);
    const actualRegularUseYen = regularExternalPayoutYen + regularOfficerReserveYen;
    const actualExtraUseYen = extraExternalPayoutYen + extraOfficerReserveYen;
    const officerPayoutYen = regularOfficerReserveYen;
    const stockYen = entries.reduce((sum, entry) => sum + entry.stockYen, 0);
    const regularGrossDueYen = entries.reduce((sum, entry) => sum + entry.regularGrossDueYen, 0) + officerReserve.reduce((sum, entry) => sum + entry.regularGrossDueYen, 0);
    const extraGrossDueYen = entries.reduce((sum, entry) => sum + entry.extraGrossDueYen, 0) + officerReserve.reduce((sum, entry) => sum + entry.extraGrossDueYen, 0);
    const hasRewardMembers = (asRewardSummary(cycle.reward_summary_json)?.members?.length ?? 0) > 0;
    const canForecastPayout = hasRewardBearingPlan(cycle.project_id, cycle.ym, planCycles);
    // 実績メンバーが居ない将来月の「本契約cap使用 / 別財布使用」は capped が正本 (spec 7-1)。
    // route が reward_summary_json キャッシュから集計して返す。
    // capped が「計算済み」(key 有り) ならその値を使う。値 0 も「役員のみ PJ なので支払予定ゼロ」という
    // 正しい結果なので budgetYen フォールバックに落とさない (= KUTE のような全員役員 PJ で巨額が出る事故防止)。
    // budgetYen 決め打ちフォールバックは plan 期間外などで capped が未計算 (key 無し) の月に限る。
    // ※ v0.25.3 では uncapped を入れていたため pt 消化が厚い月に budget_yen を超えて跳ね、
    //   マイナス月 / KUTE 巨額 / OkuDoor 超過が発生した (2026-06-17 まさ指摘 → v0.25.4 で修正)。
    const cappedForecast = cappedByPjYm.get(`${cycle.project_id}:${cycle.ym}`);
    const fallbackRegularUseYen = budgetYen > 0 && canForecastPayout && payoutEligibleProjectIds.has(cycle.project_id)
      ? budgetYen
      : actualRegularUseYen;
    const forecastRegularExternalPayoutYen =
      !hasRewardMembers && actualRegularUseYen === 0
        ? cappedForecast?.regularExternalYen ?? fallbackRegularUseYen
        : regularExternalPayoutYen;
    const forecastRegularCompanyReserveYen =
      !hasRewardMembers && actualRegularUseYen === 0
        ? cappedForecast?.regularCompanyReserveYen ?? Math.max(0, (cappedForecast?.regularYen ?? fallbackRegularUseYen) - forecastRegularExternalPayoutYen)
        : regularOfficerReserveYen;
    const forecastRegularPayoutYen =
      !hasRewardMembers && actualRegularUseYen === 0
        ? cappedForecast != null
          ? cappedForecast.regularYen
          : fallbackRegularUseYen
        : actualRegularUseYen;
    const forecastExtraExternalPayoutYen =
      !hasRewardMembers && actualExtraUseYen === 0
        ? cappedForecast?.extraExternalYen ?? 0
        : extraExternalPayoutYen;
    const forecastExtraCompanyReserveYen =
      !hasRewardMembers && actualExtraUseYen === 0
        ? cappedForecast?.extraCompanyReserveYen ?? Math.max(0, (cappedForecast?.extraYen ?? 0) - forecastExtraExternalPayoutYen)
        : extraOfficerReserveYen;
    const forecastExtraPayoutYen =
      !hasRewardMembers && actualExtraUseYen === 0
        ? cappedForecast?.extraYen ?? 0
        : actualExtraUseYen;
    const forecastRegularGrossDueYen =
      !hasRewardMembers && regularGrossDueYen === 0
        ? cappedForecast?.regularGrossDueYen ?? forecastRegularPayoutYen
        : regularGrossDueYen;
    const forecastExtraGrossDueYen =
      !hasRewardMembers && extraGrossDueYen === 0
        ? cappedForecast?.extraGrossDueYen ?? forecastExtraPayoutYen
        : extraGrossDueYen;
    const forecastStockYen =
      !hasRewardMembers && stockYen === 0
        ? cappedForecast?.carryOverYen ?? 0
        : stockYen;
    const finalCapTopUpYen = cappedForecast?.finalCapTopUpYen ?? 0;
    const regularFinalCapTopUpYen = cappedForecast?.regularFinalCapTopUpYen ?? 0;
    const extraFinalCapTopUpYen = cappedForecast?.extraFinalCapTopUpYen ?? 0;
    const extra = takeExtra(cycle.project_id, cycle.ym);
    const finalBalanceYen = budgetYen - forecastRegularPayoutYen;
    const extraBalanceYen = extra.amount - forecastExtraPayoutYen;
    const cell: ProjectMonthlyFinanceCell = {
      projectId: cycle.project_id,
      projectName: row.projectName,
      ym: cycle.ym,
      baseClientAmountYen,
      budgetYen,
      extraRevenueYen: extra.amount,
      payoutYen: forecastRegularPayoutYen,
      extraPayoutYen: forecastExtraPayoutYen,
      regularExternalPayoutYen: forecastRegularExternalPayoutYen,
      extraExternalPayoutYen: forecastExtraExternalPayoutYen,
      regularCompanyReserveYen: forecastRegularCompanyReserveYen,
      extraCompanyReserveYen: forecastExtraCompanyReserveYen,
      officerPayoutYen,
      stockYen: forecastStockYen,
      finalCapTopUpYen,
      regularFinalCapTopUpYen,
      extraFinalCapTopUpYen,
      regularGrossDueYen: forecastRegularGrossDueYen,
      extraGrossDueYen: forecastExtraGrossDueYen,
      grossDueYen: forecastRegularGrossDueYen + forecastExtraGrossDueYen,
      finalBalanceYen,
      extraBalanceYen,
    };
    row.cells.push(cell);
    row.totals.baseClientAmountYen += baseClientAmountYen;
    row.totals.budgetYen += budgetYen;
    row.totals.extraRevenueYen += extra.amount;
    row.totals.payoutYen += forecastRegularPayoutYen;
    row.totals.extraPayoutYen += forecastExtraPayoutYen;
    row.totals.officerPayoutYen += officerPayoutYen;
    row.totals.regularExternalPayoutYen += forecastRegularExternalPayoutYen;
    row.totals.extraExternalPayoutYen += forecastExtraExternalPayoutYen;
    row.totals.regularCompanyReserveYen += forecastRegularCompanyReserveYen;
    row.totals.extraCompanyReserveYen += forecastExtraCompanyReserveYen;
    row.totals.stockYen += forecastStockYen;
    row.totals.finalCapTopUpYen += finalCapTopUpYen;
    row.totals.regularFinalCapTopUpYen += regularFinalCapTopUpYen;
    row.totals.extraFinalCapTopUpYen += extraFinalCapTopUpYen;
    row.totals.regularGrossDueYen += forecastRegularGrossDueYen;
    row.totals.extraGrossDueYen += forecastExtraGrossDueYen;
    row.totals.grossDueYen += forecastRegularGrossDueYen + forecastExtraGrossDueYen;
    row.totals.finalBalanceYen += finalBalanceYen;
    row.totals.extraBalanceYen += extraBalanceYen;
  }

  // cycle が存在しない PJ×月にも別財布按分が残っていれば独立セルとして立てる。
  // 例: OkuDoor(p19) は ym=202603 の 1 行に period 202605〜202610 を持つため、
  // 202604〜610 に billing_cycles 行が無くても按分額の収支セルが必要。
  for (const [key, val] of [...extraByPjYm.entries()]) {
    const [projectId, ymStr] = key.split(":");
    const row = ensureRow(projectId);
    const cell: ProjectMonthlyFinanceCell = {
      projectId,
      projectName: row.projectName,
      ym: ymStr,
      baseClientAmountYen: 0,
      budgetYen: 0,
      extraRevenueYen: val.amount,
      payoutYen: 0,
      extraPayoutYen: 0,
      regularExternalPayoutYen: 0,
      extraExternalPayoutYen: 0,
      regularCompanyReserveYen: 0,
      extraCompanyReserveYen: 0,
      officerPayoutYen: 0,
      stockYen: 0,
      finalCapTopUpYen: 0,
      regularFinalCapTopUpYen: 0,
      extraFinalCapTopUpYen: 0,
      regularGrossDueYen: 0,
      extraGrossDueYen: 0,
      grossDueYen: 0,
      finalBalanceYen: 0,
      extraBalanceYen: val.amount,
    };
    row.cells.push(cell);
    row.totals.extraRevenueYen += val.amount;
    row.totals.extraBalanceYen += val.amount;
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      cells: months.map((ym) => row.cells.find((cell) => cell.ym === ym) ?? {
        projectId: row.projectId,
        projectName: row.projectName,
        ym,
        baseClientAmountYen: 0,
        budgetYen: 0,
        extraRevenueYen: 0,
        payoutYen: 0,
        extraPayoutYen: 0,
        regularExternalPayoutYen: 0,
        extraExternalPayoutYen: 0,
        regularCompanyReserveYen: 0,
        extraCompanyReserveYen: 0,
        officerPayoutYen: 0,
        stockYen: 0,
        finalCapTopUpYen: 0,
        regularFinalCapTopUpYen: 0,
        extraFinalCapTopUpYen: 0,
        regularGrossDueYen: 0,
        extraGrossDueYen: 0,
        grossDueYen: 0,
        finalBalanceYen: 0,
        extraBalanceYen: 0,
      }),
    }))
    .filter((row) => row.totals.budgetYen > 0 || row.totals.payoutYen > 0 || row.totals.extraPayoutYen > 0 || row.totals.stockYen > 0 || row.totals.baseClientAmountYen > 0 || row.totals.extraRevenueYen > 0)
    .sort((a, b) => a.projectName.localeCompare(b.projectName, "ja"));
}

function rewardDebtSourceForEntry({
  entry,
  project,
  accruedYen,
  pool,
  extraCapSetForMonth,
}: {
  entry: PayoutEntry;
  project?: Project;
  accruedYen: number;
  pool: "regular" | "cap_extra";
  /** 当月 billing.extra_budget_yen が明示設定されているか (= 別財布cap が決まっている月) */
  extraCapSetForMonth: boolean;
}): Pick<RewardDebtLedgerRow, "source" | "sourceLabel" | "sourceClassName" | "note"> {
  // 別財布 (cap_extra) プールは本契約capとは別原資。完了月だけ満額capを置き、それまで全額stock繰越する
  // のが正常仕様 (= 完了時一括支払)。本契約cap で「cap不足」と判定すると誤報になる。
  if (pool === "cap_extra") {
    return {
      source: "cap_extra_deferred",
      sourceLabel: "別財布",
      sourceClassName: "border-sky-200 bg-sky-50 text-sky-900",
      note: extraCapSetForMonth
        ? "別財布 (cap_extra) の当月発生分。本契約capとは別原資で判定する。"
        : "別財布 (cap_extra) の発生分を完了月一括の支払に向けて全額繰越中 (本契約capとは無関係)。",
    };
  }

  if (project?.start_ym && entry.ym < project.start_ym) {
    return {
      source: "pre_contract",
      sourceLabel: "契約前発生",
      sourceClassName: "border-amber-200 bg-amber-50 text-amber-900",
      note: `${fmtYm(project.start_ym)}契約開始前の稼働分。cap 0 円として後月支払へ繰越。`,
    };
  }

  if (entry.carryInYen > 0 && accruedYen > 0) {
    return {
      source: "carry_and_current",
      sourceLabel: "繰越+今月発生",
      sourceClassName: "border-sky-200 bg-sky-50 text-sky-900",
      note: "前月未払い残と今月発生分が同じcapの中で返済・支払されている。",
    };
  }

  if (entry.carryInYen > 0) {
    return {
      source: "carry_only",
      sourceLabel: "繰越のみ",
      sourceClassName: "border-zinc-200 bg-zinc-50 text-zinc-700",
      note: "当月の新規発生はなく、過去未払い分だけを返済対象にしている。",
    };
  }

  return {
    source: "cap_deferred",
    sourceLabel: "cap不足",
    sourceClassName: "border-red-200 bg-red-50 text-red-800",
    note: "当月capで発生額を払い切れない分が月末未払い残に回っている。",
  };
}

function buildRewardDebtLedgerRows({
  entries,
  cycles,
  projectMap,
}: {
  entries: PayoutEntry[];
  cycles: BillingCycle[];
  projectMap: Map<string, Project>;
}): RewardDebtLedgerRow[] {
  const cycleByKey = new Map(cycles.map((cycle) => [`${cycle.project_id}:${cycle.ym}`, cycle]));
  const sourcePriority: Record<RewardDebtSource, number> = {
    pre_contract: 0,
    carry_and_current: 1,
    carry_only: 2,
    cap_deferred: 3,
    cap_extra_deferred: 4,
  };

  return entries
    .flatMap((entry): RewardDebtLedgerRow[] => {
      const cycle = cycleByKey.get(`${entry.projectId}:${entry.ym}`);
      const project = projectMap.get(entry.projectId);

      const baseClientAmountYen = cycle ? baseClientAmountForCycle(cycle, project) : 0;
      const baseCapYen = cycle
        ? baseCapYenFor(baseClientAmountYen, Math.round(numberValue(cycle.budget_buffer_amount)))
        : 0;
      const regularCapYen = baseCapYen > 0
        ? baseCapYen
        : Math.round(numberValue(cycle?.budget_yen));
      const extraBudgetRaw = cycle?.extra_budget_yen;
      const extraCapSetForMonth = hasExplicitNumber(extraBudgetRaw);
      const extraCapYen = extraCapSetForMonth ? Math.max(0, Math.round(numberValue(extraBudgetRaw))) : 0;

      const out: RewardDebtLedgerRow[] = [];

      // 本契約 (regular) プール: 本契約cap と突合。別財布分は除外した regular の発生/支払/stock で判定する。
      const regularGross = Math.round(entry.regularGrossDueYen);
      const regularPaid = Math.round(entry.regularPaidYen);
      const regularStock = Math.round(entry.regularStockYen);
      // regular の carryIn は前月 regularStock 由来。entry.carryInYen は混在値なので extra stock 分を引く。
      const regularCarryIn = Math.max(0, Math.round(entry.carryInYen) - Math.round(entry.extraStockYen));
      if (regularStock > 0 || regularGross > regularPaid) {
        const accruedYen = Math.max(0, regularGross - regularCarryIn);
        const source = rewardDebtSourceForEntry({ entry, project, accruedYen, pool: "regular", extraCapSetForMonth });
        out.push({
          key: `${entryKey(entry)}:regular`,
          projectId: entry.projectId,
          projectName: project?.project_name ?? entry.projectId,
          projectStartYm: project?.start_ym ?? null,
          ym: entry.ym,
          invoiceYm: entry.invoiceYm,
          memberId: entry.memberId,
          memberName: entry.memberName,
          pool: "regular",
          carryInYen: regularCarryIn,
          accruedYen,
          paidYen: regularPaid,
          endingStockYen: regularStock,
          grossDueYen: regularGross,
          budgetYen: regularCapYen,
          ...source,
        });
      }

      // 別財布 (cap_extra) プール: 本契約capではなく extra_budget_yen と突合する。
      const extraGross = Math.round(entry.extraGrossDueYen);
      const extraPaid = Math.round(entry.extraPaidYen);
      const extraStock = Math.round(entry.extraStockYen);
      if (extraStock > 0 || extraGross > extraPaid) {
        const source = rewardDebtSourceForEntry({ entry, project, accruedYen: extraGross, pool: "cap_extra", extraCapSetForMonth });
        out.push({
          key: `${entryKey(entry)}:cap_extra`,
          projectId: entry.projectId,
          projectName: project?.project_name ?? entry.projectId,
          projectStartYm: project?.start_ym ?? null,
          ym: entry.ym,
          invoiceYm: entry.invoiceYm,
          memberId: entry.memberId,
          memberName: entry.memberName,
          pool: "cap_extra",
          carryInYen: 0,
          accruedYen: extraGross,
          paidYen: extraPaid,
          endingStockYen: extraStock,
          grossDueYen: extraGross,
          budgetYen: extraCapYen,
          ...source,
        });
      }

      return out;
    })
    .sort((a, b) => (
      sourcePriority[a.source] - sourcePriority[b.source] ||
      a.ym.localeCompare(b.ym) ||
      a.projectName.localeCompare(b.projectName, "ja") ||
      a.memberName.localeCompare(b.memberName, "ja")
    ));
}

function buildMemberMonthlyPayoutRows({
  months,
  members,
  entries,
  projectMap,
}: {
  months: string[];
  members: Member[];
  entries: PayoutEntry[];
  projectMap: Map<string, Project>;
}): MemberMonthlyPayoutRow[] {
  const eligibleMembers = members.filter((member) => !member.is_officer && !member.exclude_from_payout_notice);
  const makeCells = (memberId: string, memberName: string): MemberMonthlyPayoutCell[] =>
    months.map((month) => ({
      memberId,
      memberName,
      ym: month,
      totalPay: 0,
      regularPaidYen: 0,
      extraPaidYen: 0,
      entries: [],
    }));

  const rows = new Map<string, MemberMonthlyPayoutRow>();
  for (const member of eligibleMembers) {
    const memberName = member.code_name || member.member_name || member.member_id;
    rows.set(member.member_id, {
      memberId: member.member_id,
      memberName,
      totalPay: 0,
      regularPaidYen: 0,
      extraPaidYen: 0,
      cells: makeCells(member.member_id, memberName),
    });
  }

  for (const entry of entries) {
    if (entry.totalPay <= 0) continue;
    const paymentYm = entry.invoiceYm || entry.ym;
    if (!months.includes(paymentYm)) continue;
    const row =
      rows.get(entry.memberId) ??
      {
        memberId: entry.memberId,
        memberName: entry.memberName,
        totalPay: 0,
        regularPaidYen: 0,
        extraPaidYen: 0,
        cells: makeCells(entry.memberId, entry.memberName),
      };
    const cell = row.cells.find((item) => item.ym === paymentYm);
    if (!cell) continue;
    const line: MemberMonthlyPayoutProjectLine = {
      ...entry,
      projectName: projectMap.get(entry.projectId)?.project_name ?? entry.projectId,
    };
    cell.totalPay += entry.totalPay;
    cell.regularPaidYen += entry.regularPaidYen;
    cell.extraPaidYen += entry.extraPaidYen;
    cell.entries.push(line);
    cell.entries.sort((a, b) => b.totalPay - a.totalPay || a.projectName.localeCompare(b.projectName, "ja"));
    row.totalPay += entry.totalPay;
    row.regularPaidYen += entry.regularPaidYen;
    row.extraPaidYen += entry.extraPaidYen;
    rows.set(entry.memberId, row);
  }

  return [...rows.values()].sort((a, b) => b.totalPay - a.totalPay || a.memberName.localeCompare(b.memberName, "ja"));
}

export function AdminPayoutsClient({ initialYm, ymOptions, initialData = null }: Props) {
  const initialPayload = initialData?.ym === initialYm ? initialData : null;
  const skipInitialFetchRef = useRef(Boolean(initialPayload));
  const backgroundReloadingRef = useRef(false);
  const [ym, setYm] = useState(initialYm);
  const [data, setData] = useState<PayoutData | null>(initialPayload);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState(() => initialPayload ? payoutDataHint(initialPayload.ym, initialPayload, Boolean(initialPayload.refreshedRewards)) : "");
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [breakdownTarget, setBreakdownTarget] = useState<
    { projectId: string; ym: string; memberId: string; label: string } | null
  >(null);
  const [noticeSavingMemberId, setNoticeSavingMemberId] = useState<string | null>(null);
  const [noticeMailModal, setNoticeMailModal] = useState<NoticeMailModalState | null>(null);
  const [noticeMailLoading, setNoticeMailLoading] = useState(false);
  const [noticeMailLoadingMemberId, setNoticeMailLoadingMemberId] = useState<string | null>(null);
  const [noticeMailSending, setNoticeMailSending] = useState(false);
  const [noticeMailError, setNoticeMailError] = useState<string | null>(null);
  const [paymentNudgeSending, setPaymentNudgeSending] = useState(false);
  const [bulkPdfMode, setBulkPdfMode] = useState<"issue" | "preview" | null>(null);
  const [bulkPdfResult, setBulkPdfResult] = useState<BulkNoticeSummary | null>(null);
  const [agreementOverrideReason, setAgreementOverrideReason] = useState("");
  const [selectedMemberMonthlyPayout, setSelectedMemberMonthlyPayout] = useState<SelectedMemberMonthlyPayoutCell | null>(null);
  const [cockpitCache, setCockpitCache] = useState<Record<string, CockpitData>>({});
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of data?.members ?? []) {
      map.set(member.member_id, member.code_name || member.member_name || member.member_id);
    }
    return map;
  }, [data?.members]);

  const memberRecordMap = useMemo(() => {
    const map = new Map<string, Member>();
    for (const member of data?.members ?? []) {
      map.set(member.member_id, member);
    }
    return map;
  }, [data?.members]);

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const project of data?.projects ?? []) {
      map.set(project.project_id, project);
    }
    return map;
  }, [data?.projects]);

  const payoutMap = useMemo(() => {
    const map = new Map<string, MonthlyRewardPayout>();
    for (const payout of data?.payouts ?? []) {
      map.set(payoutKey(payout), payout);
    }
    return map;
  }, [data?.payouts]);

  const noticeMap = useMemo(() => {
    const map = new Map<string, PayoutNotice>();
    for (const notice of data?.notices ?? []) {
      map.set(notice.member_id, notice);
    }
    return map;
  }, [data?.notices]);

  const payoutExcludedMemberIds = useMemo(() => {
    const set = new Set<string>();
    for (const member of data?.members ?? []) {
      if (member.exclude_from_payout_notice || member.is_officer) set.add(member.member_id);
    }
    return set;
  }, [data?.members]);

  const payoutEligibleProjectIds = useMemo(() => {
    const set = new Set<string>();
    for (const projectMember of data?.projectMembers ?? []) {
      if (projectMember.is_active === false) continue;
      if (payoutExcludedMemberIds.has(projectMember.member_id)) continue;
      set.add(projectMember.project_id);
    }
    return set;
  }, [data?.projectMembers, payoutExcludedMemberIds]);

  const officerMemberIds = useMemo(() => {
    const set = new Set<string>();
    for (const member of data?.members ?? []) {
      if (member.is_officer) set.add(member.member_id);
    }
    return set;
  }, [data?.members]);

  const expectedEntries = useMemo(
    () => buildEntries(data?.cycles ?? [], memberMap, payoutExcludedMemberIds, { projectMap }),
    [data?.cycles, memberMap, payoutExcludedMemberIds, projectMap]
  );

  const officerReserveEntries = useMemo(
    () => buildEntries(
      data?.cycles ?? [],
      memberMap,
      new Set((data?.members ?? []).filter((member) => !member.is_officer).map((member) => member.member_id)),
      { useCompanyReserveYen: true, projectMap }
    ),
    [data?.cycles, data?.members, memberMap, projectMap]
  );

  const cycleStats = useMemo(() => {
    const byCycle = new Map<string, {
      totalPay: number;
      regularBasePay: number;
      extraBasePay: number;
      regularPaidYen: number;
      extraPaidYen: number;
      grossDueYen: number;
      stockYen: number;
      regularStockYen: number;
      extraStockYen: number;
      carryInYen: number;
      savedCount: number;
      expectedCount: number;
    }>();
    for (const entry of expectedEntries) {
      const key = `${entry.projectId}:${entry.ym}`;
      const current = byCycle.get(key) ?? {
        totalPay: 0,
        regularBasePay: 0,
        extraBasePay: 0,
        regularPaidYen: 0,
        extraPaidYen: 0,
        grossDueYen: 0,
        stockYen: 0,
        regularStockYen: 0,
        extraStockYen: 0,
        carryInYen: 0,
        savedCount: 0,
        expectedCount: 0,
      };
      current.totalPay += entry.totalPay;
      current.regularBasePay += entry.regularBasePay;
      current.extraBasePay += entry.extraBasePay;
      current.regularPaidYen += entry.regularPaidYen;
      current.extraPaidYen += entry.extraPaidYen;
      current.grossDueYen += entry.grossDueYen;
      current.stockYen += entry.stockYen;
      current.regularStockYen += entry.regularStockYen;
      current.extraStockYen += entry.extraStockYen;
      current.carryInYen += entry.carryInYen;
      current.expectedCount += 1;
      const saved = payoutMap.get(entryKey(entry));
      if (saved && Math.round(numberValue(saved.total_pay)) === entry.totalPay) current.savedCount += 1;
      byCycle.set(key, current);
    }
    return byCycle;
  }, [expectedEntries, payoutMap]);

  const budgetAuditItems = useMemo<BudgetAuditItem[]>(() => {
    return (data?.cycles ?? []).map((cycle) => {
      const stats = cycleStats.get(`${cycle.project_id}:${cycle.ym}`);
      const project = projectMap.get(cycle.project_id);
      const baseClientAmountYen = baseClientAmountForCycle(cycle, project);
      const bufferYen = Math.round(numberValue(cycle.budget_buffer_amount));
      const baseCapYen = baseCapYenFor(baseClientAmountYen, bufferYen);
      const budgetYen = baseCapYen;
      return {
        key: `${cycle.project_id}:${cycle.ym}`,
        projectId: cycle.project_id,
        ym: cycle.ym,
        invoiceYm: cycle.invoice_ym || cycle.ym,
        projectName: project?.project_name ?? cycle.project_id,
        projectStatus: project?.status ?? null,
        baseClientAmountYen,
        bufferYen,
        baseCapYen,
        extraPayoutYen: Math.round(stats?.extraPaidYen ?? 0),
        budgetYen,
        payoutYen: Math.round(stats?.regularPaidYen ?? 0),
        stockYen: Math.round(stats?.regularStockYen ?? 0),
        grossDueYen: Math.round(stats?.grossDueYen ?? 0),
        paymentConfirmed: Boolean(cycle.payment_confirmed_at),
      };
    }).filter((item) => item.budgetYen > 0 || item.payoutYen > 0 || item.stockYen > 0);
  }, [cycleStats, data?.cycles, projectMap]);

  const budgetAuditTotals = useMemo(() => {
    const budgetYen = budgetAuditItems.reduce((sum, item) => sum + item.budgetYen, 0);
    const payoutYen = budgetAuditItems.reduce((sum, item) => sum + item.payoutYen, 0);
    const overYen = budgetAuditItems.reduce(
      (sum, item) => sum + Math.max(0, item.payoutYen - item.budgetYen),
      0
    );
    const missingBudgetCount = budgetAuditItems.filter((item) => item.budgetYen <= 0 && item.payoutYen > 0).length;
    const unpaidCount = budgetAuditItems.filter((item) => item.payoutYen > 0 && !item.paymentConfirmed).length;
    return { budgetYen, payoutYen, overYen, missingBudgetCount, unpaidCount };
  }, [budgetAuditItems]);
  const hasBudgetBlocker = budgetAuditTotals.missingBudgetCount > 0 || budgetAuditTotals.overYen > 0;
  const agreementGate = data?.payoutAgreementGate ?? null;
  const agreementBlockers = agreementGate?.blockers ?? [];
  const agreementBlockedMemberIds = new Set(agreementBlockers.map((row) => row.memberId));
  const hasAgreementBlocker = agreementBlockers.length > 0;
  const agreementOverrideReasonTrimmed = agreementOverrideReason.trim();
  const canUseAgreementOverride = !hasAgreementBlocker || agreementOverrideReasonTrimmed.length >= 8;
  const guardedActionDisabled = hasAgreementBlocker && !canUseAgreementOverride;
  const guardedActionTitle = guardedActionDisabled
    ? "月初合意blockerを解除するか、admin override理由を8文字以上入れてね"
    : undefined;

  const projectFinanceGroups = useMemo<ProjectFinanceGroup[]>(() => {
    const nonOfficerByCycle = new Map<string, PayoutEntry[]>();
    const officerByCycle = new Map<string, PayoutEntry[]>();
    for (const entry of expectedEntries) {
      const key = `${entry.projectId}:${entry.ym}`;
      const list = nonOfficerByCycle.get(key) ?? [];
      list.push(entry);
      nonOfficerByCycle.set(key, list);
    }
    for (const entry of officerReserveEntries) {
      const key = `${entry.projectId}:${entry.ym}`;
      const list = officerByCycle.get(key) ?? [];
      list.push(entry);
      officerByCycle.set(key, list);
    }

    const map = new Map<string, ProjectFinanceGroup>();
    for (const cycle of data?.cycles ?? []) {
      const project = projectMap.get(cycle.project_id);
      const group =
        map.get(cycle.project_id) ??
        {
          projectId: cycle.project_id,
          projectName: project?.project_name ?? cycle.project_id,
          projectStatus: project?.status ?? null,
          baseClientAmountYen: 0,
          bufferYen: 0,
          baseCapYen: 0,
          extraPayoutYen: 0,
          budgetYen: 0,
          payoutYen: 0,
          officerPayoutYen: 0,
          officerOffsetYen: 0,
          finalBalanceYen: 0,
          cycles: [],
          memberLines: [],
        };

      const cycleKeyValue = `${cycle.project_id}:${cycle.ym}`;
      const nonOfficerEntries = nonOfficerByCycle.get(cycleKeyValue) ?? [];
      const officerEntries = officerByCycle.get(cycleKeyValue) ?? [];
      const payoutYen = nonOfficerEntries.reduce((sum, entry) => sum + entry.regularPaidYen, 0);
      const extraPayoutYen =
        nonOfficerEntries.reduce((sum, entry) => sum + entry.extraPaidYen, 0) +
        officerEntries.reduce((sum, entry) => sum + entry.extraPaidYen, 0);
      const officerPayoutYen = officerEntries.reduce((sum, entry) => sum + entry.regularPaidYen, 0);
      const officerOffsetYen = officerPayoutYen;
      const bufferYen = Math.round(numberValue(cycle.budget_buffer_amount));
      const baseClientAmountYen = baseClientAmountForCycle(cycle, project);
      const baseCapYen = baseCapYenFor(baseClientAmountYen, bufferYen);
      const budgetYen = baseCapYen;
      const finalBalanceYen = budgetYen - payoutYen - officerPayoutYen + officerOffsetYen;

      group.baseClientAmountYen += baseClientAmountYen;
      group.bufferYen += bufferYen;
      group.baseCapYen += baseCapYen;
      group.extraPayoutYen += extraPayoutYen;
      group.budgetYen += budgetYen;
      group.payoutYen += payoutYen;
      group.officerPayoutYen += officerPayoutYen;
      group.officerOffsetYen += officerOffsetYen;
      group.finalBalanceYen += finalBalanceYen;
      group.cycles.push({
        key: cycleKeyValue,
        ym: cycle.ym,
        invoiceYm: cycle.invoice_ym || cycle.ym,
        baseClientAmountYen,
        bufferYen,
        baseCapYen,
        extraPayoutYen,
        budgetYen,
        payoutYen,
        officerPayoutYen,
        officerOffsetYen,
        finalBalanceYen,
      });

      for (const entry of nonOfficerEntries) {
        if (entry.regularPaidYen <= 0) continue;
        group.memberLines.push({
          key: entryKey(entry),
          ym: entry.ym,
          invoiceYm: entry.invoiceYm,
          memberId: entry.memberId,
          memberName: entry.memberName,
          amountYen: entry.regularPaidYen,
          isOfficer: false,
          offsetYen: 0,
          netEffectYen: -entry.regularPaidYen,
        });
      }
      for (const entry of officerEntries) {
        if (entry.regularPaidYen <= 0) continue;
        group.memberLines.push({
          key: `officer:${entryKey(entry)}`,
          ym: entry.ym,
          invoiceYm: entry.invoiceYm,
          memberId: entry.memberId,
          memberName: entry.memberName,
          amountYen: entry.regularPaidYen,
          isOfficer: true,
          offsetYen: entry.regularPaidYen,
          netEffectYen: 0,
        });
      }

      map.set(cycle.project_id, group);
    }

    return [...map.values()]
      .map((group) => ({
        ...group,
        cycles: group.cycles.sort((a, b) => a.ym.localeCompare(b.ym)),
        memberLines: group.memberLines.sort((a, b) => {
          if (a.ym !== b.ym) return a.ym.localeCompare(b.ym);
          if (a.isOfficer !== b.isOfficer) return a.isOfficer ? 1 : -1;
          return a.memberName.localeCompare(b.memberName, "ja");
        }),
      }))
      .filter((group) => group.budgetYen > 0 || group.payoutYen > 0 || group.officerPayoutYen > 0 || group.baseClientAmountYen > 0)
      .sort((a, b) => a.projectName.localeCompare(b.projectName, "ja"));
  }, [data?.cycles, expectedEntries, officerReserveEntries, projectMap]);

  const forecastMonths = useMemo(() => data?.forecastMonths?.length ? data.forecastMonths : [ym], [data?.forecastMonths, ym]);
  const memberMonthlyPayoutEntries = useMemo(
    () => buildEntries(data?.forecastPaymentCycles ?? data?.forecastCycles ?? [], memberMap, payoutExcludedMemberIds, { projectMap }).filter((entry) => entry.totalPay > 0),
    [data?.forecastPaymentCycles, data?.forecastCycles, memberMap, payoutExcludedMemberIds, projectMap]
  );
  const memberMonthlyPayoutRows = useMemo(
    () => buildMemberMonthlyPayoutRows({
      months: forecastMonths,
      members: data?.members ?? [],
      entries: memberMonthlyPayoutEntries,
      projectMap,
    }),
    [data?.members, forecastMonths, memberMonthlyPayoutEntries, projectMap]
  );
  const projectMonthlyFinanceRows = useMemo(
    () => buildProjectMonthlyFinanceRows({
      months: forecastMonths,
      cycles: data?.forecastCycles ?? [],
      extraRevenueRows: data?.extraRevenueRows ?? [],
      projectMap,
      memberMap,
      payoutExcludedMemberIds,
      officerMemberIds,
      planCycles: data?.forecastPlanCycles ?? [],
      payoutEligibleProjectIds,
      forecastCapped: data?.forecastCapped ?? [],
    }),
    [data?.forecastCycles, data?.extraRevenueRows, data?.forecastPlanCycles, data?.forecastCapped, forecastMonths, memberMap, officerMemberIds, payoutEligibleProjectIds, payoutExcludedMemberIds, projectMap]
  );

  const rewardDebtLedgerRows = useMemo(
    () => buildRewardDebtLedgerRows({
      entries: expectedEntries,
      cycles: data?.cycles ?? [],
      projectMap,
    }),
    [data?.cycles, expectedEntries, projectMap]
  );

  const reimbursementsByMember = useMemo(() => data?.reimbursements ?? {}, [data?.reimbursements]);

  const memberRows = useMemo<MemberPayoutRow[]>(() => {
    const byMember = new Map<string, MemberPayoutRow>();
    for (const entry of expectedEntries) {
      const notice = noticeMap.get(entry.memberId) ?? null;
      const row =
        byMember.get(entry.memberId) ??
        {
          memberId: entry.memberId,
          memberName: entry.memberName,
          noticeExcluded: payoutExcludedMemberIds.has(entry.memberId),
          notice,
          noticeProfileStale: noticeIsOlderThanMemberProfile(notice, memberRecordMap.get(entry.memberId)),
          totalPay: 0,
          savedTotal: 0,
          regularBasePay: 0,
          extraBasePay: 0,
          regularPaidYen: 0,
          extraPaidYen: 0,
          carryInYen: 0,
          stockYen: 0,
          entries: [],
          reimbursements: [],
          reimbursementYen: 0,
          isSaved: true,
        };

      row.totalPay += entry.totalPay;
      row.regularBasePay += entry.regularBasePay;
      row.extraBasePay += entry.extraBasePay;
      row.regularPaidYen += entry.regularPaidYen;
      row.extraPaidYen += entry.extraPaidYen;
      row.carryInYen += entry.carryInYen;
      row.stockYen += entry.stockYen;
      row.entries.push(entry);
      const saved = payoutMap.get(entryKey(entry));
      if (saved) row.savedTotal += Math.round(numberValue(saved.total_pay));
      if (!saved || Math.round(numberValue(saved.total_pay)) !== entry.totalPay) row.isSaved = false;
      byMember.set(entry.memberId, row);
    }

    // 立替精算は報酬と別原資。報酬が 0 円の月でも、立替だけで支払対象になる
    for (const [memberId, rows] of Object.entries(reimbursementsByMember)) {
      if (rows.length === 0) continue;
      const existing = byMember.get(memberId);
      const target =
        existing ??
        {
          memberId,
          memberName: memberMap.get(memberId) ?? memberId,
          noticeExcluded: payoutExcludedMemberIds.has(memberId),
          notice: noticeMap.get(memberId) ?? null,
          noticeProfileStale: noticeIsOlderThanMemberProfile(noticeMap.get(memberId) ?? null, memberRecordMap.get(memberId)),
          totalPay: 0,
          savedTotal: 0,
          regularBasePay: 0,
          extraBasePay: 0,
          regularPaidYen: 0,
          extraPaidYen: 0,
          carryInYen: 0,
          stockYen: 0,
          entries: [],
          reimbursements: [],
          reimbursementYen: 0,
          isSaved: true,
        };
      target.reimbursements = rows;
      target.reimbursementYen = rows.reduce((sum, row) => sum + Math.round(numberValue(row.amountYen)), 0);
      byMember.set(memberId, target);
    }

    return [...byMember.values()].sort(
      (a, b) => b.totalPay + b.reimbursementYen - (a.totalPay + a.reimbursementYen)
    );
  }, [expectedEntries, memberMap, memberRecordMap, payoutExcludedMemberIds, noticeMap, payoutMap, reimbursementsByMember]);

  const grandTotal = memberRows.reduce((sum, row) => sum + row.totalPay, 0);
  const regularBaseTotal = memberRows.reduce((sum, row) => sum + row.regularBasePay, 0);
  const extraBaseTotal = memberRows.reduce((sum, row) => sum + row.extraBasePay, 0);
  const savedAll = expectedEntries.length > 0 && memberRows.every((row) => row.isSaved);
  const noticeTotalsByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of expectedEntries) {
      if (payoutExcludedMemberIds.has(entry.memberId)) continue;
      if (entry.totalPay <= 0) continue;
      map.set(entry.memberId, (map.get(entry.memberId) ?? 0) + entry.totalPay);
    }
    return map;
  }, [expectedEntries, payoutExcludedMemberIds]);
  const unsyncedNoticeCount = useMemo(() => {
    let count = 0;
    for (const [memberId, totalYen] of noticeTotalsByMember.entries()) {
      const notice = noticeMap.get(memberId);
      if (!notice || Math.round(numberValue(notice.total_yen)) !== Math.round(totalYen)) count += 1;
    }
    return count;
  }, [noticeMap, noticeTotalsByMember]);
  const syncedAll = savedAll && unsyncedNoticeCount === 0;
  const snapshotSyncNeeded = expectedEntries.length > 0 && !syncedAll;
  const unsyncedPayoutEntryCount = cycleStats.size > 0
    ? [...cycleStats.values()].reduce((sum, stats) => sum + Math.max(0, stats.expectedCount - stats.savedCount), 0)
    : 0;
  const rewardCycleCount = new Set(expectedEntries.map((entry) => `${entry.projectId}:${entry.ym}`)).size;
  const snapshotSyncBlocked = snapshotSyncNeeded && (hasBudgetBlocker || guardedActionDisabled);
  const snapshotSyncStatusTitle = hasBudgetBlocker
    ? "本契約cap未設定または超過があるため同期できない"
    : guardedActionTitle ??
      (snapshotSyncNeeded
        ? `表示中のDBスナップショット差分: 報酬明細 ${unsyncedPayoutEntryCount}件 / 通知額 ${unsyncedNoticeCount}件。発行・送付時は同期してから進む。画面は読み取りだけで定期更新する`
        : "最新計算額が monthly_reward_payout と payout_notices.total_yen に同期済み");
  const bulkPdfBaseDisabled =
    loading ||
    noticeSavingMemberId != null ||
    paymentNudgeSending ||
    bulkPdfMode != null ||
    memberRows.length === 0 ||
    guardedActionDisabled;
  const bulkIssueDisabled = bulkPdfBaseDisabled || hasBudgetBlocker;
  const saveAndIssueDisabled = bulkIssueDisabled;
  const bulkPreviewTitle = guardedActionTitle ?? "全員分の確認用PDFを並列生成 (DB保存なし・正式PDFは更新しない)";
  const bulkIssueTitle = guardedActionTitle ??
    (memberRows.length === 0
      ? "対象メンバーがいない"
      : snapshotSyncNeeded
        ? "最新計算額を同期してから全員分の支払通知書PDFを並列発行"
        : "全員分の支払通知書PDFを並列発行 (差分検出あり)");
  const saveAndIssueTitle = guardedActionTitle ??
    (memberRows.length === 0
      ? "対象メンバーがいない"
      : hasBudgetBlocker
        ? "本契約cap未設定または超過があるため発行できない"
        : "最新計算額を同期してから全員分の支払通知書PDFを一括発行する");
  const forceBulkIssueTitle = guardedActionTitle ??
    (memberRows.length === 0
      ? "対象メンバーがいない"
      : hasBudgetBlocker
        ? "本契約cap未設定または超過があるため発行できない"
        : syncedAll
        ? "差分検出を無視して全員分のPDFを強制再生成 (コードラベル変更などを反映する用)"
        : "最新計算額を同期してから全員分のPDFを強制再生成する");

  async function loadAgreementGateForYm(nextYm: string) {
    try {
      const params = new URLSearchParams({ ym: nextYm, gateOnly: "1" });
      const res = await fetch(`/api/admin/payouts?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        payoutAgreementGate?: PayoutAgreementGateSummary | null;
      };
      if (!res.ok || payload.ok === false) return;
      setData((current) =>
        current?.ym === nextYm
          ? { ...current, payoutAgreementGate: payload.payoutAgreementGate ?? null }
          : current
      );
    } catch {
      // Gate is enforced again on write actions, so a background view failure should not block initial display.
    }
  }

  async function loadForYm(nextYm: string, options: { refreshRewards?: boolean; silent?: boolean } = {}) {
    if (!options.silent) {
      setLoading(true);
      setHint(options.refreshRewards ? "報酬キャッシュを再計算中..." : "");
    }
    try {
      const params = new URLSearchParams({ ym: nextYm });
      if (options.refreshRewards) params.set("refreshRewards", "1");
      const res = await fetch(`/api/admin/payouts?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await res.json()) as (PayoutData & { ok?: boolean; error?: string });
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `load failed (${res.status})`);
      }
      setData(payload);
      void loadAgreementGateForYm(nextYm);
      if (!options.silent) setHint(payoutDataHint(nextYm, payload, Boolean(options.refreshRewards)));
    } catch (err) {
      if (!options.silent) {
        setData(null);
        setHint(err instanceof Error ? err.message : "読込エラー");
      }
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  function openPdfUrl(pdfUrl: string | null | undefined) {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }

  function openPdfPlaceholderWindow() {
    const popup = window.open("about:blank", "_blank");
    if (!popup) return null;
    try {
      popup.opener = null;
      popup.document.title = "支払通知書PDFを作成中";
      popup.document.body.innerHTML =
        '<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; color: #111827;">支払通知書PDFを作成中...</div>';
    } catch {
      // If document access is blocked, keep the tab and navigate it after generation.
    }
    return popup;
  }

  function showGeneratedPdf(pdfWindow: Window | null, pdfUrl: string) {
    if (pdfWindow && !pdfWindow.closed) {
      pdfWindow.location.href = pdfUrl;
      return;
    }
    openPdfUrl(pdfUrl);
  }

  function closePdfPlaceholder(pdfWindow: Window | null) {
    try {
      if (pdfWindow && !pdfWindow.closed) pdfWindow.close();
    } catch {
      // Ignore browser-specific popup close failures.
    }
  }

  async function issueNoticePdf(row: MemberPayoutRow, options: { forceReissue?: boolean } = {}) {
    if (row.notice?.pdf_url && !options.forceReissue) {
      openPdfUrl(row.notice.pdf_url);
      return;
    }

    const pdfWindow = openPdfPlaceholderWindow();
    setNoticeSavingMemberId(row.memberId);
    setHint("支払通知書PDFを発行中...");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_notice_pdf",
          ym,
          memberId: row.memberId,
          agreementOverrideReason: agreementOverrideReasonTrimmed || undefined,
        }),
      });
      const payload = (await res.json()) as (
        PayoutData & { ok?: boolean; error?: string; issuedNotice?: { pdfUrl?: string } }
      );
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `notice pdf failed (${res.status})`);
      }
      setData(payload);
      if (!payload.issuedNotice?.pdfUrl) {
        throw new Error("支払通知書PDFのURLが返ってこなかった");
      }
      showGeneratedPdf(pdfWindow, payload.issuedNotice.pdfUrl);
      setHint(`${row.memberName} の支払通知書PDFを発行した`);
    } catch (err) {
      closePdfPlaceholder(pdfWindow);
      setHint(err instanceof Error ? err.message : "支払通知書PDFの発行エラー");
    } finally {
      setNoticeSavingMemberId(null);
    }
  }

  async function updateNoticeSent(row: MemberPayoutRow, patch: NoticeSavePatch) {
    setNoticeSavingMemberId(row.memberId);
    setHint("支払通知書の送付状態を更新中...");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_notice",
          ym,
          memberId: row.memberId,
          totalYen: row.totalPay,
          agreementOverrideReason: agreementOverrideReasonTrimmed || undefined,
          ...patch,
        }),
      });
      const payload = (await res.json()) as (
        PayoutData & { ok?: boolean; error?: string; updatedNoticeMemberId?: string }
      );
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `notice save failed (${res.status})`);
      }
      setData(payload);
      setHint(`${row.memberName} の支払通知書ステータスを更新した`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "支払通知書ステータスの保存エラー");
    } finally {
      setNoticeSavingMemberId(null);
    }
  }

  async function openNoticeMailModal(row: MemberPayoutRow) {
    setNoticeMailLoading(true);
    setNoticeMailLoadingMemberId(row.memberId);
    setNoticeMailError(null);
    setHint("保存済みPDFとメール本文を確認中...");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_notice_email",
          ym,
          memberId: row.memberId,
          totalYen: row.totalPay,
          agreementOverrideReason: agreementOverrideReasonTrimmed || undefined,
        }),
      });
      const payload = (await res.json()) as PayoutData & { ok?: boolean; error?: string; preview?: NoticeMailPreview };
      if (!res.ok || payload.ok === false || !payload.preview) {
        throw new Error(payload.error || `保存済みPDFとメール本文の確認に失敗 (${res.status})`);
      }
      if (Array.isArray(payload.members) && Array.isArray(payload.notices)) {
        setData(payload);
      }
      setNoticeMailModal({
        row,
        preview: payload.preview,
        editedBody: payload.preview.body,
        editing: false,
      });
      setHint("");
    } catch (err) {
      setHint(err instanceof Error ? err.message : "保存済みPDFとメール本文の確認に失敗");
    } finally {
      setNoticeMailLoading(false);
      setNoticeMailLoadingMemberId(null);
    }
  }

  function closeNoticeMailModal() {
    if (noticeMailSending) return;
    setNoticeMailModal(null);
    setNoticeMailError(null);
  }

  async function sendNoticeMailNow() {
    if (!noticeMailModal) return;
    if (agreementBlockedMemberIds.has(noticeMailModal.row.memberId) && !canUseAgreementOverride) {
      const message = guardedActionTitle ?? "月初合意blockerがあるため送信できない";
      setNoticeMailError(message);
      setHint(message);
      return;
    }
    const { row, preview, editedBody } = noticeMailModal;
    setNoticeMailSending(true);
    setNoticeMailError(null);
    setHint(`${preview.memberName} にメール送信中...`);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_notice_email",
          ym,
          memberId: row.memberId,
          totalYen: row.totalPay,
          body: editedBody,
          agreementOverrideReason: agreementOverrideReasonTrimmed || undefined,
        }),
      });
      const payload = (await res.json()) as PayoutData & {
        ok?: boolean;
        error?: string;
        sentNoticeMail?: { memberName?: string; to?: string };
      };
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `メール送信に失敗 (${res.status})`);
      }
      setData(payload);
      setNoticeMailModal(null);
      setHint(`${preview.memberName} <${preview.to}> に支払通知メールを送信した`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "メール送信エラー";
      setNoticeMailError(message);
      setHint(message);
    } finally {
      setNoticeMailSending(false);
    }
  }

  async function saveThenRunBulkIssue(options: { force?: boolean } = {}) {
    await runBulkPdf(false, options);
  }

  async function sendPaymentNudges() {
    setPaymentNudgeSending(true);
    setHint("入金確認nudgeを送信中...");
    try {
      const res = await fetch("/api/cron/payment-confirm-nudges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ym }),
      });
      const payload = (await res.json()) as { ok?: boolean; sent?: number; groupCount?: number; targetCount?: number; error?: string; skipped?: string };
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `nudge failed (${res.status})`);
      }
      if (payload.skipped) {
        setHint(`入金確認nudgeは未送信: ${payload.skipped}`);
      } else {
        setHint(`入金確認nudge送信: ${payload.sent ?? 0}件 / 対象PJ ${payload.groupCount ?? 0} / admin ${payload.targetCount ?? 0}`);
      }
    } catch (err) {
      setHint(err instanceof Error ? err.message : "入金確認nudge送信エラー");
    } finally {
      setPaymentNudgeSending(false);
    }
  }

  async function runBulkPdf(previewOnly: boolean, options: { force?: boolean } = {}) {
    if (memberRows.length === 0) {
      setHint("対象メンバーがいない");
      return;
    }
    const mode = previewOnly ? "preview" : "issue";
    setBulkPdfMode(mode);
    setBulkPdfResult(null);
    setHint(
      `全員分の${previewOnly ? "確認用" : "本番"}PDFを生成中... (最大 ${memberRows.length} 人, 数分かかることあり)`
    );
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: previewOnly ? "bulk_preview_notice_pdf" : "bulk_issue_notice_pdf",
          ym,
          force: options.force === true,
          agreementOverrideReason: agreementOverrideReasonTrimmed || undefined,
        }),
      });
      const payload = (await res.json()) as PayoutData & {
        ok?: boolean;
        error?: string;
        bulkResult?: BulkNoticeSummary;
      };
      if (!res.ok || payload.ok === false) {
        if (payload.ym && payload.members && payload.projects && payload.cycles && payload.payouts && payload.notices) {
          setData(payload);
        }
        if (payload.bulkResult) setBulkPdfResult(payload.bulkResult);
        throw new Error(payload.error || `一括PDF生成失敗 (${res.status})`);
      }
      setData(payload);
      if (payload.bulkResult) setBulkPdfResult(payload.bulkResult);
      const summary = payload.bulkResult;
      if (summary) {
        setHint(
          `${previewOnly ? "確認用" : "本番"}PDF生成完了: 対象 ${summary.targetCount}人 / 生成 ${summary.generated} / 既存利用 ${summary.skipped} / 失敗 ${summary.failed}`
        );
      } else {
        setHint("一括PDF生成完了");
      }
    } catch (err) {
      setHint(err instanceof Error ? err.message : "一括PDF生成エラー");
    } finally {
      setBulkPdfMode(null);
    }
  }

  async function openMonthlyModal(projectId: string, targetYm: string, label: string) {
    setModalTarget({ projectId, ym: targetYm, label });
    setModalError(null);
    if (cockpitCache[projectId]) return;

    setModalLoading(true);
    try {
      const cockpit = await fetchCockpitFromSupabase(projectId);
      setCockpitCache((prev) => ({ ...prev, [projectId]: cockpit }));
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "月次モーダルを読み込めなかった");
    } finally {
      setModalLoading(false);
    }
  }

  function closeMonthlyModal() {
    const projectId = modalTarget?.projectId;
    setModalTarget(null);
    setModalError(null);
    if (projectId) {
      setCockpitCache((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    }
    void loadForYm(ym);
  }

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      void loadAgreementGateForYm(ym);
      return;
    }
    void loadForYm(ym);
  }, [ym]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (
        backgroundReloadingRef.current ||
        loading ||
        noticeSavingMemberId != null ||
        noticeMailLoading ||
        noticeMailSending ||
        paymentNudgeSending ||
        bulkPdfMode != null ||
        noticeMailModal != null ||
        modalTarget != null
      ) {
        return;
      }
      backgroundReloadingRef.current = true;
      void loadForYm(ym, { silent: true }).finally(() => {
        backgroundReloadingRef.current = false;
      });
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [
    bulkPdfMode,
    loading,
    modalTarget,
    noticeMailLoading,
    noticeMailModal,
    noticeMailSending,
    noticeSavingMemberId,
    paymentNudgeSending,
    ym,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">支払月</span>
          <select
            value={ym}
            onChange={(event) => setYm(event.target.value)}
            disabled={loading || noticeSavingMemberId != null}
            className="h-9 rounded-md border border-border bg-background px-2 text-[12px] font-mono"
          >
            {ymOptions.map((option) => (
              <option key={option} value={option}>
                {fmtYm(option)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => loadForYm(ym)}
          disabled={loading || noticeSavingMemberId != null}
          className="h-9 rounded-md border border-border bg-background px-3 text-[12px] hover:bg-muted/40 disabled:opacity-50"
        >
          {loading ? "読込中..." : "再読込"}
        </button>

        <button
          type="button"
          onClick={() => loadForYm(ym, { refreshRewards: true })}
          disabled={loading || noticeSavingMemberId != null}
          title="billing_cycles.reward_summary_json を再計算してキャッシュを更新する"
          className="h-9 rounded-md border border-border bg-background px-3 text-[12px] hover:bg-muted/40 disabled:opacity-50"
        >
          報酬キャッシュ再計算
        </button>

        {snapshotSyncBlocked && (
          <span
            title={snapshotSyncStatusTitle}
            className="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 text-[12px] font-medium text-red-800"
          >
            同期できない
          </span>
        )}

        <button
          type="button"
          onClick={sendPaymentNudges}
          disabled={loading || noticeSavingMemberId != null || paymentNudgeSending || bulkPdfMode != null}
          className="h-9 rounded-md border border-border bg-background px-3 text-[12px] hover:bg-muted/40 disabled:opacity-50"
        >
          {paymentNudgeSending ? "nudge送信中..." : "入金確認nudge"}
        </button>

        <button
          type="button"
          onClick={() => saveThenRunBulkIssue()}
          disabled={saveAndIssueDisabled}
          title={saveAndIssueTitle}
          className="h-9 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-[12px] text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
        >
          {bulkPdfMode === "issue" ? "本番PDF発行中..." : "全員分PDF一括発行"}
        </button>

        <button
          type="button"
          onClick={() => runBulkPdf(true)}
          disabled={bulkPdfBaseDisabled}
          title={bulkPreviewTitle}
          className="h-9 rounded-md border border-border bg-background px-3 text-[12px] hover:bg-muted/40 disabled:opacity-50"
        >
          {bulkPdfMode === "preview" ? "確認用PDF生成中..." : "確認用PDF生成"}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!window.confirm("全員分の支払通知書PDFを、最新DBの住所・宛名・登録番号で強制再生成する (= 差分検出を無視)。\n金額が変わってなくてもメンバー台帳の修正やラベル変更を反映したい時用。\n進める?")) return;
            void saveThenRunBulkIssue({ force: true });
          }}
          disabled={saveAndIssueDisabled}
          title={forceBulkIssueTitle}
          className="h-9 rounded-md border border-amber-300 bg-amber-50 px-3 text-[12px] text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {bulkPdfMode === "issue" ? "強制再発行中..." : "強制再発行 (全員)"}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-[12px]">
          <span className="text-muted-foreground">{hint}</span>
          <span className="font-semibold">合計 {fmtYen(grandTotal)}</span>
        </div>
      </div>

      {bulkPdfResult && bulkPdfResult.failed > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-900">
          <div className="font-semibold">一括PDF生成で失敗があった ({bulkPdfResult.failed}件):</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {bulkPdfResult.results
              .filter((r) => r.status === "failed")
              .slice(0, 8)
              .map((r) => {
                const member = data?.members.find((m) => m.member_id === r.memberId);
                const name = member?.code_name || member?.member_name || r.memberId;
                return (
                  <li key={r.memberId}>
                    <span className="font-medium">{name}</span>{" "}
                    <span className="text-red-800/80">({r.reason ?? "?"})</span>{" "}
                    <span className="text-red-800/60">{r.error}</span>
                  </li>
                );
              })}
            {bulkPdfResult.results.filter((r) => r.status === "failed").length > 8 && (
              <li className="text-red-800/70">…他 {bulkPdfResult.results.filter((r) => r.status === "failed").length - 8} 件</li>
            )}
          </ul>
        </div>
      )}

      <PayoutAgreementGatePanel
        gate={agreementGate}
        overrideReason={agreementOverrideReason}
        onOverrideReasonChange={setAgreementOverrideReason}
      />

      <div className="grid gap-2 md:grid-cols-6">
        <SummaryBox label="対象cycle" value={`${data?.cycles.length ?? 0}件`} sub={`${rewardCycleCount}件に報酬明細あり`} />
        <SummaryBox label="報酬明細" value={`${expectedEntries.length}件`} sub="税抜ベース" />
        <SummaryBox label="支払メンバー" value={`${memberRows.length}人`} sub={`通知額 ${data?.notices.length ?? 0}件`} />
        <SummaryBox label="本契約発生" value={fmtYen(regularBaseTotal)} sub="regular MS" />
        <SummaryBox label="別財布発生" value={fmtYen(extraBaseTotal)} sub="cap_extra MS" />
        <SummaryBox label="支払総額" value={fmtYen(grandTotal)} sub={`支払月 ${fmtYm(ym)}`} />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold">メンバー別支払</h2>
            <span className="text-[11px] text-muted-foreground">
              支払額は税抜をDB保存し、支払通知書PDFで消費税10%を上乗せ
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {snapshotSyncBlocked && (
              <span
                title={snapshotSyncStatusTitle}
                className="inline-flex h-8 items-center rounded-md border border-red-200 bg-red-50 px-2.5 text-[11px] font-medium text-red-800"
              >
                同期できない
              </span>
            )}
            <button
              type="button"
              onClick={() => saveThenRunBulkIssue()}
              disabled={saveAndIssueDisabled}
              title={saveAndIssueTitle}
              className="h-8 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
            >
              {bulkPdfMode === "issue" ? "発行中..." : "全員分PDF一括発行"}
            </button>
            <button
              type="button"
              onClick={() => runBulkPdf(true)}
              disabled={bulkPdfBaseDisabled}
              title={bulkPreviewTitle}
              className="h-8 rounded-md border border-border bg-background px-3 text-[11px] hover:bg-muted/40 disabled:opacity-50"
            >
              {bulkPdfMode === "preview" ? "確認用生成中..." : "確認用PDF生成"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("全員分の支払通知書PDFを、最新DBの住所・宛名・登録番号で強制再生成する (= 差分検出を無視)。\n金額が変わってなくてもメンバー台帳の修正やラベル変更を反映したい時用。\n進める?")) return;
                void saveThenRunBulkIssue({ force: true });
              }}
              disabled={saveAndIssueDisabled}
              title={forceBulkIssueTitle}
              className="h-8 rounded-md border border-amber-300 bg-amber-50 px-3 text-[11px] text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {bulkPdfMode === "issue" ? "再発行中..." : "強制再発行"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-border bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">バックグラウンド同期:</span>{" "}
            夜間の先回り生成で最新計算額を税抜同期し、正式PDFまで作成。画面を開くだけでは保存しない。
          </span>
          <span>
            <span className="font-medium text-foreground">一括発行:</span>{" "}
            全員分の正式PDFを作成し、通知番号とPDF URLを保存。送付は別操作。
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">メンバー</th>
                <th className="px-3 py-2 text-left font-medium">内訳</th>
                <th className="px-3 py-2 text-right font-medium">保存済</th>
                <th className="px-3 py-2 text-right font-medium">
                  <span className="block">支払額</span>
                  <span className="block text-[10px] font-normal text-muted-foreground">税抜 / 税込</span>
                </th>
                <th className="px-3 py-2 text-left font-medium">通知</th>
                <th className="px-3 py-2 text-right font-medium">支払通知書</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {memberRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    この支払月のメンバー支払予定はまだ出ていない。対象cycleがあるのに空なら、報酬キャッシュ再計算を実行してね。
                  </td>
                </tr>
              ) : (
                memberRows.map((row) => (
                  <tr key={row.memberId} className="align-top hover:bg-muted/20">
                      <td className="px-3 py-2">
                          <div className="font-semibold">{row.memberName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{row.memberId}</div>
                          {(row.regularBasePay > 0 || row.extraBasePay > 0) && (
                            <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                              {row.regularBasePay > 0 && <span className="rounded bg-emerald-100 px-1 text-emerald-800">本契約 {fmtYen(row.regularBasePay)}</span>}
                              {row.extraBasePay > 0 && <span className="rounded bg-indigo-100 px-1 text-indigo-800">別財布 {fmtYen(row.extraBasePay)}</span>}
                            </div>
                          )}
                        {row.reimbursementYen > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                            <span
                              className="rounded bg-violet-100 px-1 text-violet-800"
                              title={row.reimbursements
                                .map((item) => `${item.date ?? ""} ${item.projectName ?? item.projectId ?? ""} ${fmtFlowYen(item.amountYen)}`)
                                .join("\n")}
                            >
                              立替 {fmtYen(row.reimbursementYen)}
                            </span>
                          </div>
                        )}
                        {(row.stockYen > 0 || row.carryInYen > 0) && (
                            <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                            {row.carryInYen > 0 && <span className="rounded bg-sky-100 px-1 text-sky-800">繰越入 {fmtYen(row.carryInYen)}</span>}
                            {row.stockYen > 0 && <span className="rounded bg-amber-100 px-1 text-amber-900">未払い残 {fmtYen(row.stockYen)}</span>}
                          </div>
                        )}
                      </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        {row.reimbursements.map((item) => (
                          <div
                            key={item.reimbursementId}
                            className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded px-1 py-0.5 text-[11px] text-violet-800"
                          >
                            <span className="rounded bg-violet-100 px-1 text-[10px]">立替精算</span>
                            <span className="font-medium">{item.projectName ?? item.projectId ?? "-"}</span>
                            <span className="font-mono text-muted-foreground">{item.date ?? ""}</span>
                            <span className="text-muted-foreground">{(item.description ?? item.category ?? "").slice(0, 28)}</span>
                            <span className="font-medium">実費 {fmtYen(item.amountYen)}</span>
                          </div>
                        ))}
                        {row.entries.map((entry) => {
                          const project = projectMap.get(entry.projectId);
                          return (
                            <button
                              type="button"
                              key={entryKey(entry)}
                              onClick={() =>
                                setBreakdownTarget({
                                  projectId: entry.projectId,
                                  ym: entry.ym,
                                  memberId: entry.memberId,
                                  label: `${row.memberName} / ${project?.project_name ?? entry.projectId} / ${fmtYm(entry.ym)} 稼働分`,
                                })
                              }
                              className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                            >
                              <span className="font-medium">{project?.project_name ?? entry.projectId}</span>
                                <span className="font-mono text-muted-foreground">{fmtYm(entry.ym)}</span>
                                <span className="text-muted-foreground">{fmtPt(entry.earnedPt)}</span>
                                  <span className="text-muted-foreground">base {fmtYen(entry.basePay)}</span>
                                  {entry.regularBasePay > 0 ? (
                                    <span className="text-emerald-700">本契約 {fmtYen(entry.regularBasePay)}</span>
                                  ) : null}
                                  {entry.extraBasePay > 0 ? (
                                    <span className="text-indigo-700">別財布 {fmtYen(entry.extraBasePay)}</span>
                                  ) : null}
                                  {entry.bonusPt > 0 ? (
                                    <span className="text-muted-foreground">bonus {fmtYen(entry.bonusPt)}</span>
                                ) : null}
                                {entry.payoutAmountOverride ? (
                                  <span
                                    className="rounded border border-sky-200 bg-sky-50 px-1 text-sky-900"
                                    title={`${entry.payoutAmountOverride.reason} / 承認: ${entry.payoutAmountOverride.authorizedBy}`}
                                  >
                                    事前合意額：通常 {fmtFlowYen(entry.payoutAmountOverride.calculatedTotalPayYen)} → 固定 {fmtFlowYen(entry.payoutAmountOverride.amountYen)}
                                  </span>
                                ) : null}
                                {entry.carryInYen > 0 ? (
                                  <span className="text-sky-700">繰越 {fmtYen(entry.carryInYen)}</span>
                                ) : null}
                                  <span className="font-medium">支払 税抜 {fmtYen(entry.totalPay)}</span>
                              <span className="text-muted-foreground">税込 {fmtTaxIncludedYen(entry.totalPay)}</span>
                                {entry.stockYen > 0 ? (
                                  <span className="text-amber-700">未払い残 {fmtYen(entry.stockYen)}</span>
                                ) : null}
                                {entry.grossDueYen > entry.totalPay ? (
                                  <span className="text-muted-foreground">発生+繰越 {fmtYen(entry.grossDueYen)}</span>
                                ) : null}
                              </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className={row.isSaved ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                        税抜 {fmtYen(row.savedTotal)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">税込 {fmtTaxIncludedYen(row.savedTotal)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-semibold">税抜 {fmtYen(row.totalPay)}</div>
                      <div className="text-[10px] text-muted-foreground">税込 {fmtTaxIncludedYen(row.totalPay)}</div>
                      {row.reimbursementYen > 0 && (
                        <>
                          <div className="text-[10px] text-violet-700">＋立替 {fmtYen(row.reimbursementYen)}</div>
                          <div className="text-[11px] font-semibold">
                            支払 {fmtFlowYen(Math.round(row.totalPay * 1.1) + row.reimbursementYen)}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <NoticeBadge
                        notice={row.notice}
                        expectedTotal={row.totalPay}
                        excluded={row.noticeExcluded}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <PayoutNoticeActions
                        row={row}
                        disabled={
                          loading ||
                          noticeSavingMemberId != null ||
                          noticeMailSending ||
                          hasBudgetBlocker ||
                          (agreementBlockedMemberIds.has(row.memberId) && !canUseAgreementOverride)
                        }
                        issuing={noticeSavingMemberId === row.memberId}
                        sendPreparing={noticeMailLoadingMemberId === row.memberId}
                        onIssueNoticePdf={issueNoticePdf}
                        onOpenPdf={openPdfUrl}
                        onUpdateNoticeSent={updateNoticeSent}
                        onOpenSendMailModal={openNoticeMailModal}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <RewardDebtLedgerPanel
        rows={rewardDebtLedgerRows}
        paymentYm={ym}
        onOpenMonthly={(row) => openMonthlyModal(row.projectId, row.ym, `${row.projectName} ${fmtYm(row.ym)}`)}
      />

      <BudgetAuditPanel
        items={budgetAuditItems}
        totals={budgetAuditTotals}
        financeGroups={projectFinanceGroups}
        onOpenMonthly={(item) => openMonthlyModal(item.projectId, item.ym, `${item.projectName} ${fmtYm(item.ym)}`)}
      />

      <ProjectMonthlyFinanceTable
        months={forecastMonths}
        rows={projectMonthlyFinanceRows}
        onOpenMonthly={(cell) => openMonthlyModal(cell.projectId, cell.ym, `${cell.projectName} ${fmtYm(cell.ym)}`)}
      />

      <MemberMonthlyPayoutMatrix
        months={forecastMonths}
        rows={memberMonthlyPayoutRows}
        selected={selectedMemberMonthlyPayout}
        onSelect={setSelectedMemberMonthlyPayout}
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">対象の請求・報酬cycle</h2>
          <span className="text-[11px] text-muted-foreground">
            支払月はPJ台帳の支払条件から自動判定。クライアント請求月はここでは使わない
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">PJ</th>
                <th className="px-3 py-2 text-left font-medium">稼働月</th>
                <th className="px-3 py-2 text-left font-medium">支払月</th>
                <th className="px-3 py-2 text-left font-medium">status</th>
                <th className="px-3 py-2 text-right font-medium">報酬額</th>
                <th className="px-3 py-2 text-right font-medium">保存</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.cycles ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    この支払月に紐づくcycleがない
                  </td>
                </tr>
              ) : (
                  (data?.cycles ?? []).map((cycle) => {
                    const project = projectMap.get(cycle.project_id);
                    const stats = cycleStats.get(`${cycle.project_id}:${cycle.ym}`);
                    const regularCapYen = baseCapYenFor(
                      baseClientAmountForCycle(cycle, project),
                      Math.round(numberValue(cycle.budget_buffer_amount))
                    );
                    const status = cycle.status ?? "unknown";
                  const statusClass =
                    BC_STATUS_COLOR[status] ?? "border-zinc-200 bg-zinc-50 text-zinc-500";
                  return (
                    <tr
                      key={`${cycle.project_id}:${cycle.ym}`}
                      className="cursor-pointer hover:bg-muted/20"
                      onClick={() => openMonthlyModal(cycle.project_id, cycle.ym, `${project?.project_name ?? cycle.project_id} ${fmtYm(cycle.ym)}`)}
                    >
                      <td className="px-3 py-2 font-medium">{project?.project_name ?? cycle.project_id}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{fmtYm(cycle.ym)}</td>
                      <td className="px-3 py-2 font-mono">{fmtYm(cycle.invoice_ym || cycle.ym)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] ${statusClass}`}>
                          {BC_STATUS_LABEL[status] ?? status}
                        </span>
                      </td>
                          <td className="px-3 py-2 text-right font-medium">
                            <div>{fmtYen(stats?.totalPay ?? 0)}</div>
                            {(stats?.regularBasePay ?? 0) > 0 && (
                              <div className="text-[10px] font-normal text-emerald-700">
                                本契約 {fmtYen(stats?.regularBasePay)} / cap {fmtYen(regularCapYen)}
                              </div>
                            )}
                            {(stats?.extraBasePay ?? 0) > 0 && (
                              <div className="text-[10px] font-normal text-indigo-700">
                                別財布 {fmtYen(stats?.extraBasePay)}
                              </div>
                            )}
                            {(stats?.stockYen ?? 0) > 0 && (
                              <div className="text-[10px] font-normal text-amber-700">
                              未払い残 {fmtYen(stats?.stockYen)}
                            </div>
                          )}
                          {(stats?.carryInYen ?? 0) > 0 && (
                            <div className="text-[10px] font-normal text-sky-700">
                              繰越入 {fmtYen(stats?.carryInYen)}
                            </div>
                          )}
                        </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {stats ? `${stats.savedCount}/${stats.expectedCount}` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalTarget && modalLoading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-[12px] shadow-lg">
            {modalTarget.label} を読み込み中...
          </div>
        </div>
      )}

      {modalTarget && modalError && !modalLoading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="w-[min(420px,90vw)] rounded-lg border border-border bg-background p-4 text-[12px] shadow-lg">
            <div className="font-semibold">月次モーダルを開けなかった</div>
            <div className="mt-2 text-muted-foreground">{modalError}</div>
            <button
              type="button"
              onClick={closeMonthlyModal}
              className="mt-4 rounded-md border border-border px-3 py-1.5 hover:bg-muted/40"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {modalTarget && cockpitCache[modalTarget.projectId] && !modalLoading && !modalError && (
        <PayoutMonthlyModal
          key={`${modalTarget.projectId}:${modalTarget.ym}`}
          cockpit={cockpitCache[modalTarget.projectId]}
          ym={modalTarget.ym}
          onClose={closeMonthlyModal}
        />
      )}

      {breakdownTarget && (
        <MemberPayoutBreakdownModal
          key={`${breakdownTarget.projectId}:${breakdownTarget.ym}:${breakdownTarget.memberId}`}
          projectId={breakdownTarget.projectId}
          ym={breakdownTarget.ym}
          memberId={breakdownTarget.memberId}
          fallbackLabel={breakdownTarget.label}
          onClose={() => setBreakdownTarget(null)}
          onOpenMsProgress={() => {
            const target = breakdownTarget;
            setBreakdownTarget(null);
            void openMonthlyModal(
              target.projectId,
              target.ym,
              `${projectMap.get(target.projectId)?.project_name ?? target.projectId} ${fmtYm(target.ym)}`
            );
          }}
        />
      )}

      {noticeMailModal && (
        <PayoutNoticeMailModal
          state={noticeMailModal}
          sending={noticeMailSending}
          error={noticeMailError}
          onToggleEditing={() =>
            setNoticeMailModal((prev) => (prev ? { ...prev, editing: !prev.editing } : prev))
          }
          onBodyChange={(value) =>
            setNoticeMailModal((prev) => (prev ? { ...prev, editedBody: value } : prev))
          }
          onResetBody={() =>
            setNoticeMailModal((prev) => (prev ? { ...prev, editedBody: prev.preview.body } : prev))
          }
          onSend={sendNoticeMailNow}
          onClose={closeNoticeMailModal}
        />
      )}
    </div>
  );
}

function PayoutAgreementGatePanel({
  gate,
  overrideReason,
  onOverrideReasonChange,
}: {
  gate: PayoutAgreementGateSummary | null;
  overrideReason: string;
  onOverrideReasonChange: (value: string) => void;
}) {
  if (!gate || gate.totalTargets === 0) return null;
  const blockers = gate.blockers ?? [];
  const blocked = blockers.length > 0;
  const tone = blocked ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50";
  const textTone = blocked ? "text-red-950" : "text-emerald-950";
  const requiredRows = gate.rows.filter((row) => row.required);
  const migrationBypassOnly = !blocked && requiredRows.length > 0 && requiredRows.every((row) => row.migrationBypass);
  const shownRows = migrationBypassOnly ? [] : blocked ? blockers : requiredRows.slice(0, 6);

  return (
    <section className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h2 className={`text-[13px] font-semibold ${textTone}`}>月初合意支払ゲート</h2>
          {migrationBypassOnly ? (
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span>対象支払行 {requiredRows.length}</span>
              <span>移行月スキップ {requiredRows.length}</span>
              <span>blocker 0</span>
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span>required {gate.requiredCount}</span>
              <span>agreed {gate.agreedCount}</span>
              <span>not required {gate.notRequiredCount}</span>
              <span>blocker {gate.blockedCount}</span>
            </div>
          )}
        </div>
        <span className={`ml-auto rounded border px-2 py-1 text-[11px] ${blocked ? "border-red-300 bg-background text-red-800" : "border-emerald-300 bg-background text-emerald-800"}`}>
          {blocked ? "支払停止" : "支払可能"}
        </span>
      </div>

      {migrationBypassOnly && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-background/70 px-2 py-2 text-[11px] text-emerald-900">
          2026/06以前の稼働分は導入前/移行月として支払可能。対象支払行 {requiredRows.length} 件をまとめてスキップ中。
        </div>
      )}

      {shownRows.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-md border border-background/70 bg-background/80">
          <table className="w-full text-[11px]">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">member</th>
                <th className="px-2 py-1.5 text-left font-medium">PJ</th>
                <th className="px-2 py-1.5 text-left font-medium">稼働月</th>
                <th className="px-2 py-1.5 text-left font-medium">status</th>
                <th className="px-2 py-1.5 text-left font-medium">reason</th>
                <th className="px-2 py-1.5 text-right font-medium">
                  <span className="block">支払額</span>
                  <span className="block text-[10px] font-normal text-muted-foreground">税抜 / 税込</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {shownRows.slice(0, 12).map((row) => (
                <tr key={row.key}>
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{row.memberName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{row.memberId}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{row.projectName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{row.projectId}</div>
                  </td>
                  <td className="px-2 py-1.5 font-mono">{fmtYm(row.sourceYm)}</td>
                  <td className="px-2 py-1.5">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${PAYOUT_AGREEMENT_STATUS_CLASS[row.status]}`}>
                      {PAYOUT_AGREEMENT_STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{row.reason}</td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="font-medium">税抜 {fmtYen(row.totalPay)}</div>
                    <div className="text-[10px] text-muted-foreground">税込 {fmtTaxIncludedYen(row.totalPay)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shownRows.length > 12 && (
            <div className="border-t border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground">
              他 {shownRows.length - 12} 件
            </div>
          )}
        </div>
      )}

      {blocked && (
        <label className="mt-3 block space-y-1">
          <span className="text-[11px] font-medium text-red-950">admin override reason</span>
          <textarea
            value={overrideReason}
            onChange={(event) => onOverrideReasonChange(event.target.value)}
            rows={2}
            placeholder="例: 契約改定前の移行月として、本人Slack確認済み。"
            className="w-full rounded-md border border-red-200 bg-background px-2 py-1.5 text-[12px] outline-none focus:border-red-400"
          />
          <span className="block text-[10px] text-red-900/70">
            override は server-side で actor / reason / member / PJ / 支払月 / 稼働月を監査ログに残す。
          </span>
        </label>
      )}
    </section>
  );
}

function RewardDebtLedgerPanel({
  rows,
  paymentYm,
  onOpenMonthly,
}: {
  rows: RewardDebtLedgerRow[];
  paymentYm: string;
  onOpenMonthly: (row: RewardDebtLedgerRow) => void;
}) {
  const totals = useMemo(() => {
    const flowTotals = rows.reduce(
      (acc, row) => ({
        carryInYen: acc.carryInYen + row.carryInYen,
        accruedYen: acc.accruedYen + row.accruedYen,
        paidYen: acc.paidYen + row.paidYen,
        preContractYen: acc.preContractYen + (row.source === "pre_contract" ? row.accruedYen : 0),
      }),
      { carryInYen: 0, accruedYen: 0, paidYen: 0, preContractYen: 0 }
    );
    const latestBalanceByMemberProject = new Map<string, RewardDebtLedgerRow>();
    for (const row of rows) {
      const key = `${row.projectId}:${row.memberId}`;
      const current = latestBalanceByMemberProject.get(key);
      if (!current || row.ym > current.ym) latestBalanceByMemberProject.set(key, row);
    }
    const endingStockYen = [...latestBalanceByMemberProject.values()].reduce(
      (sum, row) => sum + row.endingStockYen,
      0
    );
    return { ...flowTotals, endingStockYen };
  }, [rows]);

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold">報酬債務台帳</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            前月残 + 今月発生 - 今月支払 = 月末未払い残。未払い残は支払額ではなく、まだ払っていない残高。
          </p>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2 text-[11px]">
          <span className="rounded bg-muted/50 px-2 py-1">支払月 {fmtYm(paymentYm)}</span>
          <span className="rounded bg-sky-50 px-2 py-1 text-sky-900">前月残 {fmtSignedYen(totals.carryInYen)}</span>
          <span className="rounded bg-muted/50 px-2 py-1">今月発生 {fmtSignedYen(totals.accruedYen)}</span>
          <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">今月支払 {fmtSignedYen(totals.paidYen)}</span>
          <span className="rounded bg-amber-50 px-2 py-1 text-amber-900">月末未払い残 {fmtSignedYen(totals.endingStockYen)}</span>
          {totals.preContractYen > 0 && (
            <span className="rounded bg-amber-100 px-2 py-1 text-amber-950">契約前発生 {fmtSignedYen(totals.preContractYen)}</span>
          )}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-border bg-background">
        <table className="min-w-[1120px] w-full text-[12px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">原因</th>
              <th className="px-3 py-2 text-left font-medium">PJ / 稼働月</th>
              <th className="px-3 py-2 text-left font-medium">メンバー</th>
              <th className="px-3 py-2 text-right font-medium">式</th>
              <th className="px-3 py-2 text-right font-medium">月末未払い残</th>
              <th className="px-3 py-2 text-left font-medium">読むポイント</th>
              <th className="px-3 py-2 text-right font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  未払い残・繰越はない
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="align-top hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${row.sourceClassName}`}>
                      {row.sourceLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.projectName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {row.projectId} / {fmtYm(row.ym)} 稼働
                    </div>
                    {row.projectStartYm && (
                      <div className="text-[10px] text-muted-foreground">契約開始 {fmtYm(row.projectStartYm)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.memberName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{row.memberId}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-mono text-[11px] tabular-nums">
                      {fmtSignedYen(row.carryInYen)} + {fmtSignedYen(row.accruedYen)} - {fmtSignedYen(row.paidYen)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.pool === "cap_extra"
                        ? `別財布gross ${fmtSignedYen(row.grossDueYen)} / 別財布cap ${row.budgetYen > 0 ? fmtSignedYen(row.budgetYen) : "0 (繰越中)"}`
                        : `gross ${fmtSignedYen(row.grossDueYen)} / cap ${fmtSignedYen(row.budgetYen)}`}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-semibold tabular-nums text-amber-800">{fmtSignedYen(row.endingStockYen)}</div>
                    <div className="text-[10px] text-muted-foreground">支払月 {fmtYm(row.invoiceYm)}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <div className="max-w-[320px]">{row.note}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenMonthly(row)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    >
                      月次詳細
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BudgetAuditPanel({
  items,
  totals,
  financeGroups,
  onOpenMonthly,
}: {
  items: BudgetAuditItem[];
  totals: { budgetYen: number; payoutYen: number; overYen: number; missingBudgetCount: number; unpaidCount: number };
  financeGroups: ProjectFinanceGroup[];
  onOpenMonthly: (item: BudgetAuditItem) => void;
}) {
  const financeTotals = useMemo(() => {
    return financeGroups.reduce(
      (acc, group) => ({
        baseClientAmountYen: acc.baseClientAmountYen + group.baseClientAmountYen,
        bufferYen: acc.bufferYen + group.bufferYen,
        baseCapYen: acc.baseCapYen + group.baseCapYen,
        extraPayoutYen: acc.extraPayoutYen + group.extraPayoutYen,
        budgetYen: acc.budgetYen + group.budgetYen,
        payoutYen: acc.payoutYen + group.payoutYen,
        officerPayoutYen: acc.officerPayoutYen + group.officerPayoutYen,
        officerOffsetYen: acc.officerOffsetYen + group.officerOffsetYen,
        finalBalanceYen: acc.finalBalanceYen + group.finalBalanceYen,
      }),
      { baseClientAmountYen: 0, bufferYen: 0, baseCapYen: 0, extraPayoutYen: 0, budgetYen: 0, payoutYen: 0, officerPayoutYen: 0, officerOffsetYen: 0, finalBalanceYen: 0 }
    );
  }, [financeGroups]);
  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);
  const overallOver = financeTotals.finalBalanceYen < 0 || totals.overYen > 0;
  const overallTone = overallOver || totals.missingBudgetCount > 0 || totals.unpaidCount > 0
    ? "border-amber-300 bg-amber-50"
    : "border-emerald-300 bg-emerald-50";
  const overallText =
    financeTotals.finalBalanceYen < 0
      ? `不足 ${fmtYen(Math.abs(financeTotals.finalBalanceYen))}`
      : `本契約残り ${fmtYen(financeTotals.finalBalanceYen)}`;
  const financeColumns = useMemo(
    () => [
      { key: "overall", label: "全体収支", subLabel: `${financeGroups.length} PJ`, group: null as ProjectFinanceGroup | null },
      ...financeGroups.map((group) => ({
        key: group.projectId,
        label: group.projectName,
        subLabel: group.projectId,
        group,
      })),
    ],
    [financeGroups]
  );
  const allCycleYms = useMemo(
    () => [...new Set(financeGroups.flatMap((group) => group.cycles.map((cycle) => cycle.ym)))].sort(),
    [financeGroups]
  );
  const memberRows = useMemo(() => {
    const map = new Map<string, { key: string; memberId: string; memberName: string; isOfficer: boolean }>();
    for (const group of financeGroups) {
      for (const line of group.memberLines) {
        const key = `${line.memberId}:${line.isOfficer ? "officer" : "pay"}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            memberId: line.memberId,
            memberName: line.memberName,
            isOfficer: line.isOfficer,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.isOfficer !== b.isOfficer) return a.isOfficer ? 1 : -1;
      return a.memberName.localeCompare(b.memberName, "ja");
    });
  }, [financeGroups]);

  const columnMoney = (
    group: ProjectFinanceGroup | null,
    key: "baseClientAmountYen" | "bufferYen" | "baseCapYen" | "extraPayoutYen" | "budgetYen" | "payoutYen" | "officerPayoutYen" | "officerOffsetYen" | "finalBalanceYen"
  ) => (group ? group[key] : financeTotals[key]);
  const memberColumnAmount = (group: ProjectFinanceGroup | null, row: { memberId: string; isOfficer: boolean }) => {
    const lines = group ? group.memberLines : financeGroups.flatMap((item) => item.memberLines);
    return lines
      .filter((line) => line.memberId === row.memberId && line.isOfficer === row.isOfficer)
      .reduce((sum, line) => sum + line.amountYen, 0);
  };
  const columnCycles = (group: ProjectFinanceGroup | null) => group?.cycles ?? financeGroups.flatMap((item) => item.cycles);
  const columnHasMissingBudget = (group: ProjectFinanceGroup | null) =>
    columnCycles(group).some((cycle) => cycle.budgetYen <= 0 && (cycle.payoutYen > 0 || cycle.officerPayoutYen > 0));
  const columnStockYen = (group: ProjectFinanceGroup | null) =>
    columnCycles(group).reduce((sum, cycle) => sum + (itemByKey.get(cycle.key)?.stockYen ?? 0), 0);
  const columnIsOver = (group: ProjectFinanceGroup | null) => columnMoney(group, "finalBalanceYen") < 0;
  const columnBadge = (group: ProjectFinanceGroup | null) => {
    const missing = columnHasMissingBudget(group);
    const stockYen = columnStockYen(group);
    const over = columnIsOver(group);
    if (missing) return { label: "本契約cap未設定", className: "bg-red-100 text-red-800" };
    if (over) return { label: `不足 ${fmtYen(Math.abs(columnMoney(group, "finalBalanceYen")))}`, className: "bg-red-100 text-red-800" };
    if (stockYen > 0) return { label: `未払い残 ${fmtYen(stockYen)}`, className: "bg-amber-100 text-amber-800" };
    return { label: `OK ${fmtYen(columnMoney(group, "finalBalanceYen"))}`, className: "bg-emerald-100 text-emerald-800" };
  };

  return (
    <section className={`rounded-lg border ${overallTone} p-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-[13px] font-semibold">本契約capチェック</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            65%対象委託料、バッファ、本契約cap、本契約支払、役員分の相殺をPJごとに見る。
            別財布支払は通常capの判定に混ぜず、別枠で表示する。
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 text-[11px]">
          <span className="rounded bg-background/80 px-2 py-1">65%対象 {fmtYen(financeTotals.baseClientAmountYen)}</span>
          <span className="rounded bg-background/80 px-2 py-1">バッファ {fmtYen(financeTotals.bufferYen)}</span>
          <span className="rounded bg-background/80 px-2 py-1">本契約cap {fmtYen(financeTotals.baseCapYen)}</span>
          {financeTotals.extraPayoutYen > 0 && (
            <span className="rounded bg-background/80 px-2 py-1">別財布支払 {fmtYen(financeTotals.extraPayoutYen)}</span>
          )}
          <span className="rounded bg-background/80 px-2 py-1">本契約支払 {fmtYen(financeTotals.payoutYen)}</span>
          {financeTotals.officerPayoutYen > 0 && (
            <span className="rounded bg-background/80 px-2 py-1">役員相殺 {fmtYen(financeTotals.officerOffsetYen)}</span>
          )}
          <span className={`rounded px-2 py-1 font-semibold ${overallOver ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            {overallText}
          </span>
        </div>
      </div>

      <div className="mt-3">
        {financeGroups.length === 0 ? (
          <div className="rounded-md border border-border/70 bg-background px-3 py-5 text-center text-[12px] text-muted-foreground">
            チェック対象がない
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/70 bg-background">
            <table className="min-w-[980px] border-separate border-spacing-0 text-[12px]">
              <thead>
                <tr className="bg-muted/40">
                  <th className="sticky left-0 z-20 w-40 border-b border-r border-border bg-muted px-3 py-2 text-left font-medium">
                    項目
                  </th>
                  {financeColumns.map((column, index) => {
                    const badge = columnBadge(column.group);
                    return (
                      <th
                        key={column.key}
                        className={`min-w-[180px] border-b border-r border-border px-3 py-2 text-left align-top font-medium ${index === 0 ? "bg-background" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate">{column.label}</div>
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{column.subLabel}</div>
                          </div>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${badge.className}`}>{badge.label}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-2 text-left font-medium">稼働月</th>
                  {financeColumns.map((column) => (
                    <td key={`${column.key}:ym`} className="border-b border-r border-border px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {(column.group ? column.group.cycles : allCycleYms.map((ym) => ({ key: `all:${ym}`, ym, invoiceYm: "", baseClientAmountYen: 0, bufferYen: 0, baseCapYen: 0, extraPayoutYen: 0, budgetYen: 0, payoutYen: 0, officerPayoutYen: 0, officerOffsetYen: 0, finalBalanceYen: 0 }))).map((cycle) => {
                          const item = itemByKey.get(cycle.key);
                          return item ? (
                            <button
                              key={cycle.key}
                              type="button"
                              onClick={() => onOpenMonthly(item)}
                              className="rounded border border-border bg-muted/25 px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted"
                            >
                              {fmtYm(cycle.ym)}
                            </button>
                          ) : (
                            <span key={cycle.key} className="rounded border border-border bg-muted/25 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {fmtYm(cycle.ym)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
                {[
                  ["65%対象委託料", "baseClientAmountYen"],
                  ["バッファ", "bufferYen"],
                  ["本契約cap", "baseCapYen"],
                  ["別財布支払", "extraPayoutYen"],
                  ["本契約支払", "payoutYen"],
                  ["役員分", "officerPayoutYen"],
                  ["役員相殺", "officerOffsetYen"],
                  ["本契約残り", "finalBalanceYen"],
                ].map(([label, key]) => (
                  <tr key={key}>
                    <th className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-2 text-left font-medium">{label}</th>
                    {financeColumns.map((column) => {
                      const value = columnMoney(column.group, key as "baseClientAmountYen" | "bufferYen" | "baseCapYen" | "extraPayoutYen" | "budgetYen" | "payoutYen" | "officerPayoutYen" | "officerOffsetYen" | "finalBalanceYen");
                      const signed = key === "officerOffsetYen" || key === "finalBalanceYen";
                      const tone =
                        key === "finalBalanceYen"
                          ? value < 0 ? "text-red-700" : "text-emerald-700"
                          : key === "officerOffsetYen"
                            ? "text-emerald-700"
                            : key === "officerPayoutYen"
                              ? "text-amber-800"
                              : "";
                      return (
                        <td key={`${column.key}:${key}`} className={`border-b border-r border-border px-3 py-2 text-right font-semibold tabular-nums ${tone}`}>
                          {signed ? fmtSignedYen(value) : fmtYen(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {memberRows.length > 0 && (
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-r border-border bg-muted px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
                      メンバー別支払
                    </th>
                    {financeColumns.map((column) => (
                      <td key={`${column.key}:member-head`} className="border-b border-r border-border bg-muted/35 px-3 py-2 text-[11px] text-muted-foreground">
                        {column.group ? column.group.memberLines.length : financeGroups.flatMap((group) => group.memberLines).length} 明細
                      </td>
                    ))}
                  </tr>
                )}
                {memberRows.map((row) => (
                  <tr key={row.key}>
                    <th className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-2 text-left font-medium">
                      <span>{row.memberName}</span>
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground">{row.memberId}</span>
                      {row.isOfficer ? (
                        <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-900">役員</span>
                      ) : null}
                    </th>
                    {financeColumns.map((column) => {
                      const value = memberColumnAmount(column.group, row);
                      return (
                        <td
                          key={`${column.key}:${row.key}`}
                          className={`border-b border-r border-border px-3 py-2 text-right tabular-nums ${row.isOfficer ? "text-amber-800" : ""}`}
                        >
                          {value > 0 ? fmtYen(value) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function FinancePurposeMatrix({
  title,
  description,
  totalHeader,
  months,
  rows,
  monthTotals,
  renderGrandCell,
  renderMonthTotalCell,
  renderRowTotalCell,
  renderCell,
  hasCellData,
  onOpenMonthly,
}: {
  title: string;
  description: string;
  totalHeader: string;
  months: string[];
  rows: ProjectMonthlyFinanceRow[];
  monthTotals: Array<ProjectMonthlyFinanceAggregate & { ym: string }>;
  renderGrandCell: () => ReactNode;
  renderMonthTotalCell: (cell: ProjectMonthlyFinanceAggregate & { ym: string }) => ReactNode;
  renderRowTotalCell: (row: ProjectMonthlyFinanceRow) => ReactNode;
  renderCell: (cell: ProjectMonthlyFinanceCell) => ReactNode;
  hasCellData: (cell: ProjectMonthlyFinanceCell) => boolean;
  onOpenMonthly: (cell: ProjectMonthlyFinanceCell) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-[13px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-border bg-background">
        <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky left-0 z-20 w-44 border-b border-r border-border bg-muted px-3 py-2 text-left font-medium">PJ</th>
              <th className="w-48 border-b border-r border-border px-3 py-2 text-center font-medium">{totalHeader}</th>
              {months.map((month) => (
                <th key={month} className="min-w-[170px] border-b border-r border-border px-3 py-2 text-center font-medium">
                  {fmtYm(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={months.length + 2} className="px-3 py-8 text-center text-muted-foreground">
                  先12か月のPJデータがない
                </td>
              </tr>
            ) : (
              <>
                <tr className="bg-muted/20">
                  <th className="sticky left-0 z-10 border-b border-r border-border bg-muted px-3 py-2 text-left font-semibold">全PJ合計</th>
                  <td className="border-b border-r border-border px-3 py-2 align-top">{renderGrandCell()}</td>
                  {monthTotals.map((total) => (
                    <td key={total.ym} className="border-b border-r border-border px-3 py-2 align-top">{renderMonthTotalCell(total)}</td>
                  ))}
                </tr>
                {rows.map((row) => (
                  <tr key={row.projectId} className="hover:bg-muted/15">
                    <th className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-2 text-left align-top font-medium">
                      <div className="truncate">{row.projectName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{row.projectId}</div>
                    </th>
                    <td className="border-b border-r border-border px-3 py-2 align-top">{renderRowTotalCell(row)}</td>
                    {row.cells.map((cell) => (
                      <td key={`${row.projectId}:${cell.ym}`} className="border-b border-r border-border px-2 py-2 align-top">
                        {hasCellData(cell) ? (
                          <button
                            type="button"
                            onClick={() => onOpenMonthly(cell)}
                            className="w-full rounded px-1 py-0.5 text-left hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                          >
                            {renderCell(cell)}
                          </button>
                        ) : (
                          <span className="block text-right text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProjectMonthlyFinanceTable({
  months,
  rows,
  onOpenMonthly,
}: {
  months: string[];
  rows: ProjectMonthlyFinanceRow[];
  onOpenMonthly: (cell: ProjectMonthlyFinanceCell) => void;
}) {
  const monthTotals = useMemo<Array<ProjectMonthlyFinanceAggregate & { ym: string }>>(
    () => months.map((ym) => {
      const cells = rows.map((row) => row.cells.find((cell) => cell.ym === ym)).filter((cell): cell is ProjectMonthlyFinanceCell => Boolean(cell));
      return {
        ym,
        baseClientAmountYen: cells.reduce((sum, cell) => sum + cell.baseClientAmountYen, 0),
        budgetYen: cells.reduce((sum, cell) => sum + cell.budgetYen, 0),
        extraRevenueYen: cells.reduce((sum, cell) => sum + cell.extraRevenueYen, 0),
        payoutYen: cells.reduce((sum, cell) => sum + cell.payoutYen, 0),
        extraPayoutYen: cells.reduce((sum, cell) => sum + cell.extraPayoutYen, 0),
        regularExternalPayoutYen: cells.reduce((sum, cell) => sum + cell.regularExternalPayoutYen, 0),
        extraExternalPayoutYen: cells.reduce((sum, cell) => sum + cell.extraExternalPayoutYen, 0),
        regularCompanyReserveYen: cells.reduce((sum, cell) => sum + cell.regularCompanyReserveYen, 0),
        extraCompanyReserveYen: cells.reduce((sum, cell) => sum + cell.extraCompanyReserveYen, 0),
        officerPayoutYen: cells.reduce((sum, cell) => sum + cell.officerPayoutYen, 0),
        stockYen: cells.reduce((sum, cell) => sum + cell.stockYen, 0),
        finalCapTopUpYen: cells.reduce((sum, cell) => sum + cell.finalCapTopUpYen, 0),
        regularFinalCapTopUpYen: cells.reduce((sum, cell) => sum + cell.regularFinalCapTopUpYen, 0),
        extraFinalCapTopUpYen: cells.reduce((sum, cell) => sum + cell.extraFinalCapTopUpYen, 0),
        regularGrossDueYen: cells.reduce((sum, cell) => sum + cell.regularGrossDueYen, 0),
        extraGrossDueYen: cells.reduce((sum, cell) => sum + cell.extraGrossDueYen, 0),
        grossDueYen: cells.reduce((sum, cell) => sum + cell.grossDueYen, 0),
        finalBalanceYen: cells.reduce((sum, cell) => sum + cell.finalBalanceYen, 0),
        extraBalanceYen: cells.reduce((sum, cell) => sum + cell.extraBalanceYen, 0),
      };
    }),
    [months, rows]
  );
  const grand = monthTotals.reduce<ProjectMonthlyFinanceAggregate>(
    (acc, item) => ({
      baseClientAmountYen: acc.baseClientAmountYen + item.baseClientAmountYen,
      budgetYen: acc.budgetYen + item.budgetYen,
      extraRevenueYen: acc.extraRevenueYen + item.extraRevenueYen,
      payoutYen: acc.payoutYen + item.payoutYen,
      extraPayoutYen: acc.extraPayoutYen + item.extraPayoutYen,
      regularExternalPayoutYen: acc.regularExternalPayoutYen + item.regularExternalPayoutYen,
      extraExternalPayoutYen: acc.extraExternalPayoutYen + item.extraExternalPayoutYen,
      regularCompanyReserveYen: acc.regularCompanyReserveYen + item.regularCompanyReserveYen,
      extraCompanyReserveYen: acc.extraCompanyReserveYen + item.extraCompanyReserveYen,
      officerPayoutYen: acc.officerPayoutYen + item.officerPayoutYen,
      stockYen: acc.stockYen + item.stockYen,
      finalCapTopUpYen: acc.finalCapTopUpYen + item.finalCapTopUpYen,
      regularFinalCapTopUpYen: acc.regularFinalCapTopUpYen + item.regularFinalCapTopUpYen,
      extraFinalCapTopUpYen: acc.extraFinalCapTopUpYen + item.extraFinalCapTopUpYen,
      regularGrossDueYen: acc.regularGrossDueYen + item.regularGrossDueYen,
      extraGrossDueYen: acc.extraGrossDueYen + item.extraGrossDueYen,
      grossDueYen: acc.grossDueYen + item.grossDueYen,
      finalBalanceYen: acc.finalBalanceYen + item.finalBalanceYen,
      extraBalanceYen: acc.extraBalanceYen + item.extraBalanceYen,
    }),
    {
      baseClientAmountYen: 0,
      budgetYen: 0,
      extraRevenueYen: 0,
      payoutYen: 0,
      extraPayoutYen: 0,
      regularExternalPayoutYen: 0,
      extraExternalPayoutYen: 0,
      regularCompanyReserveYen: 0,
      extraCompanyReserveYen: 0,
      officerPayoutYen: 0,
      stockYen: 0,
      finalCapTopUpYen: 0,
      regularFinalCapTopUpYen: 0,
      extraFinalCapTopUpYen: 0,
      regularGrossDueYen: 0,
      extraGrossDueYen: 0,
      grossDueYen: 0,
      finalBalanceYen: 0,
      extraBalanceYen: 0,
    }
  );
  const latestMonth = months[months.length - 1];
  const latestDebtYen = monthTotals.find((item) => item.ym === latestMonth)?.stockYen ?? 0;
  const riskMonths = monthTotals.filter((item) => capGapYen(item) < 0).length;
  const maxShortageYen = Math.max(0, ...monthTotals.map((item) => Math.max(0, -capGapYen(item))));

  const amountLine = (label: string, value: ReactNode, className = "text-muted-foreground") => (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
  const cashCell = (cell: ProjectMonthlyFinanceCellLike) => (
    <MetricLines
      main={fmtFlowYen(externalPayoutYen(cell))}
      mainClassName={externalPayoutYen(cell) > 0 ? "text-red-700" : "text-muted-foreground"}
      lines={[]}
    />
  );
  const reserveCell = (cell: ProjectMonthlyFinanceCellLike) => {
    const reserve = companyReserveIncreaseYen(cell);
    return (
      <MetricLines
        main={fmtSignedYen(reserve)}
        mainClassName={reserve < 0 ? "text-red-700" : reserve > 0 ? "text-emerald-700" : "text-muted-foreground"}
        lines={[]}
      />
    );
  };
  const debtCell = (cell: ProjectMonthlyFinanceCellLike) => (
    <MetricLines
      main={fmtFlowYen(cell.stockYen)}
      mainClassName={cell.stockYen > 0 ? "text-amber-700" : "text-emerald-700"}
      lines={[]}
    />
  );
  const capCell = (cell: ProjectMonthlyFinanceCellLike) => {
    const gap = capGapYen(cell);
    return (
      <MetricLines
        main={gap < 0 ? `不足 ${fmtFlowYen(Math.abs(gap))}` : `余力 ${fmtFlowYen(gap)}`}
        mainClassName={gap < 0 ? "text-red-700" : "text-emerald-700"}
        lines={[]}
      />
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded bg-red-50 px-2 py-1 text-red-800">外部支払 {fmtFlowYen(externalPayoutYen(grand))}</span>
        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">会社留保増 {fmtSignedYen(companyReserveIncreaseYen(grand))}</span>
        <span className={`rounded px-2 py-1 ${latestDebtYen > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
          報酬債務 着地 {fmtFlowYen(latestDebtYen)}
        </span>
        {riskMonths > 0 && <span className="rounded bg-red-100 px-2 py-1 font-semibold text-red-800">cap不足 {riskMonths}か月 / 最大 {fmtFlowYen(maxShortageYen)}</span>}
      </div>

      <FinancePurposeMatrix
        title="先12か月 キャッシュ支払"
        description="外へ実際に支払う金額だけを見る。会社留保は支出に入れない。"
        totalHeader="12か月 外部支払"
        months={months}
        rows={rows}
        monthTotals={monthTotals}
        renderGrandCell={() => cashCell(grand)}
        renderMonthTotalCell={cashCell}
        renderRowTotalCell={(row) => cashCell(row.totals)}
        renderCell={cashCell}
        hasCellData={(cell) => totalInYen(cell) > 0 || externalPayoutYen(cell) > 0}
        onOpenMonthly={onOpenMonthly}
      />

      <FinancePurposeMatrix
        title="先12か月 会社留保"
        description="会社に残る増加額を見る。計算は cap/売上枠 - 外部支払。"
        totalHeader="12か月 留保増"
        months={months}
        rows={rows}
        monthTotals={monthTotals}
        renderGrandCell={() => reserveCell(grand)}
        renderMonthTotalCell={reserveCell}
        renderRowTotalCell={(row) => reserveCell(row.totals)}
        renderCell={reserveCell}
        hasCellData={(cell) => totalInYen(cell) > 0 || externalPayoutYen(cell) > 0 || officerReserveYen(cell) > 0}
        onOpenMonthly={onOpenMonthly}
      />

      <FinancePurposeMatrix
        title="先12か月 報酬債務"
        description="最終月に未払い残がゼロ着地するかを見る。各月セルは月末未払い残だけを表示する。"
        totalHeader="最終着地"
        months={months}
        rows={rows}
        monthTotals={monthTotals}
        renderGrandCell={() => (
          <MetricLines
            main={latestDebtYen > 0 ? `残 ${fmtFlowYen(latestDebtYen)}` : "ゼロ着地"}
            mainClassName={latestDebtYen > 0 ? "text-amber-700" : "text-emerald-700"}
            lines={[
              amountLine("残あり月", `${monthTotals.filter((item) => item.stockYen > 0).length}か月`),
            ]}
          />
        )}
        renderMonthTotalCell={debtCell}
        renderRowTotalCell={(row) => {
          const latest = row.cells.find((cell) => cell.ym === latestMonth)?.stockYen ?? 0;
          return (
            <MetricLines
              main={latest > 0 ? `残 ${fmtFlowYen(latest)}` : "ゼロ着地"}
              mainClassName={latest > 0 ? "text-amber-700" : "text-emerald-700"}
              lines={[
                amountLine("残あり月", `${row.cells.filter((cell) => cell.stockYen > 0).length}か月`),
              ]}
            />
          );
        }}
        renderCell={debtCell}
        hasCellData={(cell) => cell.stockYen > 0 || cell.grossDueYen > 0 || externalPayoutYen(cell) > 0}
        onOpenMonthly={onOpenMonthly}
      />

      <FinancePurposeMatrix
        title="先12か月 cap超過チェック"
        description="報酬需要が支払可能枠を超えていないかだけを見る。"
        totalHeader="最大不足"
        months={months}
        rows={rows}
        monthTotals={monthTotals}
        renderGrandCell={() => (
          <MetricLines
            main={riskMonths > 0 ? `最大不足 ${fmtFlowYen(maxShortageYen)}` : "不足なし"}
            mainClassName={riskMonths > 0 ? "text-red-700" : "text-emerald-700"}
            lines={[amountLine("不足月", `${riskMonths}か月`)]}
          />
        )}
        renderMonthTotalCell={capCell}
        renderRowTotalCell={(row) => {
          const shortages = row.cells.map((cell) => Math.max(0, -capGapYen(cell)));
          const count = shortages.filter((value) => value > 0).length;
          const max = Math.max(0, ...shortages);
          return (
            <MetricLines
              main={count > 0 ? `最大不足 ${fmtFlowYen(max)}` : "不足なし"}
              mainClassName={count > 0 ? "text-red-700" : "text-emerald-700"}
              lines={[amountLine("不足月", `${count}か月`)]}
            />
          );
        }}
        renderCell={capCell}
        hasCellData={hasAnyForwardFinanceData}
        onOpenMonthly={onOpenMonthly}
      />
    </div>
  );
}

function MemberMonthlyPayoutMatrix({
  months,
  rows,
  selected,
  onSelect,
}: {
  months: string[];
  rows: MemberMonthlyPayoutRow[];
  selected: SelectedMemberMonthlyPayoutCell | null;
  onSelect: (cell: SelectedMemberMonthlyPayoutCell) => void;
}) {
  const tableWidth = 320 + months.length * 118;
  const monthTotals = useMemo(
    () => months.map((month) => ({
      ym: month,
      totalPay: rows.reduce((sum, row) => sum + (row.cells.find((cell) => cell.ym === month)?.totalPay ?? 0), 0),
      regularPaidYen: rows.reduce((sum, row) => sum + (row.cells.find((cell) => cell.ym === month)?.regularPaidYen ?? 0), 0),
      extraPaidYen: rows.reduce((sum, row) => sum + (row.cells.find((cell) => cell.ym === month)?.extraPaidYen ?? 0), 0),
    })),
    [months, rows]
  );
  const grandTotal = monthTotals.reduce((sum, month) => sum + month.totalPay, 0);
  const grandRegularPaidYen = monthTotals.reduce((sum, month) => sum + month.regularPaidYen, 0);
  const grandExtraPaidYen = monthTotals.reduce((sum, month) => sum + month.extraPaidYen, 0);
  const activeMonths = monthTotals.filter((month) => month.totalPay > 0).length;
  const payingMembers = rows.filter((row) => row.totalPay > 0).length;
  const selectedCell = selected
    ? rows.find((row) => row.memberId === selected.memberId)?.cells.find((cell) => cell.ym === selected.ym) ?? null
    : null;

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold">先12か月 メンバー別支払予定</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            非役員・支払対象メンバーへの外部支払を支払月ごとに集計。
          </p>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2 text-[11px]">
          <span className="rounded bg-muted/50 px-2 py-1">対象 {payingMembers}人</span>
          <span className="rounded bg-muted/50 px-2 py-1">発生月 {activeMonths}か月</span>
          {grandRegularPaidYen > 0 && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">本契約 {fmtFlowYen(grandRegularPaidYen)}</span>}
          {grandExtraPaidYen > 0 && <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-800">別財布 {fmtFlowYen(grandExtraPaidYen)}</span>}
          <span className="rounded bg-red-50 px-2 py-1 font-semibold text-red-800">12か月 {fmtFlowYen(grandTotal)}</span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-border bg-background">
        <table className="border-separate border-spacing-0 text-[12px]" style={{ minWidth: tableWidth, width: tableWidth }}>
          <colgroup>
            <col className="w-[176px]" />
            <col className="w-[144px]" />
            {months.map((month) => (
              <col key={month} className="w-[118px]" />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky left-0 z-20 w-[176px] min-w-[176px] max-w-[176px] border-b border-r border-border bg-muted px-3 py-2 text-left font-medium">メンバー</th>
              <th className="sticky left-[176px] z-20 w-[144px] min-w-[144px] max-w-[144px] border-b border-r border-border bg-muted px-3 py-2 text-right font-medium">12か月</th>
              {months.map((month) => (
                <th key={month} className="w-[118px] min-w-[118px] max-w-[118px] border-b border-r border-border px-2 py-2 text-right font-medium">
                  {fmtYm(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={months.length + 2} className="px-3 py-8 text-center text-muted-foreground">
                  支払対象メンバーがいない
                </td>
              </tr>
            ) : (
              <>
                <tr className="bg-muted/20">
                  <th className="sticky left-0 z-10 w-[176px] min-w-[176px] max-w-[176px] border-b border-r border-border bg-muted px-3 py-2 text-left font-semibold">合計</th>
                  <td className="sticky left-[176px] z-10 w-[144px] min-w-[144px] max-w-[144px] border-b border-r border-border bg-muted px-3 py-2 text-right font-semibold tabular-nums text-red-800">
                    <span className="block">{fmtFlowYen(grandTotal)}</span>
                    {grandExtraPaidYen > 0 && (
                      <span className="block text-[10px] font-normal text-indigo-700">別 {fmtYen(grandExtraPaidYen)}</span>
                    )}
                  </td>
                  {monthTotals.map((month) => (
                    <td key={month.ym} className="w-[118px] min-w-[118px] max-w-[118px] border-b border-r border-border px-2 py-2 text-right font-semibold tabular-nums">
                      {month.totalPay > 0 ? (
                        <>
                          <span className="block">{fmtFlowYen(month.totalPay)}</span>
                          {month.extraPaidYen > 0 && <span className="block text-[10px] font-normal text-indigo-700">別 {fmtYen(month.extraPaidYen)}</span>}
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                </tr>
                {rows.map((row) => (
                  <tr key={row.memberId} className="hover:bg-muted/15">
                    <th className="sticky left-0 z-10 w-[176px] min-w-[176px] max-w-[176px] border-b border-r border-border bg-background px-3 py-2 text-left align-top font-medium">
                      <div className="truncate">{row.memberName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{row.memberId}</div>
                    </th>
                    <td className="sticky left-[176px] z-10 w-[144px] min-w-[144px] max-w-[144px] border-b border-r border-border bg-background px-3 py-2 text-right align-top font-semibold tabular-nums">
                      {row.totalPay > 0 ? (
                        <>
                          <span className="block">{fmtFlowYen(row.totalPay)}</span>
                          <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                            本 {fmtYen(row.regularPaidYen)}
                          </span>
                          {row.extraPaidYen > 0 && (
                            <span className="block text-[10px] font-normal text-indigo-700">別 {fmtYen(row.extraPaidYen)}</span>
                          )}
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    {row.cells.map((cell) => {
                      const isSelected = selected?.memberId === cell.memberId && selected.ym === cell.ym;
                      return (
                        <td key={`${row.memberId}:${cell.ym}`} className="w-[118px] min-w-[118px] max-w-[118px] border-b border-r border-border px-2 py-2 text-right align-top">
                          {cell.totalPay > 0 ? (
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => onSelect({ memberId: cell.memberId, ym: cell.ym })}
                              className={`w-full rounded px-2 py-1 text-right tabular-nums transition-colors focus:outline-none focus:ring-1 focus:ring-foreground/20 ${
                                isSelected
                                  ? "bg-red-50 text-red-800 ring-1 ring-red-200"
                                  : "hover:bg-muted/60"
                              }`}
                            >
                              <span className="block text-[12px] font-semibold">{fmtFlowYen(cell.totalPay)}</span>
                              {cell.extraPaidYen > 0 && <span className="block text-[10px] text-indigo-700">別 {fmtYen(cell.extraPaidYen)}</span>}
                              <span className="block text-[10px] text-muted-foreground">{cell.entries.length} PJ</span>
                            </button>
                          ) : (
                            <span className="block px-2 py-1 text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {selectedCell && selectedCell.totalPay > 0 && (
        <div className="mt-3 rounded-md border border-border bg-background p-3">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <div className="text-[12px] font-semibold">
                {selectedCell.memberName} / {fmtYm(selectedCell.ym)}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{selectedCell.memberId}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[16px] font-semibold tabular-nums text-red-800">税抜 {fmtFlowYen(selectedCell.totalPay)}</div>
              <div className="text-[10px] text-muted-foreground">税込 {fmtTaxIncludedYen(selectedCell.totalPay)} / {selectedCell.entries.length} PJ</div>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="min-w-[760px] w-full text-[12px]">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">PJ</th>
                  <th className="px-3 py-2 text-right font-medium">
                    <span className="block">支払額</span>
                    <span className="block text-[10px] font-normal text-muted-foreground">税抜 / 税込</span>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">本契約</th>
                  <th className="px-3 py-2 text-right font-medium">別財布</th>
                  <th className="px-3 py-2 text-right font-medium">発生額</th>
                  <th className="px-3 py-2 text-right font-medium">pt</th>
                  <th className="px-3 py-2 text-right font-medium">未払い残</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedCell.entries.map((entry) => (
                  <tr key={entryKey(entry)} className="hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-medium">{entry.projectName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{entry.projectId}</div>
                      <div className="text-[10px] text-muted-foreground">稼働月 {fmtYm(entry.ym)} / 支払月 {fmtYm(entry.invoiceYm)}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className="font-semibold">税抜 {fmtFlowYen(entry.totalPay)}</div>
                      <div className="text-[10px] text-muted-foreground">税込 {fmtTaxIncludedYen(entry.totalPay)}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.regularPaidYen > 0 ? fmtYen(entry.regularPaidYen) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.extraPaidYen > 0 ? fmtYen(entry.extraPaidYen) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtYen(entry.basePay)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPt(entry.earnedPt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {entry.stockYen > 0 ? <span className="text-amber-700">{fmtYen(entry.stockYen)}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function PayoutNoticeActions({
  row,
  disabled,
  issuing,
  sendPreparing,
  onIssueNoticePdf,
  onOpenPdf,
  onUpdateNoticeSent,
  onOpenSendMailModal,
}: {
  row: MemberPayoutRow;
  disabled: boolean;
  issuing: boolean;
  sendPreparing: boolean;
  onIssueNoticePdf: (row: MemberPayoutRow, options?: { forceReissue?: boolean }) => void;
  onOpenPdf: (pdfUrl: string | null | undefined) => void;
  onUpdateNoticeSent: (row: MemberPayoutRow, patch: NoticeSavePatch) => void;
  onOpenSendMailModal: (row: MemberPayoutRow) => void;
}) {
  if (row.noticeExcluded) {
    return <span className="block text-right text-[11px] text-muted-foreground">通知対象外</span>;
  }

  const blocked = disabled || issuing || sendPreparing;
  const canIssuePdf = !blocked && row.totalPay > 0;
  const canPreviewPdf = !blocked && row.totalPay > 0;
  const isSent = Boolean(row.notice?.sent_at);
  const canClearSent = !blocked && isSent;
  const savedNoticeTotal = Math.round(numberValue(row.notice?.total_yen));
  const totalMismatch = savedNoticeTotal > 0 && savedNoticeTotal !== Math.round(row.totalPay);
  const hasPdf = Boolean(row.notice?.pdf_url) && row.isSaved && !totalMismatch && !String(row.notice?.notice_no || "").startsWith("PREVIEW-");
  const canConfirmPdf = canPreviewPdf && hasPdf && !row.noticeProfileStale;
  const canOpenSendModal = !blocked && row.totalPay > 0 && !isSent && hasPdf && !row.noticeProfileStale;
  const issueTitle = row.isSaved
    ? hasPdf
      ? "最新DBの住所・宛名・登録番号で支払通知書PDFを再発行する"
      : "最新DBの住所・宛名・登録番号で支払通知書PDFを発行する"
    : "最新計算額と最新DBのメンバー情報を同期してから支払通知書PDFを発行する";
  const pdfTitle = row.noticeProfileStale
    ? "メンバー台帳がPDF生成後に更新されています。支払通知書発行で再発行してください"
    : hasPdf
      ? "保存済みPDFを別タブで確認する"
      : "生成済みPDFがありません。先に支払通知書発行を実行してください";
  const sentTitle = isSent
    ? "送付済みを取り消して未送付に戻す (メールは取り消されない)"
    : row.noticeProfileStale
      ? "メンバー台帳がPDF生成後に更新されています。先に支払通知書発行で正式PDFを作り直してください"
      : totalMismatch
        ? "支払額がPDF生成後に変わっています。先に支払通知書発行で正式PDFを作り直してください"
        : hasPdf
          ? "保存済み正式PDFとメール本文を確認する"
          : "送信用の正式PDFがありません。先に支払通知書発行を実行してください";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onIssueNoticePdf(row, { forceReissue: Boolean(row.notice?.pdf_url) })}
          disabled={!canIssuePdf}
          title={issueTitle}
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40 disabled:opacity-50"
        >
          {issuing ? "発行中..." : "支払通知書発行"}
        </button>
        <button
          type="button"
          onClick={() => onOpenPdf(row.notice?.pdf_url)}
          disabled={!canConfirmPdf}
          title={pdfTitle}
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40 disabled:opacity-50"
        >
          PDF確認
        </button>
        <button
          type="button"
          onClick={() =>
            isSent
              ? onUpdateNoticeSent(row, { clearSent: true })
              : onOpenSendMailModal(row)
          }
          disabled={isSent ? !canClearSent : !canOpenSendModal}
          title={sentTitle}
          className="rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background disabled:opacity-50"
        >
          {isSent ? "送付取消" : sendPreparing ? "確認中..." : "送付"}
        </button>
      </div>
      <div className="text-right text-[10px] text-muted-foreground">
        {row.notice?.notice_no ? (
          <span className="font-mono">{row.notice.notice_no}</span>
        ) : (
          <span>PDF発行時に採番</span>
        )}
        {totalMismatch && (
          <span className="ml-1 text-amber-700">保存額 {fmtYen(savedNoticeTotal)}</span>
        )}
        {row.notice?.sent_at && (
          <span className="ml-1">送付 {new Date(row.notice.sent_at).toLocaleString("ja-JP")}</span>
        )}
      </div>
      {row.noticeProfileStale && (
        <div className="text-right text-[10px] text-amber-700">メンバー台帳更新後の再発行が必要</div>
      )}
      {row.isSaved && !isSent && (
        <div className="max-w-[260px] text-right text-[10px] leading-snug text-muted-foreground">
          送付は保存済み正式PDFが最新の時だけ確認画面を開く。確認後の送信は keiri@ から実メール送信し、Bccに masa / kyoko、成功時に送付済み化。
        </div>
      )}
    </div>
  );
}

function PayoutNoticeMailModal({
  state,
  sending,
  error,
  onToggleEditing,
  onBodyChange,
  onResetBody,
  onSend,
  onClose,
}: {
  state: NoticeMailModalState;
  sending: boolean;
  error: string | null;
  onToggleEditing: () => void;
  onBodyChange: (value: string) => void;
  onResetBody: () => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const { preview, editedBody, editing } = state;
  const bodyChanged = editedBody !== preview.body;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">支払通知メール送信の確認</div>
            <div className="text-[11px] text-muted-foreground">
              {preview.memberName} 宛 / {fmtYm(state.row.entries[0]?.ym ?? "")} 支払
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40 disabled:opacity-50"
          >
            キャンセル
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-3 text-[12px]">
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-900">
            この画面ではまだ送信されない。保存済みの正式PDFを添付して、確認後に keiri@team-armada.jp から実メール送信し、成功したら送付済みにする。
          </div>

          <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5">
            <div className="text-muted-foreground">From</div>
            <div className="font-mono">{preview.from}</div>
            <div className="text-muted-foreground">To</div>
            <div>
              <span className="font-medium">{preview.memberName}</span>{" "}
              <span className="font-mono text-muted-foreground">&lt;{preview.to}&gt;</span>
            </div>
            <div className="text-muted-foreground">Bcc</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {preview.bcc.length > 0 ? preview.bcc.join(", ") : "—"}
            </div>
            <div className="text-muted-foreground">件名</div>
            <div className="font-medium">{preview.subject}</div>
            <div className="text-muted-foreground">添付</div>
            <div className="text-[11px]">
              <a
                href={preview.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline"
              >
                支払通知書PDF (Drive)
              </a>
              <span className="ml-2 text-muted-foreground">fileId: {preview.pdfDriveFileId.slice(0, 8)}...</span>
              <span className="ml-2 text-muted-foreground">合計 {fmtYen(preview.totalYen)}</span>
              {preview.pdfPreparedBeforeSend && <span className="ml-2 text-emerald-700">正式PDF確認済み</span>}
            </div>
            <div className="text-muted-foreground">期日</div>
            <div>{preview.dueDateText}</div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">本文</span>
              <div className="flex gap-1.5">
                {bodyChanged && (
                  <button
                    type="button"
                    onClick={onResetBody}
                    disabled={sending}
                    className="rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-muted/40 disabled:opacity-50"
                  >
                    テンプレに戻す
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleEditing}
                  disabled={sending}
                  className="rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-muted/40 disabled:opacity-50"
                >
                  {editing ? "編集を確定" : "本文修正"}
                </button>
              </div>
            </div>
            {editing ? (
              <textarea
                value={editedBody}
                onChange={(event) => onBodyChange(event.target.value)}
                rows={18}
                className="w-full rounded-md border border-border bg-background p-2 text-[12px] font-mono leading-relaxed"
                disabled={sending}
              />
            ) : (
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-[12px] leading-relaxed font-sans">
                {editedBody}
              </pre>
            )}
          </div>

          {preview.alreadySentAt && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              ⚠️ このメンバーは既に {new Date(preview.alreadySentAt).toLocaleString("ja-JP")} に送付済として記録されている。
              再送が必要な場合は、送付取消で未送付に戻してから準備し直す。
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="max-w-md text-[10px] leading-snug text-muted-foreground">
            「はい・送信」を押すと {preview.to} に Gmail から実送信されます。添付PDFは保存済み正式PDFです。
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] hover:bg-muted/40 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={sending || editing}
              title={editing ? "本文編集を「編集を確定」で閉じてから送信" : ""}
              className="rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background disabled:opacity-50"
            >
              {sending ? "送信中..." : "はい・送信"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayoutMonthlyModal({ cockpit, ym, onClose }: { cockpit: CockpitData; ym: string; onClose: () => void }) {
  const context = cockpitModalContext(cockpit, ym);

  return (
    <CockpitMonthlyModal
      ym={ym}
      projectId={cockpit.project.projectId}
      report={context.report}
      billing={context.billing}
      milestones={context.milestones}
      progress={context.progress}
      responsibilities={context.responsibilities}
      memberMap={cockpit.memberMap || {}}
      planCycle={context.planCycle}
      subItems={context.subItems}
      msActivities={context.msActivities}
      memberActivities={context.memberActivities}
      currentYm={cockpit.currentYm}
      projectFeeType={cockpit.project.feeType}
      projectFeeAmount={cockpit.project.feeAmount}
      onClose={onClose}
    />
  );
}

function SummaryBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[17px] font-semibold">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

/**
 * freee の出金から自動で確認した「実際に振り込んだ」状態。
 * 送付済みなのに振込が見つからない通知書は、未振込としてここで分かるようにする。
 */
function PaidBadge({ notice }: { notice: PayoutNotice }) {
  if (notice.paid_on) {
    const label = `${notice.paid_on.slice(5, 7)}/${notice.paid_on.slice(8, 10)}`;
    return (
      <div className="text-[10px] text-emerald-700" title={`freeeの出金と一致: ${notice.paid_on} / ${fmtFlowYen(notice.paid_amount_yen)} (税込)`}>
        振込済 {label} {fmtFlowYen(notice.paid_amount_yen)}
      </div>
    );
  }
  return (
    <div className="text-[10px] text-amber-700" title="freeeの出金に、この通知書の税込額と一致する振込が見つかっていない">
      振込未確認
    </div>
  );
}

function NoticeBadge({
  notice,
  expectedTotal,
  excluded,
}: {
  notice: PayoutNotice | null;
  expectedTotal: number;
  excluded: boolean;
}) {
  if (excluded) {
    return <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">通知除外</span>;
  }

  if (!notice) {
    return <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">未作成</span>;
  }

  const savedTotal = Number(notice.total_yen ?? 0);
  const differs = savedTotal > 0 && Math.round(savedTotal) !== Math.round(expectedTotal);
  const generatedLabel = fmtRelativeTime(notice.last_generated_at);
  if (notice.sent_at) {
    return (
      <div className="space-y-0.5">
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">送付済</span>
        {notice.notice_no && <div className="font-mono text-[10px] text-muted-foreground">{notice.notice_no}</div>}
        <div className="text-[10px] text-muted-foreground">{fmtYen(savedTotal)}</div>
        <PaidBadge notice={notice} />
        {notice.pdf_url && (
          <a href={notice.pdf_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-700 underline underline-offset-2">
            PDF
          </a>
        )}
        {generatedLabel && (
          <div className="text-[10px] text-muted-foreground" title={notice.last_generated_at ?? undefined}>
            生成 {generatedLabel}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <span className={`rounded px-1.5 py-0.5 text-[10px] ${differs ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
        {notice.notice_no || notice.pdf_url ? "発行準備中" : "金額保存"}
      </span>
      {notice.notice_no && <div className="font-mono text-[10px] text-muted-foreground">{notice.notice_no}</div>}
      <div className="text-[10px] text-muted-foreground">{fmtYen(savedTotal)}</div>
      {notice.pdf_url && (
        <a href={notice.pdf_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-700 underline underline-offset-2">
          PDF
        </a>
      )}
      {generatedLabel && (
        <div className="text-[10px] text-muted-foreground" title={notice.last_generated_at ?? undefined}>
          生成 {generatedLabel}
        </div>
      )}
    </div>
  );
}
