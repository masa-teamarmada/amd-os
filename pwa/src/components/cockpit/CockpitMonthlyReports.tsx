"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import { loadMonthlyReports, peekMonthlyReports, invalidateMonthlyReports, type ReportMonth } from "@/lib/monthly-reports-client";
export { prefetchMonthlyReports } from "@/lib/monthly-reports-client";

function monthLabel(ym: string) { return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`; }

export function CockpitMonthlyReports({ projectId, currentYm }: { projectId: string; currentYm: string }) {
  const [state, setState] = useState<{ projectId: string; reports: ReportMonth[]; loading: boolean; error: string | null }>({ projectId, reports: peekMonthlyReports(projectId) ?? [], loading: true, error: null });
  const [selectedYm, setSelectedYm] = useState(currentYm);
  const [template, setTemplate] = useState<"internal" | "submission">("submission");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState({ projectId, reports: peekMonthlyReports(projectId) ?? [], loading: true, error: null });
    loadMonthlyReports(projectId).then((reports) => {
      if (!cancelled) setState({ projectId, reports, loading: false, error: null });
    }).catch((cause) => {
      if (!cancelled) setState({ projectId, reports: [], loading: false, error: cause instanceof Error ? cause.message : "読み込みに失敗しました。" });
    });
    return () => { cancelled = true; };
  }, [projectId, currentYm, retry]);
  useEffect(() => { setSelectedYm(currentYm); }, [projectId, currentYm]);
  const current = state.projectId === projectId;
  const reports = current ? state.reports : [];
  const months = [...new Set([currentYm, ...reports.map((report) => report.ym)])].sort().reverse();
  const selected = reports.find((report) => report.ym === selectedYm);
  const available = template === "internal" ? Boolean(selected?.internalStatus) : Boolean(selected?.hasSubmission);
  const href = `/project/${encodeURIComponent(projectId)}/report/${selectedYm}/print?template=${template}`;
  return (
    <section role="tabpanel" aria-label="月次報告書" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold">月次報告書</h2><p className="mt-1 text-sm text-muted-foreground">対象月を選んで、社内版・提出版を確認できます。</p></div>
        <Button variant="outline" onClick={() => { invalidateMonthlyReports(projectId); setRetry((value) => value + 1); }}>更新</Button>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="報告対象月">
        {months.map((ym) => <button key={ym} type="button" aria-pressed={ym === selectedYm} onClick={() => setSelectedYm(ym)} className={`min-h-11 rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${ym === selectedYm ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>{monthLabel(ym)}</button>)}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="報告書の種類">
            <Button variant={template === "internal" ? "default" : "outline"} onClick={() => setTemplate("internal")}>社内版</Button>
            <Button variant={template === "submission" ? "default" : "outline"} onClick={() => setTemplate("submission")}>提出版</Button>
            <span className="text-xs text-muted-foreground">{state.loading ? "読み込み中" : state.error ? "取得失敗" : available ? template === "internal" && selected?.internalStatus === "draft" ? "下書き" : "保存済み" : "未生成"}</span>
          </div>
          {available && <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">別画面で開く・印刷</a>}
        </div>
        {!current || state.loading ? <p role="status" className="p-8 text-center text-sm text-muted-foreground">月次報告書を読み込み中…</p>
          : state.error ? <p role="alert" className="p-8 text-sm text-destructive">{state.error}</p>
          : available ? <iframe key={href} src={href} title={`${monthLabel(selectedYm)} ${template === "internal" ? "社内版" : "提出版"} 月次報告書`} className="h-[75vh] min-h-[480px] w-full border-0" />
          : <div className="p-8 text-center"><p className="text-sm font-medium">{monthLabel(selectedYm)}の{template === "internal" ? "社内版" : "提出版"}は未生成です。</p><p className="mt-2 text-xs text-muted-foreground">保存が完了すると、このタブに表示されます。</p></div>}
      </div>
    </section>
  );
}
