"use client";

/**
 * 「現金と融資」03 月ごとの推移。正本は pwa/manual/6-13-cash-and-loans-spec.md。
 *
 * 上: 月ごとの入り (上向き) と出 (下向き) を区分ごとに積み上げた棒。
 * 下: 同じ月の並びで、口座の残高と「借入を差し引いた残高」の折れ線。
 * 桁の違う2つの量を1本の縦軸に載せないため、図を上下に分けて横軸だけそろえる。
 * 表は同じ数字 (cash-monthly-trend.ts の1回の計算) をそのまま並べる。
 */
import { useMemo, useState } from "react";
import type { CashAndLoansResult, CashMonthlyTrendRow } from "@/lib/finance/cash-and-loans-types";
import { amount, yen } from "./format";

type FlowKey = keyof CashMonthlyTrendRow["flows"];

// 色は dataviz の既定パレット (検証済み)。入りと出で別の積み上げにし、隣り合う色の組で検証した。
const INFLOWS: { key: FlowKey; label: string; color: string }[] = [
  { key: "income", label: "入金", color: "var(--ct-income)" },
  { key: "loan_in", label: "借入", color: "var(--ct-loan-in)" },
];
const OUTFLOWS: { key: FlowKey; label: string; color: string }[] = [
  { key: "pay_masa", label: "まさへの振込", color: "var(--ct-masa)" },
  { key: "pay_members", label: "メンバー・外注", color: "var(--ct-members)" },
  { key: "card", label: "カード", color: "var(--ct-card)" },
  { key: "tax", label: "税金・社会保険", color: "var(--ct-tax)" },
  { key: "other_out", label: "その他", color: "var(--ct-other)" },
  { key: "loan_out", label: "借入の返済", color: "var(--ct-loan-out)" },
];

const STYLE = `
.cash-trend {
  --ct-income: #2a78d6; --ct-loan-in: #e34948;
  --ct-masa: #eb6834; --ct-members: #1baf7a; --ct-card: #eda100;
  --ct-tax: #e87ba4; --ct-other: #008300; --ct-loan-out: #4a3aa7;
  --ct-surface: var(--background);
}
.dark .cash-trend {
  --ct-income: #3987e5; --ct-loan-in: #e66767;
  --ct-masa: #d95926; --ct-members: #199e70; --ct-card: #c98500;
  --ct-tax: #d55181; --ct-other: #008300; --ct-loan-out: #9085e9;
}
`;

const COL = 34; // 1か月の幅 (px)
const BAR = 20;
const LEFT = 56;
const RIGHT = 200; // 折れ線の右端に直接ラベルを置く余白
const TOP_H = 240;
const LINE_H = 170;
/** 明細の漏れとして印を付ける下限。電子マネーの残高や数万円の端数のずれは拾わない。 */
const UNEXPLAINED_MIN = 50_000;

function niceStep(span: number): number {
  const raw = span / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 5, 10].find((m) => m * pow >= raw) ?? 10;
  return unit * pow;
}

function ticks(min: number, max: number): number[] {
  const step = niceStep(Math.max(max - min, 1));
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + 1e-6; v += step) out.push(v);
  return out;
}

function man(v: number): string {
  const m = v / 10000;
  return `${Math.abs(m) >= 100 ? Math.round(m).toLocaleString("ja-JP") : m.toFixed(0)}万`;
}

function monthLabel(ym: string, index: number): string {
  const [y, m] = ym.split("-");
  return index === 0 || m === "01" ? `${y.slice(2)}/${Number(m)}` : String(Number(m));
}

export function CashTrendPanel({ data, loading }: { data: CashAndLoansResult | null; loading: boolean }) {
  const rows = useMemo(() => data?.monthlyTrend ?? [], [data]);
  const [hover, setHover] = useState<number | null>(null);

  const scale = useMemo(() => {
    const maxIn = Math.max(1, ...rows.map((r) => r.inflow));
    const maxOut = Math.max(1, ...rows.map((r) => r.outflow));
    const barTicks = ticks(-maxOut, maxIn);
    const lineVals = rows.flatMap((r) => [r.endBalance, r.netOfLoans, 0]);
    const lineTicks = ticks(Math.min(...lineVals), Math.max(...lineVals));
    return { barTicks, lineTicks };
  }, [rows]);

  if (!data) {
    return <div className="h-[520px] animate-pulse bg-muted/30" aria-busy={loading} />;
  }
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">まだ明細がない。</p>;
  }

  const width = LEFT + rows.length * COL + RIGHT;
  const plotW = rows.length * COL;
  const x = (i: number) => LEFT + i * COL + COL / 2;

  const bMin = scale.barTicks[0];
  const bMax = scale.barTicks[scale.barTicks.length - 1];
  const by = (v: number) => 8 + ((bMax - v) / (bMax - bMin)) * (TOP_H - 28);
  const lMin = scale.lineTicks[0];
  const lMax = scale.lineTicks[scale.lineTicks.length - 1];
  const ly = (v: number) => 10 + ((lMax - v) / (lMax - lMin)) * (LINE_H - 30);

  const last = rows[rows.length - 1];
  const hovered = hover == null ? null : rows[hover];
  const showUnexplained = rows.some((r) => Math.abs(r.unexplained) >= UNEXPLAINED_MIN);

  const linePath = (pick: (r: CashMonthlyTrendRow) => number) =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(i)},${ly(pick(r))}`).join(" ");

  const stack = (row: CashMonthlyTrendRow, i: number, series: typeof INFLOWS, sign: 1 | -1) => {
    let acc = 0;
    const visible = series.filter((s) => row.flows[s.key] > 0);
    return visible.map((s, j) => {
      const v = row.flows[s.key];
      const y0 = by(sign * acc);
      acc += v;
      const y1 = by(sign * acc);
      const top = Math.min(y0, y1);
      // 積み上げの区切りに 2px の隙間を空ける (同じ面の色で塗り分けを読ませる)。
      const gap = j > 0 ? 1 : 0;
      const h = Math.max(0, Math.abs(y1 - y0) - gap * 2);
      const outer = j === visible.length - 1;
      return (
        <rect
          key={s.key}
          x={x(i) - BAR / 2}
          y={sign === 1 ? top + (outer ? 0 : gap) : top + gap}
          width={BAR}
          height={h}
          rx={outer ? 3 : 0}
          fill={s.color}
        />
      );
    });
  };

  return (
    <div className="cash-trend space-y-3">
      <style>{STYLE}</style>
      <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
        月ごとに、会社の外とのあいだで入ったお金と出たお金を区分ごとに積み上げ、下に月末の残高を並べる。
        自社の口座どうしの移動 (PayPay銀行→商工中金など) は数えない。月末の残高は freee が銀行から取った残高で、
        商工中金だけは明細から積み上げる。今月は今日まで。
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">入り</span>
        {INFLOWS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-2 font-medium text-foreground">出</span>
        {OUTFLOWS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative overflow-x-auto" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={TOP_H + LINE_H + 8} role="img" aria-label="月ごとの入りと出、月末残高の推移" className="block">
          {/* ── 上: 入りと出の積み上げ棒 ── */}
          {scale.barTicks.map((t) => (
            <g key={`b${t}`}>
              <line x1={LEFT} x2={LEFT + plotW} y1={by(t)} y2={by(t)}
                className={t === 0 ? "stroke-foreground/60" : "stroke-border"} strokeWidth={t === 0 ? 1 : 0.5} />
              <text x={LEFT - 6} y={by(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                {man(t)}
              </text>
            </g>
          ))}
          {hover != null ? (
            <rect x={LEFT + hover * COL} y={0} width={COL} height={TOP_H + LINE_H} className="fill-muted/60" />
          ) : null}
          {rows.map((r, i) => (
            <g key={r.ym} opacity={r.partial ? 0.55 : 1}>
              {stack(r, i, INFLOWS, 1)}
              {stack(r, i, OUTFLOWS, -1)}
            </g>
          ))}
          {rows.map((r, i) => (
            <text key={`m${r.ym}`} x={x(i)} y={TOP_H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
              {monthLabel(r.ym, i)}
            </text>
          ))}

          {/* ── 下: 残高の折れ線 ── */}
          <g transform={`translate(0, ${TOP_H})`}>
            {scale.lineTicks.map((t) => (
              <g key={`l${t}`}>
                <line x1={LEFT} x2={LEFT + plotW} y1={ly(t)} y2={ly(t)}
                  className={t === 0 ? "stroke-foreground/60" : "stroke-border"} strokeWidth={t === 0 ? 1 : 0.5} />
                <text x={LEFT - 6} y={ly(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                  {man(t)}
                </text>
              </g>
            ))}
            <path d={linePath((r) => r.endBalance)} fill="none" className="stroke-muted-foreground" strokeWidth={2} strokeDasharray="4 3" />
            <path d={linePath((r) => r.netOfLoans)} fill="none" style={{ stroke: "var(--ct-income)" }} strokeWidth={2} />
            {rows.map((r, i) => (
              <g key={`p${r.ym}`}>
                <circle cx={x(i)} cy={ly(r.netOfLoans)} r={hover === i ? 4.5 : 3} style={{ fill: "var(--ct-income)" }}
                  className="stroke-background" strokeWidth={2} />
              </g>
            ))}
            <text x={x(rows.length - 1) + 8} y={ly(last.endBalance)} dy="0.32em" className="fill-muted-foreground text-[11px]">
              口座の残高 {man(last.endBalance)}
            </text>
            <text x={x(rows.length - 1) + 8} y={ly(last.netOfLoans)} dy="0.32em" className="fill-foreground text-[11px] font-semibold">
              借入を差し引くと {man(last.netOfLoans)}
            </text>
          </g>

          {/* ホバーの当たり判定は棒より広く、月の列全体にする */}
          {rows.map((r, i) => (
            <rect key={`h${r.ym}`} x={LEFT + i * COL} y={0} width={COL} height={TOP_H + LINE_H}
              fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>

        {hovered && hover != null ? (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 border border-border bg-background p-2 text-[11px] shadow-md"
            style={{ left: Math.min(x(hover) + COL / 2 + 6, width - 230) }}
          >
            <div className="mb-1 font-semibold text-foreground">
              {hovered.ym.replace("-", "年")}月{hovered.partial ? "（今日まで）" : ""}
            </div>
            <table className="w-full tabular-nums">
              <tbody>
                {[...INFLOWS, ...OUTFLOWS].filter((s) => hovered.flows[s.key] > 0).map((s) => (
                  <tr key={s.key}>
                    <td className="py-px">
                      <span className="mr-1 inline-block h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
                      {s.label}
                    </td>
                    <td className="text-right font-mono">{INFLOWS.includes(s) ? "" : "−"}{amount(hovered.flows[s.key])}</td>
                  </tr>
                ))}
                <tr className="border-t border-border"><td className="pt-0.5">月末の残高</td><td className="text-right font-mono">{amount(hovered.endBalance) || "0"}</td></tr>
                <tr><td>借入の残高</td><td className="text-right font-mono">{amount(hovered.loanOutstanding) || "0"}</td></tr>
                <tr className="font-semibold text-foreground"><td>差し引き</td><td className="text-right font-mono">{amount(hovered.netOfLoans) || "0"}</td></tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-max border-collapse text-[11px] tabular-nums">
          <thead>
            <tr className="text-muted-foreground">
              <th className="sticky left-0 bg-background px-2 py-1 text-left font-medium">月</th>
              {INFLOWS.map((s) => <th key={s.key} className="px-2 py-1 text-right font-medium">{s.label}</th>)}
              {OUTFLOWS.map((s) => <th key={s.key} className="px-2 py-1 text-right font-medium">{s.label}</th>)}
              <th className="px-2 py-1 text-right font-medium">入り − 出</th>
              <th className="px-2 py-1 text-right font-medium">月末の残高</th>
              <th className="px-2 py-1 text-right font-medium">借入の残高</th>
              <th className="px-2 py-1 text-right font-medium text-foreground">差し引き</th>
              {showUnexplained ? (
                <th className="px-2 py-1 text-right font-medium" title="残高の増減と、明細の入り − 出の差。明細に書かれていない出入りがある">
                  明細の漏れ
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const net = r.inflow - r.outflow;
              const leak = Math.abs(r.unexplained) >= UNEXPLAINED_MIN;
              return (
                <tr key={r.ym} className={i === hover ? "bg-muted/60" : "border-t border-border/60"}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <td className="sticky left-0 bg-background px-2 py-0.5 text-left">
                    {r.ym.replace("-", "/")}{r.partial ? <span className="ml-1 text-muted-foreground">今日まで</span> : null}
                  </td>
                  {[...INFLOWS, ...OUTFLOWS].map((s) => (
                    <td key={s.key} className="px-2 py-0.5 text-right font-mono">{amount(r.flows[s.key])}</td>
                  ))}
                  <td className={`px-2 py-0.5 text-right font-mono ${net < 0 ? "text-destructive" : ""}`}>{yen(net)}</td>
                  <td className="px-2 py-0.5 text-right font-mono">{yen(r.endBalance)}</td>
                  <td className="px-2 py-0.5 text-right font-mono">{r.loanOutstanding ? yen(r.loanOutstanding) : ""}</td>
                  <td className={`px-2 py-0.5 text-right font-mono font-semibold ${r.netOfLoans < 0 ? "text-destructive" : "text-foreground"}`}>
                    {yen(r.netOfLoans)}
                  </td>
                  {showUnexplained ? (
                    <td className={`px-2 py-0.5 text-right font-mono ${leak ? "bg-amber-100/70 dark:bg-amber-900/40" : ""}`}>
                      {leak ? yen(r.unexplained) : ""}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {showUnexplained ? (
          <p className="mt-1 max-w-4xl text-[11px] leading-relaxed text-muted-foreground">
            「明細の漏れ」は、銀行の残高の増減と、明細の入り − 出が合わない額。きよのスプレッドシートに書かれていない
            出入りがその月にある。マイナスなら、書かれていない出金がある。
          </p>
        ) : null}
      </div>
    </div>
  );
}
