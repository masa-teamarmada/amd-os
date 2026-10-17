"use client";

import type { CostModelBundle } from "@/lib/project-cost-model";
import { fuelAssumptionOf, type FuelScenarioResult } from "@/lib/project-fuel-cost-model";
import { FUEL_OPERATING_CHOICES, fuelOperatingOf } from "@/lib/project-fuel-operating";
import { FUEL_SUPPLY_CHOICES } from "@/lib/project-fuel-supply-quality";
import { Segmented, num, yen } from "./CockpitCostModelParts";
import type { FuelChangeHandler } from "./CockpitFuelCostModelControls";

// 目的: 年産から必要物量と追加費を比較する。既存の灰色/青、境界線、書体、4px間隔を継承。
export function FuelOperatingSwitches({ working, onChange, onOpenEffluent }: { working: CostModelBundle; onChange: FuelChangeHandler; onOpenEffluent?: () => void }) {
  const secretion = fuelAssumptionOf(working.assumptions, "lipid_secreting_strain");
  const operating = fuelOperatingOf(working.assumptions);
  return <>
    {operating.inventory && <div className="text-[11px] leading-5 text-[#3c3c43] sm:col-span-2 lg:basis-full" data-testid="fuel-shared-culture-boundary">培養条件は排水側を参照。光源：{operating.sunlight ? "太陽光主体" : "人工照明"}。培養設備・照明・CO₂・培地・通常作業の燃料負担はすべて0円。</div>}
    {operating.carbon.enabled && !operating.inventory && (() => {
      const a = fuelAssumptionOf(working.assumptions, "fuel_carbon_source")!;
      return <div className="flex min-w-0 items-center gap-1.5" data-testid="fuel-carbon-switch">
        <span className="w-[4.5rem] shrink-0 text-[11px] font-semibold text-[#3c3c43] lg:w-auto">炭素源</span>
        <Segmented ariaLabel="炭素源の切り替え" options={FUEL_SUPPLY_CHOICES.fuel_carbon_source} value={a.valueText ?? "flue_gas"} onChange={(value) => onChange("assumption", a.costAssumptionId, "valueText", value)} />
      </div>;
    })()}
    {(["fuel_light_source", "fuel_culture_source", "inventory_sizing"] as const).map((role) => {
      const a = fuelAssumptionOf(working.assumptions, role);
      if (!a || (role === "fuel_light_source" && operating.inventory) || (role === "inventory_sizing" && fuelAssumptionOf(working.assumptions, "fuel_culture_source")?.valueText !== "inventory")) return null;
      return <div key={role} className="flex min-w-0 items-center gap-1.5" data-testid={role}>
        <span className="w-[4.5rem] shrink-0 text-[11px] font-semibold text-[#3c3c43] lg:w-auto">{role === "fuel_light_source" ? "光源" : role === "inventory_sizing" ? "生産量" : "培養"}</span>
        <div className="min-w-0 flex-1 lg:flex-none">
          <Segmented ariaLabel={role === "fuel_light_source" ? "光源の切り替え" : role === "inventory_sizing" ? "生産量の決め方" : "培養の使い方の切り替え"}
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
      if (operating.inventoryFromEffluent) return <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2 lg:basis-full" data-testid="fuel-effluent-link">
        <span className="text-[11px] text-[#3c3c43]">排水処理の菌体使用量から年間FAME生産量を計算</span>
        {onOpenEffluent && <button type="button" onClick={onOpenEffluent} className="min-h-11 rounded-md border border-[#d2d2d7] bg-white px-3 text-[11px] font-semibold text-[#0267b2] hover:bg-[#e8f3fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#027fdc] lg:min-h-7">排水処理の条件を変更</button>}
      </div>;
      return <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:col-span-2 lg:basis-full" data-testid="fuel-small-scale-presets">
        <span className="text-[11px] font-semibold text-[#3c3c43]">年産を比較</span>
        {[100, 1000, 10000].map((liters) => <button type="button" key={liters} aria-pressed={a.value === liters}
          onClick={() => onChange("assumption", a.costAssumptionId, "value", liters)}
          className={`min-h-11 rounded-md border px-3 text-[11px] tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#027fdc] lg:min-h-7 ${a.value === liters ? "border-[#027fdc] bg-[#e8f3fc] font-semibold text-[#0267b2]" : "border-[#d2d2d7] bg-white text-[#3c3c43] hover:bg-[#f5f5f7]"}`}>{num(liters, 0)} L</button>)}
        <span className="text-[10px] text-[#6e6e73]">必要量を設計するか、手元の在庫で作れる量を比較</span>
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
      <div><dt className="text-[#6e6e73]">{op.inventoryFromEffluent ? "排水処理で使う菌体" : "年間の目標"}</dt><dd className="font-semibold tabular-nums text-[#1d1d1f]">{op.inventoryFromEffluent ? s.effluentSupply ? `${num(s.effluentSupply.annualBiomassKg, 1)} kg-乾燥/年` : "—" : `${num(s.requestedAnnualLiters, 0)} L`}</dd></div>
      <div><dt className="text-[#6e6e73]">{op.inventoryFromEffluent ? "年間に生産できるFAME" : op.inventoryTarget ? "設計する生産量" : "試算する実生産量"}</dt><dd className="text-[15px] font-semibold tabular-nums text-[#1d1d1f]">{op.inventoryFromEffluent && !s.effluentSupply ? "—" : `${num(s.annualLiters, 1)} L/年`}</dd></div>
    </dl>
    {op.inventoryFromEffluent && <div className="mt-1.5 text-[10px] leading-4 text-[#3c3c43]" data-testid="fuel-effluent-supply">
      {s.effluentSupply ? <>
        <p>排水処理の{ s.effluentSupply.application === "metal" ? "金属回収" : "色素分解" }・{s.effluentSupply.strainLabel}：オンサイト {num(s.effluentSupply.onsiteVolume, 0)} m³/年＋オフサイト {num(s.effluentSupply.offsiteVolume, 0)} m³/年。{s.effluentSupply.draft ? "排水側の保存前の試算条件を反映。" : "排水側の保存条件を参照。"}</p>
        <p className="mt-1">菌体使用量 ÷ 培養液の菌体濃度 {num(op.inventoryBiomassConcentration, 2)} kg/m³ × 出荷待ち {num(op.inventoryWaitDays, 1)} 日 × 回収対象 {num(op.inventoryRecoveryShare * 100, 0)}% × 分泌速度 × 年間生産性比率で脂肪酸量を算出し、回収・反応・精製収率を掛ける。年{num(s.cultureOperatingDays, 0)}日の均等出荷を仮置きした平均の出荷待ち培養液 {num(s.usedInventoryVolumeM3, 1)} m³で{op.inventoryExistingEquipment ? "既存設備の利用量と作業量を算定する。" : "追加設備を数える。"}</p>
      </> : <p className="font-semibold text-[#b45309]">排水処理の試算を読み込むと年間の菌体量とFAME量を計算できる。</p>}
    </div>}
    {op.inventory && <p className="mt-1 text-[11px] leading-4 text-[#3c3c43]" data-testid="fuel-culture-exclusion">シアの生産費は全額、排水側で計上。燃料側は回収・FAME化・分析・出荷の追加費用だけ。光源による原価差は生産量と回収量の差から生じる。光源と年間生産性は排水側で変更する。</p>}
    {op.inventory && !op.inventoryFromEffluent && <>
      <p className="mt-1.5 text-[11px] leading-4 text-[#1d1d1f]" data-testid="fuel-required-inventory">{op.inventoryTarget ? "年産目標に必要な出荷待ち培養液" : "年産目標に必要な出荷待ち培養液の目安"} <strong className="tabular-nums">{s.requiredInventoryVolumeM3 === null ? "算定不可" : `${num(s.requiredInventoryVolumeM3, 1)} m³`}</strong>（同時利用量）。{op.inventoryTarget ? "必要量を確保できる場合の設計試算。" : `入力した在庫 ${num(op.inventoryVolumeM3, 1)} m³で計算。`}</p>
      <p className="mt-1 text-[10px] leading-4 text-[#3c3c43]">計算する培養液 {num(s.usedInventoryVolumeM3, 1)} m³ × 年間の待ち期間 {num(s.inventoryExposureDays, 1)} 日 × 分泌速度 × {num(op.productivityFactor * 100, 0)}%。培養費の燃料負担0円。</p>
    </>}
    {op.sunlight && !op.inventory && <p className="mt-1 text-[10px] leading-4 text-[#3c3c43]">LED電力・器具を外し、年間生産性を人工照明比 {num(op.lightProductivityFactor * 100, 0)}%にする。屋外設備・敷地・夜間維持等は追加費用の入力欄で計上。</p>}
    {op.carbon.enabled && !op.inventory && <div className="mt-1.5 border-t border-[#e5e5e7] pt-1.5 text-[11px] leading-4" data-testid="fuel-carbon-summary">
      <p className="font-semibold">炭素源：{op.carbon.source === "air" ? "空気" : op.carbon.source === "flue_gas" ? "排ガス" : "購入CO₂"} <a className="ml-1 font-normal text-[#0267b2] underline" href="#fuel-g-cond-carbon">条件を変更</a></p>
      <p className="mt-1">脂肪酸1kgに固定する炭素はCO₂換算で約2.79kg（炭素分76%の仮定）。年間 {num(s.unitKgYear * 0.76 * 44 / 12, 0)} kg。{op.carbon.source !== "purchased" && "購入CO₂費0円。送気・前処理で増える費用を年額入力する。"}</p>
      {op.carbon.source === "air" && <p className="mt-1">空気での分泌生産性は排ガス供給比 {num(op.carbon.productivityFactor * 100, 0)}%を比較用に仮置き。生産量も同じ比率で変わる。</p>}
      {op.carbon.source !== "purchased" && op.carbon.gasFraction > 0 && <p className="mt-1 text-[10px] text-[#6e6e73]">設定濃度で必要な供給ガスは年 {num(s.unitKgYear * 0.76 * 44 / 12 / (1.964 * op.carbon.gasFraction), 0)} Nm³以上（CO₂を全量吸収する理論値）。実際の送気・吸収量は運転条件で測定する。</p>}
    </div>}
    {op.quality.enabled && <div className="mt-1.5 border-t border-[#e5e5e7] pt-1.5 text-[11px] leading-4" data-testid="fuel-quality-summary">
      <p className="font-semibold">品質確認：{op.quality.hybrid ? "自社の日常分析＋定期外注" : "各ロットを外注"} <a className="ml-1 font-normal text-[#0267b2] underline" href="#fuel-g-cond-quality">条件を変更</a></p>
      {op.quality.hybrid && <p className="mt-1">日常分析は1回 {num(op.quality.routineHours, 2)}人時＋消耗品{yen(op.quality.routineExpense)}。追加購入する分析機器 {op.quality.missing.includes("fuel_lab_capex") ? "未見積" : yen(op.quality.capex)}、校正・維持費 {op.quality.missing.includes("fuel_lab_annual") ? "未見積" : `${yen(op.quality.maintenanceAnnual)}/年`}。外部確認の頻度・工数・料金は作業欄で入力する。</p>}
    </div>}
    {s.solvent.enabled && <div className="mt-1.5 border-t border-[#e5e5e7] pt-1.5 text-[11px] leading-4" data-testid="fuel-solvent-summary">
      <p className="mt-1">溶媒は、薄い培養液から脂肪酸を受け取り、アルカリ水へ渡して濃縮する循環用の媒体。戻して使い、失った分だけ補給する。油層や粒子が集まるなら、すくう・こす物理回収を先に評価する。溶媒は必須ではなく、ここでは溶媒を使う方式の費用を比較。</p>
      <p className="mt-1 text-[#b45309]">分泌速度の根拠は溶媒を用いた別株の試験。溶媒なしの物理回収へ同じ分泌速度・回収率をそのまま流用できない。</p>
      <p className="font-semibold">溶媒：{s.solvent.loop ? "循環回収（設計仮説）" : "全槽で保持（比較）"} <a className="ml-1 font-normal text-[#0267b2] underline" href="#fuel-g-cond-solvent">条件を変更</a></p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
        <div><dt className="text-[#6e6e73]">必要な溶媒在庫</dt><dd>{s.solvent.valid ? `${num(s.solvent.stockM3, 2)} m³` : "—"}</dd></div>
        <div><dt className="text-[#6e6e73]">初回の溶媒調達</dt><dd>{s.solvent.valid ? yen(s.solvent.workingCapital) : "—"}</dd></div>
        {s.solvent.loop && <><div><dt className="text-[#6e6e73]">溶媒の循環量</dt><dd>{num(s.solvent.solventM3Hour, 1)} m³/時</dd></div><div><dt className="text-[#6e6e73]">培養液側の送液量</dt><dd>{num(s.solvent.waterM3Hour, 0)} m³/時</dd></div></>}
      </dl>
      {s.solvent.loop && s.solvent.itemized && <dl className="mt-1 border-t border-[#e5e5e7] pt-1" data-testid="fuel-loop-equipment-parts">{s.solvent.equipment.map((x) => <div key={x.role} className="flex justify-between gap-3 py-0.5"><dt>{x.label}</dt><dd className="shrink-0 tabular-nums">{yen(x.amount)}</dd></div>)}</dl>}
      {s.solvent.loop && <p className="mt-1">循環回収の追加装置 {yen(s.solvent.capex)}、追加保守 {yen(s.solvent.maintenanceAnnual)}/年。溶媒補給 {num(s.solvent.makeupKgYear, 0)} kg/年・送液と回収の電力 {num(s.solvent.powerKwhYear, 0)} kWh/年を物量から計算。</p>}
      <p className="mt-1">初回溶媒の資金コスト {yen(s.solvent.fundingAnnual)}/年も表示原価へ含む。開始資金の元本は年間原価と分ける。</p>
      <p className="mt-1 text-[#b45309]">最小構成は既存の培養槽・接触部・再生槽・受槽を共用できる条件付き予算。現物の保有・空き・材質・能力は未確認。表示の培養液側流量は必要な接触量で、新設ポンプの仕様ではない。不足設備は上の追加欄へ入力。濃度差・一巡時間・回収性能・菌体影響は実証前。</p>
    </div>}
    {op.inventoryExistingEquipment && <div className="mt-1.5 rounded-md border border-[#d2d2d7] bg-white px-2 py-1.5 text-[11px] leading-4 text-[#1d1d1f]" data-testid="fuel-existing-equipment">
      <p className="font-semibold">既存設備を使う追加採算</p>
      <p className="mt-1">培養・保管・回収・燃料化の設備購入費と償却、設備価格比の固定保守費は自動計上0円。追加購入する設備と追加の運転費は入力した分を加算。</p>
      <p className="mt-1">燃料設備の追加購入 {op.missing.includes("inventory_equipment_capex") ? "未見積" : yen(op.inventoryEquipmentCapex)}。初回の溶媒等の運転資金 {op.inventoryInitialWorkingCapital === null ? "未見積" : yen(op.inventoryInitialWorkingCapital)}（年間原価と別表示）。</p>
    </div>}
    <p className="mt-1 text-[10px] leading-4 text-[#6e6e73]">{op.inventoryExistingEquipment ? "既存設備の利用能力から作業量を算定。出荷・分析は1回単位。" : op.wholeLines ? "設備・出荷・分析ロットは1基・1回単位で計上。" : "量産の比例配賦で計算中。"}</p>
    {s.productionBatchesYear !== null && <p className="mt-1 text-[10px] leading-4 text-[#3c3c43]">回収・製造作業 {num(s.productionBatchesYear, 0)} 回/年。{op.inventoryExistingEquipment ? `追加設備の償却 ${num(current.capexPerLiter, 1)} 円/L。作業・薬品・消耗溶媒・電力等を追加の運転費として計上。` : `燃料化設備 ${yen(current.plantCapexInitial)}、回収等の追加設備 ${yen(current.biomass.capexInitial)}。設備費・工数は明細の仮置き値から計算。`}</p>}
    {op.wholeLines && !op.smallBatchEquipment && op.plantCapexOverride === null && <p className="mt-1 text-[11px] leading-4 font-semibold text-[#b45309]">小型設備の見積未入力。燃料化設備は従来の大規模参考値で計算中。</p>}
    {shortfall > 0.01 && <p className="mt-1 font-semibold text-[11px] leading-4 text-[#b45309]" data-testid="fuel-volume-shortfall">目標まで {num(shortfall, 1)} L不足。追加培養・出荷延期は含めない。</p>}
    {s.inventoryScheduleExceeded && <p className="mt-1 text-[10px] leading-4 text-[#b45309]">{op.inventoryFromEffluent ? "出荷待ち日数が年間の稼働日数を超えるため、稼働日数を上限にした。" : "待ち日数×年間回数が稼働日数を超えるため、稼働日数を上限にした。並行する槽は培養液量へ含める。"}</p>}
    {op.missing.length > 0 && <p className="mt-1 text-[11px] leading-4 font-semibold text-[#b45309]" data-testid="fuel-operating-missing">未入力の条件・追加費用{op.inventoryExistingEquipment ? "・開始資金" : ""} {op.missing.length}件。表示原価は入力済みの費用のみ。</p>}
    {s.annualLiters <= 0 && <p className="mt-1 text-[11px] font-semibold text-[#b45309]">生産量が0のため、1Lあたりの採算は算定できない。</p>}
  </section>;
}
