"use client";

import { ArrowRight, Ban, CircleCheck, CircleDot, CircleHelp, Flag, TriangleAlert } from "lucide-react";
import type { SxJudgment, SxManagementBundle, SxTrackKey } from "@/lib/sx-management";
import {
  deriveSxCriticalPathRail,
  deriveSxInterventionQueue,
  deriveSxStateMap,
  deriveSxUpcomingQueue,
  sxVerdictDisplayLabel,
  sxUpcomingWindowLabel,
  sxEcdFormatDueDate,
  type SxEcdInterventionRow,
  type SxEcdMapBlocker,
  type SxEcdMapNode,
  type SxEcdPathNodeState,
  type SxEcdStateMap,
  type SxEcdUpcomingRow,
} from "@/lib/sx-executive-control-deck";
import { sxFormatDate, sxFormatDelta, sxTrackEvidenceCompleteness } from "./sx-visual-shared";

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
  current: "border-[#38745d] bg-[#f4f9f5] text-[#205f49]",
  future: "border-[#d6cebf] bg-[#fbf9f2] text-[#69665d]",
  blocked: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  overdue: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  unassessed: "border-[#b8b5c8] bg-[#f1f0f6] text-[#55506d]",
  attention: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
};

const NODE_DOT_TONE: Record<SxEcdPathNodeState, string> = {
  complete: "bg-[#38745d]",
  current: "bg-[#38745d]",
  future: "bg-[#cfc7b9]",
  blocked: "bg-[#b5533f]",
  overdue: "bg-[#b5533f]",
  unassessed: "bg-[#8f8aa6]",
  attention: "bg-[#c99a4b]",
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

/** Shared px-per-day scale for the slip bar (予定→予測のずれ). Same scale on every node so bar
 * lengths are comparable across the map. Capped so an extreme slip cannot blow up a card. */
const SLIP_PX_PER_DAY = 2;
const SLIP_MAX_DAYS = 56;

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

function blockerDueDisplay(row: { dueDate: string | null; dueDatePrecision?: SxEcdMapBlocker["dueDatePrecision"] }): string {
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

function RankBadge({ rank, className = "" }: { rank: number; className?: string }) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#24231f] text-[10px] font-bold leading-none text-white ${className}`}
      aria-label={`次の経営介入 ${rank}番`}
    >
      {rank}
    </span>
  );
}

/** 予定→予測 slip geometry: a tick for the planned date, a bar whose length ∝ delayed days on a
 * shared scale, and a diamond for the forecast date. Zero/negative slip renders as text only —
 * never a decorative bar. */
function SlipBar({ deltaDays, dateCertainty, state }: { deltaDays: number | null; dateCertainty: "confirmed" | "provisional" | null; state: SxEcdPathNodeState }) {
  const label = sxFormatDelta(deltaDays, dateCertainty);
  if (deltaDays == null || deltaDays <= 0) {
    return <span className="text-[10px] text-[#69665d]">{label}</span>;
  }
  const width = Math.min(deltaDays, SLIP_MAX_DAYS) * SLIP_PX_PER_DAY;
  const barTone = state === "blocked" || state === "overdue" ? "bg-[#b5533f]" : "bg-[#c99a4b]";
  return (
    <span className="flex min-w-0 items-center gap-1" aria-label={`予定と予測の差 ${label}`}>
      <span className="h-3 w-[2px] shrink-0 bg-[#69665d]" aria-hidden="true" />
      <span
        className={`h-[3px] shrink-0 rounded-full ${barTone} ${dateCertainty === "provisional" ? "opacity-70" : ""}`}
        style={{ width: `${width}px` }}
        aria-hidden="true"
      />
      <span className="h-2 w-2 shrink-0 rotate-45 border border-current bg-[#fffdf7]" aria-hidden="true" />
      <span className={`shrink-0 text-[10px] font-semibold ${state === "blocked" || state === "overdue" ? "text-[#8c3329]" : "text-[#765022]"}`}>{label}</span>
    </span>
  );
}

/** One live stoppage flag hanging off the node it stops: who holds the ball (side + real name),
 * due date, and the shared rank number when it is in the 次の経営介入 top list. */
function BlockerFlag({ blocker }: { blocker: SxEcdMapBlocker }) {
  const overdueTone = blocker.kind === "critical_blocked" || blocker.kind === "critical_overdue" || blocker.kind === "technical_test_blocked";
  return (
    <li data-testid="sx-blocker-flag">
      <a
        href={anchorHref(blocker.anchor)}
        onClick={(event) => {
          event.preventDefault();
          focusAnchorRow(blocker.anchor);
        }}
        className={`flex min-h-11 items-start gap-1.5 border-l-2 py-1 pl-1.5 pr-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${overdueTone ? "border-[#b5533f] bg-[#f9e4e1]/70" : "border-[#c99a4b] bg-[#fbf1dc]/70"}`}
        aria-label={`${INTERVENTION_KIND_LABEL[blocker.kind]}: ${blocker.target}。ボール ${ballDisplay(blocker.ballSide, blocker.ballOwner)}。期限 ${blockerDueDisplay(blocker)}`}
      >
        {blocker.rank ? <RankBadge rank={blocker.rank} className="mt-0.5" /> : <Flag className="mt-0.5 h-3 w-3 shrink-0 text-[#8c3329]" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[10px] font-semibold leading-[1.3] text-[#24231f]" title={blocker.target}>{blocker.target}</span>
          <span className="block truncate text-[10px] leading-tight text-[#69665d]">
            ボール <span className="font-semibold text-[#24231f]">{ballDisplay(blocker.ballSide, blocker.ballOwner)}</span>
            <span className="ml-1">期限 {blockerDueDisplay(blocker)}</span>
          </span>
        </span>
      </a>
    </li>
  );
}

function NodeCard({
  entry,
  accent,
  pillarShortLabel,
  onSelectMilestone,
}: {
  entry: SxEcdMapNode;
  accent: string | null;
  pillarShortLabel: string | null;
  onSelectMilestone: (milestoneId: string | null) => void;
}) {
  const node = entry.node;
  const rankedStateMarks = entry.stateMarks.filter((mark) => mark.rank != null);
  // The owner_unconfirmed intervention IS the owner line's problem — merge its rank badge into the
  // 担当 line instead of printing 「担当未確認」 twice in the same card.
  const ownerMark = rankedStateMarks.find((mark) => mark.kind === "owner_unconfirmed") ?? null;
  const otherMarks = rankedStateMarks.filter((mark) => mark.kind !== "owner_unconfirmed");
  const ownerMissing = node.ownerLabel === "担当未確認";
  const ariaLabel = `${node.title} ${NODE_STATE_LABEL[node.state]}${node.isCurrent ? " 現在地" : ""} 予定 ${sxFormatDate(node.plannedEnd)} 予測 ${sxFormatDate(node.forecastEnd)} 差分 ${sxFormatDelta(node.deltaDays, node.dateCertainty)} 担当 ${node.ownerLabel}`;
  return (
    <div className="flex w-full max-w-[430px] min-w-0 flex-col gap-1 lg:max-w-[256px]">
      <button
        type="button"
        onClick={() => node.milestoneId && onSelectMilestone(node.milestoneId)}
        disabled={!node.milestoneId}
        aria-label={ariaLabel}
        className={`flex min-h-11 w-full flex-col gap-0.5 border px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] disabled:cursor-default ${NODE_STATE_TONE[node.state]} ${node.dateCertainty === "provisional" ? "border-dashed" : ""} ${node.isCurrent ? "border-l-4 shadow-[0_1px_2px_rgba(36,35,31,0.08)]" : ""}`}
        style={node.isCurrent && accent ? { borderLeftColor: accent } : undefined}
      >
        <span className="flex w-full items-center gap-1 text-[9px] font-semibold">
          <NodeIcon state={node.state} />
          <span>{NODE_STATE_LABEL[node.state]}</span>
          {node.dateCertainty === "provisional" && <span className="text-[#765022]">（仮）</span>}
          {node.isCurrent && <span className="rounded-sm bg-[#38745d] px-1 py-px text-[9px] font-bold text-white">現在地</span>}
          {pillarShortLabel && <span className="ml-auto shrink-0 font-semibold" style={accent ? { color: accent } : undefined}>{pillarShortLabel}</span>}
        </span>
        <span className={`w-full text-[11px] font-semibold text-[#24231f] ${node.isCurrent ? "whitespace-normal leading-tight" : "truncate"}`} title={node.title}>{node.title}</span>
        <span className="flex w-full flex-wrap items-baseline gap-x-1 text-[10px] text-[#514e47]">
          <span className="whitespace-nowrap">予定 {sxFormatDate(node.plannedEnd)}</span>
          <span className="whitespace-nowrap">→ 予測 {sxFormatDate(node.forecastEnd)}</span>
        </span>
        <SlipBar deltaDays={node.deltaDays} dateCertainty={node.dateCertainty} state={node.state} />
        <span className={`flex w-full items-center gap-1 text-[10px] ${ownerMissing ? "font-semibold text-[#765022]" : "text-[#514e47]"}`} title={node.ownerLabel}>
          {ownerMark?.rank != null && <RankBadge rank={ownerMark.rank} />}
          <span className="truncate">{ownerMissing ? node.ownerLabel : `担当 ${node.ownerLabel}`}</span>
        </span>
        {otherMarks.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            {otherMarks.map((mark) => (
              <span key={mark.key} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#765022]">
                {mark.rank != null && <RankBadge rank={mark.rank} />}
                {INTERVENTION_KIND_LABEL[mark.kind]}
              </span>
            ))}
          </span>
        )}
      </button>
      {entry.flags.length > 0 && (
        <ul className="flex flex-col gap-0.5" aria-label={`${node.title} を止めている対応待ち`}>
          {entry.flags.map((flag) => <BlockerFlag key={flag.key} blocker={flag} />)}
        </ul>
      )}
    </div>
  );
}

/** Desktop (lg+) 経営状況図: one left-to-right rail whose node spacing is proportional to the
 * days between forecast dates, with the 今日 marker before the current node and every live
 * stoppage flag attached directly under the node it stops. */
function StateMapDesktop({
  map,
  asOf,
  accentByTrack,
  shortLabelByTrack,
  onSelectMilestone,
}: {
  map: SxEcdStateMap;
  asOf: string;
  accentByTrack: Map<string, string>;
  shortLabelByTrack: Map<string, string>;
  onSelectMilestone: (milestoneId: string | null) => void;
}) {
  const columns: string[] = [];
  if (map.leadingMarker) columns.push("56px");
  map.nodes.forEach((entry, index) => {
    const next = map.nodes[index + 1] ?? null;
    const outgoingGap = next?.gapDaysFromPrev ?? null;
    const fr = index === map.nodes.length - 1 ? 18 : Math.max(outgoingGap ?? 30, 18);
    columns.push(`minmax(186px, ${fr}fr)`);
  });
  return (
    <ol
      className="hidden lg:grid"
      style={{ gridTemplateColumns: columns.join(" ") }}
      data-testid="sx-critical-path-rail"
      aria-label="重要経路（依存順、間隔は予測日の日数に比例）"
    >
      {map.leadingMarker && (
        <li className="flex flex-col" aria-label={map.leadingMarker.label}>
          <div className="flex h-6 items-center gap-0.5">
            <span className="text-[9px] font-semibold text-[#69665d]">{map.leadingMarker.label}</span>
            <span className="h-[2px] min-w-2 flex-1 bg-[#cfc7b9]" aria-hidden="true" />
          </div>
        </li>
      )}
      {map.nodes.map((entry, index) => {
        const node = entry.node;
        const isLast = index === map.nodes.length - 1;
        const accent = node.track ? accentByTrack.get(node.track) ?? null : null;
        const pillarShortLabel = node.track ? shortLabelByTrack.get(node.track) ?? null : null;
        const showToday = map.todayIndex === index;
        // When the rail window skips nodes before the appended final endpoint, the "…N" marker
        // belongs on the OUTGOING connector of the second-to-last visible node (the hidden run is
        // between it and the endpoint), never after the endpoint itself.
        const gapToFinal = Boolean(map.trailingMarker) && index === map.nodes.length - 2;
        return (
          <li key={node.slug} className="flex min-w-0 flex-col" data-sx-path-node={node.slug}>
            <div className="flex h-6 items-center">
              {showToday && (
                <span className="mr-1 flex shrink-0 items-center gap-0.5" aria-label={`今日 ${sxFormatDate(asOf)}`}>
                  <span className="rounded-sm bg-[#24231f] px-1 py-px text-[9px] font-bold leading-tight text-white">今日 {sxFormatDate(asOf).slice(5)}</span>
                  <span className="h-4 w-[2px] bg-[#24231f]" aria-hidden="true" />
                </span>
              )}
              <span
                className={`h-3 w-3 shrink-0 rounded-full border-2 ${NODE_DOT_TONE[node.state]}`}
                style={accent ? { borderColor: accent } : undefined}
                aria-hidden="true"
              />
              {!isLast && !gapToFinal && (
                <>
                  <span className={`h-[2px] min-w-2 flex-1 ${node.dateCertainty === "provisional" ? "border-t-2 border-dashed border-[#b3ab9c] bg-transparent" : "bg-[#b3ab9c]"}`} aria-hidden="true" />
                  <ArrowRight className="h-3 w-3 shrink-0 text-[#9b9487]" aria-hidden="true" />
                </>
              )}
              {gapToFinal && map.trailingMarker && (
                <span className="flex min-w-0 flex-1 items-center gap-1" aria-label={`途中 ${map.trailingMarker.count} 件省略`}>
                  <span className="h-[2px] min-w-2 flex-1 border-t-2 border-dotted border-[#b3ab9c] bg-transparent" aria-hidden="true" />
                  <span className="text-[9px] font-semibold text-[#69665d]">{map.trailingMarker.label}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-[#9b9487]" aria-hidden="true" />
                </span>
              )}
              {isLast && <Flag className="ml-1 h-3.5 w-3.5 shrink-0 text-[#5f4a66]" aria-hidden="true" />}
            </div>
            <div className={isLast ? "" : "pr-3"}>
              <NodeCard entry={entry} accent={accent} pillarShortLabel={pillarShortLabel} onSelectMilestone={onSelectMilestone} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Tablet/mobile (<lg) 経営状況図: the same rail rotated vertical — time runs top to bottom, the
 * 今日 marker sits above the current node, flags stay attached under their node. */
function StateMapVertical({
  map,
  asOf,
  accentByTrack,
  shortLabelByTrack,
  onSelectMilestone,
}: {
  map: SxEcdStateMap;
  asOf: string;
  accentByTrack: Map<string, string>;
  shortLabelByTrack: Map<string, string>;
  onSelectMilestone: (milestoneId: string | null) => void;
}) {
  return (
    <ol className="flex flex-col lg:hidden" data-testid="sx-critical-path-rail-vertical" aria-label="重要経路（依存順、上から下へ）">
      {map.leadingMarker && (
        <li className="flex items-center gap-2 pb-1 pl-0.5 text-[9px] font-semibold text-[#69665d]" aria-label={map.leadingMarker.label}>
          <span className="flex h-4 w-3 justify-center"><span className="w-[2px] bg-[#cfc7b9]" aria-hidden="true" /></span>
          {map.leadingMarker.label}
        </li>
      )}
      {map.nodes.map((entry, index) => {
        const node = entry.node;
        const isLast = index === map.nodes.length - 1;
        const accent = node.track ? accentByTrack.get(node.track) ?? null : null;
        const pillarShortLabel = node.track ? shortLabelByTrack.get(node.track) ?? null : null;
        const showToday = map.todayIndex === index;
        const gapToFinal = Boolean(map.trailingMarker) && index === map.nodes.length - 2;
        return (
          <li key={node.slug} className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-2">
            {showToday && (
              <>
                <span className="flex justify-center"><span className="w-[2px] bg-[#24231f]" aria-hidden="true" /></span>
                <span className="pb-1"><span className="rounded-sm bg-[#24231f] px-1 py-px text-[9px] font-bold text-white">今日 {sxFormatDate(asOf).slice(5)}</span></span>
              </>
            )}
            <span className="flex flex-col items-center">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${NODE_DOT_TONE[node.state]}`} style={accent ? { borderColor: accent } : undefined} aria-hidden="true" />
              {!isLast && (
                <span className={`w-[2px] flex-1 ${gapToFinal ? "border-l-2 border-dotted border-[#b3ab9c]" : node.dateCertainty === "provisional" ? "border-l-2 border-dashed border-[#b3ab9c]" : "bg-[#b3ab9c]"}`} aria-hidden="true" />
              )}
            </span>
            <div className="pb-2">
              <NodeCard entry={entry} accent={accent} pillarShortLabel={pillarShortLabel} onSelectMilestone={onSelectMilestone} />
              {gapToFinal && map.trailingMarker && (
                <p className="pt-0.5 text-[9px] font-semibold text-[#69665d]" aria-label={`途中 ${map.trailingMarker.count} 件省略`}>{map.trailingMarker.label}（途中省略）</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function InterventionRowDesktop({ row, onSelectMilestone }: { row: SxEcdMapBlocker; onSelectMilestone: (id: string | null) => void }) {
  return (
    <li className="border-b border-[#f1eee5] last:border-b-0">
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
        className="grid min-h-11 grid-cols-[20px_minmax(0,1.5fr)_minmax(0,1fr)_96px_minmax(0,1fr)] items-center gap-x-2 py-1 text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
        aria-label={`${INTERVENTION_KIND_LABEL[row.kind]}: ${row.target}へ移動`}
      >
        {row.rank != null ? <RankBadge rank={row.rank} /> : <span aria-hidden="true" />}
        <span className="min-w-0">
          <span className="block truncate font-semibold text-[#24231f] underline decoration-[#cfc7b9] underline-offset-2" title={row.target}>
            {row.target}
            {row.dateCertainty === "provisional" && <span className="ml-1 text-[10px] font-semibold text-[#765022]">仮</span>}
          </span>
          <span className="block truncate text-[10px] text-[#8c3329]">{INTERVENTION_KIND_LABEL[row.kind]}</span>
        </span>
        <span className="min-w-0 truncate text-[#514e47]" title={ballDisplay(row.ballSide, row.ballOwner)}>
          {ballDisplay(row.ballSide, row.ballOwner)}
        </span>
        <span className="whitespace-nowrap text-[#69665d]">
          {blockerDueDisplay(row)}
          {row.dueContextLabel && <span className="block text-[10px] text-[#9b9487]">{row.dueContextLabel}</span>}
        </span>
        <span className="min-w-0 truncate text-[#69665d]" title={row.gate}>{row.gate || "未確認"}</span>
      </a>
    </li>
  );
}

function InterventionRowMobile({ row, onSelectMilestone }: { row: SxEcdMapBlocker; onSelectMilestone: (id: string | null) => void }) {
  return (
    <li className="border-b border-[#f1eee5] last:border-b-0">
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
          {row.rank != null && <RankBadge rank={row.rank} />}
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#24231f]" title={row.target}>
            {row.target}
            {row.dateCertainty === "provisional" && <span className="ml-1 text-[10px] font-semibold text-[#765022]">仮</span>}
          </span>
          <span className="shrink-0 text-[10px] text-[#69665d]">{blockerDueDisplay(row)}</span>
        </span>
        <span className="flex items-center justify-between gap-2 pl-[26px] text-[10px] text-[#777166]">
          <span className="truncate text-[#8c3329]">{INTERVENTION_KIND_LABEL[row.kind]}</span>
          <span className="truncate">ボール {ballDisplay(row.ballSide, row.ballOwner)}</span>
        </span>
      </a>
    </li>
  );
}

function UpcomingStrip({ rows, totalCount }: { rows: SxEcdUpcomingRow[]; totalCount: number }) {
  if (rows.length === 0) {
    return <p className="text-[10px] text-[#777166]" data-testid="sx-upcoming-queue">直近アクション: 予定の登録なし。</p>;
  }
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#69665d]" data-testid="sx-upcoming-queue">
      <span className="font-semibold tracking-[0.08em] text-[#38745d]">直近アクション</span>
      {rows.map((row) => {
        const toneClass = row.window === "overdue" ? "text-[#8c3329]" : row.window === "within_7" ? "text-[#765022]" : "text-[#69665d]";
        return (
          <a
            key={row.key}
            href={anchorHref(row.anchor)}
            onClick={(event) => {
              event.preventDefault();
              focusAnchorRow(row.anchor);
            }}
            className="inline-flex min-h-6 max-w-[260px] items-center gap-1 truncate underline decoration-[#d6cebf] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
            title={`${row.label}（${row.ownerLabel}・${sxUpcomingWindowLabel(row.window)}）`}
          >
            <span className="truncate text-[#24231f]">{row.label}</span>
            <span className={`shrink-0 font-semibold ${toneClass}`}>{sxUpcomingWindowLabel(row.window)}</span>
          </a>
        );
      })}
      <span className="shrink-0 text-[#9b9487]">全{totalCount}件</span>
    </p>
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
  const accentByTrack = new Map(management.tracks.map((track) => [track.key as string, track.accent]));
  const shortLabelByTrack = new Map(management.tracks.map((track) => [track.key as string, track.shortLabel]));

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

  // Full sorted queue (not just top3): the map needs every live stoppage so each flag hangs off
  // the node it stops; the ranked 次の経営介入 list is the first 3 of the same ordering.
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
    maxRows: 200,
  });

  const stateMap = deriveSxStateMap({
    rail,
    interventionRows: queue.rows,
    totalCount: queue.totalCount,
    topCount: 3,
  });

  const interventionDedupeKeys = new Set(
    stateMap.top.filter((row) => row.kind === "validation_run" || row.kind === "action_item").map((row) => row.key),
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

  const verdictTone = JUDGMENT_TONE[judgment.key] || JUDGMENT_TONE.unassessed;

  return (
    <section
      className="border border-[#cfc7b9] bg-[#fffdf7]"
      aria-label="PJ管制盤: 経営判定・経営状況図・次の経営介入"
      data-testid="sx-executive-control-deck"
    >
      {/* 帯1: 経営判定 — 初見の最初の1秒で読む場所。判定語を最大サイズで置く */}
      <div className="flex flex-wrap items-stretch border-b border-[#e4ddd0]" data-testid="sx-verdict-band">
        <div className={`flex items-center border-r px-4 py-2 ${verdictTone}`}>
          <span className="text-[22px] font-bold leading-none tracking-[0.06em]">{sxVerdictDisplayLabel(judgment.key)}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-1.5">
          <p className="truncate text-[11px] font-semibold leading-4 text-[#24231f]" title={primaryReason}>{primaryReason}</p>
          <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[#777166]">
            <div><dt className="inline">重大未確認 </dt><dd className={`inline font-bold ${judgment.criticalUnknownCount > 0 ? "text-[#8c3329]" : "text-[#24231f]"}`}>{judgment.criticalUnknownCount}件</dd></div>
            <div><dt className="inline">停止 </dt><dd className={`inline font-bold ${judgment.blockedCount > 0 ? "text-[#8c3329]" : "text-[#24231f]"}`}>{judgment.blockedCount}件</dd></div>
            <div><dt className="inline">充足 </dt><dd className="inline font-semibold text-[#24231f]">{judgment.completenessPct}%</dd></div>
            <div><dt className="inline">次期限 </dt><dd className="inline font-semibold text-[#24231f]">{sxFormatDate(judgment.nextDeadline)}</dd></div>
            <div className="sm:hidden"><dt className="inline">設立判断 </dt><dd className="inline font-semibold text-[#5f4a66]">{sxFormatDate(objective?.targetDate)}</dd></div>
          </dl>
        </div>
        <div className="hidden flex-col items-end justify-center gap-0.5 px-3 py-1.5 text-[10px] font-semibold text-[#5f4a66] sm:flex">
          <span className="flex items-center gap-1"><Flag className="h-3.5 w-3.5" aria-hidden="true" />設立判断 {sxFormatDate(objective?.targetDate)}</span>
          <span className="text-[9px] font-normal text-[#777166]">更新 {sxFormatDate(judgment.lastVerifiedAt)}</span>
        </div>
      </div>

      {/* 帯2: 4本柱 — 経路の状態を柱ごとに要約する信号。アクセント色が経路ノードの点の色と対応する */}
      <div className="grid grid-cols-2 border-b border-[#e4ddd0] lg:grid-cols-4" data-testid="sx-four-pillar-signal-strip">
        {management.tracks.map((track, index) => {
          const selected = selectedTrack === track.key;
          const milestone = track.milestoneId ? management.milestones.find((item) => item.id === track.milestoneId) : undefined;
          const completeness = sxTrackEvidenceCompleteness(track, milestone, management.kpis);
          const deltaLabel = sxFormatDelta(track.deltaDays, track.dateCertainty);
          const deltaTone = track.deltaDays != null && track.deltaDays > 0 ? "text-[#765022]" : "text-[#69665d]";
          return (
            <button
              key={track.key}
              type="button"
              aria-pressed={selected}
              aria-controls="selected-management-context"
              onClick={() => onSelectTrack(selected ? null : track.key)}
              className={`min-h-11 border-b border-l-[3px] px-2 py-1 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] lg:border-b-0 ${index % 2 === 0 ? "border-r" : ""} ${index < 3 ? "lg:border-r" : ""} border-r-[#e4ddd0] border-b-[#e4ddd0] ${selected ? "bg-[#e8f2eb]" : "bg-white hover:bg-[#f8f5ec]"}`}
              style={{ borderLeftColor: track.accent }}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#24231f]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: track.accent }} aria-hidden="true" />
                {track.label}
                <span className={`ml-auto shrink-0 text-[9px] font-semibold ${deltaTone}`}>{track.statusLabel} ・ {deltaLabel}</span>
              </span>
              <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[9px] text-[#514e47]">
                <span className="min-w-0 max-w-full truncate" title={track.gate}>{track.gate}</span>
                <ArrowRight className="h-2.5 w-2.5 shrink-0 text-[#9b9487]" aria-hidden="true" />
                <span className="shrink-0">次期限 {sxFormatDate(track.forecastEnd || track.plannedEnd)}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1" aria-label={`証拠充足 ${completeness.pct}%`}>
                  <span className="h-1 w-8 overflow-hidden rounded-full bg-[#e8e2d6]"><span className="block h-full rounded-full bg-[#8aa898]" style={{ width: `${completeness.pct}%` }} /></span>
                  <span className="text-[8px] font-semibold text-[#69665d]">証拠{completeness.pct}%</span>
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[9px] text-[#8c3329]" title={track.maxIssue}>詰まり: {track.maxIssue}</span>
            </button>
          );
        })}
      </div>

      {/* 帯3+帯4: デスクトップは状況図→介入、モバイルは介入→状況図の順で読む */}
      <div className="flex flex-col">
      {/* 帯3: 経営状況図 — 重要経路・現在地・遅延幅・ブロッカー・ボールを一つの図で読む */}
      <div className="order-2 border-b-0 border-[#e4ddd0] px-3 py-2 sm:px-4 lg:order-1 lg:border-b" data-testid="sx-state-map">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">経営状況図 — 重要経路と停止地点</h3>
          <p className="text-[9px] text-[#9b9487]">間隔=予測日の日数比例 ・ 縦線=予定 バー=遅延幅 ◇=予測 ・ 破線=仮日程 ・ ①②③=次の経営介入</p>
        </div>
        {!stateMap.valid ? (
          <p className="mt-2 rounded-md border border-dashed border-[#b5533f] bg-[#f9e4e1] px-2.5 py-2 text-[11px] font-semibold text-[#8c3329]" data-testid="sx-critical-path-rail">
            {stateMap.reason}
          </p>
        ) : (
          <div className="mt-1.5">
            <StateMapDesktop map={stateMap} asOf={management.asOf} accentByTrack={accentByTrack} shortLabelByTrack={shortLabelByTrack} onSelectMilestone={onSelectMilestone} />
            <StateMapVertical map={stateMap} asOf={management.asOf} accentByTrack={accentByTrack} shortLabelByTrack={shortLabelByTrack} onSelectMilestone={onSelectMilestone} />
          </div>
        )}
        {stateMap.unattached.length > 0 && (
          <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#69665d]" data-testid="sx-unattached-blockers">
            <span className="font-semibold text-[#765022]">経路ノード未接続の対応待ち</span>
            {stateMap.unattached.slice(0, 3).map((blocker) => (
              <a
                key={blocker.key}
                href={anchorHref(blocker.anchor)}
                onClick={(event) => {
                  event.preventDefault();
                  focusAnchorRow(blocker.anchor);
                }}
                className="inline-flex min-h-6 max-w-[240px] items-center gap-1 truncate underline decoration-[#d6cebf] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                title={blocker.target}
              >
                {blocker.rank != null && <RankBadge rank={blocker.rank} />}
                <span className="truncate">{blocker.target}</span>
              </a>
            ))}
            {stateMap.unattached.length > 3 && <span className="text-[#9b9487]">ほか{stateMap.unattached.length - 3}件</span>}
          </p>
        )}
      </div>

      {/* 帯4: 次の経営介入（①②③は状況図の旗と同じ番号） + 直近アクションの薄い帯 */}
      <div className="order-1 border-b border-[#e4ddd0] px-3 py-2 sm:px-4 lg:order-2 lg:border-b-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">次の経営介入（優先順）</h3>
          <span className="text-[10px] text-[#777166]">全{stateMap.totalCount}件中 上位{stateMap.top.length}件</span>
        </div>
        {stateMap.top.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-[#69665d]" data-testid="sx-intervention-queue">対応待ちの重要経路案件は検出なし。</p>
        ) : (
          <>
            <div className="mt-1 hidden xl:block" data-testid="sx-intervention-queue">
              <p className="grid grid-cols-[20px_minmax(0,1.5fr)_minmax(0,1fr)_96px_minmax(0,1fr)] gap-x-2 border-b border-[#e4ddd0] pb-0.5 text-[9px] font-semibold text-[#777166]">
                <span aria-hidden="true" />
                <span>対象</span>
                <span>ボール / 担当</span>
                <span>期限</span>
                <span>止まるゲート</span>
              </p>
              <ol>
                {stateMap.top.map((row) => (
                  <InterventionRowDesktop key={row.key} row={row} onSelectMilestone={onSelectMilestone} />
                ))}
              </ol>
            </div>
            <ul className="mt-1 xl:hidden" data-testid="sx-intervention-queue-mobile">
              {stateMap.top.map((row) => (
                <InterventionRowMobile key={row.key} row={row} onSelectMilestone={onSelectMilestone} />
              ))}
            </ul>
          </>
        )}
        <div className="mt-1 border-t border-[#f1eee5] pt-1">
          <UpcomingStrip rows={upcoming.rows} totalCount={upcoming.totalCount} />
        </div>
      </div>
      </div>
    </section>
  );
}
