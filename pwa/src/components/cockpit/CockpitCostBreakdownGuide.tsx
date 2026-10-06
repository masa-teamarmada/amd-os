"use client";

import { Swatch, num, pct } from "@/components/cockpit/CockpitCostModelParts";

// コスト試算（廃液）とコスト試算（燃料）の操作パネルの一番上に置く「総コストの内訳と、動かす場所」。
// まさ 2026-09-14「右カラムに出てるこのサマリの内訳が、左カラムの一番上に出るようにしてほしい。
// この棒グラフで一番大きく占めているところを減らしていかないといけないんだけど、その部分が左カラムのどこにあるのかが、
// 現状だとめちゃくちゃ分かりにくいので」。
//
// 区分を大きい順に並べ、区分の中身 (計算エンジンの breakdown の parts) を操作パネルの小分け (groupKey) ごとに足して、
// 小分けの名前と額を押せる札で出す。押すと操作パネルがその小分けへ移る。
// 金額の行ではないが区分の額を比例して動かす前提 (1単位に要る菌体の量など) は、呼び出し側が drivers で足す。

export interface BreakdownGuidePart {
  label: string;
  amount: number;
  /** 操作パネルの小分けの key。 */
  groupKey: string | null;
}

export interface BreakdownGuideSlice {
  key: string;
  label: string;
  color: string;
  amount: number;
  parts: BreakdownGuidePart[];
}

export interface BreakdownGuideDriver {
  groupKey: string;
  label: string;
}

interface Props {
  slices: BreakdownGuideSlice[];
  /** 1単位の呼び名 (L・m³)。 */
  unit: string;
  scenarioLabel: string;
  groupTitle: (groupKey: string) => string | undefined;
  /** 区分の額を比例して動かす前提の小分け (区分の key → 小分け)。 */
  drivers?: Partial<Record<string, BreakdownGuideDriver[]>>;
  onJump: (groupKey: string) => void;
  /** 目次から移るときの移り先。 */
  id: string;
  testId: string;
  /** 額の書き方。既定は小数1桁（円/m³・円/L の小さい額）。1台あたりのような大きい額は整数で渡す。 */
  formatAmount?: (v: number) => string;
}

const CHIP =
  "min-h-[32px] rounded-full border border-[#d2d2d7] bg-white px-2 text-left text-[11px] font-medium text-[#1d1d1f] hover:border-[#7cbceb] hover:text-[#0267b2] lg:min-h-[22px]";
const CHIP_DRIVER =
  "min-h-[32px] rounded-full border border-dashed border-[#d2d2d7] bg-[#fafafa] px-2 text-left text-[11px] font-medium text-[#3c3c43] hover:border-[#7cbceb] hover:text-[#0267b2] lg:min-h-[22px]";

/** 区分の中身を小分けごとに足し、大きい順に並べる。 */
export function breakdownGroupsOf(parts: BreakdownGuidePart[]): Array<{ groupKey: string; amount: number }> {
  const m = new Map<string, number>();
  for (const p of parts) if (p.groupKey) m.set(p.groupKey, (m.get(p.groupKey) ?? 0) + p.amount);
  return [...m.entries()]
    .map(([groupKey, amount]) => ({ groupKey, amount }))
    .filter((g) => Math.abs(g.amount) > 1e-9)
    .sort((a, b) => b.amount - a.amount);
}

export function CostBreakdownGuide({ slices, unit, scenarioLabel, groupTitle, drivers, onJump, id, testId, formatAmount = (v) => num(v) }: Props) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  const shown = slices.filter((x) => Math.abs(x.amount) > 1e-9).sort((a, b) => b.amount - a.amount);
  const barSlices = slices.filter((x) => x.amount > 0);
  const barTotal = barSlices.reduce((s, x) => s + x.amount, 0);
  return (
    <section id={id} aria-label="総コストの内訳と、動かす場所" data-testid={testId} className="scroll-mt-12 rounded-lg border border-[#e5e5e7] px-2 py-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h4 className="text-[13px] font-semibold text-[#1d1d1f]">総コストの内訳（大きい順）</h4>
        <span className="text-[11px] text-[#3c3c43]">
          {scenarioLabel}・<span className="font-semibold tabular-nums">{formatAmount(total)} 円/{unit}</span>
        </span>
      </div>
      <p className="text-[10px] leading-4 text-[#6e6e73]">区分の下の札を押すと、その額を動かす前提と明細へ移る。札の数字は、その小分けの行が乗せている1{unit}あたりの額</p>
      {barTotal > 0 && (
        <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-[#f0f0f2]" aria-hidden="true">
          {barSlices.map((x) => (
            <span key={x.key} className="h-full" style={{ width: `${(x.amount / barTotal) * 100}%`, backgroundColor: x.color }} />
          ))}
        </div>
      )}
      <ol className="mt-1 flex flex-col divide-y divide-[#f0f0f2]">
        {shown.map((x) => {
          const groups = breakdownGroupsOf(x.parts);
          const extra = (drivers?.[x.key] ?? []).filter((d) => !groups.some((g) => g.groupKey === d.groupKey));
          return (
            <li key={x.key} className="py-1 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-center lg:gap-x-2 lg:py-0.5" data-breakdown-key={x.key}>
              {/* 狭い幅では額と割合を次の行の右へ送る（区分名を1文字ずつ折り返さない） */}
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Swatch color={x.color} className="translate-y-[1px]" />
                <span className="min-w-[6em] flex-1 text-[12px] font-semibold text-[#1d1d1f]">{x.label}</span>
                <span className="ml-auto flex shrink-0 items-baseline gap-2">
                  <span className="text-[12px] font-semibold tabular-nums text-[#1d1d1f]">
                    {formatAmount(x.amount)} 円/{unit}
                  </span>
                  <span className="w-9 text-right text-[11px] tabular-nums text-[#6e6e73]">{total > 0 ? pct(x.amount / total) : "—"}</span>
                </span>
              </div>
              {(groups.length > 0 || extra.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-1 pl-[16px] lg:mt-0 lg:gap-0.5 lg:pl-0" aria-label={`${x.label}を動かす場所`}>
                  {groups.map((g) => (
                    <button key={g.groupKey} type="button" onClick={() => onJump(g.groupKey)} className={CHIP}>
                      {groupTitle(g.groupKey) ?? g.groupKey}
                      <span className="ml-1 tabular-nums text-[#6e6e73]">{formatAmount(g.amount)}</span>
                    </button>
                  ))}
                  {extra.map((d) => (
                    <button
                      key={`driver-${d.groupKey}`}
                      type="button"
                      onClick={() => onJump(d.groupKey)}
                      className={CHIP_DRIVER}
                      title="金額の行ではないが、ここの前提を動かすと、この区分の額が比例して動く"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** 押した小分けへ移ったあと、その小分けを一瞬だけ光らせて、どこに着いたかを見せる。 */
export function flashElement(id: string): void {
  const el = document.getElementById(id);
  if (!el || typeof el.animate !== "function") return;
  el.animate([{ backgroundColor: "rgba(2, 127, 220, 0.14)" }, { backgroundColor: "rgba(2, 127, 220, 0)" }], { duration: 1800, easing: "ease-out" });
}
