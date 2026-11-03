'use client';
import {ProjectRecordSupplement} from './ProjectRecordSupplement';
import {useProjectPageRuntime} from "./ProjectPageContext";


import { ProjectPageTitle } from "@/components/nav/PageTitleSetter";
import { ProjectDevelopmentIssues } from "@/components/project-workspace/ProjectDevelopmentIssues";
import { ProjectOrganizationChart } from "@/components/project-workspace/ProjectOrganizationChart";
import { ProjectEmployeeRegister } from "@/components/project-workspace/ProjectEmployeeRegister";

import dynamic from "next/dynamic";
import { ProjectPageLoading } from "@/components/project-space/ProjectPageLoading";

import { useEffect, useState } from "react";
import { ProjectSpaceLayout } from "@/components/nav/ProjectSpaceLayout";
import { ProjectPageMenu } from "@/components/nav/ProjectPageMenu";
import { CockpitHeader } from "@/components/cockpit/CockpitHeader";

import { CockpitManagementScoreHero } from "@/components/cockpit/CockpitManagementScoreHero";
import { CockpitGoalsCompact } from "@/components/cockpit/CockpitGoalsCompact";

import { CockpitSeasonFinance } from "@/components/cockpit/CockpitSeasonFinance";
import { CockpitMsChangeHistory } from "@/components/cockpit/CockpitMsChangeHistory";
import { CockpitMonthlyReports, prefetchMonthlyReports } from "@/components/cockpit/CockpitMonthlyReports";
import { CockpitMonthlyList } from "@/components/cockpit/CockpitMonthlyList";

import { CockpitFreezeBackfill } from "@/components/cockpit/CockpitFreezeBackfill";

import type { SxWeeklyControlView } from "@/components/project-workspace/SxWeeklyControlDashboard";
import { InternalProjectSurfaceNav } from "@/components/nav/ProjectSurfaceNav";

import type { CockpitTab } from "@/lib/cockpit-tabs";
import { prefetchGovernance } from "@/lib/governance-client";
import type { CockpitSeasonFinance as CockpitSeasonFinanceData, MilestoneChangeHistory } from "@/lib/supabase-data";
import type { ProjectContractTerms } from "@/lib/project-contract-terms";

import { prefetchProjectOrg } from "@/lib/project-org-client";
import { prefetchProjectCostModel, prefetchProjectFuelCostModel } from "@/lib/project-cost-model-client";
import { prefetchProjectPocList } from "@/lib/project-poc-list-client";
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

// 選んだページの部品だけを取得し、他ページのJSを初期表示の待ち時間に積まない。
const ProjectContractList = dynamic(() => import("@/components/project-workspace/ProjectContractList").then((module) => module.ProjectContractList), { loading: ProjectPageLoading });
const ProjectOverviewFormat = dynamic(() => import("@/components/cockpit/ProjectOverviewFormat").then((module) => module.ProjectOverviewFormat), { loading: ProjectPageLoading });
const CockpitGoalTreePoints = dynamic(() => import("@/components/cockpit/CockpitGoalTreePoints").then((module) => module.CockpitGoalTreePoints), { loading: ProjectPageLoading });
const CockpitStrategySignals = dynamic(() => import("@/components/cockpit/CockpitStrategySignals").then((module) => module.CockpitStrategySignals), { loading: ProjectPageLoading });
const Bzm22AcquisitionLedger = dynamic(() => import("@/components/cockpit/Bzm22AcquisitionLedger").then((module) => module.Bzm22AcquisitionLedger), { loading: ProjectPageLoading });
const CockpitAmdContributions = dynamic(() => import("@/components/cockpit/CockpitAmdContributions").then((module) => module.CockpitAmdContributions), { loading: ProjectPageLoading });
const CockpitGrants = dynamic(() => import("@/components/cockpit/CockpitGrants").then((module) => module.CockpitGrants), { loading: ProjectPageLoading });
const WorkspaceDocumentRoom = dynamic(() => import("@/components/workspace-documents/WorkspaceDocumentRoom").then((module) => module.WorkspaceDocumentRoom), { loading: ProjectPageLoading });
const CockpitIpPortfolio = dynamic(() => import("@/components/cockpit/CockpitIpPortfolio").then((module) => module.CockpitIpPortfolio), { loading: ProjectPageLoading });
const CockpitTechnology = dynamic(() => import("@/components/cockpit/CockpitTechnology").then((module) => module.CockpitTechnology), { loading: ProjectPageLoading });
const ProjectPocList = dynamic(() => import("@/components/project-workspace/ProjectPocList").then(module => module.ProjectPocList), { loading: ProjectPageLoading });
const InstitutionRegulationsPanel = dynamic(() => import("@/components/institutions/InstitutionRegulations").then((module) => module.InstitutionRegulationsPanel), { loading: ProjectPageLoading });
const ProjectInstitutionSeeds = dynamic(() => import("@/components/cockpit/CockpitKuteSeeds").then((module) => module.ProjectInstitutionSeeds), { loading: ProjectPageLoading });
const CockpitMonthlyModal = dynamic(() => import("@/components/cockpit/CockpitMonthlyModal").then((module) => module.CockpitMonthlyModal), { loading: ProjectPageLoading });
const CockpitProperNouns = dynamic(() => import("@/components/cockpit/CockpitProperNouns").then((module) => module.CockpitProperNouns), { loading: ProjectPageLoading });
const ProjectCardDesigns = dynamic(() => import("@/components/project-card-designs/ProjectCardDesigns").then((module) => module.ProjectCardDesigns), { loading: ProjectPageLoading });
const CockpitMeetingSummary = dynamic(() => import("@/components/cockpit/CockpitMeetingSummary").then((module) => module.CockpitMeetingSummary), { loading: ProjectPageLoading });
const ProjectGovernanceMeetingPage = dynamic(() => import("../cockpit/ProjectGovernanceMeetingPage").then(module => module.ProjectGovernanceMeetingPage), { loading: ProjectPageLoading });
const ExecutiveMeetingPanel = dynamic(() => import("@/components/project-executive-meeting/ExecutiveMeetingPanel").then((module) => module.ExecutiveMeetingPanel), { loading: ProjectPageLoading });
const CockpitSlackMessages = dynamic(() => import("@/components/cockpit/CockpitSlackMessages").then((module) => module.CockpitSlackMessages), { loading: ProjectPageLoading });
const CockpitAmdScoreDetailTab = dynamic(() => import("@/components/cockpit/CockpitAmdScoreDetailTab").then((module) => module.CockpitAmdScoreDetailTab), { loading: ProjectPageLoading });
const CockpitCompanyOverview = dynamic(() => import("@/components/cockpit/CockpitCompanyOverview").then((module) => module.CockpitCompanyOverview), { loading: ProjectPageLoading });
const CockpitKillerFactorCatalog = dynamic(() => import("@/components/cockpit/CockpitKillerFactorCatalog").then((module) => module.CockpitKillerFactorCatalog), { loading: ProjectPageLoading });
const CockpitProjectOverview = dynamic(() => import("@/components/cockpit/CockpitProjectOverview").then((module) => module.CockpitProjectOverview), { loading: ProjectPageLoading });
const CockpitSeasonBudget = dynamic(() => import("@/components/cockpit/CockpitSeasonBudget").then((module) => module.CockpitSeasonBudget), { loading: ProjectPageLoading });
const CockpitProjectControl = dynamic(() => import("../cockpit/CockpitProjectControl").then((module) => module.CockpitProjectControl), { loading: ProjectPageLoading });
const CockpitProjectTasks = dynamic(() => import("@/components/cockpit/CockpitProjectTasks").then((module) => module.CockpitProjectTasks), { loading: ProjectPageLoading });
const CockpitBusinessPlan = dynamic(() => import("@/components/cockpit/CockpitBusinessPlan").then((module) => module.CockpitBusinessPlan), { loading: ProjectPageLoading });
const CockpitFinancialProjection = dynamic(() => import("@/components/cockpit/CockpitFinancialProjection").then((module) => module.CockpitFinancialProjection), { loading: ProjectPageLoading });
const CockpitCapitalPlan = dynamic(() => import("@/components/cockpit/CockpitCapitalPlan").then((module) => module.CockpitCapitalPlan), { loading: ProjectPageLoading });
const CockpitCapitalPolicy = dynamic(() => import("@/components/cockpit/CockpitCapitalPolicy").then((module) => module.CockpitCapitalPolicy), { loading: ProjectPageLoading });
const CockpitCostTab = dynamic(() => import("@/components/cockpit/CockpitCostTab").then((module) => module.CockpitCostTab), { loading: ProjectPageLoading });

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

export interface ProjectOperationsPageProps {
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
    canViewAdminMonthlyReports?: boolean;
    canExecutiveMeeting?: boolean;
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
  canViewAdminMonthlyReports?: boolean;
  /** 研究機関ページから埋め込む場合は、正本で解決済みの機関IDを渡す。 */
  institutionId?: string | null;
  /** 研究機関専用ページ側のタブと二重表示しないための埋め込みモード。 */

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

export function ProjectOperationsPage({ cockpit, initialModalYm, activeTab: controlledTab, onTabChange, institutionId: providedInstitutionId }: ProjectOperationsPageProps) {
  const pageRuntime=useProjectPageRuntime(),record=pageRuntime?.operations.record,canEdit=pageRuntime?.operations.canEdit??false;
  const [localActiveTab, setLocalActiveTab] = useState<CockpitTab>(DEFAULT_COCKPIT_TAB);
  const canViewAdminMonthlyReports = cockpit.canViewAdminMonthlyReports === true;
  const canViewExecutiveMeeting = Boolean(pageRuntime?.operations.canExecutiveMeeting);
  const executiveEligibility = {projectId: cockpit.project.projectId};
  const external=Boolean(pageRuntime&&'principal' in pageRuntime.operations.viewer&&pageRuntime.operations.viewer.principal==='workspace_account');
  const requestedTab = controlledTab ?? localActiveTab;
  const [institutionLookup, setInstitutionLookup] = useState<{ projectId: string; value: string | null } | null>(null);
  const resolvedInstitutionId = providedInstitutionId !== undefined ? providedInstitutionId
    : institutionLookup?.projectId === cockpit.project.projectId ? institutionLookup.value : undefined;

  useEffect(() => {
    if (providedInstitutionId !== undefined) return;
    let cancelled = false;
    fetchInstitutionIdForProject(cockpit.project.projectId)
      .then((nextInstitutionId) => {
        if (!cancelled) setInstitutionLookup({ projectId: cockpit.project.projectId, value: nextInstitutionId });
      })
      .catch(() => {
        if (!cancelled) setInstitutionLookup({ projectId: cockpit.project.projectId, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [cockpit.project.projectId, providedInstitutionId]);

  // タブの並びはPJタイプごとの標準フォーマット（src/lib/project-formats.ts、鍵付き）で決める。
  // データの有無やPJ番号では出し分けない（2026-10-03 まさ「全部統一してないとだめ。OSの大原則」）。
  const formatType = projectFormatTypeOf({ projectId: cockpit.project.projectId, projectCategory: cockpit.project.projectCategory });
  const resolvedTab = requestedTab;
  const [modalYm, setModalYm] = useState<string | null>(initialModalYm || null);
  const [modalInitialTab, setModalInitialTab] = useState<MonthlyModalTab | undefined>(undefined);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [progressPatches, setProgressPatches] = useState<ProgressShape[]>([]);
  // 連携シーズタブ: 初回訪問まではマウントせず、訪問後は hidden で保持して
  // タブを行き来しても Seeds を読み直さない。
  const [hasVisitedSeeds, setHasVisitedSeeds] = useState(false);
  if (resolvedTab === "seeds" && !hasVisitedSeeds) setHasVisitedSeeds(true);

  // 会社概要も初回訪問まで取得しない。キラー要素は独立タブで取得する。
  const [hasVisitedCompany, setHasVisitedCompany] = useState(false);
  if (resolvedTab === "company" && !hasVisitedCompany) setHasVisitedCompany(true);

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
  const activeTab=requestedTab;
  const workspaceView=WORKSPACE_VIEW_BY_TAB[activeTab];
  const hasScoreDetailTab=formatType!=="amd";

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

  if(record&&(('empty' in record&&record.page!=='organization-chart')||'available' in record||record.page==='next-round-overview'))return <ProjectRecordSupplement data={record} resolutionDocuments={pageRuntime?.operations.resolutionDocuments}/>;
  return (
    <div
      className={`max-w-[1600px] mx-auto flex flex-col ${activeTab === "score-detail" ? "px-2 py-2 gap-2" : "px-4 py-3 gap-3"}`}
      data-cockpit-project-kind={formatType === "ecosystem" ? "institution" : "standard"}
      data-project-format-type={formatType}
    >
      {/* [A] Project Header (full width) */}

      {/* 旧 [A2] Hero (PJの見出し・担当・事業概要・XRL進捗) は 2026-08-28 まさ依頼で
          「PJ概要」タブへ丸ごと移した。上段に残すのは CockpitHeader だけで、
          コックピットを開いた直後は進捗管理の中身がすぐ目に入る。 */}

      <div className="min-w-0">
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
          <CockpitMeetingSummary projectId={project.projectId} limitedRecords={pageRuntime?.operations.recordAudience==="shared"} readOnly={!canEdit} />
        </section>
      )}
      {activeTab === "shareholder-meeting" && <section role="tabpanel" aria-label="株主総会" className="min-w-0"><ProjectGovernanceMeetingPage key={`${project.projectId}-shareholder`} projectId={project.projectId} kind="shareholder" readOnly={!canEdit} /></section>}
      {activeTab === "board-meeting" && <section role="tabpanel" aria-label="取締役会" className="min-w-0"><ProjectGovernanceMeetingPage key={`${project.projectId}-board`} projectId={project.projectId} kind="board" readOnly={!canEdit} /></section>}
      {activeTab === "executive-meeting" && (
        <section role="tabpanel" aria-label="経営会議" className="min-w-0">
          {canViewExecutiveMeeting ? <ExecutiveMeetingPanel key={project.projectId} projectId={project.projectId} />
            : <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8"><h1 className="text-lg font-semibold text-slate-950">経営会議</h1><p className="mt-3 text-sm text-slate-600">{executiveEligibility?.projectId === project.projectId ? "このPJの経営陣登録がないため、議案と採決を表示できません。" : "閲覧資格を確認中…"}</p></div>}
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
          <CockpitBusinessPlan confidential canDownload={pageRuntime?.report?.canDownload??pageRuntime?.operations.canDownload??true} initialPlan={record&&"plan" in record&&record.page==="business-plan"?record.plan:undefined} projectId={project.projectId} projectName={project.projectName} />
        </section>
      )}

      {activeTab === "financial-projection" && (
        <section role="tabpanel" aria-label="試算表" className="min-w-0">
          <CockpitFinancialProjection initialData={record&&"finance" in record?record.finance:undefined} readOnly={!canEdit} projectId={project.projectId} />
        </section>
      )}

      {activeTab === "capital-plan" && (
        <section role="tabpanel" aria-label="資本政策表" className="min-w-0">
          <CockpitCapitalPlan initialData={record&&"capital" in record?record.capital:undefined} readOnly={!canEdit} projectId={project.projectId} projectName={project.projectName} />
        </section>
      )}

      {/* コスト試算タブ。全PJ常設で、データにある試算（処理原価・燃料・部分試算）をタブの中で切り替える
          （2026-10-03 まさ「全部統一してないとだめ」。旧 ?tab=cost-fuel はこのタブの燃料の試算を開く）。
          正本は project_cost_*。自前で fetch するので開いた時だけマウントする。 */}
      {activeTab === "cost-model" && (
        <section role="tabpanel" aria-label={"コスト試算"} className="min-w-0">
          <CockpitCostTab initialData={record&&"costs" in record?record.costs:undefined} allowEdit={canEdit} projectId={project.projectId} initialRenderer={requestedTab === "cost-fuel" ? "fuel" : undefined} />
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
      {activeTab === "poc-list" && <ProjectPocList initialData={record&&"poc" in record?record.poc:undefined} enableEditing={canEdit} projectId={project.projectId} />}

      {activeTab === "technology" && (
        <section role="tabpanel" aria-label="技術" className="min-w-0">
          <CockpitTechnology initialData={record&&"tech" in record?record.tech:undefined} projectId={project.projectId} />
        </section>
      )}

      {/* 競合比較タブ (2026-09-14 まさ依頼)。技術台帳の区分「競合比較」だけを、技術タブと同じ部品で出す。
          提出用の星取り表が先頭に来るので、開いたらそのまま見せられる。自前で fetch するので開いた時だけマウントする。 */}
      {activeTab === "competition" && (
        <section role="tabpanel" aria-label="競合比較" className="min-w-0">
          <CockpitTechnology initialData={record&&"tech" in record?record.tech:undefined} projectId={project.projectId} mode="competition" />
        </section>
      )}

      {/* ビジネスモデルタブ (2026-09-14 まさ依頼)。技術台帳の区分「ビジネスモデル」だけを、技術タブと同じ部品で出す。
          事業の形と、それが成り立つかの検証を置く。自前で fetch するので開いた時だけマウントする。 */}
      {activeTab === "business-model" && (
        <section role="tabpanel" aria-label="ビジネスモデル" className="min-w-0">
          <CockpitTechnology initialData={record&&"tech" in record?record.tech:undefined} projectId={project.projectId} mode="business-model" />
        </section>
      )}

      {/* 知財タブ (2026-08-21 まさ依頼)。自社/大学/共同/障害/ウォッチを同じ台帳で見る。
          CockpitIpPortfolio は自前で fetch するので、開いた時だけマウントする。 */}
      {activeTab === "ip" && (
        <section role="tabpanel" aria-label="知財" className="min-w-0">
          <CockpitIpPortfolio initialData={record&&"portfolio" in record?record.portfolio:undefined} projectId={project.projectId} />
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
        <CockpitMonthlyReports key={project.projectId} projectId={project.projectId} currentYm={currentYm} canViewAdminMonthlyReports={canViewAdminMonthlyReports} />
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

      {activeTab === "proper-nouns" && <section role="tabpanel" aria-label="固有名詞" className="min-w-0"><CockpitProperNouns key={project.projectId} projectId={project.projectId} /></section>}
      {activeTab === "card-designs" && <section role="tabpanel" aria-label="名刺案" className="min-w-0"><ProjectCardDesigns key={project.projectId} projectId={project.projectId} /></section>}

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

      {activeTab === "development-issues" && <section role="tabpanel" aria-label="開発課題"><ProjectDevelopmentIssues initialData={record&&"issues" in record?record.issues:undefined} key={cockpit.project.projectId} projectId={cockpit.project.projectId} /></section>}
      {activeTab === "organization-chart" && <section role="tabpanel" aria-label="組織図"><ProjectOrganizationChart initialData={record&&"organizationChart" in record?record.organizationChart:undefined} projectId={cockpit.project.projectId} /></section>}
      {activeTab === "employee-register" && <section role="tabpanel" aria-label="従業員名簿"><ProjectEmployeeRegister /></section>}
      {activeTab === "contracts" && <section role="tabpanel" aria-label="契約リスト" className="min-w-0"><ProjectContractList initialData={record&&"contracts" in record?record.contracts:undefined} key={project.projectId} projectId={project.projectId} /></section>}

      {activeTab === "capital-policy" && (
        <section role="tabpanel" aria-label="資金調達履歴" className="min-w-0">
          <CockpitCapitalPolicy readOnly={!canEdit} projectId={project.projectId} />
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
          <CockpitCompanyOverview confidential canDownload={pageRuntime?.report?.canDownload??pageRuntime?.operations.canDownload??true} initialData={record&&"governance" in record?record.governance:undefined} initialBusinessSummary={record&&"businessSummary" in record?record.businessSummary:undefined} readOnly={!canEdit} projectId={project.projectId} projectName={project.projectName} />
        </section>
      )}

      {activeTab === "killer-factors" && (
        <section role="tabpanel" aria-label="キラー要素" className="min-w-0">
          <CockpitKillerFactorCatalog projectId={project.projectId} />
        </section>
      )}

      {activeTab === "activity" && (
        <section role="tabpanel" aria-label="沿革" className="flex min-w-0 flex-col gap-3">
          <CockpitGrants initialGrants={record&&"grants" in record?record.grants:undefined} projectId={project.projectId} />
          {hasScoreDetailTab && <Bzm22AcquisitionLedger initialPayload={record&&"acquisitions" in record?record.acquisitions:undefined} projectId={project.projectId} />}
          <CockpitAmdContributions initialPayload={record&&"contributions" in record?record.contributions:undefined} sharedView={external} projectId={project.projectId} />
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
      </div>
    </div>
  );
}
