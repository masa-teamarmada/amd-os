"use client";

/**
 * DashboardScoreOverview — トップダッシュボード上部の概況パネル (= 2026-05-25 #71 まさ #41 後段)
 *
 * 通常 /dashboard に HUD /hud/dashboard と同じ情報量を表示する (= まさ「同じ情報量に」確定)。
 * UI テイストは通常版維持 (= cyber テイストは HUD だけ、通常 dashboard は素朴な card)。
 *
 * 表示:
 *  1. AMD Management Score (= AMD 全体経営スコア最新 + 5 軸内訳 + 24 ヶ月 sparkline)
 *  2. 月次ルーティン残タスク (= 当月の請求 / 報告 / 入金 等の未消化、最大 5 件)
 *  3. 各 active PJ の AMD Score (= 最新 total / M / X / F の数値 + 12 ヶ月 sparkline)
 *
 * 元: pwa/src/components/hud/HudControlCenterDashboard.tsx (= cyber 版、1195 行)
 *    pwa/src/app/(app)/hud/dashboard/page.tsx (= データ収集ロジック)
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

export type DashboardProjectSignal = {
  projectId: string;
  projectName: string;
  shortLabel: string | null;
  scoreHistory: number[]; // 古→新
  m: number | null;
  x: number | null;
  f: number | null;
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
  projectSignals,
}: {
  managementScore: DashboardManagementScoreSnapshot | null;
  managementHistory: DashboardManagementScoreSnapshot[];
  actionItems: DashboardActionItem[];
  projectSignals: DashboardProjectSignal[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ManagementScoreCard score={managementScore} history={managementHistory} />
        <MonthlyActionsCard items={actionItems} />
      </div>
      {projectSignals.length > 0 && (
        <ProjectSignalsCard signals={projectSignals} />
      )}
    </div>
  );
}

function ManagementScoreCard({ score, history }: { score: DashboardManagementScoreSnapshot | null; history: DashboardManagementScoreSnapshot[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold">AMD Management Score</h2>
        <Link href="/management-score" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">
          詳細 →
        </Link>
      </div>
      {!score ? (
        <p className="text-xs text-muted-foreground">snapshot なし</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <div className="text-3xl font-bold">{formatScore(score.total_score)}</div>
            <div className="text-[11px] text-muted-foreground">{score.ym || "(未設定)"}</div>
            {typeof score.confidence === "number" && (
              <div className="text-[10px] text-muted-foreground ml-auto">conf={score.confidence.toFixed(2)}</div>
            )}
          </div>
          <Sparkline values={history.map((h) => h.total_score ?? 0)} className="h-10 w-full" />
          <div className="mt-3 grid grid-cols-5 gap-1.5 text-[10px]">
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

function MonthlyActionsCard({ items }: { items: DashboardActionItem[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold">月次ルーティン残タスク</h2>
        <span className="text-[11px] text-muted-foreground">{items.length} 件</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">残タスクなし</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i}>
              <Link
                href={`/project/${it.projectId}/cockpit`}
                className={`flex items-center gap-2 rounded border px-2 py-1.5 text-[11px] hover:bg-muted/40 transition-colors ${TONE_CLASS[it.tone]}`}
              >
                <span className="font-mono text-[9px] font-bold rounded bg-white/60 px-1.5 py-0.5">{it.projectInitials}</span>
                <span className="font-medium">{it.title}</span>
                <span className="text-[10px] opacity-70 ml-auto">{it.periodLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectSignalsCard({ signals }: { signals: DashboardProjectSignal[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">各 PJ AMD Score / シグナル</h2>
        <Link href="/venture-map" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">
          Venture Map →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {signals.map((s) => (
          <Link
            key={s.projectId}
            href={`/project/${s.projectId}/cockpit`}
            className="rounded border border-border bg-background px-3 py-2 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono text-[10px] text-muted-foreground">{s.projectId}</span>
              <span className="text-[12px] font-semibold">{s.shortLabel || s.projectName}</span>
              <span className="text-base font-bold ml-auto">
                {s.scoreHistory.length > 0 ? formatScore(s.scoreHistory[s.scoreHistory.length - 1]) : "—"}
              </span>
            </div>
            <Sparkline values={s.scoreHistory} className="h-6 w-full mb-1" />
            <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
              <SignalMetric label="M" value={s.m} />
              <SignalMetric label="X" value={s.x} />
              <SignalMetric label="F" value={s.f} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ScoreAxis({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded border border-border bg-background px-1.5 py-1 text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="text-[12px] font-semibold">{value == null ? "—" : value.toFixed(1)}</div>
    </div>
  );
}

function SignalMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-mono">{label}</span>
      <span className="font-semibold text-foreground">{value == null ? "—" : formatMetric(value)}</span>
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (!values || values.length < 2) {
    return <div className={`${className} bg-muted/20 rounded`} />;
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
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className="text-sky-500" />
    </svg>
  );
}

function formatScore(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString();
}

function formatMetric(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) >= 10) return v.toFixed(0);
  return v.toFixed(1);
}
