"use client";

import { useState } from "react";
import { CockpitHeader } from "./CockpitHeader";
import { CockpitVentureStatus } from "./CockpitVentureStatus";
import { CockpitGoalsCompact } from "./CockpitGoalsCompact";
import { CockpitKanbanGas } from "./CockpitKanbanGas";
import { CockpitMonthlyList } from "./CockpitMonthlyList";
import { CockpitMonthlyModal } from "./CockpitMonthlyModal";
import { CockpitNudge } from "./CockpitNudge";
import { CockpitRoutineGas } from "./CockpitRoutineGas";
import { CockpitMeetingSummary } from "./CockpitMeetingSummary";
import { CockpitNextPeriodSetup } from "./CockpitNextPeriodSetup";

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
    project: { projectId: string; projectName: string; clientName: string; status: string; projectType?: string };
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
  };
  nudges: Array<{
    message: string; status: string; level: string; postedAt: string | null;
  }>;
  tasks: Array<{
    taskId: string; title: string; status: string;
    assignee?: string; priority?: string; description?: string;
  }>;
  initialModalYm?: string | null;
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
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

export function CockpitView({ cockpit, nudges, tasks, initialModalYm }: CockpitViewProps) {
  const [modalYm, setModalYm] = useState<string | null>(initialModalYm || null);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [editingCurrentCycle, setEditingCurrentCycle] = useState(false);
  const [progressPatches, setProgressPatches] = useState<ProgressShape[]>([]);
  const { project, currentYm, billingCycles, planCycle, milestones, progress, reports, subItems, responsibilities, memberMap, pastPlanCycles, msActivities, memberActivities } = cockpit;

  const currentProgress = mergeProgress(progress, progressPatches);
  const patchedPastPlanCycles = (pastPlanCycles || []).map((bundle) => ({
    ...bundle,
    progress: mergeProgress(bundle.progress, progressPatches),
  }));
  const allBundles = [
    ...(planCycle ? [{ planCycle, milestones, progress: currentProgress }] : []),
    ...patchedPastPlanCycles.map((bundle) => ({
      planCycle: bundle.planCycle,
      milestones: bundle.milestones,
      progress: bundle.progress,
    })),
  ];
  const monthlyProgressByYm = Object.fromEntries(
    billingCycles.map((bc) => [bc.ym, monthlyProgressItems(bc.ym, allBundles)])
  );
  const progressMap = new Map(milestones.map((m) => [m.milestoneId, latestProgressPct(currentProgress, m.milestoneId, currentYm)]));

  const modalReport = modalYm ? reports.find((r) => r.ym === modalYm) ?? null : null;
  const modalBilling = modalYm ? billingCycles.find((bc) => bc.ym === modalYm) ?? null : null;
  const modalBundle = modalYm
    ? [
        ...(planCycle ? [{ planCycle, milestones, progress: currentProgress, subItems: subItems || [], responsibilities: responsibilities || [], msActivities: msActivities || [], memberActivities: memberActivities || [] }] : []),
        ...patchedPastPlanCycles,
      ].find((bundle) => modalYm >= bundle.planCycle.periodStartYm && modalYm <= bundle.planCycle.periodEndYm)
    : null;
  const modalPlanCycle = modalBundle?.planCycle || planCycle;
  const modalMilestones = modalBundle?.milestones || milestones;
  const modalProgress = modalBundle?.progress || progress;
  const modalSubItems = modalBundle?.subItems || subItems || [];
  const modalResponsibilities = modalBundle?.responsibilities || responsibilities || [];
  const modalMsActivities = modalBundle?.msActivities || msActivities || [];
  const modalMemberActivities = modalBundle?.memberActivities || memberActivities || [];

  return (
    <div className="flex gap-4 max-w-[1060px] mx-auto px-3 py-3 items-start">
      {/* ===== LEFT COLUMN ===== */}
      <div className="flex-1 max-w-[720px] min-w-0 flex flex-col gap-3">
        {/* [A] Project Header */}
        <CockpitHeader project={project} />

        {/* [A2] PJ Status (SU 系 PJ のみ。`project_ventures` 未登録なら自動で非表示) */}
        <CockpitVentureStatus projectId={project.projectId} />

        {/* [B] Milestones — 現在の期間（トップ表示） */}
        {planCycle && milestones.length > 0 && (
          <CockpitGoalsCompact
            milestones={milestones}
            progressMap={progressMap}
            planCycle={planCycle}
            subItems={subItems || []}
            responsibilities={responsibilities || []}
            memberMap={memberMap || {}}
            onEdit={planCycle ? () => setEditingCurrentCycle(true) : undefined}
          />
        )}

        {/* [B2] MS設定バナー／直接編集
            - draft or 外部トリガー: directCycleIdで直接編集
            - active確定済: 次の期間設定バナー（終了3か月前から）
        */}
        {planCycle && (planCycle.status === "draft" || editingCurrentCycle) ? (
          <CockpitNextPeriodSetup
            projectId={project.projectId}
            currentYm={currentYm}
            currentPlanCycle={planCycle}
            directCycleId={planCycle.planCycleId}
            autoOpen={editingCurrentCycle}
            onModalClose={() => setEditingCurrentCycle(false)}
          />
        ) : planCycle ? (
          <CockpitNextPeriodSetup
            projectId={project.projectId}
            currentYm={currentYm}
            currentPlanCycle={planCycle}
          />
        ) : null}

        {/* [B3] 過去の期間（折りたたみ） */}
        {pastPlanCycles && pastPlanCycles.length > 0 && (
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
                {patchedPastPlanCycles.map((bundle) => {
                  const pastProgressMap = new Map(
                    bundle.milestones.map((m) => [
                      m.milestoneId,
                      latestProgressPct(bundle.progress, m.milestoneId, bundle.planCycle.periodEndYm),
                    ])
                  );
                  return (
                    <div key={bundle.planCycle.planCycleId} className="border border-[#e5e5e7] rounded-lg bg-[#fafafa] overflow-hidden">
                      <CockpitGoalsCompact
                        milestones={bundle.milestones}
                        progressMap={pastProgressMap}
                        planCycle={bundle.planCycle}
                        subItems={bundle.subItems}
                        responsibilities={bundle.responsibilities}
                        memberMap={memberMap || {}}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* [C] TODO Kanban */}
        {tasks.length > 0 && (
          <CockpitKanbanGas tasks={tasks} milestones={milestones} memberMap={memberMap || {}} />
        )}

        {/* [G][E] Bottom Row: Monthly Cards + MTG Summary */}
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <CockpitMonthlyList
              billingCycles={billingCycles}
              currentYm={currentYm}
              progressByYm={monthlyProgressByYm}
              onOpenModal={(ym) => setModalYm(ym)}
            />
          </div>
          <div className="flex-1 min-w-0">
            <CockpitMeetingSummary projectId={project.projectId} />
          </div>
        </div>
      </div>

      {/* ===== RIGHT COLUMN — 220px sticky ===== */}
      {/* 終了 PJ (status='ended'/'lost'/'frozen') では月次ルーティンは表示しない */}
      <div className="w-[220px] shrink-0 sticky top-12 max-h-[calc(100vh-60px)] overflow-y-auto pl-4 flex flex-col gap-3">
        {project.status === "active" || project.status === "sales" ? (
          <CockpitRoutineGas
            billingCycles={billingCycles}
            currentYm={currentYm}
            projectType={project.projectType}
            onOpenModal={(ym) => setModalYm(ym)}
          />
        ) : null}
        <CockpitNudge nudges={nudges} />
      </div>

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
          onProgressSaved={(patches) => setProgressPatches((prev) => mergeProgress(prev, patches))}
          onClose={() => setModalYm(null)}
        />
      )}
    </div>
  );
}
