"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CircleCheck, CircleDot, Flag, Plus, X } from "lucide-react";
import type {
  SxActorSide,
  SxManagementBundle,
  SxManagementPartner,
  SxPartnerInteraction,
  SxPartnerRoleKind,
} from "@/lib/sx-management";
import {
  SX_PROOF_DEFINITIONS,
  SX_PROOF_THEME_SLUGS,
  SX_THEME_PROOF_MAP,
  type SxProofThemeSlug,
} from "@/lib/sx-proof-mapping";
import {
  nominalizeSxActionLabel,
  nominalizeSxNextActionLabel,
} from "@/lib/sx-action-label";
import { sxNormalizePublicName } from "@/lib/sx-name-normalize";
import { sxIsPocPartner } from "@/lib/sx-poc-candidates";
import {
  sxCompactPartnerRowText,
  sxComparePartnersForPoc,
  sxPartnerHasDataGap,
  sxPartnerHasContactRecord,
  sxPartnerHasDueSoon,
  sxPartnerHasOverdue,
  sxIsVcPartner,
  sxPartnerIsOnHold,
  sxPartnerNeedsRefresh,
  sxPartnerOwnerLoads,
  sxPartnerPrimaryIntervention,
  type SxPartnerPrimaryIntervention,
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
  sxSortHoldingsByPriority,
  sxSortInteractionsByRecency,
  sxSourceKindLabel,
  sxSourceRefDisplayLabel,
  type SxControlBandCounts,
  type SxHoldingItem,
} from "./sx-visual-shared";

type PartnerProgressStep = {
  key: string;
  phase: "done" | "now" | "next" | "goal";
  title: string;
  sub: string | null;
};

/**
 * 会社名下のrailと進行状況列が、同じ件数・同じ順序を使うための唯一のstep builder。
 * 固定段階へ正規化せず、その関係先に実在する接点・作業・現在地・ゴールを並べる。
 */
function buildPartnerProgressSteps(
  partner: SxManagementPartner,
): PartnerProgressStep[] {
  const past = [...partner.interactions].sort((left, right) => {
    const leftKey = left.occurredOn ?? left.createdAt.slice(0, 10);
    const rightKey = right.occurredOn ?? right.createdAt.slice(0, 10);
    return (
      leftKey.localeCompare(rightKey) ||
      left.createdAt.localeCompare(right.createdAt)
    );
  });
  const pending = [...partner.workItems]
    .filter((item) => item.status !== "completed" && item.status !== "cancelled")
    .sort((left, right) =>
      (left.dueDate ?? "9999").localeCompare(right.dueDate ?? "9999"),
    );
  const workSideLabel = (side: string) =>
    side === "sx"
      ? "当方"
      : side === "partner"
        ? "先方"
        : side === "shared"
          ? "双方"
          : "担当未確認";
  const ballOwner = partner.currentBallOwner
    ? sxNormalizePublicName(partner.currentBallOwner)
    : "担当未確認";
  const nowDue = sxFormatDueDateWithPrecision(
    partner.dueDate,
    partner.dueDatePrecision,
  );

  return [
    ...past.map((interaction) => ({
      key: `interaction-${interaction.id}`,
      phase: "done" as const,
      title: sxNormalizePublicName(interaction.summary),
      sub: `${sxInteractionKindLabel(interaction.interactionKind)}${interaction.occurredOn ? ` ・ ${sxFormatEventDateWithPrecision(interaction.occurredOn, interaction.occurredOnPrecision)}` : ""}`,
    })),
    {
      key: "now",
      phase: "now" as const,
      title: `${sxBallSideLabel(partner.currentBallSide)}ボール: ${ballOwner}`,
      sub: `現在地 ・ ${nowDue === "期限未設定" ? nowDue : `期限 ${nowDue}`}`,
    },
    ...pending.map((item) => ({
      key: `work-${item.id}`,
      phase: "next" as const,
      title: nominalizeSxNextActionLabel(sxNormalizePublicName(item.title)),
      sub: `これから ・ ${workSideLabel(item.side)}${item.ownerLabel ? ` ${sxNormalizePublicName(item.ownerLabel)}` : ""}`,
    })),
    {
      key: "next",
      phase: "next" as const,
      title: partner.nextCommitment
        ? nominalizeSxNextActionLabel(sxNormalizePublicName(partner.nextCommitment))
        : "次の一手 未登録",
      sub: "これから",
    },
    {
      key: "goal",
      phase: "goal" as const,
      title: partner.targetState
        ? sxNormalizePublicName(partner.targetState)
        : "目標状態 未登録",
      sub: "ゴール",
    },
  ];
}

/** 進行状況列と同じ可変stepsを、会社名下へ縮約して表示する。 */
function PartnerStageRail({
  partnerId,
  onHold,
  currentBallSide,
  steps,
  onOpen,
}: {
  partnerId: string;
  onHold: boolean;
  currentBallSide: SxManagementPartner["currentBallSide"];
  steps: readonly PartnerProgressStep[];
  onOpen?: () => void;
}) {
  const content = (
    <>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {steps.map((step) => (
          <span
            key={step.key}
            data-progress-segment={step.phase}
            className={`h-1.5 flex-1 rounded-full ${
              onHold
                ? "bg-[#d6cebf]"
                : step.phase === "now"
                  ? currentBallSide === "sx"
                    ? "bg-[#b5533f]"
                    : currentBallSide === "partner"
                      ? "bg-[#d5bc82]"
                      : "bg-[#b8b5c8]"
                  : step.phase === "done"
                    ? "bg-[#8fb5a2]"
                    : step.phase === "goal"
                      ? "bg-[#c9bfd0]"
                      : "bg-[#e8e2d6]"
            }`}
          />
        ))}
      </span>
      <span
        className={`mt-0.5 block text-[10px] font-semibold ${onHold ? "text-[#69665d]" : "text-[#315f7d]"}`}
      >
        {onHold ? "保留" : `進行項目 ${steps.length}件`}
      </span>
    </>
  );
  const className = `block w-full min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${onOpen ? "cursor-pointer rounded-sm hover:bg-[#eef3f5]" : ""}`;
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={className}
      aria-label={`${steps.length}件の進行状況を直接修正`}
      data-testid={`sx-partner-stage-rail-${partnerId}`}
      data-step-count={steps.length}
    >
      {content}
    </button>
  ) : (
    <div
      role="img"
      aria-label={`進行状況 ${steps.length}件${onHold ? "・保留" : ""}`}
      data-testid={`sx-partner-stage-rail-${partnerId}`}
      data-step-count={steps.length}
      className={className}
    >
      {content}
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
  open: "#cbbfa0",
  in_progress: "#7ea0b7",
  waiting: "#dcb45a",
  blocked: "#b5533f",
  on_hold: "#a08bb0",
  completed: "#57a884",
  cancelled: "#c9c2b3",
};

const HOLDING_STATUS_LABEL: Record<string, string> = {
  open: "未着手",
  in_progress: "進行中",
  waiting: "待ち",
  blocked: "停止",
  on_hold: "保留",
  completed: "完了",
  cancelled: "取消",
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

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]";

/** Per-item plan connection via relatedMilestoneId. A holding item without an explicit connection is
 * reported as unconnected; the UI never infers a gate from the partner's aggregate links. */
function gateAndProofForItem(
  item: SxHoldingItem,
  milestoneTitleById: ReadonlyMap<string, string>,
  milestoneSlugById: ReadonlyMap<string, string>,
): { gateTitle: string | null; proofLabels: string[] } {
  if (!item.relatedMilestoneId) return { gateTitle: null, proofLabels: [] };
  const gateTitle = milestoneTitleById.get(item.relatedMilestoneId) || null;
  const slug = milestoneSlugById.get(item.relatedMilestoneId);
  const proofLabels =
    slug && (SX_PROOF_THEME_SLUGS as readonly string[]).includes(slug)
      ? SX_PROOF_DEFINITIONS.filter((definition) =>
          SX_THEME_PROOF_MAP[slug as SxProofThemeSlug].includes(definition.id),
        ).map((definition) => definition.label)
      : [];
  return { gateTitle, proofLabels };
}

function navChipClass(active: boolean) {
  return `inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap border-b-2 border-x-0 border-t-0 px-2.5 py-1.5 text-[10px] font-semibold ${FOCUS_RING} ${
    active
      ? "border-b-[#315f7d] bg-[#eef3f5] text-[#315f7d]"
      : "border-b-transparent bg-transparent text-[#514e47] hover:border-b-[#aaa294] hover:bg-[#f8f5ec]"
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
function ControlBandRow({
  heading,
  ariaLabel,
  children,
  className = "",
  nowrap = false,
}: {
  heading: string;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  nowrap?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 border-b border-[#e4ddd0] px-3 py-1.5 last:border-b-0 ${className}`}
    >
      <span className="w-9 shrink-0 text-[10px] font-semibold tracking-[0.08em] text-[#69665d]">
        {heading}
      </span>
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
}: {
  counts: SxControlBandCounts;
  totalPartners: number;
}) {
  return (
    <div role="group" aria-label="関係先の一本化された管制帯">
      <ControlBandRow heading="緊急" ariaLabel="緊急度の指標">
        <SxBadge tone={counts.blockedHoldings > 0 ? ALERT_TONE : NEUTRAL_TONE}>
          停止 {counts.blockedHoldings}件
        </SxBadge>
        <SxBadge tone={counts.overdue > 0 ? ALERT_TONE : NEUTRAL_TONE}>
          期限超過 {counts.overdue}件
        </SxBadge>
        <SxBadge tone={counts.dueSoon > 0 ? WARN_TONE : NEUTRAL_TONE}>
          7日以内 {counts.dueSoon}件
        </SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>
          月精度期限 {counts.dueMonthPrecision}件
        </SxBadge>
        <SxBadge tone={counts.dueUnset > 0 ? WARN_TONE : NEUTRAL_TONE}>
          期限未設定 {counts.dueUnset}件
        </SxBadge>
        <SxBadge tone={counts.ownerUnconfirmed > 0 ? FLAG_TONE : NEUTRAL_TONE}>
          担当未確認 {counts.ownerUnconfirmed}件
        </SxBadge>
      </ControlBandRow>
      <ControlBandRow heading="ボール" ariaLabel="保有側の指標">
        <SxBadge tone={NEUTRAL_TONE}>
          未完了事項 {counts.totalHoldings}件
        </SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.sx}>当方保有 {counts.sxHeld}件</SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.partner}>
          先方保有 {counts.partnerHeld}件
        </SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.shared}>
          共同 {counts.sharedHeld}件
        </SxBadge>
        <SxBadge tone={FLAG_TONE}>
          双方保有先 {counts.bothSidesHeldPartners}件
        </SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.unknown}>
          保有側未確認 {counts.sideUnknown}件
        </SxBadge>
      </ControlBandRow>
      <ControlBandRow heading="母数" ariaLabel="関係先の母数指標">
        <SxBadge tone={NEUTRAL_TONE}>全関係先 {totalPartners}件</SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>対応中 {counts.activePartners}件</SxBadge>
        <SxBadge tone={FLAG_TONE}>保留 {counts.deferredPartners}件</SxBadge>
        <SxBadge tone={FLAG_TONE}>終了 {counts.endedPartners}件</SxBadge>
        <SxBadge
          tone={counts.unclassifiedPartners > 0 ? FLAG_TONE : NEUTRAL_TONE}
        >
          未分類 {counts.unclassifiedPartners}件
        </SxBadge>
        <SxBadge
          tone={counts.unorganizedPartners > 0 ? FLAG_TONE : NEUTRAL_TONE}
        >
          空レーンあり {counts.unorganizedPartners}件
        </SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>
          登録率 {counts.organizedCoveragePct}%（対応中{counts.activePartners}
          先中）
        </SxBadge>
      </ControlBandRow>
    </div>
  );
}

/** PoC候補先とVCは、同じ関係先台帳を絞る排他的な表示タブ。 */
function CategoryNav({
  counts,
  totalCount,
  pocCount,
  vcCount,
  activeKind,
  pocOnly,
  vcOnly,
  onClear,
  onSelect,
  onSelectPoc,
  onSelectVc,
  showRoleFilter,
}: {
  counts: Partial<Record<SxPartnerRoleKind, number>>;
  totalCount: number;
  pocCount: number;
  vcCount: number;
  activeKind: SxPartnerRoleKind | null;
  pocOnly: boolean;
  vcOnly: boolean;
  onClear: () => void;
  onSelect: (kind: SxPartnerRoleKind | null) => void;
  onSelectPoc: () => void;
  onSelectVc: () => void;
  showRoleFilter: boolean;
}) {
  const entries = (Object.keys(counts) as SxPartnerRoleKind[])
    .filter((kind) => (counts[kind] || 0) > 0)
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  const allActive = activeKind === null && !pocOnly && !vcOnly;
  return (
    <div
      className="border-b border-[#e4ddd0] bg-[#fffdf7]"
      role="group"
      aria-label="関係先の絞り込み"
    >
      <ControlBandRow heading="表示" ariaLabel="表示対象の絞り込み">
        <button
          type="button"
          onClick={onClear}
          aria-pressed={allActive}
          aria-label={`絞り込みを解除して全関係先${totalCount}件を表示`}
          className={navChipClass(allActive)}
        >
          {allActive && <span aria-hidden="true">✓</span>}全関係先 {totalCount}
          件
        </button>
        <button
          type="button"
          data-testid="sx-partner-filter-poc"
          onClick={onSelectPoc}
          aria-pressed={pocOnly}
          aria-label={`PoC候補先だけを表示（${pocCount}件）`}
          className={navChipClass(pocOnly)}
        >
          {pocOnly && <span aria-hidden="true">✓</span>}PoC候補先 {pocCount}件
        </button>
        <button
          type="button"
          data-testid="sx-partner-filter-vc"
          onClick={onSelectVc}
          aria-pressed={vcOnly}
          aria-label={`VCだけを表示（${vcCount}件）`}
          className={navChipClass(vcOnly)}
        >
          {vcOnly && <span aria-hidden="true">✓</span>}VC {vcCount}件
        </button>
      </ControlBandRow>
      {showRoleFilter && entries.length > 0 && (
        <ControlBandRow heading="役割" ariaLabel="役割による絞り込み">
          {entries.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onSelect(activeKind === kind ? null : kind)}
              aria-pressed={activeKind === kind}
              aria-label={`${sxPartnerRoleKindLabel(kind)}で絞り込み（${counts[kind]}件）`}
              className={navChipClass(activeKind === kind)}
            >
              {activeKind === kind && <span aria-hidden="true">✓</span>}
              {sxPartnerRoleKindLabel(kind)} {counts[kind]}件
            </button>
          ))}
        </ControlBandRow>
      )}
    </div>
  );
}

type SxPocQuickFilter =
  "all" | "blocked" | "overdue" | "due_soon" | "stale" | "data_gap" | "sx_ball";

function pocMatchesQuickFilter(
  partner: SxManagementPartner,
  today: string,
  filter: SxPocQuickFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "sx_ball")
    return sxPartnerPrimaryIntervention(partner, today).side === "sx";
  if (filter === "blocked") return sxPartnerHasBlockedHolding(partner);
  if (filter === "overdue") return sxPartnerHasOverdue(partner, today);
  if (filter === "due_soon") return sxPartnerHasDueSoon(partner, today);
  if (filter === "stale") return sxPartnerNeedsRefresh(partner, today);
  return sxPartnerHasDataGap(partner);
}

function PartnerComparisonControls({
  partners,
  visiblePartners,
  today,
  scopeLabel,
  activeQuickFilter,
  onSelectQuickFilter,
}: {
  partners: SxManagementPartner[];
  visiblePartners: SxManagementPartner[];
  today: string;
  scopeLabel: string;
  activeQuickFilter: SxPocQuickFilter;
  onSelectQuickFilter: (filter: SxPocQuickFilter) => void;
}) {
  const quickCount = (filter: SxPocQuickFilter) =>
    partners.filter((partner) =>
      pocMatchesQuickFilter(partner, today, filter),
    ).length;
  const blockedCount = quickCount("blocked");
  const overdueCount = quickCount("overdue");
  const dueSoonCount = quickCount("due_soon");
  const staleCount = quickCount("stale");
  const sxBallCount = quickCount("sx_ball");
  const dataGapCount = quickCount("data_gap");
  const contactRecordCount = visiblePartners.filter(
    sxPartnerHasContactRecord,
  ).length;
  const quickFilterButton = (
    filter: SxPocQuickFilter,
    label: string,
    count: number,
    tone: string,
  ) => (
    <button
      type="button"
      onClick={() =>
        onSelectQuickFilter(activeQuickFilter === filter ? "all" : filter)
      }
      disabled={count === 0}
      aria-pressed={activeQuickFilter === filter}
      aria-label={`${label}${count}件で絞り込み`}
      className={`min-h-11 shrink-0 border disabled:cursor-not-allowed disabled:opacity-40 ${tone} ${FOCUS_RING}`}
    >
      <span className="block px-2 py-1 text-[10px] font-semibold">
        {activeQuickFilter === filter && <span aria-hidden="true">✓ </span>}
        {label} {count}
      </span>
    </button>
  );
  return (
      <ControlBandRow
        heading="管制"
        ariaLabel={`${scopeLabel}の件数と要対応先の絞り込み`}
        nowrap
        className="sticky top-0 z-30 h-14 bg-[#f5f1e8] py-0 shadow-[0_1px_0_#d6cebf]"
      >
        <span
          className={`shrink-0 border px-2 py-1 text-[10px] font-semibold ${NEUTRAL_TONE}`}
        >
          表示 {visiblePartners.length} / {scopeLabel} {partners.length}
        </span>
        <span
          className={`shrink-0 border px-2 py-1 text-[10px] font-semibold ${NEUTRAL_TONE}`}
        >
          接点記録あり {contactRecordCount}
        </span>
        {quickFilterButton(
          "blocked",
          "停止",
          blockedCount,
          blockedCount > 0 ? ALERT_TONE : NEUTRAL_TONE,
        )}
        {quickFilterButton(
          "overdue",
          "期限超過",
          overdueCount,
          overdueCount > 0 ? ALERT_TONE : NEUTRAL_TONE,
        )}
        {quickFilterButton(
          "due_soon",
          "7日以内",
          dueSoonCount,
          dueSoonCount > 0 ? WARN_TONE : NEUTRAL_TONE,
        )}
        {quickFilterButton(
          "stale",
          "情報更新要",
          staleCount,
          staleCount > 0 ? WARN_TONE : NEUTRAL_TONE,
        )}
        {quickFilterButton(
          "sx_ball",
          "当方が動く",
          sxBallCount,
          sxBallCount > 0 ? WARN_TONE : NEUTRAL_TONE,
        )}
        {quickFilterButton(
          "data_gap",
          "判定材料不足",
          dataGapCount,
          dataGapCount > 0 ? FLAG_TONE : NEUTRAL_TONE,
        )}
      </ControlBandRow>
  );
}

function OwnerLoadBand({
  partners,
  today,
  activeOwner,
  onSelectOwner,
}: {
  partners: SxManagementPartner[];
  today: string;
  activeOwner: string | null;
  onSelectOwner: (ownerKey: string | null) => void;
}) {
  const loads = sxPartnerOwnerLoads(partners, today);
  if (loads.length === 0) return null;
  return (
    <ControlBandRow heading="担当" ariaLabel="担当者別の未完了事項と期限リスク">
      {loads.map((load) => {
        const active = activeOwner === load.ownerKey;
        const riskText =
          load.dangerCount > 0
            ? `危険${load.dangerCount}`
            : load.dueSoonCount > 0
              ? `7日内${load.dueSoonCount}`
              : load.dataGapCount > 0
                ? `不足${load.dataGapCount}`
                : "危険0";
        return (
          <button
            key={load.ownerKey}
            type="button"
            aria-pressed={active}
            aria-label={`${load.ownerLabel}の未完了${load.openCount}件、${riskText}で絞り込み`}
            onClick={() => onSelectOwner(active ? null : load.ownerKey)}
            className={navChipClass(active)}
          >
            {active && <span aria-hidden="true">✓</span>}
            {sxNormalizePublicName(load.ownerLabel)} {load.openCount}・
            {riskText}
          </button>
        );
      })}
    </ControlBandRow>
  );
}

const HOLDING_SIDE_BADGE_LABEL: Record<string, string> = {
  sx: "当方",
  partner: "先方",
  shared: "共同",
  unknown: "保有側未確認",
};

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
  const { gateTitle, proofLabels } = gateAndProofForItem(
    item,
    milestoneTitleById,
    milestoneSlugById,
  );
  return (
    <li
      className={`border-b border-[#eee9df] py-1.5 pl-2 last:border-0 ${canManage && onEdit ? "cursor-pointer hover:bg-[#f1f6f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]" : ""}`}
      role={canManage && onEdit ? "button" : undefined}
      tabIndex={canManage && onEdit ? 0 : undefined}
      aria-label={
        canManage && onEdit
          ? `${partnerName} - ${sxNormalizePublicName(item.title)}を直接修正`
          : undefined
      }
      onClick={canManage && onEdit ? () => onEdit(item.id) : undefined}
      onKeyDown={
        canManage && onEdit
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit(item.id);
              }
            }
          : undefined
      }
      style={{
        borderLeft: `3px solid ${HOLDING_STATUS_LINE[item.status] || HOLDING_STATUS_LINE.open}`,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <SxBadge tone="border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]">
            {item.itemKindLabel}
          </SxBadge>
          <SxBadge
            tone={HOLDING_STATUS_TONE[item.status] || HOLDING_STATUS_TONE.open}
          >
            {HOLDING_STATUS_LABEL[item.status] || "未確認"}
          </SxBadge>
          {showSideBadge && (
            <SxBadge tone={BALL_SIDE_TONE[showSideBadge]}>
              {HOLDING_SIDE_BADGE_LABEL[showSideBadge]}
            </SxBadge>
          )}
          {monthPrecision && (
            <SxBadge tone="border-[#d6cebf] bg-white text-[#69665d]">
              月精度
            </SxBadge>
          )}
        </div>
      </div>
      <p className="mt-1 text-[11px] font-semibold leading-4 text-[#24231f]">
        {nominalizeSxActionLabel(sxNormalizePublicName(item.title))}
      </p>
      {item.detail && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">
          {sxNormalizePublicName(item.detail)}
        </p>
      )}
      <p
        className={`mt-0.5 text-[10px] ${overdue ? "font-semibold text-[#8c3329]" : "text-[#69665d]"}`}
      >
        担当{" "}
        {item.ownerLabel
          ? sxNormalizePublicName(item.ownerLabel)
          : "担当未確認"}{" "}
        ・ {sxFormatDueDateWithPrecision(item.dueDate, item.dueDatePrecision)}
      </p>
      {/* sourceEvidence (一次根拠 — a commitment's primary backing, present regardless of status) and
          completionEvidence (完了の証拠 — proof a work item is actually done) are separate claims and
          must never be merged into one line (2026-07-24 P1 fix: an open commitment's 一次根拠 used to
          render mislabeled as "完了の証拠" even before anything was completed). */}
      {item.sourceEvidence && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">
          一次根拠: {sxNormalizePublicName(item.sourceEvidence)}
        </p>
      )}
      {item.completionCriteria && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">
          完了条件: {sxNormalizePublicName(item.completionCriteria)}
        </p>
      )}
      {item.completedOn && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#205f49]">
          完了日: {sxFormatDate(item.completedOn)}
        </p>
      )}
      {item.completionEvidence && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#205f49]">
          完了の証拠: {sxNormalizePublicName(item.completionEvidence)}
        </p>
      )}
      {item.acceptedBy && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#205f49]">
          受領者: {sxNormalizePublicName(item.acceptedBy)}
          {item.acceptedOn ? ` ・ 受領日 ${sxFormatDate(item.acceptedOn)}` : ""}
        </p>
      )}
      <p className="mt-0.5 text-[10px] leading-4 text-[#69665d]">
        関連工程: {gateTitle || "工程未接続"}
        {proofLabels.length > 0 && (
          <span className="text-[#315f7d]">
            {" "}
            ・ 証明: {proofLabels.join(" / ")}
          </span>
        )}
      </p>
      {/* 出典/最終確認/確度 — read-only provenance audit trail for every viewer, not just canManage
          (spec: 全件監査表示で「出典」「最終確認」「確度」を見える化). sourceRef is never rendered
          verbatim — sxSourceRefDisplayLabel masks raw URLs/internal tracking-key shapes first. */}
      <p className="mt-0.5 text-[10px] leading-4 text-[#69665d]">
        出典: {sxSourceKindLabel(item.sourceKind)}
        {sxSourceRefDisplayLabel(item.sourceRef)
          ? ` (${sxSourceRefDisplayLabel(item.sourceRef)})`
          : ""}
        {" ・ "}最終確認 {sxFormatDate(item.lastVerifiedAt)}
        {" ・ "}確度 {sxConfidenceLabel(item.confidence)}
      </p>
      <span className="sr-only">{partnerName}の保有事項</span>
    </li>
  );
}

const PARTNER_CONTROL_INNER_GRID =
  "@min-[1280px]:grid-cols-[160px_minmax(270px,1.4fr)_minmax(150px,0.9fr)_minmax(190px,1.2fr)_126px_minmax(150px,1fr)]";
const PARTNER_CONTROL_HEADER_GRID =
  "@min-[1280px]:grid-cols-[160px_minmax(270px,1.4fr)_minmax(150px,0.9fr)_minmax(190px,1.2fr)_126px_minmax(150px,1fr)_104px]";

type PartnerGateImpact = {
  title: string;
  critical: boolean;
  connected: boolean;
};

function partnerGateImpact(
  intervention: SxPartnerPrimaryIntervention,
  milestoneTitleById: ReadonlyMap<string, string>,
  milestoneSlugById: ReadonlyMap<string, string>,
  milestoneTitleBySlug: ReadonlyMap<string, string>,
  criticalPathSlugs: ReadonlySet<string>,
): PartnerGateImpact {
  const slug = intervention.relatedMilestoneId
    ? milestoneSlugById.get(intervention.relatedMilestoneId) || null
    : intervention.relatedMilestoneSlug;
  const title = intervention.relatedMilestoneId
    ? milestoneTitleById.get(intervention.relatedMilestoneId) ||
      "関連工程未確認"
    : slug
      ? milestoneTitleBySlug.get(slug) || "関連工程未確認"
      : "PJ影響 未接続";
  return {
    title,
    critical: Boolean(slug && criticalPathSlugs.has(slug)),
    connected: Boolean(intervention.relatedMilestoneId || slug),
  };
}

function interventionStatusLabel(
  intervention: SxPartnerPrimaryIntervention,
): string {
  if (!intervention.hasStructuredHolding) return "構造化保有事項 未登録";
  if (intervention.risk === "blocked") return "停止";
  if (intervention.risk === "overdue") return "期限超過";
  if (intervention.risk === "due_soon") return "7日以内";
  if (intervention.risk === "waiting") return "待ち";
  return HOLDING_STATUS_LABEL[intervention.status] || "進行中";
}

function interventionTone(intervention: SxPartnerPrimaryIntervention): string {
  if (intervention.risk === "blocked" || intervention.risk === "overdue")
    return ALERT_TONE;
  if (intervention.risk === "due_soon") return WARN_TONE;
  if (!intervention.hasStructuredHolding || !intervention.hasConcreteAction)
    return FLAG_TONE;
  if (intervention.risk === "waiting") return BALL_SIDE_TONE.partner;
  return NEUTRAL_TONE;
}

function interventionOwnerText(
  intervention: SxPartnerPrimaryIntervention,
  partnerName: string,
): string {
  if (!intervention.ownerLabel) return "担当未確認";
  return sxCompactPartnerRowText(
    sxNormalizePublicName(intervention.ownerLabel),
    partnerName,
  );
}

function interventionSideText(
  intervention: SxPartnerPrimaryIntervention,
): string {
  return intervention.side === "sx"
    ? "当方"
    : intervention.side === "partner"
      ? "先方"
      : intervention.side === "shared"
        ? "双方"
        : "保有側未確認";
}

function PocComparisonDetailModal({
  partner,
  canManage,
  today,
  milestoneTitleBySlug,
  milestoneTitleById,
  milestoneSlugById,
  criticalPathSlugs,
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
  milestoneTitleBySlug: ReadonlyMap<string, string>;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  criticalPathSlugs: ReadonlySet<string>;
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const intervention = sxPartnerPrimaryIntervention(partner, today);
  const impact = partnerGateImpact(
    intervention,
    milestoneTitleById,
    milestoneSlugById,
    milestoneTitleBySlug,
    criticalPathSlugs,
  );
  const openHoldings = sxSortHoldingsByPriority(
    sxHoldingsForPartner(partner),
    today,
  );
  const workItemIds = new Set(partner.workItems.map((item) => item.id));
  const allInteractions = sxSortInteractionsByRecency(partner.interactions);
  const closedWorkItems = sxSortHoldingsByPriority(
    sxAllHoldingsForPartnerAudit(partner).filter(
      (item) =>
        workItemIds.has(item.id) &&
        (item.status === "completed" || item.status === "cancelled"),
    ),
    today,
  );
  const closedCommitments = partner.commitments.filter(
    (item) => item.status === "completed" || item.status === "cancelled",
  );

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-[#24231f]/35 p-0 sm:place-items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-xl border border-[#d6cebf] bg-[#fffdf7] shadow-2xl sm:max-w-4xl sm:rounded-xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#e4ddd0] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">
              関係先詳細
            </p>
            <h4
              id={titleId}
              className="truncate text-base font-semibold text-[#24231f]"
            >
              {display.name}
            </h4>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={`${display.name}の詳細を閉じる`}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#cfc7b9] text-[#514e47] hover:bg-[#f8f5ec] ${FOCUS_RING}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <section aria-labelledby={`${titleId}-control`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                id={`${titleId}-control`}
                className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]"
              >
                現在の管制サマリー
              </p>
              <SxBadge tone={interventionTone(intervention)}>
                {interventionStatusLabel(intervention)}
              </SxBadge>
            </div>
            <div
              className={`mt-2 grid gap-px overflow-hidden border border-[#e4ddd0] bg-[#e4ddd0] sm:grid-cols-2 lg:grid-cols-3 ${canManage && onEditPartner ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]" : ""}`}
              role={canManage && onEditPartner ? "button" : undefined}
              tabIndex={canManage && onEditPartner ? 0 : undefined}
              aria-label={
                canManage && onEditPartner
                  ? `${display.name}の現在値を直接修正`
                  : undefined
              }
              onClick={
                canManage && onEditPartner
                  ? () => onEditPartner(partner.id)
                  : undefined
              }
              onKeyDown={
                canManage && onEditPartner
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onEditPartner(partner.id);
                      }
                    }
                  : undefined
              }
            >
              <div className="bg-white p-3">
                <p className="text-[10px] font-semibold text-[#69665d]">
                  次にやること
                </p>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#24231f]">
                  {nominalizeSxNextActionLabel(
                    sxNormalizePublicName(intervention.title),
                  )}
                </p>
                {!intervention.hasStructuredHolding && (
                  <p className="mt-1 text-[10px] leading-4 text-[#5f4a66]">
                    保有事項台帳との紐づけが必要
                  </p>
                )}
              </div>
              <div className="bg-white p-3">
                <p className="text-[10px] font-semibold text-[#69665d]">
                  担当・保有側
                </p>
                <p className="mt-1 text-[12px] font-semibold text-[#24231f]">
                  {interventionOwnerText(intervention, display.name)}
                </p>
                <p className="mt-1 text-[10px] text-[#69665d]">
                  {interventionSideText(intervention)} ・{" "}
                  {sxFormatDueDateWithPrecision(
                    intervention.dueDate,
                    intervention.dueDatePrecision,
                  )}
                </p>
              </div>
              <div className="bg-white p-3">
                <p className="text-[10px] font-semibold text-[#69665d]">
                  PJへの影響
                </p>
                <p
                  className={`mt-1 text-[12px] font-semibold leading-5 ${impact.critical ? "text-[#8c3329]" : "text-[#24231f]"}`}
                >
                  {impact.title}
                </p>
                <p className="mt-1 text-[10px] text-[#69665d]">
                  {impact.critical
                    ? "重要経路上"
                    : impact.connected
                      ? "関連工程"
                      : "影響先の接続が必要"}
                </p>
              </div>
              <div className="bg-white p-3">
                <p className="text-[10px] font-semibold text-[#69665d]">
                  関係の現在地
                </p>
                <p className="mt-1 text-[12px] font-semibold text-[#24231f]">
                  {sxPartnerIsOnHold(partner)
                    ? "保留"
                    : `進行項目 ${buildPartnerProgressSteps(partner).length}件`}
                </p>
              </div>
              <div className="bg-white p-3">
                <p className="text-[10px] font-semibold text-[#69665d]">
                  最終確認
                </p>
                <p className="mt-1 text-[12px] font-semibold text-[#24231f]">
                  {sxFormatDate(intervention.lastVerifiedAt)}
                </p>
                <p className="mt-1 text-[10px] text-[#69665d]">
                  確度 {sxConfidenceLabel(partner.confidence)}
                </p>
              </div>
              <div className="bg-white p-3">
                <p className="text-[10px] font-semibold text-[#69665d]">
                  保存済みの記録
                </p>
                <p className="mt-1 text-[12px] font-semibold text-[#24231f]">
                  履歴 {allInteractions.length}件 ・ 未完了保有{" "}
                  {openHoldings.length}件
                </p>
                <p className="mt-1 text-[10px] text-[#69665d]">
                  この下で全文を確認
                </p>
              </div>
            </div>
          </section>

          {canManage && onAddRole && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAddRole(partner.id)}
                className={`inline-flex min-h-11 items-center gap-1 border border-[#cfc7b9] px-3 text-[11px] font-semibold ${FOCUS_RING}`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                分類を追加
              </button>
            </div>
          )}

          <section
            className="mt-5 border-t border-[#e4ddd0] pt-4"
            aria-labelledby={`${titleId}-holdings`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                id={`${titleId}-holdings`}
                className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]"
              >
                未完了の保有事項・約束 {openHoldings.length}件
              </p>
              {canManage && onAddWorkItem && (
                <div
                  className="flex flex-wrap gap-1"
                  aria-label={`${display.name}の保有事項を追加`}
                >
                  {(["sx", "partner", "shared", "unknown"] as const).map(
                    (side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => onAddWorkItem(partner.id, side)}
                        className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-2 text-[10px] font-semibold ${FOCUS_RING}`}
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        {side === "sx"
                          ? "当方"
                          : side === "partner"
                            ? "先方"
                            : side === "shared"
                              ? "双方"
                              : "未確認"}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
            {openHoldings.length > 0 ? (
              <ul className="mt-2 divide-y divide-[#eee9df] border-y border-[#e4ddd0] bg-white">
                {openHoldings.map((item) => (
                  <HoldingRow
                    key={item.id}
                    item={item}
                    partnerName={display.name}
                    today={today}
                    milestoneTitleById={milestoneTitleById}
                    milestoneSlugById={milestoneSlugById}
                    showSideBadge={item.side}
                    canManage={canManage}
                    onEdit={
                      workItemIds.has(item.id) ? onEditWorkItem : undefined
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-2 border-l-4 border-[#8f7aa0] bg-[#f1edf3] px-3 py-2 text-[11px] leading-5 text-[#5f4a66]">
                構造化された保有事項はまだない。上の次アクションは関係先本体の記録から表示してる。
              </p>
            )}
          </section>

          <section
            className="mt-5 border-t border-[#e4ddd0] pt-4"
            aria-labelledby={`${titleId}-history`}
          >
            <div className="flex items-center justify-between gap-2">
              <p
                id={`${titleId}-history`}
                className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]"
              >
                やり取り履歴（全文・全{allInteractions.length}件）
              </p>
              {canManage && onAddInteraction && (
                <button
                  type="button"
                  onClick={() => onAddInteraction(partner.id)}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-3 text-[10px] font-semibold ${FOCUS_RING}`}
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  履歴を追加
                </button>
              )}
            </div>
            {allInteractions.length > 0 ? (
              <ul className="mt-2 divide-y divide-[#eee9df] border-y border-[#e4ddd0] bg-white">
                {allInteractions.map((interaction) => (
                  <InteractionFullRow
                    key={interaction.id}
                    interaction={interaction}
                    partnerName={display.name}
                    canManage={canManage}
                    onEdit={onEditInteraction}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-2 border border-dashed border-[#d6cebf] p-3 text-[11px] text-[#69665d]">
                保存済みのやり取り履歴はまだない。
              </p>
            )}
          </section>

          <section
            className="mt-5 border-t border-[#e4ddd0] pt-4"
            aria-labelledby={`${titleId}-context`}
          >
            <p
              id={`${titleId}-context`}
              className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]"
            >
              関係の目標・合意範囲・出典
            </p>
            <dl className="mt-2 grid gap-px overflow-hidden rounded-md border border-[#e4ddd0] bg-[#e4ddd0] sm:grid-cols-2">
              <div className="bg-white p-3">
                <dt className="text-[10px] font-semibold text-[#69665d]">
                  目標状態
                </dt>
                <dd className="mt-1 text-[11px] leading-5 text-[#24231f]">
                  {partner.targetState
                    ? sxNormalizePublicName(partner.targetState)
                    : "未登録"}
                </dd>
              </div>
              <div className="bg-white p-3">
                <dt className="text-[10px] font-semibold text-[#69665d]">
                  合意済み
                </dt>
                <dd className="mt-1 text-[11px] leading-5 text-[#24231f]">
                  {partner.agreedScope
                    ? sxNormalizePublicName(partner.agreedScope)
                    : "未登録"}
                </dd>
              </div>
              <div className="bg-white p-3">
                <dt className="text-[10px] font-semibold text-[#69665d]">
                  未合意
                </dt>
                <dd className="mt-1 text-[11px] leading-5 text-[#24231f]">
                  {partner.unagreedScope
                    ? sxNormalizePublicName(partner.unagreedScope)
                    : "未登録"}
                </dd>
              </div>
              <div className="bg-white p-3">
                <dt className="text-[10px] font-semibold text-[#69665d]">
                  出典・確度
                </dt>
                <dd className="mt-1 text-[11px] leading-5 text-[#24231f]">
                  {sxSourceKindLabel(partner.sourceKind)}
                  {sxSourceRefDisplayLabel(partner.sourceRef)
                    ? ` ・ ${sxSourceRefDisplayLabel(partner.sourceRef)}`
                    : ""}{" "}
                  ・ {sxConfidenceLabel(partner.confidence)}
                </dd>
              </div>
            </dl>
            {partner.roles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {partner.roles.map((role) => (
                  <div
                    key={role.id}
                    className={`flex min-h-11 items-center gap-1.5 border border-[#e4ddd0] bg-white px-2 text-[10px] ${canManage && onEditRole ? "cursor-pointer hover:bg-[#f1f6f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]" : ""}`}
                    role={canManage && onEditRole ? "button" : undefined}
                    tabIndex={canManage && onEditRole ? 0 : undefined}
                    aria-label={
                      canManage && onEditRole
                        ? `${display.name}の分類を直接修正`
                        : undefined
                    }
                    onClick={
                      canManage && onEditRole
                        ? () => onEditRole(role.id)
                        : undefined
                    }
                    onKeyDown={
                      canManage && onEditRole
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onEditRole(role.id);
                            }
                          }
                        : undefined
                    }
                  >
                    <span className="font-semibold text-[#24231f]">
                      {role.isPrimary ? "主分類" : "副分類"}・
                      {sxPartnerRoleKindLabel(role.roleKind)}
                    </span>
                    <span className="text-[#69665d]">
                      {sxRelationshipStateLabel(role.relationshipState)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(closedWorkItems.length > 0 || closedCommitments.length > 0) && (
            <details className="mt-5 border-t border-[#e4ddd0] pt-3">
              <summary
                className={`flex min-h-11 cursor-pointer items-center text-[10px] font-semibold text-[#69665d] ${FOCUS_RING}`}
              >
                完了・取消の保有事項{" "}
                {closedWorkItems.length + closedCommitments.length}件
              </summary>
              {closedWorkItems.length > 0 && (
                <ul className="divide-y divide-[#eee9df] border-y border-[#e4ddd0] bg-white">
                  {closedWorkItems.map((item) => (
                    <HoldingRow
                      key={item.id}
                      item={item}
                      partnerName={display.name}
                      today={today}
                      milestoneTitleById={milestoneTitleById}
                      milestoneSlugById={milestoneSlugById}
                      showSideBadge={item.side}
                      canManage={canManage}
                      onEdit={onEditWorkItem}
                    />
                  ))}
                </ul>
              )}
              {closedCommitments.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-[#eee9df] bg-white p-3 text-[11px]"
                >
                  <p className="font-semibold text-[#24231f]">
                    {nominalizeSxActionLabel(sxNormalizePublicName(item.title))}
                  </p>
                  <p className="mt-1 text-[#69665d]">
                    {item.status === "completed" ? "完了" : "取消"} ・{" "}
                    {sxFormatDate(item.completedOn)}
                  </p>
                </div>
              ))}
            </details>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * これまでの接点 → 現在地 → これから → ゴール。
 * 会社名下のrailと同じstepsを受け取り、件数と順序のずれを起こさない。
 */
function PartnerProgressFlow({
  partner,
  displayName,
  steps,
}: {
  partner: SxManagementPartner;
  displayName: string;
  steps: readonly PartnerProgressStep[];
}) {
  const flowRef = useRef<HTMLOListElement>(null);
  const stepSignature = steps.map((step) => step.key).join("|");
  useEffect(() => {
    const flow = flowRef.current;
    const current = flow?.querySelector<HTMLElement>(
      '[data-progress-step="now"]',
    );
    if (!flow || !current || flow.scrollWidth <= flow.clientWidth) return;
    flow.scrollLeft = Math.max(0, current.offsetLeft - flow.offsetLeft - 8);
  }, [stepSignature]);
  const nowTone =
    partner.currentBallSide === "sx"
      ? "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]"
      : partner.currentBallSide === "partner"
        ? "border-[#d5bc82] bg-[#fbf1dc] text-[#765022]"
        : "border-[#b8b5c8] bg-[#f1f0f6] text-[#55506d]";
  return (
    <div
      className="min-w-0 overflow-hidden"
      data-testid={`sx-partner-progress-${partner.id}`}
      data-step-count={steps.length}
    >
      <p className="text-[10px] font-semibold text-[#69665d] @min-[1280px]:hidden">
        進行状況
      </p>
      <ol
        ref={flowRef}
        tabIndex={0}
        className={`mt-1 flex items-stretch gap-0 overflow-x-auto pb-1 @min-[1280px]:mt-0 ${FOCUS_RING}`}
        aria-label={`${displayName}の進行状況`}
      >
        {steps.map((step, index) => (
          <li
            key={step.key}
            data-progress-step={step.phase}
            className="flex min-w-0 items-stretch"
          >
            <div
              className={`flex w-[138px] min-w-[124px] flex-col gap-0.5 rounded-md border px-2 py-1 ${
                step.phase === "done"
                  ? "border-[#c9d9cf] bg-[#f1f6f2] text-[#205f49]"
                  : step.phase === "now"
                    ? `border-2 ${nowTone}`
                    : step.phase === "goal"
                      ? "border-[#c9bfd0] bg-[#f6f3f8] text-[#5f4a66]"
                      : "border-dashed border-[#cfc7b9] bg-[#fffdf7] text-[#514e47]"
              }`}
            >
              <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide">
                {step.phase === "done" && (
                  <CircleCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                {step.phase === "now" && (
                  <CircleDot className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                {step.phase === "goal" && (
                  <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                {step.sub}
              </span>
              <span
                className="line-clamp-2 text-[11px] font-semibold leading-[1.3]"
                title={step.title}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                className="flex shrink-0 items-center px-0.5 text-[#9b9487]"
                aria-hidden="true"
              >
                <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PartnerComparisonRow({
  partner,
  milestoneTitleBySlug,
  milestoneTitleById,
  milestoneSlugById,
  criticalPathSlugs,
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
  milestoneTitleBySlug: ReadonlyMap<string, string>;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  criticalPathSlugs: ReadonlySet<string>;
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
  const latest = sxLatestInteraction(partner.interactions);
  const holdings = sxHoldingsForPartner(partner);
  const intervention = sxPartnerPrimaryIntervention(partner, today);
  const impact = partnerGateImpact(
    intervention,
    milestoneTitleById,
    milestoneSlugById,
    milestoneTitleBySlug,
    criticalPathSlugs,
  );
  const actionText = sxCompactPartnerRowText(
    nominalizeSxNextActionLabel(sxNormalizePublicName(intervention.title)),
    display.name,
  );
  const latestSummary = latest
    ? sxCompactPartnerRowText(
        sxNormalizePublicName(latest.outcomeSummary || latest.summary),
        display.name,
      )
    : "保存済み履歴なし";
  const nameHeadingId = `sx-partner-name-${partner.id}`;
  const bottleneckLabel = !intervention.hasStructuredHolding
    ? "管制情報不足"
    : intervention.risk === "blocked"
      ? "停止中"
      : intervention.risk === "overdue"
        ? "期限超過"
        : intervention.risk === "due_soon"
          ? "期限接近"
          : intervention.risk === "waiting"
            ? "待ち状態"
            : "進行中";
  return (
    <article
      id={`sx-partner-${partner.id}`}
      data-sx-anchor={`sx-partner-${partner.id}`}
      data-testid={`sx-partner-comparison-row-${partner.id}`}
      tabIndex={-1}
      aria-labelledby={nameHeadingId}
      className="scroll-mt-24 border-b border-[#eee9df] bg-[#fffdf7]"
    >
      <div className="grid grid-cols-1 items-stretch gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_104px]">
        <div
          className={`grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2 ${PARTNER_CONTROL_INNER_GRID}`}
        >
          <div className="min-w-0 md:col-span-2 @min-[1280px]:col-span-1">
            <button
              type="button"
              id={nameHeadingId}
              disabled={!canManage || !onEditPartner}
              onClick={() => onEditPartner?.(partner.id)}
              className="block min-h-11 w-full truncate rounded-sm text-left text-[12px] font-semibold text-[#24231f] enabled:cursor-pointer enabled:hover:bg-[#eef3f5] enabled:hover:underline disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
              aria-label={`${display.name}の基本情報を直接修正`}
            >
              {display.name}
            </button>
            <p className="text-[10px] text-[#69665d]">
              最終確認 {sxFormatDate(partner.lastVerifiedAt)}
            </p>
            <div className="mt-1.5">
              <PartnerStageRail
                partnerId={partner.id}
                onHold={sxPartnerIsOnHold(partner)}
                currentBallSide={partner.currentBallSide}
                steps={steps}
                onOpen={
                  canManage && onEditPartner
                    ? () => onEditPartner(partner.id)
                    : undefined
                }
              />
            </div>
          </div>

          <div className="min-w-0 md:col-span-2 @min-[1280px]:col-span-1">
            <PartnerProgressFlow
              partner={partner}
              displayName={display.name}
              steps={steps}
            />
          </div>

          <div className="min-w-0 border-l-2 border-[#d6cebf] pl-2">
            <p className="text-[10px] font-semibold text-[#69665d] @min-[1280px]:hidden">
              詰まり・PJ影響
            </p>
            <span
              className={`inline-block border px-1.5 py-0.5 text-[10px] font-semibold ${interventionTone(intervention)}`}
            >
              {bottleneckLabel}
            </span>
            <p
              className={`mt-1 line-clamp-2 text-[10px] font-semibold leading-4 ${impact.critical ? "text-[#8c3329]" : "text-[#24231f]"}`}
              title={impact.title}
            >
              {impact.critical
                ? "重要経路："
                : impact.connected
                  ? "止まる先："
                  : ""}
              {impact.title}
            </p>
            {!intervention.hasStructuredHolding && (
              <p className="mt-0.5 text-[10px] leading-4 text-[#5f4a66]">
                具体的な保有事項との紐づけなし
              </p>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[#69665d] @min-[1280px]:hidden">
              次にやること
            </p>
            <p
              className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#24231f]"
              title={actionText}
            >
              {actionText}
            </p>
            <p className="mt-1 text-[10px] text-[#69665d]">
              {interventionStatusLabel(intervention)}
              {holdings.length > 1 ? ` ・ ほか${holdings.length - 1}件` : ""}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[#69665d] @min-[1280px]:hidden">
              担当・期限
            </p>
            <p
              className="truncate text-[11px] font-semibold text-[#24231f]"
              title={interventionOwnerText(intervention, display.name)}
            >
              {interventionOwnerText(intervention, display.name)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span
                className={`border px-1.5 py-0.5 text-[10px] font-semibold ${BALL_SIDE_TONE[intervention.side]}`}
              >
                {interventionSideText(intervention)}
              </span>
              <span
                className={`text-[10px] ${intervention.risk === "overdue" ? "font-semibold text-[#8c3329]" : "text-[#69665d]"}`}
              >
                {sxFormatDueDateWithPrecision(
                  intervention.dueDate,
                  intervention.dueDatePrecision,
                )}
              </span>
            </div>
          </div>

          <div className="min-w-0 md:col-span-2 @min-[1280px]:col-span-1">
            <p className="text-[10px] font-semibold text-[#69665d] @min-[1280px]:hidden">
              現在地の根拠
            </p>
            {latest ? (
              <>
                <p className="text-[10px] text-[#69665d]">
                  {sxFormatEventDateWithPrecision(
                    latest.occurredOn,
                    latest.occurredOnPrecision,
                  )}{" "}
                  ・ {sxInteractionKindLabel(latest.interactionKind)}
                </p>
                <p
                  className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[#24231f]"
                  title={latestSummary}
                >
                  {latestSummary}
                </p>
              </>
            ) : (
              <p className="text-[10px] leading-4 text-[#5f4a66]">
                保存済み履歴なし
              </p>
            )}
            <p
              className={`mt-0.5 text-[10px] ${sxPartnerNeedsRefresh(partner, today) ? "font-semibold text-[#765022]" : "text-[#69665d]"}`}
            >
              最終確認 {sxFormatDate(partner.lastVerifiedAt)}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => onToggleExpand(partner.id)}
          aria-label={`${display.name}の履歴${partner.interactions.length}件・保有${holdings.length}件を開く`}
          className={`min-h-11 self-stretch rounded-md border border-[#cfc7b9] px-2 text-[10px] font-semibold leading-4 text-[#315f7d] hover:bg-[#eef3f5] sm:self-stretch ${FOCUS_RING}`}
        >
          履歴 {partner.interactions.length}件 ・ 保有 {holdings.length}件
        </button>
      </div>
      {expanded && (
        <PocComparisonDetailModal
          partner={partner}
          canManage={canManage}
          today={today}
          milestoneTitleBySlug={milestoneTitleBySlug}
          milestoneTitleById={milestoneTitleById}
          milestoneSlugById={milestoneSlugById}
          criticalPathSlugs={criticalPathSlugs}
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
  const [activeRoleKind, setActiveRoleKind] =
    useState<SxPartnerRoleKind | null>(null);
  const [pocOnly, setPocOnly] = useState(true);
  const [vcOnly, setVcOnly] = useState(false);
  const [activePocQuickFilter, setActivePocQuickFilter] =
    useState<SxPocQuickFilter>("all");
  const [activeOwnerKey, setActiveOwnerKey] = useState<string | null>(null);
  const milestoneTitleBySlug = new Map(
    management.milestones.map((milestone) => [
      milestone.slug,
      nominalizeSxActionLabel(milestone.title),
    ]),
  );
  const milestoneTitleById = new Map(
    management.milestones.map((milestone) => [
      milestone.id,
      nominalizeSxActionLabel(milestone.title),
    ]),
  );
  const milestoneSlugById = new Map(
    management.milestones.map((milestone) => [milestone.id, milestone.slug]),
  );
  const criticalPathSlugs = new Set(management.judgment.criticalPathSlugs);

  // PoC候補先とVCは、同じ関係先台帳を絞る表示属性。別台帳は作らない。
  const pocPartners = management.partners.filter(sxIsPocPartner);
  const vcPartners = management.partners.filter(sxIsVcPartner);
  const comparisonOnly = pocOnly || vcOnly;
  const matchesRole = (partner: SxManagementPartner) =>
    activeRoleKind === null ||
    (partner.roles.find((role) => role.isPrimary)?.roleKind ||
      "unclassified") === activeRoleKind;
  const comparisonScopePartners = pocOnly
    ? pocPartners
    : vcOnly
      ? vcPartners
      : [];
  const ownerScopePartners = comparisonOnly
    ? comparisonScopePartners.filter((partner) =>
        pocMatchesQuickFilter(partner, management.asOf, activePocQuickFilter),
      )
    : management.partners.filter(matchesRole);
  const activeOwnerPartnerIds = activeOwnerKey
    ? new Set(
        sxPartnerOwnerLoads(ownerScopePartners, management.asOf).find(
          (load) => load.ownerKey === activeOwnerKey,
        )?.partnerIds || [],
      )
    : null;
  const filterablePartners = activeOwnerPartnerIds
    ? ownerScopePartners.filter((partner) =>
        activeOwnerPartnerIds.has(partner.id),
      )
    : ownerScopePartners;
  const comparisonPartners = [...filterablePartners].sort((left, right) =>
    sxComparePartnersForPoc(left, right, management.asOf, "attention"),
  );
  // Both trailing sections read from the role-filtered list too (spec P1: role filter中の保留欄も選択
  // roleに合うものだけ) — selecting a category must narrow 保留/終了 exactly like the main groups.
  const deferredPartners = comparisonOnly
    ? []
    : filterablePartners.filter((partner) => partner.deferredLowPriority);
  const endedPartners = comparisonOnly
    ? []
    : filterablePartners.filter(
        (partner) => !partner.deferredLowPriority && sxIsPartnerEnded(partner),
      );
  const groups = comparisonOnly
    ? []
    : sxGroupPartnersByPrimaryClassification(filterablePartners);

  // 通常台帳の管制帯は全関係先、PoC比較の要対応集計は表示中PoC先を分母にする。
  const countScopePartners = comparisonOnly ? ownerScopePartners : management.partners;
  const counts = sxComputeControlBandCounts(
    countScopePartners,
    management.asOf,
  );
  const roleCounts = sxPrimaryRoleKindCounts(management.partners);

  const rowProps = {
    milestoneTitleBySlug,
    milestoneTitleById,
    milestoneSlugById,
    criticalPathSlugs,
    canManage: management.canManage,
    today: management.asOf,
    expandedId,
    onToggleExpand: (partnerId: string) =>
      setExpandedId((current) => (current === partnerId ? null : partnerId)),
    onEditPartner,
    onAddInteraction,
    onEditInteraction,
    onAddWorkItem,
    onEditWorkItem,
    onAddRole,
    onEditRole,
  };

  return (
    <div
      className="relative isolate @container rounded-lg border border-[#d6cebf] bg-[#fffdf7]"
      data-testid="sx-partner-pipeline"
    >
      <div className="hidden rounded-t-[7px] border-b border-[#e4ddd0] bg-[#f8f5ec] px-3 py-2 md:block">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">
          関係先の進捗比較
        </p>
        <h3 className="mt-0.5 text-sm font-semibold text-[#24231f]">
          接点・現在地・次の行動・ゴールを、1社1行で確認
        </h3>
      </div>
      {!comparisonOnly && (
        <>
          <div className="flex flex-wrap gap-1.5 border-b border-[#e4ddd0] bg-[#fffdf7] px-3 py-2 md:hidden">
            <SxBadge tone={NEUTRAL_TONE}>
              関係先 {countScopePartners.length}
            </SxBadge>
            <SxBadge tone={counts.overdue > 0 ? ALERT_TONE : NEUTRAL_TONE}>
              期限超過 {counts.overdue}
            </SxBadge>
            <SxBadge tone={counts.sxHeld > 0 ? WARN_TONE : NEUTRAL_TONE}>
              当方が動く {counts.sxHeld}
            </SxBadge>
            <SxBadge
              tone={counts.ownerUnconfirmed > 0 ? FLAG_TONE : NEUTRAL_TONE}
            >
              担当未確認 {counts.ownerUnconfirmed}
            </SxBadge>
          </div>
          <div className="hidden md:block">
            <ControlBand
              counts={counts}
              totalPartners={countScopePartners.length}
            />
          </div>
        </>
      )}
      <CategoryNav
        counts={roleCounts}
        totalCount={management.partners.length}
        pocCount={pocPartners.length}
        vcCount={vcPartners.length}
        activeKind={activeRoleKind}
        pocOnly={pocOnly}
        vcOnly={vcOnly}
        onClear={() => {
          setPocOnly(false);
          setVcOnly(false);
          setActiveRoleKind(null);
          setActivePocQuickFilter("all");
          setActiveOwnerKey(null);
        }}
        onSelect={(kind) => {
          setActiveRoleKind(kind);
          setActiveOwnerKey(null);
        }}
        onSelectPoc={() => {
          setPocOnly(true);
          setVcOnly(false);
          setActiveRoleKind(null);
          setActivePocQuickFilter("all");
          setActiveOwnerKey(null);
        }}
        onSelectVc={() => {
          setPocOnly(false);
          setVcOnly(true);
          setActiveRoleKind(null);
          setActivePocQuickFilter("all");
          setActiveOwnerKey(null);
        }}
        showRoleFilter={!comparisonOnly}
      />
      <div className="hidden md:block">
        <OwnerLoadBand
          partners={ownerScopePartners}
          today={management.asOf}
          activeOwner={activeOwnerKey}
          onSelectOwner={setActiveOwnerKey}
        />
      </div>
      {comparisonOnly && (
        <PartnerComparisonControls
          partners={comparisonScopePartners}
          visiblePartners={comparisonPartners}
          today={management.asOf}
          scopeLabel={pocOnly ? "PoC候補先" : "VC"}
          activeQuickFilter={activePocQuickFilter}
          onSelectQuickFilter={(filter) => {
            setActivePocQuickFilter(filter);
            setActiveOwnerKey(null);
          }}
        />
      )}

      <div
        className={`${comparisonOnly ? "sticky top-14 z-20 shadow-[0_1px_0_#d6cebf]" : ""} hidden ${PARTNER_CONTROL_HEADER_GRID} gap-2 border-b border-[#e4ddd0] bg-[#f8f5ec] px-3 py-1.5 text-[10px] font-semibold text-[#69665d] @min-[1280px]:grid`}
      >
        <span>関係先</span>
        <span>進行状況</span>
        <span>詰まり・PJ影響</span>
        <span>次にやること</span>
        <span>担当・期限</span>
        <span>現在地の根拠</span>
        <span>履歴・保有</span>
      </div>

      {/* spec P1: role filter中に「対応中」groupがゼロでも保留/終了に絞り込み結果が残っていることが
          あるため、3つの表示先すべて（active groups + deferred + ended）を合算してから空判定する
          （groups.length === 0 だけを見ると「該当なし」を誤表示してしまう）。 */}
      {(comparisonOnly
        ? comparisonPartners.length === 0
        : groups.length === 0 &&
          deferredPartners.length === 0 &&
          endedPartners.length === 0) && (
        <p className="px-3 py-6 text-center text-xs text-[#69665d]">
          該当する関係先はまだないよ。
        </p>
      )}
      {comparisonOnly &&
        comparisonPartners.map((partner) => (
          <PartnerRow key={partner.id} partner={partner} {...rowProps} />
        ))}
      {!comparisonOnly &&
        groups.map((group) => (
          <div key={group.key}>
            <div className="border-b border-l-4 border-[#e4ddd0] border-l-[#38745d] bg-[#fffdf7] px-3 py-1.5">
              {/* spec P1: 分類見出しh4は11-12px+左罫線で本文行と視覚的に区切る。in_progress/established
                は同じ複合ラベル("XX先")になるため、unclassified以外は状態を（）で必ず明示して見出し
                だけでも区別できるようにする。 */}
              <h4 className="text-[11px] font-semibold text-[#38745d]">
                {group.label}
                {group.roleKind !== "unclassified" && (
                  <span className="text-[#69665d]">
                    （{sxRelationshipStateLabel(group.relationshipState)}）
                  </span>
                )}{" "}
                <span className="text-[#69665d]">
                  {group.partners.length}件
                </span>
              </h4>
            </div>
            {group.partners.map((partner) => (
              <PartnerRow key={partner.id} partner={partner} {...rowProps} />
            ))}
          </div>
        ))}

      {!comparisonOnly && deferredPartners.length > 0 && (
        <details className="border-t border-[#e4ddd0]">
          <summary
            className={`flex min-h-11 cursor-pointer select-none items-center px-3 py-2 text-[10px] font-semibold text-[#69665d] ${FOCUS_RING}`}
          >
            保留・低優先（重要経路外・{deferredPartners.length}件）
          </summary>
          <div>
            {deferredPartners.map((partner) => (
              <PartnerRow key={partner.id} partner={partner} {...rowProps} />
            ))}
          </div>
        </details>
      )}

      {/* 終了は保留とは別単位（spec P1: 保留/終了を別単位）。同じ折りたたみ行UIを流用しつつ、
          対応中カウントには入らないことがこのsectionの独立性からも分かるようにする。 */}
      {!comparisonOnly && endedPartners.length > 0 && (
        <details className="border-t border-[#e4ddd0]">
          <summary
            className={`flex min-h-11 cursor-pointer select-none items-center px-3 py-2 text-[10px] font-semibold text-[#69665d] ${FOCUS_RING}`}
          >
            終了（対応中から除外・{endedPartners.length}件）
          </summary>
          <div>
            {endedPartners.map((partner) => (
              <PartnerRow key={partner.id} partner={partner} {...rowProps} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function PartnerRow({
  partner,
  milestoneTitleBySlug,
  milestoneTitleById,
  milestoneSlugById,
  criticalPathSlugs,
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
}: {
  partner: SxManagementPartner;
  milestoneTitleBySlug: ReadonlyMap<string, string>;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  criticalPathSlugs: ReadonlySet<string>;
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
}) {
  const expanded = expandedId === partner.id;
  return (
    <PartnerComparisonRow
      partner={partner}
      milestoneTitleBySlug={milestoneTitleBySlug}
      milestoneTitleById={milestoneTitleById}
      milestoneSlugById={milestoneSlugById}
      criticalPathSlugs={criticalPathSlugs}
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

/** モーダル内の保存済み履歴を、要約・結果・主体・接点後ボールまで省略せず表示する。 */
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
    interaction.actorSide === "shared"
      ? interaction.actorLabel
        ? `共同・${sxNormalizePublicName(interaction.actorLabel)}`
        : "共同"
      : interaction.actorSide === "unknown"
        ? "行為主体未確認"
        : interaction.actorLabel
          ? sxNormalizePublicName(interaction.actorLabel)
          : interaction.actorSide === "sx"
            ? "当方"
            : "先方";
  const dateText = sxFormatEventDateWithPrecision(
    interaction.occurredOn,
    interaction.occurredOnPrecision,
  );
  const ballText = `${sxBallSideLabel(interaction.ballSideAfter)}${interaction.ballOwnerAfter ? ` ・ ${sxNormalizePublicName(interaction.ballOwnerAfter)}` : ""}`;
  return (
    <li
      className={`p-2.5 text-[11px] leading-5 ${canManage && onEdit ? "cursor-pointer hover:bg-[#f1f6f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]" : ""}`}
      role={canManage && onEdit ? "button" : undefined}
      tabIndex={canManage && onEdit ? 0 : undefined}
      aria-label={
        canManage && onEdit
          ? `${partnerName} - ${sxNormalizePublicName(interaction.summary)}を直接修正`
          : undefined
      }
      onClick={canManage && onEdit ? () => onEdit(interaction.id) : undefined}
      onKeyDown={
        canManage && onEdit
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit(interaction.id);
              }
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#69665d]">{dateText}</span>
          <SxBadge
            tone={
              INTERACTION_KIND_TONE[interaction.interactionKind] ||
              INTERACTION_KIND_TONE.note
            }
          >
            {sxInteractionKindLabel(interaction.interactionKind)}
          </SxBadge>
        </div>
      </div>
      <p className="mt-1 text-[10px] font-semibold text-[#514e47]">
        主体: {actorText}
      </p>
      <p className="mt-0.5 font-semibold leading-5 text-[#24231f]">
        {sxNormalizePublicName(interaction.summary)}
      </p>
      {interaction.outcomeSummary && (
        <p className="mt-0.5 leading-5 text-[#514e47]">
          {sxNormalizePublicName(interaction.outcomeSummary)}
        </p>
      )}
      <p className="mt-0.5 text-[10px] leading-4 text-[#315f7d]">
        ボール: {ballText}
      </p>
    </li>
  );
}
