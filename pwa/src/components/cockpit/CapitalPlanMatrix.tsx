'use client';

import { useId, useMemo } from 'react';
import {
  editableValue,
  overrideValue,
  resolvedValue,
  type CalculationBasis,
  type CapitalEvent,
  type CapitalPlan,
  type EditableValue,
  type EventAllocation,
  type RoundSnapshot,
} from '@/lib/capital-plan';

export interface CapitalPlanMatrixProps {
  plan: CapitalPlan;
  events: CapitalEvent[];
  snapshots: RoundSnapshot[];
  selectedEventId?: string | null;
  onSelectEvent: (eventId: string) => void;
  onUpdateEvent: (eventId: string, patch: Partial<CapitalEvent>) => void;
  onUpdateAllocation: (eventId: string, allocationId: string, patch: Partial<EventAllocation>) => void;
  onEditHolderAmount: (eventId: string, holderId: string, totalAmount: number) => void;
  onEditHolderEventShares: (eventId: string, holderId: string, totalShares: number) => void;
  onEditHolderPostShares: (eventId: string, holderId: string, totalFdShares: number) => void;
  onEditHolderPostRatio: (eventId: string, holderId: string, ratio0to1: number) => void;
}

const HOLDER_PALETTE = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
  '#0d9488',
  '#9333ea',
];

const CALC_BASIS_OPTIONS: { value: CalculationBasis; label: string }[] = [
  { value: 'valuation_and_investment', label: '評価額×投資額' },
  { value: 'price_and_shares', label: '単価×株数' },
  { value: 'ownership_target', label: '目標比率' },
  { value: 'manual', label: '手動' },
];

const FINANCING_TYPES = new Set(['equity_issue', 'convertible_conversion', 'ipo']);
const PRICE_TYPES = new Set(['equity_issue', 'convertible_conversion', 'ipo', 'secondary']);
const NEW_SHARES_TYPES = new Set(['equity_issue', 'convertible_conversion', 'ipo', 'option_pool']);

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

function aggregateHolderAllocations(event: CapitalEvent, holderId: string): { shares: number; amount: number; count: number } {
  const allocs = event.allocations.filter((a) => a.holderId === holderId);
  return {
    shares: allocs.reduce((sum, a) => sum + resolvedValue(a.shares), 0),
    amount: allocs.reduce((sum, a) => sum + (a.amount ? resolvedValue(a.amount) : 0), 0),
    count: allocs.length,
  };
}

function parseNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const inputBaseClass =
  'w-full min-h-[44px] md:min-h-[36px] bg-transparent px-1.5 py-1 text-right text-[13px] tabular-nums text-neutral-900 dark:text-neutral-100 border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400';

function NumberCell({
  value,
  onCommit,
  ariaLabel,
  placeholder,
}: {
  value: number | undefined;
  onCommit: (n: number) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      aria-label={ariaLabel}
      placeholder={placeholder}
      defaultValue={value ?? ''}
      key={value}
      className={inputBaseClass}
      onBlur={(e) => {
        const n = parseNumber(e.target.value);
        if (n !== null) onCommit(n);
      }}
    />
  );
}

function EditableValueCell({
  editable,
  onCommit,
  ariaLabel,
}: {
  editable: EditableValue | undefined;
  onCommit: (n: number) => void;
  ariaLabel: string;
}) {
  return <NumberCell value={editable?.value} onCommit={onCommit} ariaLabel={ariaLabel} />;
}

function DashCell({ label }: { label: string }) {
  return (
    <td className="min-h-[44px] md:min-h-[36px] px-1.5 py-1 text-right text-[13px] tabular-nums text-neutral-400 dark:text-neutral-600" aria-label={label}>
      —
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
      <div className="mx-auto flex h-24 w-14 items-center justify-center text-[11px] text-neutral-400 dark:text-neutral-600">
        —
      </div>
    );
  }
  const holderIndex = new Map(plan.holders.map((h, i) => [h.id, i]));
  const segments = [...snapshot.holders]
    .filter((h) => h.fullyDilutedPercentage > 0)
    .sort((a, b) => (holderIndex.get(a.holderId) ?? 0) - (holderIndex.get(b.holderId) ?? 0));
  return (
    <div className="mx-auto flex h-24 w-14 flex-col-reverse overflow-hidden" role="img" aria-label={`${snapshot.eventLabel} 完全希薄化後株式比率`}>
      {segments.map((h) => {
        const holder = plan.holders.find((p) => p.id === h.holderId);
        const idx = holderIndex.get(h.holderId) ?? 0;
        return (
          <div
            key={h.holderId}
            style={{ height: `${h.fullyDilutedPercentage * 100}%`, backgroundColor: holderColor(idx) }}
            title={`${holder?.name ?? h.holderId}: ${fmtPct(h.fullyDilutedPercentage)}`}
          />
        );
      })}
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
  onUpdateAllocation,
  onEditHolderAmount,
  onEditHolderEventShares,
  onEditHolderPostShares,
  onEditHolderPostRatio,
}: CapitalPlanMatrixProps) {
  const legendId = useId();
  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.order - b.order), [events]);
  const snapshotByEventId = useMemo(() => new Map(snapshots.map((s) => [s.eventId, s])), [snapshots]);

  if (sortedEvents.length === 0) {
    return (
      <div className="rounded-none border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-neutral-500 dark:text-neutral-400">
        資本イベントがまだ登録されていません。
      </div>
    );
  }

  return (
    <div className="w-full">
      <div id={legendId} className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-neutral-600 dark:text-neutral-400">
        {plan.holders.map((holder, idx) => (
          <span key={holder.id} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0"
              style={{ backgroundColor: holderColor(idx) }}
              aria-hidden="true"
            />
            {holder.name}
          </span>
        ))}
      </div>

      <div className="w-full overflow-x-auto border border-neutral-200 dark:border-neutral-800">
        <table
          className="border-collapse text-[13px]"
          style={{ tableLayout: 'fixed', minWidth: 152 + sortedEvents.length * 124 }}
        >
          <colgroup>
            <col style={{ width: 152 }} />
            {sortedEvents.map((event) => (
              <col key={event.id} style={{ width: 124 }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-900 px-1.5 py-1 text-left text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
              >
                資本イベント
              </th>
              {sortedEvents.map((event) => {
                const selected = selectedEventId === event.id;
                return (
                  <th key={event.id} scope="col" className="px-1 py-1 align-bottom font-normal">
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${event.label} を選択`}
                      onClick={() => onSelectEvent(event.id)}
                      className={`w-full min-h-[44px] md:min-h-[36px] px-1 py-0.5 text-left leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-950 underline decoration-2 underline-offset-2'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'
                      }`}
                    >
                      <span className="block truncate text-[12px] font-semibold text-neutral-900 dark:text-neutral-100">
                        {event.label}
                      </span>
                      <span className="block truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                        {event.date ?? '—'}
                      </span>
                      <span className="block truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                        {STATUS_LABEL[event.status ?? 'confirmed'] ?? event.status}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
              >
                FD比率（完全希薄化後）
              </th>
              {sortedEvents.map((event) => (
                <td key={event.id} className="px-1 py-2 text-center">
                  <FdOwnershipBar snapshot={snapshotByEventId.get(event.id)} plan={plan} />
                </td>
              ))}
            </tr>

            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                算定方式
              </th>
              {sortedEvents.map((event) => {
                const relevant = FINANCING_TYPES.has(event.type);
                if (!relevant) return <DashCell key={event.id} label={`${event.label} 算定方式`} />;
                return (
                  <td key={event.id} className="px-1.5 py-1">
                    <select
                      aria-label={`算定方式 ${event.label}`}
                      value={event.calculationBasis ?? 'manual'}
                      onChange={(e) =>
                        onUpdateEvent(event.id, { calculationBasis: e.target.value as CalculationBasis })
                      }
                      className="w-full min-h-[44px] md:min-h-[36px] bg-transparent px-1 py-1 text-[12px] border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
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

            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                プレマネー評価額
              </th>
              {sortedEvents.map((event) =>
                FINANCING_TYPES.has(event.type) ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.preMoneyValuation}
                      ariaLabel={`プレマネー評価額 ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { preMoneyValuation: nextEditableValue(event.preMoneyValuation, n) })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} プレマネー評価額`} />
                ),
              )}
            </tr>

            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                調達額（新規資金）
              </th>
              {sortedEvents.map((event) =>
                event.type === 'equity_issue' || event.type === 'ipo' || event.type === 'convertible_conversion' ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.primaryRaise}
                      ariaLabel={`調達額 ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { primaryRaise: nextEditableValue(event.primaryRaise, n) })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} 調達額`} />
                ),
              )}
            </tr>

            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                ポストマネー評価額
              </th>
              {sortedEvents.map((event) =>
                FINANCING_TYPES.has(event.type) ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.postMoneyValuation}
                      ariaLabel={`ポストマネー評価額 ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { postMoneyValuation: nextEditableValue(event.postMoneyValuation, n) })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} ポストマネー評価額`} />
                ),
              )}
            </tr>

            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                1株あたり単価
              </th>
              {sortedEvents.map((event) =>
                PRICE_TYPES.has(event.type) ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.pricePerShare}
                      ariaLabel={`1株あたり単価 ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { pricePerShare: nextEditableValue(event.pricePerShare, n) })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} 単価`} />
                ),
              )}
            </tr>

            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                新規発行株式数
              </th>
              {sortedEvents.map((event) =>
                NEW_SHARES_TYPES.has(event.type) ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.newShares}
                      ariaLabel={`新規発行株式数 ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { newShares: nextEditableValue(event.newShares, n) })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} 新規発行株式数`} />
                ),
              )}
            </tr>

            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                オプションプールサイズ
              </th>
              {sortedEvents.map((event) =>
                event.type === 'option_pool' ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.poolSize}
                      ariaLabel={`オプションプールサイズ ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { poolSize: nextEditableValue(event.poolSize, n) })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} オプションプールサイズ`} />
                ),
              )}
            </tr>

            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                株式分割比率
              </th>
              {sortedEvents.map((event) =>
                event.type === 'share_split' ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.splitRatio}
                      ariaLabel={`株式分割比率 ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { splitRatio: nextEditableValue(event.splitRatio, n) })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} 株式分割比率`} />
                ),
              )}
            </tr>

            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                転換上限額（キャップ）
              </th>
              {sortedEvents.map((event) =>
                event.type === 'convertible_issue' ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.conversionCap}
                      ariaLabel={`転換上限額 ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { conversionCap: nextEditableValue(event.conversionCap, n) })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} 転換上限額`} />
                ),
              )}
            </tr>

            <tr className="border-b-2 border-neutral-200 dark:border-neutral-800">
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400">
                転換ディスカウント
              </th>
              {sortedEvents.map((event) =>
                event.type === 'convertible_issue' ? (
                  <td key={event.id}>
                    <EditableValueCell
                      editable={event.conversionDiscount}
                      ariaLabel={`転換ディスカウント ${event.label}`}
                      onCommit={(n) => onUpdateEvent(event.id, { conversionDiscount: nextEditableValue(event.conversionDiscount, n) })}
                    />
                  </td>
                ) : (
                  <DashCell key={event.id} label={`${event.label} 転換ディスカウント`} />
                ),
              )}
            </tr>

            {plan.holders.map((holder) => (
              <tr key={`amount-${holder.id}`} className="border-b border-neutral-100 dark:border-neutral-900">
                <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {holder.name}｜金額
                </th>
                {sortedEvents.map((event) => {
                  const agg = aggregateHolderAllocations(event, holder.id);
                  if (agg.count === 0) return <DashCell key={event.id} label={`${event.label} ${holder.name} 金額`} />;
                  return (
                    <td key={event.id}>
                      <NumberCell
                        value={agg.amount}
                        ariaLabel={`金額 ${event.label} ${holder.name}`}
                        onCommit={(n) => onEditHolderAmount(event.id, holder.id, n)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {plan.holders.map((holder) => (
              <tr key={`shares-${holder.id}`} className="border-b border-neutral-200 dark:border-neutral-800">
                <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {holder.name}｜株数
                </th>
                {sortedEvents.map((event) => {
                  const agg = aggregateHolderAllocations(event, holder.id);
                  if (agg.count === 0) return <DashCell key={event.id} label={`${event.label} ${holder.name} 株数`} />;
                  return (
                    <td key={event.id}>
                      <NumberCell
                        value={agg.shares}
                        ariaLabel={`株数 ${event.label} ${holder.name}`}
                        onCommit={(n) => onEditHolderEventShares(event.id, holder.id, n)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr className="border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50 dark:bg-neutral-900/40">
              <th scope="row" className="sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-900 px-1.5 py-1 text-left text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                発行済株式数合計
              </th>
              {sortedEvents.map((event) => {
                const snap = snapshotByEventId.get(event.id);
                return (
                  <td key={event.id} className="px-1.5 py-1 text-right text-[13px] tabular-nums text-neutral-800 dark:text-neutral-200">
                    {snap ? fmtInt(snap.totalIssuedShares) : '—'}
                  </td>
                );
              })}
            </tr>
            <tr className="border-b-2 border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
              <th scope="row" className="sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-900 px-1.5 py-1 text-left text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                完全希薄化後株式数合計
              </th>
              {sortedEvents.map((event) => {
                const snap = snapshotByEventId.get(event.id);
                return (
                  <td key={event.id} className="px-1.5 py-1 text-right text-[13px] tabular-nums text-neutral-800 dark:text-neutral-200">
                    {snap ? fmtInt(snap.totalFullyDilutedShares) : '—'}
                  </td>
                );
              })}
            </tr>

            {plan.holders.map((holder) => (
              <tr key={`post-issued-${holder.id}`} className="border-b border-neutral-100 dark:border-neutral-900">
                <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {holder.name}｜発行済株式数
                </th>
                {sortedEvents.map((event) => {
                  const snap = snapshotByEventId.get(event.id);
                  const standing = snap?.holders.find((h) => h.holderId === holder.id);
                  if (!standing) return <DashCell key={event.id} label={`${event.label} ${holder.name} 発行済株式数`} />;
                  return (
                    <td key={event.id} className="px-1.5 py-1 text-right text-[13px] tabular-nums text-neutral-700 dark:text-neutral-300">
                      {fmtInt(standing.issuedShares)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {plan.holders.map((holder) => (
              <tr key={`post-fd-${holder.id}`} className="border-b border-neutral-100 dark:border-neutral-900">
                <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {holder.name}｜完全希薄化後株式数
                </th>
                {sortedEvents.map((event) => {
                  const snap = snapshotByEventId.get(event.id);
                  const standing = snap?.holders.find((h) => h.holderId === holder.id);
                  if (!standing) return <DashCell key={event.id} label={`${event.label} ${holder.name} 完全希薄化後株式数`} />;
                  if (event.type === 'share_split') {
                    return (
                      <td key={event.id} className="px-1.5 py-1 text-right text-[13px] tabular-nums text-neutral-700 dark:text-neutral-300">
                        {fmtInt(standing.fullyDilutedShares)}
                      </td>
                    );
                  }
                  return (
                    <td key={event.id}>
                      <NumberCell
                        value={standing.fullyDilutedShares}
                        ariaLabel={`完全希薄化後株式数 ${event.label} ${holder.name}`}
                        onCommit={(n) => onEditHolderPostShares(event.id, holder.id, n)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {plan.holders.map((holder, i) => (
              <tr
                key={`post-pct-${holder.id}`}
                className={i === plan.holders.length - 1 ? '' : 'border-b border-neutral-100 dark:border-neutral-900'}
              >
                <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-1.5 py-1 text-left text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {holder.name}｜FD％
                </th>
                {sortedEvents.map((event) => {
                  const snap = snapshotByEventId.get(event.id);
                  const standing = snap?.holders.find((h) => h.holderId === holder.id);
                  if (!standing) return <DashCell key={event.id} label={`${event.label} ${holder.name} FD比率`} />;
                  if (event.type === 'share_split') {
                    return (
                      <td key={event.id} className="px-1.5 py-1 text-right text-[13px] tabular-nums text-neutral-700 dark:text-neutral-300">
                        {fmtPct(standing.fullyDilutedPercentage)}
                      </td>
                    );
                  }
                  return (
                    <td key={event.id}>
                      <NumberCell
                        value={Math.round(standing.fullyDilutedPercentage * 10000) / 100}
                        ariaLabel={`完全希薄化後比率(%) ${event.label} ${holder.name}`}
                        onCommit={(n) => onEditHolderPostRatio(event.id, holder.id, n / 100)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CapitalPlanMatrix;
