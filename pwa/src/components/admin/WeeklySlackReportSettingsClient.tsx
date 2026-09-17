"use client";

import { useState } from "react";
import { Loader2, Radio, ShieldOff } from "lucide-react";
import type { WeeklySlackReportStatus } from "@/lib/weekly-slack-report-settings";

type Props = {
  initialReports: WeeklySlackReportStatus[];
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  reports?: WeeklySlackReportStatus[];
};

export function WeeklySlackReportSettingsClient({ initialReports }: Props) {
  const [reports, setReports] = useState(initialReports);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const update = async (projectId: string, enabled: boolean) => {
    setUpdatingId(projectId);
    setError("");
    try {
      const response = await fetch("/api/admin/weekly-slack-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, enabled }),
      });
      const data = await response.json().catch(() => ({})) as ApiResponse;
      if (!response.ok || !data.ok || !data.reports) {
        throw new Error(data.error || "設定を保存できませんでした");
      }
      setReports(data.reports);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "設定を保存できませんでした");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="border border-border bg-background" aria-labelledby="weekly-slack-report-title">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            External reporting
          </div>
          <h2 id="weekly-slack-report-title" className="mt-1 text-[16px] font-semibold tracking-tight">週次 Slack レポート</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            CTB と SE のつくよみ週次レポートを、PJごとに生成・送信するかを管理する。設定がない場合も停止として扱う。
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <ShieldOff className="h-4 w-4" aria-hidden="true" />
          送信前にこの設定を確認
        </div>
      </div>

      <div className="divide-y divide-border">
        {reports.map((report) => {
          const pending = updatingId === report.id;
          const statusLabel = report.enabled ? "配信中" : "停止中";
          return (
            <div key={report.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold">{report.label}</h3>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${report.enabled ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {report.enabled ? "次回の送信候補として扱う" : "レポートを生成・送信しない"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={report.enabled}
                aria-label={`${report.label} の週次 Slack レポートを${report.enabled ? "停止" : "配信"}にする`}
                disabled={pending || updatingId !== null}
                onClick={() => void update(report.id, !report.enabled)}
                className={`inline-flex min-h-10 min-w-28 items-center justify-center gap-2 border px-3 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${report.enabled ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800" : "border-border bg-background text-foreground hover:bg-muted"}`}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {report.enabled ? "停止する" : "配信する"}
              </button>
            </div>
          );
        })}
      </div>
      {error ? <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">{error}</p> : null}
    </section>
  );
}
