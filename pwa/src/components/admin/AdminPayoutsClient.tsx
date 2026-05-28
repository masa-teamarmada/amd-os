"use client";

import { useEffect, useMemo, useState } from "react";
import { CockpitMonthlyModal } from "@/components/cockpit/CockpitMonthlyModal";
import { fetchCockpitFromSupabase, type CockpitData } from "@/lib/supabase-data";

type Member = {
  member_id: string;
  code_name: string;
  member_name: string | null;
  contractor_name?: string | null;
  member_address?: string | null;
  bank_info?: string | null;
  email: string | null;
  status: string;
  is_officer?: boolean | null;
  exclude_from_payout_notice?: boolean | null;
};

type Project = {
  project_id: string;
  project_name: string;
  client_name?: string | null;
  status: string | null;
  fee_type?: string | null;
  fee_amount?: number | string | null;
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
};

type RewardSummary = {
  totalPaySum?: number;
  carryOverYen?: number;
  members?: RewardMember[];
};

type BillingCycle = {
  project_id: string;
  ym: string;
  status: string | null;
  budget_yen: number | null;
  budget_reported_amount?: number | null;
  budget_buffer_amount?: number | null;
  invoice_ym: string | null;
  reward_summary_json: RewardSummary | string | null;
  payout_notice_uploaded_at?: string | null;
  payment_confirmed_at?: string | null;
  reward_paid_at?: string | null;
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
  last_generated_at?: string | null;
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

type PayoutData = {
  ym: string;
  members: Member[];
  projects: Project[];
  cycles: BillingCycle[];
  payouts: MonthlyRewardPayout[];
  notices: PayoutNotice[];
  expectedEntries?: PayoutEntry[];
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
  grossDueYen: number;
  carryInYen: number;
  stockYen: number;
  cappedFrom: number;
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
  extraPayoutBudgetYen: number;
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
  extraPayoutBudgetYen: number;
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
  extraPayoutBudgetYen: number;
  budgetYen: number;
  payoutYen: number;
  officerPayoutYen: number;
  officerOffsetYen: number;
  finalBalanceYen: number;
  cycles: ProjectFinanceCycleLine[];
  memberLines: ProjectFinanceMemberLine[];
};

type BudgetConfirmGroup = {
  key: string;
  projectId: string;
  invoiceYm: string;
  projectName: string;
  projectStatus: string | null;
  items: BudgetAuditItem[];
  totalPayoutYen: number;
  totalStockYen: number;
  currentBudgetYen: number;
  baseClientAmountYen: number;
  bufferYen: number;
  extraPayoutBudgetYen: number;
};

type MemberPayoutRow = {
  memberId: string;
  memberName: string;
  noticeExcluded: boolean;
  notice: PayoutNotice | null;
  totalPay: number;
  savedTotal: number;
  carryInYen: number;
  stockYen: number;
  entries: PayoutEntry[];
  isSaved: boolean;
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
};

type NoticeMailModalState = {
  row: MemberPayoutRow;
  preview: NoticeMailPreview;
  editedBody: string;
  editing: boolean;
};

type ManualRewardDraft = {
  projectId: string;
  sourceYm: string;
  memberId: string;
  totalPayText: string;
  note: string;
};

interface Props {
  initialYm: string;
  ymOptions: string[];
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

function fmtYm(ym: string) {
  return ym && ym.length === 6 ? `${ym.slice(0, 4)}/${ym.slice(4)}` : ym;
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

function fmtYen(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n > 0 && Number.isFinite(n) ? `¥${Math.round(n).toLocaleString("ja-JP")}` : "—";
}

function fmtSignedYen(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  if (rounded < 0) return `-¥${Math.abs(rounded).toLocaleString("ja-JP")}`;
  return `¥${rounded.toLocaleString("ja-JP")}`;
}

function fmtDeltaYen(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  if (rounded > 0) return `+¥${rounded.toLocaleString("ja-JP")}`;
  if (rounded < 0) return `-¥${Math.abs(rounded).toLocaleString("ja-JP")}`;
  return "¥0";
}

function budgetAuditBadge(item: BudgetAuditItem) {
  const missingBudget = item.budgetYen <= 0 && item.payoutYen > 0;
  const deferredBudget = missingBudget && item.invoiceYm !== item.ym;
  const lostProject = item.projectStatus === "lost";
  const over = item.budgetYen > 0 && item.payoutYen > item.budgetYen;
  const unpaid = item.payoutYen > 0 && !item.paymentConfirmed;
  const cappedStock = item.stockYen > 0;

  if (lostProject && missingBudget) {
    return {
      label: "失注/破談: 予算なし",
      className: "bg-red-100 text-red-800",
      note: "契約が取れなかった場合は、支払可否を個別確認する",
    };
  }
  if (deferredBudget) {
    return {
      label: "後追い予算未確定",
      className: "bg-amber-100 text-amber-800",
      note: "確定委託料が入るまで正式な超過判定は保留",
    };
  }
  if (missingBudget) {
    return {
      label: "PJ予算未設定",
      className: "bg-red-100 text-red-800",
      note: "予算確定なしに支払保存しない",
    };
  }
  if (over) {
    return {
      label: `予算不足 ${fmtYen(item.payoutYen - item.budgetYen)}`,
      className: "bg-red-100 text-red-800",
      note: "想定より確定額が低い可能性あり",
    };
  }
  if (cappedStock) {
    return {
      label: `cap発動 ${fmtYen(item.stockYen)}`,
      className: "bg-amber-100 text-amber-800",
      note: "追加受託などで支払う場合はcap外追加支払枠を入れる",
    };
  }
  if (unpaid) {
    return {
      label: "入金未確認",
      className: "bg-amber-100 text-amber-800",
      note: "予算内だが入金確認前",
    };
  }
  return {
    label: `OK ${fmtYen(item.budgetYen - item.payoutYen)}`,
    className: "bg-emerald-100 text-emerald-800",
    note: "予算内",
  };
}

function fmtPt(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? `${Math.round(n * 100) / 100}pt` : "—";
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

function parseYenInput(value: string) {
  const normalized = value.replace(/[,\s¥円]/g, "");
  const n = Number(normalized || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function baseClientAmountForCycle(cycle: BillingCycle, project?: Project) {
  const reported = Math.round(numberValue(cycle.budget_reported_amount));
  if (reported > 0) return reported;
  if (String(project?.fee_type || "").toLowerCase() === "monthly_fixed") {
    const fee = Math.round(numberValue(project?.fee_amount));
    if (fee > 0) return fee;
  }
  return 0;
}

function baseCapYenFor(baseClientAmountYen: number, bufferYen: number) {
  return Math.max(0, Math.round(baseClientAmountYen * 0.65) - Math.max(0, Math.round(bufferYen)));
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

function buildEntries(cycles: BillingCycle[], memberMap: Map<string, string>, excludedMemberIds: Set<string> = new Set()): PayoutEntry[] {
  const entries: PayoutEntry[] = [];

  for (const cycle of cycles) {
    const cycleEntries: PayoutEntry[] = [];
    const summary = asRewardSummary(cycle.reward_summary_json);
    for (const member of summary?.members ?? []) {
      const memberId = memberIdOf(member);
      if (!memberId) continue;
      if (excludedMemberIds.has(memberId)) continue;

      const totalPay = Math.round(numberValue(member.totalPay ?? member.total_pay));
      const carryInYen = Math.round(numberValue(member.carryInYen ?? member.carry_in_yen));
      const stockYen = Math.round(numberValue(member.stockYen ?? member.stock_yen ?? member.deferredYen ?? member.deferred_yen));
      const grossDueYen = Math.round(numberValue(member.grossDueYen ?? member.gross_due_yen ?? member.cappedFrom ?? member.capped_from ?? totalPay));
      const cappedFrom = Math.round(numberValue(member.cappedFrom ?? member.capped_from));
      if (totalPay <= 0 && stockYen <= 0 && grossDueYen <= 0) continue;

      cycleEntries.push({
        projectId: cycle.project_id,
        ym: cycle.ym,
        invoiceYm: cycle.invoice_ym || cycle.ym,
        memberId,
        memberName: memberNameOf(member) || memberMap.get(memberId) || memberId,
        earnedPt: numberValue(member.earnedPt ?? member.earned_pt),
        basePay: Math.round(numberValue(member.basePay ?? member.base_pay)),
        bonusPt: Math.round(numberValue(member.bonusPt ?? member.bonus_pt)),
        totalPay,
        grossDueYen,
        carryInYen,
        stockYen,
        cappedFrom,
      });
    }
    entries.push(...capEntriesToBudget(cycleEntries, cycle.budget_yen));
  }

  return entries.sort((a, b) => {
    if (a.memberName !== b.memberName) return a.memberName.localeCompare(b.memberName, "ja");
    if (a.ym !== b.ym) return a.ym.localeCompare(b.ym);
    return a.projectId.localeCompare(b.projectId);
  });
}

function applySavedPayoutsForExistingRows({
  entries,
  payouts,
  cycles,
  memberMap,
  excludedMemberIds,
}: {
  entries: PayoutEntry[];
  payouts: MonthlyRewardPayout[];
  cycles: BillingCycle[];
  memberMap: Map<string, string>;
  excludedMemberIds: Set<string>;
}): PayoutEntry[] {
  const cycleByKey = new Map(cycles.map((cycle) => [`${cycle.project_id}:${cycle.ym}`, cycle]));
  const byKey = new Map(entries.map((entry) => [entryKey(entry), entry]));

  for (const payout of payouts) {
    if (excludedMemberIds.has(payout.member_id)) continue;
    const cycle = cycleByKey.get(`${payout.project_id}:${payout.ym}`);
    if (!cycle) continue;
    const totalPay = Math.round(numberValue(payout.total_pay));
    if (totalPay <= 0) continue;
    byKey.set(`${payout.project_id}:${payout.ym}:${payout.member_id}`, {
      projectId: payout.project_id,
      ym: payout.ym,
      invoiceYm: cycle.invoice_ym || cycle.ym,
      memberId: payout.member_id,
      memberName: memberMap.get(payout.member_id) || payout.member_id,
      earnedPt: numberValue(payout.earned_pt),
      basePay: Math.round(numberValue(payout.base_pay)),
      bonusPt: Math.round(numberValue(payout.bonus_pt)),
      totalPay,
      grossDueYen: totalPay,
      carryInYen: 0,
      stockYen: 0,
      cappedFrom: totalPay,
    });
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.memberName !== b.memberName) return a.memberName.localeCompare(b.memberName, "ja");
    if (a.ym !== b.ym) return a.ym.localeCompare(b.ym);
    return a.projectId.localeCompare(b.projectId);
  });
}

function capEntriesToBudget(entries: PayoutEntry[], budgetYen: number | null): PayoutEntry[] {
  const budget = Math.round(numberValue(budgetYen));
  const totalPay = entries.reduce((sum, entry) => sum + entry.totalPay, 0);
  if (budget <= 0 || totalPay <= budget || entries.length === 0) return entries;

  let allocated = 0;
  return entries.map((entry, index) => {
    const cappedPay =
      index === entries.length - 1
        ? Math.max(0, budget - allocated)
        : Math.max(0, Math.round((entry.totalPay / totalPay) * budget));
    allocated += cappedPay;
    const grossDueYen = Math.max(entry.grossDueYen, entry.totalPay);
    const stockYen = Math.max(entry.stockYen, grossDueYen - cappedPay);
    return {
      ...entry,
      totalPay: cappedPay,
      grossDueYen,
      stockYen,
      cappedFrom: grossDueYen,
    };
  });
}

export function AdminPayoutsClient({ initialYm, ymOptions }: Props) {
  const [ym, setYm] = useState(initialYm);
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [budgetTarget, setBudgetTarget] = useState<BudgetConfirmGroup | null>(null);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [noticeSavingMemberId, setNoticeSavingMemberId] = useState<string | null>(null);
  const [noticeMailModal, setNoticeMailModal] = useState<NoticeMailModalState | null>(null);
  const [noticeMailLoading, setNoticeMailLoading] = useState(false);
  const [noticeMailSending, setNoticeMailSending] = useState(false);
  const [noticeMailError, setNoticeMailError] = useState<string | null>(null);
  const [paymentNudgeSending, setPaymentNudgeSending] = useState(false);
  const [bulkPdfMode, setBulkPdfMode] = useState<"issue" | "preview" | null>(null);
  const [bulkPdfResult, setBulkPdfResult] = useState<BulkNoticeSummary | null>(null);
  const [manualRewardSaving, setManualRewardSaving] = useState(false);
  const [manualRewardDraft, setManualRewardDraft] = useState<ManualRewardDraft>({
    projectId: "",
    sourceYm: initialYm,
    memberId: "",
    totalPayText: "",
    note: "",
  });
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

  const noticeExcludedSet = useMemo(() => {
    const set = new Set<string>();
    for (const member of data?.members ?? []) {
      if (member.exclude_from_payout_notice || member.is_officer) set.add(member.member_id);
    }
    return set;
  }, [data?.members]);

  const officerMemberIds = useMemo(() => {
    const set = new Set<string>();
    for (const member of data?.members ?? []) {
      if (member.is_officer) set.add(member.member_id);
    }
    return set;
  }, [data?.members]);

  const expectedEntries = useMemo(
    () => applySavedPayoutsForExistingRows({
      entries: buildEntries(data?.cycles ?? [], memberMap, officerMemberIds),
      payouts: data?.payouts ?? [],
      cycles: data?.cycles ?? [],
      memberMap,
      excludedMemberIds: officerMemberIds,
    }),
    [data?.cycles, data?.payouts, memberMap, officerMemberIds]
  );

  const officerReserveEntries = useMemo(
    () => buildEntries(data?.cycles ?? [], memberMap, new Set((data?.members ?? []).filter((member) => !member.is_officer).map((member) => member.member_id))),
    [data?.cycles, data?.members, memberMap]
  );

  const cycleStats = useMemo(() => {
    const byCycle = new Map<string, { totalPay: number; grossDueYen: number; stockYen: number; carryInYen: number; savedCount: number; expectedCount: number }>();
    for (const entry of expectedEntries) {
      const key = `${entry.projectId}:${entry.ym}`;
      const current = byCycle.get(key) ?? { totalPay: 0, grossDueYen: 0, stockYen: 0, carryInYen: 0, savedCount: 0, expectedCount: 0 };
      current.totalPay += entry.totalPay;
      current.grossDueYen += entry.grossDueYen;
      current.stockYen += entry.stockYen;
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
      const budgetYen = Math.round(numberValue(cycle.budget_yen));
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
        extraPayoutBudgetYen: Math.max(0, budgetYen - baseCapYen),
        budgetYen,
        payoutYen: Math.round(stats?.totalPay ?? 0),
        stockYen: Math.round(stats?.stockYen ?? 0),
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
          extraPayoutBudgetYen: 0,
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
      const payoutYen = nonOfficerEntries.reduce((sum, entry) => sum + entry.totalPay, 0);
      const officerPayoutYen = officerEntries.reduce((sum, entry) => sum + entry.totalPay, 0);
      const officerOffsetYen = officerPayoutYen;
      const budgetYen = Math.round(numberValue(cycle.budget_yen));
      const bufferYen = Math.round(numberValue(cycle.budget_buffer_amount));
      const baseClientAmountYen = baseClientAmountForCycle(cycle, project);
      const baseCapYen = baseCapYenFor(baseClientAmountYen, bufferYen);
      const extraPayoutBudgetYen = Math.max(0, budgetYen - baseCapYen);
      const finalBalanceYen = budgetYen - payoutYen - officerPayoutYen + officerOffsetYen;

      group.baseClientAmountYen += baseClientAmountYen;
      group.bufferYen += bufferYen;
      group.baseCapYen += baseCapYen;
      group.extraPayoutBudgetYen += extraPayoutBudgetYen;
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
        extraPayoutBudgetYen,
        budgetYen,
        payoutYen,
        officerPayoutYen,
        officerOffsetYen,
        finalBalanceYen,
      });

      for (const entry of nonOfficerEntries) {
        group.memberLines.push({
          key: entryKey(entry),
          ym: entry.ym,
          invoiceYm: entry.invoiceYm,
          memberId: entry.memberId,
          memberName: entry.memberName,
          amountYen: entry.totalPay,
          isOfficer: false,
          offsetYen: 0,
          netEffectYen: -entry.totalPay,
        });
      }
      for (const entry of officerEntries) {
        group.memberLines.push({
          key: `officer:${entryKey(entry)}`,
          ym: entry.ym,
          invoiceYm: entry.invoiceYm,
          memberId: entry.memberId,
          memberName: entry.memberName,
          amountYen: entry.totalPay,
          isOfficer: true,
          offsetYen: entry.totalPay,
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

  const budgetConfirmGroups = useMemo<BudgetConfirmGroup[]>(() => {
    const map = new Map<string, BudgetConfirmGroup>();
    for (const item of budgetAuditItems) {
      if (item.payoutYen <= 0 && item.stockYen <= 0) continue;
      const key = `${item.projectId}:${item.invoiceYm}`;
      const group =
        map.get(key) ??
        {
          key,
          projectId: item.projectId,
          invoiceYm: item.invoiceYm,
          projectName: item.projectName,
          projectStatus: item.projectStatus,
          items: [],
          totalPayoutYen: 0,
          totalStockYen: 0,
          currentBudgetYen: 0,
          baseClientAmountYen: 0,
          bufferYen: 0,
          extraPayoutBudgetYen: 0,
        };
      group.items.push(item);
      group.totalPayoutYen += item.payoutYen;
      group.totalStockYen += item.stockYen;
      group.currentBudgetYen += item.budgetYen;
      group.baseClientAmountYen += item.baseClientAmountYen;
      group.bufferYen += item.bufferYen;
      group.extraPayoutBudgetYen += item.extraPayoutBudgetYen;
      map.set(key, group);
    }

    return [...map.values()]
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => a.ym.localeCompare(b.ym)),
      }))
      .sort((a, b) => {
        if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName, "ja");
        return a.invoiceYm.localeCompare(b.invoiceYm);
      });
  }, [budgetAuditItems]);

  const memberRows = useMemo<MemberPayoutRow[]>(() => {
    const byMember = new Map<string, MemberPayoutRow>();
    for (const entry of expectedEntries) {
      const row =
        byMember.get(entry.memberId) ??
        {
          memberId: entry.memberId,
          memberName: entry.memberName,
          noticeExcluded: noticeExcludedSet.has(entry.memberId),
          notice: noticeMap.get(entry.memberId) ?? null,
          totalPay: 0,
          savedTotal: 0,
          carryInYen: 0,
          stockYen: 0,
          entries: [],
          isSaved: true,
        };

      row.totalPay += entry.totalPay;
      row.carryInYen += entry.carryInYen;
      row.stockYen += entry.stockYen;
      row.entries.push(entry);
      const saved = payoutMap.get(entryKey(entry));
      if (saved) row.savedTotal += Math.round(numberValue(saved.total_pay));
      if (entry.totalPay > 0 && (!saved || Math.round(numberValue(saved.total_pay)) !== entry.totalPay)) row.isSaved = false;
      byMember.set(entry.memberId, row);
    }

    return [...byMember.values()].sort((a, b) => b.totalPay - a.totalPay);
  }, [expectedEntries, noticeExcludedSet, noticeMap, payoutMap]);

  const grandTotal = memberRows.reduce((sum, row) => sum + row.totalPay, 0);
  const savedAll = expectedEntries.length > 0 && memberRows.every((row) => row.isSaved);
  const rewardCycleCount = new Set(expectedEntries.map((entry) => `${entry.projectId}:${entry.ym}`)).size;

  async function loadForYm(nextYm: string, options: { refreshRewards?: boolean } = {}) {
    setLoading(true);
    setHint(options.refreshRewards ? "報酬キャッシュを再計算中..." : "");
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
      setHint(
        `${fmtYm(nextYm)} / ${options.refreshRewards ? "再計算済" : "キャッシュ表示"} / 対象${payload.cycles.length}件 / 報酬${payload.expectedEntries?.length ?? 0}明細`
      );
    } catch (err) {
      setData(null);
      setHint(err instanceof Error ? err.message : "読込エラー");
    } finally {
      setLoading(false);
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
    if (!row.isSaved) {
      setHint("先に支払データを保存してからPDFを発行してね");
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

  async function previewNoticePdf(row: MemberPayoutRow) {
    if (row.notice?.pdf_url) {
      openPdfUrl(row.notice.pdf_url);
      return;
    }

    const pdfWindow = openPdfPlaceholderWindow();
    setNoticeSavingMemberId(row.memberId);
    setHint("確認用の支払通知書PDFを作成中...");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_notice_pdf",
          ym,
          memberId: row.memberId,
        }),
      });
      const payload = (await res.json()) as (
        PayoutData & { ok?: boolean; error?: string; issuedNotice?: { pdfUrl?: string } }
      );
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `notice pdf preview failed (${res.status})`);
      }
      if (!payload.issuedNotice?.pdfUrl) {
        throw new Error("確認用PDFのURLが返ってこなかった");
      }
      showGeneratedPdf(pdfWindow, payload.issuedNotice.pdfUrl);
      setHint(`${row.memberName} の確認用PDFを開いた（支払データ・通知書URLは未保存）`);
    } catch (err) {
      closePdfPlaceholder(pdfWindow);
      setHint(err instanceof Error ? err.message : "確認用PDFの作成エラー");
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
    if (!row.notice?.pdf_url) {
      setHint("先に支払通知書PDFを発行してね");
      return;
    }
    setNoticeMailLoading(true);
    setNoticeMailError(null);
    setHint("メール本文を準備中...");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_notice_email",
          ym,
          memberId: row.memberId,
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string; preview?: NoticeMailPreview };
      if (!res.ok || payload.ok === false || !payload.preview) {
        throw new Error(payload.error || `メール本文の準備に失敗 (${res.status})`);
      }
      setNoticeMailModal({
        row,
        preview: payload.preview,
        editedBody: payload.preview.body,
        editing: false,
      });
      setHint("");
    } catch (err) {
      setHint(err instanceof Error ? err.message : "メール本文の準備に失敗");
    } finally {
      setNoticeMailLoading(false);
    }
  }

  function closeNoticeMailModal() {
    if (noticeMailSending) return;
    setNoticeMailModal(null);
    setNoticeMailError(null);
  }

  async function sendNoticeMailNow() {
    if (!noticeMailModal) return;
    const { row, preview, editedBody } = noticeMailModal;
    setNoticeMailSending(true);
    setNoticeMailError(null);
    setHint(`${preview.memberName} に支払通知メールを送信中...`);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_notice_email",
          ym,
          memberId: row.memberId,
          body: editedBody,
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

  async function saveAll() {
    if (expectedEntries.length === 0) {
      setHint("保存できる報酬明細がない");
      return;
    }
    setSaving(true);
    setHint("保存中...");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ym }),
      });
      const payload = (await res.json()) as (
        PayoutData & { ok?: boolean; error?: string; savedPayoutRows?: number; savedNoticeRows?: number }
      );
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `save failed (${res.status})`);
      }
      setData(payload);
      setHint(`保存した: 報酬${payload.savedPayoutRows ?? 0}明細 / 通知額${payload.savedNoticeRows ?? 0}件`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "保存エラー");
    } finally {
      setSaving(false);
    }
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
        }),
      });
      const payload = (await res.json()) as PayoutData & {
        ok?: boolean;
        error?: string;
        bulkResult?: BulkNoticeSummary;
      };
      if (!res.ok || payload.ok === false) {
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

  async function saveBudgetGroup(group: BudgetConfirmGroup, clientAmountYen: number, bufferYen: number, extraPayoutBudgetYen: number) {
    if (clientAmountYen <= 0) {
      setHint("65%対象の通常委託料を入力してね");
      return;
    }
    setBudgetSaving(true);
    setHint("PJ予算を確定中...");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ym,
          projectId: group.projectId,
          invoiceYm: group.invoiceYm,
          sourceYms: group.items.map((item) => item.ym),
          clientAmountYen,
          bufferYen,
          extraPayoutBudgetYen,
        }),
      });
      const payload = (await res.json()) as (
        PayoutData & { ok?: boolean; error?: string; pjBudgetTotal?: number; updatedCycles?: unknown[] }
      );
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `budget save failed (${res.status})`);
      }
      setData(payload);
      setBudgetTarget(null);
      setHint(`${group.projectName} ${fmtYm(group.items[0]?.ym ?? "")}-${fmtYm(group.items[group.items.length - 1]?.ym ?? "")} のPJ予算 ${fmtYen(payload.pjBudgetTotal ?? 0)} を確定`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "PJ予算の保存エラー");
    } finally {
      setBudgetSaving(false);
    }
  }

  async function saveManualRewardOverride() {
    const totalPayYen = parseYenInput(manualRewardDraft.totalPayText);
    const sourceYm = manualRewardDraft.sourceYm.trim();
    if (!manualRewardDraft.projectId || !manualRewardDraft.memberId || !/^[0-9]{6}$/.test(sourceYm) || totalPayYen <= 0) {
      setHint("PJ、稼働月、メンバー、支払額を入れてね");
      return;
    }
    setManualRewardSaving(true);
    setHint("手入力の報酬額を確定中...");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual_reward_override",
          ym,
          projectId: manualRewardDraft.projectId,
          sourceYm,
          memberId: manualRewardDraft.memberId,
          totalPayYen,
          note: manualRewardDraft.note,
        }),
      });
      const payload = (await res.json()) as (
        PayoutData & { ok?: boolean; error?: string; manualRewardOverride?: { projectId?: string; sourceYm?: string; memberId?: string; totalPayYen?: number } }
      );
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `manual reward save failed (${res.status})`);
      }
      setData(payload);
      const project = projectMap.get(manualRewardDraft.projectId);
      const memberName = memberMap.get(manualRewardDraft.memberId) || manualRewardDraft.memberId;
      setManualRewardDraft((prev) => ({ ...prev, totalPayText: "", note: "" }));
      setHint(`${project?.project_name ?? manualRewardDraft.projectId} ${fmtYm(sourceYm)} / ${memberName} の報酬 ${fmtYen(totalPayYen)} を強制確定`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "手入力報酬の保存エラー");
    } finally {
      setManualRewardSaving(false);
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
    void loadForYm(ym);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym]);

  useEffect(() => {
    setManualRewardDraft((prev) => ({ ...prev, sourceYm: ym }));
  }, [ym]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">支払月</span>
          <select
            value={ym}
            onChange={(event) => setYm(event.target.value)}
            disabled={loading || saving || noticeSavingMemberId != null}
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
          disabled={loading || saving || noticeSavingMemberId != null}
          className="h-9 rounded-md border border-border bg-background px-3 text-[12px] hover:bg-muted/40 disabled:opacity-50"
        >
          {loading ? "読込中..." : "再読込"}
        </button>

        <button
          type="button"
          onClick={() => loadForYm(ym, { refreshRewards: true })}
          disabled={loading || saving || noticeSavingMemberId != null}
          title="billing_cycles.reward_summary_json を再計算してキャッシュを更新する"
          className="h-9 rounded-md border border-border bg-background px-3 text-[12px] hover:bg-muted/40 disabled:opacity-50"
        >
          報酬キャッシュ再計算
        </button>

        <button
          type="button"
          onClick={saveAll}
          disabled={loading || saving || noticeSavingMemberId != null || paymentNudgeSending || expectedEntries.length === 0 || hasBudgetBlocker}
          title={hasBudgetBlocker ? "PJ予算未設定または超過があるため保存できない" : undefined}
          className="h-9 rounded-md bg-foreground px-4 text-[12px] font-medium text-background disabled:opacity-50"
        >
          {saving ? "保存中..." : savedAll ? "再保存" : "支払データ保存"}
        </button>

        <button
          type="button"
          onClick={sendPaymentNudges}
          disabled={loading || saving || noticeSavingMemberId != null || paymentNudgeSending || bulkPdfMode != null}
          className="h-9 rounded-md border border-border bg-background px-3 text-[12px] hover:bg-muted/40 disabled:opacity-50"
        >
          {paymentNudgeSending ? "nudge送信中..." : "入金確認nudge"}
        </button>

        <button
          type="button"
          onClick={() => runBulkPdf(false)}
          disabled={
            loading ||
            saving ||
            noticeSavingMemberId != null ||
            paymentNudgeSending ||
            bulkPdfMode != null ||
            !savedAll ||
            memberRows.length === 0
          }
          title={
            !savedAll
              ? "先に「支払データ保存」を実行してね"
              : "全員分の支払通知書PDFを並列発行 (差分検出あり)"
          }
          className="h-9 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-[12px] text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
        >
          {bulkPdfMode === "issue" ? "本番PDF発行中..." : "全員分PDF一括発行"}
        </button>

        <button
          type="button"
          onClick={() => runBulkPdf(true)}
          disabled={
            loading ||
            saving ||
            noticeSavingMemberId != null ||
            paymentNudgeSending ||
            bulkPdfMode != null ||
            memberRows.length === 0
          }
          title="保存前でも全員分の確認用PDFを並列生成 (DB保存なし)"
          className="h-9 rounded-md border border-border bg-background px-3 text-[12px] hover:bg-muted/40 disabled:opacity-50"
        >
          {bulkPdfMode === "preview" ? "確認用PDF生成中..." : "全員分PDF確認"}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!window.confirm("全員分の支払通知書PDFを強制的に再生成する (= 差分検出を無視)。\n金額が変わってなくてもラベル変更などのコード変更を反映したい時用。\n進める?")) return;
            void runBulkPdf(false, { force: true });
          }}
          disabled={
            loading ||
            saving ||
            noticeSavingMemberId != null ||
            paymentNudgeSending ||
            bulkPdfMode != null ||
            !savedAll ||
            memberRows.length === 0
          }
          title={
            !savedAll
              ? "先に「支払データ保存」を実行してね"
              : "差分検出を無視して全員分のPDFを強制再生成 (コードラベル変更などを反映する用)"
          }
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

      <div className="grid gap-2 md:grid-cols-4">
        <SummaryBox label="対象cycle" value={`${data?.cycles.length ?? 0}件`} sub={`${rewardCycleCount}件に報酬明細あり`} />
        <SummaryBox label="報酬明細" value={`${expectedEntries.length}件`} sub={savedAll ? "保存済み" : "未保存あり"} />
        <SummaryBox label="支払メンバー" value={`${memberRows.length}人`} sub={`通知額 ${data?.notices.length ?? 0}件`} />
        <SummaryBox label="支払総額" value={fmtYen(grandTotal)} sub={`支払月 ${fmtYm(ym)}`} />
      </div>

      <ManualRewardOverridePanel
        ym={ym}
        draft={manualRewardDraft}
        projects={data?.projects ?? []}
        members={data?.members ?? []}
        saving={manualRewardSaving}
        disabled={loading || saving || noticeSavingMemberId != null || paymentNudgeSending}
        onChange={setManualRewardDraft}
        onSave={saveManualRewardOverride}
      />

      <BudgetAuditPanel
        items={budgetAuditItems}
        totals={budgetAuditTotals}
        budgetGroups={budgetConfirmGroups}
        financeGroups={projectFinanceGroups}
        onOpenMonthly={(item) => openMonthlyModal(item.projectId, item.ym, `${item.projectName} ${fmtYm(item.ym)}`)}
        onOpenBudgetConfirm={setBudgetTarget}
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">対象の請求・報酬cycle</h2>
          <span className="text-[11px] text-muted-foreground">
            支払月はPJ台帳の支払条件から自動判定。個別上書きがあるcycleだけ invoice_ym を優先
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
	                        {(stats?.stockYen ?? 0) > 0 && (
	                          <div className="text-[10px] font-normal text-amber-700">
	                            ストック {fmtYen(stats?.stockYen)}
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

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">メンバー別支払</h2>
          <span className="text-[11px] text-muted-foreground">
            `reward_summary_json.members` から `monthly_reward_payout` を作る
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">メンバー</th>
                <th className="px-3 py-2 text-left font-medium">内訳</th>
                <th className="px-3 py-2 text-right font-medium">保存済</th>
                <th className="px-3 py-2 text-right font-medium">支払額</th>
                <th className="px-3 py-2 text-left font-medium">通知</th>
                <th className="px-3 py-2 text-right font-medium">支払通知書</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {memberRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    報酬確定済みのメンバーがいない
                  </td>
                </tr>
              ) : (
                memberRows.map((row) => (
                  <tr key={row.memberId} className="align-top hover:bg-muted/20">
	                    <td className="px-3 py-2">
	                      <div className="font-semibold">{row.memberName}</div>
	                      <div className="font-mono text-[10px] text-muted-foreground">{row.memberId}</div>
	                      {(row.stockYen > 0 || row.carryInYen > 0) && (
	                        <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
	                          {row.carryInYen > 0 && <span className="rounded bg-sky-100 px-1 text-sky-800">繰越入 {fmtYen(row.carryInYen)}</span>}
	                          {row.stockYen > 0 && <span className="rounded bg-amber-100 px-1 text-amber-900">現ストック {fmtYen(row.stockYen)}</span>}
	                        </div>
	                      )}
	                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        {row.entries.map((entry) => {
                          const project = projectMap.get(entry.projectId);
                          return (
                            <button
                              type="button"
                              key={entryKey(entry)}
                              onClick={() => openMonthlyModal(entry.projectId, entry.ym, `${project?.project_name ?? entry.projectId} ${fmtYm(entry.ym)}`)}
                              className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                            >
                              <span className="font-medium">{project?.project_name ?? entry.projectId}</span>
                              <span className="font-mono text-muted-foreground">{fmtYm(entry.ym)}</span>
                              <span className="text-muted-foreground">{fmtPt(entry.earnedPt)}</span>
	                              <span className="text-muted-foreground">base {fmtYen(entry.basePay)}</span>
	                              {entry.bonusPt > 0 ? (
	                                <span className="text-muted-foreground">bonus {fmtYen(entry.bonusPt)}</span>
	                              ) : null}
	                              {entry.carryInYen > 0 ? (
	                                <span className="text-sky-700">繰越 {fmtYen(entry.carryInYen)}</span>
	                              ) : null}
	                              <span className="font-medium">{fmtYen(entry.totalPay)}</span>
	                              {entry.stockYen > 0 ? (
	                                <span className="text-amber-700">stock {fmtYen(entry.stockYen)}</span>
	                              ) : null}
	                              {entry.grossDueYen > entry.totalPay ? (
	                                <span className="text-muted-foreground">due {fmtYen(entry.grossDueYen)}</span>
	                              ) : null}
	                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={row.isSaved ? "text-emerald-700" : "text-amber-700"}>
                        {fmtYen(row.savedTotal)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtYen(row.totalPay)}</td>
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
                        disabled={loading || saving || noticeSavingMemberId != null || noticeMailLoading || noticeMailSending}
                        saving={noticeSavingMemberId === row.memberId || (noticeMailLoading && noticeMailModal?.row.memberId === row.memberId)}
                        onIssueNoticePdf={issueNoticePdf}
                        onOpenPdf={openPdfUrl}
                        onPreviewNoticePdf={previewNoticePdf}
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

      {budgetTarget && (
        <BudgetConfirmModal
          group={budgetTarget}
          saving={budgetSaving}
          onClose={() => {
            if (!budgetSaving) setBudgetTarget(null);
          }}
          onSave={(clientAmountYen, bufferYen, extraPayoutBudgetYen) => saveBudgetGroup(budgetTarget, clientAmountYen, bufferYen, extraPayoutBudgetYen)}
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

function ManualRewardOverridePanel({
  ym,
  draft,
  projects,
  members,
  saving,
  disabled,
  onChange,
  onSave,
}: {
  ym: string;
  draft: ManualRewardDraft;
  projects: Project[];
  members: Member[];
  saving: boolean;
  disabled: boolean;
  onChange: (next: ManualRewardDraft | ((prev: ManualRewardDraft) => ManualRewardDraft)) => void;
  onSave: () => void;
}) {
  const projectOptions = useMemo(
    () => [...projects].sort((a, b) => (a.project_name || a.project_id).localeCompare(b.project_name || b.project_id, "ja")),
    [projects]
  );
  const memberOptions = useMemo(
    () => [...members].sort((a, b) => (a.code_name || a.member_name || a.member_id).localeCompare(b.code_name || b.member_name || b.member_id, "ja")),
    [members]
  );
  const amountYen = parseYenInput(draft.totalPayText);
  const canSave = !disabled && !saving && draft.projectId && draft.memberId && /^[0-9]{6}$/.test(draft.sourceYm) && amountYen > 0;
  const update = (patch: Partial<ManualRewardDraft>) => onChange((prev) => ({ ...prev, ...patch }));

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-sky-950">MSなしPJ 強制報酬確定</h2>
          <p className="mt-0.5 text-[11px] text-sky-900/70">
            PJ / 稼働月 / メンバー / 支払額を指定して、支払月 {fmtYm(ym)} の報酬明細に入れる。
          </p>
        </div>
        <span className="ml-auto rounded bg-background/80 px-2 py-1 text-[11px] text-sky-900">
          admin_manual_payout
        </span>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(180px,1.4fr)_110px_minmax(160px,1fr)_130px_minmax(180px,1fr)_auto]">
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">PJ</span>
          <select
            value={draft.projectId}
            onChange={(event) => update({ projectId: event.target.value })}
            disabled={disabled || saving}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-[12px]"
          >
            <option value="">選択</option>
            {projectOptions.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {project.project_name || project.project_id}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">稼働月</span>
          <input
            value={draft.sourceYm}
            onChange={(event) => update({ sourceYm: event.target.value.replace(/[^0-9]/g, "").slice(0, 6) })}
            inputMode="numeric"
            placeholder="YYYYMM"
            disabled={disabled || saving}
            className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-[12px]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">メンバー</span>
          <select
            value={draft.memberId}
            onChange={(event) => update({ memberId: event.target.value })}
            disabled={disabled || saving}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-[12px]"
          >
            <option value="">選択</option>
            {memberOptions.map((member) => (
              <option key={member.member_id} value={member.member_id}>
                {member.code_name || member.member_name || member.member_id}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">支払額</span>
          <input
            value={draft.totalPayText}
            onChange={(event) => update({ totalPayText: event.target.value })}
            inputMode="numeric"
            placeholder="例: 80000"
            disabled={disabled || saving}
            className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-[12px]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">メモ</span>
          <input
            value={draft.note}
            onChange={(event) => update({ note: event.target.value })}
            disabled={disabled || saving}
            placeholder="例: MS未設定PJの月次固定"
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-[12px]"
          />
        </label>

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="self-end rounded-md bg-sky-950 px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50"
        >
          {saving ? "確定中..." : "強制確定"}
        </button>
      </div>
    </section>
  );
}

function BudgetAuditPanel({
  items,
  totals,
  budgetGroups,
  financeGroups,
  onOpenMonthly,
  onOpenBudgetConfirm,
}: {
  items: BudgetAuditItem[];
  totals: { budgetYen: number; payoutYen: number; overYen: number; missingBudgetCount: number; unpaidCount: number };
  budgetGroups: BudgetConfirmGroup[];
  financeGroups: ProjectFinanceGroup[];
  onOpenMonthly: (item: BudgetAuditItem) => void;
  onOpenBudgetConfirm: (group: BudgetConfirmGroup) => void;
}) {
  const financeTotals = useMemo(() => {
    return financeGroups.reduce(
      (acc, group) => ({
        baseClientAmountYen: acc.baseClientAmountYen + group.baseClientAmountYen,
        bufferYen: acc.bufferYen + group.bufferYen,
        baseCapYen: acc.baseCapYen + group.baseCapYen,
        extraPayoutBudgetYen: acc.extraPayoutBudgetYen + group.extraPayoutBudgetYen,
        budgetYen: acc.budgetYen + group.budgetYen,
        payoutYen: acc.payoutYen + group.payoutYen,
        officerPayoutYen: acc.officerPayoutYen + group.officerPayoutYen,
        officerOffsetYen: acc.officerOffsetYen + group.officerOffsetYen,
        finalBalanceYen: acc.finalBalanceYen + group.finalBalanceYen,
      }),
      { baseClientAmountYen: 0, bufferYen: 0, baseCapYen: 0, extraPayoutBudgetYen: 0, budgetYen: 0, payoutYen: 0, officerPayoutYen: 0, officerOffsetYen: 0, finalBalanceYen: 0 }
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
      : `最終収支 ${fmtYen(financeTotals.finalBalanceYen)}`;
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
    key: "baseClientAmountYen" | "bufferYen" | "baseCapYen" | "extraPayoutBudgetYen" | "budgetYen" | "payoutYen" | "officerPayoutYen" | "officerOffsetYen" | "finalBalanceYen"
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
    if (missing) return { label: "PJ予算未設定", className: "bg-red-100 text-red-800" };
    if (over) return { label: `不足 ${fmtYen(Math.abs(columnMoney(group, "finalBalanceYen")))}`, className: "bg-red-100 text-red-800" };
    if (stockYen > 0) return { label: `cap発動 ${fmtYen(stockYen)}`, className: "bg-amber-100 text-amber-800" };
    return { label: `OK ${fmtYen(columnMoney(group, "finalBalanceYen"))}`, className: "bg-emerald-100 text-emerald-800" };
  };

  return (
    <section className={`rounded-lg border ${overallTone} p-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-[13px] font-semibold">PJ別収支 / 予算チェック</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            65%対象委託料、バッファ、cap外追加、PJ予算、メンバー別支払、役員分の相殺をPJごとに見る。
            役員ONの支払額は同額を加算して相殺し、最終収支には支払対象外として残す。
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 text-[11px]">
          <span className="rounded bg-background/80 px-2 py-1">65%対象 {fmtYen(financeTotals.baseClientAmountYen)}</span>
          <span className="rounded bg-background/80 px-2 py-1">バッファ {fmtYen(financeTotals.bufferYen)}</span>
          <span className="rounded bg-background/80 px-2 py-1">通常cap {fmtYen(financeTotals.baseCapYen)}</span>
          {financeTotals.extraPayoutBudgetYen > 0 && (
            <span className="rounded bg-background/80 px-2 py-1">cap外追加 {fmtYen(financeTotals.extraPayoutBudgetYen)}</span>
          )}
          <span className="rounded bg-background/80 px-2 py-1">PJ予算 {fmtYen(financeTotals.budgetYen)}</span>
          <span className="rounded bg-background/80 px-2 py-1">支払予定 {fmtYen(financeTotals.payoutYen)}</span>
          {financeTotals.officerPayoutYen > 0 && (
            <span className="rounded bg-background/80 px-2 py-1">役員相殺 {fmtYen(financeTotals.officerOffsetYen)}</span>
          )}
          <span className={`rounded px-2 py-1 font-semibold ${overallOver ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            {overallText}
          </span>
        </div>
      </div>

      {budgetGroups.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-background/70 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-amber-800">PJ予算確定・調整</span>
            <span className="text-[11px] text-muted-foreground">
              65%対象の通常委託料とは別に、OkuDoor追加開発などのcap外追加支払枠を足せる。
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {budgetGroups.map((group) => {
              const firstYm = group.items[0]?.ym ?? "";
              const lastYm = group.items[group.items.length - 1]?.ym ?? firstYm;
              const rangeLabel = firstYm === lastYm ? fmtYm(firstYm) : `${fmtYm(firstYm)}-${fmtYm(lastYm)}`;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => onOpenBudgetConfirm(group)}
                  className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-left text-[11px] hover:bg-amber-100"
                >
                  <span className="font-semibold">{group.projectName}</span>
                  <span className="ml-2 font-mono text-muted-foreground">{rangeLabel}</span>
                  <span className="ml-2">支払月 {fmtYm(group.invoiceYm)}</span>
                  <span className="ml-2 font-semibold">支払予定 {fmtYen(group.totalPayoutYen)}</span>
                  {group.totalStockYen > 0 ? (
                    <span className="ml-2 text-amber-800">stock {fmtYen(group.totalStockYen)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
                        {(column.group ? column.group.cycles : allCycleYms.map((ym) => ({ key: `all:${ym}`, ym, invoiceYm: "", baseClientAmountYen: 0, bufferYen: 0, baseCapYen: 0, extraPayoutBudgetYen: 0, budgetYen: 0, payoutYen: 0, officerPayoutYen: 0, officerOffsetYen: 0, finalBalanceYen: 0 }))).map((cycle) => {
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
                  ["通常cap", "baseCapYen"],
                  ["cap外追加", "extraPayoutBudgetYen"],
                  ["PJ予算", "budgetYen"],
                  ["支払予定", "payoutYen"],
                  ["役員分", "officerPayoutYen"],
                  ["役員相殺", "officerOffsetYen"],
                  ["最終収支", "finalBalanceYen"],
                ].map(([label, key]) => (
                  <tr key={key}>
                    <th className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-2 text-left font-medium">{label}</th>
                    {financeColumns.map((column) => {
                      const value = columnMoney(column.group, key as "baseClientAmountYen" | "bufferYen" | "baseCapYen" | "extraPayoutBudgetYen" | "budgetYen" | "payoutYen" | "officerPayoutYen" | "officerOffsetYen" | "finalBalanceYen");
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

function buildBudgetAllocations(
  group: BudgetConfirmGroup,
  basePjBudgetTotal: number,
  extraPayoutBudgetYen: number,
  hasClientAmount: boolean
) {
  let allocatedBase = 0;
  let allocatedExtra = 0;
  const totalPayout = group.totalPayoutYen;
  return group.items.map((item, index) => {
    const isLast = index === group.items.length - 1;
    const weight = totalPayout > 0 ? item.payoutYen / totalPayout : 1 / group.items.length;
    const baseBudgetYen = isLast ? basePjBudgetTotal - allocatedBase : Math.round(basePjBudgetTotal * weight);
    const extraBudgetYen = isLast ? extraPayoutBudgetYen - allocatedExtra : Math.round(extraPayoutBudgetYen * weight);
    const budgetYen = baseBudgetYen + extraBudgetYen;
    allocatedBase += baseBudgetYen;
    allocatedExtra += extraBudgetYen;
    return {
      ...item,
      allocatedBaseBudgetYen: baseBudgetYen,
      allocatedExtraPayoutBudgetYen: extraBudgetYen,
      allocatedBudgetYen: budgetYen,
      remainingYen: hasClientAmount ? budgetYen - item.payoutYen : null,
    };
  });
}

function BudgetConfirmModal({
  group,
  saving,
  onClose,
  onSave,
}: {
  group: BudgetConfirmGroup;
  saving: boolean;
  onClose: () => void;
  onSave: (clientAmountYen: number, bufferYen: number, extraPayoutBudgetYen: number) => void;
}) {
  const [clientAmountText, setClientAmountText] = useState(group.baseClientAmountYen > 0 ? String(group.baseClientAmountYen) : "");
  const [bufferText, setBufferText] = useState(group.bufferYen > 0 ? String(group.bufferYen) : "0");
  const [extraPayoutText, setExtraPayoutText] = useState(group.extraPayoutBudgetYen > 0 ? String(group.extraPayoutBudgetYen) : "");
  const clientAmountYen = parseYenInput(clientAmountText);
  const bufferYen = Math.max(0, parseYenInput(bufferText));
  const extraPayoutBudgetYen = Math.max(0, parseYenInput(extraPayoutText));
  const basePjBudgetTotal = Math.max(0, Math.round(clientAmountYen * 0.65) - bufferYen);
  const pjBudgetTotal = basePjBudgetTotal + extraPayoutBudgetYen;
  const hasClientAmount = clientAmountYen > 0;
  const remainingAfterPayout = hasClientAmount ? pjBudgetTotal - group.totalPayoutYen : null;

  const allocations = useMemo(
    () => buildBudgetAllocations(group, basePjBudgetTotal, extraPayoutBudgetYen, hasClientAmount),
    [basePjBudgetTotal, extraPayoutBudgetYen, group, hasClientAmount]
  );

  const firstYm = group.items[0]?.ym ?? "";
  const lastYm = group.items[group.items.length - 1]?.ym ?? firstYm;
  const rangeLabel = firstYm === lastYm ? fmtYm(firstYm) : `${fmtYm(firstYm)}-${fmtYm(lastYm)}`;
  const riskMessage = !hasClientAmount
    ? "契約未確定の間は正式な予算超過判定を保留する。通常委託料は確定した税抜額、cap外追加は追加受託で支払う合意額だけを入れる。"
    : remainingAfterPayout != null && remainingAfterPayout < 0
      ? "この入力だとPJ予算が支払予定を下回る。支払可否、減額、バッファ、追加請求、cap外追加支払枠の合意を先に確認する。"
      : "この入力なら支払予定はPJ予算内。保存すると稼働月ごとの支払可能額として固定される。";
  const riskTone = !hasClientAmount
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : remainingAfterPayout != null && remainingAfterPayout < 0
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-[min(720px,96vw)] overflow-hidden rounded-lg border border-border bg-background text-[12px] shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-start gap-2">
            <div>
              <h3 className="text-[14px] font-semibold">PJ予算を確定</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {group.projectName} / 稼働月 {rangeLabel} / 支払月 {fmtYm(group.invoiceYm)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="ml-auto rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40 disabled:opacity-50"
            >
              閉じる
            </button>
          </div>
        </div>

        <div className="space-y-4 px-4 py-3">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">65%対象の通常委託料</span>
              <input
                value={clientAmountText}
                onChange={(event) => setClientAmountText(event.target.value)}
                inputMode="numeric"
                placeholder="例: 300000"
                className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-[12px]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">控除バッファ</span>
              <input
                value={bufferText}
                onChange={(event) => setBufferText(event.target.value)}
                inputMode="numeric"
                className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-[12px]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">cap外追加支払枠</span>
              <input
                value={extraPayoutText}
                onChange={(event) => setExtraPayoutText(event.target.value)}
                inputMode="numeric"
                placeholder="例: 80000"
                className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-[12px]"
              />
            </label>
            <button
              type="button"
              onClick={() => onSave(clientAmountYen, bufferYen, extraPayoutBudgetYen)}
              disabled={saving || clientAmountYen <= 0}
              className="self-end rounded-md bg-foreground px-4 py-2 text-[12px] font-medium text-background disabled:opacity-50"
            >
              {saving ? "保存中..." : "確定して配分"}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <SummaryBox label="通常委託料" value={fmtYen(clientAmountYen)} sub="65%対象" />
            <SummaryBox label="通常cap" value={fmtYen(basePjBudgetTotal)} sub="65% - バッファ" />
            <SummaryBox label="cap外追加" value={fmtYen(extraPayoutBudgetYen)} sub="追加受託分" />
            <SummaryBox label="PJ予算" value={fmtYen(pjBudgetTotal)} sub="通常cap + 追加" />
            <SummaryBox label="支払予定" value={fmtYen(group.totalPayoutYen)} sub={`${group.items.length}か月分`} />
            <SummaryBox label="現ストック" value={fmtYen(group.totalStockYen)} sub="capで繰越中" />
            <SummaryBox
              label="残り"
              value={remainingAfterPayout == null ? "—" : fmtSignedYen(remainingAfterPayout)}
              sub={remainingAfterPayout == null ? "入力後に計算" : remainingAfterPayout < 0 ? "支払予定が超過" : "支払後の余力"}
            />
          </div>

          <div className={`rounded-md border px-3 py-2 text-[11px] ${riskTone}`}>
            {group.projectStatus === "lost" ? "このPJは失注ステータス。契約が取れなかった場合の支払は個別合意が必要。 " : ""}
            {riskMessage}
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">稼働月</th>
                  <th className="px-3 py-2 text-right font-medium">支払予定</th>
                  <th className="px-3 py-2 text-right font-medium">配分通常cap</th>
                  <th className="px-3 py-2 text-right font-medium">配分cap外</th>
                  <th className="px-3 py-2 text-right font-medium">配分PJ予算</th>
                  <th className="px-3 py-2 text-right font-medium">残り</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allocations.map((item) => (
                  <tr key={item.key}>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{fmtYm(item.ym)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtYen(item.payoutYen)}</td>
                    <td className="px-3 py-2 text-right">{fmtYen(item.allocatedBaseBudgetYen)}</td>
                    <td className="px-3 py-2 text-right">{fmtYen(item.allocatedExtraPayoutBudgetYen)}</td>
                    <td className="px-3 py-2 text-right">{fmtYen(item.allocatedBudgetYen)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${
                      item.remainingYen == null
                        ? "text-muted-foreground"
                        : item.remainingYen < 0
                          ? "text-red-700"
                          : "text-emerald-700"
                    }`}>
                      {item.remainingYen == null ? "—" : fmtSignedYen(item.remainingYen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayoutNoticeActions({
  row,
  disabled,
  saving,
  onIssueNoticePdf,
  onOpenPdf,
  onPreviewNoticePdf,
  onUpdateNoticeSent,
  onOpenSendMailModal,
}: {
  row: MemberPayoutRow;
  disabled: boolean;
  saving: boolean;
  onIssueNoticePdf: (row: MemberPayoutRow, options?: { forceReissue?: boolean }) => void;
  onOpenPdf: (pdfUrl: string | null | undefined) => void;
  onPreviewNoticePdf: (row: MemberPayoutRow) => void;
  onUpdateNoticeSent: (row: MemberPayoutRow, patch: NoticeSavePatch) => void;
  onOpenSendMailModal: (row: MemberPayoutRow) => void;
}) {
  if (row.noticeExcluded) {
    return <span className="block text-right text-[11px] text-muted-foreground">通知対象外</span>;
  }

  const blocked = disabled || saving;
  const canIssuePdf = !blocked && row.isSaved;
  const hasPdf = Boolean(row.notice?.pdf_url);
  const canPreviewPdf = !blocked && row.totalPay > 0;
  const isSent = Boolean(row.notice?.sent_at);
  const canOpenSendModal = !blocked && hasPdf && row.isSaved && !isSent;
  const canClearSent = !blocked && isSent;
  const savedNoticeTotal = Math.round(numberValue(row.notice?.total_yen));
  const totalMismatch = savedNoticeTotal > 0 && savedNoticeTotal !== Math.round(row.totalPay);
  const issueTitle = row.isSaved
    ? hasPdf
      ? "改善版フォーマットの支払通知書PDFを再発行する"
      : "改善版フォーマットの支払通知書PDFを発行する"
    : "先に支払データ保存を押すと発行できる";
  const pdfTitle = hasPdf
    ? "保存済みPDFを別タブで確認する"
    : "支払データ保存前でも確認用PDFを作成してフォーマットを見る";
  const sentTitle = isSent
    ? "送付済みを取り消して未送付に戻す (メールは取り消されない)"
    : hasPdf
      ? row.isSaved
        ? "確認モーダルを開いてメンバーに支払通知メールを送信する"
        : "先に支払データ保存を押すと送信できる"
      : "PDF発行後に送信できる";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onIssueNoticePdf(row, { forceReissue: hasPdf })}
          disabled={!canIssuePdf}
          title={issueTitle}
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40 disabled:opacity-50"
        >
          {saving ? "発行中..." : "支払通知書発行"}
        </button>
        <button
          type="button"
          onClick={() => (hasPdf ? onOpenPdf(row.notice?.pdf_url) : onPreviewNoticePdf(row))}
          disabled={!canPreviewPdf}
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
          {isSent ? "送付取消" : "送付"}
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
      {!row.isSaved && (
        <div className="text-right text-[10px] text-amber-700">確認用PDFは保存前でも作成可 / 発行・送付は保存後</div>
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
              「はい・送信」を押すと再度メールが送信され、sent_at が上書きされる。
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-[10px] text-muted-foreground">
            「はい・送信」を押すと {preview.to} に Gmail から実送信されます
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
