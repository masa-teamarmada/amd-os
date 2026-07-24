"use client";

import { ArrowRight, Ban, CircleCheck, CircleDot, CircleHelp, Flag, TriangleAlert } from "lucide-react";
import type { SxJudgment, SxManagementBundle, SxTrackKey } from "@/lib/sx-management";
import {
  deriveSxCriticalPathRail,
  deriveSxInterventionQueue,
  deriveSxUpcomingQueue,
  sxVerdictDisplayLabel,
  sxUpcomingWindowLabel,
  sxEcdFormatDueDate,
  type SxEcdInterventionRow,
  type SxEcdPathNode,
  type SxEcdPathNodeState,
  type SxEcdUpcomingRow,
} from "@/lib/sx-executive-control-deck";
import { SxBadge, sxFormatDate, sxFormatDelta, sxTrackEvidenceCompleteness } from "./sx-visual-shared";

const JUDGMENT_TONE: Record<string, string> = {
  on_track: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  attention: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  crisis: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  unassessed: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
};

const NODE_STATE_LABEL: Record<SxEcdPathNodeState, string> = {
  complete: "完了",
  current: "現在",
  future: "予定",
  blocked: "停止",
  overdue: "期限超過",
  unassessed: "要確認/未評価",
  attention: "要注意",
};

const NODE_STATE_TONE: Record<SxEcdPathNodeState, string> = {
  complete: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  current: "border-[#38745d] bg-[#e8f2eb] text-[#205f49]",
  future: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  blocked: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  overdue: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  unassessed: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
  attention: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
};

function NodeIcon({ state }: { state: SxEcdPathNodeState }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (state === "blocked" || state === "overdue") return <Ban className={className} aria-hidden="true" />;
  if (state === "complete") return <CircleCheck className={className} aria-hidden="true" />;
  if (state === "current") return <CircleDot className={className} aria-hidden="true" />;
  if (state === "unassessed") return <CircleHelp className={className} aria-hidden="true" />;
  if (state === "attention") return <TriangleAlert className={className} aria-hidden="true" />;
  return <span className={`inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-current`} aria-hidden="true" />;
}

const INTERVENTION_KIND_LABEL: Record<SxEcdInterventionRow["kind"], string> = {
  critical_blocked: "重要経路停止",
  critical_overdue: "重要経路期限超過",
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
function callsOnSelectMilestone(row: SxEcdInterventionRow): boolean {
  return row.anchor === "management-plan";
}

function dueDateDisplay(row: { dueDate: string | null; dueDatePrecision?: SxEcdInterventionRow["dueDatePrecision"] }): string {
  if (row.dueDatePrecision) return sxEcdFormatDueDate(row.dueDate, row.dueDatePrecision);
  return sxFormatDate(row.dueDate);
}

function InterventionRowDesktop({ row, onSelectMilestone }: { row: SxEcdInterventionRow; onSelectMilestone: (id: string | null) => void }) {
  return (
    <tr className="border-b border-[#f1eee5] last:border-b-0">
      <td className="py-1.5 pr-2 align-top">
        <a
          href={row.anchor.startsWith("#") ? row.anchor : `#${row.anchor}`}
          onClick={(event) => {
            event.preventDefault();
            if (callsOnSelectMilestone(row)) {
              onSelectMilestone(row.milestoneId);
              window.requestAnimationFrame(() => focusAnchorRow(row.anchor));
            } else {
              focusAnchorRow(row.anchor);
            }
          }}
          className="inline-flex min-h-11 items-center font-semibold text-[#24231f] underline decoration-[#cfc7b9] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
          aria-label={`${INTERVENTION_KIND_LABEL[row.kind]}: ${row.target}へ移動`}
        >
          <span className="max-w-[160px] truncate" title={row.target}>{row.target}</span>
          {row.dateCertainty === "provisional" && <span className="ml-1 shrink-0 text-[9px] font-semibold text-[#765022]">仮</span>}
        </a>
        <span className="block truncate text-[9px] text-[#8c3329]" title={INTERVENTION_KIND_LABEL[row.kind]}>{INTERVENTION_KIND_LABEL[row.kind]}</span>
      </td>
      <td className="py-1.5 pr-2 align-top">
        <span className="block truncate" title={row.ballSide}>{row.ballSide}</span>
        <span className="block truncate text-[9px] text-[#777166]" title={row.ballOwner}>{row.ballOwner}</span>
      </td>
      <td className="whitespace-nowrap py-1.5 pr-2 align-top text-[#69665d]">
        {dueDateDisplay(row)}
        {row.dueContextLabel && <span className="block text-[9px] text-[#9b9487]">{row.dueContextLabel}</span>}
      </td>
      <td className="max-w-[110px] truncate py-1.5 align-top text-[#69665d]" title={row.gate}>{row.gate || "未確認"}</td>
    </tr>
  );
}

function InterventionRowMobile({ row, onSelectMilestone }: { row: SxEcdInterventionRow; onSelectMilestone: (id: string | null) => void }) {
  return (
    <li className="min-h-11 border-b border-[#f1eee5] py-1.5 last:border-b-0">
      <a
        href={row.anchor.startsWith("#") ? row.anchor : `#${row.anchor}`}
        onClick={(event) => {
          event.preventDefault();
          if (callsOnSelectMilestone(row)) {
            onSelectMilestone(row.milestoneId);
            window.requestAnimationFrame(() => focusAnchorRow(row.anchor));
          } else {
            focusAnchorRow(row.anchor);
          }
        }}
        className="flex min-h-11 flex-col justify-center gap-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
        aria-label={`${INTERVENTION_KIND_LABEL[row.kind]}: ${row.target}へ移動`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold text-[#24231f]" title={row.target}>
            {row.target}
            {row.dateCertainty === "provisional" && <span className="ml-1 text-[9px] font-semibold text-[#765022]">仮</span>}
          </span>
          <span className="shrink-0 text-[9px] text-[#69665d]">{dueDateDisplay(row)}</span>
        </span>
        <span className="flex items-center justify-between gap-2 text-[9px] text-[#777166]">
          <span className="truncate text-[#8c3329]">{INTERVENTION_KIND_LABEL[row.kind]}</span>
          <span className="truncate">{row.ballSide} ・ {row.ballOwner}</span>
        </span>
      </a>
    </li>
  );
}

function UpcomingRow({ row }: { row: SxEcdUpcomingRow }) {
  const toneClass = row.window === "overdue" ? "text-[#8c3329]" : row.window === "within_7" ? "text-[#765022]" : "text-[#69665d]";
  return (
    <li className="min-h-11 border-b border-[#f1eee5] py-1.5 last:border-b-0">
      <a
        href={row.anchor.startsWith("#") ? row.anchor : `#${row.anchor}`}
        onClick={(event) => {
          event.preventDefault();
          focusAnchorRow(row.anchor);
        }}
        className="flex min-h-11 flex-col justify-center gap-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold text-[#24231f]" title={row.label}>{row.label}</span>
          <span className={`shrink-0 text-[9px] font-semibold ${toneClass}`}>{sxUpcomingWindowLabel(row.window)}</span>
        </span>
        <span className="flex items-center justify-between gap-2 text-[9px] text-[#777166]">
          <span className="truncate">{row.ownerLabel} ・ {sxFormatDate(row.dueDate)}</span>
          {row.gate && <span className="shrink-0 truncate">{row.gate}</span>}
        </span>
      </a>
    </li>
  );
}

export function SxExecutiveControlDeck({
  management,
  judgment,
  selectedTrack,
  onSelectTrack,
  onSelectMilestone,
}: {
  management: SxManagementBundle;
  judgment: SxJudgment;
  selectedTrack: SxTrackKey | null;
  onSelectTrack: (track: SxTrackKey | null) => void;
  onSelectMilestone: (milestoneId: string | null) => void;
}) {
  const objective = management.objective;
  const primaryReason = judgment.reasons[0] || "判定理由 未登録";

  const rail = deriveSxCriticalPathRail(
    { dagValid: judgment.dagValid, criticalPathSlugs: judgment.criticalPathSlugs },
    management.milestones,
  );

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
    maxRows: 3,
  });

  const interventionDedupeKeys = new Set(
    queue.rows.filter((row) => row.kind === "validation_run" || row.kind === "action_item").map((row) => row.key),
  );

  const upcoming = deriveSxUpcomingQueue({
    today: management.asOf,
    criticalPathSlugs: judgment.criticalPathSlugs,
    milestones: management.milestones,
    actions: management.actions.map((action) => {
      const decision = management.decisions.find((d) => d.actionItems.some((a) => a.id === action.id));
      return { id: action.id, title: action.title, ownerLabel: action.ownerLabel, dueDate: action.dueDate, status: action.status, issueId: decision?.issueId ?? null };
    }),
    decisions: management.decisions.map((decision) => ({ id: decision.id, title: decision.title, ownerLabel: decision.ownerLabel, dueDate: decision.dueDate, status: decision.status, issueId: decision.issueId })),
    validationRuns: management.validationRuns.map((run) => {
      const issue = management.issues.find((i) => i.validationRuns.some((r) => r.id === run.id));
      return { id: run.id, method: run.method, ownerLabel: run.ownerLabel, dueDate: run.dueDate, status: run.status, issueId: issue?.id ?? null };
    }),
    issues: ecdIssues,
    excludeKeys: interventionDedupeKeys,
    maxRows: 3,
  });

  return (
    <section
      className="border border-[#cfc7b9] bg-[#fffdf7]"
      aria-label="PJ管制盤: オンスケ判定・重要経路・対応待ち"
      data-testid="sx-executive-control-deck"
    >
      {/* 上段: 経営判定 + 4本柱 */}
      <div className="grid min-h-[54px] grid-cols-[auto_1fr] items-center gap-x-3 border-b border-[#e4ddd0] px-3 py-2 sm:grid-cols-[auto_minmax(170px,1fr)_auto_auto] sm:px-4">
        <div>
          <p className="text-[9px] font-semibold tracking-[0.14em] text-[#38745d]">現在の経営判定</p>
          <SxBadge tone={JUDGMENT_TONE[judgment.key] || JUDGMENT_TONE.unassessed}>{sxVerdictDisplayLabel(judgment.key)}</SxBadge>
        </div>
        <p className="line-clamp-2 text-[11px] leading-4 text-[#514e47] sm:line-clamp-1">{primaryReason}</p>
        <dl className="col-span-2 mt-1 flex items-center gap-3 text-[9px] text-[#777166] sm:col-span-1 sm:mt-0">
          <div><dt className="inline">充足 </dt><dd className="inline font-semibold text-[#24231f]">{judgment.completenessPct}%</dd></div>
          <div><dt className="inline">重大未確認 </dt><dd className="inline font-semibold text-[#8c3329]">{judgment.criticalUnknownCount}</dd></div>
          <div><dt className="inline">停止 </dt><dd className="inline font-semibold text-[#8c3329]">{judgment.blockedCount}</dd></div>
          <div><dt className="inline">次期限 </dt><dd className="inline font-semibold text-[#24231f]">{sxFormatDate(judgment.nextDeadline)}</dd></div>
        </dl>
        <div className="hidden items-center gap-1 text-[10px] font-semibold text-[#5f4a66] sm:flex">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />設立判断 {sxFormatDate(objective?.targetDate)}
          <span className="ml-2 text-[#777166]">更新 {sxFormatDate(judgment.lastVerifiedAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-[#e4ddd0] sm:grid-cols-4" data-testid="sx-four-pillar-signal-strip">
        {management.tracks.map((track, index) => {
          const selected = selectedTrack === track.key;
          const milestone = track.milestoneId ? management.milestones.find((item) => item.id === track.milestoneId) : undefined;
          const completeness = sxTrackEvidenceCompleteness(track, milestone, management.kpis);
          const deltaLabel = sxFormatDelta(track.deltaDays, track.dateCertainty);
          return (
            <button
              key={track.key}
              type="button"
              aria-pressed={selected}
              aria-controls="selected-management-context"
              onClick={() => onSelectTrack(selected ? null : track.key)}
              className={`min-h-11 border-b px-2 py-1.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] sm:border-b-0 ${index % 2 === 0 ? "border-r" : ""} ${index < 3 ? "sm:border-r" : ""} ${selected ? "bg-[#e8f2eb]" : "bg-white hover:bg-[#f8f5ec]"}`}
            >
              <span className="flex items-center gap-1.5 text-[9px] font-semibold text-[#777166]"><span className="h-2 w-2 rounded-full" style={{ background: track.accent }} />{track.label}</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] font-semibold text-[#24231f]"><span className="truncate">{track.gate}</span><ArrowRight className="h-3 w-3 shrink-0 text-[#9b9487]" /></span>
              <span className="mt-1 flex items-center gap-1.5" aria-label={`証拠充足 ${completeness.pct}%`}>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8e2d6]"><span className="block h-full rounded-full bg-[#38745d]" style={{ width: `${completeness.pct}%` }} /></span>
                <span className="shrink-0 text-[9px] font-semibold text-[#69665d]">証拠{completeness.pct}%</span>
              </span>
              <span className="mt-1 block truncate text-[9px] text-[#69665d]">{track.statusLabel} ・ {deltaLabel} ・ 次期限 {sxFormatDate(track.forecastEnd || track.plannedEnd)}</span>
              <span className="mt-0.5 block truncate text-[9px] text-[#8c3329]">詰まり: {track.maxIssue}</span>
            </button>
          );
        })}
      </div>

      {/* 主段: 重要経路レール（lg以上は全幅バンド） + 対応待ち/直近アクション（lg以上は2カラム） */}
      <div className="flex flex-col">
        <div className="order-2 min-w-0 border-b border-[#e4ddd0] px-3 py-2 lg:order-1" data-testid="sx-critical-path-band">
          <h3 className="text-[9px] font-semibold tracking-[0.14em] text-[#38745d]">重要経路</h3>
          {!rail.valid ? (
            <p className="mt-2 rounded-md border border-dashed border-[#b5533f] bg-[#f9e4e1] px-2.5 py-2 text-[11px] font-semibold text-[#8c3329]" data-testid="sx-critical-path-rail">
              {rail.reason}
            </p>
          ) : (
            <ol className="mt-1.5 flex max-h-[420px] flex-col gap-1 overflow-y-auto lg:max-h-none lg:flex-row lg:flex-wrap lg:items-stretch lg:gap-0 lg:overflow-visible" data-testid="sx-critical-path-rail" aria-label="重要経路（判定に使用した順序）">
              {rail.leadingMarker && (
                <li className="flex shrink-0 items-center justify-center px-2 text-[10px] font-semibold text-[#777166] lg:min-w-[36px]" aria-label={rail.leadingMarker.label}>
                  {rail.leadingMarker.label}
                  <ArrowRight className="ml-1 h-3 w-3 text-[#9b9487]" aria-hidden="true" />
                </li>
              )}
              {(() => {
                // When a trailingMarker exists, deriveSxCriticalPathRail has appended the final
                // endpoint node onto the end of visibleNodes to guarantee it's always shown, even
                // though it isn't contiguous with the rest of the window. Split it back out here so
                // the "…N" marker renders BETWEEN the visible run and the final node (never after
                // it, and never drawing a connecting line across the hidden gap).
                const hasGap = Boolean(rail.trailingMarker);
                const mainRun = hasGap ? rail.visibleNodes.slice(0, -1) : rail.visibleNodes;
                const finalNode = hasGap ? rail.visibleNodes[rail.visibleNodes.length - 1] : null;

                const renderNode = (node: SxEcdPathNode, index: number, isLastInGroup: boolean) => {
                  const ariaLabel = `${index + 1}番目 ${node.title} ${NODE_STATE_LABEL[node.state]} 予定 ${sxFormatDate(node.plannedEnd)} 予測 ${sxFormatDate(node.forecastEnd)} 差分 ${sxFormatDelta(node.deltaDays, node.dateCertainty)} 担当 ${node.ownerLabel}`;
                  return (
                    <li key={node.slug} className="flex min-w-0 shrink-0 items-stretch lg:flex-1">
                      <button
                        type="button"
                        onClick={() => node.milestoneId && onSelectMilestone(node.milestoneId)}
                        disabled={!node.milestoneId}
                        aria-label={ariaLabel}
                        className={`flex min-h-11 w-full min-w-[150px] flex-col gap-0.5 border px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] disabled:cursor-default lg:min-w-0 ${NODE_STATE_TONE[node.state]} ${node.state === "future" ? "opacity-80" : ""} ${node.dateCertainty === "provisional" ? "border-dashed" : ""}`}
                      >
                        <span className="flex items-center gap-1 text-[9px] font-semibold">
                          <NodeIcon state={node.state} />
                          {NODE_STATE_LABEL[node.state]}{node.isCurrent ? "・現在地" : ""}
                          {node.dateCertainty === "provisional" && <span className="text-[#765022]">（仮）</span>}
                        </span>
                        <span className="truncate text-[10px] font-semibold text-[#24231f]" title={node.title}>{node.title}</span>
                        <span className="truncate text-[9px]">予定 {sxFormatDate(node.plannedEnd)}</span>
                        <span className="truncate text-[9px]">予測 {sxFormatDate(node.forecastEnd)}（{sxFormatDelta(node.deltaDays, node.dateCertainty)}）</span>
                        <span className="truncate text-[9px]" title={node.ownerLabel}>担当 {node.ownerLabel}</span>
                      </button>
                      {!isLastInGroup && (
                        <span className="hidden shrink-0 items-center px-0.5 text-[#9b9487] lg:flex" aria-hidden="true"><ArrowRight className="h-3.5 w-3.5" /></span>
                      )}
                    </li>
                  );
                };

                return (
                  <>
                    {mainRun.map((node, index) => renderNode(node, index, index === mainRun.length - 1 && !hasGap))}
                    {rail.trailingMarker && (
                      <li className="flex shrink-0 items-center gap-1 justify-center px-2 text-[10px] font-semibold text-[#777166] lg:min-w-[36px]" aria-label={`残り${rail.trailingMarker.count}件`}>
                        <ArrowRight className="h-3 w-3 text-[#9b9487]" aria-hidden="true" />
                        {rail.trailingMarker.label}
                      </li>
                    )}
                    {finalNode && renderNode(finalNode, rail.visibleNodes.length - 1, true)}
                  </>
                );
              })()}
            </ol>
          )}
        </div>

        <div className="order-1 grid min-w-0 grid-cols-1 lg:order-2 xl:grid-cols-2" data-testid="sx-queue-columns">
          <section className="min-w-0 border-b border-[#e4ddd0] px-3 py-2 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[9px] font-semibold tracking-[0.14em] text-[#38745d]">対応待ち（優先順）</h3>
              <span className="text-[9px] text-[#777166]">{queue.totalCount}件中 上位{queue.rows.length}件</span>
            </div>
            {queue.rows.length === 0 ? (
              <p className="mt-2 text-[11px] text-[#69665d]" data-testid="sx-intervention-queue">対応待ちの重要経路案件は検出なし。</p>
            ) : (
              <>
                <table className="mt-1.5 hidden w-full border-collapse text-[10px] xl:table" data-testid="sx-intervention-queue">
                  <caption className="sr-only">重要経路の対応待ち、優先度の高い順</caption>
                  <thead>
                    <tr className="border-b border-[#e4ddd0] text-left text-[9px] text-[#777166]">
                      <th scope="col" className="py-1 pr-2 font-semibold">対象</th>
                      <th scope="col" className="py-1 pr-2 font-semibold">ボール / 担当</th>
                      <th scope="col" className="py-1 pr-2 font-semibold">期限</th>
                      <th scope="col" className="py-1 font-semibold">止まるゲート</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.rows.map((row: SxEcdInterventionRow) => (
                      <InterventionRowDesktop key={row.key} row={row} onSelectMilestone={onSelectMilestone} />
                    ))}
                  </tbody>
                </table>
                <ul className="mt-1.5 xl:hidden" data-testid="sx-intervention-queue-mobile">
                  {queue.rows.map((row: SxEcdInterventionRow) => (
                    <InterventionRowMobile key={row.key} row={row} onSelectMilestone={onSelectMilestone} />
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="min-w-0 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[9px] font-semibold tracking-[0.14em] text-[#38745d]">直近アクション</h3>
              <span className="text-[9px] text-[#777166]">{upcoming.totalCount}件中 上位{upcoming.rows.length}件</span>
            </div>
            {upcoming.rows.length === 0 ? (
              <p className="mt-2 text-[11px] text-[#69665d]" data-testid="sx-upcoming-queue">直近の予定アクションは検出なし。</p>
            ) : (
              <ul className="mt-1.5" data-testid="sx-upcoming-queue">
                {upcoming.rows.map((row) => <UpcomingRow key={row.key} row={row} />)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
