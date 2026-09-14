"use client";

import { useState } from "react";
import {
  FUEL_BREAKDOWN_HINT,
  FUEL_BREAKDOWN_LABEL,
  FUEL_BREAKDOWN_ORDER,
  FUEL_BREAKDOWN_SHORT_LABEL,
  FUEL_CONVERSIONS,
  FUEL_CONVERSION_LABEL,
  FUEL_CULTURE_LABEL,
  FUEL_PLANT_LABEL,
  FUEL_YIELD_CASES,
  FUEL_YIELD_CASE_LABEL,
  findFuelScenario,
  type FuelBreakdownKey,
  type FuelComputation,
  type FuelConversion,
  type FuelScenarioResult,
  type FuelTaskFlow,
  type FuelYieldCase,
} from "@/lib/project-fuel-cost-model";
import { CATEGORY_COLOR, Delta, Swatch, int, num, signed, yen } from "@/components/cockpit/CockpitCostModelParts";

// コスト試算（燃料）の結果パネル。操作パネルの横に置き、数字を動かしたときに全体がどう変わるかをスクロールせずに見る。
// FAME転換 × 収率 の6通りの総コストを内訳の色で積んだ棒で並べ (同じ目盛り)、選んだ組み合わせの内訳を区分ごとの棒と割合で出す。
// 値の横の矢印は保存値からの差。

/**
 * 内訳の区分の色。排水処理のコスト試算と同じ6色を同じ並びで使う
 * (隣り合う色が色覚の違いでも見分けられることを dataviz の validate_palette で検査済みの並び)。
 * 黄とピンクは白地で薄いので、色だけで区分を伝えず、必ず区分名を並べて出す。
 */
export const FUEL_CATEGORY_COLOR: Record<FuelBreakdownKey, string> = {
  biomass: CATEGORY_COLOR.biomass,
  recovery: CATEGORY_COLOR.transport,
  conversion: CATEGORY_COLOR.labor,
  residue: CATEGORY_COLOR.postProcess,
  shipping: CATEGORY_COLOR.consumables,
  capex: CATEGORY_COLOR.capex,
};

/** 総コストが売価・目標のどこにあるか。色だけで伝えず、必ず言葉を添える。 */
export function fuelCostStatus(s: FuelScenarioResult, target: number | null) {
  if (s.gapToPricePerLiter < 0) return { label: "赤字", cls: "text-[#be123c]" };
  if (target !== null && s.totalPerLiter > target) return { label: "目標超", cls: "text-[#b45309]" };
  return { label: target !== null ? "目標内" : "黒字", cls: "text-[#1d1d1f]" };
}

/** 積み上げの各段の開始位置 (それより前の段の合計)。 */
function stackOffsets<T>(items: T[], valueOf: (item: T) => number): Array<{ item: T; start: number }> {
  const out: Array<{ item: T; start: number }> = [];
  let start = 0;
  for (const item of items) {
    out.push({ item, start });
    start += valueOf(item);
  }
  return out;
}

function StackedBar({ scenario, scaleMax, price, target }: { scenario: FuelScenarioResult; scaleMax: number; price: number; target: number | null }) {
  const segments = stackOffsets(scenario.breakdown.filter((b) => b.perLiter > 0), (b) => b.perLiter);
  const clipped = scenario.totalPerLiter > scaleMax;
  return (
    <span className="relative block h-[10px] w-full" aria-hidden="true">
      <span className="absolute inset-0 overflow-hidden">
        {segments.map(({ item: b, start }, i) => {
          const left = (start / scaleMax) * 100;
          const width = (b.perLiter / scaleMax) * 100;
          const last = i === segments.length - 1;
          return (
            <span
              key={b.key}
              className={`absolute inset-y-0 ${last ? "rounded-r-[4px]" : ""}`}
              style={{ left: `${left}%`, width: last ? `${width}%` : `max(0px, calc(${width}% - 2px))`, backgroundColor: FUEL_CATEGORY_COLOR[b.key] }}
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

/** 選んだ組み合わせの呼び名。 */
export function fuelSelectionLabel(s: Pick<FuelScenarioResult, "conversion" | "yieldCase">) {
  return `FAME転換を${FUEL_CONVERSION_LABEL[s.conversion]}・収率${FUEL_YIELD_CASE_LABEL[s.yieldCase]}`;
}

/** 燃料1Lあたりの金額。千円を超える値も3桁カンマで出す。 */
const yenPerL = (v: number) => num(v);

interface Props {
  computed: FuelComputation;
  baseline: FuelComputation;
  current: FuelScenarioResult;
  flow: FuelTaskFlow;
  baselineFlow: FuelTaskFlow;
  onSelect: (conversion: FuelConversion, yieldCase: FuelYieldCase) => void;
  onShowFlow: () => void;
}

export function FuelResultsPanel({ computed, baseline, current, flow, baselineFlow, onSelect, onShowFlow }: Props) {
  const [openKey, setOpenKey] = useState<FuelBreakdownKey | null>(null);
  const target = computed.targetTotalPerLiter;
  const price = current.salePrice;
  const base = findFuelScenario(baseline, current.conversion, current.yieldCase);
  const b = current.biomass;
  const s = current.scale;

  // 低位は桁違いに大きくなりやすいので、目盛りは基準・改善の最大の1.25倍 (売価の1.3倍) で頭打ちにし、超えた棒は ≫ を付ける。
  const allMax = Math.max(0, ...computed.scenarios.map((x) => x.totalPerLiter));
  const mainMax = Math.max(0, ...computed.scenarios.filter((x) => x.yieldCase !== "low").map((x) => x.totalPerLiter));
  const scaleMax = Math.max(Math.min(allMax, Math.max(mainMax * 1.25, price * 1.3)), price * 1.1, target ?? 0, 1);
  const maxSlice = Math.max(...current.breakdown.map((x) => x.perLiter), 1);

  return (
    <div className="flex flex-col gap-1.5" data-testid="fuel-cost-results">
      {/* 第1段: 菌体1kgの原価と、年に要る菌体の量・設備の系列数 */}
      <section aria-label="菌体1kgの原価（第1段）" className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className="text-[11px] font-semibold text-[#3c3c43]">菌体1kgの原価（第1段）</h4>
        <span className="text-[14px] font-semibold tabular-nums text-[#1d1d1f]">{num(b.perKg)}</span>
        <span className="text-[10px] text-[#6e6e73]">円/kg</span>
        {base && <Delta value={b.perKg - base.biomass.perKg} className="text-[10px]" />}
        {b.overridePerKg !== null && <span className="text-[10px] font-semibold text-[#b45309]">上書き値で計算中</span>}
        <p
          className="w-full text-[10px] leading-4 text-[#6e6e73]"
          data-testid="fuel-production-scale"
          title={`年に要る菌体 ＝ 年間の燃料の量 ${int(s.annualLiters)} L × 燃料1Lに要る菌体 ${num(current.yield.kgDcwPerLiter, 2)} kg`}
        >
          {/* 数字と単位の途中で折り返さないよう、区切りごとにまとめる */}
          <span className="whitespace-nowrap">年に要る菌体 <span className="font-semibold text-[#1d1d1f]">{int(s.biomassKgYear / 1000)} t/年</span>・</span>
          <span className="whitespace-nowrap">{FUEL_CULTURE_LABEL} {int(s.cultureLines)} 系列・</span>
          <span className="whitespace-nowrap">{FUEL_PLANT_LABEL} {num(s.plantLines, 1)} 系列</span>
        </p>
      </section>

      {/* FAME転換 × 収率 の総コスト。内訳の色で積んだ棒を同じ目盛りで並べる。行を押すとその組み合わせを選ぶ。 */}
      <section aria-label="FAME転換と収率ごとの総コスト（円/L）">
        <h4 className="text-[11px] font-semibold text-[#3c3c43]">総コスト（円/L）</h4>
        <ul className="flex flex-col">
          {FUEL_CONVERSIONS.map((conversion, gi) => (
            <li key={conversion}>
              <p className={`text-[10px] font-semibold text-[#6e6e73] ${gi === 0 ? "" : "mt-0.5 border-t border-[#e5e5e7] pt-0.5"}`}>
                FAME転換を{FUEL_CONVERSION_LABEL[conversion]}
              </p>
              <ul>
                {FUEL_YIELD_CASES.map((yieldCase) => {
                  const x = findFuelScenario(computed, conversion, yieldCase);
                  if (!x) return null;
                  const xb = findFuelScenario(baseline, conversion, yieldCase);
                  const st = fuelCostStatus(x, target);
                  const active = conversion === current.conversion && yieldCase === current.yieldCase;
                  return (
                    <li key={yieldCase}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelect(conversion, yieldCase)}
                        title={[`${fuelSelectionLabel(x)} 総コスト ${num(x.totalPerLiter)} 円/L${x.totalPerLiter > scaleMax ? "（棒は目盛りの外まで伸びている）" : ""}`, ...x.breakdown.filter((p) => p.perLiter > 0).map((p) => `${p.label} ${num(p.perLiter)}`)].join("\n")}
                        className={`grid min-h-[44px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 rounded-md border px-1 py-1 text-left sm:grid-cols-[64px_minmax(0,1fr)_124px] sm:py-0 xl:min-h-[20px] ${
                          active ? "border-[#027fdc] bg-[#e8f3fc]" : "border-transparent hover:border-[#d2d2d7]"
                        }`}
                      >
                        <span className="truncate text-[11px] text-[#3c3c43]">収率{FUEL_YIELD_CASE_LABEL[yieldCase]}</span>
                        <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                          <StackedBar scenario={x} scaleMax={scaleMax} price={price} target={target} />
                        </span>
                        <span className="flex items-baseline justify-end gap-x-1 tabular-nums">
                          {xb && <Delta value={x.totalPerLiter - xb.totalPerLiter} digits={0} className="text-[9px]" />}
                          <span className="text-[12px] font-semibold text-[#1d1d1f]">{yenPerL(x.totalPerLiter)}</span>
                          <span className={`w-[24px] whitespace-nowrap text-left text-[9px] font-semibold ${st.cls}`}>{st.label}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-4 text-[#6e6e73]">
          {FUEL_BREAKDOWN_ORDER.map((key) => (
            <span key={key} className="inline-flex items-center gap-1">
              <Swatch color={FUEL_CATEGORY_COLOR[key]} />
              {FUEL_BREAKDOWN_SHORT_LABEL[key]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-2.5 border-l border-dashed border-[#3c3c43]" />売価 {num(price, 0)}
          </span>
          {target !== null && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="inline-block h-2.5 border-l border-dotted border-[#86868b]" />目標 {num(target, 0)}
            </span>
          )}
        </div>
      </section>

      {/* 選んだ組み合わせの総コストと内訳 */}
      <section aria-label="選んだ組み合わせの内訳" className="rounded-lg border border-[#e5e5e7] bg-[#fafafa] px-2.5 py-1.5">
        <p className="flex items-baseline justify-between gap-2 text-[11px] font-semibold text-[#3c3c43]">
          <span className="min-w-0 truncate">{fuelSelectionLabel(current)}</span>
          <span className="hidden shrink-0 text-[10px] font-normal text-[#6e6e73] sm:inline">内訳は押すと中身が開く</span>
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="flex items-baseline gap-1">
            <span className="text-[20px] font-semibold leading-7 tabular-nums text-[#1d1d1f]">{yenPerL(current.totalPerLiter)}</span>
            <span className="text-[11px] text-[#6e6e73]">円/L</span>
            {base && <Delta value={current.totalPerLiter - base.totalPerLiter} className="text-[12px]" />}
          </span>
          <span className="text-[11px] text-[#3c3c43]">
            売価との差{" "}
            <span className={`font-semibold tabular-nums ${current.gapToPricePerLiter < 0 ? "text-[#be123c]" : "text-[#1d1d1f]"}`}>{signed(current.gapToPricePerLiter)}</span>
          </span>
          {current.gapToTargetPerLiter !== null && (
            <span className="text-[11px] text-[#3c3c43]">
              目標との差{" "}
              <span className={`font-semibold tabular-nums ${current.gapToTargetPerLiter < 0 ? "text-[#b45309]" : "text-[#1d1d1f]"}`}>{signed(current.gapToTargetPerLiter)}</span>
            </span>
          )}
        </div>

        <ul className="mt-0.5 flex flex-col" aria-label="内訳の棒グラフ">
          {FUEL_BREAKDOWN_ORDER.map((key) => {
            const slice = current.breakdown.find((x) => x.key === key);
            if (!slice || (slice.perLiter === 0 && slice.parts.length === 0)) return null;
            const sliceBase = base?.breakdown.find((x) => x.key === key);
            const share = current.totalPerLiter > 0 ? slice.perLiter / current.totalPerLiter : 0;
            const open = openKey === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? null : key)}
                  title={`${FUEL_BREAKDOWN_HINT[key]}\n${slice.parts.map((p) => `${p.label} ${num(p.perLiter)}`).join("\n")}`}
                  className="grid min-h-[40px] w-full grid-cols-[minmax(0,1fr)_58px_34px] items-center gap-x-1.5 gap-y-0.5 rounded py-0.5 text-left text-[11px] leading-[18px] hover:bg-[#f0f0f2] sm:grid-cols-[minmax(0,116px)_minmax(0,1fr)_58px_34px_40px] sm:py-0 xl:min-h-0"
                >
                  <span className="flex min-w-0 items-center gap-1 text-[#3c3c43]">
                    <Swatch color={FUEL_CATEGORY_COLOR[key]} />
                    <span className="truncate">{FUEL_BREAKDOWN_LABEL[key]}</span>
                  </span>
                  <span className="order-last col-span-3 h-2 overflow-hidden sm:order-none sm:col-span-1" aria-hidden="true">
                    <span className="block h-full rounded-r-[4px]" style={{ width: `${Math.max((slice.perLiter / maxSlice) * 100, 0)}%`, backgroundColor: FUEL_CATEGORY_COLOR[key] }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums text-[#1d1d1f]">{num(slice.perLiter)}</span>
                  <span className="text-right tabular-nums text-[#3c3c43]">{num(share * 100, 0)}%</span>
                  <span className="hidden text-right text-[9px] sm:block">{sliceBase && <Delta value={slice.perLiter - sliceBase.perLiter} />}</span>
                </button>
                {open && (
                  <ul className="mb-1 ml-3 border-l border-[#d2d2d7] pl-2 text-[10px] leading-4 text-[#3c3c43]">
                    <li className="text-[#6e6e73]">{FUEL_BREAKDOWN_HINT[key]}</li>
                    {slice.parts.slice(0, 8).map((p) => (
                      <li key={p.label} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate">{p.label}</span>
                        <span className="shrink-0 tabular-nums">{num(p.perLiter)}</span>
                      </li>
                    ))}
                    {slice.parts.length > 8 && (
                      <li className="flex justify-between gap-2 text-[#6e6e73]">
                        <span>ほか {slice.parts.length - 8}件</span>
                        <span className="tabular-nums">{num(slice.parts.slice(8).reduce((t, p) => t + p.perLiter, 0))}</span>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {/* 結果の欄をスクロールさせないため、1行に1項目で詰める (表示域 1440×790 でも収まる高さ) */}
        <dl className="mt-0.5 flex flex-col border-t border-[#e5e5e7] pt-0.5 text-[11px] leading-[18px] text-[#3c3c43]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2" data-testid="fuel-break-even">
            <dt title="売価で損益ゼロになる菌体1kgの原価の上限。マイナスなら、菌体をタダで手に入れても燃料化の工程だけで売価を超える">売価で成立する菌体の原価</dt>
            <dd className="text-right tabular-nums text-[#1d1d1f]">
              {current.breakEvenBiomassPerKg > 0 ? (
                <>
                  <span className="font-semibold">{num(current.breakEvenBiomassPerKg)} 円/kg 以下</span>
                  {current.targetBiomassPerKg !== null && (
                    <span className="text-[10px] text-[#6e6e73]">（目標なら {current.targetBiomassPerKg > 0 ? `${num(current.targetBiomassPerKg)} 円/kg 以下` : "届かない"}）</span>
                  )}
                </>
              ) : (
                <span className="font-semibold text-[#be123c]">菌体がタダでも赤字（工程だけで {num(current.processPerLiter)} 円/L）</span>
              )}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <dt>燃料1Lに要る菌体</dt>
            <dd className="tabular-nums text-[#1d1d1f]">
              {num(current.yield.kgDcwPerLiter, 2)} kg
              <span className="text-[10px] text-[#6e6e73]">・CAPEX {num(current.capexPerLiter)} 円/L・初期投資 {yen(current.capexInitial)}</span>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <dt>作業工数（事業全体）</dt>
            <dd className="flex flex-wrap items-baseline justify-end gap-x-1 tabular-nums text-[#1d1d1f]">
              <span className="font-semibold">年 {int(flow.plantHours + flow.cultureHours)}時間</span>
              <Delta value={flow.plantHours + flow.cultureHours - (baselineFlow.plantHours + baselineFlow.cultureHours)} digits={0} className="text-[10px]" />
              {flow.unknownCount > 0 && <span className="text-[10px] text-[#6e6e73]">未確認{flow.unknownCount}件</span>}
              <button type="button" onClick={onShowFlow} className="min-h-[36px] rounded px-1 text-[10px] font-semibold text-[#0267b2] hover:underline xl:min-h-0">
                流れを見る
              </button>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2" data-testid="fuel-business-annual">
            <dt>事業全体の年間</dt>
            <dd className="tabular-nums text-[#1d1d1f]">
              {/* 金額はカンマ区切りの円で長いので、「売上 金額」の組ごとに折り返す（排水処理のコスト試算と同じ） */}
              <span className="whitespace-nowrap">売上 {yen(current.revenueAnnual)}・</span>
              <span className="whitespace-nowrap">総コスト {yen(current.totalAnnual)}・</span>
              <span className="whitespace-nowrap">
                利益 <span className={current.profitAnnual < 0 ? "text-[#be123c]" : ""}>{yen(current.profitAnnual)}</span>
              </span>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/** スマホ幅で上に固定する結果の要約。 */
export function FuelResultsSummaryBar({
  current,
  baseline,
  target,
  changeCount,
}: {
  current: FuelScenarioResult;
  baseline: FuelScenarioResult | undefined;
  target: number | null;
  changeCount: number;
}) {
  const st = fuelCostStatus(current, target);
  return (
    <div className="border-b border-[#d2d2d7] bg-white/95 px-3 py-2 backdrop-blur" data-testid="fuel-cost-summary-bar">
      <p className="truncate text-[11px] text-[#3c3c43]">
        {fuelSelectionLabel(current)}
        {changeCount > 0 && <span className="ml-1.5 font-semibold text-[#0267b2]">試算中 {changeCount}件</span>}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[18px] font-semibold tabular-nums text-[#1d1d1f]">{num(current.totalPerLiter)}</span>
        <span className="text-[11px] text-[#6e6e73]">円/L</span>
        <span className={`text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
        {baseline && <Delta value={current.totalPerLiter - baseline.totalPerLiter} className="text-[11px]" />}
        <span className="text-[11px] text-[#3c3c43]">売価 {num(current.salePrice, 0)} との差 <span className="font-semibold tabular-nums">{signed(current.gapToPricePerLiter)}</span></span>
      </p>
      <span className="mt-1 flex h-1.5 overflow-hidden rounded-r-[4px]" aria-hidden="true">
        {current.breakdown.filter((x) => x.perLiter > 0).map((x) => (
          <span key={x.key} className="h-full border-r-2 border-white last:border-r-0" style={{ flexGrow: x.perLiter, flexBasis: 0, backgroundColor: FUEL_CATEGORY_COLOR[x.key] }} />
        ))}
      </span>
    </div>
  );
}
