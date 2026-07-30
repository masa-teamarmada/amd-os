"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Plus, X } from "lucide-react";
import type {
  SxActorSide,
  SxManagementBundle,
  SxManagementPartner,
  SxPartnerInteraction,
  SxPartnerRoleKind,
  SxPartnerStage,
} from "@/lib/sx-management";
import { SX_PROOF_DEFINITIONS, SX_PROOF_THEME_SLUGS, SX_THEME_PROOF_MAP, type SxProofThemeSlug } from "@/lib/sx-proof-mapping";
import { nominalizeSxActionLabel, nominalizeSxNextActionLabel } from "@/lib/sx-action-label";
import { sxNormalizePublicName } from "@/lib/sx-name-normalize";
import {
  sxIsPocPartner,
} from "@/lib/sx-poc-candidates";
import {
  SX_PARTNER_STAGE_ORDER,
  sxCompactBallSideLabel,
  sxCompactPartnerRowText,
  sxComparePartnersForPoc,
  sxPartnerAttention,
  sxPartnerHasDataGap,
  sxPartnerHasContactRecord,
  sxPartnerHasDueSoon,
  sxPartnerHasOverdue,
  sxPartnerIsOnHold,
  sxPartnerNeedsRefresh,
  sxPartnerStageIndex,
  sxPartnerStageLabel,
  type SxPocComparisonSort,
  type SxPartnerAttention,
} from "@/lib/sx-partner-progress";
import {
  SxBadge,
  sxAllHoldingsForPartnerAudit,
  sxBallSideLabel,
  sxComputeControlBandCounts,
  sxConfidenceLabel,
  sxFormatDate,
  sxFormatDueDateWithPrecision,
  sxFormatEventDateWithPrecision,
  sxGroupPartnersByPrimaryClassification,
  sxHoldingsForPartner,
  sxInteractionKindLabel,
  sxIsHoldingMonthPrecision,
  sxIsHoldingOverdue,
  sxIsPartnerEnded,
  sxLatestInteraction,
  sxPartnerDisplay,
  sxPartnerHasBlockedHolding,
  sxPartnerRoleKindLabel,
  sxPrimaryRoleKindCounts,
  sxRelationshipStateLabel,
  sxRoleDisplayLabel,
  sxSortHoldingsByPriority,
  sxSortInteractionsByRecency,
  sxSourceKindLabel,
  sxSourceRefDisplayLabel,
  type SxControlBandCounts,
  type SxHoldingItem,
} from "./sx-visual-shared";

type PartnerProgressStep = {
  stage: (typeof SX_PARTNER_STAGE_ORDER)[number];
  phase: "done" | "now" | "next";
  label: string;
};

/**
 * 会社名下のrailと「関係段階」列が同じ7件・同じ順序を使うための唯一のstep builder。
 * 接点数や作業数を進捗へ混ぜず、全関係先を同じ分母で比較する。
 */
function buildPartnerProgressSteps(partner: SxManagementPartner): PartnerProgressStep[] {
  const currentIndex = sxPartnerIsOnHold(partner) ? null : sxPartnerStageIndex(partner.relationshipStage);
  return SX_PARTNER_STAGE_ORDER.map((stage, index) => ({
    stage,
    phase: currentIndex != null && index + 1 < currentIndex ? "done" : currentIndex === index + 1 ? "now" : "next",
    label: sxPartnerStageLabel(stage),
  }));
}

/** 進行状況と同じstepsを、会社名下の省スペースなrailとして表示する。 */
function PartnerStageRail({ partnerId, stage, steps, deferred = false }: { partnerId: string; stage: string; steps: readonly PartnerProgressStep[]; deferred?: boolean }) {
  const onHold = stage === "on_hold" || deferred;
  const stageIndex = onHold ? null : sxPartnerStageIndex(stage as SxPartnerStage);
  return (
    <div
      role="img"
      aria-label={onHold ? "関係段階 保留" : `関係段階 ${stageIndex}/7・${sxPartnerStageLabel(stage as SxPartnerStage)}`}
      data-testid={`sx-partner-stage-rail-${partnerId}`}
      data-step-count={steps.length}
      data-stage-index={stageIndex ?? "on_hold"}
    >
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {steps.map((step) => (
          <span
            key={step.stage}
            data-progress-segment={step.phase}
            className={`h-1.5 flex-1 rounded-full ${
              onHold
                ? "bg-[#d6cebf]"
                : step.phase === "now"
                  ? "bg-[#38745d]"
                  : step.phase === "done"
                    ? "bg-[#9fc6b4]"
                    : "bg-[#e8e2d6]"
            }`}
          />
        ))}
      </div>
      <p className={`mt-0.5 text-[10px] font-semibold ${onHold ? "text-[#69665d]" : "text-[#315f7d]"}`}>
        {onHold ? "保留" : `${stageIndex}/7 ${sxPartnerStageLabel(stage as SxPartnerStage)}`}
      </p>
    </div>
  );
}

const BALL_SIDE_TONE: Record<string, string> = {
  sx: "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]",
  partner: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  shared: "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]",
  none: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  unknown: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
};

const HOLDING_STATUS_TONE: Record<string, string> = {
  open: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  in_progress: "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]",
  waiting: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  blocked: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  on_hold: "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]",
  completed: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  cancelled: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
};

/** Left status-line color per holding status — replaces the old rounded-card look with a dense,
 * shared-ruled row + left status line (spec C: 保有事項は角丸カードをやめ、共有罫線/左ステータス線の高密度行にする). */
const HOLDING_STATUS_LINE: Record<string, string> = {
  open: "#cbbfa0", in_progress: "#7ea0b7", waiting: "#dcb45a", blocked: "#b5533f",
  on_hold: "#a08bb0", completed: "#57a884", cancelled: "#c9c2b3",
};

const HOLDING_STATUS_LABEL: Record<string, string> = {
  open: "未着手", in_progress: "進行中", waiting: "待ち", blocked: "停止", on_hold: "保留", completed: "完了", cancelled: "取消",
  // commitment statuses reused verbatim by sxHoldingsForPartner() on the same field
};

const INTERACTION_KIND_TONE: Record<string, string> = {
  meeting: "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]",
  email: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  agreement: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  deliverable: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  handoff: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  status_update: "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]",
  note: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
};

const FOCUS_RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]";

function isDueUnset(partner: SxManagementPartner) {
  return partner.dueDate == null || partner.dueDatePrecision === "unknown";
}

function milestoneTitlesForPartner(partner: SxManagementPartner, milestoneTitleBySlug: ReadonlyMap<string, string>): string[] {
  return partner.relatedMilestoneSlugs.map((slug) => milestoneTitleBySlug.get(slug)).filter((title): title is string => Boolean(title));
}

/** Which of the three onsite-PoC proofs this partner's related gates connect to, via the sx-proof-mapping.ts
 * source of truth. Never guessed — a partner with no theme-gate connection returns []. */
function proofLabelsForPartner(partner: SxManagementPartner): string[] {
  const themeSlugs = partner.relatedMilestoneSlugs.filter((slug): slug is SxProofThemeSlug =>
    (SX_PROOF_THEME_SLUGS as readonly string[]).includes(slug),
  );
  if (themeSlugs.length === 0) return [];
  const proofIds = new Set(themeSlugs.flatMap((slug) => SX_THEME_PROOF_MAP[slug]));
  return SX_PROOF_DEFINITIONS.filter((definition) => proofIds.has(definition.id)).map((definition) => definition.label);
}

/** Per-item gate name + (when resolvable) proof names, via relatedMilestoneId. A holding item with no
 * connected gate always reports "ゲート未接続" — never guessed from the partner's aggregate gates. */
function gateAndProofForItem(
  item: SxHoldingItem,
  milestoneTitleById: ReadonlyMap<string, string>,
  milestoneSlugById: ReadonlyMap<string, string>,
): { gateTitle: string | null; proofLabels: string[] } {
  if (!item.relatedMilestoneId) return { gateTitle: null, proofLabels: [] };
  const gateTitle = milestoneTitleById.get(item.relatedMilestoneId) || null;
  const slug = milestoneSlugById.get(item.relatedMilestoneId);
  const proofLabels = slug && (SX_PROOF_THEME_SLUGS as readonly string[]).includes(slug)
    ? SX_PROOF_DEFINITIONS.filter((definition) => SX_THEME_PROOF_MAP[slug as SxProofThemeSlug].includes(definition.id)).map((definition) => definition.label)
    : [];
  return { gateTitle, proofLabels };
}

function navChipClass(active: boolean) {
  return `inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[10px] font-semibold ${FOCUS_RING} ${
    active ? "border-[#315f7d] bg-[#eef3f5] text-[#315f7d]" : "border-[#d6cebf] bg-white text-[#514e47] hover:bg-[#f8f5ec]"
  }`;
}

/** Right-edge affordance + keyboard focusability for a horizontally-scrollable row (spec P1: 横scroll
 * 手掛かり＝a11y). A CSS content-fade used to dim the trailing content itself — including whatever
 * metric a user would scroll toward, cutting its contrast right when it matters most — so it never
 * touches content opacity/contrast; scrollability is instead signalled by a small non-fading
 * aria-hidden arrow (see ScrollHintArrow) plus a visible focus ring, and enough right padding (pr-5)
 * that the trailing item never sits flush against the edge (2026-07-24 fix). sm+ drops the padding
 * because ControlBandRow/CategoryNav switch to flex-wrap there and no longer scroll. tabIndex=0 makes
 * the region reachable by keyboard, not just pointer/trackpad. */
const ALWAYS_SCROLL_HINT_CLASS = `pr-5 ${FOCUS_RING}`;
// ControlBandRow/CategoryNav switch to flex-wrap (no scrolling) at sm+, so their padding must cancel
// there too; InteractionTimeline's aggregate strip never wraps at any breakpoint (spec: mobile折返し
// 禁止) and keeps ALWAYS_SCROLL_HINT_CLASS (with its own always-visible ScrollHintArrow) instead.
const SCROLL_HINT_CLASS = `${ALWAYS_SCROLL_HINT_CLASS} sm:pr-0`;

/** Small non-fading affordance marking a row as horizontally scrollable — replaces the old CSS
 * content-fade, which visually dimmed the very content a user would scroll toward instead of just
 * hinting at it (2026-07-24 fix: 末尾情報のcontrastを落とさない). aria-hidden since the scrollable region itself
 * already carries the real role="group"/aria-label; this is a decorative hint only, and never
 * intercepts pointer events (pointer-events-none) so it can sit over the scrollable region's edge.
 * `always` keeps the hint visible past sm+ for rows that never switch to flex-wrap (InteractionTimeline's
 * aggregate strip); the ControlBandRow/CategoryNav hint hides there instead, matching SCROLL_HINT_CLASS. */
function ScrollHintArrow({ always }: { always?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pl-1 text-[11px] font-semibold text-[#69665d] ${always ? "" : "sm:hidden"}`}
    >
      ▸
    </span>
  );
}

/** One horizontal group of the control band, mobile: single-row overflow-x-auto (spec P1: mobile各1行
 * 横スクロール) — never wraps to a second line on narrow screens. sm+: wraps freely. */
function ControlBandRow({ heading, ariaLabel, children, className = "", nowrap = false }: { heading: string; ariaLabel: string; children: ReactNode; className?: string; nowrap?: boolean }) {
  return (
    <div className={`flex items-center gap-2 border-b border-[#e4ddd0] px-3 py-1.5 last:border-b-0 ${className}`}>
      <span className="w-9 shrink-0 text-[10px] font-semibold tracking-[0.08em] text-[#69665d]">{heading}</span>
      <div className="relative min-w-0 flex-1">
        <div
          tabIndex={0}
          className={`flex gap-1.5 ${nowrap ? `flex-nowrap overflow-x-auto ${ALWAYS_SCROLL_HINT_CLASS}` : `flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible ${SCROLL_HINT_CLASS}`}`}
          role="group"
          aria-label={ariaLabel}
        >
          {children}
        </div>
        <ScrollHintArrow always={nowrap} />
      </div>
    </div>
  );
}

const NEUTRAL_TONE = "border-[#d6cebf] bg-white text-[#514e47]";
const FLAG_TONE = "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]";
const ALERT_TONE = "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]";
const WARN_TONE = "border-[#e3c994] bg-[#fbf1dc] text-[#765022]";
const ATTENTION_TONE: Record<SxPartnerAttention["key"], string> = {
  blocked: ALERT_TONE,
  overdue: ALERT_TONE,
  due_soon: WARN_TONE,
  stale: WARN_TONE,
  unknown: FLAG_TONE,
  due_unset: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  clear: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  on_hold: FLAG_TONE,
};

/** Control band — split into 3 groups (spec P1: 緊急→ボール→母数の順、2026-07-24 P0で緊急を先頭へ
 * 並び替え。まず読むべき情報＝緊急度を最初に置く): 緊急 (urgency — blocked/overdue/due-soon/月精度/
 * 期限未設定/担当未確認, active partners only), ボール (who currently holds what, active partners
 * only), 母数 (partner-quality metrics — 全関係先/対応中/保留/終了/未分類/空レーンあり/登録率 — always
 * include deferred/on_hold/ended partners, never silently dropped from "全関係先"). 空レーンあり
 * (unorganizedPartners) はOR条件（当方/先方いずれか一方でも0件なら該当）なので「台帳0件先」という
 * AND寄りの表現は使わない。登録率とあわせて「レーンが空＝未整理と確定」という嘘をつかない表現
 * （reviewed flagが無いデータなので、未整理か確認済み0件かは区別できない、spec P0-10）。 */
function ControlBand({
  counts,
  totalPartners,
  pocPartnerCount,
}: {
  counts: SxControlBandCounts;
  totalPartners: number;
  pocPartnerCount: number;
}) {
  return (
    <div role="group" aria-label="関係先の一本化された管制帯">
      <ControlBandRow heading="緊急" ariaLabel="緊急度の指標">
        <SxBadge tone={counts.blockedHoldings > 0 ? ALERT_TONE : NEUTRAL_TONE}>停止 {counts.blockedHoldings}件</SxBadge>
        <SxBadge tone={counts.overdue > 0 ? ALERT_TONE : NEUTRAL_TONE}>期限超過 {counts.overdue}件</SxBadge>
        <SxBadge tone={counts.dueSoon > 0 ? WARN_TONE : NEUTRAL_TONE}>7日以内 {counts.dueSoon}件</SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>月精度期限 {counts.dueMonthPrecision}件</SxBadge>
        <SxBadge tone={counts.dueUnset > 0 ? WARN_TONE : NEUTRAL_TONE}>期限未設定 {counts.dueUnset}件</SxBadge>
        <SxBadge tone={counts.ownerUnconfirmed > 0 ? FLAG_TONE : NEUTRAL_TONE}>担当未確認 {counts.ownerUnconfirmed}件</SxBadge>
      </ControlBandRow>
      <ControlBandRow heading="ボール" ariaLabel="保有側の指標">
        <SxBadge tone={NEUTRAL_TONE}>未完了事項 {counts.totalHoldings}件</SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.sx}>当方保有 {counts.sxHeld}件</SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.partner}>先方保有 {counts.partnerHeld}件</SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.shared}>共同 {counts.sharedHeld}件</SxBadge>
        <SxBadge tone={FLAG_TONE}>双方保有先 {counts.bothSidesHeldPartners}件</SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.unknown}>保有側未確認 {counts.sideUnknown}件</SxBadge>
      </ControlBandRow>
      <ControlBandRow heading="母数" ariaLabel="関係先の母数指標">
        <SxBadge tone={NEUTRAL_TONE}>全関係先 {totalPartners}件</SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>対応中 {counts.activePartners}件</SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>PoC先 {pocPartnerCount}件</SxBadge>
        <SxBadge tone={FLAG_TONE}>保留 {counts.deferredPartners}件</SxBadge>
        <SxBadge tone={FLAG_TONE}>終了 {counts.endedPartners}件</SxBadge>
        <SxBadge tone={counts.unclassifiedPartners > 0 ? FLAG_TONE : NEUTRAL_TONE}>未分類 {counts.unclassifiedPartners}件</SxBadge>
        <SxBadge tone={counts.unorganizedPartners > 0 ? FLAG_TONE : NEUTRAL_TONE}>空レーンあり {counts.unorganizedPartners}件</SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>登録率 {counts.organizedCoveragePct}%（対応中{counts.activePartners}先中）</SxBadge>
      </ControlBandRow>
    </div>
  );
}

/** PoCは同じ台帳を絞る表示属性。通常表示では役割分類を使い、PoC比較中は役割を隠して
 * 共通7段階へ主軸を切り替える。role未登録を進捗未分類と誤読させない。 */
function CategoryNav({
  counts,
  totalCount,
  pocCount,
  activeKind,
  pocOnly,
  onClear,
  onSelect,
  onSelectPoc,
  showRoleFilter,
}: {
  counts: Partial<Record<SxPartnerRoleKind, number>>;
  totalCount: number;
  pocCount: number;
  activeKind: SxPartnerRoleKind | null;
  pocOnly: boolean;
  onClear: () => void;
  onSelect: (kind: SxPartnerRoleKind | null) => void;
  onSelectPoc: () => void;
  showRoleFilter: boolean;
}) {
  const entries = (Object.keys(counts) as SxPartnerRoleKind[]).filter((kind) => (counts[kind] || 0) > 0).sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  if (entries.length === 0 && pocCount === 0) return null;
  const allActive = activeKind === null && !pocOnly;
  return (
    <div className="border-b border-[#e4ddd0] bg-[#fffdf7]" role="group" aria-label="関係先の絞り込み">
      <ControlBandRow heading="表示" ariaLabel="表示対象の絞り込み">
        <button type="button" onClick={onClear} aria-pressed={allActive} aria-label={`絞り込みを解除して全関係先${totalCount}件を表示`} className={navChipClass(allActive)}>
          {allActive && <span aria-hidden="true">✓</span>}全関係先 {totalCount}件
        </button>
        {pocCount > 0 && (
          <button
            type="button"
            data-testid="sx-partner-filter-poc"
            onClick={onSelectPoc}
            aria-pressed={pocOnly}
            aria-label={`PoC先だけを表示（${pocCount}件）`}
            className={navChipClass(pocOnly)}
          >
            {pocOnly && <span aria-hidden="true">✓</span>}PoC先 {pocCount}件
          </button>
        )}
      </ControlBandRow>
      {showRoleFilter && entries.length > 0 && (
        <ControlBandRow heading="役割" ariaLabel="役割による絞り込み">
          {entries.map((kind) => (
            <button key={kind} type="button" onClick={() => onSelect(activeKind === kind ? null : kind)} aria-pressed={activeKind === kind} aria-label={`${sxPartnerRoleKindLabel(kind)}で絞り込み（${counts[kind]}件）`} className={navChipClass(activeKind === kind)}>
              {activeKind === kind && <span aria-hidden="true">✓</span>}{sxPartnerRoleKindLabel(kind)} {counts[kind]}件
            </button>
          ))}
        </ControlBandRow>
      )}
    </div>
  );
}

type SxPocQuickFilter = "all" | "blocked" | "overdue" | "due_soon" | "stale" | "data_gap" | "sx_ball";

function pocMatchesQuickFilter(partner: SxManagementPartner, today: string, filter: SxPocQuickFilter): boolean {
  if (filter === "all") return true;
  if (filter === "sx_ball") return partner.currentBallSide === "sx";
  if (filter === "blocked") return sxPartnerHasBlockedHolding(partner);
  if (filter === "overdue") return sxPartnerHasOverdue(partner, today);
  if (filter === "due_soon") return sxPartnerHasDueSoon(partner, today);
  if (filter === "stale") return sxPartnerNeedsRefresh(partner, today);
  return sxPartnerHasDataGap(partner);
}

function PocComparisonControls({
  partners,
  attentionScopePartners,
  visiblePartners,
  today,
  activeStage,
  sort,
  activeQuickFilter,
  onSelectStage,
  onSelectSort,
  onSelectQuickFilter,
}: {
  partners: SxManagementPartner[];
  attentionScopePartners: SxManagementPartner[];
  visiblePartners: SxManagementPartner[];
  today: string;
  activeStage: SxPartnerStage | "all";
  sort: SxPocComparisonSort;
  activeQuickFilter: SxPocQuickFilter;
  onSelectStage: (stage: SxPartnerStage | "all") => void;
  onSelectSort: (sort: SxPocComparisonSort) => void;
  onSelectQuickFilter: (filter: SxPocQuickFilter) => void;
}) {
  const stageCounts = new Map<SxPartnerStage, number>();
  for (const partner of partners) {
    const stage = sxPartnerIsOnHold(partner) ? "on_hold" : partner.relationshipStage;
    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);
  }
  const quickCount = (filter: SxPocQuickFilter) => attentionScopePartners.filter((partner) => pocMatchesQuickFilter(partner, today, filter)).length;
  const blockedCount = quickCount("blocked");
  const overdueCount = quickCount("overdue");
  const dueSoonCount = quickCount("due_soon");
  const staleCount = quickCount("stale");
  const sxBallCount = quickCount("sx_ball");
  const dataGapCount = quickCount("data_gap");
  const contactRecordCount = visiblePartners.filter(sxPartnerHasContactRecord).length;
  const quickFilterButton = (filter: SxPocQuickFilter, label: string, count: number, tone: string) => (
    <button
      type="button"
      onClick={() => onSelectQuickFilter(activeQuickFilter === filter ? "all" : filter)}
      disabled={count === 0}
      aria-pressed={activeQuickFilter === filter}
      aria-label={`${label}${count}件で絞り込み`}
      className={`shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
    >
      <SxBadge tone={tone}>{activeQuickFilter === filter && <span aria-hidden="true">✓ </span>}{label} {count}</SxBadge>
    </button>
  );
  return (
    <>
      <div data-testid="sx-poc-comparison-controls" className="border-b border-[#e4ddd0] bg-[#f5f1e8]">
      <ControlBandRow heading="段階" ariaLabel="PoC先の関係段階で絞り込み">
        <button type="button" onClick={() => onSelectStage("all")} aria-pressed={activeStage === "all"} className={navChipClass(activeStage === "all")}>
          {activeStage === "all" && <span aria-hidden="true">✓</span>}全段階 {partners.length}件
        </button>
        {SX_PARTNER_STAGE_ORDER.map((stage, index) => {
          const count = stageCounts.get(stage) || 0;
          return (
            <button
              key={stage}
              type="button"
              data-testid={`sx-poc-stage-filter-${stage}`}
              onClick={() => onSelectStage(activeStage === stage ? "all" : stage)}
              disabled={count === 0}
              aria-pressed={activeStage === stage}
              className={`${navChipClass(activeStage === stage)} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {activeStage === stage && <span aria-hidden="true">✓</span>}{index + 1}. {sxPartnerStageLabel(stage)} {count}件
            </button>
          );
        })}
        {(stageCounts.get("on_hold") || 0) > 0 && (
          <button type="button" onClick={() => onSelectStage(activeStage === "on_hold" ? "all" : "on_hold")} aria-pressed={activeStage === "on_hold"} className={navChipClass(activeStage === "on_hold")}>
            {activeStage === "on_hold" && <span aria-hidden="true">✓</span>}保留 {stageCounts.get("on_hold")}件
          </button>
        )}
      </ControlBandRow>
      </div>
      <ControlBandRow heading="並び" ariaLabel="PoC先の並び順と要対応先の絞り込み" nowrap className="sticky top-0 z-30 h-14 bg-[#f5f1e8] py-0 shadow-[0_1px_0_#d6cebf]">
        <button type="button" data-testid="sx-poc-sort-progress" onClick={() => onSelectSort("progress")} aria-pressed={sort === "progress"} className={navChipClass(sort === "progress")}>
          {sort === "progress" && <span aria-hidden="true">✓</span>}関係段階順
        </button>
        <button type="button" data-testid="sx-poc-sort-attention" onClick={() => onSelectSort("attention")} aria-pressed={sort === "attention"} className={navChipClass(sort === "attention")}>
          {sort === "attention" && <span aria-hidden="true">✓</span>}要対応順
        </button>
        <SxBadge tone={NEUTRAL_TONE}>表示 {visiblePartners.length} / 全PoC {partners.length}</SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>接点記録あり {contactRecordCount}</SxBadge>
        {quickFilterButton("blocked", "停止", blockedCount, blockedCount > 0 ? ALERT_TONE : NEUTRAL_TONE)}
        {quickFilterButton("overdue", "期限超過", overdueCount, overdueCount > 0 ? ALERT_TONE : NEUTRAL_TONE)}
        {quickFilterButton("due_soon", "7日以内", dueSoonCount, dueSoonCount > 0 ? WARN_TONE : NEUTRAL_TONE)}
        {quickFilterButton("stale", "情報更新要", staleCount, staleCount > 0 ? WARN_TONE : NEUTRAL_TONE)}
        {quickFilterButton("sx_ball", "当方ボール", sxBallCount, sxBallCount > 0 ? WARN_TONE : NEUTRAL_TONE)}
        {quickFilterButton("data_gap", "判定材料不足", dataGapCount, dataGapCount > 0 ? FLAG_TONE : NEUTRAL_TONE)}
      </ControlBandRow>
    </>
  );
}

const HOLDING_SIDE_BADGE_LABEL: Record<string, string> = { sx: "当方", partner: "先方", shared: "共同", unknown: "保有側未確認" };

/** Renders one holding row. Used both for the open-only lane preview (showSideBadge limited to
 * shared/unknown, matching the lane's own sx/partner column) and the always-visible full audit list
 * (showSideBadge=item.side for every side, canManage+onEdit for the edit affordance) — spec P0/P1:
 * work item detail is readable regardless of role, detail/完了条件/完了日/証拠/受領者/受領日 all show
 * when present, and the edit button (44px) is the only canManage-gated affordance. */
function HoldingRow({
  item,
  partnerName,
  today,
  milestoneTitleById,
  milestoneSlugById,
  showSideBadge,
  canManage,
  onEdit,
}: {
  item: SxHoldingItem;
  partnerName: string;
  today: string;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  showSideBadge?: "sx" | "partner" | "shared" | "unknown";
  canManage?: boolean;
  onEdit?: (workItemId: string) => void;
}) {
  const overdue = sxIsHoldingOverdue(item, today);
  const monthPrecision = sxIsHoldingMonthPrecision(item);
  const { gateTitle, proofLabels } = gateAndProofForItem(item, milestoneTitleById, milestoneSlugById);
  return (
    <li
      className="border-b border-[#eee9df] py-1.5 pl-2 last:border-0"
      style={{ borderLeft: `3px solid ${HOLDING_STATUS_LINE[item.status] || HOLDING_STATUS_LINE.open}` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <SxBadge tone="border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]">{item.itemKindLabel}</SxBadge>
          <SxBadge tone={HOLDING_STATUS_TONE[item.status] || HOLDING_STATUS_TONE.open}>{HOLDING_STATUS_LABEL[item.status] || "未確認"}</SxBadge>
          {showSideBadge && (
            <SxBadge tone={BALL_SIDE_TONE[showSideBadge]}>{HOLDING_SIDE_BADGE_LABEL[showSideBadge]}</SxBadge>
          )}
          {monthPrecision && <SxBadge tone="border-[#d6cebf] bg-white text-[#69665d]">月精度</SxBadge>}
        </div>
        {canManage && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(item.id)}
            aria-label={`${partnerName} - ${sxNormalizePublicName(item.title)}を編集`}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#cfc7b9] text-[#514e47] hover:bg-[#fffdf7] ${FOCUS_RING}`}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] font-semibold leading-4 text-[#24231f]">{nominalizeSxActionLabel(sxNormalizePublicName(item.title))}</p>
      {item.detail && <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">{sxNormalizePublicName(item.detail)}</p>}
      <p className={`mt-0.5 text-[10px] ${overdue ? "font-semibold text-[#8c3329]" : "text-[#69665d]"}`}>
        担当 {item.ownerLabel ? sxNormalizePublicName(item.ownerLabel) : "担当未確認"} ・ {sxFormatDueDateWithPrecision(item.dueDate, item.dueDatePrecision)}
      </p>
      {/* sourceEvidence (一次根拠 — a commitment's primary backing, present regardless of status) and
          completionEvidence (完了の証拠 — proof a work item is actually done) are separate claims and
          must never be merged into one line (2026-07-24 P1 fix: an open commitment's 一次根拠 used to
          render mislabeled as "完了の証拠" even before anything was completed). */}
      {item.sourceEvidence && <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">一次根拠: {sxNormalizePublicName(item.sourceEvidence)}</p>}
      {item.completionCriteria && <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">完了条件: {sxNormalizePublicName(item.completionCriteria)}</p>}
      {item.completedOn && <p className="mt-0.5 text-[10px] leading-4 text-[#205f49]">完了日: {sxFormatDate(item.completedOn)}</p>}
      {item.completionEvidence && <p className="mt-0.5 text-[10px] leading-4 text-[#205f49]">完了の証拠: {sxNormalizePublicName(item.completionEvidence)}</p>}
      {item.acceptedBy && <p className="mt-0.5 text-[10px] leading-4 text-[#205f49]">受領者: {sxNormalizePublicName(item.acceptedBy)}{item.acceptedOn ? ` ・ 受領日 ${sxFormatDate(item.acceptedOn)}` : ""}</p>}
      <p className="mt-0.5 text-[10px] leading-4 text-[#69665d]">
        関連ゲート: {gateTitle || "ゲート未接続"}
        {proofLabels.length > 0 && <span className="text-[#315f7d]"> ・ 証明: {proofLabels.join(" / ")}</span>}
      </p>
      {/* 出典/最終確認/確度 — read-only provenance audit trail for every viewer, not just canManage
          (spec: 全件監査表示で「出典」「最終確認」「確度」を見える化). sourceRef is never rendered
          verbatim — sxSourceRefDisplayLabel masks raw URLs/internal tracking-key shapes first. */}
      <p className="mt-0.5 text-[10px] leading-4 text-[#69665d]">
        出典: {sxSourceKindLabel(item.sourceKind)}
        {sxSourceRefDisplayLabel(item.sourceRef) ? ` (${sxSourceRefDisplayLabel(item.sourceRef)})` : ""}
        {" ・ "}最終確認 {sxFormatDate(item.lastVerifiedAt)}
        {" ・ "}確度 {sxConfidenceLabel(item.confidence)}
      </p>
      <span className="sr-only">{partnerName}の保有事項</span>
    </li>
  );
}

/** Dedicated ball-control cell — shows only who currently holds the ball, never a next-handoff
 * target (spec: 次の受け渡し先フィールドを撤去、現在ボールのみ表示). Used as the compact
 * middle-lane cell below xl, and, combined with the due date, inside BallAndDueCell at xl. */
function compactBallOwnerText(partner: SxManagementPartner, partnerName: string): string | null {
  if (partner.currentBallSide === "none") return null;
  return partner.currentBallOwner
    ? sxCompactPartnerRowText(sxNormalizePublicName(partner.currentBallOwner), partnerName)
    : "担当未確認";
}

function BallCell({ partner }: { partner: SxManagementPartner }) {
  const owner = compactBallOwnerText(partner, sxPartnerDisplay(partner).name);
  return (
    <div className="min-w-0 text-center">
      <SxBadge tone={BALL_SIDE_TONE[partner.currentBallSide]}>{sxCompactBallSideLabel(partner.currentBallSide)}</SxBadge>
      {owner && <p className="mt-0.5 truncate text-[10px] text-[#514e47]" title={owner}>{owner}</p>}
    </div>
  );
}

/** 現在ボール・期限 — ball control combined with the earliest holding due date (falling back to the
 * partner-level due date), as its own labeled block distinct from 次の一手/目標状態 (spec 3/5: 次の
 * 一手と目標状態を単一セルへ混在させない、現在ボール/期限は独立列・独立ブロック). */
function BallAndDueCell({ partner, earliestHoldingDue }: { partner: SxManagementPartner; earliestHoldingDue: SxHoldingItem | null }) {
  return (
    <div className="min-w-0">
      <BallCell partner={partner} />
      <p className={`mt-1 text-center ${isDueUnset(partner) && earliestHoldingDue == null ? "font-semibold text-[#8c3329]" : "text-[10px] text-[#514e47]"}`}>
        {earliestHoldingDue ? sxFormatDueDateWithPrecision(earliestHoldingDue.dueDate, earliestHoldingDue.dueDatePrecision) : sxFormatDueDateWithPrecision(partner.dueDate, partner.dueDatePrecision)}
      </p>
    </div>
  );
}

const POC_COMPARISON_INNER_GRID = "xl:grid-cols-[150px_minmax(180px,1.2fr)_100px_105px_minmax(140px,1fr)_minmax(150px,1fr)]";
const POC_COMPARISON_HEADER_GRID = "xl:grid-cols-[150px_minmax(180px,1.2fr)_100px_105px_minmax(140px,1fr)_minmax(150px,1fr)_44px]";

function pocBallOwnerText(partner: SxManagementPartner, partnerName: string): string {
  const side = sxCompactBallSideLabel(partner.currentBallSide);
  const owner = compactBallOwnerText(partner, partnerName);
  if (!owner) return side;
  return owner === side ? side : `${side}｜${owner}`;
}

function PocComparisonDetailModal({
  partner,
  canManage,
  today,
  milestoneTitleById,
  milestoneSlugById,
  onClose,
  onEditPartner,
  onAddInteraction,
  onEditInteraction,
  onAddWorkItem,
  onEditWorkItem,
  onAddRole,
  onEditRole,
}: {
  partner: SxManagementPartner;
  canManage: boolean;
  today: string;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  onClose: () => void;
  onEditPartner?: (partnerId: string) => void;
  onAddInteraction?: (partnerId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
  onAddWorkItem?: (partnerId: string, side: SxActorSide) => void;
  onEditWorkItem?: (workItemId: string) => void;
  onAddRole?: (partnerId: string) => void;
  onEditRole?: (roleId: string) => void;
}) {
  const display = sxPartnerDisplay(partner);
  const titleId = `sx-poc-detail-title-${partner.id}`;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-[#24231f]/35 p-0 sm:place-items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-xl border border-[#d6cebf] bg-[#fffdf7] shadow-2xl sm:max-w-4xl sm:rounded-xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#e4ddd0] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">PoC先の詳細</p>
            <h4 id={titleId} className="truncate text-base font-semibold text-[#24231f]">{display.name}</h4>
          </div>
          <button type="button" onClick={onClose} aria-label={`${display.name}の詳細を閉じる`} className={`grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#cfc7b9] text-[#514e47] hover:bg-[#f8f5ec] ${FOCUS_RING}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {canManage && (
            <div className="mb-3 flex flex-wrap gap-2">
              {onEditPartner && <button type="button" onClick={() => onEditPartner(partner.id)} className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-3 text-[11px] font-semibold ${FOCUS_RING}`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />関係先を編集</button>}
              {onAddRole && <button type="button" onClick={() => onAddRole(partner.id)} className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-3 text-[11px] font-semibold ${FOCUS_RING}`}><Plus className="h-3.5 w-3.5" aria-hidden="true" />分類を追加</button>}
            </div>
          )}
          <InteractionTimeline partner={partner} canManage={canManage} onAddInteraction={onAddInteraction} onEditInteraction={onEditInteraction} />
          {canManage && onAddWorkItem && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label={`${display.name}の保有事項を追加`}>
              {(["sx", "partner", "shared", "unknown"] as const).map((side) => (
                <button key={side} type="button" onClick={() => onAddWorkItem(partner.id, side)} className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-3 text-[10px] font-semibold ${FOCUS_RING}`}>
                  <Plus className="h-3 w-3" aria-hidden="true" />{side === "sx" ? "当方" : side === "partner" ? "先方" : side === "shared" ? "双方" : "担当未確認"}の保有事項
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 border-t border-[#e4ddd0] pt-4">
            <PartnerLedgerDetails
              partner={partner}
              canManage={canManage}
              today={today}
              milestoneTitleById={milestoneTitleById}
              milestoneSlugById={milestoneSlugById}
              onEditWorkItem={onEditWorkItem}
              onEditRole={onEditRole}
              onEditInteraction={onEditInteraction}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function PocComparisonRow({
  partner,
  milestoneTitleById,
  milestoneSlugById,
  canManage,
  today,
  expanded,
  onToggleExpand,
  onEditPartner,
  onAddInteraction,
  onEditInteraction,
  onAddWorkItem,
  onEditWorkItem,
  onAddRole,
  onEditRole,
}: {
  partner: SxManagementPartner;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  canManage: boolean;
  today: string;
  expanded: boolean;
  onToggleExpand: (partnerId: string) => void;
  onEditPartner?: (partnerId: string) => void;
  onAddInteraction?: (partnerId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
  onAddWorkItem?: (partnerId: string, side: SxActorSide) => void;
  onEditWorkItem?: (workItemId: string) => void;
  onAddRole?: (partnerId: string) => void;
  onEditRole?: (roleId: string) => void;
}) {
  const display = sxPartnerDisplay(partner);
  const steps = buildPartnerProgressSteps(partner);
  const attention = sxPartnerAttention(partner, today);
  const latest = sxLatestInteraction(partner.interactions);
  const holdings = sxHoldingsForPartner(partner);
  const earliestHoldingDue = holdings.filter((item) => item.dueDate).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0] || null;
  const dueText = earliestHoldingDue
    ? sxFormatDueDateWithPrecision(earliestHoldingDue.dueDate, earliestHoldingDue.dueDatePrecision)
    : sxFormatDueDateWithPrecision(partner.dueDate, partner.dueDatePrecision);
  const latestText = latest
    ? `${sxFormatEventDateWithPrecision(latest.occurredOn, latest.occurredOnPrecision)}・${sxCompactPartnerRowText(sxNormalizePublicName(latest.summary), display.name)}`
    : "接点未登録";
  const nextText = partner.nextCommitment
    ? sxCompactPartnerRowText(nominalizeSxNextActionLabel(sxNormalizePublicName(partner.nextCommitment)), display.name)
    : "次の一手 未登録";
  const nameHeadingId = `sx-partner-name-${partner.id}`;
  return (
    <article id={`sx-partner-${partner.id}`} data-sx-anchor={`sx-partner-${partner.id}`} data-testid={`sx-poc-comparison-row-${partner.id}`} tabIndex={-1} aria-labelledby={nameHeadingId} className="scroll-mt-24 border-b border-[#eee9df] bg-[#fffdf7]">
      <div className="grid grid-cols-[minmax(0,1fr)_44px] items-stretch gap-2 px-3 py-2">
        <div className={`grid min-w-0 grid-cols-2 gap-x-3 gap-y-1.5 md:grid-cols-[150px_minmax(180px,1fr)_100px_105px] ${POC_COMPARISON_INNER_GRID}`}>
          <div className="col-span-2 flex min-w-0 items-baseline gap-2 md:col-span-1 md:block">
            <p id={nameHeadingId} className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#24231f]">{display.name}</p>
            <p className={`shrink-0 truncate text-[10px] md:mt-0.5 ${sxPartnerNeedsRefresh(partner, today) ? "font-semibold text-[#765022]" : "text-[#69665d]"}`}>最終確認 {sxFormatDate(partner.lastVerifiedAt)}</p>
          </div>
          <div className="col-span-2 min-w-0 md:col-span-1">
            <PartnerStageRail partnerId={partner.id} stage={partner.relationshipStage} steps={steps} deferred={partner.deferredLowPriority} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[#69665d] xl:hidden">要対応</p>
            <SxBadge tone={ATTENTION_TONE[attention.key]}>{attention.label}</SxBadge>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[#69665d] xl:hidden">ボール・期限</p>
            <p className="truncate text-[10px] font-semibold text-[#24231f]" title={pocBallOwnerText(partner, display.name)}>{pocBallOwnerText(partner, display.name)}</p>
            <p className="truncate text-[10px] text-[#69665d]" title={dueText}>{dueText}</p>
          </div>
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <p className="truncate text-[10px] text-[#514e47]" title={latestText}><span className="font-semibold text-[#69665d]">直近 </span>{latestText}</p>
          </div>
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <p className="truncate text-[10px] text-[#514e47]" title={nextText}><span className="font-semibold text-[#69665d]">次 </span>{nextText}</p>
          </div>
        </div>
        <button type="button" aria-expanded={expanded} onClick={() => onToggleExpand(partner.id)} aria-label={`${display.name}の詳細を開く`} className={`grid h-11 w-11 place-items-center self-center rounded-md border border-[#cfc7b9] text-[10px] font-semibold text-[#315f7d] hover:bg-[#eef3f5] ${FOCUS_RING}`}>詳細</button>
      </div>
      {expanded && (
        <PocComparisonDetailModal
          partner={partner}
          canManage={canManage}
          today={today}
          milestoneTitleById={milestoneTitleById}
          milestoneSlugById={milestoneSlugById}
          onClose={() => onToggleExpand(partner.id)}
          onEditPartner={onEditPartner}
          onAddInteraction={onAddInteraction}
          onEditInteraction={onEditInteraction}
          onAddWorkItem={onAddWorkItem}
          onEditWorkItem={onEditWorkItem}
          onAddRole={onAddRole}
          onEditRole={onEditRole}
        />
      )}
    </article>
  );
}

/** relationshipStage → nextCommitment(dueDate) pipeline. Initial display groups active partners by
 * primary role_kind x relationship_state (spec B: 共同開発先/共同開発候補先 etc. are always distinct
 * groups); CategoryNav remains an auxiliary chip filter on top. Deferred/low-priority institutions
 * stay in a separate trailing group with the same row UI (spec C: row全体opacityは禁止), never removed
 * from the ledger. */
export function SxPartnerPipeline({
  management,
  onEditPartner,
  onAddInteraction,
  onEditInteraction,
  onAddWorkItem,
  onEditWorkItem,
  onAddRole,
  onEditRole,
}: {
  management: SxManagementBundle;
  onEditPartner?: (partnerId: string) => void;
  onAddInteraction?: (partnerId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
  onAddWorkItem?: (partnerId: string, side: SxActorSide) => void;
  onEditWorkItem?: (workItemId: string) => void;
  onAddRole?: (partnerId: string) => void;
  onEditRole?: (roleId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeRoleKind, setActiveRoleKind] = useState<SxPartnerRoleKind | null>(null);
  const [pocOnly, setPocOnly] = useState(false);
  const [activePocStage, setActivePocStage] = useState<SxPartnerStage | "all">("all");
  const [pocSort, setPocSort] = useState<SxPocComparisonSort>("progress");
  const [activePocQuickFilter, setActivePocQuickFilter] = useState<SxPocQuickFilter>("all");
  const milestoneTitleBySlug = new Map(management.milestones.map((milestone) => [milestone.slug, nominalizeSxActionLabel(milestone.title)]));
  const milestoneTitleById = new Map(management.milestones.map((milestone) => [milestone.id, nominalizeSxActionLabel(milestone.title)]));
  const milestoneSlugById = new Map(management.milestones.map((milestone) => [milestone.id, milestone.slug]));

  // PoCは横断属性のまま。同じ台帳から絞り込むが、PoC比較時の主軸は役割ではなく
  // 全関係先共通の7段階。role未登録を「進捗未分類」と誤読させない。
  const pocPartners = management.partners.filter(sxIsPocPartner);
  const matchesRole = (partner: SxManagementPartner) =>
    activeRoleKind === null || (partner.roles.find((role) => role.isPrimary)?.roleKind || "unclassified") === activeRoleKind;
  const stageFilteredPocPartners = pocPartners.filter((partner) => {
    if (activePocStage === "all") return true;
    if (activePocStage === "on_hold") return sxPartnerIsOnHold(partner);
    return !sxPartnerIsOnHold(partner) && partner.relationshipStage === activePocStage;
  });
  const filterablePartners = pocOnly
    ? stageFilteredPocPartners.filter((partner) => pocMatchesQuickFilter(partner, management.asOf, activePocQuickFilter))
    : management.partners.filter(matchesRole);
  const pocComparisonPartners = [...filterablePartners].sort((left, right) => sxComparePartnersForPoc(left, right, management.asOf, pocSort));
  // Both trailing sections read from the role-filtered list too (spec P1: role filter中の保留欄も選択
  // roleに合うものだけ) — selecting a category must narrow 保留/終了 exactly like the main groups.
  const deferredPartners = pocOnly ? [] : filterablePartners.filter((partner) => partner.deferredLowPriority);
  const endedPartners = pocOnly ? [] : filterablePartners.filter((partner) => !partner.deferredLowPriority && sxIsPartnerEnded(partner));
  const groups = pocOnly ? [] : sxGroupPartnersByPrimaryClassification(filterablePartners);

  // 通常台帳の管制帯は全関係先、PoC比較の要対応集計は表示中PoC先を分母にする。
  const countScopePartners = pocOnly ? filterablePartners : management.partners;
  const counts = sxComputeControlBandCounts(countScopePartners, management.asOf);
  const roleCounts = sxPrimaryRoleKindCounts(management.partners);

  const rowGridCols = "grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:grid-cols-[152px_minmax(0,2fr)_minmax(0,0.95fr)_118px_140px]";
  const rowGapCols = "gap-x-2 md:gap-x-3 xl:gap-x-2";

  const rowProps = {
    milestoneTitleBySlug,
    milestoneTitleById,
    milestoneSlugById,
    rowGridCols,
    rowGapCols,
    comparisonMode: pocOnly,
    canManage: management.canManage,
    today: management.asOf,
    expandedId,
    onToggleExpand: (partnerId: string) => setExpandedId((current) => (current === partnerId ? null : partnerId)),
    onEditPartner,
    onAddInteraction,
    onEditInteraction,
    onAddWorkItem,
    onEditWorkItem,
    onAddRole,
    onEditRole,
  };

  return (
    <div className="relative isolate rounded-lg border border-[#d6cebf] bg-[#fffdf7]" data-testid="sx-partner-pipeline">
      <div className="rounded-t-[7px] border-b border-[#e4ddd0] bg-[#f8f5ec] px-3 py-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">関係先ごとの進行・接点・現在ボールを一行で管制</p>
        <h3 className="mt-0.5 text-sm font-semibold text-[#24231f]">どこまで進み、直近何が起き、次に誰が動くか</h3>
      </div>
      {!pocOnly && (
        <ControlBand
          counts={counts}
          totalPartners={countScopePartners.length}
          pocPartnerCount={pocPartners.length}
        />
      )}
      <CategoryNav
        counts={roleCounts}
        totalCount={management.partners.length}
        pocCount={pocPartners.length}
        activeKind={activeRoleKind}
        pocOnly={pocOnly}
        onClear={() => {
          setPocOnly(false);
          setActiveRoleKind(null);
          setActivePocStage("all");
          setActivePocQuickFilter("all");
        }}
        onSelect={(kind) => {
          setActiveRoleKind(kind);
        }}
        onSelectPoc={() => {
          const next = !pocOnly;
          setPocOnly(next);
          if (next) setActiveRoleKind(null);
          if (!next) {
            setActivePocStage("all");
            setActivePocQuickFilter("all");
          }
        }}
        showRoleFilter={!pocOnly}
      />
      {pocOnly && (
        <PocComparisonControls
          partners={pocPartners}
          attentionScopePartners={stageFilteredPocPartners}
          visiblePartners={pocComparisonPartners}
          today={management.asOf}
          activeStage={activePocStage}
          sort={pocSort}
          activeQuickFilter={activePocQuickFilter}
          onSelectStage={(stage) => {
            setActivePocStage(stage);
            setActivePocQuickFilter("all");
          }}
          onSelectSort={setPocSort}
          onSelectQuickFilter={setActivePocQuickFilter}
        />
      )}

      {pocOnly ? (
        <div className={`sticky top-14 z-20 hidden ${POC_COMPARISON_HEADER_GRID} gap-2 border-b border-[#e4ddd0] bg-[#f8f5ec] px-3 py-1.5 text-[10px] font-semibold text-[#69665d] shadow-[0_1px_0_#d6cebf] xl:grid`}>
          <span>PoC先</span><span>関係段階</span><span>要対応</span><span>ボール・期限</span><span>直近接点</span><span>次の一手</span><span>詳細</span>
        </div>
      ) : (
        <div className={`hidden xl:grid ${rowGridCols} ${rowGapCols} border-b border-[#e4ddd0] bg-[#f8f5ec] px-3 py-1.5 text-[10px] font-semibold text-[#69665d]`}>
          <span>関係先</span><span>関係段階・要対応</span><span>直近接点</span><span>現在ボール・期限</span><span>関連・操作</span>
        </div>
      )}

      {/* spec P1: role filter中に「対応中」groupがゼロでも保留/終了に絞り込み結果が残っていることが
          あるため、3つの表示先すべて（active groups + deferred + ended）を合算してから空判定する
          （groups.length === 0 だけを見ると「該当なし」を誤表示してしまう）。 */}
      {(pocOnly ? pocComparisonPartners.length === 0 : groups.length === 0 && deferredPartners.length === 0 && endedPartners.length === 0) && (
        <p className="px-3 py-6 text-center text-xs text-[#69665d]">該当する関係先はまだないよ。</p>
      )}
      {pocOnly && pocComparisonPartners.map((partner) => <PartnerRow key={partner.id} partner={partner} {...rowProps} />)}
      {!pocOnly && groups.map((group) => (
        <div key={group.key}>
          <div className="border-b border-l-4 border-[#e4ddd0] border-l-[#38745d] bg-[#fffdf7] px-3 py-1.5">
            {/* spec P1: 分類見出しh4は11-12px+左罫線で本文行と視覚的に区切る。in_progress/established
                は同じ複合ラベル("XX先")になるため、unclassified以外は状態を（）で必ず明示して見出し
                だけでも区別できるようにする。 */}
            <h4 className="text-[11px] font-semibold text-[#38745d]">
              {group.label}
              {group.roleKind !== "unclassified" && <span className="text-[#69665d]">（{sxRelationshipStateLabel(group.relationshipState)}）</span>}
              {" "}<span className="text-[#69665d]">{group.partners.length}件</span>
            </h4>
          </div>
          {group.partners.map((partner) => <PartnerRow key={partner.id} partner={partner} {...rowProps} />)}
        </div>
      ))}

      {!pocOnly && deferredPartners.length > 0 && (
        <details className="border-t border-[#e4ddd0]">
          <summary className={`flex min-h-11 cursor-pointer select-none items-center px-3 py-2 text-[10px] font-semibold text-[#69665d] ${FOCUS_RING}`}>
            保留・低優先（重要経路外・{deferredPartners.length}件）
          </summary>
          <div>
            {deferredPartners.map((partner) => <PartnerRow key={partner.id} partner={partner} {...rowProps} deferred />)}
          </div>
        </details>
      )}

      {/* 終了は保留とは別単位（spec P1: 保留/終了を別単位）。同じ折りたたみ行UIを流用しつつ、
          対応中カウントには入らないことがこのsectionの独立性からも分かるようにする。 */}
      {!pocOnly && endedPartners.length > 0 && (
        <details className="border-t border-[#e4ddd0]">
          <summary className={`flex min-h-11 cursor-pointer select-none items-center px-3 py-2 text-[10px] font-semibold text-[#69665d] ${FOCUS_RING}`}>
            終了（対応中から除外・{endedPartners.length}件）
          </summary>
          <div>
            {endedPartners.map((partner) => <PartnerRow key={partner.id} partner={partner} {...rowProps} deferred />)}
          </div>
        </details>
      )}
    </div>
  );
}


/**
 * 関係段階 — 全社共通の固定7段階。接点・作業・ボールはここへ混ぜず、別の列と詳細で扱う。
 * 会社名下railと同じstepsを受け取るため、両方とも必ず7区間で一致する。
 */
function PartnerProgressFlow({
  partner,
  displayName,
  steps,
  today,
}: {
  partner: SxManagementPartner;
  displayName: string;
  steps: readonly PartnerProgressStep[];
  today: string;
}) {
  const stageIndex = sxPartnerStageIndex(partner.relationshipStage);
  const onHold = partner.relationshipStage === "on_hold" || partner.deferredLowPriority;
  const attention = sxPartnerAttention(partner, today);
  const rawNext = partner.nextCommitment
    ? nominalizeSxNextActionLabel(sxNormalizePublicName(partner.nextCommitment))
    : "次の一手 未登録";
  const compactNext = sxCompactPartnerRowText(rawNext, displayName);
  return (
    <div
      className="min-w-0"
      data-testid={`sx-partner-progress-${partner.id}`}
      data-step-count={steps.length}
      data-stage-index={stageIndex ?? "on_hold"}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="truncate text-[10px] font-semibold text-[#315f7d]">
          {onHold ? "保留" : `${stageIndex}/7 ${sxPartnerStageLabel(partner.relationshipStage)}`}
        </p>
        <SxBadge tone={ATTENTION_TONE[attention.key]}>{attention.label}</SxBadge>
      </div>
      <ol
        className="mt-1 grid grid-cols-7 gap-0.5"
        aria-label={onHold ? `${displayName}の関係段階は保留` : `${displayName}の関係段階 ${stageIndex}/7`}
      >
        {steps.map((step, index) => (
          <li
            key={step.stage}
            data-progress-step={step.phase}
            className={`min-w-0 rounded-sm border px-0.5 py-1 text-center ${
              onHold
                ? "border-[#d6cebf] bg-[#f8f5ec] text-[#8a857b]"
                : step.phase === "done"
                  ? "border-[#c9d9cf] bg-[#f1f6f2] text-[#205f49]"
                  : step.phase === "now"
                    ? "border-[#38745d] bg-[#e8f2eb] text-[#205f49]"
                    : "border-[#e4ddd0] bg-white text-[#8a857b]"
            }`}
            title={`${index + 1}. ${step.label}`}
          >
            <span aria-hidden="true" className="block text-[10px] font-bold leading-3">{onHold || step.phase === "next" ? "○" : step.phase === "now" ? "●" : "—"}</span>
            <span className="block truncate text-[10px] font-semibold leading-3">{step.label.replace("情報交換", "情報").replace("条件整理", "条件").replace("面談調整", "面談").replace("検証準備", "準備").replace("合意確認", "合意").replace("実行中", "実行")}</span>
          </li>
        ))}
      </ol>
      <p className="mt-1 truncate text-[10px] text-[#514e47]" title={compactNext}>次: {compactNext}</p>
    </div>
  );
}

const INTERACTION_DIRECTION_LABEL: Record<SxActorSide, string> = {
  sx: "送信（当方→先方）",
  partner: "受信（先方→当方）",
  shared: "共同",
  unknown: "方向未確認",
};

/** 直近接点を同じ関係先rowの1 cellに表示する。public-safe fieldsだけを使う。 */
function SxLatestContactCell({ partner }: { partner: SxManagementPartner }) {
  const latest = sxLatestInteraction(partner.interactions);
  const partnerName = sxPartnerDisplay(partner).name;
  if (!latest) {
    return (
      <div data-testid={`sx-partner-latest-contact-${partner.id}`} className="min-w-0 text-[10px] leading-4 text-[#69665d]">
        <p className="font-semibold tracking-[0.08em]">直近接点</p>
        <p className="mt-1">接点未登録</p>
      </div>
    );
  }
  const ballAfterText = sxCompactBallSideLabel(latest.ballSideAfter);
  const currentBallText = sxCompactBallSideLabel(partner.currentBallSide);
  const summaryText = sxCompactPartnerRowText(sxNormalizePublicName(latest.summary), partnerName);
  const outcomeText = latest.outcomeSummary ? sxCompactPartnerRowText(sxNormalizePublicName(latest.outcomeSummary), partnerName) : null;
  const ballTransition = ballAfterText === currentBallText ? `接点後から現在 ${currentBallText}` : `接点後 ${ballAfterText} → 現在 ${currentBallText}`;
  return (
    <div data-testid={`sx-partner-latest-contact-${partner.id}`} className="min-w-0 text-[10px] leading-4 text-[#514e47]">
      <p className="font-semibold tracking-[0.08em] text-[#69665d]">直近接点</p>
      <p className="mt-0.5">
        {sxFormatEventDateWithPrecision(latest.occurredOn, latest.occurredOnPrecision)} ・ {sxInteractionKindLabel(latest.interactionKind)} ・ {INTERACTION_DIRECTION_LABEL[latest.actorSide]}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[#24231f]" title={summaryText}>{summaryText}</p>
      <p className="mt-0.5 line-clamp-2" title={outcomeText ? `結果: ${outcomeText}` : "結果未確認"}>{outcomeText ? `結果: ${outcomeText}` : "結果未確認"}</p>
      <p className="mt-0.5">{ballTransition}</p>
    </div>
  );
}

function PartnerRow({
  partner,
  milestoneTitleBySlug,
  milestoneTitleById,
  milestoneSlugById,
  rowGridCols,
  rowGapCols,
  comparisonMode,
  canManage,
  today,
  expandedId,
  onToggleExpand,
  onEditPartner,
  onAddInteraction,
  onEditInteraction,
  onAddWorkItem,
  onEditWorkItem,
  onAddRole,
  onEditRole,
  deferred,
}: {
  partner: SxManagementPartner;
  milestoneTitleBySlug: ReadonlyMap<string, string>;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  rowGridCols: string;
  rowGapCols: string;
  comparisonMode: boolean;
  canManage: boolean;
  today: string;
  expandedId: string | null;
  onToggleExpand: (partnerId: string) => void;
  onEditPartner?: (partnerId: string) => void;
  onAddInteraction?: (partnerId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
  onAddWorkItem?: (partnerId: string, side: SxActorSide) => void;
  onEditWorkItem?: (workItemId: string) => void;
  onAddRole?: (partnerId: string) => void;
  onEditRole?: (roleId: string) => void;
  deferred?: boolean;
}) {
  const display = sxPartnerDisplay(partner);
  const holdings = sxHoldingsForPartner(partner);
  const progressSteps = buildPartnerProgressSteps(partner);
  const primaryRole = partner.roles.find((role) => role.isPrimary) || null;
  const primaryRoleKind = primaryRole?.roleKind || "unclassified";
  const primaryRoleState = primaryRole?.relationshipState || "unconfirmed";
  const secondaryRoles = partner.roles.filter((role) => !role.isPrimary);
  const pocPartner = sxIsPocPartner(partner);
  const hasBlockedHolding = sxPartnerHasBlockedHolding(partner);
  const milestoneTitles = milestoneTitlesForPartner(partner, milestoneTitleBySlug);
  const proofLabels = proofLabelsForPartner(partner);
  const dueHoldings = holdings.filter((item) => item.dueDate).sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
  const earliestHoldingDue = dueHoldings[0] || null;
  const expanded = expandedId === partner.id;
  const nameHeadingId = `sx-partner-name-${partner.id}`;

  if (comparisonMode) {
    return (
      <PocComparisonRow
        partner={partner}
        milestoneTitleById={milestoneTitleById}
        milestoneSlugById={milestoneSlugById}
        canManage={canManage}
        today={today}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onEditPartner={onEditPartner}
        onAddInteraction={onAddInteraction}
        onEditInteraction={onEditInteraction}
        onAddWorkItem={onAddWorkItem}
        onEditWorkItem={onEditWorkItem}
        onAddRole={onAddRole}
        onEditRole={onEditRole}
      />
    );
  }

  return (
    <article id={`sx-partner-${partner.id}`} data-sx-anchor={`sx-partner-${partner.id}`} tabIndex={-1} aria-labelledby={nameHeadingId} className={`scroll-mt-24 border-b border-[#eee9df] ${deferred ? "border-l-4 border-l-[#c9bfd0] bg-[#f8f5ec]" : partner.currentBallSide === "sx" ? "border-l-4 border-l-[#b5533f] bg-[#fdf6f4]" : ""}`}>
      <div className={`grid ${rowGridCols} ${rowGapCols} gap-y-2 px-3 py-2.5 text-[11px] leading-4`}>
        <div className="col-start-1 row-start-1 min-w-0 md:col-span-2 xl:col-span-1 xl:col-start-1 xl:row-start-1">
          <div className="flex flex-wrap items-center gap-1">
            <p id={nameHeadingId} className="truncate font-semibold text-[#24231f]">{display.name}</p>
            {/* spec P1: partner/group sortもblocked partner最優先。並び替えだけでは画面から気付けない
                ので、停止保有事項を抱える関係先には行頭で分かる badge を出す (sxPartnerHasBlockedHolding
                が並び替えキーと同じ判定を使う)。 */}
            {hasBlockedHolding && <SxBadge tone={ALERT_TONE}>停止</SxBadge>}
            {pocPartner && <SxBadge tone="border-[#e3c994] bg-[#fbf1dc] text-[#765022]">PoC</SxBadge>}
            {/* 当方（SX）ボールは待ちがそのまま遅れになるため、行頭で強く示す（2026-07-25 まさ確定）。 */}
            {partner.currentBallSide === "sx" && <SxBadge tone="border-[#b5533f] bg-[#8c3329] text-white">当方ボール</SxBadge>}
          </div>
          {!comparisonMode && (
            <p className="mt-0.5 truncate text-[10px] text-[#514e47]">
              {sxRoleDisplayLabel(primaryRoleKind, primaryRoleState)}
              {/* unclassifiedの複合ラベルは既に状態を含むため二重表示しない。それ以外は常に状態を明示
                  (spec P0: in_progress/establishedも状態を見出し/行へ明示 — 複合ラベルが同じ"XX先"に
                  なる2状態を、行単位でも視覚的に区別できるようにする)。 */}
              {primaryRoleKind !== "unclassified" && ` ・ ${sxRelationshipStateLabel(primaryRoleState)}`}
            </p>
          )}
          {!comparisonMode && secondaryRoles.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {secondaryRoles.map((role) => <SxBadge key={role.id} tone="border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]">{sxPartnerRoleKindLabel(role.roleKind)}</SxBadge>)}
            </div>
          )}
          <div className="mt-1.5"><PartnerStageRail partnerId={partner.id} stage={partner.relationshipStage} steps={progressSteps} deferred={partner.deferredLowPriority} /></div>
        </div>

        <div className="col-start-1 row-start-2 min-w-0 md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1">
          <PartnerProgressFlow partner={partner} displayName={display.name} steps={progressSteps} today={today} />
        </div>

        <div className="col-start-1 row-start-3 min-w-0 md:col-span-1 md:row-start-3 xl:col-start-3 xl:row-start-1">
          <SxLatestContactCell partner={partner} />
        </div>

        <div className="col-start-1 row-start-4 min-w-0 md:col-start-2 md:row-start-3 xl:col-start-4 xl:row-start-1">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-[#69665d] xl:hidden">現在ボール・期限</p>
          <div className="mt-0.5 xl:mt-0">
            <BallAndDueCell partner={partner} earliestHoldingDue={earliestHoldingDue} />
          </div>
          <p className="mt-1 text-[10px] text-[#69665d]">最終接点 {sxFormatDate(partner.lastContactDate)}</p>
        </div>

        <div className="col-start-1 row-start-5 min-w-0 md:col-span-2 md:row-start-4 xl:col-span-1 xl:col-start-5 xl:row-start-1">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-[#69665d] xl:hidden">関連・操作</p>
          <p className="line-clamp-2 text-[10px] text-[#69665d]">関連ゲート: {milestoneTitles.length > 0 ? milestoneTitles.join(" / ") : "未接続"}</p>
          <p className="mt-1 line-clamp-2 text-[10px] text-[#315f7d]">寄与する証明: {proofLabels.length > 0 ? proofLabels.join(" / ") : "未接続"}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {canManage && onEditPartner && (
              <button type="button" onClick={() => onEditPartner(partner.id)} aria-label={`${display.name}を編集`} className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-2 py-1.5 text-[10px] font-semibold text-[#514e47] hover:bg-[#f8f5ec] ${FOCUS_RING}`}>
                <Pencil className="h-3 w-3" aria-hidden="true" />編集
              </button>
            )}
            {canManage && onAddRole && (
              <button type="button" onClick={() => onAddRole(partner.id)} aria-label={`${display.name}に分類を追加`} className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-2 py-1.5 text-[10px] font-semibold text-[#514e47] hover:bg-[#f8f5ec] ${FOCUS_RING}`}>
                <Plus className="h-3 w-3" aria-hidden="true" />分類
              </button>
            )}
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`sx-partner-history-${partner.id}`}
              aria-label={`${display.name}の保有事項・やり取り履歴の全文を${expanded ? "閉じる" : "開く"}`}
              onClick={() => onToggleExpand(partner.id)}
              className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-2 py-1.5 text-[10px] font-semibold text-[#315f7d] hover:bg-[#eef3f5] ${FOCUS_RING}`}
            >
              詳細 {expanded ? "▾" : "▸"}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          <InteractionTimeline partner={partner} canManage={canManage} onAddInteraction={onAddInteraction} onEditInteraction={onEditInteraction} />
          {canManage && onAddWorkItem && (
            <div className="mt-2 flex flex-wrap gap-1" aria-label={`${display.name}の保有事項を追加`}>
              {(["sx", "partner", "shared", "unknown"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => onAddWorkItem(partner.id, side)}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-2 py-1.5 text-[10px] font-semibold text-[#514e47] hover:bg-[#f8f5ec] ${FOCUS_RING}`}
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  {side === "sx" ? "当方" : side === "partner" ? "先方" : side === "shared" ? "双方" : "担当未確認"}の保有事項
                </button>
              ))}
            </div>
          )}
          {/* spec P0-3: 台帳のdetailsのopenを外し、履歴直後は閉じた44px summaryのみ。詳細はユーザー
              操作で開く。履歴本体にroundedカードを戻さない（このdetails内の分類/保有事項/約束カード
              のスタイルはそのまま維持）。 */}
          <details className="mt-3 border-t border-[#e4ddd0] pt-3">
            <summary className={`flex min-h-11 cursor-pointer select-none items-center text-[10px] font-semibold tracking-[0.14em] text-[#38745d] ${FOCUS_RING}`}>
              {canManage ? "台帳の詳細・編集" : "台帳の詳細"}
            </summary>
            <PartnerLedgerDetails
              partner={partner}
              canManage={canManage}
              today={today}
              milestoneTitleById={milestoneTitleById}
              milestoneSlugById={milestoneSlugById}
              onEditWorkItem={onEditWorkItem}
              onEditRole={onEditRole}
              onEditInteraction={onEditInteraction}
            />
          </details>
        </div>
      )}
    </article>
  );
}

/** One full-width ruled row per interaction, fixed h-16 (64px) + overflow-hidden (spec P0-2: 行を
 * h-16で固定, 3件+headerの静的高さ予算に収める). Mobile grid is [56px_minmax(0,1fr)_64px_44px] (date /
 * body / ball / edit) — actor folds into a small leading label inside the body column instead of an
 * independent column (spec P0-1: 主体はmobileでは本文先頭の小ラベルに統合). md+ promotes actor to its
 * own 68px column and the body column gets a minmax(130px,1fr) floor so it never collapses. summary and
 * outcomeSummary always render in full regardless of actorSide (spec: unknown本文を隠さない, 外部閲覧
 * 者もsummary/outcomeを視認可能) — only the layout changes, never gating on canManage/role. Date/actor/
 * ball/summary/outcome all truncate with a title attribute so nothing is silently cut off without a way
 * to read the full text. The 44px edit button sits pinned at the row end, independent of content height
 * (spec P0: 編集44px操作は本文高を増やさない行末独立). canManage=false must never reserve that trailing
 * 44px column for a button that will never render (spec P1: read-only閲覧者に空編集列を見せない) — the
 * grid template itself drops the last track, so mobile becomes [56px_minmax(0,1fr)_64px] and md becomes
 * [56px_68px_minmax(130px,1fr)_64px]; every other column's col-start is unchanged since the trailing
 * track is always last regardless of column count. */
function InteractionRow({
  interaction,
  partnerName,
  canManage,
  onEdit,
}: {
  interaction: SxPartnerInteraction;
  partnerName: string;
  canManage: boolean;
  onEdit?: (interactionId: string) => void;
}) {
  const actorText =
    interaction.actorSide === "shared" ? (interaction.actorLabel ? `共同・${sxNormalizePublicName(interaction.actorLabel)}` : "共同")
    : interaction.actorSide === "unknown" ? "行為主体未確認"
    : interaction.actorLabel ? sxNormalizePublicName(interaction.actorLabel) : (interaction.actorSide === "sx" ? "当方" : "先方");
  const dateText = sxFormatEventDateWithPrecision(interaction.occurredOn, interaction.occurredOnPrecision);
  const ballText = `→${sxBallSideLabel(interaction.ballSideAfter)}${interaction.ballOwnerAfter ? `・${sxNormalizePublicName(interaction.ballOwnerAfter)}` : ""}`;
  const gridColsClass = canManage
    ? "grid-cols-[56px_minmax(0,1fr)_64px_44px] md:grid-cols-[56px_68px_minmax(130px,1fr)_64px_44px]"
    : "grid-cols-[56px_minmax(0,1fr)_64px] md:grid-cols-[56px_68px_minmax(130px,1fr)_64px]";
  return (
    <div className={`grid h-16 ${gridColsClass} items-center gap-x-2 overflow-hidden border-b border-[#eee9df] py-2 last:border-0`}>
      <div className="col-start-1 min-w-0 text-[10px] leading-4 text-[#69665d]">
        <p className="truncate" title={dateText}>{dateText}</p>
        <p className="mt-0.5"><SxBadge tone={INTERACTION_KIND_TONE[interaction.interactionKind] || INTERACTION_KIND_TONE.note}>{sxInteractionKindLabel(interaction.interactionKind)}</SxBadge></p>
      </div>
      <p className="col-start-2 hidden min-w-0 truncate text-[10px] font-semibold leading-4 text-[#514e47] md:block" title={actorText}>{actorText}</p>
      <div className="col-start-2 min-w-0 md:col-start-3">
        <p className="truncate text-[11px] font-semibold leading-4 text-[#24231f]" title={`${actorText} - ${sxNormalizePublicName(interaction.summary)}`}>
          <span className="text-[#69665d] md:hidden">{actorText}：</span>{sxNormalizePublicName(interaction.summary)}
        </p>
        {interaction.outcomeSummary && <p className="truncate text-[10px] leading-4 text-[#514e47]" title={sxNormalizePublicName(interaction.outcomeSummary)}>{sxNormalizePublicName(interaction.outcomeSummary)}</p>}
      </div>
      <p className="col-start-3 min-w-0 truncate text-right text-[10px] leading-4 text-[#315f7d] md:col-start-4" title={ballText}>{ballText}</p>
      {canManage && (
        <button
          type="button"
          onClick={() => onEdit?.(interaction.id)}
          aria-label={`${partnerName} - ${sxNormalizePublicName(interaction.summary)}を編集`}
          className={`col-start-4 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#cfc7b9] text-[#514e47] hover:bg-[#fffdf7] md:col-start-5 ${FOCUS_RING}`}
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** History body only — classification/work-item/commitment editing lives in the sibling "台帳の詳細・
 *編集" details (spec C: 履歴の実高に混ぜない). Header grid is permission-gated (spec P1, 2026-07-24
 * COO差し戻し3点目): only when `canManage && onAddInteraction` does the add button render, so only then
 * does the header reserve its 44px column (`grid-cols-[minmax(0,1fr)_44px]`); read-only viewers get
 * `grid-cols-1` with no reserved trailing column and no gap, matching InteractionRow's own
 * canManage-gated grid convention (never show an empty 44px slot for a button that can't render). The
 * left cell is a single-row, horizontally-scrollable aggregate strip (never wraps, at any breakpoint —
 * mobile折返し禁止) with a right-edge scroll hint. The visible preview below is always
 * `sorted.slice(0, 3)` regardless of total count (spec P0-2: 3件+header<=260の静的高さ予算は件数に関係
 * なく固定) — the header's own aggregate counts (記録/合意/成果物/引継ぎ) always reflect the full set, and
 * a short note appears under the preview whenever more than 3 exist, pointing at 台帳の詳細・編集's
 * full-text "やり取り履歴（全文・全件）" list (InteractionFullRow) rather than duplicating it here. */
function InteractionTimeline({
  partner,
  canManage,
  onAddInteraction,
  onEditInteraction,
}: {
  partner: SxManagementPartner;
  canManage: boolean;
  onAddInteraction?: (partnerId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
}) {
  const sorted = sxSortInteractionsByRecency(partner.interactions);
  const preview = sorted.slice(0, 3);
  const agreements = partner.interactions.filter((item) => item.interactionKind === "agreement").length;
  const deliverables = partner.interactions.filter((item) => item.interactionKind === "deliverable").length;
  const handoffs = partner.interactions.filter((item) => item.interactionKind === "handoff").length;
  const canAddInteraction = canManage && !!onAddInteraction;
  return (
    <div id={`sx-partner-history-${partner.id}`}>
      <div className={`grid items-center ${canAddInteraction ? "grid-cols-[minmax(0,1fr)_44px] gap-2" : "grid-cols-1"}`}>
        <div className="relative min-w-0">
          <div
            tabIndex={0}
            className={`flex flex-nowrap items-center gap-x-3 overflow-x-auto text-[10px] text-[#69665d] ${ALWAYS_SCROLL_HINT_CLASS}`}
            role="group"
            aria-label="やり取り履歴集計"
          >
            <span className="shrink-0 font-semibold tracking-[0.14em] text-[#38745d]">やり取り履歴</span>
            <span className="shrink-0">最終接点 {sxFormatDate(partner.lastContactDate)}</span>
            <span className="shrink-0">記録 {sorted.length}件</span>
            <span className="shrink-0">合意 {agreements}件</span>
            <span className="shrink-0">成果物 {deliverables}件</span>
            <span className="shrink-0">引継ぎ {handoffs}件</span>
          </div>
          <ScrollHintArrow always />
        </div>
        {canAddInteraction && (
          <button type="button" onClick={() => onAddInteraction!(partner.id)} aria-label={`${partner.name}の履歴を追加`} title="履歴を追加" className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#cfc7b9] text-[#514e47] hover:bg-[#f8f5ec] ${FOCUS_RING}`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-[#d6cebf] p-3 text-[11px] text-[#69665d]">やり取り履歴はまだないよ。</p>
      ) : (
        <>
          <div className="mt-1.5">{preview.map((interaction) => <InteractionRow key={interaction.id} interaction={interaction} partnerName={partner.name} canManage={canManage} onEdit={onEditInteraction} />)}</div>
          {sorted.length > 3 && (
            <p className="mt-1 text-[10px] text-[#69665d]">表示3 / 全{sorted.length}件・全文は「{canManage ? "台帳の詳細・編集" : "台帳の詳細"}」へ</p>
          )}
        </>
      )}
    </div>
  );
}

/** Classification / work-item / commitment editing — deliberately separate from InteractionTimeline
 * (spec C: 分類編集/保有事項編集/約束カードは履歴本体から分離し、別details「台帳の詳細・編集」へ入れる).
 * The work-item detail list below is always rendered regardless of canManage (spec P0: work item
 * 詳細は権限に関係なく表示、編集ボタンだけcanManage) — read-only PJ/外部メンバーも同じ内容を読める. */
function PartnerLedgerDetails({
  partner,
  canManage,
  today,
  milestoneTitleById,
  milestoneSlugById,
  onEditWorkItem,
  onEditRole,
  onEditInteraction,
}: {
  partner: SxManagementPartner;
  canManage: boolean;
  today: string;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  onEditWorkItem?: (workItemId: string) => void;
  onEditRole?: (roleId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
}) {
  const allWorkItems = sxSortHoldingsByPriority(sxAllHoldingsForPartnerAudit(partner), today);
  const allInteractions = sxSortInteractionsByRecency(partner.interactions);
  return (
    <div className="mt-2 space-y-3">
      {partner.roles.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">分類（役割 × 関係状態）</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {partner.roles.map((role) => (
              <div key={role.id} className="flex items-center gap-1.5 rounded-md border border-[#e4ddd0] bg-white px-2 py-1.5 text-[10px]">
                <SxBadge tone={role.isPrimary ? "border-[#315f7d] bg-[#eef3f5] text-[#315f7d]" : "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]"}>{role.isPrimary ? "主分類" : "副分類"}</SxBadge>
                <span className="font-semibold text-[#24231f]">{sxPartnerRoleKindLabel(role.roleKind)}</span>
                <span className="text-[#69665d]">{sxRelationshipStateLabel(role.relationshipState)}</span>
                {role.roleLabel && <span className="text-[#69665d]">/ {sxNormalizePublicName(role.roleLabel)}</span>}
                {canManage && onEditRole && (
                  <button
                    type="button"
                    onClick={() => onEditRole(role.id)}
                    aria-label={`${partner.name}の${sxPartnerRoleKindLabel(role.roleKind)}分類を編集`}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#cfc7b9] text-[#514e47] hover:bg-[#f8f5ec] ${FOCUS_RING}`}
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {allWorkItems.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">保有事項の詳細（完了・停止を含む全件）</p>
          <ul className="mt-2 divide-y divide-[#eee9df] rounded-md border border-[#e4ddd0] bg-white">
            {allWorkItems.map((item) => (
              <HoldingRow
                key={item.id}
                item={item}
                partnerName={partner.name}
                today={today}
                milestoneTitleById={milestoneTitleById}
                milestoneSlugById={milestoneSlugById}
                showSideBadge={item.side}
                canManage={canManage}
                onEdit={onEditWorkItem}
              />
            ))}
          </ul>
        </div>
      )}
      {partner.commitments.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">約束・次アクション（完了・停止・取消を含む全件）</p>
          <div className="mt-2 space-y-2">
            {partner.commitments.map((commitment) => (
              <div key={commitment.id} className="rounded-lg border border-[#e4ddd0] bg-white p-2.5 text-[11px] leading-5">
                <div className="flex flex-wrap items-center gap-1">
                  <SxBadge tone="border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]">{commitment.commitmentKind === "counterparty_promise" ? "相手の約束" : "SX側の次アクション"}</SxBadge>
                  {/* commitment.status shares the same open/in_progress/completed/blocked/cancelled
                      vocabulary as work items, so it reuses HOLDING_STATUS_TONE/LABEL directly (spec:
                      open/blocked/completed/cancelled等を識別できる). */}
                  <SxBadge tone={HOLDING_STATUS_TONE[commitment.status] || HOLDING_STATUS_TONE.open}>{HOLDING_STATUS_LABEL[commitment.status] || "未確認"}</SxBadge>
                </div>
                <p className="mt-1 font-semibold text-[#24231f]">{nominalizeSxActionLabel(sxNormalizePublicName(commitment.title))}</p>
                <p className="mt-1 text-[#69665d]">{sxNormalizePublicName(commitment.commitmentText)}</p>
                {/* Both owners always render — a promise always has a counterparty side and an SX
                    follow-up side, never picked conditionally by commitmentKind (spec: 両ownerを表示). */}
                <p className="mt-1 text-[10px] text-[#69665d]">相手 {commitment.counterpartyOwner ? sxNormalizePublicName(commitment.counterpartyOwner) : "未確認"} ・ SX {commitment.sxOwner ? sxNormalizePublicName(commitment.sxOwner) : "未確認"}</p>
                <p className="mt-1 text-[10px] text-[#69665d]">約束日 {sxFormatDate(commitment.promisedOn)} ・ 期限 {sxFormatDate(commitment.dueDate)}</p>
                {commitment.completedOn && <p className="mt-1 text-[10px] text-[#205f49]">完了日: {sxFormatDate(commitment.completedOn)}</p>}
                {/* commitment.evidence is 一次根拠 — backing that the promise exists/was made, present
                    regardless of status. A commitment has no distinct completion-evidence field of its
                    own, so this must never be relabeled "完了の証拠" (spec: commitment evidenceを完了
                    証拠とは呼ばない). */}
                {commitment.evidence && <p className="mt-1 text-[10px] text-[#514e47]">一次根拠: {sxNormalizePublicName(commitment.evidence)}</p>}
                {commitment.nextReviewOn && <p className="mt-1 text-[10px] text-[#69665d]">次回確認 {sxFormatDate(commitment.nextReviewOn)}</p>}
                {/* 出典 — read-only provenance, matching HoldingRow's format. sourceRef is never rendered
                    verbatim; sxSourceRefDisplayLabel masks raw URLs/internal tracking-key shapes first. */}
                <p className="mt-1 text-[10px] text-[#69665d]">
                  出典: {sxSourceKindLabel(commitment.sourceKind)}
                  {sxSourceRefDisplayLabel(commitment.sourceRef) ? ` (${sxSourceRefDisplayLabel(commitment.sourceRef)})` : ""}
                  {" ・ "}最終確認 {sxFormatDate(commitment.lastVerifiedAt)}
                  {" ・ "}確度 {sxConfidenceLabel(commitment.confidence)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Full, non-truncated interaction list (spec: mobile touchでInteractionRowのtruncate全文へ到達
          できるよう追加). InteractionTimeline's rows above stay fixed-height/truncated for the static
          height budget; this section is the always-full-text destination reachable via 台帳の詳細・
          編集. Read-only for every viewer regardless of role — only the edit button is canManage-gated. */}
      {allInteractions.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">やり取り履歴（全文・全件）</p>
          <ul className="mt-2 divide-y divide-[#eee9df] rounded-md border border-[#e4ddd0] bg-white">
            {allInteractions.map((interaction) => (
              <InteractionFullRow key={interaction.id} interaction={interaction} partnerName={partner.name} canManage={canManage} onEdit={onEditInteraction} />
            ))}
          </ul>
        </div>
      )}
      {partner.roles.length === 0 && partner.workItems.length === 0 && partner.commitments.length === 0 && (
        <p className="text-[10px] text-[#69665d]">分類・保有事項・約束はまだ登録されていないよ。</p>
      )}
    </div>
  );
}

/** Full-text counterpart to InteractionRow's fixed-height, truncated timeline row — every field
 * (occurred date/kind, actor, full summary, full outcome, ball side/owner) renders without truncation
 * so a mobile-touch viewer can always reach the complete text (spec: mobile touchでtruncate全文へ到達
 * できるよう「やり取り履歴（全文・全件）」を追加). Read-only for every viewer; the edit button is the
 * only canManage-gated element, matching HoldingRow's convention. */
function InteractionFullRow({
  interaction,
  partnerName,
  canManage,
  onEdit,
}: {
  interaction: SxPartnerInteraction;
  partnerName: string;
  canManage: boolean;
  onEdit?: (interactionId: string) => void;
}) {
  const actorText =
    interaction.actorSide === "shared" ? (interaction.actorLabel ? `共同・${sxNormalizePublicName(interaction.actorLabel)}` : "共同")
    : interaction.actorSide === "unknown" ? "行為主体未確認"
    : interaction.actorLabel ? sxNormalizePublicName(interaction.actorLabel) : (interaction.actorSide === "sx" ? "当方" : "先方");
  const dateText = sxFormatEventDateWithPrecision(interaction.occurredOn, interaction.occurredOnPrecision);
  const ballText = `${sxBallSideLabel(interaction.ballSideAfter)}${interaction.ballOwnerAfter ? ` ・ ${sxNormalizePublicName(interaction.ballOwnerAfter)}` : ""}`;
  return (
    <li className="p-2.5 text-[11px] leading-5">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#69665d]">{dateText}</span>
          <SxBadge tone={INTERACTION_KIND_TONE[interaction.interactionKind] || INTERACTION_KIND_TONE.note}>{sxInteractionKindLabel(interaction.interactionKind)}</SxBadge>
        </div>
        {canManage && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(interaction.id)}
            aria-label={`${partnerName} - ${sxNormalizePublicName(interaction.summary)}を編集`}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#cfc7b9] text-[#514e47] hover:bg-[#f8f5ec] ${FOCUS_RING}`}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-1 text-[10px] font-semibold text-[#514e47]">主体: {actorText}</p>
      <p className="mt-0.5 font-semibold leading-5 text-[#24231f]">{sxNormalizePublicName(interaction.summary)}</p>
      {interaction.outcomeSummary && <p className="mt-0.5 leading-5 text-[#514e47]">{sxNormalizePublicName(interaction.outcomeSummary)}</p>}
      <p className="mt-0.5 text-[10px] leading-4 text-[#315f7d]">ボール: {ballText}</p>
    </li>
  );
}
