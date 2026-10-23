"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { SeasonRewardTrend, currentYmJst } from "@/components/monthly-agreement/MonthlyAgreementExperience";
import type { KiyoRewardOutlookResponse } from "@/lib/monthly-work-agreement-types";

export function KiyoRewardOutlookPanel() {
  const [ym, setYm] = useState(currentYmJst);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<KiyoRewardOutlookResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    void (async () => {
      try {
        const response = await fetch(`/api/admin/kiyo/reward-outlook?ym=${encodeURIComponent(ym)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as { ok?: boolean; data?: KiyoRewardOutlookResponse; error?: string };
        if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error || "取得に失敗しました");
        setData(payload.data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "取得に失敗しました");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [ym, refresh]);

  const projectCount = data?.members.reduce((sum, member) => sum + member.projects.length, 0) ?? 0;

  return (
    <div className="min-w-0" data-testid="kiyo-reward-outlook">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">メンバー別・シーズン報酬の見通し</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            対象月に参加中のメンバーとプロジェクトを表示。月初合意と同じ計算結果・棒グラフを見る。
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            対象月
            <input
              type="month"
              value={`${ym.slice(0, 4)}-${ym.slice(4, 6)}`}
              onChange={(event) => {
                const next = event.target.value.replace("-", "");
                if (/^\d{6}$/.test(next)) setYm(next);
              }}
              className="h-9 rounded-none border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1 border border-border px-3 text-xs font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            更新
          </button>
        </div>
      </div>

      {loading && <p role="status" className="py-8 text-sm text-muted-foreground">報酬の見通しを読み込み中…</p>}
      {error && <p role="alert" className="my-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {data && !loading && (
        <>
          <p className="py-3 text-xs text-muted-foreground">{data.members.length}人・{projectCount}プロジェクト</p>
          {data.members.length === 0 && <p className="border-t border-border py-8 text-sm text-muted-foreground">この月に対象となるメンバーはいないよ。</p>}
          <div className="space-y-5">
            {data.members.map((member) => (
              <section key={member.memberId} className="min-w-0 border-t border-border pt-3" aria-label={`${member.codeName}の報酬見通し`}>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-base font-semibold text-foreground">{member.codeName}</h3>
                  <span className="text-xs text-muted-foreground">{member.projects.length}プロジェクト</span>
                </div>
                {member.projects.length === 0 && <p className="text-xs text-muted-foreground">表示できる報酬の見通しはありません。</p>}
                <div className="space-y-4">
                  {member.projects.map((project) => (
                    <div key={project.projectId} className="min-w-0 border border-border bg-background p-3">
                      <h4 className="border-b border-border pb-2 text-sm font-semibold text-foreground">{project.projectName}</h4>
                      <SeasonRewardTrend project={project} ym={ym} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
