"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CockpitHeader } from "./CockpitHeader";
import { CockpitVentureStatus } from "./CockpitVentureStatus";
import { CockpitManagementScoreHero } from "./CockpitManagementScoreHero";
import { CockpitGoalsCompact } from "./CockpitGoalsCompact";
import { CockpitStrategySignals } from "./CockpitStrategySignals";
import { CockpitKanbanGas } from "./CockpitKanbanGas";
import { CockpitMonthlyList } from "./CockpitMonthlyList";
import { CockpitMonthlyModal } from "./CockpitMonthlyModal";
import { CockpitNudge } from "./CockpitNudge";
import { CockpitRoutineGas } from "./CockpitRoutineGas";
import { CockpitMeetingSummary } from "./CockpitMeetingSummary";
import { CockpitFreezeBackfill } from "./CockpitFreezeBackfill";
import { CockpitNextPeriodSetup } from "./CockpitNextPeriodSetup";
import { CockpitRoutineBudgetModal } from "./CockpitRoutineBudgetModal";
import { CockpitRoutineMeetingModal } from "./CockpitRoutineMeetingModal";
import { CockpitRoutineInvoiceModal } from "./CockpitRoutineInvoiceModal";
import { CockpitRoutineInvoiceSendConfirm } from "./CockpitRoutineInvoiceSendConfirm";

interface PlanCycleShape {
  planCycleId: string; status: string; budgetYen: number; totalPoints: number;
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
      confidence: number;
      createdAt: string;
      confirmedAt: string | null;
    }>;
  };
  nudges: Array<{
    message: string; status: string; level: string; postedAt: string | null;
  }>;
  tasks: Array<{
    taskId: string; title: string; status: string;
    assignee?: string; priority?: string; description?: string;
  }>;
  initialModalYm?: string | null;
  /** mypage や URL `?step=` から渡される、起動時に開くべきステップ */
  initialStep?: { ym: string; stepId: string } | null;
  /** PM (= project_members.is_pm) もしくは admin (= members.is_admin) のみ true。
      false の場合、月次ルーティンのステップボタンは disabled。まさ要望 2026-05-11。 */
  canEditRoutine?: boolean;
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

/** stepId → 開くべきモーダル種別を決める。reimburseConfirm は遷移するだけなので null を返す。 */
type BillingCycleShape = {
  ym: string;
  meetingEventId?: string | null;
  meetingStartAt: string | null;
  reportFixedAt: string | null;
};

type MonthlyModalTab = "reward" | "report";

function resolveStepModalFromTap(
  ym: string,
  stepId: string,
  cycle: BillingCycleShape | undefined,
  onReimburseConfirm: () => void
): StepModal {
  switch (stepId) {
    case "budget":
      return { kind: "budget", ym };
    case "estimateSend":
      return { kind: "invoice", ym, documentType: "quotation" };
    case "meeting": {
      const isDone = !!cycle?.meetingEventId || !!cycle?.meetingStartAt;
      // iOS の「done時、href があればそのままカレンダーに飛ぶ」分岐は、PWA では
      // どちらにせよモーダル内で確定済み表示にする (Calendar 直リンクは未対応)
      const doneAction = cycle?.meetingStartAt ? `cpShowMeetingInfo('${cycle.meetingStartAt}')` : null;
      return { kind: "meeting", ym, isDone, doneAction };
    }
    case "reportFix":
      return null;
    case "reimburseConfirm":
      onReimburseConfirm();
      return null;
    case "invoiceIssue":
      return { kind: "invoice", ym, documentType: "invoice" };
    case "invoiceSend":
      return { kind: "invoiceSend", ym };
    default:
      return null;
  }
}

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

type StepModal =
  | { kind: "budget"; ym: string }
  | { kind: "meeting"; ym: string; isDone: boolean; doneAction: string | null }
  | { kind: "invoice"; ym: string; documentType: "invoice" | "quotation" }
  | { kind: "invoiceSend"; ym: string }
  | null;

export function CockpitView({ cockpit, nudges, tasks, initialModalYm, initialStep, canEditRoutine = false }: CockpitViewProps) {
  const router = useRouter();
  const [modalYm, setModalYm] = useState<string | null>(
    initialStep?.stepId === "reportFix" ? initialStep.ym : initialModalYm || null
  );
  const [modalInitialTab, setModalInitialTab] = useState<MonthlyModalTab | undefined>(
    initialStep?.stepId === "reportFix" ? "report" : undefined
  );
  const [pastExpanded, setPastExpanded] = useState(false);
  const [editingCurrentCycle, setEditingCurrentCycle] = useState(false);
  const [progressPatches, setProgressPatches] = useState<ProgressShape[]>([]);
  const [stepModal, setStepModal] = useState<StepModal>(() => {
    if (!initialStep) return null;
    if (initialStep.stepId === "reportFix") return null;
    const cycle = cockpit.billingCycles.find((bc) => bc.ym === initialStep.ym);
    return resolveStepModalFromTap(initialStep.ym, initialStep.stepId, cycle, () => {});
  });

  function openMonthlyModal(ym: string, initialTab?: MonthlyModalTab) {
    setModalInitialTab(initialTab);
    setModalYm(ym);
  }

  function closeMonthlyModal() {
    setModalYm(null);
    setModalInitialTab(undefined);
  }

  function handleStepClick(ym: string, stepId: string) {
    if (stepId === "reimburseConfirm") {
      router.push("/reimburse");
      return;
    }
    if (stepId === "reportFix") {
      setStepModal(null);
      openMonthlyModal(ym, "report");
      return;
    }
    const cycle = cockpit.billingCycles.find((bc) => bc.ym === ym);
    const next = resolveStepModalFromTap(ym, stepId, cycle, () => router.push("/reimburse"));
    if (next) setStepModal(next);
  }
  const { project, currentYm, billingCycles, planCycle, milestones, progress, reports, subItems, responsibilities, memberMap, pastPlanCycles, msActivities, memberActivities, strategySignals } = cockpit;
  const usesMsProgress = usesMsProgressCategory(project.projectCategory);

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
  const activeStepModal = showLiveOperations ? stepModal : null;

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
    if (effectivePlanCycle.status === "draft" || editingCurrentCycle) {
      return (
        <CockpitNextPeriodSetup
          projectId={project.projectId}
          currentYm={currentYm}
          currentPlanCycle={effectivePlanCycle}
          directCycleId={effectivePlanCycle.planCycleId}
          autoOpen={editingCurrentCycle}
          onModalClose={() => setEditingCurrentCycle(false)}
        />
      );
    }
    return (
      <>
        {isPeriodExpired && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ 今期の MS 期間 ({formatYm(effectivePlanCycle.periodEndYm)}) は終了しています。
            下のバナーから次期 MS を設定してください。
          </div>
        )}
        <CockpitNextPeriodSetup
          projectId={project.projectId}
          currentYm={currentYm}
          currentPlanCycle={effectivePlanCycle}
        />
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

  return (
    // 案D レイアウト (2026-05-24 #28 まさ確定):
    //  上: Header + Hero (AMD Score chart + XRL chart 横並び)
    //  メインボード 3 カラム:
    //    col1 = 今期MS + 次期MS設定 + 過去の期間 + 月次カード + 休止期間 backfill
    //    col2 = 経営ハイライト (L2 ⑨) + MTGサマリ
    //    col3 = ステータスバッジ + 月次ルーティン + nudge (sticky)
    //  最下: TODO カンバン全幅
    <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-col gap-3">
      {/* [A] Project Header (full width) */}
      <CockpitHeader project={project} />

      {/* [A2] Hero (案C: Header 直下の全幅セクション)
            - p00 (= AMD 会社全体) は AMD Management Score の時系列折れ線 + 最新値カード
            - SU 系 PJ は CockpitVentureStatus (AMD Score + XRL chart 横並び)
            - ecosystem PJ は AMD Score 対象外なので Hero を出さない */}
      {project.projectId === "p00" ? (
        <CockpitManagementScoreHero />
      ) : showAmdScore ? (
        <CockpitVentureStatus projectId={project.projectId} />
      ) : null}

      {/* メインボード: 3 カラム grid (lg breakpoint 以上)
          1.2fr 1.2fr 300px = MS / 経営シグナル / 月次ルーティン
          col3 は sticky (mobile / md は通常配置) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px] gap-3 items-start">

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
              onEdit={planCycle ? () => setEditingCurrentCycle(true) : undefined}
            />
          )}
          {renderMsSetupBanner()}
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

        {/* col2: 経営ハイライト (L2 ⑨) + MTGサマリ (まさ #28 2026-05-24)。
            右カラムを「経営シグナル + MTGサマリ」に統合。 */}
        <div className="flex flex-col gap-3 min-w-0">
          <CockpitStrategySignals signals={strategySignals || []} projectId={project.projectId} />
          <CockpitMeetingSummary projectId={project.projectId} />
        </div>

        {/* col3: ステータスバッジ + 月次ルーティン + nudge (lg 以上で sticky) */}
        <div className="flex flex-col gap-3 min-w-0 lg:sticky lg:top-12 lg:max-h-[calc(100vh-60px)] lg:overflow-y-auto">
          {statusBadges.length > 0 && (
            <div className="flex flex-col gap-1">
              {statusBadges.map((b) => (
                <span key={b.key} className={`text-[11px] px-2 py-1 rounded-md border ${b.cls}`}>
                  {b.text}
                </span>
              ))}
            </div>
          )}
          {showLiveOperations && (
            <>
              {!canEditRoutine && (
                <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-1">
                  🔒 月次ルーティンは PM のみ操作可能 (= 閲覧のみ)
                </div>
              )}
              <div className={canEditRoutine ? "" : "pointer-events-none opacity-60"}>
                <CockpitRoutineGas
                  projectId={project.projectId}
                  billingCycles={billingCycles}
                  currentYm={currentYm}
                  projectType={project.projectType}
                  projectCategory={project.projectCategory}
                  onOpenModal={(ym) => openMonthlyModal(ym)}
                  onStepClick={handleStepClick}
                />
              </div>
            </>
          )}
          <CockpitNudge nudges={nudges} />
        </div>
      </div>

      {/* [C] TODO Kanban — 全幅 (案D 最下段) */}
      {tasks.length > 0 && (
        <CockpitKanbanGas tasks={tasks} milestones={usesMsProgress ? milestones : []} memberMap={memberMap || {}} />
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

      {/* ===== Step Modals (各ルーティンタスク → 専用ウィンドウ) ===== */}
      {activeStepModal?.kind === "budget" && (
        <CockpitRoutineBudgetModal
          projectId={project.projectId}
          ym={activeStepModal.ym}
          open
          onClose={() => setStepModal(null)}
        />
      )}
      {activeStepModal?.kind === "meeting" && (
        <CockpitRoutineMeetingModal
          projectId={project.projectId}
          ym={activeStepModal.ym}
          isDone={activeStepModal.isDone}
          doneAction={activeStepModal.doneAction}
          open
          onClose={() => setStepModal(null)}
        />
      )}
      {activeStepModal?.kind === "invoice" && (
        <CockpitRoutineInvoiceModal
          projectId={project.projectId}
          ym={activeStepModal.ym}
          documentType={activeStepModal.documentType}
          open
          onClose={() => setStepModal(null)}
        />
      )}
      {activeStepModal?.kind === "invoiceSend" && (
        <CockpitRoutineInvoiceSendConfirm
          projectId={project.projectId}
          ym={activeStepModal.ym}
          open
          onClose={() => setStepModal(null)}
        />
      )}
    </div>
  );
}
