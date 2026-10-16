"use client";

import type { CostModelBundle } from "@/lib/project-cost-model";
import { fuelAssumptionOf, type FuelScenarioResult } from "@/lib/project-fuel-cost-model";
import { FUEL_OPERATING_CHOICES } from "@/lib/project-fuel-operating";
import { Segmented, num, yen } from "./CockpitCostModelParts";
import type { FuelChangeHandler } from "./CockpitFuelCostModelControls";

// 判断順は光源→培養の使い方→目標量。既存の灰色・青・境界線と4px単位を使う。
export function FuelOperatingSwitches({ working, onChange }: { working: CostModelBundle; onChange: FuelChangeHandler }) {
  const secretion = fuelAssumptionOf(working.assumptions, "lipid_secreting_strain");
  return <>
    {(["fuel_light_source", "fuel_culture_source"] as const).map((role) => {
      const a = fuelAssumptionOf(working.assumptions, role);
      if (!a) return null;
      return <div key={role} className="flex min-w-0 items-center gap-1.5" data-testid={role}>
        <span className="w-[4.5rem] shrink-0 text-[11px] font-semibold text-[#3c3c43] lg:w-auto">{role === "fuel_light_source" ? "光源" : "培養"}</span>
        <div className="min-w-0 flex-1 lg:flex-none">
          <Segmented ariaLabel={role === "fuel_light_source" ? "光源の切り替え" : "培養の使い方の切り替え"}
            options={FUEL_OPERATING_CHOICES[role]} value={a.valueText ?? FUEL_OPERATING_CHOICES[role][0].value}
            onChange={(value) => {
              onChange("assumption", a.costAssumptionId, "valueText", value);
              if (role === "fuel_culture_source" && value === "inventory" && secretion) onChange("assumption", secretion.costAssumptionId, "valueText", "on");
            }} />
        </div>
      </div>;
    })}
    {(() => {
      const a = fuelAssumptionOf(working.assumptions, "business_annual_volume");
      if (!a) return null;
      return <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:col-span-2 lg:basis-full" data-testid="fuel-small-scale-presets">
        <span className="text-[11px] font-semibold text-[#3c3c43]">年産を比較</span>
        {[100, 1000, 10000].map((liters) => <button type="button" key={liters} aria-pressed={a.value === liters}
          onClick={() => onChange("assumption", a.costAssumptionId, "value", liters)}
          className={`min-h-11 rounded-md border px-3 text-[11px] tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#027fdc] lg:min-h-7 ${a.value === liters ? "border-[#027fdc] bg-[#e8f3fc] font-semibold text-[#0267b2]" : "border-[#d2d2d7] bg-white text-[#3c3c43] hover:bg-[#f5f5f7]"}`}>{num(liters, 0)} L</button>)}
        <span className="text-[10px] text-[#6e6e73]">目標量。出荷待ち方式の実生産量は回収可能量が上限</span>
      </div>;
    })()}
  </>;
}

export function FuelOperatingSummary({ current }: { current: FuelScenarioResult }) {
  const s = current.scale;
  const op = s.operating;
  const shortfall = Math.max(s.requestedAnnualLiters - s.annualLiters, 0);
  return <section className="rounded-lg border border-[#e5e5e7] bg-[#fafafa] px-2.5 py-2" aria-label="生産量と費用の範囲" data-testid="fuel-operating-summary">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[#1d1d1f]">
      <span>{op.sunlight ? "太陽光主体" : "人工照明"}</span><span>／</span><span>{op.inventory ? "出荷待ちから回収" : "燃料専用で培養"}</span>
    </div>
    <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
      <div><dt className="text-[#6e6e73]">年間の目標</dt><dd className="font-semibold tabular-nums text-[#1d1d1f]">{num(s.requestedAnnualLiters, 0)} L</dd></div>
      <div><dt className="text-[#6e6e73]">試算する実生産量</dt><dd className="font-semibold tabular-nums text-[#1d1d1f]">{num(s.annualLiters, 1)} L/年</dd></div>
    </dl>
    {op.inventory && <p className="mt-1.5 text-[10px] leading-4 text-[#3c3c43]">培養液 {num(op.inventoryVolumeM3, 1)} m³ × 年間の待ち期間 {num(s.inventoryExposureDays, 1)} 日 × 分泌速度 × {num(op.productivityFactor * 100, 0)}%で計算。回収可能量 {num(s.availableAnnualLiters ?? 0, 1)} L/年。共通培養費の配賦 {yen(op.commonAllocationAnnual)}/年を追加。</p>}
    {op.sunlight && <p className="mt-1 text-[10px] leading-4 text-[#3c3c43]">LED電力・器具を外し、年間生産性を人工照明比 {num(op.productivityFactor * 100, 0)}%にする。屋外設備・敷地・夜間維持等は追加費用の入力欄で計上。</p>}
    <p className="mt-1 text-[10px] leading-4 text-[#6e6e73]">{op.wholeLines ? "設備・出荷・分析ロットは1基・1回単位。小型設備の見積に合わせて明細・能力・作業回数を変更する。" : "量産の比例配賦で計算中。小規模の実購入額を表さない。"}</p>
    {op.wholeLines && op.plantCapexOverride === null && <p className="mt-1 text-[11px] leading-4 font-semibold text-[#b45309]">小型設備の見積未入力。燃料化設備は従来の大規模参考値で計算中。設備の初期投資欄に小型の見積総額を入力する。</p>}
    {shortfall > 0.01 && <p className="mt-1 font-semibold text-[11px] leading-4 text-[#b45309]" data-testid="fuel-volume-shortfall">目標まで {num(shortfall, 1)} L不足。追加培養・出荷延期は含めない。</p>}
    {s.inventoryScheduleExceeded && <p className="mt-1 text-[10px] leading-4 text-[#b45309]">待ち日数×年間回数が稼働日数を超えるため、稼働日数を上限にした。並行する槽は培養液量へ含める。</p>}
    {op.missing.length > 0 && <p className="mt-1 text-[11px] leading-4 font-semibold text-[#b45309]" data-testid="fuel-operating-missing">未入力の条件・追加費用 {op.missing.length}件。表示原価は入力済みの費用のみ。</p>}
    {s.annualLiters <= 0 && <p className="mt-1 text-[11px] font-semibold text-[#b45309]">生産量が0のため、1Lあたりの採算は算定できない。</p>}
  </section>;
}
