"use client";

/**
 * MyPageSummaryPanel — /dashboard 右側パネル (= 2026-05-25 #71 後段 #5 まさ「マイページの中身を右に」)
 *
 * 軽量サマリー (= /mypage の詳細は別途遷移):
 *  - ログインユーザー表示 (= code_name)
 *  - 当月の自分の参画 PJ 一覧 (= project_members で is_active な PJ)
 *  - 公式役割分担数 (= milestone_responsibility で share>0)
 *  - 直近 7 日の自分の活動 (= member_activities)
 *  - マイページへの CTA
 */
import Link from "next/link";

export type MyPageSummary = {
  codeName: string;
  memberId: string | null;
  myProjects: Array<{ projectId: string; projectName: string; status: string }>;
  responsibilityCount: number;
  recentActivities: Array<{ projectId: string; title: string; itemDate: string | null }>;
  unreadNotifications: number;
};

export function MyPageSummaryPanel({ summary }: { summary: MyPageSummary | null }) {
  if (!summary || !summary.memberId) {
    return (
      <aside className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        ログイン情報なし
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-border bg-card p-3 space-y-3 sticky top-2">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold">{summary.codeName}</span>
        <span className="text-[9px] text-muted-foreground">のマイページ</span>
        <Link href="/mypage" className="ml-auto text-[10px] text-muted-foreground hover:text-foreground hover:underline">
          詳細 →
        </Link>
      </div>

      {/* === 参画 PJ === */}
      <section>
        <div className="flex items-baseline gap-1 mb-1">
          <h3 className="text-[11px] font-semibold text-foreground">参画 PJ</h3>
          <span className="text-[9px] text-muted-foreground">{summary.myProjects.length} 件</span>
        </div>
        {summary.myProjects.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">参画 PJ なし</p>
        ) : (
          <ul className="space-y-0.5">
            {summary.myProjects.slice(0, 10).map((p) => (
              <li key={p.projectId}>
                <Link
                  href={`/project/${p.projectId}/cockpit`}
                  className="flex items-center gap-1.5 text-[11px] rounded px-1.5 py-0.5 hover:bg-muted/40 transition-colors"
                >
                  <span className="font-mono text-[9px] text-muted-foreground">{p.projectId}</span>
                  <span className="truncate flex-1">{p.projectName}</span>
                  <span
                    className={`text-[8px] rounded border px-1 py-0.5 ${
                      p.status === "active"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-zinc-50 border-zinc-300 text-zinc-600"
                    }`}
                  >
                    {p.status}
                  </span>
                </Link>
              </li>
            ))}
            {summary.myProjects.length > 10 && (
              <li className="text-[9px] text-muted-foreground pl-2">…他 {summary.myProjects.length - 10} 件</li>
            )}
          </ul>
        )}
      </section>

      {/* === 公式役割分担 === */}
      <section className="border-t border-border/50 pt-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold text-foreground">公式役割分担 (MS)</h3>
          <span className="text-sm font-bold tabular-nums">{summary.responsibilityCount}</span>
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5">
          milestone_responsibility (share &gt; 0)
        </p>
      </section>

      {/* === 直近 7 日活動 === */}
      <section className="border-t border-border/50 pt-2">
        <div className="flex items-baseline gap-1 mb-1">
          <h3 className="text-[11px] font-semibold text-foreground">直近 7 日の活動</h3>
          <span className="text-[9px] text-muted-foreground">{summary.recentActivities.length} 件</span>
        </div>
        {summary.recentActivities.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">activity なし</p>
        ) : (
          <ul className="space-y-1">
            {summary.recentActivities.slice(0, 5).map((a, i) => (
              <li key={i} className="text-[10px] flex items-start gap-1.5">
                <span className="font-mono text-[9px] text-muted-foreground mt-0.5 shrink-0">{a.projectId}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{a.title || "(no title)"}</div>
                  {a.itemDate && (
                    <div className="text-[8px] text-muted-foreground">{a.itemDate.slice(5)}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.unreadNotifications > 0 && (
        <section className="border-t border-border/50 pt-2">
          <Link
            href="/notifications"
            className="flex items-center justify-between gap-2 rounded border border-rose-300 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800 hover:brightness-95 transition-all"
          >
            <span className="font-medium">📬 未読通知</span>
            <span className="font-bold tabular-nums">{summary.unreadNotifications}</span>
          </Link>
        </section>
      )}

      <Link
        href="/mypage"
        className="block rounded border border-sky-300 bg-sky-50 px-2 py-1.5 text-[11px] text-sky-800 text-center hover:brightness-95 transition-all"
      >
        マイページ詳細 (アロケーション / 立替 / 月次)
      </Link>
    </aside>
  );
}
