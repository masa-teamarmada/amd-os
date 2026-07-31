'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  editableValue,
  overrideValue,
  resolvedValue,
  type CalculationBasis,
  type CapitalEvent,
  type CapitalPlan,
  type EditableValue,
  type RoundSnapshot,
} from '@/lib/capital-plan';

export interface CapitalPlanMatrixProps {
  plan: CapitalPlan;
  events: CapitalEvent[];
  snapshots: RoundSnapshot[];
  selectedEventId?: string | null;
  onSelectEvent: (eventId: string) => void;
  onUpdateEvent: (eventId: string, patch: Partial<CapitalEvent>) => void;
  onEditHolderAmount: (eventId: string, holderId: string, totalAmount: number) => void;
  onEditHolderEventShares: (eventId: string, holderId: string, totalShares: number) => void;
  onEditHolderPostRatio: (eventId: string, holderId: string, ratio0to1: number) => void;
  onClearHolderPostRatio?: (eventId: string, holderId: string) => void;
  onChangeCalculationBasis: (eventId: string, basis: CalculationBasis) => void;
  onAddHolder: (name?: string) => void;
  onAddEvent: () => void;
}

const HOLDER_PALETTE = [
  '#0072B2',
  '#D55E00',
  '#009E73',
  '#CC79A7',
  '#E69F00',
  '#56B4E9',
  '#5E3C99',
  '#8C564B',
];

const CALC_BASIS_OPTIONS: { value: CalculationBasis; label: string }[] = [
  { value: 'valuation_and_investment', label: '評価額×投資額' },
  { value: 'price_and_shares', label: '単価×株数' },
  { value: 'ownership_target', label: '目標比率' },
  { value: 'manual', label: '手動' },
];

const FINANCING_TYPES = new Set(['equity_issue', 'convertible_conversion', 'ipo']);
const PRICE_TYPES = new Set(['equity_issue', 'convertible_conversion', 'ipo', 'secondary']);
// option_pool is deliberately excluded: poolSize is its operative driver and it represents
// authorized-but-unissued options (FD-only dilution), not shares actually issued.
const NEW_SHARES_TYPES = new Set(['incorporation', 'equity_issue', 'convertible_conversion', 'ipo']);
// convertible_conversion never contributes new cash: converting an existing instrument
// isn't a primary raise, so it is deliberately excluded from this set (unlike FINANCING_TYPES).
const PRIMARY_RAISE_TYPES = new Set(['equity_issue', 'ipo']);
const AMOUNT_BEARING_TYPES = new Set(['equity_issue', 'ipo', 'secondary', 'convertible_issue']);

const STATUS_LABEL: Record<string, string> = {
  confirmed: '確定',
  planned: '計画',
};

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP');
}

function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function holderColor(index: number): string {
  return HOLDER_PALETTE[index % HOLDER_PALETTE.length];
}

/**
 * Wraps a numeric edit so provenance survives: calculated/imported/confirmed values
 * become override (calculatedValue preserved for drift display); an existing override
 * keeps its calculatedValue and just moves; anything else is a plain input edit.
 */
function nextEditableValue(current: EditableValue | undefined, next: number): EditableValue {
  if (current && current.source === 'override') return { ...current, value: next };
  if (current && (current.source === 'calculated' || current.source === 'imported' || current.source === 'confirmed')) {
    return overrideValue(current.value, next);
  }
  return editableValue(next, current?.source ?? 'input');
}

/**
 * Wraps an explicit OutputCell override so it always lands as source='override', regardless of
 * the prior source (input/imported/confirmed/undefined) — unlike nextEditableValue, which only
 * promotes calculated/imported/confirmed values and otherwise leaves the field as a plain input.
 * An existing override keeps its calculatedValue and just moves; otherwise the true calculated
 * baseline (calculatedValue if present, else value) is preserved for drift display.
 */
function forceOverride(current: EditableValue | undefined, next: number): EditableValue {
  if (current && current.source === 'override') {
    return { ...current, value: next };
  }
  const baseline = current?.calculatedValue ?? current?.value ?? next;
  return overrideValue(baseline, next);
}

function aggregateHolderAllocations(event: CapitalEvent, holderId: string): { shares: number; amount: number; count: number } {
  const allocs = event.allocations.filter((a) => a.holderId === holderId);
  return {
    shares: allocs.reduce((sum, a) => sum + resolvedValue(a.shares), 0),
    amount: allocs.reduce((sum, a) => sum + (a.amount ? resolvedValue(a.amount) : 0), 0),
    count: allocs.length,
  };
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Thousands-grouped display for an editable cell's resting (unfocused) state; decimals survive uncapped-looking (10dp ceiling avoids float noise) rounding. */
function formatNumberForDisplay(n: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 10 });
}

/**
 * A basis of undefined/'manual' leaves every field as a plain authored input (deriveEvent
 * returns the event untouched); every other basis materializes some fields as calculated
 * outputs. This is the single source of truth for which matrix cells are drivers vs. outputs.
 */
function isManualBasis(basis: CalculationBasis | undefined): boolean {
  return !basis || basis === 'manual';
}

function preMoneyIsDriver(basis: CalculationBasis | undefined): boolean {
  return isManualBasis(basis) || basis === 'valuation_and_investment' || basis === 'ownership_target';
}

function pricePerShareIsDriver(basis: CalculationBasis | undefined): boolean {
  return isManualBasis(basis) || basis === 'price_and_shares';
}

function holderAmountActionable(event: CapitalEvent): boolean {
  if (!AMOUNT_BEARING_TYPES.has(event.type)) return false;
  if (!FINANCING_TYPES.has(event.type)) return true;
  return isManualBasis(event.calculationBasis) || event.calculationBasis === 'valuation_and_investment';
}

function holderSharesActionable(event: CapitalEvent): boolean {
  if (event.type === 'share_split') return false;
  if (!FINANCING_TYPES.has(event.type)) return true;
  return isManualBasis(event.calculationBasis) || event.calculationBasis === 'price_and_shares';
}

const inputBaseClass =
  'w-full min-h-[44px] md:min-h-[36px] bg-transparent px-1.5 py-1 text-right text-[13px] tabular-nums text-slate-900 dark:text-slate-100 border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400';

const inputBorderFilledClass = 'border-transparent hover:border-slate-300 dark:hover:border-slate-700';

/** Subtle but persistent (not hover-only) border/background inviting entry into an empty cell. */
const inputBorderEmptyClass =
  'border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600';

/**
 * Controlled numeric cell with a local draft: every keystroke that parses to a valid number
 * commits immediately (onChange), Enter re-commits the current draft, and external recalculation
 * only resyncs the draft when the incoming value actually differs from what this cell itself last
 * committed (so a fresh derive pass from an unrelated edit doesn't clobber an in-progress keystroke,
 * and our own commit doesn't cause a redundant resync/cursor jump). The resync happens during render
 * (the React-sanctioned way to adjust state from a changed prop) rather than in an effect, so it
 * never lags a render behind the incoming value. Clearing the field calls onClear when provided
 * (undefined value / remove-or-zero an allocation); when no onClear is given, clearing is a no-op
 * on the data and the draft snaps back to the current value rather than being left blank while the
 * old saved value silently remains.
 */
function NumberCell({
  value,
  onCommit,
  onClear,
  ariaLabel,
  placeholder = '＋入力',
}: {
  value: number | undefined;
  onCommit: (n: number) => void;
  onClear?: () => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(() => (value != null ? formatNumberForDisplay(value) : ''));
  const [lastKnownValue, setLastKnownValue] = useState(value);
  const isEmpty = draft.trim() === '';

  if (value !== lastKnownValue) {
    setLastKnownValue(value);
    setDraft(value != null ? formatNumberForDisplay(value) : '');
  }

  function commitDraft(raw: string) {
    if (raw.trim() === '') {
      if (onClear) {
        setLastKnownValue(undefined);
        onClear();
      } else {
        setDraft(value != null ? formatNumberForDisplay(value) : '');
      }
      return;
    }
    const n = parseNumber(raw);
    if (n === null) return;
    setLastKnownValue(n);
    onCommit(n);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft}
      className={`${inputBaseClass} ${isEmpty ? inputBorderEmptyClass : inputBorderFilledClass}`}
      onFocus={() => {
        setDraft(value != null ? formatNumberForDisplay(value) : '');
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        commitDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitDraft(draft);
      }}
      onBlur={() => {
        const parsed = parseNumber(draft);
        commitDraft(draft);
        setDraft(
          parsed != null
            ? formatNumberForDisplay(parsed)
            : onClear
              ? ''
              : (value != null ? formatNumberForDisplay(value) : ''),
        );
      }}
    />
  );
}

function EditableValueCell({
  editable,
  onCommit,
  onClear,
  ariaLabel,
}: {
  editable: EditableValue | undefined;
  onCommit: (n: number) => void;
  onClear?: () => void;
  ariaLabel: string;
}) {
  return <NumberCell value={editable?.value} onCommit={onCommit} onClear={onClear} ariaLabel={ariaLabel} />;
}

/** Short badge text (compact) and full aria-label word for a value's provenance. */
const SOURCE_BADGE: Record<string, string> = {
  calculated: '自動',
  confirmed: '確定',
  imported: '取込',
  input: '入力',
};
const SOURCE_ARIA: Record<string, string> = {
  calculated: '自動計算',
  confirmed: '確定値',
  imported: '取込値',
  input: '入力値',
};

function sourceBadgeText(editable: EditableValue | undefined): string {
  if (editable?.source === 'override') return '上書き';
  return SOURCE_BADGE[editable?.source ?? 'calculated'] ?? '自動';
}

function sourceAriaWord(editable: EditableValue | undefined): string {
  if (editable?.source === 'override') return '上書き値';
  return SOURCE_ARIA[editable?.source ?? 'calculated'] ?? '自動計算';
}

function DashCell({ label }: { label: string }) {
  return (
    <td className="min-h-[44px] md:min-h-[36px] px-1.5 py-1 text-right text-[13px] tabular-nums text-slate-400 dark:text-slate-600" aria-label={label}>
      —
    </td>
  );
}

/**
 * A calculated/derived value: never presented as an editable driver. Labeled "自動" so it reads
 * as an output, not a normal input. When onOverride is supplied, a small "上書き" affordance opens
 * an inline number input clearly separate from the badge/value display — distinct from a normal
 * driver cell, and cancelable (Escape / ✕) without committing. When the value is already an
 * override (editable.source === 'override'), the badge switches to "上書き" and a clear control
 * (onClearOverride) removes it, reverting to the calculated value.
 *
 * overrideNote is for the two OutputCell call sites (pricePerShare under valuation_and_investment/
 * ownership_target, preMoneyValuation under price_and_shares) whose onOverride does not just
 * overwrite the value in place — it flows into CapitalPlanWorkspace's updateEvent, which detects
 * the edit and switches calculationBasis (switchToPriceAndSharesOnPriceEdit /
 * switchToValuationAndInvestmentOnPreMoneyEdit). Passing overrideNote surfaces that side effect at
 * the cell so it isn't discovered only after the fact; other OutputCell call sites are plain
 * in-place overrides and must not pass it.
 */
function OutputCell({
  value,
  label,
  formatter,
  editable,
  onOverride,
  onClearOverride,
  overrideNote,
}: {
  value: number | undefined;
  label: string;
  formatter: (n: number) => string;
  editable?: EditableValue;
  onOverride?: (n: number) => void;
  onClearOverride?: () => void;
  overrideNote?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const isOverridden = editable?.source === 'override';
  const overrideAriaLabel = overrideNote ? `${label} を上書き（${overrideNote}）` : `${label} を上書き`;

  function commitOverride() {
    const n = parseNumber(draft);
    if (n !== null) onOverride?.(n);
    setEditing(false);
  }

  if (editing) {
    return (
      <td className="min-h-[44px] md:min-h-[36px] px-1.5 py-1" aria-label={`${label}（上書き入力）`}>
        <div className="flex flex-col gap-1">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            aria-label={`${label} 上書き入力`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitOverride();
              else if (e.key === 'Escape') setEditing(false);
            }}
            className="w-full min-h-[44px] md:min-h-[36px] bg-transparent px-1.5 py-1 text-right text-[13px] tabular-nums text-slate-900 dark:text-slate-100 border border-dashed border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
          />
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              aria-label={`${label} 上書きを保存`}
              onClick={commitOverride}
              className="flex min-h-[44px] md:min-h-[36px] min-w-[44px] md:min-w-[36px] items-center justify-center px-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-950 dark:focus-visible:ring-indigo-400"
            >
              保存
            </button>
            <button
              type="button"
              aria-label={`${label} 上書きをキャンセル`}
              onClick={() => setEditing(false)}
              className="flex min-h-[44px] md:min-h-[36px] min-w-[44px] md:min-w-[36px] items-center justify-center px-1 text-[11px] text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:focus-visible:ring-indigo-400"
            >
              取消
            </button>
          </div>
        </div>
      </td>
    );
  }

  return (
    <td
      className="min-h-[44px] md:min-h-[36px] px-1.5 py-1 text-right text-[13px] tabular-nums text-slate-500 dark:text-slate-400"
      aria-label={`${label}（${sourceAriaWord(editable)}）`}
    >
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex flex-wrap items-center justify-end gap-1">
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${
              isOverridden
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {sourceBadgeText(editable)}
          </span>
          <span className="whitespace-normal break-words text-right">{value != null ? formatter(value) : '—'}</span>
        </div>
        {onOverride && overrideNote && (
          <span
            className="block w-full max-w-full whitespace-normal break-words text-right text-[11px] leading-tight text-slate-500 dark:text-slate-400"
            title={overrideNote}
            aria-hidden="true"
          >
            {overrideNote}
          </span>
        )}
        {(onOverride || (isOverridden && onClearOverride)) && (
          <div className="flex items-center gap-1">
            {onOverride && (
              <button
                type="button"
                aria-label={overrideAriaLabel}
                onClick={() => {
                  setDraft(value != null ? formatNumberForDisplay(value) : '');
                  setEditing(true);
                }}
                className="flex min-h-[44px] md:min-h-[36px] min-w-[44px] md:min-w-[36px] items-center justify-center text-[11px] text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:hover:text-slate-300 dark:focus-visible:ring-indigo-400"
              >
                ✎
              </button>
            )}
            {isOverridden && onClearOverride && (
              <button
                type="button"
                aria-label={`${label} の上書きを解除`}
                onClick={onClearOverride}
                className="flex min-h-[44px] md:min-h-[36px] min-w-[44px] md:min-w-[36px] items-center justify-center text-[11px] text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:hover:text-slate-300 dark:focus-visible:ring-indigo-400"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </td>
  );
}

function FdOwnershipBar({
  snapshot,
  plan,
}: {
  snapshot: RoundSnapshot | undefined;
  plan: CapitalPlan;
}) {
  if (!snapshot || snapshot.totalFullyDilutedShares <= 0) {
    return (
      <div className="mx-auto flex h-24 w-14 items-center justify-center text-[11px] text-slate-400 dark:text-slate-600">
        —
      </div>
    );
  }
  const holderIndex = new Map(plan.holders.map((h, i) => [h.id, i]));
  const segments = [...snapshot.holders]
    .filter((h) => h.fullyDilutedPercentage > 0)
    .sort((a, b) => (holderIndex.get(a.holderId) ?? 0) - (holderIndex.get(b.holderId) ?? 0));
  return (
    <div className="mx-auto flex h-24 w-14 flex-col-reverse overflow-hidden border border-slate-200 dark:border-slate-800" role="img" aria-label={`${snapshot.eventLabel} 完全希薄化後株式比率`}>
      {segments.map((h, segmentIndex) => {
        const holder = plan.holders.find((p) => p.id === h.holderId);
        const idx = holderIndex.get(h.holderId) ?? 0;
        return (
          <div
            key={h.holderId}
            style={{ height: `${h.fullyDilutedPercentage * 100}%`, backgroundColor: holderColor(idx) }}
            className={segmentIndex < segments.length - 1 ? 'border-t border-white/90 dark:border-slate-950/90' : undefined}
            title={`${holder?.name ?? h.holderId}: ${fmtPct(h.fullyDilutedPercentage)}`}
          />
        );
      })}
    </div>
  );
}

function AddHolderAndEventBar({
  onAddHolder,
  onAddEvent,
}: {
  onAddHolder: (name?: string) => void;
  onAddEvent: () => void;
}) {
  const [newHolderName, setNewHolderName] = useState('');
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = newHolderName.trim();
          onAddHolder(trimmed || undefined);
          setNewHolderName('');
        }}
      >
        <input
          type="text"
          value={newHolderName}
          onChange={(e) => setNewHolderName(e.target.value)}
          placeholder="新しい株主・VC名"
          aria-label="新しい株主・VC名"
          className="min-h-[44px] md:min-h-[36px] w-40 border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
        />
        <button
          type="submit"
          className="min-h-[44px] md:min-h-[36px] border border-slate-300 dark:border-slate-700 px-2 py-1 text-[12px] hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
        >
          + 株主・VC追加
        </button>
      </form>
      <button
        type="button"
        onClick={onAddEvent}
        aria-label="新規イベントを追加"
        className="min-h-[44px] md:min-h-[36px] border border-slate-300 dark:border-slate-700 px-2 py-1 text-[12px] hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
      >
        + イベント
      </button>
    </div>
  );
}

export function CapitalPlanMatrix({
  plan,
  events,
  snapshots,
  selectedEventId,
  onSelectEvent,
  onUpdateEvent,
  onEditHolderAmount,
  onEditHolderEventShares,
  onEditHolderPostRatio,
  onClearHolderPostRatio,
  onChangeCalculationBasis,
  onAddHolder,
  onAddEvent,
}: CapitalPlanMatrixProps) {
  const legendId = useId();
  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.order - b.order), [events]);
  const snapshotByEventId = useMemo(() => new Map(snapshots.map((s) => [s.eventId, s])), [snapshots]);

  const headerRowRef = useRef<HTMLTableRowElement | null>(null);
  const [headerRowHeight, setHeaderRowHeight] = useState(0);
  const [expandedHolderIds, setExpandedHolderIds] = useState<Set<string>>(() => new Set());
  const allHoldersExpanded = plan.holders.length > 0 && plan.holders.every((holder) => expandedHolderIds.has(holder.id));

  const toggleHolder = (holderId: string) => {
    setExpandedHolderIds((current) => {
      const next = new Set(current);
      if (next.has(holderId)) next.delete(holderId);
      else next.add(holderId);
      return next;
    });
  };

  const toggleAllHolders = () => {
    setExpandedHolderIds(allHoldersExpanded ? new Set() : new Set(plan.holders.map((holder) => holder.id)));
  };

  useEffect(() => {
    const el = headerRowRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeaderRowHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [sortedEvents.length]);

  if (sortedEvents.length === 0) {
    return (
      <div className="w-full" data-testid="capital-plan-matrix">
        <AddHolderAndEventBar onAddHolder={onAddHolder} onAddEvent={onAddEvent} />
        <div className="rounded-none border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
          資本イベントがまだ登録されていません。
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="capital-plan-matrix">
      <AddHolderAndEventBar onAddHolder={onAddHolder} onAddEvent={onAddEvent} />

      <div id={legendId} className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-slate-600 dark:text-slate-400">
        {plan.holders.map((holder, idx) => (
          <span key={holder.id} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-[2px] ring-1 ring-slate-900/15 dark:ring-white/20"
              style={{ backgroundColor: holderColor(idx) }}
              aria-hidden="true"
            />
            {holder.name}
          </span>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-y border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        <p>株主別の詳細は初期表示で折り畳み。FD比率を比較してから、必要な株主だけ開く。</p>
        <button type="button" onClick={toggleAllHolders} className="rounded-md border border-indigo-200 bg-white px-2 py-1 font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          {allHoldersExpanded ? "全株主を閉じる" : "全株主を展開"}
        </button>
      </div>

      <div className="w-full overflow-x-auto border border-slate-200 dark:border-slate-800">
        <table
          className="border-collapse text-[13px]"
          style={{ tableLayout: 'fixed', width: 152 + sortedEvents.length * 144 }}
        >
          <colgroup>
            <col style={{ width: 152 }} />
            {sortedEvents.map((event) => (
              <col key={event.id} style={{ width: 144 }} />
            ))}
          </colgroup>
          <thead>
            <tr ref={headerRowRef} className="border-b border-slate-200 dark:border-slate-800">
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 bg-slate-50 dark:bg-slate-900 px-1.5 py-1 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                資本イベント
              </th>
              {sortedEvents.map((event) => {
                const selected = selectedEventId === event.id;
                return (
                  <th key={event.id} scope="col" className="sticky top-0 z-20 bg-white dark:bg-slate-950 px-1 py-1 align-bottom font-normal">
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${event.label} を選択`}
                      onClick={() => onSelectEvent(event.id)}
                      className={`w-full min-h-[44px] md:min-h-[36px] px-1 py-0.5 text-left leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400 ${
                        selected
                          ? 'bg-indigo-50 dark:bg-indigo-950 underline decoration-2 underline-offset-2'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                      }`}
                    >
                      <span className="block truncate text-[12px] font-semibold text-slate-900 dark:text-slate-100">
                        {event.label}
                      </span>
                      <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {event.date ?? '—'}
                      </span>
                      <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {STATUS_LABEL[event.status ?? 'confirmed'] ?? event.status}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th
                scope="row"
                style={{ top: headerRowHeight }}
                className="sticky left-0 z-30 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                FD比率（完全希薄化後）
              </th>
              {sortedEvents.map((event) => (
                <td key={event.id} style={{ top: headerRowHeight }} className="sticky z-20 bg-white dark:bg-slate-950 px-1 py-2 text-center">
                  <FdOwnershipBar snapshot={snapshotByEventId.get(event.id)} plan={plan} />
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                算定方式
              </th>
              {sortedEvents.map((event) => {
                // convertible_conversion never gets a basis selector: it must stay manual (validateCapitalPlan
                // rejects any other basis), so exposing the selector — and ownership_target within it — would
                // let a user pick an option the engine forbids for this event type.
                const relevant = FINANCING_TYPES.has(event.type) && event.type !== 'convertible_conversion';
                if (!relevant) return <DashCell key={event.id} label={`${event.label} 算定方式`} />;
                return (
                  <td key={event.id} className="px-1.5 py-1">
                    <select
                      aria-label={`算定方式 ${event.label}`}
                      value={event.calculationBasis ?? 'manual'}
                      onChange={(e) => onChangeCalculationBasis(event.id, e.target.value as CalculationBasis)}
                      className="w-full min-h-[44px] md:min-h-[36px] bg-transparent px-1 py-1 text-[12px] border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
                    >
                      {CALC_BASIS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                );
              })}
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                プレマネー評価額
              </th>
              {sortedEvents.map((event) => {
                // No valuation row for convertible_conversion: conversion has no pre-money by definition.
                if (!FINANCING_TYPES.has(event.type) || event.type === 'convertible_conversion') {
                  return <DashCell key={event.id} label={`${event.label} プレマネー評価額`} />;
                }
                const label = `プレマネー評価額 ${event.label}`;
                if (preMoneyIsDriver(event.calculationBasis)) {
                  return (
                    <td key={event.id}>
                      <EditableValueCell
                        editable={event.preMoneyValuation}
                        ariaLabel={label}
                        onCommit={(n) => onUpdateEvent(event.id, { preMoneyValuation: nextEditableValue(event.preMoneyValuation, n) })}
                        onClear={() => onUpdateEvent(event.id, { preMoneyValuation: undefined })}
                      />
                    </td>
                  );
                }
                return (
                  <OutputCell
                    key={event.id}
                    value={event.preMoneyValuation?.value}
                    label={label}
                    formatter={fmtYen}
                    editable={event.preMoneyValuation}
                    onOverride={(n) => onUpdateEvent(event.id, { preMoneyValuation: forceOverride(event.preMoneyValuation, n) })}
                    onClearOverride={() => onUpdateEvent(event.id, { preMoneyValuation: undefined })}
                    overrideNote="評価額入力→評価額×投資額（投資額維持）"
                  />
                );
              })}
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                調達額（新規資金）
              </th>
              {sortedEvents.map((event) => {
                if (!PRIMARY_RAISE_TYPES.has(event.type)) return <DashCell key={event.id} label={`${event.label} 調達額`} />;
                const label = `調達額 ${event.label}`;
                return (
                  <OutputCell
                    key={event.id}
                    value={event.primaryRaise?.value}
                    label={label}
                    formatter={fmtYen}
                    editable={event.primaryRaise}
                    onOverride={(n) => onUpdateEvent(event.id, { primaryRaise: forceOverride(event.primaryRaise, n) })}
                    onClearOverride={() => onUpdateEvent(event.id, { primaryRaise: undefined })}
                  />
                );
              })}
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                ポストマネー評価額
              </th>
              {sortedEvents.map((event) => {
                // No valuation row for convertible_conversion: conversion has no post-money by definition.
                if (!FINANCING_TYPES.has(event.type) || event.type === 'convertible_conversion') {
                  return <DashCell key={event.id} label={`${event.label} ポストマネー評価額`} />;
                }
                const label = `ポストマネー評価額 ${event.label}`;
                return (
                  <OutputCell
                    key={event.id}
                    value={event.postMoneyValuation?.value}
                    label={label}
                    formatter={fmtYen}
                    editable={event.postMoneyValuation}
                    onOverride={(n) => onUpdateEvent(event.id, { postMoneyValuation: forceOverride(event.postMoneyValuation, n) })}
                    onClearOverride={() => onUpdateEvent(event.id, { postMoneyValuation: undefined })}
                  />
                );
              })}
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                1株あたり単価
              </th>
              {sortedEvents.map((event) => {
                if (!PRICE_TYPES.has(event.type)) return <DashCell key={event.id} label={`${event.label} 単価`} />;
                const label = `1株あたり単価 ${event.label}`;
                if (pricePerShareIsDriver(event.calculationBasis)) {
                  return (
                    <td key={event.id}>
                      <EditableValueCell
                        editable={event.pricePerShare}
                        ariaLabel={label}
                        onCommit={(n) => onUpdateEvent(event.id, { pricePerShare: nextEditableValue(event.pricePerShare, n) })}
                        onClear={() => onUpdateEvent(event.id, { pricePerShare: undefined })}
                      />
                    </td>
                  );
                }
                return (
                  <OutputCell
                    key={event.id}
                    value={event.pricePerShare?.value}
                    label={label}
                    formatter={fmtYen}
                    editable={event.pricePerShare}
                    onOverride={(n) => onUpdateEvent(event.id, { pricePerShare: forceOverride(event.pricePerShare, n) })}
                    onClearOverride={() => onUpdateEvent(event.id, { pricePerShare: undefined })}
                    overrideNote="単価入力→単価×株数（株数維持）"
                  />
                );
              })}
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                新規発行株式数
              </th>
              {sortedEvents.map((event) => {
                if (!NEW_SHARES_TYPES.has(event.type)) return <DashCell key={event.id} label={`${event.label} 新規発行株式数`} />;
                const label = `新規発行株式数 ${event.label}`;
                // Always a calculated output across every NEW_SHARES_TYPES member: it derives from
                // the calculation basis (or is fixed at incorporation), never a plain authored input.
                return (
                  <OutputCell
                    key={event.id}
                    value={event.newShares?.value}
                    label={label}
                    formatter={fmtInt}
                    editable={event.newShares}
                    onOverride={(n) => onUpdateEvent(event.id, { newShares: forceOverride(event.newShares, n) })}
                    onClearOverride={() => onUpdateEvent(event.id, { newShares: undefined })}
                  />
                );
              })}
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                オプションプールサイズ
              </th>
              {sortedEvents.map((event) =>
                event.type === 'option_pool' ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.poolSize}
                      ariaLabel={`オプションプールサイズ ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { poolSize: nextEditableValue(event.poolSize, n) })}
                      onClear={() => onUpdateEvent(event.id, { poolSize: undefined })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} オプションプールサイズ`} />
                ),
              )}
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                株式分割比率
              </th>
              {sortedEvents.map((event) =>
                event.type === 'share_split' ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.splitRatio}
                      ariaLabel={`株式分割比率 ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { splitRatio: nextEditableValue(event.splitRatio, n) })}
                      onClear={() => onUpdateEvent(event.id, { splitRatio: undefined })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} 株式分割比率`} />
                ),
              )}
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                転換上限額（キャップ）
              </th>
              {sortedEvents.map((event) =>
                event.type === 'convertible_issue' ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.conversionCap}
                      ariaLabel={`転換上限額 ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { conversionCap: nextEditableValue(event.conversionCap, n) })}
                      onClear={() => onUpdateEvent(event.id, { conversionCap: undefined })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} 転換上限額`} />
                ),
              )}
            </tr>

            <tr className="border-b-2 border-slate-200 dark:border-slate-800">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-1.5 py-1 text-left text-[11px] text-slate-500 dark:text-slate-400">
                転換ディスカウント
              </th>
              {sortedEvents.map((event) =>
                event.type === 'convertible_issue' ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.conversionDiscount}
                      ariaLabel={`転換ディスカウント ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { conversionDiscount: nextEditableValue(event.conversionDiscount, n) })}
                      onClear={() => onUpdateEvent(event.id, { conversionDiscount: undefined })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} 転換ディスカウント`} />
                ),
              )}
            </tr>

            {plan.holders.map((holder) => {
              const expanded = expandedHolderIds.has(holder.id);
              return (
                <Fragment key={holder.id}>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-800">
                    <th scope="row" className="sticky left-0 z-10 bg-white px-1.5 py-1 text-left text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      <button type="button" aria-expanded={expanded} onClick={() => toggleHolder(holder.id)} className="flex w-full items-center gap-1.5 truncate text-left font-semibold hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                        <span aria-hidden="true" className="text-indigo-600">{expanded ? "−" : "+"}</span>
                        <span className="truncate">{holder.name}｜FD比率</span>
                      </button>
                    </th>
                    {sortedEvents.map((event) => {
                      const label = `完全希薄化後比率(%) ${event.label} ${holder.name}`;
                      if (event.calculationBasis === 'ownership_target') {
                        const alloc = event.allocations.find((a) => a.holderId === holder.id && a.targetOwnershipPercentage != null);
                        const pctValue = alloc ? resolvedValue(alloc.targetOwnershipPercentage) * 100 : undefined;
                        return <td key={event.id}><NumberCell value={pctValue} ariaLabel={`目標完全希薄化後比率(%) ${event.label} ${holder.name}`} onCommit={(n) => onEditHolderPostRatio(event.id, holder.id, n / 100)} onClear={() => onClearHolderPostRatio ? onClearHolderPostRatio(event.id, holder.id) : onEditHolderPostRatio(event.id, holder.id, 0)} /></td>;
                      }
                      const standing = snapshotByEventId.get(event.id)?.holders.find((h) => h.holderId === holder.id);
                      if (!standing) return <DashCell key={event.id} label={label} />;
                      return <OutputCell key={event.id} value={standing.fullyDilutedPercentage} label={label} formatter={fmtPct} />;
                    })}
                  </tr>
                  {expanded && <>
                    <tr className="border-b border-slate-100 dark:border-slate-900">
                      <th scope="row" className="sticky left-0 z-10 bg-slate-50 px-1.5 py-1 text-left text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-400">{holder.name}｜金額</th>
                      {sortedEvents.map((event) => {
                        const agg = aggregateHolderAllocations(event, holder.id);
                        const actionable = holderAmountActionable(event);
                        const label = `金額 ${event.label} ${holder.name}`;
                        if (agg.count === 0) return actionable ? <td key={event.id}><NumberCell value={undefined} ariaLabel={label} onCommit={(n) => onEditHolderAmount(event.id, holder.id, n)} /></td> : <DashCell key={event.id} label={label} />;
                        return actionable ? <td key={event.id}><NumberCell value={agg.amount} ariaLabel={label} onCommit={(n) => onEditHolderAmount(event.id, holder.id, n)} onClear={() => onEditHolderAmount(event.id, holder.id, 0)} /></td> : <OutputCell key={event.id} value={agg.amount} label={label} formatter={fmtYen} />;
                      })}
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-900">
                      <th scope="row" className="sticky left-0 z-10 bg-slate-50 px-1.5 py-1 text-left text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-400">{holder.name}｜株数</th>
                      {sortedEvents.map((event) => {
                        const agg = aggregateHolderAllocations(event, holder.id);
                        const actionable = holderSharesActionable(event);
                        const label = `株数 ${event.label} ${holder.name}`;
                        if (agg.count === 0) return actionable ? <td key={event.id}><NumberCell value={undefined} ariaLabel={label} onCommit={(n) => onEditHolderEventShares(event.id, holder.id, n)} /></td> : <DashCell key={event.id} label={label} />;
                        return actionable ? <td key={event.id}><NumberCell value={agg.shares} ariaLabel={label} onCommit={(n) => onEditHolderEventShares(event.id, holder.id, n)} onClear={() => onEditHolderEventShares(event.id, holder.id, 0)} /></td> : <OutputCell key={event.id} value={agg.shares} label={label} formatter={fmtInt} />;
                      })}
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-900">
                      <th scope="row" className="sticky left-0 z-10 bg-slate-50 px-1.5 py-1 text-left text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-400">{holder.name}｜発行済株式数</th>
                      {sortedEvents.map((event) => {
                        const standing = snapshotByEventId.get(event.id)?.holders.find((h) => h.holderId === holder.id);
                        const label = `発行済株式数 ${event.label} ${holder.name}`;
                        return standing ? <OutputCell key={event.id} value={standing.issuedShares} label={label} formatter={fmtInt} /> : <DashCell key={event.id} label={label} />;
                      })}
                    </tr>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th scope="row" className="sticky left-0 z-10 bg-slate-50 px-1.5 py-1 text-left text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-400">{holder.name}｜完全希薄化後株式数</th>
                      {sortedEvents.map((event) => {
                        const standing = snapshotByEventId.get(event.id)?.holders.find((h) => h.holderId === holder.id);
                        const label = `完全希薄化後株式数 ${event.label} ${holder.name}`;
                        return standing ? <OutputCell key={event.id} value={standing.fullyDilutedShares} label={label} formatter={fmtInt} /> : <DashCell key={event.id} label={label} />;
                      })}
                    </tr>
                  </>}
                </Fragment>
              );
            })}

            <tr className="border-b border-slate-100 dark:border-slate-900 bg-slate-50 dark:bg-slate-900/40">
              <th scope="row" className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 px-1.5 py-1 text-left text-[11px] font-medium text-slate-600 dark:text-slate-300">
                発行済株式数合計
              </th>
              {sortedEvents.map((event) => {
                const snap = snapshotByEventId.get(event.id);
                return (
                  <td key={event.id} className="px-1.5 py-1 text-right text-[13px] tabular-nums text-slate-800 dark:text-slate-200">
                    {snap ? fmtInt(snap.totalIssuedShares) : '—'}
                  </td>
                );
              })}
            </tr>
            <tr className="bg-slate-50 dark:bg-slate-900/40">
              <th scope="row" className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 px-1.5 py-1 text-left text-[11px] font-medium text-slate-600 dark:text-slate-300">
                完全希薄化後株式数合計
              </th>
              {sortedEvents.map((event) => {
                const snap = snapshotByEventId.get(event.id);
                return (
                  <td key={event.id} className="px-1.5 py-1 text-right text-[13px] tabular-nums text-slate-800 dark:text-slate-200">
                    {snap ? fmtInt(snap.totalFullyDilutedShares) : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CapitalPlanMatrix;
