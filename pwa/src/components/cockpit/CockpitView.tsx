"use client";

import { useState } from "react";
import { CockpitHeader } from "./CockpitHeader";
import { CockpitVentureStatus } from "./CockpitVentureStatus";
import { CockpitManagementScoreHero } from "./CockpitManagementScoreHero";
import { CockpitGoalsCompact } from "./CockpitGoalsCompact";
import { CockpitStrategySignals } from "./CockpitStrategySignals";
import { CockpitGrants } from "./CockpitGrants";
import { WorkspaceDocumentLauncher } from "@/components/workspace-documents/WorkspaceDocumentRoom";
import { CockpitKuteAnnualRoadmap } from "./CockpitKuteAnnualRoadmap";
import { CockpitKuteRegulations } from "./CockpitKuteRegulations";
import { ProjectInstitutionSeeds } from "./CockpitKuteSeeds";
import { CockpitSeasonFinance } from "./CockpitSeasonFinance";
import { CockpitMsChangeHistory } from "./CockpitMsChangeHistory";
import { CockpitMonthlyList } from "./CockpitMonthlyList";
import { CockpitMonthlyModal } from "./CockpitMonthlyModal";
import { CockpitMeetingSummary } from "./CockpitMeetingSummary";
import { CockpitFreezeBackfill } from "./CockpitFreezeBackfill";
import { CockpitAmdScoreDetailTab } from "./CockpitAmdScoreDetailTab";
import { CockpitCompanyOverview } from "./CockpitCompanyOverview";
import { CockpitBusinessPlan } from "./CockpitBusinessPlan";
import { CockpitSharedProjectControl } from "./CockpitSharedProjectControl";
import type { CockpitSeasonFinance as CockpitSeasonFinanceData, MilestoneChangeHistory } from "@/lib/supabase-data";
import type { ProjectContractTerms } from "@/lib/project-contract-terms";

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

export type CockpitTab = "progress" | "score-detail" | "business-plan" | "regulations" | "company";

export function CockpitView({ cockpit, initialModalYm, activeTab: controlledTab, onTabChange }: CockpitViewProps) {
  const [localActiveTab, setLocalActiveTab] = useState<CockpitTab>("progress");
  const activeTab = controlledTab ?? localActiveTab;
  const [modalYm, setModalYm] = useState<string | null>(initialModalYm || null);
  const [modalInitialTab, setModalInitialTab] = useState<MonthlyModalTab | undefined>(undefined);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [progressPatches, setProgressPatches] = useState<ProgressShape[]>([]);

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
  const hasBusinessPlanTab = project.projectId === "p21";
  const hasKuteRegulationsTab = project.projectId === "p25";

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
    ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px] gap-3 items-start"
    : "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start";

  return (
    // 案D レイアウト (2026-05-24 #28 まさ確定):
    //  上: Header + Hero (AMD Score chart + XRL chart 横並び)
    //  メインボード:
    //    col1 = 今期MS + 次期MS設定 + 過去の期間 + 月次カード + 休止期間 backfill
    //    col2 = 資料 + 経営ハイライト (D-6) + MTGサマリ
    //    col3 = ステータスバッジ (必要な時だけ sticky)
    <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-col gap-3">
      {/* [A] Project Header (full width) */}
      <CockpitHeader project={project} members={members} />

      {activeTab === "progress" && project.projectId === "p21" && (
        <CockpitSharedProjectControl projectId={project.projectId} />
      )}

      {activeTab === "progress" && project.projectId === "p25" && <CockpitKuteAnnualRoadmap currentYm={currentYm} />}
      {activeTab === "progress" && <ProjectInstitutionSeeds projectId={project.projectId} />}

      {/* [A2] Hero (案C: Header 直下の全幅セクション)
            - p00 (= AMD 会社全体) は AMD Management Score の時系列折れ線 + 最新値カード
            - SU 系 PJ は CockpitVentureStatus (AMD Score + XRL chart 横並び)
            - ecosystem PJ は AMD Score 対象外なので Hero を出さない */}
      {(activeTab === "progress" || activeTab === "score-detail") && (project.projectId === "p00" ? (
        <CockpitManagementScoreHero />
      ) : showAmdScore ? (
        <CockpitVentureStatus
          projectId={project.projectId}
          projectName={project.projectName}
          onOpenScoreDetail={() => selectTab("score-detail")}
        />
      ) : null)}

      <div
        className="grid overflow-hidden rounded-xl border border-[#d6d6da] bg-[#f5f5f7]"
        style={{ gridTemplateColumns: `repeat(${2 + Number(hasScoreDetailTab) + Number(hasBusinessPlanTab) + Number(hasKuteRegulationsTab)}, minmax(0, 1fr))` }}
        role="tablist"
        aria-label="コックピット表示切り替え"
      >
          {[
            { key: "progress" as const, label: "進捗管理" },
            ...(hasScoreDetailTab ? [{ key: "score-detail" as const, label: "スコア詳細" }] : []),
            ...(hasBusinessPlanTab ? [{ key: "business-plan" as const, label: "事業計画" }] : []),
            ...(hasKuteRegulationsTab ? [{ key: "regulations" as const, label: "規程・内規" }] : []),
            { key: "company" as const, label: "会社概要" },
          ].map((tab, index) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectTab(tab.key)}
                className={`relative min-h-11 w-full px-3 text-center text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${
                  index > 0 ? "border-l border-[#d6d6da]" : ""
                } ${
                  selected
                    ? "bg-white text-slate-950 shadow-[inset_0_-2px_0_#0f172a]"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
      </div>

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

        {/* col2: 資料室ボタン + 経営ハイライト (D-6) + MTGサマリ。
            旧 proactive_outbox TODO は 2026-06-27 に廃止済みのため表示しない。 */}
        <div className="flex flex-col gap-3 min-w-0">
          <WorkspaceDocumentLauncher projectId={project.projectId} projectName={project.projectName} />
          <CockpitStrategySignals signals={strategySignals || []} projectId={project.projectId} />
          <CockpitGrants projectId={project.projectId} />
          <CockpitMeetingSummary projectId={project.projectId} />
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

      {hasBusinessPlanTab && (
        <section
          role="tabpanel"
          aria-label="事業計画"
          hidden={activeTab !== "business-plan"}
          className={activeTab === "business-plan" ? "min-w-0" : "hidden"}
        >
          <CockpitBusinessPlan projectId={project.projectId} projectName={project.projectName} />
        </section>
      )}

      {hasKuteRegulationsTab && (
        <section
          role="tabpanel"
          aria-label="規程・内規"
          hidden={activeTab !== "regulations"}
          className={activeTab === "regulations" ? "min-w-0" : "hidden"}
        >
          <CockpitKuteRegulations />
        </section>
      )}

      <section
        role="tabpanel"
        aria-label="会社概要"
        hidden={activeTab !== "company"}
        className={activeTab === "company" ? "min-w-0" : "hidden"}
      >
        <CockpitCompanyOverview projectId={project.projectId} projectName={project.projectName} showCapitalPlan={!hasBusinessPlanTab} />
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
