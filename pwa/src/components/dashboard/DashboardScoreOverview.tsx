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
  notifications,
  managementScore,
  managementHistory,
  actionItems,
}: {
  notifications: DashboardNotificationsSummary | null;
  managementScore: DashboardManagementScoreSnapshot | null;
  managementHistory: DashboardManagementScoreSnapshot[];
  actionItems: DashboardActionItem[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <NotificationsCard summary={notifications} />
      <ManagementScoreCard score={managementScore} history={managementHistory} />
      <MonthlyActionsCard items={actionItems} />
    </div>
  );
}

function NotificationsCard({ summary }: { summary: DashboardNotificationsSummary | null }) {
  if (!summary || !summary.canView) {
    return (
      <section className="rounded-lg border border-border bg-card p-3 flex items-center justify-center text-xs text-muted-foreground min-h-[120px]">
        通知センター (admin のみ)
      </section>
    );
  }
  return (
    <Link
      href="/notifications"
      className="rounded-lg border border-border bg-card p-3 hover:shadow-md transition-shadow flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">📬</span>
        <h2 className="text-sm font-semibold flex-1">通知センター</h2>
        {summary.unread > 0 ? (
          <span className="inline-flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5">
            {summary.unread > 99 ? "99+" : `${summary.unread}`}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">(未読なし)</span>
        )}
      </div>
      {summary.recentTitles.length > 0 && (
        <ul className="space-y-0.5 mt-1">
          {summary.recentTitles.slice(0, 3).map((t, i) => (
            <li key={i} className="text-[11px] text-muted-foreground truncate">
              • {t}
            </li>
          ))}
        </ul>
      )}
      <div className="text-[10px] text-muted-foreground/70 mt-auto pt-1">→ 一覧</div>
    </Link>
  );
}

function ManagementScoreCard({ score, history }: { score: DashboardManagementScoreSnapshot | null; history: DashboardManagementScoreSnapshot[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 min-h-[120px]">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">AMD Management Score</h2>
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
          <Sparkline values={history.map((h) => h.total_score ?? 0)} className="h-7 w-full text-sky-600" />
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
