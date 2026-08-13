"use client";

import { Flag } from "lucide-react";
import type { SxJudgment, SxManagementBundle, SxTimelineKind, SxTrackKey } from "@/lib/sx-management";
import {
  applySxInterventionPillarQuota,
  deriveSxInterventionQueue,
  deriveSxUnifiedTimeline,
  deriveSxVerdictSummary,
  sxEcdFormatDueDate,
  type SxEcdInterventionRow,
  type SxEcdVerdictSummary,
} from "@/lib/sx-executive-control-deck";
import { sxFormatDate } from "./sx-visual-shared";
import { SxUnifiedTimeline } from "./SxUnifiedTimeline";

const INTERVENTION_KIND_LABEL: Record<SxEcdInterventionRow["kind"], string> = {
  critical_blocked: "停止",
  critical_overdue: "期限超過",
  technical_test_blocked: "技術試験停止/失敗",
  technical_test_unassessed: "技術試験評価不能",
  validation_run: "検証停止/遅延",
  action_item: "対応停止/遅延",
  partner_work_item: "相手先保留",
  partner_fallback: "関係先対応待ち",
  issue_stalled: "論点滞留",
  owner_unconfirmed: "担当未確認",
  gate_stale: "情報更新切れ",
  gate_unassessed: "ゲート評価未完",
};

/**
 * Focuses/scrolls to the target row identified by `anchor` (e.g. "#sx-issue-123"). Desktop and
 * mobile responsive variants of the same logical row both carry `data-sx-anchor`, so this looks up
 * every match and picks the one that is actually rendered (getClientRects().length > 0 — the
 * hidden responsive twin has none) rather than relying on a duplicate `id` existing on both. Falls
 * back to a unique `getElementById` only if no data-sx-anchor match is visible. Respects
 * prefers-reduced-motion by using an instant scroll instead of smooth.
 */
function focusAnchorRow(anchor: string) {
  const id = anchor.startsWith("#") ? anchor.slice(1) : anchor;
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", `#${id}`);

  const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-sx-anchor="${id}"]`));
  const visible = candidates.find((candidate) => candidate.getClientRects().length > 0) ?? null;
  const el = visible ?? document.getElementById(id);
  if (!el) return;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  el.classList.add("sx-anchor-highlight");
  window.setTimeout(() => {
    (el as HTMLElement).focus({ preventScroll: true });
  }, reducedMotion ? 0 : 400);
  window.setTimeout(() => el.classList.remove("sx-anchor-highlight"), 1800);
}

// Only an anchor targeting the management-plan section is allowed to call onSelectMilestone — the
// technical-test/capacity link (anchor="management-capacity") and issue/partner row anchors must
// never call it, since that would fight the Dashboard's own selected-context effect. Everything
// else just focuses/scrolls to its section or row.
function callsOnSelectMilestone(row: { anchor: string }): boolean {
  return row.anchor === "management-plan";
}

function anchorHref(anchor: string): string {
  return anchor.startsWith("#") ? anchor : `#${anchor}`;
}

function blockerDueDisplay(row: { dueDate: string | null; dueDatePrecision?: SxEcdInterventionRow["dueDatePrecision"] }): string {
  if (row.dueDatePrecision) return sxEcdFormatDueDate(row.dueDate, row.dueDatePrecision);
  return sxFormatDate(row.dueDate, "未確認");
}

/** ボール表示: 「未確認・未確認」の重複や「担当 担当未確認」の二重接頭辞を作らない。側と実名の
 * どちらか確認できている方だけを出し、両方未確認なら「未確認」1語に畳む。 */
function ballDisplay(side: string, owner: string): string {
  if (side === "担当") return owner;
  if (owner === "未確認") return side === "未確認" ? "未確認" : `${side}・担当未確認`;
  return `${side}・${owner}`;
}

function RankBadge({ rank, side = "sx", className = "" }: { rank: number; side?: "sx" | "partner"; className?: string }) {
  return (
    <span
      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none text-white ${side === "partner" ? "bg-[#bf7b2c]" : "bg-[#24231f]"} ${className}`}
      aria-label={`次の経営介入 ${rank}番`}
    >
      {rank}
    </span>
  );
}

function rowPinSide(row: SxEcdInterventionRow): "sx" | "partner" {
  return row.ballSide === "相手側" || row.ballSide === "双方" ? "partner" : "sx";
}

const BUSINESS_TONE: Record<SxEcdVerdictSummary["business"]["tone"], string> = {
  ok: "border-[#74a690] bg-[#dcecdf] text-[#205f49]",
  warn: "border-[#bd9a52] bg-[#f7e8c8] text-[#765022]",
  bad: "border-[#b5533f] bg-[#f6dad5] text-[#8c3329]",
  unknown: "border-[#8e88a5] bg-[#e4e2ef] text-[#55506d]",
};

/** 帯1: 判定バー。業務判定（重要経路の停止・期限超過・遅延見込み）と運用判定（データ充足）を
 * 分け、STEP2消化・設立までの残日数を同じ1行で読む。赤系は事業リスクにだけ使う。 */
function VerdictBar({ summary }: { summary: SxEcdVerdictSummary }) {
  return (
    <div className="grid grid-cols-2 border-b border-[#c5bba5] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]" data-testid="sx-verdict-bar">
      <div className={`flex min-w-0 flex-col justify-center gap-0.5 border-b border-r border-[#c5bba5] px-3 py-1.5 lg:border-b-0 ${BUSINESS_TONE[summary.business.tone]}`}>
        <p className="text-[9px] font-semibold tracking-[0.12em]">業務判定（重要経路）</p>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
          <span className="text-[17px] font-bold leading-none">{summary.business.label}</span>
          {summary.business.provisional && <span className="text-[10px] font-semibold">（仮日程）</span>}
          {summary.business.detail && <span className="text-[11px] font-semibold">{summary.business.detail}</span>}
        </p>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-0.5 border-b border-[#c5bba5] px-3 py-1.5 lg:border-b-0 lg:border-r">
        <p className="text-[9px] font-semibold tracking-[0.12em] text-[#5f5a4d]">運用判定（データ充足）</p>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[10px] text-[#514e47]">
          <span className="text-[13px] font-bold leading-none text-[#55506d]">{summary.operations.verdictLabel}</span>
          <span>充足 <span className="font-semibold text-[#24231f]">{summary.operations.completenessPct}%</span></span>
          <span>重大未確認 <span className="font-semibold text-[#24231f]">{summary.operations.criticalUnknownCount}件</span></span>
        </p>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-0.5 border-r border-[#c5bba5] px-3 py-1.5">
        <p className="text-[9px] font-semibold tracking-[0.12em] text-[#5f5a4d]">STEP2消化</p>
        <button
          type="button"
          onClick={() => {
            const ledger = document.getElementById("management-ledger");
            if (ledger instanceof HTMLDetailsElement) ledger.open = true;
            focusAnchorRow("management-ledger");
          }}
          className={`min-h-6 w-fit text-left text-[13px] font-bold leading-none underline decoration-[#cfc7b9] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${summary.step2.known ? "text-[#24231f]" : "text-[#55506d]"}`}
          title="STEP2資金の消化が予定どおりかの確認。金額データが未確認の間は数値を出さない。内訳と登録は管理台帳の測定・資金欄"
          aria-label={`STEP2消化 ${summary.step2.label}。管理台帳の資金欄へ移動`}
        >
          {summary.step2.label}
        </button>
        {!summary.step2.known && <p className="text-[9px] text-[#65604f]">内訳: 管理台帳の資金欄（金額未登録）</p>}
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-1.5">
        <p className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.12em] text-[#5f4a66]"><Flag className="h-3 w-3" aria-hidden="true" />設立まで</p>
        <p className="text-[13px] font-bold leading-none text-[#24231f]">
          {summary.countdown.days != null ? `残${summary.countdown.days}日` : "期日未登録"}
          {summary.countdown.targetDate && <span className="ml-1.5 text-[10px] font-semibold text-[#5a574c]">{sxFormatDate(summary.countdown.targetDate)}</span>}
        </p>
      </div>
    </div>
  );
}

function InterventionRowDesktop({ row, rank, onSelectMilestone }: { row: SxEcdInterventionRow; rank: number; onSelectMilestone: (id: string | null) => void }) {
  return (
    <li className="border-b border-[#dcd5c3] last:border-b-0">
      <a
        href={anchorHref(row.anchor)}
        onClick={(event) => {
          event.preventDefault();
          if (callsOnSelectMilestone(row)) {
            onSelectMilestone(row.milestoneId);
            window.requestAnimationFrame(() => focusAnchorRow(row.anchor));
          } else {
            focusAnchorRow(row.anchor);
          }
        }}
        className="grid min-h-11 grid-cols-[24px_minmax(0,1.6fr)_minmax(0,1fr)_100px_minmax(0,1fr)] items-center gap-x-2 py-1 text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
        aria-label={`${INTERVENTION_KIND_LABEL[row.kind]}: ${row.target}へ移動`}
      >
        <RankBadge rank={rank} side={rowPinSide(row)} />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-[#24231f] underline decoration-[#cfc7b9] underline-offset-2" title={row.target}>
            {row.target}
            {row.dateCertainty === "provisional" && <span className="ml-1 text-[10px] font-semibold text-[#765022]">仮</span>}
          </span>
          <span className="block truncate text-[10px] text-[#8c3329]">{INTERVENTION_KIND_LABEL[row.kind]}</span>
        </span>
        <span className={`min-w-0 truncate ${row.ballSide === "SX側" ? "font-bold text-[#8c3329]" : "text-[#514e47]"}`} title={ballDisplay(row.ballSide, row.ballOwner)}>
          {row.ballSide === "SX側" ? `当方ボール・${row.ballOwner}` : ballDisplay(row.ballSide, row.ballOwner)}
        </span>
        <span className="whitespace-nowrap text-[#5a574c]">
          {blockerDueDisplay(row)}
          {row.dueContextLabel && <span className="block text-[10px] text-[#65604f]">{row.dueContextLabel}</span>}
        </span>
        <span className="min-w-0 truncate text-[#5a574c]" title={row.gate}>{row.gate || "未確認"}</span>
      </a>
    </li>
  );
}

function InterventionRowMobile({ row, rank, onSelectMilestone }: { row: SxEcdInterventionRow; rank: number; onSelectMilestone: (id: string | null) => void }) {
  return (
    <li className="border-b border-[#dcd5c3] last:border-b-0">
      <a
        href={anchorHref(row.anchor)}
        onClick={(event) => {
          event.preventDefault();
          if (callsOnSelectMilestone(row)) {
            onSelectMilestone(row.milestoneId);
            window.requestAnimationFrame(() => focusAnchorRow(row.anchor));
          } else {
            focusAnchorRow(row.anchor);
          }
        }}
        className="flex min-h-11 flex-col justify-center gap-0.5 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
        aria-label={`${INTERVENTION_KIND_LABEL[row.kind]}: ${row.target}へ移動`}
      >
        <span className="flex items-center gap-1.5">
          <RankBadge rank={rank} side={rowPinSide(row)} />
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#24231f]" title={row.target}>
            {row.target}
            {row.dateCertainty === "provisional" && <span className="ml-1 text-[10px] font-semibold text-[#765022]">仮</span>}
          </span>
          <span className="shrink-0 text-[10px] text-[#5a574c]">{blockerDueDisplay(row)}</span>
        </span>
        <span className="flex items-center justify-between gap-2 pl-[26px] text-[10px] text-[#5f5a4d]">
          <span className="truncate text-[#8c3329]">{INTERVENTION_KIND_LABEL[row.kind]}</span>
          <span className={`truncate ${row.ballSide === "SX側" ? "font-bold text-[#8c3329]" : ""}`}>ボール {row.ballSide === "SX側" ? `当方・${row.ballOwner}` : ballDisplay(row.ballSide, row.ballOwner)}</span>
        </span>
      </a>
    </li>
  );
}

export function SxExecutiveControlDeck({
  management,
  judgment,
  selectedMilestoneId,
  onSelectMilestone,
  onEditMilestone,
  onCreateMilestone,
}: {
  management: SxManagementBundle;
  judgment: SxJudgment;
  selectedMilestoneId: string | null;
  onSelectMilestone: (milestoneId: string | null) => void;
  onEditMilestone: (milestoneId: string) => void;
  onCreateMilestone: (prefill: {
    track: SxTrackKey | null;
    timelineKind?: SxTimelineKind;
    plannedDate?: string | null;
    outcomeId?: string | null;
  }) => void;
}) {
  const objective = management.objective;
  const criticalSlugSet = new Set(judgment.criticalPathSlugs);

  const latestFunding = [...management.fundingSnapshots].sort((a, b) => (b.snapshotDate || "").localeCompare(a.snapshotDate || ""))[0] ?? null;

  const verdict = deriveSxVerdictSummary({
    today: management.asOf,
    judgment: { key: judgment.key, dagValid: judgment.dagValid, completenessPct: judgment.completenessPct, criticalUnknownCount: judgment.criticalUnknownCount, blockedCount: judgment.blockedCount },
    criticalPathSlugs: judgment.criticalPathSlugs,
    milestones: management.milestones,
    tracks: management.tracks.map((track) => ({ key: track.key, shortLabel: track.shortLabel, deltaDays: track.deltaDays, dateCertainty: track.dateCertainty })),
    objectiveTargetDate: objective?.targetDate ?? null,
    funding: latestFunding ? { requiredAmount: latestFunding.requiredAmount, securedAmount: latestFunding.securedAmount } : null,
  });

  const ecdIssues = management.issues.map((issue) => ({
    id: issue.id,
    slug: issue.slug,
    title: issue.title,
    status: issue.status,
    ownerLabel: issue.ownerLabel,
    dueDate: issue.dueDate,
    relatedMilestoneSlugs: issue.relatedMilestoneSlugs,
    validationRuns: issue.validationRuns.map((run) => ({ id: run.id, method: run.method, status: run.status, dueDate: run.dueDate, ownerLabel: run.ownerLabel })),
    decisions: issue.decisions.map((decision) => ({
      id: decision.id,
      issueId: decision.issueId,
      actionItems: decision.actionItems.map((action) => ({ id: action.id, title: action.title, status: action.status, dueDate: action.dueDate, ownerLabel: action.ownerLabel })),
    })),
  }));

  // 全件のソート済みキュー。重要経路に加えて、経路外の柱の現在ゲート（停止・期限超過・担当未確認
  // 等）も同じ土俵に載せる — 最大遅延の柱が「重要経路外だから」初期画面から消えないようにする。
  const queue = deriveSxInterventionQueue({
    today: management.asOf,
    criticalPathSlugs: judgment.criticalPathSlugs,
    milestones: management.milestones,
    technicalTests: management.technicalTests.map((test) => ({ id: test.id, milestoneId: test.milestoneId, testName: test.testName, status: test.status, ownerLabel: test.ownerLabel })),
    partnerWorkItems: management.partnerWorkItems.map((item) => ({ id: item.id, partnerId: item.partnerId, side: item.side, title: item.title, ownerLabel: item.ownerLabel, status: item.status, dueDate: item.dueDate, dueDatePrecision: item.dueDatePrecision, relatedMilestoneId: item.relatedMilestoneId })),
    partners: management.partners.map((partner) => ({
      id: partner.id,
      slug: partner.slug,
      name: partner.name,
      currentBallSide: partner.currentBallSide,
      currentBallOwner: partner.currentBallOwner,
      relatedMilestoneSlugs: partner.relatedMilestoneSlugs,
      nextCommitment: partner.nextCommitment,
      dueDate: partner.dueDate,
      dueDatePrecision: partner.dueDatePrecision,
    })),
    issues: ecdIssues,
    pillarGates: management.tracks
      .filter((track) => track.milestoneId && !(track.milestoneSlug && criticalSlugSet.has(track.milestoneSlug)))
      .map((track) => ({ trackKey: track.key, trackLabel: track.shortLabel, milestoneId: track.milestoneId })),
    maxRows: 200,
  });

  // 最大遅延の柱をtop5へ必ず1件含める（候補が無ければ行を発明せず注記だけ出す）。
  const maxDelayTrack = management.tracks.reduce<{ key: string; label: string; delta: number } | null>((best, track) => {
    if (track.deltaDays == null || track.deltaDays <= 0) return best;
    if (best && best.delta >= track.deltaDays) return best;
    return { key: track.key, label: track.shortLabel, delta: track.deltaDays };
  }, null);
  const quota = applySxInterventionPillarQuota({
    rows: queue.rows,
    topCount: 5,
    requiredTrack: maxDelayTrack?.key ?? null,
    requiredTrackLabel: maxDelayTrack?.label ?? null,
  });

  const timeline = deriveSxUnifiedTimeline({
    today: management.asOf,
    milestones: management.milestones,
    criticalPathSlugs: judgment.criticalPathSlugs,
    dagValid: judgment.dagValid,
    tracks: management.tracks.map((track) => ({ key: track.key, label: track.label, shortLabel: track.shortLabel, accent: track.accent, deltaDays: track.deltaDays, dateCertainty: track.dateCertainty, maxIssue: track.maxIssue })),
    objectiveTargetDate: objective?.targetDate ?? null,
    interventionRows: quota.top,
    pinCount: 5,
  });

  // 意思決定待ち = 論点台帳と同じ判定（未決の意思決定を持つ論点 or
  // 意思決定待ち分類）。台帳の小さなカウンタから初期画面の議題へ昇格し、件数の意味を揃える。
  const pendingDecisions = management.issues
    .filter((issue) => issue.status !== "closed" && (issue.knowledgeType === "decision_needed" || issue.decisions.some((decision) => decision.status !== "decided")))
    .sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"));

  return (
    <section
      className="border border-[#a69b84] bg-[#fffdf7]"
      aria-label="経営状況図: 判定・統合タイムライン・次の経営介入"
      data-testid="sx-executive-control-deck"
    >
      <VerdictBar summary={verdict} />

      {/* 帯2: 統合タイムライン（経営状況図の本体） */}
      <div className="border-b border-[#c5bba5] px-3 pb-1.5 pt-2 sm:px-4" data-testid="sx-state-map">
        <h3 className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">経営状況図 — 全マイルストーン・重要経路・ボールの一枚図</h3>
        <div className="mt-1">
          <SxUnifiedTimeline timeline={timeline} tracks={management.tracks} asOf={management.asOf} selectedMilestoneId={selectedMilestoneId} onSelectMilestone={onSelectMilestone} canManage={management.canManage} onEditMilestone={onEditMilestone} onCreateMilestone={onCreateMilestone} />
        </div>
      </div>

      {/* 帯3: 意思決定待ち + 次の経営介入（①〜⑤はタイムラインのピンと同番号） */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <section className="min-w-0 border-b border-[#c5bba5] px-3 py-2 sm:px-4 xl:border-b-0 xl:border-r" aria-label="意思決定待ち">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">意思決定待ち（期限順）</h3>
            <span className="text-[10px] text-[#5f5a4d]">全{pendingDecisions.length}件</span>
          </div>
          {pendingDecisions.length === 0 ? (
            <p className="mt-1.5 text-[11px] text-[#5a574c]" data-testid="sx-decision-queue">意思決定待ちの論点は登録なし。</p>
          ) : (
            <ul className="mt-1" data-testid="sx-decision-queue">
              {pendingDecisions.map((issue) => (
                <li key={issue.id} className="border-b border-[#dcd5c3] last:border-b-0">
                  <a
                    href={`#sx-issue-${issue.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      focusAnchorRow(`#sx-issue-${issue.id}`);
                    }}
                    className="flex min-h-11 flex-col justify-center gap-0.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                    aria-label={`意思決定待ち: ${issue.title}へ移動`}
                  >
                    <span className="line-clamp-2 text-[11px] font-semibold leading-[1.35] text-[#24231f]">{issue.title}</span>
                    <span className="flex items-center justify-between gap-2 text-[10px] text-[#5f5a4d]">
                      <span className="truncate">{issue.ownerLabel || "担当未確認"}</span>
                      <span className="shrink-0">{issue.dueDate ? `期限 ${sxFormatDate(issue.dueDate)}` : "期限未設定"}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 px-3 py-2 sm:px-4" aria-label="次の経営介入">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">次の経営介入（優先順・①〜⑤は図のピンと同番号）</h3>
            <span className="text-[10px] text-[#5f5a4d]">全{queue.totalCount}件中 上位{quota.top.length}件</span>
          </div>
          {quota.top.length === 0 ? (
            <p className="mt-1.5 text-[11px] text-[#5a574c]" data-testid="sx-intervention-queue">対応待ちの案件は検出なし。</p>
          ) : (
            <>
              <div className="mt-1 hidden xl:block" data-testid="sx-intervention-queue">
                <p className="grid grid-cols-[24px_minmax(0,1.6fr)_minmax(0,1fr)_100px_minmax(0,1fr)] gap-x-2 border-b border-[#c5bba5] pb-0.5 text-[9px] font-semibold text-[#5f5a4d]">
                  <span aria-hidden="true" />
                  <span>対象</span>
                  <span>ボール / 担当</span>
                  <span>期限</span>
                  <span>止まるゲート</span>
                </p>
                <ol>
                  {quota.top.map((row, index) => (
                    <InterventionRowDesktop key={row.key} row={row} rank={index + 1} onSelectMilestone={onSelectMilestone} />
                  ))}
                </ol>
              </div>
              <ul className="mt-1 xl:hidden" data-testid="sx-intervention-queue-mobile">
                {quota.top.map((row, index) => (
                  <InterventionRowMobile key={row.key} row={row} rank={index + 1} onSelectMilestone={onSelectMilestone} />
                ))}
              </ul>
            </>
          )}
          {quota.quotaNote && <p className="mt-1 text-[10px] font-semibold text-[#765022]" data-testid="sx-quota-note">{quota.quotaNote}（予測差だけが登録されている状態）</p>}
        </section>
      </div>
    </section>
  );
}
