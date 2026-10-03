"use client";

import { useState, type ReactNode } from "react";
import {
  COST_BREAKDOWN_ROWS,
  COST_CHARTS,
  COST_INPUT_BLOCKS,
  COST_SUMMARY_ITEMS,
  type CostSummaryItemKey,
} from "@/lib/project-formats";
import type { CostAssumption, CostItem, CostModelBundle, CostTask } from "@/lib/project-cost-model";
import type { DraftEntity, DraftField, DraftValue } from "@/lib/project-cost-model-draft";
import { itemsItemLabel, roleNumber, type ItemsLine, type ItemsResult, type ItemsVolumeCase } from "@/lib/project-cost-items-engine";
import {
  costFormatBlockTitle,
  costFormatBreakdown,
  costFormatConfidence,
  costFormatStatus,
  costFormatUncertain,
  unusedAssumptions,
  type CostFormatBreakdownRow,
  type CostFormatInputGroup,
} from "@/lib/project-cost-format";
import { ConfidenceTag, Delta, MiniMarkdown, NumberField, Swatch, int, num, pct, signed, yen } from "@/components/cockpit/CockpitCostModelParts";
import { CostBreakdownGuide, flashElement } from "@/components/cockpit/CockpitCostBreakdownGuide";
import { ItemCalcLine, ItemNoteLine } from "@/components/cockpit/CockpitCostItemCalc";

// コスト試算タブの標準フォーマット（spec 3-23 §7）の区画。操作パネル（前提と作業）・結果・読み物を、
// 定義（src/lib/project-formats.ts）の区画・行・グラフのとおりに描く。PJごとの違いはデータだけで出す。
// 見た目と操作は SX の試算（2026-09-13〜15 まさ確定）と同じ形にそろえる。

export type CostFormatChange = (entity: DraftEntity, id: string, field: DraftField, value: DraftValue) => void;

/** 1単位あたりの額。千円を超える額は整数、小さい額は小数1桁（3桁ごとのカンマ）。 */
export const amount = (v: number) => num(v, Math.abs(v) >= 1000 ? 0 : 1);
const digitsOf = (v: number) => (Math.abs(v) >= 1000 ? 0 : 1);

export function caseOptionLabel(c: ItemsVolumeCase, unit: string) {
  return `${int(c.volume)}${unit}`;
}

const NAV_BUTTON =
  "min-h-[36px] shrink-0 rounded-md px-2 text-[11px] font-semibold text-[#3c3c43] hover:bg-[#e8f3fc] hover:text-[#0267b2] xl:min-h-[26px]";
const STATUS_CLASS = { bad: "text-[#be123c]", warn: "text-[#b45309]", ok: "text-[#1d1d1f]" } as const;

function Formula({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className="rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]" data-testid={testId}>
      {children}
    </p>
  );
}

function NoteToggle({ note }: { note: string | null }) {
  const [open, setOpen] = useState(false);
  if (!note) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-[10px] font-semibold text-[#0267b2] hover:underline">
        {open ? "説明を閉じる" : "説明"}
      </button>
      {open && <span className="block basis-full text-[11px] leading-5 text-[#6e6e73]">{note}</span>}
    </>
  );
}

function Cell({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-2 xl:justify-end ${className}`}>
      <span className="text-[10px] text-[#6e6e73] xl:hidden">{label}</span>
      {children}
    </div>
  );
}

/** 総コストを内訳の色で積んだ横棒。目盛りは全ケースで共通。売価は破線、総コスト目標は点線。 */
export function StackedBar({ rows, scaleMax, price, target }: { rows: CostFormatBreakdownRow[]; scaleMax: number; price: number; target: number | null }) {
  const positive = rows.filter((r) => r.amount > 0);
  // 積み上げの各段の開始位置（それより前の段の合計）。
  const starts = positive.map((_, i) => positive.slice(0, i).reduce((s, x) => s + x.amount, 0));
  return (
    <span className="relative block h-[10px] w-full" aria-hidden="true">
      <span className="absolute inset-0 overflow-hidden">
        {positive.map((r, i) => {
          const left = (starts[i] / scaleMax) * 100;
          const width = (r.amount / scaleMax) * 100;
          const last = i === positive.length - 1;
          return (
            <span
              key={r.key}
              className={`absolute inset-y-0 ${last ? "rounded-r-[4px]" : ""}`}
              style={{ left: `${left}%`, width: last ? `${width}%` : `max(0px, calc(${width}% - 2px))`, backgroundColor: r.color }}
            />
          );
        })}
      </span>
      {price > 0 && price <= scaleMax && <span className="absolute -inset-y-[3px] border-l border-dashed border-[#3c3c43]" style={{ left: `${(price / scaleMax) * 100}%` }} />}
      {target !== null && target > 0 && target <= scaleMax && (
        <span className="absolute -inset-y-[3px] border-l border-dotted border-[#86868b]" style={{ left: `${(target / scaleMax) * 100}%` }} />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// 要約
// ---------------------------------------------------------------------------------------------

export function CostFormatSummary({
  result,
  baseline,
  unit,
  target,
  targetMarginRate,
  targetNote,
}: {
  result: ItemsResult;
  baseline: ItemsResult;
  unit: string;
  target: number | null;
  targetMarginRate: number | null;
  targetNote: string | null;
}) {
  const status = costFormatStatus(result.totalPerUnit, result.salePrice, target, targetMarginRate);
  const value: Record<CostSummaryItemKey, ReactNode> = {
    total: (
      <>
        <span className="text-[18px] font-semibold tabular-nums text-[#1d1d1f]">{amount(result.totalPerUnit)}</span>
        <span className="text-[11px] text-[#6e6e73]"> 円/{unit}</span>
        <Delta value={result.totalPerUnit - baseline.totalPerUnit} digits={digitsOf(result.totalPerUnit)} className="ml-1 text-[11px]" />
        <span className={`ml-1.5 text-[11px] font-semibold ${STATUS_CLASS[status.tone]}`}>{status.label}</span>
      </>
    ),
    price: result.salePrice > 0 ? <span className="tabular-nums">{amount(result.salePrice)} 円/{unit}</span> : <span className="text-[#86868b]">未登録</span>,
    profit:
      result.salePrice > 0 ? (
        <span className={`tabular-nums ${result.profitPerUnit < 0 ? "text-[#be123c]" : ""}`}>
          {signed(result.profitPerUnit, digitsOf(result.profitPerUnit))} 円/{unit}（{pct(result.marginRate)}）
        </span>
      ) : (
        <span className="text-[#86868b]">売価が未登録</span>
      ),
    target:
      target !== null ? (
        <span className="tabular-nums">{amount(target)} 円/{unit}</span>
      ) : targetMarginRate !== null && targetMarginRate > 0 && result.salePrice > 0 ? (
        <span className="tabular-nums">
          {amount(result.salePrice * (1 - targetMarginRate))} 円/{unit}（利益率 {pct(targetMarginRate)} を残す上限）
        </span>
      ) : targetNote ? (
        <span>{targetNote}</span>
      ) : (
        <span className="text-[#3c3c43]">売価（ここを超えると赤字）</span>
      ),
    capex: <span className="tabular-nums">{yen(result.capexInitial)}</span>,
    opex: (
      <span className="tabular-nums">
        {yen(result.opexAnnual)}/年<span className="text-[10px] text-[#6e6e73]">（償却 {yen(result.capexAnnual)}/年 は別）</span>
      </span>
    ),
    volume: result.volume > 0 ? <span className="tabular-nums">{int(result.volume)} {unit}/年</span> : <span className="text-[#86868b]">未登録</span>,
    hours: (
      <span className="tabular-nums">
        {int(result.hoursAnnual)} 時間
        <Delta value={result.hoursAnnual - baseline.hoursAnnual} digits={0} className="ml-1 text-[11px]" />
      </span>
    ),
  };
  return (
    <dl className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2" data-testid="cost-format-summary">
      {COST_SUMMARY_ITEMS.map((s) => (
        <div key={s.key} className={`flex min-w-0 flex-col ${s.key === "total" ? "sm:col-span-2" : ""}`}>
          <dt className="text-[10px] text-[#6e6e73]">{s.label}</dt>
          <dd className="text-[12px] leading-5 text-[#1d1d1f]">{value[s.key]}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------------------------
// 結果（ケースの比較・原価の内訳）
// ---------------------------------------------------------------------------------------------

export function CostFormatResults({
  unit,
  result,
  baseline,
  cases,
  caseResults,
  currentKey,
  groups,
  target,
  targetMarginRate,
  targetNote,
  onSelectCase,
}: {
  unit: string;
  result: ItemsResult;
  baseline: ItemsResult;
  cases: ItemsVolumeCase[];
  caseResults: ItemsResult[];
  currentKey: string;
  groups: CostFormatInputGroup[];
  target: number | null;
  targetMarginRate: number | null;
  targetNote: string | null;
  onSelectCase: (key: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rows = costFormatBreakdown(result, groups);
  const baseRows = costFormatBreakdown(baseline, groups);
  const price = result.salePrice;
  const allMax = Math.max(0, ...caseResults.map((r) => r.totalPerUnit), result.totalPerUnit);
  const scaleMax = Math.max(allMax, price * 1.1, target ?? 0, 1);
  const maxRow = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <div className="flex flex-col gap-3" data-testid="cost-format-results">
      <section data-cost-section="summary" aria-label="要約">
        <CostFormatSummary result={result} baseline={baseline} unit={unit} target={target} targetMarginRate={targetMarginRate} targetNote={targetNote} />
      </section>

      <section aria-label={`${COST_CHARTS.comparison.title}（円/${unit}）`} data-testid="cost-format-comparison">
        <h4 className="text-[11px] font-semibold text-[#3c3c43]">
          {COST_CHARTS.comparison.title}（1{unit}あたりの総コスト・円/{unit}）
        </h4>
        {caseResults.length === 0 ? (
          <p className="mt-1 text-[11px] text-[#86868b]">比べる年間の量が未登録</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {cases.map((c, i) => {
              const r = caseResults[i];
              const caseRows = costFormatBreakdown(r, groups);
              const status = costFormatStatus(r.totalPerUnit, r.salePrice, target, targetMarginRate);
              const active = c.key === currentKey;
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectCase(c.key)}
                    title={[`${caseOptionLabel(c, unit)}/年 総コスト ${amount(r.totalPerUnit)} 円/${unit}`, ...caseRows.filter((x) => x.amount > 0).map((x) => `${x.label} ${amount(x.amount)}`)].join("\n")}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-md px-1.5 py-1 text-left sm:grid-cols-[96px_minmax(0,1fr)_112px] ${active ? "bg-[#e8f3fc]" : "hover:bg-[#f5f5f7]"}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold tabular-nums text-[#1d1d1f]">{caseOptionLabel(c, unit)}/年</span>
                      {c.label && <span className="block truncate text-[10px] text-[#6e6e73]">{c.label}</span>}
                    </span>
                    {/* スマホ幅では棒を2行目に全幅で出す（列が狭いと棒の幅が0になる） */}
                    <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                      <StackedBar rows={caseRows} scaleMax={scaleMax} price={r.salePrice} target={target} />
                    </span>
                    <span className="text-right">
                      <span className="block text-[12px] font-semibold tabular-nums text-[#1d1d1f]">{amount(r.totalPerUnit)}</span>
                      <span className={`block text-[10px] font-semibold ${STATUS_CLASS[status.tone]}`}>{status.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-[#6e6e73]">
          {rows
            .filter((r) => r.amount > 0)
            .map((r) => (
              <span key={r.key} className="inline-flex items-center gap-1">
                <Swatch color={r.color} />
                {r.shortLabel}
              </span>
            ))}
          {price > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block h-3 border-l border-dashed border-[#3c3c43]" />売価 {amount(price)}</span>}
          {target !== null && <span className="inline-flex items-center gap-1"><span className="inline-block h-3 border-l border-dotted border-[#86868b]" />総コスト目標 {amount(target)}</span>}
        </div>
      </section>

      <section aria-label={COST_CHARTS.breakdown.title} data-testid="cost-format-breakdown">
        <h4 className="text-[11px] font-semibold text-[#3c3c43]">
          {COST_CHARTS.breakdown.title}（{caseOptionLabel(cases.find((c) => c.key === currentKey) ?? { key: "", volume: result.volume, label: "" }, unit)}/年・円/{unit}）
          <span className="ml-1 font-normal text-[#6e6e73]">行を押すと中身が開く</span>
        </h4>
        <ul aria-label="内訳の棒グラフ" className="mt-1 flex flex-col">
          {rows
            .filter((r) => r.amount !== 0 || r.parts.length > 0)
            .map((r) => {
              const base = baseRows.find((b) => b.key === r.key);
              const open = openKey === r.key;
              return (
                <li key={r.key} className="border-b border-[#f0f0f2] last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? null : r.key)}
                    title={r.hint}
                    className="grid w-full grid-cols-[minmax(0,116px)_minmax(0,1fr)_auto] items-center gap-2 py-1 text-left sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto_40px]"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[#1d1d1f]">
                      <Swatch color={r.color} />
                      <span className="truncate">{r.label}</span>
                    </span>
                    <span className="relative h-2 rounded-full bg-[#f0f0f2]">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(0, (r.amount / maxRow) * 100)}%`, backgroundColor: r.color }} />
                    </span>
                    <span className="text-right text-[11px] tabular-nums text-[#1d1d1f]">
                      {amount(r.amount)}
                      <Delta value={r.amount - (base?.amount ?? 0)} digits={digitsOf(r.amount)} className="ml-1 text-[10px]" />
                    </span>
                    <span className="hidden text-right text-[10px] tabular-nums text-[#6e6e73] sm:block">{num(r.share * 100, 0)}%</span>
                  </button>
                  {open && (
                    <div className="pb-1.5 pl-4 text-[11px] leading-5 text-[#3c3c43]">
                      <p className="text-[#6e6e73]">{r.hint}</p>
                      <ul>
                        {r.parts.slice(0, 8).map((p, i) => (
                          <li key={`${p.label}-${i}`} className="flex justify-between gap-2">
                            <span className="min-w-0 truncate">{p.label}</span>
                            <span className="shrink-0 tabular-nums">{amount(p.amount)}</span>
                          </li>
                        ))}
                        {r.parts.length > 8 && (
                          <li className="text-[#6e6e73]">
                            ほか {r.parts.length - 8}件 {amount(r.parts.slice(8).reduce((s, p) => s + p.amount, 0))}
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
        <dl className="mt-2 flex flex-col gap-1 text-[11px] text-[#3c3c43]">
          <div className="flex flex-wrap justify-between gap-x-2" data-testid="cost-format-annual">
            <dt className="shrink-0">事業全体の年間</dt>
            <dd className="flex min-w-0 flex-1 flex-wrap justify-end gap-x-2 tabular-nums">
              <span className="whitespace-nowrap">売上 {yen(result.revenueAnnual)}</span>
              <span className="whitespace-nowrap">総コスト {yen(result.totalAnnual)}</span>
              <span className={`whitespace-nowrap ${result.profitAnnual < 0 ? "text-[#be123c]" : ""}`}>利益 {yen(result.profitAnnual)}</span>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 操作パネル（前提と作業）
// ---------------------------------------------------------------------------------------------

function AssumptionRow({ a, saved, onChange }: { a: CostAssumption; saved: CostAssumption | undefined; onChange: CostFormatChange }) {
  return (
    <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:justify-between">
      <span className="flex min-w-0 flex-wrap items-center gap-1 text-[12px] text-[#1d1d1f]">
        {a.label}
        <ConfidenceTag value={a.confidence} />
        <NoteToggle note={a.note} />
      </span>
      <span className="flex items-center gap-1">
        <NumberField
          ariaLabel={a.label}
          value={a.value}
          baseline={saved?.value ?? null}
          onChange={(v) => onChange("assumption", a.costAssumptionId, "value", v)}
          widthClass={Math.abs(a.value ?? 0) >= 1e9 ? "w-44 xl:w-32" : "w-36 xl:w-28"}
        />
        {a.unit && <span className="text-[11px] text-[#6e6e73]">{a.unit}</span>}
      </span>
    </li>
  );
}

function TargetRow({ working, saved, unit, onChange }: { working: CostModelBundle; saved: CostModelBundle; unit: string; onChange: CostFormatChange }) {
  return (
    <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:justify-between">
      <span className="flex min-w-0 flex-wrap items-center gap-1 text-[12px] text-[#1d1d1f]">
        総コスト目標
        <NoteToggle note={working.model.targetNote} />
      </span>
      <span className="flex items-center gap-1">
        <NumberField
          ariaLabel="総コスト目標"
          value={working.model.targetTotalCostPerUnit}
          baseline={saved.model.targetTotalCostPerUnit}
          onChange={(v) => onChange("model", working.model.costModelId, "targetTotalCostPerUnit", v)}
          allowNull
          min={0}
          placeholder="空欄＝目標なし"
          widthClass="w-36 xl:w-28"
        />
        <span className="text-[11px] text-[#6e6e73]">円/{unit}</span>
      </span>
    </li>
  );
}

function ItemRows({ items, saved, lines, unit, onChange }: { items: CostItem[]; saved: CostModelBundle; lines: ItemsLine[]; unit: string; onChange: CostFormatChange }) {
  return (
    <div className="flex flex-col">
      <div className="hidden grid-cols-[minmax(0,1fr)_64px_128px_64px_88px] gap-2 border-b border-[#f0f0f2] pb-1 text-[10px] text-[#6e6e73] xl:grid">
        <span>明細（行の下に計算と根拠）</span>
        <span className="text-right">数量</span>
        <span className="text-right">単価</span>
        <span className="text-right">耐用年数</span>
        <span className="text-right">円/{unit}</span>
      </div>
      {items.map((i) => {
        const s = saved.items.find((x) => x.costItemId === i.costItemId);
        const line = lines.find((l) => l.entity === "item" && l.id === i.costItemId);
        const label = itemsItemLabel(i);
        const capex = i.costType === "CAPEX";
        return (
          <div key={i.costItemId} className="border-b border-[#f0f0f2] py-1.5 last:border-b-0">
            <div className="grid grid-cols-1 items-center gap-x-2 gap-y-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_64px_128px_64px_88px]">
              <span className="flex min-w-0 flex-wrap items-center gap-1 text-[12px] text-[#1d1d1f] sm:col-span-2 xl:col-span-1">
                {label}
                <ConfidenceTag value={i.confidence} />
                <span className="basis-full text-[10px] text-[#6e6e73]">
                  {capex ? "CAPEX・初期投資を耐用年数で割る" : i.basis === "年額固定" ? "OPEX・年額" : `OPEX・1${unit}あたり`}
                </span>
              </span>
              <Cell label="数量">
                <NumberField ariaLabel={`${label} 数量`} value={i.quantity} baseline={s?.quantity ?? null} min={0} compact widthClass="w-16" onChange={(v) => onChange("item", i.costItemId, "quantity", v)} />
              </Cell>
              <Cell label="単価">
                <NumberField ariaLabel={`${label} 単価`} value={i.unitPrice} baseline={s?.unitPrice ?? null} min={0} compact widthClass="w-28" onChange={(v) => onChange("item", i.costItemId, "unitPrice", v)} />
              </Cell>
              <Cell label="耐用年数">
                {capex ? (
                  <NumberField
                    ariaLabel={`${label} 耐用年数`}
                    value={i.usefulLifeYears}
                    baseline={s?.usefulLifeYears ?? null}
                    min={0.5}
                    allowNull
                    compact
                    widthClass="w-14"
                    onChange={(v) => onChange("item", i.costItemId, "usefulLifeYears", v)}
                  />
                ) : (
                  <span className="text-[11px] text-[#86868b]">—</span>
                )}
              </Cell>
              <Cell label={`円/${unit}`}>
                <span className="text-[12px] font-semibold tabular-nums text-[#1d1d1f]">{line ? amount(line.perUnit) : "—"}</span>
              </Cell>
            </div>
            {line && <ItemCalcLine calc={line.calc} />}
            <ItemNoteLine note={i.note} />
          </div>
        );
      })}
    </div>
  );
}

function TaskRows({ tasks, saved, lines, unit, onChange }: { tasks: CostTask[]; saved: CostModelBundle; lines: ItemsLine[]; unit: string; onChange: CostFormatChange }) {
  return (
    <div className="flex flex-col">
      <div className="hidden grid-cols-[minmax(0,1fr)_78px_110px_92px_88px] gap-2 border-b border-[#f0f0f2] pb-1 text-[10px] text-[#6e6e73] xl:grid">
        <span>作業</span>
        <span className="text-right">1回の工数(時)</span>
        <span className="text-right">年間回数</span>
        <span className="text-right">1回の経費(円)</span>
        <span className="text-right">円/{unit}</span>
      </div>
      {tasks.map((t) => {
        const s = (saved.tasks ?? []).find((x) => x.costTaskId === t.costTaskId);
        const line = lines.find((l) => l.entity === "task" && l.id === t.costTaskId);
        return (
          <div key={t.costTaskId} className="border-b border-[#f0f0f2] py-1.5 last:border-b-0">
            <div className="grid grid-cols-1 items-center gap-x-2 gap-y-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_78px_110px_92px_88px]">
              <span className="flex min-w-0 flex-wrap items-center gap-1 text-[12px] text-[#1d1d1f] sm:col-span-2 xl:col-span-1">
                {t.label}
                <ConfidenceTag value={t.confidence} />
                {line && <span className="basis-full text-[10px] text-[#6e6e73]">年 {yen(line.annual)}（{int(line.hours)}時間）</span>}
              </span>
              <Cell label="1回の工数(時)">
                <NumberField
                  ariaLabel={`${t.label} 1回の工数`}
                  value={t.hoursPerOccurrence}
                  baseline={s?.hoursPerOccurrence ?? null}
                  allowNull
                  min={0}
                  placeholder="未確認"
                  compact
                  widthClass="w-16"
                  onChange={(v) => onChange("task", t.costTaskId, "hoursPerOccurrence", v)}
                />
              </Cell>
              <Cell label="年間回数">
                {t.countDriver === "batch" ? (
                  <span className="text-[11px] tabular-nums text-[#3c3c43]">{line ? int(line.occurrences) : "—"}回（1{unit}ごと）</span>
                ) : (
                  <NumberField
                    ariaLabel={`${t.label} 年間回数`}
                    value={t.countPerYear}
                    baseline={s?.countPerYear ?? null}
                    min={0}
                    compact
                    widthClass="w-16"
                    onChange={(v) => onChange("task", t.costTaskId, "countPerYear", v ?? 0)}
                  />
                )}
              </Cell>
              <Cell label="1回の経費(円)">
                <NumberField
                  ariaLabel={`${t.label} 1回の経費`}
                  value={t.expensePerOccurrence}
                  baseline={s?.expensePerOccurrence ?? null}
                  min={0}
                  compact
                  widthClass="w-20"
                  onChange={(v) => onChange("task", t.costTaskId, "expensePerOccurrence", v ?? 0)}
                />
              </Cell>
              <Cell label={`円/${unit}`}>
                <span className="text-[12px] font-semibold tabular-nums text-[#1d1d1f]">{line ? amount(line.perUnit) : "—"}</span>
              </Cell>
            </div>
            {line && <ItemCalcLine calc={line.calc} />}
            <ItemNoteLine note={t.note} />
          </div>
        );
      })}
    </div>
  );
}

export function CostFormatControls({
  saved,
  working,
  result,
  groups,
  unit,
  caseLabel,
  onChange,
  scrollable,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  result: ItemsResult;
  groups: CostFormatInputGroup[];
  unit: string;
  caseLabel: string;
  onChange: CostFormatChange;
  scrollable: boolean;
}) {
  const jump = (id: string) => {
    const target = document.getElementById(id);
    const pane = target?.closest<HTMLElement>('[data-testid="cost-format-controls"]');
    if (scrollable && pane && target) {
      const nav = pane.querySelector("nav");
      const offset = target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - (nav?.clientHeight ?? 0) - 8;
      pane.scrollTo({ top: offset, behavior: "smooth" });
    } else {
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const jumpToGroup = (groupKey: string) => {
    jump(`cf-g-${groupKey}`);
    flashElement(`cf-g-${groupKey}`);
  };
  const breakdown = costFormatBreakdown(result, groups);
  const tasks = working.tasks ?? [];
  const blocks = COST_INPUT_BLOCKS.map((block) => ({ block, groups: groups.filter((g) => g.block === block.key && (g.assumptions.length > 0 || g.items.length > 0 || g.tasks.length > 0 || g.target)) })).filter(
    (b) => b.groups.length > 0
  );
  const taskLines = result.lines.filter((l) => l.entity === "task");
  return (
    <div data-testid="cost-format-controls" className={scrollable ? "h-full overflow-y-auto overscroll-contain" : ""}>
      <nav aria-label="操作パネルの目次" className={`z-10 flex flex-wrap items-center gap-1 border-b border-[#e5e5e7] bg-white px-2 py-1 ${scrollable ? "sticky top-0" : ""}`}>
        <button type="button" onClick={() => jump("cf-breakdown")} className={NAV_BUTTON}>
          内訳
        </button>
        {tasks.length > 0 && (
          <button type="button" onClick={() => jump("cf-flow")} className={NAV_BUTTON}>
            作業と工数
          </button>
        )}
        {blocks.map(({ block }) => (
          <button key={block.key} type="button" onClick={() => jump(`cf-block-${block.key}`)} className={NAV_BUTTON}>
            {block.label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-3 p-3">
        <CostBreakdownGuide
          id="cf-breakdown"
          testId="cost-format-breakdown-guide"
          unit={unit}
          scenarioLabel={caseLabel}
          slices={breakdown.map((r) => ({ key: r.key, label: r.label, color: r.color, amount: r.amount, parts: r.parts.map((p) => ({ label: p.label, amount: p.amount, groupKey: p.groupKey })) }))}
          groupTitle={(key) => groups.find((g) => g.key === key)?.title}
          onJump={jumpToGroup}
          formatAmount={amount}
        />
        {tasks.length > 0 && (
          <section id="cf-flow" aria-label="作業と工数" className="scroll-mt-12 rounded-lg border border-[#e5e5e7] px-2.5 py-2" data-testid="cost-format-flow">
            <h4 className="text-[13px] font-semibold text-[#1d1d1f]">作業と工数</h4>
            <p className="text-[11px] text-[#3c3c43]">
              作業工数 年 <span className="font-semibold tabular-nums">{int(result.hoursAnnual)}</span>時間・作業費{" "}
              <span className="font-semibold tabular-nums">{amount(taskLines.reduce((s, l) => s + l.perUnit, 0))}</span> 円/{unit}（年 {yen(taskLines.reduce((s, l) => s + l.annual, 0))}）
            </p>
            <ol aria-label="作業の流れ" className="mt-1 flex flex-col gap-0.5">
              {taskLines.map((l, i) => (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]">
                  <span className="min-w-[8em] flex-1">
                    {i + 1}. {l.label}
                    <span className="ml-1 text-[#6e6e73]">
                      {int(l.occurrences)}回 × {num(l.hours / Math.max(l.occurrences, 1), 1)}時間
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 tabular-nums text-[#1d1d1f]">
                    {int(l.hours)}時間・{amount(l.perUnit)} 円
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
        {blocks.map(({ block, groups: blockGroups }) => (
          <section key={block.key} id={`cf-block-${block.key}`} aria-label={block.label} className="scroll-mt-12 rounded-lg border border-[#e5e5e7]">
            <div className="px-2.5 pt-2">
              <h4 className="text-[13px] font-semibold text-[#1d1d1f]">{costFormatBlockTitle(block.key)}</h4>
              <div className="mt-1 flex flex-wrap gap-1" aria-label={`${block.label}の区分`}>
                {blockGroups.map((g) => (
                  <button key={g.key} type="button" onClick={() => jumpToGroup(g.key)} className="min-h-[32px] rounded-full border border-[#d2d2d7] px-2 text-[11px] text-[#3c3c43] hover:border-[#7cbceb] xl:min-h-[22px]">
                    {g.title}
                  </button>
                ))}
              </div>
            </div>
            {blockGroups.map((g) => (
              <section key={g.key} id={`cf-g-${g.key}`} aria-label={g.title} className="scroll-mt-12 border-t border-[#f0f0f2] px-2.5 py-2">
                <h5 className="text-[12px] font-semibold text-[#1d1d1f]">{g.title}</h5>
                <p className="text-[10px] leading-4 text-[#6e6e73]">{g.hint}</p>
                {(g.assumptions.length > 0 || g.target) && (
                  <ul className="mt-1 divide-y divide-[#f0f0f2]">
                    {g.assumptions.map((a) => (
                      <AssumptionRow key={a.costAssumptionId} a={a} saved={saved.assumptions.find((x) => x.costAssumptionId === a.costAssumptionId)} onChange={onChange} />
                    ))}
                    {g.target && <TargetRow working={working} saved={saved} unit={unit} onChange={onChange} />}
                  </ul>
                )}
                {g.key === "cond-scale" && result.volume > 0 && (
                  <Formula testId="cost-format-scale">
                    売上 ＝ 年間の量 {int(result.volume)} {unit} × 売価 {amount(result.salePrice)} 円/{unit} ＝ {yen(result.revenueAnnual)}/年。1{unit}あたりの原価は、1{unit}あたりの明細に、年額の費用・設備の償却・作業の年額を年間の量で割って足した額。
                  </Formula>
                )}
                {g.tasks.length > 0 && <TaskRows tasks={g.tasks} saved={saved} lines={result.lines} unit={unit} onChange={onChange} />}
                {g.items.length > 0 && <ItemRows items={g.items} saved={saved} lines={result.lines} unit={unit} onChange={onChange} />}
              </section>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 読み物
// ---------------------------------------------------------------------------------------------

export function Card({ id, title, hint, children, section }: { id?: string; title: string; hint?: string; children: ReactNode; section: string }) {
  return (
    <section id={id} data-cost-section={section} aria-label={title} className="scroll-mt-4 rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
      <h3 className="text-[13px] font-semibold text-[#1d1d1f]">{title}</h3>
      {hint && <p className="mt-1 text-[11px] leading-5 text-[#6e6e73]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function NoteList({ notes }: { notes: CostModelBundle["notes"] }) {
  return (
    <div className="flex flex-col gap-3">
      {notes.map((n) => (
        <div key={n.costNoteId}>
          <p className="text-[12px] font-semibold text-[#1d1d1f]">{n.title}</p>
          {n.bodyMd && (
            <div className="mt-1 text-[12px] leading-6 text-[#3c3c43]">
              <MiniMarkdown text={n.bodyMd} />
            </div>
          )}
          {(n.sourceLabel || n.sourceUrl) && (
            <p className="mt-1 text-[11px] text-[#6e6e73]">
              出所:{" "}
              {n.sourceUrl ? (
                <a href={n.sourceUrl} target="_blank" rel="noreferrer" className="text-[#0267b2] underline">
                  {n.sourceLabel || n.sourceUrl}
                </a>
              ) : (
                n.sourceLabel
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

const unregistered = <p className="text-[12px] text-[#86868b]">未登録</p>;

export function CostFormatReading({
  saved,
  working,
  unit,
  cases,
  caseResults,
  result,
  groups,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  unit: string;
  cases: ItemsVolumeCase[];
  caseResults: ItemsResult[];
  result: ItemsResult;
  groups: CostFormatInputGroup[];
}) {
  const { model } = working;
  const notes = (section: string) => working.notes.filter((n) => n.section === section);
  const caveats = notes("caveat");
  const confidence = costFormatConfidence(result);
  const uncertain = costFormatUncertain(result);
  const openQuestions = working.questions.filter((q) => q.status === "open").sort((a, b) => (b.impactHigh ?? 0) - (a.impactHigh ?? 0));
  const unused = unusedAssumptions(working);
  const changed = (entity: "assumption" | "item" | "task", id: string) => {
    if (entity === "assumption") {
      const a = working.assumptions.find((x) => x.costAssumptionId === id);
      const s = saved.assumptions.find((x) => x.costAssumptionId === id);
      return !!a && !!s && (a.value !== s.value || a.valueText !== s.valueText);
    }
    if (entity === "item") {
      const a = working.items.find((x) => x.costItemId === id);
      const s = saved.items.find((x) => x.costItemId === id);
      return !!a && !!s && (a.unitPrice !== s.unitPrice || a.quantity !== s.quantity || a.usefulLifeYears !== s.usefulLifeYears);
    }
    const a = (working.tasks ?? []).find((x) => x.costTaskId === id);
    const s = (saved.tasks ?? []).find((x) => x.costTaskId === id);
    return !!a && !!s && (a.hoursPerOccurrence !== s.hoursPerOccurrence || a.countPerYear !== s.countPerYear || a.expensePerOccurrence !== s.expensePerOccurrence);
  };
  const Changed = ({ on }: { on: boolean }) =>
    on ? <span className="ml-1 rounded bg-[#e8f3fc] px-1 text-[10px] font-semibold text-[#0267b2]" title="保存値から書き換えて試算している">試算中</span> : null;
  const caseRows = caseResults.map((r) => costFormatBreakdown(r, groups));
  const hc = confidence.filter((c) => c.grade === "H" || c.grade === "C").reduce((s, c) => s + c.share, 0);

  return (
    <div className="flex flex-col gap-3">
      <Card id="cf-about" section="about" title="この試算について" hint={[model.caseLabel, model.versionLabel].filter(Boolean).join(" ・ ")}>
        {model.summaryMd ? (
          <div className="text-[12px] leading-6 text-[#3c3c43]">
            <MiniMarkdown text={model.summaryMd} />
          </div>
        ) : (
          unregistered
        )}
        {model.sourceNote && <p className="mt-2 text-[11px] text-[#6e6e73]">元にした資料: {model.sourceNote}</p>}
        {model.sourceUrl && (
          <a href={model.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-[#0267b2] underline">
            原典
          </a>
        )}
        {model.systemScopeMd && (
          <div className="mt-3 border-t border-[#f0f0f2] pt-3">
            <p className="text-[12px] font-semibold text-[#1d1d1f]">想定している系</p>
            <div className="mt-1 text-[12px] leading-6 text-[#3c3c43]">
              <MiniMarkdown text={model.systemScopeMd} />
            </div>
          </div>
        )}
        {caveats.length > 0 && (
          <div className="mt-3 border-t border-[#f0f0f2] pt-3">
            <p className="mb-2 text-[12px] font-semibold text-[#1d1d1f]">注意して読むところ</p>
            <NoteList notes={caveats} />
          </div>
        )}
      </Card>

      <Card section="cases" title={`ケースごとの内訳（1${unit}あたり・円/${unit}）`} hint="年間の量で、量で薄まる費用（設備の償却・年額の費用・作業）がどう変わるか">
        {cases.length === 0 ? (
          unregistered
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] table-fixed text-[11px]">
              <thead>
                <tr className="text-[#6e6e73]">
                  <th className="w-[170px] py-1 text-left font-normal">区分</th>
                  {cases.map((c) => (
                    <th key={c.key} className="py-1 text-right font-semibold text-[#1d1d1f]">
                      {int(c.volume)}
                      {unit}/年
                      {c.label && <span className="block text-[10px] font-normal text-[#6e6e73]">{c.label}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {caseRows[0].map((row, ri) => (
                  <tr key={row.key} className="border-t border-[#f0f0f2]">
                    <td className="py-1 text-left">
                      <span className="inline-flex items-center gap-1">
                        <Swatch color={row.color} />
                        {row.label}
                      </span>
                    </td>
                    {caseRows.map((rows, ci) => (
                      <td key={cases[ci].key} className="py-1 text-right">
                        {rows[ri].amount === 0 ? "—" : amount(rows[ri].amount)}
                      </td>
                    ))}
                  </tr>
                ))}
                {[
                  { label: "総コスト", value: (r: ItemsResult) => amount(r.totalPerUnit), strong: true },
                  { label: "売価", value: (r: ItemsResult) => (r.salePrice > 0 ? amount(r.salePrice) : "—") },
                  { label: "利益（利益率）", value: (r: ItemsResult) => (r.salePrice > 0 ? `${signed(r.profitPerUnit, digitsOf(r.profitPerUnit))}（${pct(r.marginRate)}）` : "—") },
                  { label: "年間の売上", value: (r: ItemsResult) => yen(r.revenueAnnual) },
                  { label: "年間の総コスト", value: (r: ItemsResult) => yen(r.totalAnnual) },
                  { label: "年間の利益", value: (r: ItemsResult) => yen(r.profitAnnual) },
                  { label: "初期投資（CAPEX）", value: (r: ItemsResult) => yen(r.capexInitial) },
                ].map((m) => (
                  <tr key={m.label} className="border-t border-[#e5e5e7]">
                    <td className={`py-1 text-left ${m.strong ? "font-semibold" : ""}`}>{m.label}</td>
                    {caseResults.map((r, ci) => (
                      <td key={cases[ci].key} className={`py-1 text-right ${m.strong ? "font-semibold" : ""}`}>
                        {m.value(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card section="confidence" title="この数字の確からしさ" hint="総コストのうち、どの確度の数字がどれだけを占めるか。仮置き（C）と仮説（H）の行が大きいほど、総コストは動きやすい">
        {confidence.length === 0 ? (
          unregistered
        ) : (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#f0f0f2]" aria-hidden="true">
              {confidence.map((c) => (
                <span
                  key={c.grade}
                  className="h-full"
                  style={{
                    width: `${c.share * 100}%`,
                    backgroundColor: c.grade === "H" ? "#fb7185" : c.grade === "C" ? "#fbbf24" : c.grade === "S" ? "#34d399" : c.grade === "未設定" ? "#d2d2d7" : "#7cbceb",
                  }}
                />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#3c3c43]">
              {confidence.map((c) => (
                <li key={c.grade} className="inline-flex items-center gap-1">
                  <ConfidenceTag value={c.grade} />
                  <span className="tabular-nums">
                    {amount(c.amount)} 円/{unit}（{pct(c.share)}）
                  </span>
                </li>
              ))}
              <li className={`font-semibold ${hc > 0.3 ? "text-[#be123c]" : "text-[#3c3c43]"}`}>仮説＋仮置き {pct(hc)}</li>
            </ul>
            {uncertain.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <p className="text-[12px] font-semibold text-[#1d1d1f]">精度を下げている項目（金額順）</p>
                <table className="mt-1 w-full min-w-[520px] table-fixed text-[11px]">
                  <thead>
                    <tr className="text-[#6e6e73]">
                      <th className="py-1 text-left font-normal">項目</th>
                      <th className="w-[110px] py-1 text-right font-normal">円/{unit}</th>
                      <th className="w-[72px] py-1 text-left font-normal">確度</th>
                      <th className="w-[80px] py-1 text-left font-normal">出所</th>
                      <th className="w-[80px] py-1 text-left font-normal">確認先</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uncertain.map((l) => (
                      <tr key={`${l.entity}-${l.id}`} className="border-t border-[#f0f0f2]">
                        <td className="py-1">{l.label}</td>
                        <td className="py-1 text-right tabular-nums">{amount(l.perUnit)}</td>
                        <td className="py-1">
                          <ConfidenceTag value={l.confidence ?? "未設定"} />
                        </td>
                        <td className="py-1">{l.sourceKind ?? "—"}</td>
                        <td className="py-1">{l.owner ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      <Card id="cf-guide" section="questions" title={`確認事項（未確定 ${openQuestions.length}件）と出典`} hint="答えが出ると総コストが動く問いと、外部ベンチマーク・この画面の見方">
        {openQuestions.length === 0 && notes("benchmark").length === 0 && notes("reading_guide").length === 0 ? (
          unregistered
        ) : (
          <div className="flex flex-col gap-3">
            {openQuestions.length > 0 && (
              <ul className="flex flex-col gap-2">
                {openQuestions.map((q) => (
                  <li key={q.costQuestionId} className="text-[12px] leading-5 text-[#3c3c43]">
                    <span className="mr-1 rounded border border-[#d2d2d7] px-1 text-[10px] text-[#3c3c43]">{q.addressee}</span>
                    {q.question}
                    {q.impactHigh !== null && (
                      <span className="ml-1 rounded bg-[#1d1d1f] px-1.5 text-[10px] font-semibold text-white">
                        ±{amount(q.impactHigh)} 円/{unit}
                      </span>
                    )}
                    {q.whyItMatters && <span className="block text-[11px] text-[#6e6e73]">{q.whyItMatters}</span>}
                  </li>
                ))}
              </ul>
            )}
            {notes("benchmark").length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-semibold text-[#1d1d1f]">外部ベンチマークと出典</p>
                <NoteList notes={notes("benchmark")} />
              </div>
            )}
            {notes("reading_guide").length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-semibold text-[#1d1d1f]">この画面の見方</p>
                <NoteList notes={notes("reading_guide")} />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card section="lines" title="前提・作業・費用明細" hint="計算に使う数字のすべて。表の数字は試算中の変更を重ねた値で、書き換えた欄には「試算中」の印が付く">
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <p className="text-[12px] font-semibold text-[#1d1d1f]">すべての前提</p>
            <table className="mt-1 w-full min-w-[560px] table-fixed text-[11px]">
              <thead>
                <tr className="text-[#6e6e73]">
                  <th className="py-1 text-left font-normal">変数</th>
                  <th className="w-[140px] py-1 text-right font-normal">値</th>
                  <th className="w-[72px] py-1 text-left font-normal">確度</th>
                  <th className="w-[80px] py-1 text-left font-normal">出所</th>
                  <th className="w-[80px] py-1 text-left font-normal">確認先</th>
                </tr>
              </thead>
              <tbody>
                {working.assumptions.map((a) => {
                  const isUnused = unused.includes(a);
                  return (
                    <tr key={a.costAssumptionId} className={`border-t border-[#f0f0f2] ${isUnused ? "text-[#6e6e73]" : ""}`}>
                      <td className="py-1">
                        {a.label}
                        {isUnused && <span className="ml-1 text-[10px]">（計算に使っていない）</span>}
                        {a.note && <span className="block text-[10px] leading-4 text-[#6e6e73]">{a.note}</span>}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {a.value !== null ? `${a.value.toLocaleString("ja-JP")} ${a.unit ?? ""}` : a.valueText ?? "空欄"}
                        <Changed on={changed("assumption", a.costAssumptionId)} />
                      </td>
                      <td className="py-1">
                        <ConfidenceTag value={a.confidence} />
                      </td>
                      <td className="py-1">{a.sourceKind ?? "—"}</td>
                      <td className="py-1">{a.owner ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(working.tasks ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-[12px] font-semibold text-[#1d1d1f]">作業リストの根拠と確認先</p>
              <table className="mt-1 w-full min-w-[620px] table-fixed text-[11px]">
                <thead>
                  <tr className="text-[#6e6e73]">
                    <th className="py-1 text-left font-normal">作業</th>
                    <th className="w-[80px] py-1 text-right font-normal">1回の工数</th>
                    <th className="w-[80px] py-1 text-right font-normal">年間回数</th>
                    <th className="w-[90px] py-1 text-right font-normal">1回の経費</th>
                    <th className="w-[120px] py-1 text-right font-normal">年額(円)</th>
                    <th className="w-[96px] py-1 text-left font-normal">確度・出所</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {(working.tasks ?? []).map((t) => {
                    const line = result.lines.find((l) => l.entity === "task" && l.id === t.costTaskId);
                    return (
                      <tr key={t.costTaskId} className="border-t border-[#f0f0f2]">
                        <td className="py-1">
                          {t.label}
                          {t.note && <span className="block text-[10px] leading-4 text-[#6e6e73]">{t.note}</span>}
                        </td>
                        <td className="py-1 text-right">
                          {t.hoursPerOccurrence === null ? "未確認" : `${num(t.hoursPerOccurrence, 1)}時間`}
                          <Changed on={changed("task", t.costTaskId)} />
                        </td>
                        <td className="py-1 text-right">{line ? `${int(line.occurrences)}回` : "—"}</td>
                        <td className="py-1 text-right">{yen(t.expensePerOccurrence)}</td>
                        <td className="py-1 text-right">{line ? yen(line.annual) : "—"}</td>
                        <td className="py-1">
                          <ConfidenceTag value={t.confidence} /> {t.sourceKind ?? ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-1 text-[10px] text-[#6e6e73]">作業単価はすべての作業で共通の {yen(roleNumber(working.assumptions, "labor_rate", 0))}/時。</p>
            </div>
          )}
          {(["CAPEX", "OPEX"] as const).map((type) => {
            const rows = result.lines.filter((l) => l.entity === "item" && l.costType === type);
            if (rows.length === 0) return null;
            return (
              <div key={type} className="overflow-x-auto">
                <p className="text-[12px] font-semibold text-[#1d1d1f]">費用明細（{type === "CAPEX" ? "CAPEX・初期投資" : "OPEX・毎年の費用"}）</p>
                <table className="mt-1 w-full min-w-[640px] table-fixed text-[11px]">
                  <thead>
                    <tr className="text-[#6e6e73]">
                      <th className="py-1 text-left font-normal">項目</th>
                      <th className="w-[120px] py-1 text-right font-normal">{type === "CAPEX" ? "初期投資(円)" : "年額(円)"}</th>
                      <th className="w-[60px] py-1 text-right font-normal">耐用</th>
                      <th className="w-[110px] py-1 text-right font-normal">円/{unit}</th>
                      <th className="w-[110px] py-1 text-left font-normal">内訳の行</th>
                      <th className="w-[96px] py-1 text-left font-normal">確度・出所</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {rows.map((l) => {
                      const item = working.items.find((i) => i.costItemId === l.id);
                      return (
                        <tr key={l.id} className="border-t border-[#f0f0f2]">
                          <td className="py-1">
                            {l.group !== l.label ? `${l.group}・` : ""}
                            {l.label}
                            <Changed on={changed("item", l.id)} />
                            {l.note && <span className="block text-[10px] leading-4 text-[#6e6e73]">{l.note}</span>}
                          </td>
                          <td className="py-1 text-right">{yen(type === "CAPEX" ? l.initial : l.annual)}</td>
                          <td className="py-1 text-right">{type === "CAPEX" && item?.usefulLifeYears ? `${num(item.usefulLifeYears, 0)}年` : "—"}</td>
                          <td className="py-1 text-right">{amount(l.perUnit)}</td>
                          <td className="py-1">{breakdownLabel(l.row)}</td>
                          <td className="py-1">
                            <ConfidenceTag value={l.confidence} /> {l.sourceKind ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </Card>

      <Card section="history" title="版の履歴と、この試算が答えていないこと">
        {notes("history").length > 0 ? <NoteList notes={notes("history")} /> : unregistered}
      </Card>
    </div>
  );
}

const COST_ROW_LABEL = new Map<string, string>(COST_BREAKDOWN_ROWS.map((r) => [r.key, r.label]));

function breakdownLabel(key: string) {
  return COST_ROW_LABEL.get(key) ?? key;
}
