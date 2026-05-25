"use client";

/**
 * DashboardScoreOverview — トップダッシュボード上部の概況 3 列パネル
 *
 * 2026-05-25 #71 後段再設計 (= まさ「全体設計やり直し」確定):
 *  ProjectSignalsCard は廃止 (= 各 PJ Score / M/X/F は DashboardGrid の ProjectCard に集約済)。
 *  本 component は上部 3 列の集約パネルに専念:
 *    1. 通知センター (= 未読数 + 直近 titles)
 *    2. AMD Management Score (= total + 5 軸 + sparkline)
 *    3. 月次ルーティン残タスク (= 最大 5 件、tone color)
 *
 *  UI テイストは通常版維持 (= cyber は HUD だけ、通常 dashboard は素朴な card)。
 */
import Link from "next/link";

export type DashboardActionItem = {
  title: string;
  meta: string;
  periodLabel: string;
  projectInitials: string;
  projectId: string;
  tone: "amber" | "cyan" | "red";
};

export type DashboardManagementScoreSnapshot = {
  ym: string | null;
  total_score: number | null;
  initiative_score: number | null;
  finance_score: number | null;
  retention_score: number | null;
  pipeline_score: number | null;
  direction_score: number | null;
  confidence: number | null;
};

export type DashboardNotificationsSummary = {
  canView: boolean;
  unread: number;
  recentTitles: string[];
};

const TONE_CLASS: Record<DashboardActionItem["tone"], string> = {
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  cyan: "border-sky-300 bg-sky-50 text-sky-900",
  red: "border-rose-300 bg-rose-50 text-rose-900",
};

export function DashboardScoreOverview({
  managementScore,
  managementHistory,
  actionItems,
}: {
  managementScore: DashboardManagementScoreSnapshot | null;
  managementHistory: DashboardManagementScoreSnapshot[];
  actionItems: DashboardActionItem[];
}) {
  // 2026-05-25 #71 v3 まさ確定: 通知センター削除 (= 右マイページに含まれる)、上部 2 列に
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ManagementScoreCard score={managementScore} history={managementHistory} />
      <MonthlyActionsCard items={actionItems} />
    </div>
  );
}

function ManagementScoreCard({ score, history }: { score: DashboardManagementScoreSnapshot | null; history: DashboardManagementScoreSnapshot[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 min-h-[120px]">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">
          バイタルサイン <span className="text-[10px] font-mono text-muted-foreground ml-0.5">(VS)</span>
        </h2>
        <Link href="/management-score" className="text-[10px] text-muted-foreground hover:text-foreground hover:underline ml-auto">
          詳細 →
        </Link>
      </div>
      {!score ? (
        <p className="text-xs text-muted-foreground my-auto text-center">snapshot なし</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold tabular-nums">{formatScore(score.total_score)}</div>
            <div className="text-[10px] text-muted-foreground">{score.ym}</div>
            {typeof score.confidence === "number" && (
              <div className="text-[10px] text-muted-foreground ml-auto">conf={score.confidence.toFixed(2)}</div>
            )}
          </div>
          <SparklineWithAxes values={history.map((h) => h.total_score ?? 0)} labels={history.map((h) => h.ym ?? "")} className="h-20 w-full" />
          <div className="grid grid-cols-5 gap-1 text-[10px] mt-auto">
            <ScoreAxis label="🎯 主体" value={score.initiative_score} />
            <ScoreAxis label="💰 財務" value={score.finance_score} />
            <ScoreAxis label="🔁 継続" value={score.retention_score} />
            <ScoreAxis label="🚀 案件" value={score.pipeline_score} />
            <ScoreAxis label="🧭 方向" value={score.direction_score} />
          </div>
        </>
      )}
    </section>
  );
}

/**
 * 縦軸最適化 + 縦軸/横軸表示 + 線太め均一 (= まさ #71 後段 #1)
 * - values の min/max でレンジを最適化 (= 0 固定じゃない、変化が見える)
 * - 縦軸に min/max 数値、横軸に start/end の ym ラベル
 * - stroke-width 3 で太め、絵的に「可愛い」
 */
function SparklineWithAxes({ values, labels, className }: { values: number[]; labels: string[]; className?: string }) {
  if (!values || values.length < 2) {
    return <div className={`${className ?? ""} bg-muted/20 rounded`} />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const padding = (max - min) * 0.1 || max * 0.1 || 1;
  const yMax = max + padding;
  const yMin = Math.max(0, min - padding);
  const range = yMax - yMin || 1;

  const W = 200;
  const H = 80;
  const padLeft = 28;
  const padRight = 4;
  const padTop = 4;
  const padBottom = 14;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const pts = values.map((v, i) => {
    const x = padLeft + (i / (values.length - 1)) * innerW;
    const y = padTop + innerH - ((v - yMin) / range) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const startLabel = formatYmLabel(labels[0]);
  const endLabel = formatYmLabel(labels[labels.length - 1]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className}>
      {/* 軸線 */}
      <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + innerH} stroke="currentColor" strokeWidth="0.5" className="text-zinc-300" />
      <line x1={padLeft} y1={padTop + innerH} x2={padLeft + innerW} y2={padTop + innerH} stroke="currentColor" strokeWidth="0.5" className="text-zinc-300" />
      {/* 縦軸ラベル (= min/max) */}
      <text x={padLeft - 3} y={padTop + 4} textAnchor="end" className="fill-zinc-500" style={{ fontSize: "8px" }}>
        {Math.round(yMax)}
      </text>
      <text x={padLeft - 3} y={padTop + innerH + 1} textAnchor="end" className="fill-zinc-500" style={{ fontSize: "8px" }}>
        {Math.round(yMin)}
      </text>
      {/* 横軸ラベル (= 始端/終端 ym) */}
      <text x={padLeft} y={H - 3} textAnchor="start" className="fill-zinc-500" style={{ fontSize: "8px" }}>
        {startLabel}
      </text>
      <text x={padLeft + innerW} y={H - 3} textAnchor="end" className="fill-zinc-500" style={{ fontSize: "8px" }}>
        {endLabel}
      </text>
      {/* polyline (= vector-effect non-scaling-stroke で線太さ均一、まさ #71 v3) */}
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="text-sky-600"
      />
    </svg>
  );
}

function formatYmLabel(ym: string): string {
  if (!ym || ym.length < 6) return "";
  return `${ym.slice(0, 4)}.${ym.slice(4, 6)}`;
}

function MonthlyActionsCard({ items }: { items: DashboardActionItem[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 min-h-[120px]">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">月次ルーティン残タスク</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">{items.length} 件</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground my-auto text-center">残タスクなし ✓</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i}>
              <Link
                href={`/project/${it.projectId}/cockpit`}
                className={`flex items-center gap-2 rounded border px-2 py-1 text-[11px] hover:brightness-95 transition-all ${TONE_CLASS[it.tone]}`}
              >
                <span className="font-mono text-[9px] font-bold rounded bg-white/70 px-1 py-0.5">{it.projectInitials}</span>
                <span className="font-medium truncate">{it.title}</span>
                <span className="text-[9px] opacity-70 ml-auto whitespace-nowrap">{it.periodLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScoreAxis({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded border border-border/60 bg-background/60 px-1 py-1 text-center">
      <div className="text-[8px] text-muted-foreground leading-tight">{label}</div>
      <div className="text-[11px] font-semibold tabular-nums leading-tight">{value == null ? "—" : value.toFixed(1)}</div>
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (!values || values.length < 2) {
    return <div className={`${className ?? ""} bg-muted/20 rounded`} />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function formatScore(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString();
}
