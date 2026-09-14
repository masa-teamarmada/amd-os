"use client";

import { useState } from "react";
import {
  APPLICATION_LABEL,
  BREAKDOWN_HINT,
  BREAKDOWN_LABEL,
  BREAKDOWN_ORDER,
  LOCATION_SHORT_LABEL,
  METHODS,
  METHOD_LABEL,
  STRAIN_LABEL,
  biomassOf,
  scenarioFullLabelOf,
  type CostApplication,
  type CostTankBearer,
  type CostBreakdownKey,
  type CostComputation,
  type CostLocation,
  type CostMethod,
  type CostScenarioResult,
  type CostStrain,
  type CostTankMode,
  type CostTaskFlow,
} from "@/lib/project-cost-model";
import { CATEGORY_COLOR, CATEGORY_SHORT_LABEL, Delta, Swatch, bigNum, int, num, signed, yen } from "@/components/cockpit/CockpitCostModelParts";

// コスト試算タブの結果パネル。操作パネルの横に置き、数字を動かしたときに全体がどう変わるかを
// スクロールせずに見られるようにする (まさ 2026-09-13)。値の横の矢印は保存値からの差。
// 方式 (オンサイト / オフサイト) × 装置の総コストは内訳の色で積んだ棒で並べ (同じ目盛りで比べる)、
// 選んだ組み合わせの内訳は区分ごとの棒と割合で出す (まさ 2026-09-13「どこがどのくらいの割合でコスト食ってるのか。棒グラフとかで」)。

export interface CostViewSelection {
  strain: CostStrain | null;
  application: CostApplication | null;
  /** 方式 (オンサイト / オフサイト)。 */
  location: CostLocation;
  /** 装置 (循環カートリッジ / 直接投入)。 */
  method: CostMethod;
  /** 槽。オフサイトは常に新設。オンサイトの槽を顧客が持つときは既設 (SX の負担0) だけ。 */
  tankMode: CostTankMode;
  /** オンサイトの槽を誰が持つか。 */
  onsiteTankBearer: CostTankBearer;
}

export function findScenario(
  c: CostComputation,
  application: CostApplication | null,
  location: CostLocation,
  method: CostMethod,
  tankMode: CostTankMode
) {
  const tank = location === "offsite" ? "新設" : tankMode;
  return c.scenarios.find((s) => s.application === application && s.location === location && s.method === method && s.tankMode === tank);
}

export function selectionLabel(sel: CostViewSelection) {
  return [
    sel.strain ? STRAIN_LABEL[sel.strain] : null,
    sel.application ? APPLICATION_LABEL[sel.application] : null,
    scenarioFullLabelOf(sel.location, sel.method, sel.tankMode, sel.onsiteTankBearer),
  ]
    .filter(Boolean)
    .join("・");
}

/** 総コストが売価・目標のどこにあるか。色だけで伝えず、必ず言葉を添える。 */
export function costStatus(s: CostScenarioResult, hasMargin: boolean) {
  if (s.gapToAllowedPerUnit < 0) return { label: hasMargin ? "上限超" : "赤字", cls: "text-[#be123c]" };
  if (s.gapToTargetPerUnit !== null && s.gapToTargetPerUnit < 0) return { label: "目標超", cls: "text-[#b45309]" };
  return { label: s.gapToTargetPerUnit !== null ? "目標内" : "黒字", cls: "text-[#1d1d1f]" };
}

interface Props {
  unit: string;
  computed: CostComputation;
  baseline: CostComputation;
  /** 同じ前提で、もう一方の株にしたときの計算。株が1つなら null。 */
  otherStrain: CostComputation | null;
  selection: CostViewSelection;
  hasMargin: boolean;
  targetTotal: number | null;
  flow: CostTaskFlow;
  baselineFlow: CostTaskFlow;
  onSelectStrain: (strain: CostStrain) => void;
  onSelectScenario: (application: CostApplication | null, location: CostLocation, method: CostMethod) => void;
  /** 操作パネルの「作業の流れと工数」へ移る。 */
  onShowFlow: () => void;
}

/** 結果の棒の並び。方式 (オンサイト → オフサイト) × 装置。オンサイトの槽は選んでいる槽。 */
export function scenarioSlots(c: CostComputation, tankMode: CostTankMode): Array<{ location: CostLocation; method: CostMethod; tankMode: CostTankMode }> {
  return c.locations.flatMap((location) => METHODS.map((method) => ({ location, method, tankMode: location === "offsite" ? "新設" : tankMode })));
}

function statusHint(hasMargin: boolean, targetTotal: number | null) {
  return [hasMargin ? "上限超＝目標利益率を引いた上限を超える" : "赤字＝売価を超える", targetTotal !== null ? "目標超＝売価以下で目標を超える" : null, targetTotal !== null ? "目標内＝目標以下" : null]
    .filter(Boolean)
    .join("／");
}

function breakdownTitle(s: CostScenarioResult, unit: string, clipped: boolean) {
  return [
    `${s.label} 総コスト ${num(s.totalPerUnit)} 円/${unit}${clipped ? "（棒は目盛りの外まで伸びている）" : ""}`,
    ...s.breakdown.filter((b) => b.perUnit > 0).map((b) => `${b.label} ${num(b.perUnit)}`),
  ].join("\n");
}

/** 積み上げの各段の開始位置 (それより前の段の合計)。 */
export function stackOffsets<T>(items: T[], valueOf: (item: T) => number): Array<{ item: T; start: number }> {
  const out: Array<{ item: T; start: number }> = [];
  let start = 0;
  for (const item of items) {
    out.push({ item, start });
    start += valueOf(item);
  }
  return out;
}

/** 総コストを内訳の色で積んだ横棒。目盛りは全シナリオで共通。目盛りを超える棒は端を切って ≫ を付ける。 */
function StackedBar({ scenario, scaleMax, price, target }: { scenario: CostScenarioResult; scaleMax: number; price: number; target: number | null }) {
  const segments = stackOffsets(scenario.breakdown.filter((b) => b.perUnit > 0), (b) => b.perUnit);
  const clipped = scenario.totalPerUnit > scaleMax;
  return (
    <span className="relative block h-[10px] w-full" aria-hidden="true">
      <span className="absolute inset-0 overflow-hidden">
        {segments.map(({ item: b, start }, i) => {
          const left = (start / scaleMax) * 100;
          const width = (b.perUnit / scaleMax) * 100;
          const last = i === segments.length - 1;
          return (
            <span
              key={b.key}
              className={`absolute inset-y-0 ${last ? "rounded-r-[4px]" : ""}`}
              style={{ left: `${left}%`, width: last ? `${width}%` : `max(0px, calc(${width}% - 2px))`, backgroundColor: CATEGORY_COLOR[b.key] }}
            />
          );
        })}
      </span>
      {price > 0 && price <= scaleMax && (
        <span className="absolute -inset-y-[3px] border-l border-dashed border-[#3c3c43]" style={{ left: `${(price / scaleMax) * 100}%` }} />
      )}
      {target !== null && target > 0 && target <= scaleMax && (
        <span className="absolute -inset-y-[3px] border-l border-dotted border-[#86868b]" style={{ left: `${(target / scaleMax) * 100}%` }} />
      )}
      {clipped && <span className="absolute -right-1 top-1/2 -translate-y-1/2 bg-white px-px text-[10px] font-semibold leading-none text-[#1d1d1f]">≫</span>}
    </span>
  );
}

export function CostResultsPanel({
  unit,
  computed,
  baseline,
  otherStrain,
  selection,
  hasMargin,
  targetTotal,
  flow,
  baselineFlow,
  onSelectStrain,
  onSelectScenario,
  onShowFlow,
}: Props) {
  const [openKey, setOpenKey] = useState<CostBreakdownKey | null>(null);
  const apps: Array<CostApplication | null> = computed.applications.length > 0 ? computed.applications : [null];
  const app = selection.application;
  const otherApp = apps.find((a) => a !== app) ?? null;
  const current = findScenario(computed, app, selection.location, selection.method, selection.tankMode);
  const currentBase = findScenario(baseline, app, selection.location, selection.method, selection.tankMode);
  const other = otherStrain ? findScenario(otherStrain, app, selection.location, selection.method, selection.tankMode) : undefined;
  const derived = computed.derivedByApplication.find((d) => d.application === app)?.derived ?? computed.derived;
  const b = biomassOf(computed, app);
  const slots = scenarioSlots(computed, selection.tankMode);
  const hasOffsite = computed.locations.includes("offsite");

  const rows = slots
    .map((slot) => ({ slot, s: findScenario(computed, app, slot.location, slot.method, slot.tankMode) }))
    .filter((r): r is { slot: (typeof slots)[number]; s: CostScenarioResult } => !!r.s);
  const onsiteMax = Math.max(0, ...rows.filter((r) => r.s.location === "onsite").map((r) => r.s.totalPerUnit));
  const allMax = Math.max(0, ...rows.map((r) => r.s.totalPerUnit));
  const price = derived.salePrice;
  // オフサイトが桁違いに大きいとオンサイトの棒が読めなくなるので、目盛りはオンサイトの最大の2倍 (売価の1.3倍) で頭打ちにする。
  const scaleMax = Math.max(Math.min(allMax, Math.max(onsiteMax * 2, price * 1.3)), price * 1.1, targetTotal ?? 0, 1);

  // 選んだ組み合わせと、方式だけを入れ替えた比較相手 (同じ装置。オンサイトの槽は選んでいる槽)。
  const counterpart = !hasOffsite || !current
    ? undefined
    : findScenario(computed, app, current.location === "onsite" ? "offsite" : "onsite", selection.method, selection.tankMode);

  const maxSlice = current ? Math.max(...current.breakdown.map((x) => x.perUnit), 1) : 1;

  return (
    <div className="flex flex-col gap-2" data-testid="cost-results">
      {/* 第1段: 株ごとの菌体1kgの原価。押すと株が切り替わる。 */}
      <section aria-label="菌体1kgの原価（第1段）" className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h4 className="text-[11px] font-semibold text-[#3c3c43]">菌体1kgの原価（第1段）</h4>
        {computed.biomassByStrain.filter((bs) => bs.application === app).map((bs) => {
          const active = bs.strain === computed.strain;
          const base = baseline.biomassByStrain.find((x) => x.strain === bs.strain && x.application === bs.application);
          return (
            <button
              key={bs.strain ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => bs.strain && onSelectStrain(bs.strain)}
              className={`flex min-h-[40px] items-baseline gap-x-1 rounded-md border px-2 py-0.5 text-left transition-colors xl:min-h-0 ${
                active ? "border-[#027fdc] bg-[#e8f3fc]" : "border-[#e5e5e7] bg-white hover:border-[#7cbceb]"
              }`}
            >
              <span className="text-[11px] font-semibold text-[#3c3c43]">{bs.strainLabel || "菌体"}</span>
              <span className="text-[14px] font-semibold text-[#1d1d1f]">{num(bs.perKg)}</span>
              <span className="text-[10px] text-[#6e6e73]">円/kg</span>
              {base && <Delta value={bs.perKg - base.perKg} className="text-[10px]" />}
            </button>
          );
        })}
        {b.fromVolume ? (
          <p className="w-full text-[10px] leading-4 text-[#6e6e73]" data-testid="cost-production-scale">
            年に作る量 <span className="font-semibold text-[#1d1d1f]">{bigNum(b.capacityKgYear / 1000)} t/年</span>（年間処理量 {bigNum(b.businessVolume)} {unit}
            {b.salesRate < 1 ? `・販売率 ${num(b.salesRate * 100, 0)}%` : ""}）・培養設備 {num(b.productionLines, 1)} 系列・初期投資 {yen(b.capexInitial)}
            {b.overridePerKg !== null && <span className="font-semibold text-[#b45309]">・上書き値 {num(b.overridePerKg)} 円/kg で計算中</span>}
          </p>
        ) : (b.salesRate < 1 || b.overridePerKg !== null) && (
          <p className="w-full text-[10px] leading-4 text-[#6e6e73]">
            生産 {num(b.capacityKgYear, 0)} kg/年 × 販売率 {num(b.salesRate * 100, 0)}% ＝ 売れる量 {num(b.soldKgYear, 0)} kg/年
            {b.overridePerKg !== null && <span className="font-semibold text-[#b45309]">・上書き値 {num(b.overridePerKg)} 円/kg で計算中</span>}
          </p>
        )}
      </section>

      {/* 方式 × 装置の総コスト。内訳の色で積んだ棒を同じ目盛りで並べる。行を押すとその組み合わせを選ぶ。 */}
      <section aria-label={`方式と装置ごとの総コスト（円/${unit}）`}>
        <div className="grid grid-cols-[88px_minmax(0,1fr)_84px] items-end gap-x-1.5 pb-0.5 text-[10px] text-[#6e6e73] sm:grid-cols-[88px_minmax(0,1fr)_84px_70px]">
          <h4 className="col-span-2 text-[11px] font-semibold text-[#3c3c43]">
            総コスト（円/{unit}）{computed.strain ? `・${STRAIN_LABEL[computed.strain]}` : ""}
            {app && <span className="font-normal text-[#6e6e73]">・棒は{APPLICATION_LABEL[app]}の内訳</span>}
          </h4>
          <span className="text-right font-medium">{app ? APPLICATION_LABEL[app] : "総コスト"}</span>
          {otherApp && <span className="hidden text-right font-medium sm:block">{APPLICATION_LABEL[otherApp]}</span>}
        </div>
        <ul className="flex flex-col">
          {rows.map(({ slot, s }, i) => {
            const sb = findScenario(baseline, app, slot.location, slot.method, slot.tankMode);
            const st = costStatus(s, hasMargin);
            const active = slot.location === selection.location && slot.method === selection.method;
            const o = otherApp ? findScenario(computed, otherApp, slot.location, slot.method, slot.tankMode) : undefined;
            const ost = o ? costStatus(o, hasMargin) : null;
            const groupStart = i === 0 || rows[i - 1].slot.location !== slot.location;
            return (
              <li key={`${slot.location}-${slot.method}`}>
                {groupStart && (
                  <p className={`text-[10px] font-semibold text-[#6e6e73] ${i === 0 ? "" : "mt-1 border-t border-[#e5e5e7] pt-1"}`}>
                    {LOCATION_SHORT_LABEL[slot.location]}
                    <span className="font-normal">（{slot.location === "offsite" ? "SX工場まで運んで処理・槽はSX工場に新設" : computed.onsiteTankBearer === "customer" ? "顧客工場で処理・槽は顧客の設備" : `顧客工場で処理・槽は${slot.tankMode}`}）</span>
                  </p>
                )}
                <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-1.5 sm:grid-cols-[minmax(0,1fr)_70px]">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectScenario(app, slot.location, slot.method)}
                    title={breakdownTitle(s, unit, s.totalPerUnit > scaleMax)}
                    className={`grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 rounded-md border px-1 py-1 text-left sm:grid-cols-[88px_minmax(0,1fr)_84px] sm:py-0 xl:min-h-[24px] ${
                      active ? "border-[#027fdc] bg-[#e8f3fc]" : "border-transparent hover:border-[#d2d2d7]"
                    }`}
                  >
                    <span className="truncate text-[11px] text-[#3c3c43]">{METHOD_LABEL[slot.method]}</span>
                    <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                      <StackedBar scenario={s} scaleMax={scaleMax} price={price} target={targetTotal} />
                    </span>
                    <span className="flex items-baseline justify-end gap-x-1 tabular-nums">
                      {sb && <Delta value={s.totalPerUnit - sb.totalPerUnit} digits={0} className="text-[9px]" />}
                      <span className="text-[12px] font-semibold text-[#1d1d1f]">{num(s.totalPerUnit)}</span>
                      <span className={`w-[24px] whitespace-nowrap text-left text-[9px] font-semibold ${st.cls}`} title={statusHint(hasMargin, targetTotal)}>{st.label}</span>
                    </span>
                  </button>
                  {o && ost && otherApp && (
                    <button
                      type="button"
                      onClick={() => onSelectScenario(otherApp, slot.location, slot.method)}
                      title={`${APPLICATION_LABEL[otherApp]}に切り替える`}
                      className="hidden min-h-[26px] items-baseline justify-end gap-x-1 rounded-md border border-transparent px-1 tabular-nums hover:border-[#d2d2d7] sm:flex"
                    >
                      <span className="text-[11px] text-[#3c3c43]">{num(o.totalPerUnit)}</span>
                      <span className={`w-[24px] whitespace-nowrap text-left text-[9px] font-semibold ${ost.cls}`}>{ost.label}</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-4 text-[#6e6e73]">
          {BREAKDOWN_ORDER.map((key) => (
            <span key={key} className="inline-flex items-center gap-1">
              <Swatch color={CATEGORY_COLOR[key]} />
              {CATEGORY_SHORT_LABEL[key]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-2.5 border-l border-dashed border-[#3c3c43]" />売価 {num(price, 0)}
          </span>
          {targetTotal !== null && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="inline-block h-2.5 border-l border-dotted border-[#86868b]" />目標 {num(targetTotal, 0)}
            </span>
          )}
        </div>
      </section>

      {/* 選んだ方式の総コストと内訳 */}
      {current && (
        <section aria-label="選んだ方式の内訳" className="rounded-lg border border-[#e5e5e7] bg-[#fafafa] px-2.5 py-2">
          <p className="flex items-baseline justify-between gap-2 text-[11px] font-semibold text-[#3c3c43]">
            <span className="min-w-0 truncate">{selectionLabel(selection)}</span>
            <span className="hidden shrink-0 text-[10px] font-normal text-[#6e6e73] sm:inline">内訳は押すと中身が開く</span>
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="flex items-baseline gap-1">
              <span className="text-[20px] font-semibold leading-7 text-[#1d1d1f]">{num(current.totalPerUnit)}</span>
              <span className="text-[11px] text-[#6e6e73]">円/{unit}</span>
              {currentBase && <Delta value={current.totalPerUnit - currentBase.totalPerUnit} className="text-[12px]" />}
            </span>
            <span className="text-[11px] text-[#3c3c43]">
              売価との差{" "}
              <span className={`font-semibold tabular-nums ${current.gapToAllowedPerUnit < 0 ? "text-[#be123c]" : "text-[#1d1d1f]"}`}>
                {signed(current.gapToAllowedPerUnit)}
              </span>
            </span>
            {current.gapToTargetPerUnit !== null && (
              <span className="text-[11px] text-[#3c3c43]">
                目標との差{" "}
                <span className={`font-semibold tabular-nums ${current.gapToTargetPerUnit < 0 ? "text-[#b45309]" : "text-[#1d1d1f]"}`}>
                  {signed(current.gapToTargetPerUnit)}
                </span>
              </span>
            )}
          </div>

          <ul className="mt-0.5 flex flex-col" aria-label="内訳の棒グラフ">
            {BREAKDOWN_ORDER.map((key) => {
              const slice = current.breakdown.find((x) => x.key === key);
              if (!slice || (slice.perUnit === 0 && slice.parts.length === 0)) return null;
              const base = currentBase?.breakdown.find((x) => x.key === key);
              const share = current.totalPerUnit > 0 ? slice.perUnit / current.totalPerUnit : 0;
              const open = openKey === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? null : key)}
                    title={`${BREAKDOWN_HINT[key]}\n${slice.parts.map((p) => `${p.label} ${num(p.perUnit)}`).join("\n")}`}
                    className="grid min-h-[40px] w-full grid-cols-[minmax(0,1fr)_50px_34px] items-center gap-x-1.5 gap-y-0.5 rounded py-0.5 text-left text-[11px] leading-[18px] hover:bg-[#f0f0f2] sm:grid-cols-[minmax(0,116px)_minmax(0,1fr)_50px_34px_40px] sm:py-0 xl:min-h-0"
                  >
                    <span className="flex min-w-0 items-center gap-1 text-[#3c3c43]">
                      <Swatch color={CATEGORY_COLOR[key]} />
                      <span className="truncate">{BREAKDOWN_LABEL[key]}</span>
                    </span>
                    <span className="order-last col-span-3 h-2 overflow-hidden sm:order-none sm:col-span-1" aria-hidden="true">
                      <span
                        className="block h-full rounded-r-[4px]"
                        style={{ width: `${Math.max((slice.perUnit / maxSlice) * 100, 0)}%`, backgroundColor: CATEGORY_COLOR[key] }}
                      />
                    </span>
                    <span className="text-right font-semibold tabular-nums text-[#1d1d1f]">{num(slice.perUnit)}</span>
                    <span className="text-right tabular-nums text-[#3c3c43]">{num(share * 100, 0)}%</span>
                    <span className="hidden text-right text-[9px] sm:block">{base && <Delta value={slice.perUnit - base.perUnit} />}</span>
                  </button>
                  {open && (
                    <ul className="mb-1 ml-3 border-l border-[#d2d2d7] pl-2 text-[10px] leading-4 text-[#3c3c43]">
                      <li className="text-[#6e6e73]">{BREAKDOWN_HINT[key]}</li>
                      {slice.parts.slice(0, 8).map((p) => (
                        <li key={p.label} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">{p.label}</span>
                          <span className="shrink-0 tabular-nums">{num(p.perUnit)}</span>
                        </li>
                      ))}
                      {slice.parts.length > 8 && (
                        <li className="flex justify-between gap-2 text-[#6e6e73]">
                          <span>ほか {slice.parts.length - 8}件</span>
                          <span className="tabular-nums">{num(slice.parts.slice(8).reduce((t, p) => t + p.perUnit, 0))}</span>
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <dl className="mt-1 grid grid-cols-1 gap-x-3 border-t border-[#e5e5e7] pt-1 text-[11px] leading-[18px] text-[#3c3c43] sm:grid-cols-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 sm:col-span-2">
              <dt>SXの作業工数</dt>
              <dd className="flex flex-wrap items-baseline justify-end gap-x-1 tabular-nums text-[#1d1d1f]">
                <span className="font-semibold">年 {int(flow.siteHours)}時間</span>
                <Delta value={flow.siteHours - baselineFlow.siteHours} digits={0} className="text-[10px]" />
                <span className="text-[10px] text-[#6e6e73]">（顧客1社分{flow.productionHours > 0 ? `＋製造拠点 ${int(flow.productionHours)}時間` : ""}）</span>
                <button type="button" onClick={onShowFlow} className="min-h-[36px] rounded px-1 text-[10px] font-semibold text-[#0267b2] hover:underline xl:min-h-0">
                  流れを見る
                </button>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>使い切る菌体</dt>
              <dd className="tabular-nums text-[#1d1d1f]">{num(current.biomassKgPerUnit, 3)} kg/{unit}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>うち閉鎖系の追加</dt>
              <dd className="tabular-nums text-[#1d1d1f]">{current.strainSpecificPerUnit > 0 ? num(current.strainSpecificPerUnit) : "なし"}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-2 sm:col-span-2">
              <dt>1社の年間</dt>
              <dd className="tabular-nums text-[#1d1d1f]">
                売上 {yen(current.revenueAnnual)}・総コスト {yen(current.totalAnnual)}・利益{" "}
                <span className={current.profitAnnual < 0 ? "text-[#be123c]" : ""}>{yen(current.profitAnnual)}</span>
              </dd>
            </div>
            {current.businessVolume > 0 && (
              <div className="flex flex-wrap justify-between gap-x-2 sm:col-span-2" data-testid="cost-business-annual">
                <dt>
                  事業全体の年間<span className="ml-1 text-[10px] text-[#6e6e73]">（約{int(current.customerCount)}社）</span>
                </dt>
                <dd className="tabular-nums text-[#1d1d1f]">
                  売上 {yen(current.businessRevenueAnnual)}・総コスト {yen(current.businessTotalAnnual)}・利益{" "}
                  <span className={current.businessProfitAnnual < 0 ? "text-[#be123c]" : ""}>{yen(current.businessProfitAnnual)}</span>
                </dd>
              </div>
            )}
            {((other && otherStrain?.strain) || counterpart) && (
              <div className="flex flex-wrap justify-between gap-x-2 sm:col-span-2">
                <dt>比べると</dt>
                <dd className="flex flex-wrap justify-end gap-x-2 tabular-nums text-[#1d1d1f]">
                  {other && otherStrain?.strain && (
                    <span>
                      {STRAIN_LABEL[otherStrain.strain]} {num(other.totalPerUnit)}（{signed(other.totalPerUnit - current.totalPerUnit)}）
                    </span>
                  )}
                  {counterpart && (
                    <span>
                      {LOCATION_SHORT_LABEL[counterpart.location]} {num(counterpart.totalPerUnit)}（{signed(counterpart.totalPerUnit - current.totalPerUnit)}）
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}

/** スマホ幅で上に固定する結果の要約。 */
export function CostResultsSummaryBar({
  unit,
  computed,
  baseline,
  selection,
  hasMargin,
  changeCount,
}: {
  unit: string;
  computed: CostComputation;
  baseline: CostComputation;
  selection: CostViewSelection;
  hasMargin: boolean;
  changeCount: number;
}) {
  const s = findScenario(computed, selection.application, selection.location, selection.method, selection.tankMode);
  const sb = findScenario(baseline, selection.application, selection.location, selection.method, selection.tankMode);
  if (!s) return null;
  const st = costStatus(s, hasMargin);
  return (
    <div className="border-b border-[#d2d2d7] bg-white/95 px-3 py-2 backdrop-blur" data-testid="cost-summary-bar">
      <p className="truncate text-[11px] text-[#3c3c43]">
        {selectionLabel(selection)}
        {changeCount > 0 && <span className="ml-1.5 font-semibold text-[#0267b2]">試算中 {changeCount}件</span>}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[18px] font-semibold text-[#1d1d1f]">{num(s.totalPerUnit)}</span>
        <span className="text-[11px] text-[#6e6e73]">円/{unit}</span>
        <span className={`text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
        {sb && <Delta value={s.totalPerUnit - sb.totalPerUnit} className="text-[11px]" />}
        {s.gapToTargetPerUnit !== null && (
          <span className="text-[11px] text-[#3c3c43]">目標との差 <span className="font-semibold tabular-nums">{signed(s.gapToTargetPerUnit)}</span></span>
        )}
      </p>
      <span className="mt-1 flex h-1.5 overflow-hidden rounded-r-[4px]" aria-hidden="true">
        {s.breakdown.filter((x) => x.perUnit > 0).map((x) => (
          <span key={x.key} className="h-full border-r-2 border-white last:border-r-0" style={{ flexGrow: x.perUnit, flexBasis: 0, backgroundColor: CATEGORY_COLOR[x.key] }} />
        ))}
      </span>
    </div>
  );
}
