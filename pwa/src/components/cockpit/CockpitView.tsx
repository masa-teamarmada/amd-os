"use client";
import { ProjectContractList } from "@/components/project-workspace/ProjectContractList";

import { useEffect, useState } from "react";
import { ProjectSpaceLayout } from "@/components/nav/ProjectSpaceLayout";
import { ProjectPageMenu } from "@/components/nav/ProjectPageMenu";
import { CockpitHeader } from "./CockpitHeader";
import { ProjectOverviewFormat } from "./ProjectOverviewFormat";
import { CockpitManagementScoreHero } from "./CockpitManagementScoreHero";
import { CockpitGoalsCompact } from "./CockpitGoalsCompact";
import { CockpitGoalTreePoints } from "./CockpitGoalTreePoints";
import { CockpitStrategySignals } from "./CockpitStrategySignals";
import { Bzm22AcquisitionLedger } from "./Bzm22AcquisitionLedger";
import { CockpitAmdContributions } from "./CockpitAmdContributions";
import { CockpitGrants } from "./CockpitGrants";
import { WorkspaceDocumentRoom } from "@/components/workspace-documents/WorkspaceDocumentRoom";
import { CockpitIpPortfolio } from "@/components/cockpit/CockpitIpPortfolio";
import { CockpitTechnology } from "@/components/cockpit/CockpitTechnology";
import { InstitutionRegulationsPanel } from "@/components/institutions/InstitutionRegulations";
import { ProjectInstitutionSeeds } from "./CockpitKuteSeeds";
import { CockpitSeasonFinance } from "./CockpitSeasonFinance";
import { CockpitMsChangeHistory } from "./CockpitMsChangeHistory";
import { CockpitMonthlyReports, prefetchMonthlyReports } from "./CockpitMonthlyReports";
import { CockpitMonthlyList } from "./CockpitMonthlyList";
import { CockpitMonthlyModal } from "./CockpitMonthlyModal";
import { CockpitMeetingSummary } from "./CockpitMeetingSummary";
import { CockpitSlackMessages } from "./CockpitSlackMessages";
import { CockpitFreezeBackfill } from "./CockpitFreezeBackfill";
import { CockpitAmdScoreDetailTab } from "./CockpitAmdScoreDetailTab";
import { CockpitCompanyOverview } from "./CockpitCompanyOverview";
import { CockpitKillerFactorCatalog } from "./CockpitKillerFactorCatalog";
import { CockpitProjectOverview } from "./CockpitProjectOverview";
import { CockpitSeasonBudget } from "./CockpitSeasonBudget";
import { CockpitProjectControl } from "./CockpitProjectControl";
import { CockpitProjectTasks } from "./CockpitProjectTasks";
import type { SxWeeklyControlView } from "@/components/project-workspace/SxWeeklyControlDashboard";
import { InternalProjectSurfaceNav } from "@/components/nav/ProjectSurfaceNav";
import { CockpitBusinessPlan } from "./CockpitBusinessPlan";
import { CockpitFinancialProjection } from "./CockpitFinancialProjection";
import { CockpitCapitalPlan } from "./CockpitCapitalPlan";
import { CockpitCapitalPolicy } from "./CockpitCapitalPolicy";
import type { CockpitTab } from "@/lib/cockpit-tabs";
import { prefetchGovernance } from "@/lib/governance-client";
import type { CockpitSeasonFinance as CockpitSeasonFinanceData, MilestoneChangeHistory } from "@/lib/supabase-data";
import type { ProjectContractTerms } from "@/lib/project-contract-terms";
import { CockpitCostTab } from "@/components/cockpit/CockpitCostTab";
import { prefetchProjectOrg } from "@/lib/project-org-client";
import { prefetchProjectCostModel, prefetchProjectFuelCostModel } from "@/lib/project-cost-model-client";
import { prefetchProjectTech } from "@/lib/project-tech-client";
import { prefetchProjectBusinessPlan } from "@/lib/project-business-plan-client";
import { prefetchProjectOverview } from "@/lib/project-overview-client";
import { prefetchBusinessSummary } from "@/lib/business-summary-client";
import { prefetchQuestionTree } from "@/lib/question-tree-client";
import { prefetchSeasonBudget } from "@/lib/season-budget-client";
import {
  DEFAULT_COCKPIT_TAB,
  cockpitGroupForTabInType,
  cockpitGroupsForType,
  resolveCockpitTabForType,
  type CockpitGroupKey,
} from "@/lib/cockpit-tabs";
import { projectFormatTypeOf, PROJECT_PAGE_LABELS } from "@/lib/project-formats";
import { fetchInstitutionIdForProject } from "@/lib/seeds-data";

interface PlanCycleShape {
  planCycleId: string; status: string; budgetYen: number; extraDesignBudgetYen?: number; totalPoints: number;
  periodStartYm: string; periodEndYm: string;
}

interface ProgressShape {
  milestoneKey: string;
  ym: string;
  progressPct: number;
  consumedPt: number;
  source?: string;
  note?: string | null;
}

interface PlanCycleBundle {
  planCycle: PlanCycleShape;
  milestones: Array<{
    milestoneId: string; title: string; points: number; tag: string;
    goalLevel: string; successCriteria: string; sortOrder: number;
    periodStartYm?: string | null; targetYm?: string | null;
  }>;
  progress: ProgressShape[];
  subItems: Array<{
    subItemId: string; milestoneId: string; title: string;
    weight: number; status: string; assignee: string;
  }>;
  responsibilities: Array<{
    milestoneId: string; memberId: string; share: number;
  }>;
  msActivities?: Array<{
    memberId: string; milestoneId: string; ym: string;
    narrative?: string | null; learnedAddendum?: string | null; generatedAt?: string | null;
  }>;
  memberActivities?: Array<{
    id: string; memberId: string; projectId: string; ym: string; source: string; sourceItemId: string;
    milestoneId?: string | null; title?: string | null; contentPreview?: string | null;
    itemDate?: string | null; extractedAt: string;
  }>;
}

interface CockpitViewProps {
  cockpit: {
    project: {
      projectId: string;
      projectName: string;
      clientName: string;
      status: string;
      projectCategory?: string;
      projectType?: string;
      feeType?: string | null;
      feeAmount?: number | null;
      startYm?: string | null;
      endYm?: string | null;
      paymentDueRule?: string | null;
      paymentDueDay?: number | null;
      contractTerms?: ProjectContractTerms | null;
      freezeFromYm?: string | null;
      restartExpectedYm?: string | null;
    };
    currentYm: string;
    billingCycles: Array<{
      projectId: string; ym: string; status: string; budgetYen: number;
      meetingStartAt: string | null; meetingEventId?: string | null;
      reportFixedAt: string | null; budgetConfirmedAt?: string | null;
      invoiceIssuedAt?: string | null; invoiceSentAt: string | null;
      payoutNoticeUploadedAt?: string | null; paymentConfirmedAt: string | null;
      reimburseConfirmDone?: boolean;
      rewardPaidAt?: string | null; invoiceYm?: string | null;
      invoiceBaseLinesJson?: string | null; invoiceSubject?: string | null;
      budgetReportedAmount: number;
      reportExcerpt?: string; reportNeedsReview?: boolean;
      msProgressSummary?: unknown;
      msProgressSummaryJson?: unknown;
      rewardSummaryJson?: {
        capped?: boolean;
        ptUnit?: number;
        carryOverYen?: number;
        totalPaySum?: number;
        monthlyBudget65?: number;
        members: Array<{
          memberId: string;
          memberName?: string;
          earnedPt: number;
          basePay: number;
          bonusPt: number;
          totalPay: number;
          cappedFrom?: number;
          breakdown: Array<{
            msKey: string;
            title: string;
            share: number;
            earnedPt: number;
            msConsumedPt: number;
          }>;
        }>;
      } | null;
    }>;
    planCycle: PlanCycleShape | null;
    milestones: Array<{
      milestoneId: string; title: string; points: number; tag: string;
      goalLevel: string; successCriteria: string; sortOrder: number;
      periodStartYm?: string | null; targetYm?: string | null;
    }>;
    progress: ProgressShape[];
    reports: Array<{
      reportId: string; ym: string; status: string;
      draftExcerpt: string; finalExcerpt: string;
      hasDraft: boolean; hasFinal: boolean;
      generatedAt: string | null; fixedAt: string | null;
    }>;
    members: string[];
    subItems?: Array<{
      subItemId: string; milestoneId: string; title: string;
      weight: number; status: string; assignee: string;
    }>;
    responsibilities?: Array<{
      milestoneId: string; memberId: string; share: number;
    }>;
    memberMap?: Record<string, string>;
    pastPlanCycles?: PlanCycleBundle[];
    msActivities?: Array<{
      memberId: string; milestoneId: string; ym: string;
      narrative?: string | null; learnedAddendum?: string | null; generatedAt?: string | null;
    }>;
    memberActivities?: Array<{
      id: string; memberId: string; projectId: string; ym: string; source: string; sourceItemId: string;
      milestoneId?: string | null; title?: string | null; contentPreview?: string | null;
      itemDate?: string | null; extractedAt: string;
    }>;
    seasonFinance?: CockpitSeasonFinanceData | null;
    msChangeHistory?: MilestoneChangeHistory[];
    strategySignals?: Array<{
      signalId: string;
      projectId: string;
      ym: string | null;
      signalDate: string | null;
      signalType: string;
      polarity?: string | null;
      title: string;
      summary: string;
      scoreImpactSummary?: string | null;
      scoreImpactDelta?: Record<string, unknown> | null;
      impactLevel: string;
      decisionState: string;
      status: string;
      sourceRefs: unknown[];
      sourceHash: string;
      originKind: "internal" | "external_research";
      researchCategory: "industry_market" | "grant" | "partner" | null;
      confidence: number;
      createdAt: string;
      confirmedAt: string | null;
    }>;
  };
  tasks: Array<{
    taskId: string; title: string; status: string;
    assignee?: string; priority?: string; description?: string;
  }>;
  initialModalYm?: string | null;
  activeTab?: CockpitTab;
  onTabChange?: (tab: CockpitTab) => void;
  /** 研究機関ページから埋め込む場合は、正本で解決済みの機関IDを渡す。 */
  institutionId?: string | null;
  /** 研究機関専用ページ側のタブと二重表示しないための埋め込みモード。 */
  hideNavigation?: boolean;
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

type MonthlyModalTab = "reward" | "report";

function latestProgressPct(
  progress: Array<{ milestoneKey: string; ym: string; progressPct: number }>,
  milestoneId: string,
  ym: string
) {
  let latest: { ym: string; progressPct: number } | null = null;
  for (const p of progress) {
    if (p.milestoneKey !== milestoneId || p.ym > ym) continue;
    if (!latest || p.ym > latest.ym) latest = p;
  }
  return latest?.progressPct || 0;
}

function mergeProgress(base: ProgressShape[], patches: ProgressShape[]) {
  const map = new Map(base.map((p) => [`${p.milestoneKey}_${p.ym}`, p]));
  for (const patch of patches) {
    const key = `${patch.milestoneKey}_${patch.ym}`;
    map.set(key, { ...map.get(key), ...patch });
  }
  return Array.from(map.values());
}

function monthlyProgressItems(
  ym: string,
  bundles: Array<{
    planCycle: PlanCycleShape;
    milestones: Array<{ milestoneId: string; title: string; points: number; tag: string }>;
    progress: ProgressShape[];
  }>
) {
  const bundle = bundles.find((b) => ym >= b.planCycle.periodStartYm && ym <= b.planCycle.periodEndYm);
  if (!bundle) return [];
  return bundle.milestones.map((m) => ({
    title: m.title,
    tag: m.tag,
    points: m.points,
    progressPct: latestProgressPct(bundle.progress, m.milestoneId, ym),
  }));
}

function isLiveOperationalProject(project: { status: string; freezeFromYm?: string | null; restartExpectedYm?: string | null }, currentYm: string) {
  const baseActive = project.status === "active" || project.status === "sales";
  const frozenNow = !!project.freezeFromYm && currentYm >= project.freezeFromYm;
  const waitingRestart = !!project.restartExpectedYm && currentYm < project.restartExpectedYm;
  return baseActive && !frozenNow && !waitingRestart;
}

function usesMsProgressCategory(category: string | null | undefined) {
  return ["dtsu", "ecosystem", "new_business"].includes(String(category || "dtsu").toLowerCase());
}

// タブ一覧の正本は src/lib/cockpit-tabs.ts。ここでは再エクスポートだけする。
export { COCKPIT_TABS } from "@/lib/cockpit-tabs";
export type { CockpitTab } from "@/lib/cockpit-tabs";

/**
 * PJワークスペースの管制タブをコックピットのタブへ対応づける (2026-08-28 まさ確定)。
 * ここに載っているタブは同じ `CockpitProjectControl` を共有するので、
 * 週次差分・ガント・関係先・論点を行き来しても束を読み直さない。
 */
const WORKSPACE_VIEW_BY_TAB: Partial<Record<CockpitTab, SxWeeklyControlView>> = {
  weekly: "weekly",
  gantt: "gantt",
  partners: "partners",
  issues: "issues",
};

/** 管制画面の中の導線 (「ガントで見る」等) が飛ぶ先を、コックピットのタブへ戻す。 */
const TAB_BY_WORKSPACE_VIEW: Partial<Record<SxWeeklyControlView, CockpitTab>> = {
  weekly: "weekly",
  gantt: "gantt",
  partners: "partners",
  issues: "issues",
  cost: "cost-model",
  "cost-fuel": "cost-fuel",
  ip: "ip",
  drive: "documents",
};

export function CockpitView({ cockpit, initialModalYm, activeTab: controlledTab, onTabChange, institutionId: providedInstitutionId, hideNavigation = false }: CockpitViewProps) {
  const [localActiveTab, setLocalActiveTab] = useState<CockpitTab>(DEFAULT_COCKPIT_TAB);
  const requestedTab = controlledTab ?? localActiveTab;
  const [resolvedInstitutionId, setResolvedInstitutionId] = useState<string | null | undefined>(providedInstitutionId);
  useEffect(() => {
    if (providedInstitutionId !== undefined) {
      setResolvedInstitutionId(providedInstitutionId);
      return;
    }
    let cancelled = false;
    fetchInstitutionIdForProject(cockpit.project.projectId)
      .then((nextInstitutionId) => {
        if (!cancelled) setResolvedInstitutionId(nextInstitutionId);
      })
      .catch(() => {
        if (!cancelled) setResolvedInstitutionId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cockpit.project.projectId, providedInstitutionId]);

  // タブの並びはPJタイプごとの標準フォーマット（src/lib/project-formats.ts、鍵付き）で決める。
  // データの有無やPJ番号では出し分けない（2026-10-03 まさ「全部統一してないとだめ。OSの大原則」）。
  const formatType = projectFormatTypeOf({ projectId: cockpit.project.projectId, projectCategory: cockpit.project.projectCategory });
  const resolvedTab = resolveCockpitTabForType(requestedTab, formatType);
  const [modalYm, setModalYm] = useState<string | null>(initialModalYm || null);
  const [modalInitialTab, setModalInitialTab] = useState<MonthlyModalTab | undefined>(undefined);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [progressPatches, setProgressPatches] = useState<ProgressShape[]>([]);
  // 連携シーズタブ: 初回訪問まではマウントせず、訪問後は hidden で保持して
  // タブを行き来しても Seeds を読み直さない。
  const [hasVisitedSeeds, setHasVisitedSeeds] = useState(false);
  useEffect(() => {
    if (resolvedTab === "seeds") setHasVisitedSeeds(true);
  }, [resolvedTab]);

  // 会社概要も初回訪問まで取得しない。キラー要素は独立タブで取得する。
  const [hasVisitedCompany, setHasVisitedCompany] = useState(false);
  useEffect(() => {
    if (resolvedTab === "company") setHasVisitedCompany(true);
  }, [resolvedTab]);

  function selectTab(tab: CockpitTab) {
    setLocalActiveTab(tab);
    onTabChange?.(tab);
  }

  function openMonthlyModal(ym: string, initialTab?: MonthlyModalTab) {
    setModalInitialTab(initialTab);
    setModalYm(ym);
  }

  function closeMonthlyModal() {
    setModalYm(null);
    setModalInitialTab(undefined);
  }

  const { project, currentYm, billingCycles, planCycle, milestones, progress, reports, subItems, responsibilities, memberMap, pastPlanCycles, msActivities, memberActivities, seasonFinance, msChangeHistory, strategySignals } = cockpit;
  const usesMsProgress = usesMsProgressCategory(project.projectCategory);
  // 事業計画グループ・シーズリスト・規程内規のどれを出すかは、PJタイプの標準フォーマットで決まる（下の groups）。

  const currentProgress = mergeProgress(progress, progressPatches);
  const patchedPastPlanCycles = (pastPlanCycles || []).map((bundle) => ({
    ...bundle,
    progress: mergeProgress(bundle.progress, progressPatches),
  }));
  const allBundles = usesMsProgress
    ? [
        ...(planCycle ? [{ planCycle, milestones, progress: currentProgress }] : []),
        ...patchedPastPlanCycles.map((bundle) => ({
          planCycle: bundle.planCycle,
          milestones: bundle.milestones,
          progress: bundle.progress,
        })),
      ]
    : [];
  const monthlyProgressByYm = Object.fromEntries(
    billingCycles.map((bc) => [bc.ym, monthlyProgressItems(bc.ym, allBundles)])
  );
  const modalReport = modalYm ? reports.find((r) => r.ym === modalYm) ?? null : null;
  const modalBilling = modalYm ? billingCycles.find((bc) => bc.ym === modalYm) ?? null : null;
  const modalBundle = usesMsProgress && modalYm
    ? [
        ...(planCycle ? [{ planCycle, milestones, progress: currentProgress, subItems: subItems || [], responsibilities: responsibilities || [], msActivities: msActivities || [], memberActivities: memberActivities || [] }] : []),
        ...patchedPastPlanCycles,
      ].find((bundle) => modalYm >= bundle.planCycle.periodStartYm && modalYm <= bundle.planCycle.periodEndYm)
    : null;
  const isReportOnlyMonth = !!modalYm && !!modalReport && !modalBilling;
  const modalPlanCycle = !usesMsProgress || isReportOnlyMonth ? null : (modalBundle?.planCycle || planCycle);
  const modalMilestones = !usesMsProgress || isReportOnlyMonth ? [] : (modalBundle?.milestones || milestones);
  const modalProgress = !usesMsProgress || isReportOnlyMonth ? [] : (modalBundle?.progress || progress);
  const modalSubItems = !usesMsProgress || isReportOnlyMonth ? [] : (modalBundle?.subItems || subItems || []);
  const modalResponsibilities = !usesMsProgress || isReportOnlyMonth ? [] : (modalBundle?.responsibilities || responsibilities || []);
  const modalMsActivities = !usesMsProgress || isReportOnlyMonth ? [] : (modalBundle?.msActivities || msActivities || []);
  const modalMemberActivities = isReportOnlyMonth ? [] : (modalBundle?.memberActivities || memberActivities || []);
  const showLiveOperations = isLiveOperationalProject(project, currentYm);

  // グループと所属タブはPJタイプの標準フォーマット（src/lib/project-formats.ts、鍵付き）が正本。
  // ここではラベルと、見る人の役割による出し分け（DDパッケージ＝AMDの管理者）だけを足す。
  const groups = cockpitGroupsForType(formatType);
  const hasScoreDetailTab = groups.some((group) => group.children.includes("score-detail"));
  const tabLabel: Partial<Record<CockpitTab, string>> = {
    progress: "MS・月次",
    meetings: "動向・会議",
    slack: "Slack",
    weekly: "週次差分",
    gantt: "ガント",
    partners: "関係先",
    issues: "ゴールツリー",
    tasks: "タスク",
    "score-detail": "スコア詳細",
    technology: "技術",
    competition: "競合比較",
    "business-model": "ビジネスモデル",
    "business-plan": "事業計画",
    "financial-projection": "試算表",
    "capital-plan": "資本政策表",
    "cost-model": "コスト試算",
    ip: "知財",
    seeds: "シーズ一覧",
    regulations: "規程一覧",
    documents: "ドライブ",
    overview: "PJ概要",
    "monthly-reports": "月次報告書",
    "project-contracts": "契約",
    "project-finance": "収支",
    "capital-policy": "資金調達履歴",
    company: "会社概要",
    contracts: "契約リスト",
    "killer-factors": "キラー要素",
    activity: "沿革",
    dd: "DDパッケージ",
  };
  const visibleGroups = groups;
  const requestedGroup = cockpitGroupForTabInType(resolvedTab, formatType);
  const activeGroupWithAvailableChildren = visibleGroups.find((group) => group.key === requestedGroup.key) ?? visibleGroups[0];
  // URLが現在のPJでは非表示になるタブを指していても、空画面にせず同じグループの先頭へ落とす。
  const activeTab = activeGroupWithAvailableChildren?.children.includes(resolvedTab)
    ? resolvedTab
    : activeGroupWithAvailableChildren?.children[0] ?? DEFAULT_COCKPIT_TAB;
  const workspaceView = WORKSPACE_VIEW_BY_TAB[activeTab];
  const tabItem = (key: CockpitTab) => ({
    key,
    label: PROJECT_PAGE_LABELS[key] ?? tabLabel[key] ?? key,
    onHover: key === "score-detail" ? () => prefetchProjectOrg(project.projectId)
      : key === "technology" || key === "competition" || key === "business-model" ? () => prefetchProjectTech(project.projectId)
      : key === "business-plan" ? () => prefetchProjectBusinessPlan(project.projectId)
      : key === "cost-model" ? () => { prefetchProjectCostModel(project.projectId); prefetchProjectFuelCostModel(project.projectId); }
      : key === "monthly-reports" ? () => prefetchMonthlyReports(project.projectId)
      : key === "capital-policy" ? () => prefetchGovernance(project.projectId)
      : key === "company" ? () => { prefetchGovernance(project.projectId); prefetchBusinessSummary(project.projectId); }
      : key === "overview" ? () => { prefetchProjectOverview(project.projectId); prefetchQuestionTree(project.projectId); prefetchSeasonBudget(project.projectId); }
      : undefined,
  });

  function selectGroup(groupKey: CockpitGroupKey) {
    const group = visibleGroups.find((candidate) => candidate.key === groupKey);
    if (group?.children[0]) selectTab(group.children[0]);
  }

  // [B2] MS設定バナー / 直接編集 ロジックを案Cの col1 内で使うため関数化。
  const renderMsSetupBanner = () => {
    if (!(showLiveOperations && usesMsProgress)) return null;
    // 期間外で planCycle が null の場合は、最も最新の過去 plan_cycle を fallback に使う。
    const effectivePlanCycle = planCycle
      ?? [...(pastPlanCycles ?? [])]
          .map((b) => b.planCycle)
          .sort((a, b) => b.periodEndYm.localeCompare(a.periodEndYm))[0]
      ?? null;
    if (!effectivePlanCycle) {
      return (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ この PJ には MS 期間 (plan_cycle) が一度も設定されていません。
          admin から初期 MS を設定してください。
        </div>
      );
    }
    const isPeriodExpired = currentYm > effectivePlanCycle.periodEndYm;
    if (effectivePlanCycle.status === "draft") {
      return (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ この PJ の MS は下書き状態です。admin の MS一覧で確定してください。
        </div>
      );
    }
    return (
      <>
        {isPeriodExpired && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ 今期の MS 期間 ({formatYm(effectivePlanCycle.periodEndYm)}) は終了しています。
            admin の MS一覧で次期 MS を設定してください。
          </div>
        )}
      </>
    );
  };

  // 案C ステータスバッジ (凍結 / 再開予定)
  const statusBadges: Array<{ key: string; cls: string; text: string }> = [];
  if (project.freezeFromYm) {
    if (currentYm >= project.freezeFromYm) {
      statusBadges.push({ key: "frozen-now", cls: "bg-slate-100 text-slate-700 border-slate-300", text: `❄️ ${formatYm(project.freezeFromYm)} 〜 凍結中` });
    } else {
      statusBadges.push({ key: "frozen-future", cls: "bg-amber-50 text-amber-800 border-amber-300", text: `⚠️ ${formatYm(project.freezeFromYm)} から凍結予定` });
    }
  }
  if (project.restartExpectedYm && currentYm < project.restartExpectedYm) {
    statusBadges.push({ key: "restart", cls: "bg-blue-50 text-blue-800 border-blue-300", text: `📅 ${formatYm(project.restartExpectedYm)} から再開予定` });
  }
  const mainGridClass = statusBadges.length > 0
    ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start"
    : "block";

  return (
    <div
      className={`max-w-[1600px] mx-auto flex flex-col ${activeTab === "score-detail" ? "px-2 py-2 gap-2" : "px-4 py-3 gap-3"}`}
      data-cockpit-project-kind={formatType === "ecosystem" ? "institution" : "standard"}
      data-project-format-type={formatType}
    >
      {/* [A] Project Header (full width) */}
      <CockpitHeader project={project} />

      {/* 旧 [A2] Hero (PJの見出し・担当・事業概要・XRL進捗) は 2026-08-28 まさ依頼で
          「PJ概要」タブへ丸ごと移した。上段に残すのは CockpitHeader だけで、
          コックピットを開いた直後は進捗管理の中身がすぐ目に入る。 */}

      <ProjectSpaceLayout navigation={!hideNavigation ? <>
        <InternalProjectSurfaceNav projectId={project.projectId} current="cockpit" />
        <ProjectPageMenu label="コックピット分類" testPrefix="cockpit"
          groups={visibleGroups.map((group) => ({ ...group, children: group.children.map(tabItem) }))}
          activeGroup={activeGroupWithAvailableChildren?.key} activePage={activeTab}
          onGroup={(key) => selectGroup(key as CockpitGroupKey)} onPage={(key) => selectTab(key as CockpitTab)} />
      </> : undefined}>
      {activeTab === "progress" && (
        <>
      {/* メインボード: 通常は 2 カラム。凍結/再開バッジがある時だけ 3 カラム目を出す。 */}
      <div className={mainGridClass}>

        {/* col1: 今期MS + 次期MS設定 + 過去の期間 */}
        <div className="flex flex-col gap-3 min-w-0">
          {usesMsProgress && planCycle && milestones.length > 0 && (
            <CockpitGoalsCompact
              milestones={milestones}
              planCycle={planCycle}
              projectId={project.projectId}
              subItems={subItems || []}
              responsibilities={responsibilities || []}
              memberMap={memberMap || {}}
              progress={currentProgress}
              currentYm={currentYm}
              msActivities={msActivities || []}
              memberActivities={memberActivities || []}
            />
          )}
          {/* TODOごとのpt。ツリーとガントは外部メンバーも見る面なので、
              報酬に直結する数字はこの内部だけの面に置く（まさ 2026-09-11）。 */}
          <CockpitGoalTreePoints projectId={project.projectId} />
          {renderMsSetupBanner()}
          {(usesMsProgress || (msChangeHistory?.length ?? 0) > 0) && (
            <CockpitMsChangeHistory history={msChangeHistory || []} memberMap={memberMap || {}} />
          )}
          <CockpitSeasonFinance finance={seasonFinance} />
          {usesMsProgress && pastPlanCycles && pastPlanCycles.length > 0 && (
            <section className="bg-white rounded-xl border border-[#e5e5e7]">
              <button
                onClick={() => setPastExpanded(!pastExpanded)}
                className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-left hover:bg-[#fafafa] transition-colors rounded-xl"
              >
                <span className={`text-[10px] text-[#86868b] shrink-0 transition-transform ${pastExpanded ? "rotate-90" : ""}`}>▶</span>
                <span className="text-[#86868b] font-medium">過去の期間</span>
                <span className="text-[11px] text-[#86868b]">
                  ({pastPlanCycles.length}件)
                </span>
              </button>
              {pastExpanded && (
                <div className="px-4 pb-3 flex flex-col gap-3">
                  {patchedPastPlanCycles.map((bundle) => (
                    <div key={bundle.planCycle.planCycleId} className="border border-[#e5e5e7] rounded-lg bg-[#fafafa] overflow-hidden">
                      <CockpitGoalsCompact
                        milestones={bundle.milestones}
                        planCycle={bundle.planCycle}
                        projectId={project.projectId}
                        subItems={bundle.subItems}
                        responsibilities={bundle.responsibilities}
                        memberMap={memberMap || {}}
                        progress={bundle.progress}
                        currentYm={currentYm}
                        msActivities={bundle.msActivities || []}
                        memberActivities={bundle.memberActivities || []}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          {/* 月次カード (まさ #28 2026-05-24): MS リストの下に移動。
              旧実装は下段 2 カラム grid に独立して置いていたが、左カラムを「MS + 月次サマリ」
              に統合する構造へ変更。 */}
          <CockpitMonthlyList
            billingCycles={billingCycles}
            reports={reports}
            currentYm={currentYm}
            progressByYm={monthlyProgressByYm}
            onOpenModal={(ym) => openMonthlyModal(ym)}
          />
          {/* 休止期間 backfill UI も col1 (= 月次サマリの近く) に置く。 */}
          <CockpitFreezeBackfill
            projectId={project.projectId}
            freezeFromYm={project.freezeFromYm ?? null}
            restartExpectedYm={project.restartExpectedYm ?? null}
            currentYm={currentYm}
          />
        </div>

        {statusBadges.length > 0 && (
          <div className="flex flex-col gap-3 min-w-0 lg:sticky lg:top-12">
            <div className="flex flex-col gap-1">
              {statusBadges.map((b) => (
                <span key={b.key} className={`text-[11px] px-2 py-1 rounded-md border ${b.cls}`}>
                  {b.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

        </>
      )}

      {activeTab === "meetings" && (
        <section role="tabpanel" aria-label="動向・会議" className="grid min-w-0 gap-3 lg:grid-cols-2">
          <CockpitStrategySignals signals={strategySignals || []} projectId={project.projectId} />
          <CockpitMeetingSummary projectId={project.projectId} />
        </section>
      )}

      {activeTab === "slack" && (
        <section role="tabpanel" aria-label="Slackの会話" className="min-w-0">
          <CockpitSlackMessages projectId={project.projectId} />
        </section>
      )}

      {hasScoreDetailTab && (
        <section
          role="tabpanel"
          aria-label="スコア詳細"
          hidden={activeTab !== "score-detail"}
          className={activeTab === "score-detail" ? "min-w-0" : "hidden"}
        >
          <CockpitAmdScoreDetailTab projectId={project.projectId} active={activeTab === "score-detail"} />
        </section>
      )}

      {activeTab === "business-plan" && (
        <section role="tabpanel" aria-label="事業計画" className="min-w-0">
          <CockpitBusinessPlan projectId={project.projectId} projectName={project.projectName} />
        </section>
      )}

      {activeTab === "financial-projection" && (
        <section role="tabpanel" aria-label="試算表" className="min-w-0">
          <CockpitFinancialProjection projectId={project.projectId} />
        </section>
      )}

      {activeTab === "capital-plan" && (
        <section role="tabpanel" aria-label="資本政策表" className="min-w-0">
          <CockpitCapitalPlan projectId={project.projectId} projectName={project.projectName} />
        </section>
      )}

      {/* コスト試算タブ。全PJ常設で、データにある試算（処理原価・燃料・部分試算）をタブの中で切り替える
          （2026-10-03 まさ「全部統一してないとだめ」。旧 ?tab=cost-fuel はこのタブの燃料の試算を開く）。
          正本は project_cost_*。自前で fetch するので開いた時だけマウントする。 */}
      {activeTab === "cost-model" && (
        <section role="tabpanel" aria-label={tabLabel["cost-model"]} className="min-w-0">
          <CockpitCostTab projectId={project.projectId} initialRenderer={requestedTab === "cost-fuel" ? "fuel" : undefined} />
        </section>
      )}

      {activeTab === "regulations" && (
        <section role="tabpanel" aria-label="規程・内規" className="min-w-0">
          {/* 研究機関との結び付き（institution_projects）を読むあいだは骨組みを出す。結び付きが無いPJは未登録と出す。 */}
          {resolvedInstitutionId === undefined ? (
            <div className="h-40 animate-pulse rounded-xl bg-[#f5f5f7]" aria-busy="true" />
          ) : resolvedInstitutionId ? (
            <InstitutionRegulationsPanel institutionId={resolvedInstitutionId} />
          ) : (
            <p className="rounded-xl border border-[#e5e5e7] bg-white px-4 py-6 text-[13px] text-[#6e6e73]">このPJは研究機関と結び付いていないため、規程・内規は未登録。</p>
          )}
        </section>
      )}

      {(activeTab === "seeds" || hasVisitedSeeds) && (
        <section
          role="tabpanel"
          aria-label="シーズ一覧"
          hidden={activeTab !== "seeds"}
          className={activeTab === "seeds" ? "min-w-0" : "hidden"}
        >
          {resolvedInstitutionId === undefined ? (
            <div className="h-40 animate-pulse rounded-xl bg-[#f5f5f7]" aria-busy="true" />
          ) : resolvedInstitutionId ? (
            <ProjectInstitutionSeeds projectId={project.projectId} />
          ) : (
            <p className="rounded-xl border border-[#e5e5e7] bg-white px-4 py-6 text-[13px] text-[#6e6e73]">このPJは研究機関と結び付いていないため、シーズ一覧は未登録。</p>
          )}
        </section>
      )}

      {/* 技術タブ (2026-08-29 まさ依頼)。この技術がどの範囲で成立し、競合とどこで差がつき、
          今どこまで行っているかを貯める。自前で fetch するので開いた時だけマウントする。 */}
      {activeTab === "technology" && (
        <section role="tabpanel" aria-label="技術" className="min-w-0">
          <CockpitTechnology projectId={project.projectId} />
        </section>
      )}

      {/* 競合比較タブ (2026-09-14 まさ依頼)。技術台帳の区分「競合比較」だけを、技術タブと同じ部品で出す。
          提出用の星取り表が先頭に来るので、開いたらそのまま見せられる。自前で fetch するので開いた時だけマウントする。 */}
      {activeTab === "competition" && (
        <section role="tabpanel" aria-label="競合比較" className="min-w-0">
          <CockpitTechnology projectId={project.projectId} mode="competition" />
        </section>
      )}

      {/* ビジネスモデルタブ (2026-09-14 まさ依頼)。技術台帳の区分「ビジネスモデル」だけを、技術タブと同じ部品で出す。
          事業の形と、それが成り立つかの検証を置く。自前で fetch するので開いた時だけマウントする。 */}
      {activeTab === "business-model" && (
        <section role="tabpanel" aria-label="ビジネスモデル" className="min-w-0">
          <CockpitTechnology projectId={project.projectId} mode="business-model" />
        </section>
      )}

      {/* 知財タブ (2026-08-21 まさ依頼)。自社/大学/共同/障害/ウォッチを同じ台帳で見る。
          CockpitIpPortfolio は自前で fetch するので、開いた時だけマウントする。 */}
      {activeTab === "ip" && (
        <section role="tabpanel" aria-label="知財" className="min-w-0">
          <CockpitIpPortfolio projectId={project.projectId} />
        </section>
      )}

      {/* 資料室タブ。WorkspaceDocumentRoom は自前で fetch するので、開いた時だけマウントする。 */}
      {activeTab === "documents" && (
        <section role="tabpanel" aria-label="ドライブ" className="min-w-0">
          <WorkspaceDocumentRoom
            scopeKind="project"
            scopeId={project.projectId}
            scopeName={project.projectName}
            scopeTrail={[project.projectName]}
            presentation="modal"
          />
        </section>
      )}

      {/* タスクタブ (2026-09-12 まさ依頼)。ゴールツリーに全部書こうとすると違和感が出るので、
          やることだけを一列に並べる面を分けた。設計は OSスイートの「やること」と同じ
          (上=未完了 / 下=完了 / チェックで完了 / 緊急はオレンジ / その場で足す)。
          データは同じ束なので、ツリーに入っていないTODOも同じ列に出る。 */}
      {activeTab === "tasks" && (
        <section role="tabpanel" aria-label="タスク" className="min-w-0">
          <CockpitProjectTasks projectId={project.projectId} />
        </section>
      )}

      {/* 管制タブ (週次差分 / ガント / 関係先 / 論点・仮説)。
          タスク階層はガントの固定左列に統合している。 */}
      {workspaceView && (
        <section role="tabpanel" aria-label="PJ管制" className="min-w-0">
          <CockpitProjectControl
            projectId={project.projectId}
            view={workspaceView}
            onViewChange={(next) => {
              const tab = TAB_BY_WORKSPACE_VIEW[next];
              if (tab) selectTab(tab);
            }}
          />
        </section>
      )}

      {/* PJ概要タブ。このPJがどういうものかを読む面。
            - AMD本体は AMD Management Score の時系列折れ線 + 最新値カード
            - ほかのPJは全PJ共通の標準フォーマット（ProjectOverviewFormat、spec 3-23 §9）。
              PJの定義（目的・相手・関わり方・報酬形態・期間と体制）と、今の状態（段階と次の節目・契約と収支・
              まだ決まっていないこと・最近の重要な動き）の9項目（2026-10-04 まさ確定「1で進めて」）。
              事業の一言は会社情報 > 会社概要「事業の概要」へ移した。XRL進捗はスコア詳細タブ。 */}
      {activeTab === "monthly-reports" && (
        <CockpitMonthlyReports key={project.projectId} projectId={project.projectId} currentYm={currentYm} />
      )}

      {activeTab === "overview" && (
        <section role="tabpanel" aria-label="PJ概要" className="flex min-w-0 flex-col gap-3">
          {formatType === "amd" ? (
            <CockpitManagementScoreHero />
          ) : (
            <ProjectOverviewFormat key={project.projectId} project={project} onSelectTab={selectTab} />
          )}
        </section>
      )}

      {activeTab === "project-contracts" && (
        <section role="tabpanel" aria-label="契約" className="min-w-0">
          <CockpitProjectOverview project={project} />
        </section>
      )}

      {activeTab === "project-finance" && (
        <section role="tabpanel" aria-label="収支" className="min-w-0">
          <CockpitSeasonBudget projectId={project.projectId} />
        </section>
      )}

      {activeTab === "contracts" && <section role="tabpanel" aria-label="契約リスト" className="min-w-0"><ProjectContractList key={project.projectId} projectId={project.projectId} /></section>}

      {activeTab === "capital-policy" && (
        <section role="tabpanel" aria-label="資金調達履歴" className="min-w-0">
          <CockpitCapitalPolicy projectId={project.projectId} />
        </section>
      )}

      {/* 初回訪問まではマウントしない。訪問後は hidden で保持して読み直さない。 */}
      {hasVisitedCompany && (
        <section
          role="tabpanel"
          aria-label="会社概要"
          hidden={activeTab !== "company"}
          className={activeTab === "company" ? "min-w-0" : "hidden"}
        >
          <CockpitCompanyOverview projectId={project.projectId} projectName={project.projectName} />
        </section>
      )}

      {activeTab === "killer-factors" && (
        <section role="tabpanel" aria-label="キラー要素" className="min-w-0">
          <CockpitKillerFactorCatalog projectId={project.projectId} />
        </section>
      )}

      {activeTab === "activity" && (
        <section role="tabpanel" aria-label="沿革" className="flex min-w-0 flex-col gap-3">
          <CockpitGrants projectId={project.projectId} />
          {hasScoreDetailTab && <Bzm22AcquisitionLedger projectId={project.projectId} />}
          <CockpitAmdContributions projectId={project.projectId} />
        </section>
      )}

      {/* ===== Monthly Modal ===== */}
      {modalYm && (
        <CockpitMonthlyModal
          ym={modalYm}
          projectId={project.projectId}
          report={modalReport}
          billing={modalBilling}
          milestones={modalMilestones}
          progress={modalProgress}
          responsibilities={modalResponsibilities}
          memberMap={memberMap || {}}
          planCycle={modalPlanCycle}
          subItems={modalSubItems}
          msActivities={modalMsActivities}
          memberActivities={modalMemberActivities}
          currentYm={currentYm}
          initialTab={modalInitialTab}
          projectFeeType={project.feeType}
          projectFeeAmount={project.feeAmount}
          usesMsProgress={usesMsProgress}
          onProgressSaved={(patches) => setProgressPatches((prev) => mergeProgress(prev, patches))}
          onClose={closeMonthlyModal}
        />
      )}
      </ProjectSpaceLayout>
    </div>
  );
}
