"use client";

import {
  APPLICATION_LABEL,
  METHOD_LABEL,
  STRAIN_LABEL,
  type CostApplication,
  type CostComputation,
  type CostMethod,
  type CostScenarioResult,
  type CostStrain,
  type CostTankMode,
} from "@/lib/project-cost-model";
import { Delta, num, signed, yen } from "@/components/cockpit/CockpitCostModelParts";

// コスト試算タブの結果パネル。操作パネルの横に置き、数字を動かしたときに全体がどう変わるかを
// スクロールせずに見られるようにする (まさ 2026-09-13)。値の横の矢印は保存値からの差。

export interface CostViewSelection {
  strain: CostStrain | null;
  application: CostApplication | null;
  method: CostMethod;
  tankMode: CostTankMode;
}

const METHODS: CostMethod[] = ["循環", "投入"];
const TANKS: CostTankMode[] = ["既設", "新設"];

export function findScenario(c: CostComputation, application: CostApplication | null, method: CostMethod, tankMode: CostTankMode) {
  return c.scenarios.find((s) => s.application === application && s.method === method && s.tankMode === tankMode);
}

export function selectionLabel(sel: CostViewSelection) {
  return [sel.strain ? STRAIN_LABEL[sel.strain] : null, sel.application ? APPLICATION_LABEL[sel.application] : null, `${METHOD_LABEL[sel.method]}／${sel.tankMode}`]
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
  onSelectStrain: (strain: CostStrain) => void;
  onSelectScenario: (application: CostApplication | null, method: CostMethod, tankMode: CostTankMode) => void;
}

export function CostResultsPanel({ unit, computed, baseline, otherStrain, selection, hasMargin, targetTotal, onSelectStrain, onSelectScenario }: Props) {
  const apps: Array<CostApplication | null> = computed.applications.length > 0 ? computed.applications : [null];
  const current = findScenario(computed, selection.application, selection.method, selection.tankMode);
  const currentBase = findScenario(baseline, selection.application, selection.method, selection.tankMode);
  const other = otherStrain ? findScenario(otherStrain, selection.application, selection.method, selection.tankMode) : undefined;
  const derived = computed.derivedByApplication.find((d) => d.application === selection.application)?.derived ?? computed.derived;
  const b = computed.biomass;
  const maxSlice = current ? Math.max(...current.breakdown.map((x) => x.perUnit), 1) : 1;

  return (
    <div className="flex flex-col gap-2.5" data-testid="cost-results">
      {/* 第1段: 株ごとの菌体1kgの原価。押すと株が切り替わる。 */}
      <section aria-label="菌体1kgの原価（第1段）">
        <h4 className="text-[11px] font-semibold text-[#3c3c43]">菌体1kgの原価（第1段）</h4>
        <div className={`mt-1 grid gap-1.5 ${computed.biomassByStrain.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {computed.biomassByStrain.map((bs) => {
            const active = bs.strain === computed.strain;
            const base = baseline.biomassByStrain.find((x) => x.strain === bs.strain);
            return (
              <button
                key={bs.strain ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => bs.strain && onSelectStrain(bs.strain)}
                className={`flex min-h-[44px] flex-wrap items-baseline gap-x-1.5 rounded-lg border px-2.5 py-1 text-left transition-colors xl:min-h-0 ${
                  active ? "border-[#027fdc] bg-[#e8f3fc]" : "border-[#e5e5e7] bg-white hover:border-[#7cbceb]"
                }`}
              >
                <span className="text-[11px] font-semibold text-[#3c3c43]">{bs.strainLabel || "菌体"}</span>
                <span className="text-[16px] font-semibold tabular-nums text-[#1d1d1f]">{num(bs.perKg)}</span>
                <span className="text-[11px] text-[#6e6e73]">円/kg</span>
                {base && <Delta value={bs.perKg - base.perKg} className="text-[11px]" />}
              </button>
            );
          })}
        </div>
        <p className="mt-0.5 text-[11px] leading-5 text-[#6e6e73]">
          生産 {num(b.capacityKgYear, 0)} kg/年 × 販売率 {num(b.salesRate * 100, 0)}% ＝ 売れる量 {num(b.soldKgYear, 0)} kg/年
          {b.overridePerKg !== null && <span className="font-semibold text-[#b45309]">・上書き値 {num(b.overridePerKg)} 円/kg で計算中</span>}
        </p>
      </section>

      {/* 総コストの表。行 = 方式×槽、列 = 用途。マスを押すとそのシナリオを選ぶ。 */}
      <section aria-label={`総コスト（円/${unit}）`}>
        <h4 className="text-[11px] font-semibold text-[#3c3c43]">総コスト（円/{unit}）{computed.strain ? `・${STRAIN_LABEL[computed.strain]}` : ""}</h4>
        <table className="mt-1 w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-[10px] text-[#6e6e73]">
              <th className="py-1 pr-1 font-medium">方式／槽</th>
              {apps.map((a) => (
                <th key={a ?? "all"} className="px-1 py-1 text-right font-medium">{a ? APPLICATION_LABEL[a] : "総コスト"}</th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {METHODS.flatMap((m) =>
              TANKS.map((t) => (
                <tr key={`${m}-${t}`} className="border-t border-[#f0f0f2]">
                  <td className="whitespace-nowrap py-0.5 pr-1 text-[11px] text-[#3c3c43]">{METHOD_LABEL[m]}／{t}</td>
                  {apps.map((a) => {
                    const s = findScenario(computed, a, m, t);
                    const sb = findScenario(baseline, a, m, t);
                    if (!s) return <td key={a ?? "all"} className="px-1 text-right">—</td>;
                    const st = costStatus(s, hasMargin);
                    const active = a === selection.application && m === selection.method && t === selection.tankMode;
                    return (
                      <td key={a ?? "all"} className="px-0.5 py-px text-right">
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => onSelectScenario(a, m, t)}
                          className={`flex min-h-[44px] w-full flex-wrap items-baseline justify-end gap-x-1 rounded-md border px-1.5 py-0.5 xl:min-h-0 ${
                            active ? "border-[#027fdc] bg-[#e8f3fc]" : "border-transparent hover:border-[#d2d2d7]"
                          }`}
                        >
                          {sb && <Delta value={s.totalPerUnit - sb.totalPerUnit} className="text-[10px]" />}
                          <span className="font-semibold text-[#1d1d1f]">{num(s.totalPerUnit)}</span>
                          <span className={`w-[30px] whitespace-nowrap text-left text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="mt-0.5 text-[10px] leading-4 text-[#6e6e73]">
          売価 {num(derived.salePrice, 0)}{targetTotal !== null ? `・目標 ${num(targetTotal, 0)}` : ""} 円/{unit}。
          {hasMargin ? "上限超＝目標利益率を引いた上限を超える" : "赤字＝売価を超える"}
          {targetTotal !== null ? "／目標超＝売価以下で目標を超える／目標内＝目標以下" : ""}
        </p>
      </section>

      {/* 選んだシナリオの内訳 */}
      {current && (
        <section aria-label="選んだシナリオの内訳" className="rounded-lg border border-[#e5e5e7] bg-[#fafafa] px-2.5 py-2">
          <p className="text-[11px] font-semibold text-[#3c3c43]">{selectionLabel(selection)}</p>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="flex items-baseline gap-1">
              <span className="text-[20px] font-semibold leading-7 tabular-nums text-[#1d1d1f]">{num(current.totalPerUnit)}</span>
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
          <ul className="mt-1 flex flex-col">
            {current.breakdown.map((slice) => {
              const base = currentBase?.breakdown.find((x) => x.key === slice.key);
              if (slice.key === "tank" && current.tankMode === "既設" && slice.perUnit === 0) return null;
              return (
                <li key={slice.key} className="grid grid-cols-[minmax(0,1fr)_56px_44px_44px] items-center gap-x-1.5 text-[11px] leading-[18px]">
                  <span className="truncate text-[#3c3c43]" title={slice.label}>{slice.label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-[#e5e5e7]" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[#7cbceb]" style={{ width: `${Math.max((slice.perUnit / maxSlice) * 100, 0)}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums text-[#1d1d1f]">{num(slice.perUnit)}</span>
                  <span className="text-right text-[10px]">{base && <Delta value={slice.perUnit - base.perUnit} />}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 border-t border-[#e5e5e7] pt-1 text-[11px] leading-[18px] text-[#3c3c43]">
            <div className="flex justify-between gap-2">
              <dt>使い切る菌体</dt>
              <dd className="tabular-nums text-[#1d1d1f]">{num(current.biomassKgPerUnit, 3)} kg/{unit}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>うち閉鎖系の追加</dt>
              <dd className="tabular-nums text-[#1d1d1f]">{current.strainSpecificPerUnit > 0 ? num(current.strainSpecificPerUnit) : "なし"}</dd>
            </div>
            <div className="col-span-2 flex justify-between gap-2">
              <dt>1拠点の年間</dt>
              <dd className="tabular-nums text-[#1d1d1f]">
                売上 {yen(current.revenueAnnual)}・総コスト {yen(current.totalAnnual)}・利益{" "}
                <span className={current.profitAnnual < 0 ? "text-[#be123c]" : ""}>{yen(current.profitAnnual)}</span>
              </dd>
            </div>
            {other && otherStrain?.strain && (
              <div className="col-span-2 flex justify-between gap-2">
                <dt>同じ条件で{STRAIN_LABEL[otherStrain.strain]}にすると</dt>
                <dd className="tabular-nums text-[#1d1d1f]">
                  {num(other.totalPerUnit)} 円/{unit}（{signed(other.totalPerUnit - current.totalPerUnit)}）
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
  const s = findScenario(computed, selection.application, selection.method, selection.tankMode);
  const sb = findScenario(baseline, selection.application, selection.method, selection.tankMode);
  if (!s) return null;
  const st = costStatus(s, hasMargin);
  return (
    <div className="border-b border-[#d2d2d7] bg-white/95 px-3 py-2 backdrop-blur" data-testid="cost-summary-bar">
      <p className="truncate text-[11px] text-[#3c3c43]">
        {selectionLabel(selection)}
        {changeCount > 0 && <span className="ml-1.5 font-semibold text-[#0267b2]">試算中 {changeCount}件</span>}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[18px] font-semibold tabular-nums text-[#1d1d1f]">{num(s.totalPerUnit)}</span>
        <span className="text-[11px] text-[#6e6e73]">円/{unit}</span>
        <span className={`text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
        {sb && <Delta value={s.totalPerUnit - sb.totalPerUnit} className="text-[11px]" />}
        {s.gapToTargetPerUnit !== null && (
          <span className="text-[11px] text-[#3c3c43]">目標との差 <span className="font-semibold tabular-nums">{signed(s.gapToTargetPerUnit)}</span></span>
        )}
      </p>
    </div>
  );
}
