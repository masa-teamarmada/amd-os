"use client";

import { PRODUCTION_SITE_LABEL, isTransportTask, type CostFlowStep, type CostTaskFlow } from "@/lib/project-cost-model";
import { CATEGORY_COLOR, Swatch, int, num, yen } from "@/components/cockpit/CockpitCostModelParts";
import { stackOffsets } from "@/components/cockpit/CockpitCostModelResults";

// コスト試算タブの「作業の流れと工数」。選んだ株・用途・方式で発生する作業を、流れの段の順に並べ、
// 段ごとの年間工数を棒で見せる (まさ 2026-09-13「どういう流れでどういう作業をしていく必要があるのか、
// それぞれにどのくらい工数がかかってるのかが視覚的にも把握しやすいように」)。
// 棒の色は結果の内訳と同じ: 製造拠点の作業は菌体費、巡回と輸送は運ぶ、それ以外は運転・保守・管理の作業。

export const stepAnchorId = (label: string) => `cm-step-${label}`;

function hoursOf(step: CostFlowStep) {
  return step.siteHours + step.productionHours;
}

function occurrencesText(n: number) {
  return n < 10 ? num(n, n % 1 === 0 ? 0 : 2) : int(n);
}

/** 7.5 / 0.5 / 5.75 のように、要らない0を付けずに出す。 */
function hoursText(h: number) {
  return Number(h.toFixed(2)).toLocaleString("ja-JP");
}

function HoursBar({ step, maxHours }: { step: CostFlowStep; maxHours: number }) {
  const parts = [
    { key: "biomass" as const, hours: step.rows.filter((r) => r.isProduction).reduce((t, r) => t + r.amount.annualHours, 0) },
    { key: "transport" as const, hours: step.rows.filter((r) => !r.isProduction && isTransportTask(r.task)).reduce((t, r) => t + r.amount.annualHours, 0) },
    { key: "labor" as const, hours: step.rows.filter((r) => !r.isProduction && !isTransportTask(r.task)).reduce((t, r) => t + r.amount.annualHours, 0) },
  ].filter((p) => p.hours > 0);
  return (
    <span className="relative block h-2 w-full" aria-hidden="true">
      {stackOffsets(parts, (p) => p.hours).map(({ item: p, start }, i) => {
        const left = (start / maxHours) * 100;
        const width = (p.hours / maxHours) * 100;
        const last = i === parts.length - 1;
        return (
          <span
            key={p.key}
            className={`absolute inset-y-0 ${last ? "rounded-r-[4px]" : ""}`}
            style={{ left: `${left}%`, width: last ? `max(2px, ${width}%)` : `max(0px, calc(${width}% - 2px))`, backgroundColor: CATEGORY_COLOR[p.key] }}
          />
        );
      })}
    </span>
  );
}

export function CostTaskFlowOverview({
  flow,
  unit,
  scenarioLabel,
  onJumpStep,
}: {
  flow: CostTaskFlow;
  unit: string;
  /** いま選んでいる株・用途・方式の呼び名。 */
  scenarioLabel: string;
  onJumpStep: (label: string) => void;
}) {
  const maxHours = Math.max(1, ...flow.steps.map(hoursOf));
  const hasProduction = flow.steps.some((s) => s.rows.some((r) => r.isProduction));
  return (
    <div data-testid="cost-task-flow">
      <p className="text-[11px] leading-5 text-[#3c3c43]">
        <span className="text-[#6e6e73]">{scenarioLabel}</span>
        <br />
        <span className="font-semibold text-[#1d1d1f]">作業工数 年 {int(flow.siteHours)}時間（顧客1社分）</span>
        ・作業費 {num(flow.sitePerUnit)} 円/{unit}（年 {yen(flow.siteAnnual)}）
        {hasProduction && (
          <>
            ／{PRODUCTION_SITE_LABEL} 年 {int(flow.productionHours)}時間（拠点全体。菌体費に入る）
          </>
        )}
        {flow.unknownCount > 0 && <>／工数が未確認の作業 {flow.unknownCount}件は0時間で数えている</>}
      </p>
      <ol className="mt-1.5 flex flex-col" aria-label="作業の流れ">
        {flow.steps.map((step, i) => {
          const hours = hoursOf(step);
          const allUnknown = step.unknownCount === step.rows.length;
          return (
            <li key={step.label} className="relative grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 pb-2 last:pb-0">
              {i < flow.steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[10.5px] top-[22px] w-px bg-[#d2d2d7]" />}
              <span className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#7cbceb] bg-white text-[11px] font-semibold text-[#0267b2]">
                {i + 1}
              </span>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onJumpStep(step.label)}
                  title="作業リストのこの段へ移る"
                  className="grid min-h-[36px] w-full grid-cols-[minmax(0,1fr)_64px] items-center gap-x-2 rounded text-left hover:bg-[#f5f5f7] sm:grid-cols-[minmax(0,1fr)_minmax(90px,200px)_92px_72px] xl:min-h-[22px]"
                >
                  <span className="min-w-0 text-[12px] font-semibold text-[#1d1d1f] sm:truncate">{step.label}</span>
                  <span className="hidden sm:block"><HoursBar step={step} maxHours={maxHours} /></span>
                  <span className="hidden text-right text-[11px] tabular-nums text-[#1d1d1f] sm:block">
                    {allUnknown ? <span className="text-[#6e6e73]">未確認</span> : `${int(hours)}時間`}
                    {step.productionHours > 0 && step.siteHours === 0 && <span className="text-[10px] text-[#6e6e73]">（拠点）</span>}
                  </span>
                  <span className="text-right text-[11px] tabular-nums text-[#3c3c43]">{num(step.perUnit)} 円</span>
                </button>
                <span className="mt-0.5 block sm:hidden">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1"><HoursBar step={step} maxHours={maxHours} /></span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[#1d1d1f]">{allUnknown ? "未確認" : `${int(hours)}時間`}</span>
                  </span>
                </span>
                <p className="text-[10px] leading-4 text-[#6e6e73]">
                  {step.rows.map((r, j) => (
                    <span key={r.task.costTaskId}>
                      {j > 0 && "・"}
                      {r.task.label} {occurrencesText(r.amount.occurrences)}回×
                      {r.task.hoursPerOccurrence === null ? <span className="font-semibold text-[#3c3c43]">工数未確認</span> : `${hoursText(r.amount.hours)}時間`}
                      {r.task.expensePerOccurrence > 0 ? `＋${yen(r.task.expensePerOccurrence)}` : ""}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] leading-4 text-[#6e6e73]">
        <span>棒は1年分の工数（人時）。右端は円/{unit}。</span>
        <span className="inline-flex items-center gap-1"><Swatch color={CATEGORY_COLOR.biomass} />{PRODUCTION_SITE_LABEL}の作業（菌体費に入る）</span>
        <span className="inline-flex items-center gap-1"><Swatch color={CATEGORY_COLOR.transport} />運ぶ</span>
        <span className="inline-flex items-center gap-1"><Swatch color={CATEGORY_COLOR.labor} />運転・保守・管理の作業</span>
      </p>
    </div>
  );
}
