"use client";

import { useEffect, useMemo, useState } from "react";
import { CockpitMonthlyModal } from "@/components/cockpit/CockpitMonthlyModal";
import { fetchCockpitFromSupabase, type CockpitData } from "@/lib/supabase-data";

type Member = {
  member_id: string;
  code_name: string;
  member_name: string | null;
  email: string | null;
  status: string;
  is_officer?: boolean | null;
  exclude_from_payout_notice?: boolean | null;
};

type Project = {
  project_id: string;
  project_name: string;
  status: string | null;
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
  budgetYen: number;
  payoutYen: number;
  paymentConfirmed: boolean;
};

type ProjectFinanceCycleLine = {
  key: string;
  ym: string;
  invoiceYm: string;
  clientAmountYen: number;
  bufferYen: number;
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
  clientAmountYen: number;
  bufferYen: number;
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
  currentBudgetYen: number;
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
  const [paymentNudgeSending, setPaymentNudgeSending] = useState(false);
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
    () => buildEntries(data?.cycles ?? [], memberMap, officerMemberIds),
    [data?.cycles, memberMap, officerMemberIds]
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
      return {
        key: `${cycle.project_id}:${cycle.ym}`,
        projectId: cycle.project_id,
        ym: cycle.ym,
        invoiceYm: cycle.invoice_ym || cycle.ym,
        projectName: project?.project_name ?? cycle.project_id,
        projectStatus: project?.status ?? null,
        budgetYen: Math.round(numberValue(cycle.budget_yen)),
        payoutYen: Math.round(stats?.totalPay ?? 0),
        paymentConfirmed: Boolean(cycle.payment_confirmed_at),
      };
    }).filter((item) => item.budgetYen > 0 || item.payoutYen > 0);
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
          clientAmountYen: 0,
          bufferYen: 0,
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
      const clientAmountYen = Math.round(numberValue(cycle.budget_reported_amount));
      const bufferYen = Math.round(numberValue(cycle.budget_buffer_amount));
      const finalBalanceYen = budgetYen - payoutYen - officerPayoutYen + officerOffsetYen;

      group.clientAmountYen += clientAmountYen;
      group.bufferYen += bufferYen;
      group.budgetYen += budgetYen;
      group.payoutYen += payoutYen;
      group.officerPayoutYen += officerPayoutYen;
      group.officerOffsetYen += officerOffsetYen;
      group.finalBalanceYen += finalBalanceYen;
      group.cycles.push({
        key: cycleKeyValue,
        ym: cycle.ym,
        invoiceYm: cycle.invoice_ym || cycle.ym,
        clientAmountYen,
        bufferYen,
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
      .filter((group) => group.budgetYen > 0 || group.payoutYen > 0 || group.officerPayoutYen > 0 || group.clientAmountYen > 0)
      .sort((a, b) => a.projectName.localeCompare(b.projectName, "ja"));
  }, [data?.cycles, expectedEntries, officerReserveEntries, projectMap]);

  const budgetConfirmGroups = useMemo<BudgetConfirmGroup[]>(() => {
    const map = new Map<string, BudgetConfirmGroup>();
    for (const item of budgetAuditItems) {
      if (item.payoutYen <= 0) continue;
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
          currentBudgetYen: 0,
        };
      group.items.push(item);
      group.totalPayoutYen += item.payoutYen;
      group.currentBudgetYen += item.budgetYen;
      map.set(key, group);
    }

    return [...map.values()]
      .filter((group) => group.items.some((item) => item.budgetYen <= 0 && item.payoutYen > 0))
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

  async function saveBudgetGroup(group: BudgetConfirmGroup, clientAmountYen: number, bufferYen: number) {
    if (clientAmountYen <= 0) {
      setHint("確定した業務委託料を入力してね");
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
      setHint(
        `${group.projectName} ${fmtYm(group.items[0]?.ym ?? "")}-${fmtYm(group.items[group.items.length - 1]?.ym ?? "")} のPJ予算 ${fmtYen(payload.pjBudgetTotal ?? 0)} を確定`
      );
    } catch (err) {
      setHint(err instanceof Error ? err.message : "PJ予算の保存エラー");
    } finally {
      setBudgetSaving(false);
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
          disabled={loading || saving || noticeSavingMemberId != null || paymentNudgeSending}
          className="h-9 rounded-md border border-border bg-background px-3 text-[12px] hover:bg-muted/40 disabled:opacity-50"
        >
          {paymentNudgeSending ? "nudge送信中..." : "入金確認nudge"}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-[12px]">
          <span className="text-muted-foreground">{hint}</span>
          <span className="font-semibold">合計 {fmtYen(grandTotal)}</span>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <SummaryBox label="対象cycle" value={`${data?.cycles.length ?? 0}件`} sub={`${rewardCycleCount}件に報酬明細あり`} />
        <SummaryBox label="報酬明細" value={`${expectedEntries.length}件`} sub={savedAll ? "保存済み" : "未保存あり"} />
        <SummaryBox label="支払メンバー" value={`${memberRows.length}人`} sub={`通知額 ${data?.notices.length ?? 0}件`} />
        <SummaryBox label="支払総額" value={fmtYen(grandTotal)} sub={`支払月 ${fmtYm(ym)}`} />
      </div>

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
                        disabled={loading || saving || noticeSavingMemberId != null}
                        saving={noticeSavingMemberId === row.memberId}
                        onIssueNoticePdf={issueNoticePdf}
                        onOpenPdf={openPdfUrl}
                        onPreviewNoticePdf={previewNoticePdf}
                        onUpdateNoticeSent={updateNoticeSent}
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
          onSave={(clientAmountYen, bufferYen) => saveBudgetGroup(budgetTarget, clientAmountYen, bufferYen)}
        />
      )}
    </div>
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
        clientAmountYen: acc.clientAmountYen + group.clientAmountYen,
        bufferYen: acc.bufferYen + group.bufferYen,
        budgetYen: acc.budgetYen + group.budgetYen,
        payoutYen: acc.payoutYen + group.payoutYen,
        officerPayoutYen: acc.officerPayoutYen + group.officerPayoutYen,
        officerOffsetYen: acc.officerOffsetYen + group.officerOffsetYen,
        finalBalanceYen: acc.finalBalanceYen + group.finalBalanceYen,
      }),
      { clientAmountYen: 0, bufferYen: 0, budgetYen: 0, payoutYen: 0, officerPayoutYen: 0, officerOffsetYen: 0, finalBalanceYen: 0 }
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
    key: "clientAmountYen" | "bufferYen" | "budgetYen" | "payoutYen" | "officerPayoutYen" | "officerOffsetYen" | "finalBalanceYen"
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
  const columnIsOver = (group: ProjectFinanceGroup | null) => columnMoney(group, "finalBalanceYen") < 0;
  const columnBadge = (group: ProjectFinanceGroup | null) => {
    const missing = columnHasMissingBudget(group);
    const over = columnIsOver(group);
    if (missing) return { label: "PJ予算未設定", className: "bg-red-100 text-red-800" };
    if (over) return { label: `不足 ${fmtYen(Math.abs(columnMoney(group, "finalBalanceYen")))}`, className: "bg-red-100 text-red-800" };
    return { label: `OK ${fmtYen(columnMoney(group, "finalBalanceYen"))}`, className: "bg-emerald-100 text-emerald-800" };
  };

  return (
    <section className={`rounded-lg border ${overallTone} p-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-[13px] font-semibold">PJ別収支 / 予算チェック</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            クライアント支払額、バッファ、PJ予算、メンバー別支払、役員分の相殺をPJごとに見る。
            役員ONの支払額は同額を加算して相殺し、最終収支には支払対象外として残す。
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 text-[11px]">
          <span className="rounded bg-background/80 px-2 py-1">クライアント支払 {fmtYen(financeTotals.clientAmountYen)}</span>
          <span className="rounded bg-background/80 px-2 py-1">バッファ {fmtYen(financeTotals.bufferYen)}</span>
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
            <span className="text-[11px] font-semibold text-amber-800">確定待ちのPJ予算</span>
            <span className="text-[11px] text-muted-foreground">
              契約未確定中は予算超過を断定しない。確定委託料を入れると、稼働月ごとの支払予定比率でPJ予算を配分する。
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
                        {(column.group ? column.group.cycles : allCycleYms.map((ym) => ({ key: `all:${ym}`, ym, invoiceYm: "", clientAmountYen: 0, bufferYen: 0, budgetYen: 0, payoutYen: 0, officerPayoutYen: 0, officerOffsetYen: 0, finalBalanceYen: 0 }))).map((cycle) => {
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
                  ["クライアント支払", "clientAmountYen"],
                  ["バッファ", "bufferYen"],
                  ["PJ予算", "budgetYen"],
                  ["支払予定", "payoutYen"],
                  ["役員分", "officerPayoutYen"],
                  ["役員相殺", "officerOffsetYen"],
                  ["最終収支", "finalBalanceYen"],
                ].map(([label, key]) => (
                  <tr key={key}>
                    <th className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-2 text-left font-medium">{label}</th>
                    {financeColumns.map((column) => {
                      const value = columnMoney(column.group, key as "clientAmountYen" | "bufferYen" | "budgetYen" | "payoutYen" | "officerPayoutYen" | "officerOffsetYen" | "finalBalanceYen");
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

function BudgetConfirmModal({
  group,
  saving,
  onClose,
  onSave,
}: {
  group: BudgetConfirmGroup;
  saving: boolean;
  onClose: () => void;
  onSave: (clientAmountYen: number, bufferYen: number) => void;
}) {
  const [clientAmountText, setClientAmountText] = useState("");
  const [bufferText, setBufferText] = useState("0");
  const clientAmountYen = parseYenInput(clientAmountText);
  const bufferYen = Math.max(0, parseYenInput(bufferText));
  const pjBudgetTotal = Math.max(0, Math.round(clientAmountYen * 0.65) - bufferYen);
  const hasClientAmount = clientAmountYen > 0;
  const remainingAfterPayout = hasClientAmount ? pjBudgetTotal - group.totalPayoutYen : null;

  const allocations = useMemo(() => {
    let allocated = 0;
    const totalPayout = group.totalPayoutYen;
    return group.items.map((item, index) => {
      const isLast = index === group.items.length - 1;
      const budgetYen = isLast
        ? pjBudgetTotal - allocated
        : Math.round(pjBudgetTotal * (totalPayout > 0 ? item.payoutYen / totalPayout : 1 / group.items.length));
      allocated += budgetYen;
      return {
        ...item,
        allocatedBudgetYen: budgetYen,
        remainingYen: hasClientAmount ? budgetYen - item.payoutYen : null,
      };
    });
  }, [group.items, group.totalPayoutYen, hasClientAmount, pjBudgetTotal]);

  const firstYm = group.items[0]?.ym ?? "";
  const lastYm = group.items[group.items.length - 1]?.ym ?? firstYm;
  const rangeLabel = firstYm === lastYm ? fmtYm(firstYm) : `${fmtYm(firstYm)}-${fmtYm(lastYm)}`;
  const riskMessage = !hasClientAmount
    ? "契約未確定の間は正式な予算超過判定を保留する。想定額ではなく、確定した税抜委託料だけを入れる。"
    : remainingAfterPayout != null && remainingAfterPayout < 0
      ? "この確定額だとPJ予算が支払予定を下回る。支払可否、減額、バッファ、追加請求の合意を先に確認する。"
      : "この確定額なら支払予定はPJ予算内。保存すると稼働月ごとの予算として固定される。";
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
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">確定した業務委託料</span>
              <input
                value={clientAmountText}
                onChange={(event) => setClientAmountText(event.target.value)}
                inputMode="numeric"
                placeholder="例: 2625000"
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
            <button
              type="button"
              onClick={() => onSave(clientAmountYen, bufferYen)}
              disabled={saving || clientAmountYen <= 0}
              className="self-end rounded-md bg-foreground px-4 py-2 text-[12px] font-medium text-background disabled:opacity-50"
            >
              {saving ? "保存中..." : "確定して配分"}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <SummaryBox label="業務委託料" value={fmtYen(clientAmountYen)} sub="税抜・確定額" />
            <SummaryBox label="PJ予算" value={fmtYen(pjBudgetTotal)} sub="65% - バッファ" />
            <SummaryBox label="支払予定" value={fmtYen(group.totalPayoutYen)} sub={`${group.items.length}か月分`} />
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
                  <th className="px-3 py-2 text-right font-medium">配分PJ予算</th>
                  <th className="px-3 py-2 text-right font-medium">残り</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allocations.map((item) => (
                  <tr key={item.key}>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{fmtYm(item.ym)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtYen(item.payoutYen)}</td>
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
}: {
  row: MemberPayoutRow;
  disabled: boolean;
  saving: boolean;
  onIssueNoticePdf: (row: MemberPayoutRow, options?: { forceReissue?: boolean }) => void;
  onOpenPdf: (pdfUrl: string | null | undefined) => void;
  onPreviewNoticePdf: (row: MemberPayoutRow) => void;
  onUpdateNoticeSent: (row: MemberPayoutRow, patch: NoticeSavePatch) => void;
}) {
  if (row.noticeExcluded) {
    return <span className="block text-right text-[11px] text-muted-foreground">通知対象外</span>;
  }

  const blocked = disabled || saving;
  const canIssuePdf = !blocked && row.isSaved;
  const hasPdf = Boolean(row.notice?.pdf_url);
  const canPreviewPdf = !blocked && row.totalPay > 0;
  const canToggleSent = !blocked && hasPdf;
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
  const sentTitle = hasPdf
    ? row.notice?.sent_at
      ? "送付済みを取り消して未送付に戻す"
      : "送付済みにする"
    : "PDF発行後に送付済みにできる";

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
          onClick={() => onUpdateNoticeSent(row, row.notice?.sent_at ? { clearSent: true } : { markSent: true })}
          disabled={!canToggleSent}
          title={sentTitle}
          className="rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background disabled:opacity-50"
        >
          {row.notice?.sent_at ? "送付取消" : "送付"}
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
    </div>
  );
}
