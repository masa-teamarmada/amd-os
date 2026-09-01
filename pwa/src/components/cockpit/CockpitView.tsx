"use client";

import { useEffect, useState } from "react";
import { CockpitHeader } from "./CockpitHeader";
import { CockpitVentureStatus } from "./CockpitVentureStatus";
import { CockpitManagementScoreHero } from "./CockpitManagementScoreHero";
import { CockpitGoalsCompact } from "./CockpitGoalsCompact";
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
import { CockpitMonthlyList } from "./CockpitMonthlyList";
import { CockpitMonthlyModal } from "./CockpitMonthlyModal";
import { CockpitMeetingSummary } from "./CockpitMeetingSummary";
import { CockpitFreezeBackfill } from "./CockpitFreezeBackfill";
import { CockpitAmdScoreDetailTab } from "./CockpitAmdScoreDetailTab";
import { CockpitCompanyOverview } from "./CockpitCompanyOverview";
import { CockpitProjectOverview } from "./CockpitProjectOverview";
import { CockpitProjectControl } from "./CockpitProjectControl";
import type { SxWeeklyControlView } from "@/components/project-workspace/SxWeeklyControlDashboard";
import { CockpitBusinessPlan } from "./CockpitBusinessPlan";
import { CockpitCapitalPolicy } from "./CockpitCapitalPolicy";
import type { CockpitTab } from "@/lib/cockpit-tabs";
import { prefetchGovernance } from "@/lib/governance-client";
import type { CockpitSeasonFinance as CockpitSeasonFinanceData, MilestoneChangeHistory } from "@/lib/supabase-data";
import type { ProjectContractTerms } from "@/lib/project-contract-terms";
import { CockpitCostModel } from "@/components/cockpit/CockpitCostModel";
import { prefetchProjectOrg } from "@/lib/project-org-client";
import { prefetchProjectCostModel } from "@/lib/project-cost-model-client";
import { prefetchProjectTech } from "@/lib/project-tech-client";
import {
  cockpitGroupForTab,
  cockpitGroupsForProject,
  resolveCockpitTab,
  type CockpitGroupKey,
} from "@/lib/cockpit-tabs";
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
  "objective-structure": "gantt",
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
  ip: "ip",
  drive: "documents",
};

export function CockpitView({ cockpit, initialModalYm, activeTab: controlledTab, onTabChange, institutionId: providedInstitutionId, hideNavigation = false }: CockpitViewProps) {
  const [localActiveTab, setLocalActiveTab] = useState<CockpitTab>("progress");
  const [openGroupKey, setOpenGroupKey] = useState<CockpitGroupKey | null>(null);
  const [desktopHoverEnabled, setDesktopHoverEnabled] = useState(false);
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
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setDesktopHoverEnabled(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  const isInstitutionProject = resolvedInstitutionId != null;
  const resolvedTab = resolveCockpitTab(requestedTab, isInstitutionProject);
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

  const { project, currentYm, billingCycles, planCycle, milestones, progress, reports, members, subItems, responsibilities, memberMap, pastPlanCycles, msActivities, memberActivities, seasonFinance, msChangeHistory, strategySignals } = cockpit;
  const usesMsProgress = usesMsProgressCategory(project.projectCategory);
  // 通常PJの事業計画グループは常設。研究機関PJはシーズリスト・規程内規へ置き換える。
  // フェーズ表と年次試算表はSX (p21) 固有データなので、SXのときだけ足す。
  const hasSxBusinessPlanDetail = project.projectId === "p21";
  const hasInstitutionRegulationsTab = isInstitutionProject && Boolean(resolvedInstitutionId);
  const hasInstitutionSeedsTab = isInstitutionProject && Boolean(resolvedInstitutionId);

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
  const showAmdScore = (project.projectCategory || "dtsu") !== "ecosystem";
  const hasScoreDetailTab = project.projectId !== "p00" && showAmdScore;

  // グループと所属タブは cockpit-tabs.ts が正本。ここでは表示条件とラベルだけを足す。
  const groups = cockpitGroupsForProject(isInstitutionProject);
  const tabLabel: Partial<Record<CockpitTab, string>> = {
    progress: "MS・月次",
    meetings: "動向・会議",
    weekly: "週次差分",
    gantt: "ガント",
    "objective-structure": "目的構造",
    partners: "関係先",
    issues: "論点・仮説",
    "score-detail": "スコア詳細",
    technology: "技術",
    "business-plan": "事業計画",
    "cost-model": "コスト試算",
    ip: "知財",
    seeds: "シーズ一覧",
    regulations: "規程一覧",
    documents: "ドライブ",
    overview: "PJ概要",
    "capital-policy": "資本政策",
    company: "会社概要",
  };
  const availableTab = (tab: CockpitTab) => {
    if (tab === "score-detail") return hasScoreDetailTab;
    if (tab === "seeds") return hasInstitutionSeedsTab;
    if (tab === "regulations") return hasInstitutionRegulationsTab;
    return true;
  };
  const visibleGroups = groups.map((group) => ({
    ...group,
    children: group.children.filter(availableTab),
  })).filter((group) => group.children.length > 0);
  const requestedGroup = cockpitGroupForTab(resolvedTab, isInstitutionProject);
  const activeGroupWithAvailableChildren = visibleGroups.find((group) => group.key === requestedGroup.key) ?? visibleGroups[0];
  // URLが現在のPJでは非表示になるタブを指していても、空画面にせず同じグループの先頭へ落とす。
  const activeTab = activeGroupWithAvailableChildren?.children.includes(resolvedTab)
    ? resolvedTab
    : activeGroupWithAvailableChildren?.children[0] ?? "progress";
  const childTabs = activeGroupWithAvailableChildren?.children ?? ["progress"];
  const workspaceView = WORKSPACE_VIEW_BY_TAB[activeTab];
  const workspaceGanttDisplayMode = activeTab === "objective-structure" ? "objective" : activeTab === "gantt" ? "timeline" : undefined;
  const tabItem = (key: CockpitTab) => ({
    key,
    label: tabLabel[key] ?? key,
    onHover: key === "score-detail" ? () => prefetchProjectOrg(project.projectId)
      : key === "technology" ? () => prefetchProjectTech(project.projectId)
      : key === "cost-model" ? () => prefetchProjectCostModel(project.projectId)
      : key === "capital-policy" || key === "company" ? () => prefetchGovernance(project.projectId)
      : undefined,
  });
  const childTabItems: { key: CockpitTab; label: string; onHover?: () => void }[] = childTabs.map(tabItem);
  const groupTabItems = (group: typeof visibleGroups[number]) => group.children.map(tabItem);

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
      data-cockpit-project-kind={isInstitutionProject ? "institution" : "standard"}
    >
      {/* [A] Project Header (full width) */}
      <CockpitHeader project={project} members={members} />

      {/* 旧 [A2] Hero (PJの見出し・担当・事業概要・XRL進捗) は 2026-08-28 まさ依頼で
          「PJ概要」タブへ丸ごと移した。上段に残すのは CockpitHeader だけで、
          コックピットを開いた直後は進捗管理の中身がすぐ目に入る。 */}

      {!hideNavigation && (
        <>
          <nav
            className={`grid gap-1 rounded-xl border border-[#bfc0c7] bg-[#f5f5f7] p-1 ${visibleGroups.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}
            aria-label="コックピット分類"
            data-testid="cockpit-group-navigation"
          >
            {visibleGroups.map((group) => {
              const selected = activeGroupWithAvailableChildren?.key === group.key;
              const groupItems = groupTabItems(group);
              return (
                <div
                  key={group.key}
                  className="group relative min-w-0"
                  onPointerEnter={() => {
                    if (desktopHoverEnabled) setOpenGroupKey(group.key);
                  }}
                  onPointerLeave={() => {
                    if (desktopHoverEnabled) setOpenGroupKey(null);
                  }}
                  onFocusCapture={() => setOpenGroupKey(group.key)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setOpenGroupKey(null);
                    }
                  }}
                >
                  <button
                    type="button"
                    aria-current={selected ? "page" : undefined}
                    aria-haspopup={desktopHoverEnabled && groupItems.length > 1 ? "true" : undefined}
                    aria-expanded={desktopHoverEnabled && groupItems.length > 1 ? openGroupKey === group.key : undefined}
                    aria-controls={desktopHoverEnabled && groupItems.length > 1 ? `cockpit-group-menu-${group.key}` : undefined}
                    data-cockpit-group={group.key}
                    onClick={() => selectGroup(group.key)}
                    className={`min-h-11 sm:min-h-9 w-full cursor-pointer whitespace-nowrap rounded-lg px-2 sm:px-3 text-center text-[13px] font-bold transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${
                      selected
                        ? "bg-white text-slate-950 shadow-[inset_0_-2px_0_#0f172a]"
                        : "text-slate-500 hover:bg-white/80 hover:text-slate-900"
                    }`}
                  >
                    {group.label}
                  </button>
                  {desktopHoverEnabled && openGroupKey === group.key && groupItems.length > 1 && (
                    <div
                      className="pointer-events-auto absolute left-0 top-full z-30 w-max min-w-full pt-1"
                      id={`cockpit-group-menu-${group.key}`}
                      role="region"
                      aria-label={`${group.label}のタブ`}
                      data-testid={`cockpit-floating-${group.key}`}
                    >
                      <div className="overflow-hidden rounded-lg border border-[#bfc0c7] bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                        {groupItems.map((tab) => {
                          const tabSelected = activeTab === tab.key;
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              aria-current={tabSelected ? "page" : undefined}
                              data-cockpit-tab={tab.key}
                              onClick={() => {
                                setOpenGroupKey(null);
                                selectTab(tab.key);
                              }}
                              onMouseEnter={tab.onHover}
                              onFocus={tab.onHover}
                              className={`flex min-h-11 sm:min-h-7 w-full cursor-pointer items-center whitespace-nowrap rounded-md px-2.5 text-left text-[12px] font-semibold transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-inset ${
                                tabSelected
                                  ? "bg-[#f5f5f7] text-slate-950"
                                  : "text-slate-600 hover:bg-[#f5f5f7] hover:text-slate-900"
                              }`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          {childTabItems.length > 1 && (
            <nav
              className="flex gap-1 overflow-x-auto rounded-lg border border-[#d6d6da] bg-white p-1"
              aria-label={`${activeGroupWithAvailableChildren?.label ?? "コックピット"}の表示切り替え`}
              data-testid="cockpit-child-navigation"
            >
              {childTabItems.map((tab) => {
                const selected = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-current={selected ? "page" : undefined}
                    data-cockpit-tab={tab.key}
                    onClick={() => selectTab(tab.key)}
                    onMouseEnter={tab.onHover}
                    onFocus={tab.onHover}
                    className={`min-h-11 sm:min-h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-md px-2.5 sm:px-3 text-[12px] font-semibold transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${
                      selected
                        ? "bg-[#f5f5f7] text-slate-950 shadow-[inset_0_-2px_0_#0f172a]"
                        : "text-slate-500 hover:bg-[#f5f5f7] hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          )}
        </>
      )}

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

      {/* 事業計画タブ。CapitalPlanWorkspace が自前で fetch するので、開いた時だけマウントする。 */}
      {activeTab === "business-plan" && (
        <section role="tabpanel" aria-label="事業計画" className="min-w-0">
          <CockpitBusinessPlan projectId={project.projectId} projectName={project.projectName} showSxDetail={hasSxBusinessPlanDetail} showTimeLedger={hasScoreDetailTab} />
        </section>
      )}

      {/* コスト試算タブ (2026-08-23 まさ依頼)。前提を1つ動かすと4シナリオが再計算される。
          正本は project_cost_* で、Google Sheets からDBへ移した。自前で fetch するので開いた時だけマウントする。 */}
      {activeTab === "cost-model" && (
        <section role="tabpanel" aria-label="コスト試算" className="min-w-0">
          <CockpitCostModel projectId={project.projectId} />
        </section>
      )}

      {hasInstitutionRegulationsTab && resolvedInstitutionId && (
        <section
          role="tabpanel"
          aria-label="規程・内規"
          hidden={activeTab !== "regulations"}
          className={activeTab === "regulations" ? "min-w-0" : "hidden"}
        >
          <InstitutionRegulationsPanel institutionId={resolvedInstitutionId} />
        </section>
      )}

      {hasInstitutionSeedsTab && hasVisitedSeeds && resolvedInstitutionId && (
        <section
          role="tabpanel"
          aria-label="シーズ一覧"
          hidden={activeTab !== "seeds"}
          className={activeTab === "seeds" ? "min-w-0" : "hidden"}
        >
          <ProjectInstitutionSeeds projectId={project.projectId} />
        </section>
      )}

      {/* 技術タブ (2026-08-29 まさ依頼)。この技術がどの範囲で成立し、競合とどこで差がつき、
          今どこまで行っているかを貯める。自前で fetch するので開いた時だけマウントする。 */}
      {activeTab === "technology" && (
        <section role="tabpanel" aria-label="技術" className="min-w-0">
          <CockpitTechnology projectId={project.projectId} />
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

      {/* 管制タブ (週次差分 / ガント / 目的構造 / 関係先 / 論点・仮説)。
          ガントと目的構造も1つのマウントを共有するので、行き来しても束を読み直さない。 */}
      {workspaceView && (
        <section role="tabpanel" aria-label="PJ管制" className="min-w-0">
          <CockpitProjectControl
            projectId={project.projectId}
            view={workspaceView}
            ganttDisplayMode={workspaceGanttDisplayMode}
            onViewChange={(next) => {
              const tab = TAB_BY_WORKSPACE_VIEW[next];
              if (tab) selectTab(tab);
            }}
          />
        </section>
      )}

      {/* PJ概要タブ (2026-08-28 まさ依頼)。このPJがどういうものかを1枚で読む面。
            - p00 (= AMD 会社全体) は AMD Management Score の時系列折れ線 + 最新値カード
            - SU 系 PJ は CockpitVentureStatus の見出し・レーン・担当・事業概要
              (XRL進捗は 2026-08-28 まさ指摘でスコア詳細タブへ)
            - ecosystem PJ は AMD Score 対象外なので出さない
          その下に契約上の実行条件。どちらも開いた時だけマウントする。 */}
      {activeTab === "overview" && (
        <section role="tabpanel" aria-label="PJ概要" className="flex min-w-0 flex-col gap-3">
          {project.projectId === "p00" ? (
            <CockpitManagementScoreHero />
          ) : showAmdScore ? (
            <CockpitVentureStatus
              projectId={project.projectId}
              projectName={project.projectName}
              onOpenScoreDetail={() => selectTab("score-detail")}
              sections="identity"
            />
          ) : null}
          <CockpitProjectOverview project={project} />
          <section aria-labelledby="cockpit-activity-results-title" className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-3 px-1 pt-1">
              <h2 id="cockpit-activity-results-title" className="shrink-0 text-sm font-semibold text-slate-900">
                活動・実績
              </h2>
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            </div>
            <CockpitGrants projectId={project.projectId} />
            {hasScoreDetailTab && <Bzm22AcquisitionLedger projectId={project.projectId} />}
            <CockpitAmdContributions projectId={project.projectId} />
          </section>
        </section>
      )}

      {activeTab === "capital-policy" && (
        <section role="tabpanel" aria-label="資本政策表" className="min-w-0">
          <CockpitCapitalPolicy projectId={project.projectId} />
        </section>
      )}

      <section
        role="tabpanel"
        aria-label="会社概要"
        hidden={activeTab !== "company"}
        className={activeTab === "company" ? "min-w-0" : "hidden"}
      >
        <CockpitCompanyOverview projectId={project.projectId} projectName={project.projectName} />
      </section>

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
  );
}
