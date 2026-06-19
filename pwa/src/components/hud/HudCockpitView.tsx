"use client";

import { useEffect, useState } from "react";
import { HudCockpitHeader } from "./HudCockpitHeader";
import { HudCockpitVentureStatus } from "./HudCockpitVentureStatus";
import { HudCockpitGoalsCompact } from "./HudCockpitGoalsCompact";
import { HudCockpitMonthlyList } from "./HudCockpitMonthlyList";
import { HudCockpitMonthlyModal } from "./HudCockpitMonthlyModal";
import { HudCockpitNudge } from "./HudCockpitNudge";
import { HudCockpitMeetingSummary } from "./HudCockpitMeetingSummary";
import { HudCockpitFreezeBackfill } from "./HudCockpitFreezeBackfill";
import { CockpitNextPeriodSetup } from "../cockpit/CockpitNextPeriodSetup";
import { AAA_PROJECT_ID } from "@/lib/demo-aaa-data";
import { fetchAmdScoreInputs, fetchActiveAlpha, type AmdScoreInputRow } from "@/lib/amd-score-data";
import { buildAaaScoreInputsFromSx, computeAmdScoreSeries } from "@/lib/amd-score-derived";
import type { AlphaWeights } from "@/lib/amd-score";

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

interface HudCockpitViewProps {
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
    nudges?: Array<{
      message: string; status: string; level: string; postedAt: string | null;
    }>;
    tasks?: Array<{
      taskId: string; title: string; status: string;
      assignee?: string; priority?: string; description?: string;
    }>;
  };
  nudges?: Array<{
    message: string; status: string; level: string; postedAt: string | null;
  }>;
  tasks?: Array<{
    taskId: string; title: string; status: string;
    assignee?: string; priority?: string; description?: string;
  }>;
  initialModalYm?: string | null;
  /** mypage や URL `?step=` から渡される、起動時に開くべきステップ */
  initialStep?: { ym: string; stepId: string } | null;
  /** PM (= project_members.is_pm) もしくは admin (= members.is_admin) のみ true。
      false の場合、月次確認のステップボタンは disabled。まさ要望 2026-05-11。 */
  canEditRoutine?: boolean;
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

type CockpitSignalSnapshot = {
  m: number;
  x: number;
  f: number;
  score: number;
  history: number[];
  risk: "LOW" | "MEDIUM" | "HIGH";
  state: string;
};

const COCKPIT_SIGNAL_SNAPSHOTS: Record<string, CockpitSignalSnapshot> = {
  [AAA_PROJECT_ID]: scaleCockpitSnapshot({ m: 12.44, x: 206, f: 14.7, score: 3765, history: [267, 925, 1583, 3765], risk: "MEDIUM", state: "ACTIVE" }, 1.05),
  p21: { m: 12.44, x: 206, f: 14.7, score: 3765, history: [267, 925, 1583, 3765], risk: "MEDIUM", state: "ACTIVE" },
  p06: { m: 16, x: 458, f: 19, score: 13239, history: [4200, 5140, 4880, 6900, 7320, 6810, 9100, 11620, 10480, 13239], risk: "HIGH", state: "ACTIVE" },
  p20: { m: 15, x: 278, f: 23, score: 11059, history: [3380, 4020, 4890, 5120, 6200, 7100, 7640, 8800, 9650, 11059], risk: "MEDIUM", state: "ACTIVE" },
};

function scaleCockpitSnapshot(source: CockpitSignalSnapshot, factor: number): CockpitSignalSnapshot {
  const scoreFactor = factor * factor * factor;
  return {
    ...source,
    m: source.m * factor,
    x: source.x * factor,
    f: source.f * factor,
    score: source.score * scoreFactor,
    history: source.history.map((score) => score * scoreFactor),
  };
}

const COCKPIT_INITIATIVE_SCORES: Record<string, number> = {
  [AAA_PROJECT_ID]: 96,
  p21: 56,
  p06: 67,
  p20: 68,
};

function isLiveOperationalProject(project: { status: string; freezeFromYm?: string | null; restartExpectedYm?: string | null }, currentYm: string) {
  const baseActive = project.status === "active" || project.status === "sales";
  const frozenNow = !!project.freezeFromYm && currentYm >= project.freezeFromYm;
  const waitingRestart = !!project.restartExpectedYm && currentYm < project.restartExpectedYm;
  return baseActive && !frozenNow && !waitingRestart;
}

function usesMsProgressCategory(category: string | null | undefined) {
  return ["dtsu", "ecosystem", "new_business"].includes(String(category || "dtsu").toLowerCase());
}

export function HudCockpitView({ cockpit, nudges, initialModalYm }: HudCockpitViewProps) {
  const cockpitNudges = nudges || cockpit.nudges || [];
  const [modalYm, setModalYm] = useState<string | null>(initialModalYm || null);
  const [modalInitialTab, setModalInitialTab] = useState<MonthlyModalTab | undefined>(undefined);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [editingCurrentCycle, setEditingCurrentCycle] = useState(false);
  const [progressPatches, setProgressPatches] = useState<ProgressShape[]>([]);

  function openMonthlyModal(ym: string, initialTab?: MonthlyModalTab) {
    setModalInitialTab(initialTab);
    setModalYm(ym);
  }

  function closeMonthlyModal() {
    setModalYm(null);
    setModalInitialTab(undefined);
  }

  const { project, currentYm, billingCycles, planCycle, milestones, progress, reports, subItems, responsibilities, memberMap, pastPlanCycles, msActivities, memberActivities } = cockpit;
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
  const modalPlanCycle = usesMsProgress ? (modalBundle?.planCycle || planCycle) : null;
  const modalMilestones = usesMsProgress ? (modalBundle?.milestones || milestones) : [];
  const modalProgress = usesMsProgress ? (modalBundle?.progress || progress) : [];
  const modalSubItems = usesMsProgress ? (modalBundle?.subItems || subItems || []) : [];
  const modalResponsibilities = usesMsProgress ? (modalBundle?.responsibilities || responsibilities || []) : [];
  const modalMsActivities = usesMsProgress ? (modalBundle?.msActivities || msActivities || []) : [];
  const modalMemberActivities = modalBundle?.memberActivities || memberActivities || [];
  const showLiveOperations = isLiveOperationalProject(project, currentYm);
  const showAmdScore = (project.projectCategory || "dtsu") !== "ecosystem";

  return (
    <section className="hud-cockpit-clone" aria-label="HUD cockpit clone">
      <div className="hud-cockpit-clone__rail">
        <span>PROJECT COCKPIT / FULL-CONTENT HUD FRAME</span>
        <strong>{project.projectId}</strong>
      </div>
      <div className="hud-cockpit-clone__body">
    <div className="mx-auto grid max-w-[1540px] grid-cols-1 gap-4 px-3 py-3 items-start xl:grid-cols-[minmax(0,1fr)_286px]">
      {/* ===== LEFT COLUMN ===== */}
      <div className="min-w-0 flex flex-col gap-3">
        {/* [A] Project Header */}
        <HudCockpitHeader
          project={project}
	          currentYm={currentYm}
	          memberCount={cockpit.members.length}
	          initiativeScore={showLiveOperations && showAmdScore ? (COCKPIT_INITIATIVE_SCORES[project.projectId] ?? 64) : null}
	        />

        {/* [A2] PJ Status: ecosystem PJ は AMD Score 対象外 */}
        {showAmdScore && (
          <>
            <HudCockpitSignalStrip projectId={project.projectId} status={project.status} />
            <div className="hud-cockpit-panel hud-cockpit-panel--status">
              <HudCockpitVentureStatus projectId={project.projectId} />
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
          <div className="min-w-0 space-y-3">
            {/* [B] Milestones — 現在の期間（トップ表示） */}
            {usesMsProgress && planCycle && milestones.length > 0 && (
              <div className="hud-cockpit-panel hud-cockpit-panel--matrix">
                <HudCockpitGoalsCompact
                  milestones={milestones}
                  planCycle={planCycle}
                  projectId={project.projectId}
                  subItems={subItems || []}
                  responsibilities={responsibilities || []}
                  memberMap={memberMap || {}}
                  progress={currentProgress}
                  currentYm={currentYm}
                  onEdit={planCycle ? () => setEditingCurrentCycle(true) : undefined}
                />
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            {/* [B2] MS設定バナー／直接編集
            - draft or 外部トリガー: directCycleIdで直接編集
            - active確定済: 次の期間設定バナー（終了3か月前から）
        */}
            {showLiveOperations && usesMsProgress ? (() => {
          // 期間外で planCycle が null の場合は、最も最新の過去 plan_cycle を fallback に使う。
          // これで「3月で期間終了 → 4月以降は期未設定」状態でもバナーが表示される (#4)。
          const effectivePlanCycle = planCycle
            ?? [...(pastPlanCycles ?? [])]
                 .map((b) => b.planCycle)
                 .sort((a, b) => b.periodEndYm.localeCompare(a.periodEndYm))[0]
            ?? null;
          if (!effectivePlanCycle) {
            return (
              <div className="border border-amber-300/45 bg-amber-300/10 px-4 py-3 text-[13px] font-bold text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
                WARNING: この PJ には MS 期間 (plan_cycle) が一度も設定されていません。
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
                <div className="border border-amber-300/45 bg-amber-300/10 px-4 py-3 text-[13px] font-bold text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
                  WARNING: 今期の MS 期間 ({formatYm(effectivePlanCycle.periodEndYm)}) は終了しています。
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
            })() : null}

            {/* [B3] 過去の期間（折りたたみ） */}
            {usesMsProgress && pastPlanCycles && pastPlanCycles.length > 0 && (
              <section className="border border-cyan-300/24 bg-slate-950/72 shadow-[inset_0_0_26px_rgba(34,211,238,0.08)]">
            <button
              onClick={() => setPastExpanded(!pastExpanded)}
              className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-left hover:bg-cyan-300/8 transition-colors"
            >
              <span className={`text-[10px] text-cyan-100/54 shrink-0 transition-transform ${pastExpanded ? "rotate-90" : ""}`}>▶</span>
              <span className="text-cyan-100/72 font-black tracking-[0.08em]">PAST MS PERIODS</span>
              <span className="text-[11px] text-cyan-100/45">
                ({pastPlanCycles.length}件)
              </span>
            </button>
            {pastExpanded && (
              <div className="px-4 pb-3 flex flex-col gap-3">
                {patchedPastPlanCycles.map((bundle) => (
                    <div key={bundle.planCycle.planCycleId} className="border border-cyan-300/18 bg-slate-950/70 overflow-hidden">
                      <HudCockpitGoalsCompact
                        milestones={bundle.milestones}
                        planCycle={bundle.planCycle}
                        projectId={project.projectId}
                        subItems={bundle.subItems}
                        responsibilities={bundle.responsibilities}
                        memberMap={memberMap || {}}
                        progress={bundle.progress}
                        currentYm={bundle.planCycle.periodEndYm}
                      />
                    </div>
                ))}
              </div>
            )}
              </section>
            )}
          </div>
        </div>

        {/* [G][E] Bottom Row: Monthly Cards + MTG Summary */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.16fr)_minmax(360px,0.84fr)]">
          <div className="min-w-0 hud-cockpit-panel hud-cockpit-panel--monthly">
            <HudCockpitMonthlyList
              billingCycles={billingCycles}
              currentYm={currentYm}
              progressByYm={monthlyProgressByYm}
              onOpenModal={(ym) => openMonthlyModal(ym)}
            />
          </div>
          <div className="min-w-0 hud-cockpit-panel hud-cockpit-panel--meeting">
            {/* 休止期間 backfill: 再開予定月 >= currentYm の場合のみ表示 */}
            <HudCockpitFreezeBackfill
              projectId={project.projectId}
              freezeFromYm={project.freezeFromYm ?? null}
              restartExpectedYm={project.restartExpectedYm ?? null}
              currentYm={currentYm}
            />
            <HudCockpitMeetingSummary projectId={project.projectId} />
          </div>
        </div>
        <HudMonthlyModalPreview
          ym={currentYm}
          billing={billingCycles.find((bc) => bc.ym === currentYm) || billingCycles[0] || null}
          report={reports.find((r) => r.ym === currentYm) || reports[0] || null}
          progressItems={monthlyProgressByYm[currentYm] || []}
          onOpenModal={(ym) => openMonthlyModal(ym)}
        />
      </div>

      {/* ===== RIGHT COLUMN — 220px sticky ===== */}
      <div className="min-w-0 overflow-y-auto pl-1 flex flex-col gap-3 xl:sticky xl:top-12 xl:max-h-[calc(100vh-60px)]">
        {(() => {
          // ステータス予定のバッジ
          const badges: Array<{ key: string; cls: string; text: string }> = [];
          if (project.freezeFromYm) {
            if (currentYm >= project.freezeFromYm) {
              badges.push({ key: "frozen-now", cls: "bg-slate-400/12 text-slate-100 border-slate-300/30", text: `${formatYm(project.freezeFromYm)} 〜 凍結中` });
            } else {
              badges.push({ key: "frozen-future", cls: "bg-amber-300/10 text-amber-100 border-amber-300/35", text: `${formatYm(project.freezeFromYm)} から凍結予定` });
            }
          }
          if (project.restartExpectedYm) {
            if (currentYm < project.restartExpectedYm) {
              badges.push({ key: "restart", cls: "bg-cyan-300/10 text-cyan-100 border-cyan-300/35", text: `${formatYm(project.restartExpectedYm)} から再開予定` });
            }
          }

          return (
            <>
              {badges.length > 0 && (
                <div className="flex flex-col gap-1">
                  {badges.map((b) => (
                    <span key={b.key} className={`text-[11px] px-2 py-1 rounded-md border ${b.cls}`}>
                      {b.text}
                    </span>
                  ))}
                </div>
              )}
            </>
          );
        })()}
        <div className="hud-cockpit-panel hud-cockpit-panel--nudge">
          <HudCockpitNudge nudges={cockpitNudges} />
        </div>
      </div>

      {/* ===== Monthly Modal ===== */}
      {modalYm && (
        <HudCockpitMonthlyModal
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
      <style jsx>{`
        .hud-cockpit-clone {
          position: relative;
          isolation: isolate;
          margin: 0 auto;
          max-width: 1600px;
          padding: 10px;
        }
        .hud-cockpit-clone::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          border: 1px solid rgba(103, 232, 249, 0.38);
          background:
            linear-gradient(90deg, rgba(103, 232, 249, 0.22), transparent 16%, transparent 84%, rgba(244, 114, 182, 0.16)),
            radial-gradient(circle at 18% 0%, rgba(34, 211, 238, 0.18), transparent 30%),
            radial-gradient(circle at 90% 18%, rgba(244, 114, 182, 0.12), transparent 26%);
          box-shadow:
            0 0 34px rgba(34, 211, 238, 0.16),
            inset 0 0 34px rgba(34, 211, 238, 0.08);
          clip-path: polygon(0 18px, 18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px));
        }
        .hud-cockpit-clone__rail {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid rgba(103, 232, 249, 0.24);
          border-bottom: 0;
          background: linear-gradient(90deg, rgba(8, 47, 73, 0.9), rgba(2, 8, 19, 0.72));
          padding: 8px 12px;
          color: rgba(207, 250, 254, 0.78);
          font: 900 10px/1 var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.16em;
        }
        .hud-cockpit-clone__rail strong {
          color: #fff;
          text-shadow: 0 0 12px rgba(103, 232, 249, 0.7);
        }
        .hud-cockpit-clone__body {
          overflow-x: auto;
          border: 1px solid rgba(103, 232, 249, 0.24);
          background:
            radial-gradient(circle at 18% 0%, rgba(34, 211, 238, 0.18), transparent 32%),
            radial-gradient(circle at 86% 18%, rgba(244, 114, 182, 0.10), transparent 26%),
            linear-gradient(180deg, rgba(103, 232, 249, 0.06) 0, transparent 1px, transparent 13px),
            linear-gradient(90deg, rgba(103, 232, 249, 0.045) 0, transparent 1px, transparent 97px),
            #020817;
          background-size: 100% 100%, 100% 100%, 100% 14px, 98px 100%, auto;
          padding: 8px 0 10px;
          box-shadow: inset 0 0 48px rgba(34, 211, 238, 0.10);
          color: rgba(236, 254, 255, 0.92);
          font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .hud-cockpit-clone__body :global(> div) {
          min-width: 1240px;
        }
        .hud-cockpit-panel {
          position: relative;
          min-width: 0;
        }
        .hud-cockpit-panel::before,
        .hud-cockpit-panel::after {
          content: "";
          position: absolute;
          pointer-events: none;
          z-index: 8;
        }
        .hud-cockpit-panel::before {
          inset: -1px;
          border: 1px solid rgba(103, 232, 249, 0.18);
          clip-path: polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: inset 0 0 20px rgba(34, 211, 238, 0.05);
        }
        .hud-cockpit-panel::after {
          right: 18px;
          top: 7px;
          width: 78px;
          height: 5px;
          transform: skewX(-30deg);
          background: repeating-linear-gradient(90deg, rgba(34,211,238,.82) 0 8px, transparent 8px 14px);
          opacity: .56;
        }
      `}</style>
    </section>
  );
}

function HudCockpitSignalStrip({ projectId, status }: { projectId: string; status: string }) {
  const fallbackSnapshot = COCKPIT_SIGNAL_SNAPSHOTS[projectId] ?? null;
  const [snapshot, setSnapshot] = useState<CockpitSignalSnapshot | null>(fallbackSnapshot);

  useEffect(() => {
    let cancelled = false;
    const sourceProjectId = projectId === AAA_PROJECT_ID ? "p21" : projectId;
    Promise.all([fetchAmdScoreInputs(sourceProjectId), fetchActiveAlpha()])
      .then(([inputs, alphaRes]) => {
        if (cancelled) return;
        const sourceInputs = projectId === AAA_PROJECT_ID ? buildAaaScoreInputsFromSx(inputs, alphaRes.alpha) : inputs;
        setSnapshot(buildCockpitSignalSnapshot(sourceInputs, alphaRes.alpha, status) ?? fallbackSnapshot);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(fallbackSnapshot);
      });
    return () => {
      cancelled = true;
    };
  }, [fallbackSnapshot, projectId, status]);

  if (!snapshot) {
    return (
      <section className="overflow-x-auto overflow-y-hidden">
          <div className="relative aspect-[1773/330] min-w-[980px] overflow-hidden xl:min-w-0">
          <img src="/hud/hud_cockpit_signal_strip_truecircle_20260518.png" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-95" />
          <CockpitSignalContent snapshot={null} />
        </div>
      </section>
    );
  }
  return (
    <section className="overflow-x-auto overflow-y-hidden">
      <div className="relative aspect-[1773/330] min-w-[980px] overflow-hidden xl:min-w-0">
        <img src="/hud/hud_cockpit_signal_strip_truecircle_20260518.png" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-95" />
        <CockpitSignalContent snapshot={snapshot} />
      </div>
    </section>
  );
}

function buildCockpitSignalSnapshot(
  inputs: AmdScoreInputRow[],
  alpha: AlphaWeights,
  status: string
): CockpitSignalSnapshot | null {
  const today = new Date().toISOString().slice(0, 10);
  const series = computeAmdScoreSeries(
    inputs.filter((row) => row.evaluated_at.slice(0, 10) <= today),
    alpha
  );
  const latest = series[series.length - 1] ?? null;
  if (!latest) return null;
  return {
    m: roundSignalMetric(latest.breakdown.M),
    x: roundSignalMetric(latest.breakdown.X),
    f: roundSignalMetric(latest.breakdown.F),
    score: latest.score,
    history: series.map((point) => point.score),
    risk: inferSignalRisk(series.map((point) => point.score)),
    state: status.toUpperCase(),
  };
}

function inferSignalRisk(history: number[]): CockpitSignalSnapshot["risk"] {
  if (history.length < 2) return "MEDIUM";
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (last < prev * 0.9) return "HIGH";
  if (last > prev * 1.05) return "LOW";
  return "MEDIUM";
}

function roundSignalMetric(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function CockpitSignalContent({
  snapshot,
}: {
  snapshot: { m: number; x: number; f: number; score: number; history: number[]; risk: "LOW" | "MEDIUM" | "HIGH"; state: string } | null;
}) {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-[3.3%] top-[25px] h-[132px] w-[11.4%]">
        <SignalMetricCard axis="M" label="MACROTREND" value={snapshot?.m ?? null} max={30} />
      </div>
      <div className="absolute left-[15.3%] top-[25px] h-[132px] w-[10.0%]">
        <SignalMetricCard axis="X" label="XRL" value={snapshot?.x ?? null} max={600} />
      </div>
      <div className="absolute left-[25.8%] top-[25px] h-[132px] w-[10.0%]">
        <SignalMetricCard axis="F" label="FRL" value={snapshot?.f ?? null} max={100} danger />
      </div>
      <div className="absolute left-[37.0%] top-[25px] h-[132px] w-[27.3%]">
        <TrendPanel history={snapshot?.history ?? []} />
      </div>
      <div className="absolute left-[calc(73.57%_-_59px)] top-[calc(46.54%_-_59px)] h-[118px] w-[118px]">
        <ScoreDial score={snapshot?.score ?? null} />
      </div>
      <div className="absolute left-[83.1%] top-[28px] h-[128px] w-[14.6%]">
        <RiskPanel risk={snapshot?.risk ?? "MEDIUM"} state={snapshot?.state ?? "NO DATA"} />
      </div>
    </div>
  );
}

function SignalMetricCard({
  axis,
  label,
  value,
  max,
  danger = false,
}: {
  axis: "M" | "X" | "F";
  label: string;
  value: number | null;
  max: number;
  danger?: boolean;
}) {
  const color = danger ? "rgba(255,95,125,.96)" : "rgba(50,231,255,.96)";
  const pct = value == null ? 0 : Math.max(4, Math.min(100, (value / max) * 100));
  const display = value == null ? "--" : value < 100 ? value.toFixed(2) : Math.round(value).toLocaleString();
  return (
    <div className="relative h-full overflow-hidden px-3 py-1.5 text-cyan-50">
      <div className="relative flex min-w-0 items-baseline gap-1">
        <span className="font-mono text-[19px] font-black leading-none" style={{ color, textShadow: `0 0 13px ${color}` }}>{axis}</span>
        <span className="min-w-0 truncate whitespace-nowrap text-[6px] font-black uppercase tracking-[0.06em] text-cyan-100/62">{label}</span>
      </div>
      <div className="relative mt-2 truncate font-mono text-[25px] font-black leading-none tracking-[0.01em] text-white [text-shadow:0_0_16px_rgba(103,232,249,.62)]">
        {display}
      </div>
      <div className="relative mt-2 flex items-center gap-1.5 text-[7px] font-black uppercase tracking-[0.08em]" style={{ color }}>
        <span>RAW</span>
        <span className="h-px min-w-0 flex-1 opacity-40" style={{ background: color }} />
      </div>
      <div className="relative mt-1.5 h-1.5 border border-cyan-300/24 bg-slate-950">
        <div className="h-full" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 14px ${color}` }} />
      </div>
    </div>
  );
}

function TrendPanel({ history }: { history: number[] }) {
  const points = history.length ? history : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const width = 260;
  const height = 70;
  const path = points.map((v, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
    const y = height - ((v - min) / Math.max(1, max - min)) * (height - 10) - 5;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <div className="relative h-full overflow-hidden px-5 py-3">
      <div className="text-center text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/72">AMD Score Trend</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-[76px] w-full">
        <defs>
          <linearGradient id="hud-cockpit-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#32e7ff" stopOpacity=".28" />
            <stop offset="100%" stopColor="#32e7ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => <line key={i} x1="0" x2={width} y1={12 + i * 22} y2={12 + i * 22} stroke="rgba(103,232,249,.16)" strokeWidth=".8" />)}
        <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#hud-cockpit-trend-fill)" />
        <path d={path} fill="none" stroke="#32e7ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ScoreDial({ score }: { score: number | null }) {
  const pct = score == null ? 0 : Math.max(6, Math.min(96, score / 320));
  return (
    <div className="relative grid h-full place-items-center overflow-visible px-0 py-0">
      <div className="absolute left-1/2 top-[-15px] z-10 w-[160px] -translate-x-1/2 text-center text-[9px] font-black uppercase tracking-[0.13em] text-cyan-100/72">AMD Score State</div>
      <svg viewBox="0 0 118 118" className="relative h-[118px] w-[118px] drop-shadow-[0_0_18px_rgba(50,231,255,.30)]" aria-hidden="true">
        <circle cx="59" cy="59" r="51" fill="rgba(2,8,18,.36)" stroke="rgba(50,231,255,.18)" strokeWidth="1.5" />
        <circle cx="59" cy="59" r="42" fill="none" stroke="rgba(50,231,255,.13)" strokeWidth="11" />
        <circle
          cx="59"
          cy="59"
          r="39"
          fill="none"
          stroke="#32e7ff"
          strokeWidth="12"
          strokeDasharray={`${(pct / 100) * 245} 245`}
          strokeLinecap="butt"
          transform="rotate(-90 59 59)"
        />
        <circle cx="59" cy="59" r="29" fill="rgba(2,8,18,.98)" stroke="rgba(124,248,255,.28)" strokeWidth="1.1" />
        <text x="59" y="65" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="900">
          {score == null ? "--" : Math.round(score).toLocaleString()}
        </text>
      </svg>
    </div>
  );
}

function RiskPanel({ risk, state }: { risk: "LOW" | "MEDIUM" | "HIGH"; state: string }) {
  const tone = risk === "HIGH" ? "text-rose-200" : risk === "LOW" ? "text-emerald-200" : "text-amber-200";
  return (
    <div className={`relative flex h-full flex-col items-center justify-center overflow-hidden px-3 py-2 text-center ${tone}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-75">Risk / Status</div>
      <div className="mt-2 font-mono text-[20px] font-black leading-none">{risk}</div>
      <div className="mt-2 text-[10px] font-black uppercase tracking-[0.12em]">{state}</div>
    </div>
  );
}

function HudMonthlyModalPreview({
  ym,
  billing,
  report,
  progressItems,
  onOpenModal,
}: {
  ym: string;
  billing: HudCockpitViewProps["cockpit"]["billingCycles"][number] | null;
  report: HudCockpitViewProps["cockpit"]["reports"][number] | null;
  progressItems: Array<{ title: string; tag: string; points: number; progressPct: number }>;
  onOpenModal: (ym: string) => void;
}) {
  const avg = progressItems.length
    ? Math.round(progressItems.reduce((sum, item) => sum + item.progressPct, 0) / progressItems.length)
    : 0;
  const amount = billing?.budgetReportedAmount || billing?.budgetYen || 0;
  return (
    <section className="relative overflow-hidden border border-cyan-300/36 bg-slate-950/88 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.12),inset_0_0_28px_rgba(34,211,238,0.06)] [clip-path:polygon(0_14px,14px_0,calc(100%-14px)_0,100%_14px,100%_100%,0_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,0.055)_1px,transparent_1px),linear-gradient(rgba(34,211,238,0.07)_1px,transparent_1px)] bg-[size:46px_100%,100%_8px]" />
      <div className="relative flex items-center justify-between border-b border-cyan-300/22 px-4 py-2">
        <h3 className="text-[12px] font-black uppercase tracking-[0.16em] text-cyan-100">Monthly Modal</h3>
        <div className="flex items-center gap-3 font-mono text-[10px] text-cyan-100/58">
          <span>{formatYm(ym)}</span>
          <button
            type="button"
            onClick={() => onOpenModal(ym)}
            className="border border-cyan-300/28 bg-cyan-300/8 px-2 py-0.5 font-black text-cyan-100 hover:bg-cyan-300/14"
          >
            OPEN
          </button>
        </div>
      </div>
      <div className="relative grid grid-cols-[0.92fr_1.05fr_1.03fr] gap-3 p-3">
        <div className="border border-cyan-300/22 bg-slate-950/72 p-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">Progress Check</div>
          <div className="grid grid-cols-[86px_1fr] gap-3">
            <div className="border border-cyan-300/18 bg-cyan-300/8 p-2 font-mono text-[10px] text-cyan-100/64">
              <div>PLAN INFO</div>
              <div className="mt-2 text-cyan-50">{formatYm(ym)}</div>
              <div className="mt-2">5 METRICS</div>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[32px] font-black leading-none text-cyan-100 [text-shadow:0_0_14px_rgba(103,232,249,.72)]">{avg}%</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-200">前月比 +7pt</div>
              <div className="mt-3 space-y-1.5">
                {progressItems.slice(0, 5).map((item, index) => (
                  <div key={`${item.title}-${index}`} className="grid grid-cols-[minmax(0,1fr)_70px_34px] items-center gap-2">
                    <span className="truncate text-[10px] text-cyan-50/76">{item.title}</span>
                    <span className="h-1.5 border border-cyan-300/18 bg-slate-950">
                      <span className="block h-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,.72)]" style={{ width: `${Math.min(100, item.progressPct)}%` }} />
                    </span>
                    <span className="text-right font-mono text-[10px] text-cyan-100/70">{item.progressPct}%</span>
                  </div>
                ))}
                {progressItems.length === 0 && <div className="text-[11px] text-cyan-100/45">MS progress not linked</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="border border-cyan-300/22 bg-slate-950/72 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">Report</span>
            <span className="border border-cyan-300/18 bg-cyan-300/8 px-2 py-0.5 font-mono text-[9px] text-cyan-100/62">{report?.status || "draft"}</span>
          </div>
          <div className="min-h-[118px] border border-cyan-300/16 bg-slate-950/82 p-2 font-mono text-[10px] leading-relaxed text-cyan-50/70">
            {(report?.finalExcerpt || report?.draftExcerpt || "月次報告本文をここに表示。AI estimate / revision instruction / body previewを同一面に載せる。").slice(0, 220)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-[0.1em]">
            <span className="border border-cyan-300/18 bg-cyan-300/8 px-2 py-1 text-cyan-100/62">Plain 表示</span>
            <span className="border border-cyan-300/18 bg-cyan-300/8 px-2 py-1 text-cyan-100/62">Fix / Rev</span>
          </div>
        </div>
        <div className="border border-rose-300/28 bg-rose-950/18 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-100/76">Invoice</span>
            <span className="border border-rose-300/24 bg-rose-300/8 px-2 py-0.5 font-mono text-[9px] text-rose-100/70">{billing?.invoiceSentAt ? "SENT" : billing?.invoiceIssuedAt ? "ISSUED" : "PENDING"}</span>
          </div>
          <div className="grid gap-2 font-mono text-[10px] text-cyan-50/72">
            <div className="border border-cyan-300/16 bg-slate-950/72 p-2">
              <div className="text-cyan-100/45">CLIENT / CONTRACT</div>
              <div className="mt-1 text-cyan-50">{billing?.projectId?.toUpperCase() || "--"} / {formatYm(ym)}</div>
            </div>
            <div className="border border-cyan-300/16 bg-slate-950/72 p-2">
              <div className="text-cyan-100/45">INVOICE AMOUNT</div>
              <div className="mt-1 text-[18px] font-black text-cyan-100">¥{amount.toLocaleString()}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="border border-cyan-300/16 bg-slate-950/72 p-2">PAYMENT {billing?.paymentConfirmedAt ? "OK" : "OPEN"}</span>
              <span className="border border-cyan-300/16 bg-slate-950/72 p-2">FREEE {billing?.invoiceIssuedAt ? "OK" : "WAIT"}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
