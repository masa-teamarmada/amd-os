"use client";
import type { CostModelBundle } from "@/lib/project-cost-model";
import { fuelSecretionAssumptionOf, type FuelScenarioResult } from "@/lib/project-fuel-cost-model";
import { fuelSmallScaleCases } from "@/lib/project-fuel-small-scale";
import { NumberField, num, yen } from "./CockpitCostModelParts";
import type { FuelChangeHandler } from "./CockpitFuelCostModelControls";

export function FuelSmallScale({ working, current, onChange }: { working: CostModelBundle; current: FuelScenarioResult; onChange: FuelChangeHandler }) {
  const plan = fuelSmallScaleCases(working, current, current.scale.effluentSupply);
  if (!plan) return null;
  const speed = fuelSecretionAssumptionOf(working.assumptions, "secretion_rate", current.yieldCase);
  const recovery = fuelSecretionAssumptionOf(working.assumptions, "broth_recovery", current.yieldCase);
  const reference = working.assumptions.find((a) => a.roleKey === "fuel_small_reference_l");
  return <section className="max-w-[900px] bg-white px-1 py-1" data-testid="fuel-small-scale-comparison" aria-label="小規模の採算条件">
    <h3 className="text-[12px] font-semibold text-[#1d1d1f]">年{num(plan.target, 0)}L目安で比較</h3>
    <p className="mt-1 text-[11px] leading-4 text-[#3c3c43]">{current.scale.physical.enabled ? "物理回収" : "溶媒回収"}・収率{current.yieldCase === "base" ? "基準" : current.yieldCase === "low" ? "低位" : "改善"}。菌体の対象割合を変えて年産を算出し、各行の設備・分析費を積み上げる。</p>
    <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2">
      {[{ a: speed, label: "分泌速度（人工照明基準）", unit: "g/L/日", max: undefined }, { a: recovery, label: "培養液からの回収率", unit: "%", max: 100 }, { a: reference, label: "比較する年産目安", unit: "L/年", max: undefined }].map(({ a, label, unit, max }) => a && <label key={a.costAssumptionId} className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-[#3c3c43]">
        <span>{label}</span><NumberField ariaLabel={`小規模比較の${label}`} value={a.value} baseline={a.value} onChange={(value) => onChange("assumption", a.costAssumptionId, "value", value)} min={0} max={max} widthClass="w-28 lg:w-24" /><span>{unit}</span>
      </label>)}
    </div>
    {plan.requiredBiomass !== null ? <p className="mt-1 text-[11px] leading-4 text-[#3c3c43]">必要な菌体 {num(plan.requiredBiomass, 0)} kg/年。排水事業の供給量に対して {num(plan.target / plan.availableLiters * 100, 1)}%。{plan.target > plan.availableLiters && <span className="font-semibold text-[#b45309]">供給可能量では年{num(plan.availableLiters, 0)}Lまで。</span>}</p> : <p className="mt-1 text-[11px] text-[#b45309]">分泌速度と回収率を入力すると、生産量と小規模の採算を計算する。</p>}
    {plan.cases.length > 0 && <div className="mt-2 overflow-x-auto">
      <table className="w-full text-[11px]" aria-label="小規模採算の比較表">
        <thead><tr className="border-b border-[#d2d2d7] text-left text-[#6e6e73]"><th className="py-1 pr-2">条件</th><th className="px-1 text-right">追加設備</th><th className="px-1 text-right">円/L</th><th className="px-1 text-right">年利益</th><th className="px-1" /></tr></thead>
        <tbody>{plan.cases.map((c) => <tr key={c.label} className="border-b border-[#f0f0f2] last:border-0">
          <th className="py-1.5 pr-2 text-left font-normal">{c.label}<span className="block text-[10px] text-[#6e6e73]">分析{num(c.qc, 0)}回/年・年産{num(c.result.scale.annualLiters, 0)}L{current.scale.physical.enabled && <>・乾燥水分{num(c.water, 1)}kg/kg-FFA</>}</span></th>
          <td className="whitespace-nowrap px-1 text-right tabular-nums">{num(c.result.capexInitial / 10000, 0)}万円</td>
          <td className="whitespace-nowrap px-1 text-right font-semibold tabular-nums">{num(c.result.totalPerLiter, 1)}</td>
          <td className={`whitespace-nowrap px-1 text-right tabular-nums ${c.result.profitAnnual >= 0 ? "text-[#217a46]" : "text-[#b45309]"}`}>{num(c.result.profitAnnual / 10000, 1)}万円</td>
          <td className="px-1"><button type="button" aria-label={`${c.label}を試算に適用`} onClick={() => {
            onChange("assumption", c.shareAssumptionId, "value", plan.share);
            onChange("task", c.qcTaskId, "countPerYear", c.qc);
            if (c.fameAssumptionId) onChange("assumption", c.fameAssumptionId, "value", c.fame);
            if (c.waterAssumptionId) onChange("assumption", c.waterAssumptionId, "value", c.water);
          }} className="min-h-11 whitespace-nowrap rounded-md border border-[#d2d2d7] px-2 font-medium text-[#0267b2] hover:bg-[#e8f3fc] focus-visible:outline-2 focus-visible:outline-[#027fdc] lg:min-h-7">適用</button></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {plan.maxExternalChecks !== null && <p className="mt-1.5 text-[11px] leading-4">{plan.maxExternalChecks < 0 ? "現在の設備・運転費では、外部定期分析費を除いても売価を超える。" : <>現在の装置・単価で黒字を保てる外部定期分析は最大<strong>{plan.maxExternalChecks}回/年</strong>。分析単価・日常検査・作業費も含めて計算。</>}</p>}
    <p className="mt-1 text-[10px] leading-4 text-[#6e6e73]">設備・回収性能・機械脱水後の乾燥水分は設計用の仮定。外部分析の項目・頻度は販売先と確認する。「適用」は画面上の試算を変更し、保存は上部の保存操作で行う。売価 {yen(current.salePrice)}/L。</p>
  </section>;
}
