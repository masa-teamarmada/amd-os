"use client";

import type { CapitalPlanPageData } from "@/lib/project-capital-plan-data";

/** 採用中の資本政策に明示された未実行の調達だけを表示する。 */
export function ProjectNextRoundOverview({ data }: { data: CapitalPlanPageData }) {
  const plans = data.plans.filter(plan => plan.status === "active");
  const yen = (value?: { value: number }) => value && Number.isFinite(value.value) ? `${value.value.toLocaleString("ja-JP")}円` : "未登録";
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="next-round-overview">
    <header className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-xl font-bold text-slate-950">次回ラウンドの概要</h2><p className="mt-2 text-sm leading-6 text-slate-600">資本政策表に登録された調達計画。金額・時期・条件は計画上の前提。</p></header>
    {!plans.length && <p className="p-5 text-sm text-slate-500">次回ラウンドの計画は未登録。</p>}
    {plans.map(plan => {
      const round = [...(plan.document_json.events ?? [])].filter(event => event.status === "planned" && ["equity_issue", "convertible_issue"].includes(event.type)).sort((a, b) => a.order - b.order)[0];
      return <div key={plan.id} className="border-b border-slate-200 p-5 last:border-b-0">
        <h3 className="text-sm font-semibold text-slate-500">{plan.name}</h3>
        {!round ? <p className="mt-3 text-sm text-slate-500">次回ラウンドは未登録。</p> : <>
          <h4 className="mt-2 text-lg font-bold text-slate-950">{round.label}</h4>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            {[['予定時期', round.date || '未登録'], ['調達予定額', yen(round.primaryRaise)], ['調達方法', round.type === 'equity_issue' ? '株式による調達' : '転換型の調達'], ['調達前の企業価値', yen(round.preMoneyValuation)], ['調達後の企業価値', yen(round.postMoneyValuation)], ['転換上限額', yen(round.conversionCap)], ['割引率', round.conversionDiscount ? `${round.conversionDiscount.value * 100}%` : '未登録']].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-900">{value}</dd></div>)}
          </dl>
          {round.note && <p className="mt-4 whitespace-pre-wrap border-t border-slate-200 pt-4 text-sm leading-6 text-slate-700">{round.note}</p>}
        </>}
      </div>;
    })}
  </section>;
}
