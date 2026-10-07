"use client";

import { biomassOf, derivedOf, resolveAssumption, type CostComputation, type CostModelBundle } from "@/lib/project-cost-model";
import { computeProcessSummary, type ProcessSelection } from "@/lib/cost-process-summary";
import { num, signed, yen } from "./CockpitCostModelParts";

/** 同じ処理量・費用範囲で、両者の原価と料金配分を比較する。 */
export function CostEconomicsSummary({ bundle, computed, selection, unit }: {
  bundle: CostModelBundle; computed: CostComputation; selection: ProcessSelection; unit: string;
}) {
  const s = computed.scenarios.find((r) => r.application === selection.application && r.location === selection.location && r.method === selection.method && r.tankMode === selection.tankMode);
  if (!s) return null;
  const d = derivedOf(computed, selection.application, selection.location);
  const b = biomassOf(computed, selection.application);
  const ledger = computeProcessSummary(bundle, computed, selection);
  if (!ledger || ledger.invalidVolume) return null;
  const budget = s.customerBudgetPerUnit;
  const additional = (s.customerResidualPerUnit ?? 0) + (s.unpricedExtraPerUnit ?? 0);
  const headroom = budget === null ? null : budget - ledger.total - additional;
  const pending = budget !== null && (s.customerResidualPerUnit === null || s.unpricedExtraPerUnit === null);
  const savings = bundle.notes.find((n) => n.title === "改善の優先順位と削減効果");
  const assets = ledger.steps.flatMap((step) => step.rows).filter((r) => r.type === "CAPEX").map((r) => {
    const item = bundle.items.find((i) => i.costItemId === r.id);
    const life = item?.usefulLifeYears ?? (r.id === "new-tank" ? resolveAssumption(bundle.assumptions, "tank_life_years")?.value : null);
    return { life: life ?? 0, initial: r.perUnit * (life ?? 0) * d.annualVolume };
  }).filter((a) => a.life > 0);
  const initial = assets.reduce((sum, a) => sum + a.initial, 0);
  const periods = [3, 5, 7, 10].map((years) => {
    const replacement = assets.reduce((sum, a) => sum + a.initial * Math.max(Math.ceil(years / a.life) - 1, 0), 0);
    return { years, cost: ledger.opex + additional + (initial + replacement) / (d.annualVolume * years) };
  });

  return (
    <section aria-label="処理量と総額採算" data-testid="cost-economics-summary" className="max-w-[1120px] border-y border-[#d2d2d7] bg-white py-2 text-[13px] leading-5 text-[#3c3c43]">
      <h3 className="mb-1 font-semibold text-[#1d1d1f]">処理量と総額採算</h3>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-[#6e6e73]">{selection.location === "onsite" ? "顧客1工場の排水処理量" : "引取処理1拠点の排水量"}</dt><dd className="font-semibold tabular-nums">{num(d.annualVolume, 0)} {unit}/年<span className="ml-2 font-normal text-[#6e6e73]">{num(d.annualVolume / Math.max(d.annualBatches, 1), 0)} {unit}/回 × {num(d.annualBatches, 0)} 回</span></dd></div>
        <div><dt className="text-[#6e6e73]">事業全体の排水処理量</dt><dd className="tabular-nums">顧客工場 {num(b.onsiteVolume, 0)}／引取処理 {num(b.offsiteVolume, 0)} {unit}/年</dd></div>
        <div><dt className="text-[#6e6e73]">供給に必要な菌体製造量</dt><dd className="font-semibold tabular-nums">{num(b.capacityKgYear, 0)} kg/年<span className="ml-2 font-normal">{num(b.productionLines, 2)} 系列</span><span className="block font-normal text-[#6e6e73]">1系列 {num(b.lineCapacityKgYear, 0)} kg/年の仮定</span></dd></div>
      </dl>
      <p className="mt-1 text-[12px] text-[#6e6e73]">排水を処理する顧客の槽と、菌体を培養・濃縮するSOL側の設備を別々に計上。製造量は乾燥菌体のkg/年。所在地・拠点数・系列の実能力は確認待ち。</p>
      {budget !== null && savings && <p className="mt-1 text-[12px]"><strong className="font-semibold">改善の効果（2026-10-08採用時）</strong> {savings.bodyMd}</p>}
      {budget !== null && <>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full max-w-[900px] border-collapse text-right tabular-nums" aria-label="総額の費用配分">
            <thead className="border-b border-[#d2d2d7] text-[12px] text-[#6e6e73]"><tr><th scope="col" className="py-1 pr-3 text-left font-medium">円/{unit}</th><th scope="col" className="px-2 font-medium">運転・作業等</th><th scope="col" className="px-2 font-medium">設備償却</th><th scope="col" className="px-2 font-medium">原価合計</th><th scope="col" className="pl-2 font-medium">総額上限からの配分</th></tr></thead>
            <tbody>
              <tr className="border-b border-[#e5e5e7]"><th scope="row" className="py-1 pr-3 text-left font-medium">SOL</th><td className="px-2">{num(s.opexTotalPerUnit)}</td><td className="px-2">{num(s.capexTotalPerUnit)}</td><td className="px-2">{num(s.totalPerUnit)}</td><td className="pl-2">料金上限 {s.feeCeilingPerUnit! < 0 ? "なし" : num(s.feeCeilingPerUnit!)}</td></tr>
              <tr className="border-b border-[#e5e5e7]"><th scope="row" className="py-1 pr-3 text-left font-medium">顧客負担</th><td className="px-2">{num(s.customerCostPerUnit - s.customerCapexPerUnit)}</td><td className="px-2">{num(s.customerCapexPerUnit)}</td><td className="px-2">{num(s.customerCostPerUnit)}</td><td className="pl-2">顧客側の支出 {num(s.customerCostPerUnit)}</td></tr>
              <tr className="font-semibold text-[#1d1d1f]"><th scope="row" className="py-1 pr-3 text-left">両者合計</th><td className="px-2">{num(ledger.opex)}</td><td className="px-2">{num(ledger.capex)}</td><td className="px-2" data-testid="cost-all-in">{num(ledger.total)}</td><td className="pl-2">提供総額 {num(budget)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1"><span className="font-semibold text-[#1d1d1f]">総額上限 {num(budget)} − 原価 {num(ledger.total)} − 入力済み追加費 {num(additional)} ＝ 残枠 <span data-testid="cost-budget-headroom" className={headroom! < 0 ? "text-[#be123c]" : ""}>{signed(headroom!)}</span> 円/{unit}</span><span>顧客総支払 {num(s.customerOutlayPerUnit)} 円/{unit}</span></p>
        <p className="text-[12px] text-[#6e6e73]">{pending ? "未見積の設備増額・顧客残存処理費は未確認。この残枠から差し引くため、確定利益ではない。" : "入力済みの残存処理費と追加費を控除した試算。"} 料金配分は上限の計算で、契約価格・月次売上には採用しない。</p>
        <details className="mt-1">
          <summary className="min-h-[44px] lg:min-h-[36px] cursor-pointer py-1 font-medium text-[#0267b2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#027fdc]">初期投資と回収期間を比較</summary>
          {b.overridePerKg !== null ? <p className="text-[12px]">菌体原価の上書き中は、供給側の設備償却と初期投資を分けられないため回収期間を比較できない。</p> : <>
            <p className="text-[12px]">この顧客の供給量に配賦した初期投資 {yen(initial)}。製造拠点をこの1社だけで立ち上げる実購入額ではない。残価ゼロ・期間内の機器更新込み、利息と未入力費は別。</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 py-1 tabular-nums">{periods.map((p) => <span key={p.years}>{p.years}年回収 <strong className={p.cost > budget ? "text-[#be123c]" : "text-[#1d1d1f]"}>{num(p.cost)}</strong> 円/{unit}</span>)}</div>
          </>}
        </details>
      </>}
    </section>
  );
}
