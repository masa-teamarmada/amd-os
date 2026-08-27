"use client";

/**
 * DashboardScoreOverview — トップダッシュボード上部の概況 3 列パネル
 *
 * 2026-05-25 #71 後段再設計 (= まさ「全体設計やり直し」確定):
 *  ProjectSignalsCard は廃止 (= 各 PJ Score / M/X/F は DashboardGrid の ProjectCard に集約済)。
 *  本 component は上部 3 列の集約パネルに専念:
 *    1. 通知センター (= 未読数 + 直近 titles)
 *    2. AMD Management Score (= total + 5 軸 + sparkline)
 *    3. いまやること (= 明示された actionItems のみ)
 *
 * 2026-08-27: 1 は右マイページへ、3 は上段の「要対応」へ寄せ、本 component は 2 だけを持つ。
 *
 *  UI テイストは通常版維持 (= cyber は HUD だけ、通常 dashboard は素朴な card)。
 */
import Link from "next/link";

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

export function DashboardScoreOverview({
  managementScore,
  managementHistory,
}: {
  managementScore: DashboardManagementScoreSnapshot | null;
  managementHistory: DashboardManagementScoreSnapshot[];
}) {
  // 2026-05-25 #71 v3 まさ確定: 通知センター削除 (= 右マイページに含まれる)。
  // 2026-08-27: 併置していた「いまやること」は常に空の箱だった (呼び出し側が固定の空配列を
  // 渡しており、中身が入る経路が無い) ため撤去。期日付きの仕事は上段の「要対応」が正本。
  return <ManagementScoreCard score={managementScore} history={managementHistory} />;
}

function ManagementScoreCard({ score, history }: { score: DashboardManagementScoreSnapshot | null; history: DashboardManagementScoreSnapshot[] }) {
  return (
    <section className="relative cursor-pointer rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 min-h-[120px] transition-all hover:shadow-md hover:-translate-y-0.5">
      <Link
        href="/project/p00/cockpit"
        aria-label="AMD PJ cockpitを開く"
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <div className="relative z-20 flex items-baseline gap-2 pointer-events-none">
        <h2 className="text-sm font-semibold">
          バイタルサイン <span className="text-[10px] font-mono text-muted-foreground ml-0.5">(VS)</span>
        </h2>
        <Link href="/management-score" className="pointer-events-auto text-[10px] text-muted-foreground hover:text-foreground hover:underline ml-auto">
          詳細 →
        </Link>
      </div>
      {!score ? (
        <p className="relative z-0 text-xs text-muted-foreground my-auto text-center">今月の記録はまだありません</p>
      ) : (
        <div className="relative z-0 flex flex-1 flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold">{formatScore(score.total_score)}</div>
            <ScoreTrendIcon current={score.total_score} previous={prevScore(history, "total_score")} size="lg" />
            <div className="text-[10px] text-muted-foreground">{score.ym}</div>
            {typeof score.confidence === "number" && (
              <div className="ml-auto text-[10px] text-muted-foreground" title="この評価をどれだけ確からしいと見ているか (0〜1)">確からしさ {score.confidence.toFixed(2)}</div>
            )}
          </div>
          <SparklineWithAxes values={history.map((h) => h.total_score ?? 0)} labels={history.map((h) => h.ym ?? "")} className="h-20 w-full" />
          <div className="grid grid-cols-5 gap-1 text-[10px] mt-auto">
            <ScoreAxis label="🎯 主体" value={score.initiative_score} previous={prevScore(history, "initiative_score")} />
            <ScoreAxis label="💰 財務" value={score.finance_score} previous={prevScore(history, "finance_score")} />
            <ScoreAxis label="🔁 継続" value={score.retention_score} previous={prevScore(history, "retention_score")} />
            <ScoreAxis label="🚀 案件" value={score.pipeline_score} previous={prevScore(history, "pipeline_score")} />
            <ScoreAxis label="🧭 方向" value={score.direction_score} previous={prevScore(history, "direction_score")} />
          </div>
        </div>
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

function ScoreAxis({ label, value, previous }: { label: string; value: number | null; previous: number | null }) {
  return (
    <div className="rounded border border-border/60 bg-background/60 px-1 py-1 text-center">
      {/* 8px は実機で読めない。5軸ラベルは10px以上を下限にする。 */}
      <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
      <div className="flex items-baseline justify-center gap-0.5 leading-tight">
        <span className="text-[13px] font-semibold">{value == null ? "—" : value.toFixed(1)}</span>
        <ScoreTrendIcon current={value} previous={previous} size="sm" />
      </div>
    </div>
  );
}

/** 増減アイコン (= まさ #71 v3 fb 確定): ↗ 上昇 / ↘ 下降 / → 横ばい / null は出さない */
function ScoreTrendIcon({ current, previous, size = "sm" }: { current: number | null; previous: number | null; size?: "sm" | "lg" }) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  // 横ばい判定の閾値 = 値の 1% 未満なら → (ノイズ除外)
  const threshold = Math.max(Math.abs(current) * 0.01, 0.1);
  const sizeClass = size === "lg" ? "text-base" : "text-[10px]";
  if (delta > threshold) {
    return <span className={`${sizeClass} font-bold text-emerald-600`} title={`+${delta.toFixed(1)}`}>↗</span>;
  }
  if (delta < -threshold) {
    return <span className={`${sizeClass} font-bold text-rose-600`} title={delta.toFixed(1)}>↘</span>;
  }
  return <span className={`${sizeClass} text-zinc-400`} title="横ばい">→</span>;
}

/** managementHistory の前月値を取得 (= 末尾 -2 番目) */
function prevScore(history: DashboardManagementScoreSnapshot[], key: keyof DashboardManagementScoreSnapshot): number | null {
  if (history.length < 2) return null;
  const prev = history[history.length - 2];
  const v = prev[key];
  return typeof v === "number" ? v : null;
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
