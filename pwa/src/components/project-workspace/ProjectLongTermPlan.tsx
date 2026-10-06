"use client";

import { BUSINESS_PLAN_FORMAT } from "@/lib/project-formats";
import { formatPlanYen, type ProjectBusinessPlan } from "@/lib/project-business-plan";

/** フェーズ計画の正本を時系列に読む。未登録の期間・活動・条件は推定しない。 */
export function ProjectLongTermPlan({ plan }: { plan: ProjectBusinessPlan | null }) {
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="project-long-term-plan">
    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
      <h2 className="text-xl font-bold text-slate-950">長期計画</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{plan?.matrixNote || "登録済みのフェーズ計画に基づく、各段階の活動と到達条件。"}</p>
    </div>
    {!plan?.phases.length ? <p className="p-5 text-sm text-slate-500">長期計画は未登録。</p> : <ol className="divide-y divide-slate-200">
      {plan.phases.map(phase => <li key={phase.id} className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-bold text-slate-950">{phase.label}</h3>
          <p className="text-sm text-slate-600">{phase.period || "期間未登録"}</p>
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">予算</dt><dd className="mt-1 font-semibold">{formatPlanYen(phase.budgetYen)}</dd></div>
          <div><dt className="text-slate-500">調達ラウンド</dt><dd className="mt-1">{phase.openingRound || "未登録"}</dd></div>
          <div><dt className="text-slate-500">調達源</dt><dd className="mt-1 break-words">{phase.fundingSource || "未登録"}</dd></div>
        </dl>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {BUSINESS_PLAN_FORMAT.lanes.map(lane => <div key={lane.key} className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-bold text-slate-800">{lane.label}</h4>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-slate-700">{phase.lanes[lane.key].activities.map((activity, index) => <li key={index}>{activity}</li>)}</ul>
            {!phase.lanes[lane.key].activities.length && <p className="mt-2 text-sm text-slate-500">活動未登録</p>}
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-700"><span className="font-semibold">到達条件：</span>{phase.lanes[lane.key].exitGate || "未登録"}</p>
          </div>)}
        </div>
      </li>)}
    </ol>}
    {plan?.sourceNote && <p className="border-t border-slate-200 px-5 py-3 text-xs leading-5 text-slate-500">出典：{plan.sourceNote}</p>}
  </section>;
}
