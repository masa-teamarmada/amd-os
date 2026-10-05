"use client";

import { useEffect, useRef, useState } from "react";
import { MonthlyReportSelectors } from "./MonthlyReportSelectors";
import { Button } from "@/components/ui/button";
import { getDefaultMonthlyReportYm } from "@/lib/monthly-report-default-month";

import { loadMonthlyReports, peekMonthlyReports, invalidateMonthlyReports, type ReportMonth } from "@/lib/monthly-reports-client";
export { prefetchMonthlyReports } from "@/lib/monthly-reports-client";

function monthLabel(ym: string) { return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`; }

export function CockpitMonthlyReports({ projectId, currentYm }: { projectId: string; currentYm: string }) {
  const [state, setState] = useState<{ projectId: string; reports: ReportMonth[]; loading: boolean; error: string | null }>({ projectId, reports: peekMonthlyReports(projectId) ?? [], loading: true, error: null });
  const [defaultYm] = useState(getDefaultMonthlyReportYm);
  const [selectedYm, setSelectedYm] = useState(defaultYm);
  const [template, setTemplate] = useState<"internal" | "submission">("submission");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setState({ projectId, reports: peekMonthlyReports(projectId) ?? [], loading: true, error: null }); });
    loadMonthlyReports(projectId).then((reports) => {
      if (!cancelled) setState({ projectId, reports, loading: false, error: null });
    }).catch((cause) => {
      if (!cancelled) setState({ projectId, reports: [], loading: false, error: cause instanceof Error ? cause.message : "読み込みに失敗しました。" });
    });
  return () => { cancelled = true; };
  }, [projectId, currentYm, retry]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setSelectedYm(defaultYm); });
    return () => { cancelled = true; };
  }, [projectId, defaultYm]);
  const current = state.projectId === projectId;
  const reports = current ? state.reports : [];
  const months = [...new Set([currentYm, defaultYm, ...reports.map((report) => report.ym)])].sort().reverse();
  const selected = reports.find((report) => report.ym === selectedYm);
  const available = template === "internal" ? Boolean(selected?.internalStatus) : Boolean(selected?.hasSubmission);
  const href = `/project/${encodeURIComponent(projectId)}/report/${selectedYm}/print?template=${template}`;
  const monthKeys = months.join(",");
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "monthly-report:select" && monthKeys.split(",").includes(event.data.ym) && ["internal", "submission"].includes(event.data.template)) {
        setSelectedYm(event.data.ym);
        setTemplate(event.data.template);
      }
      if (event.data?.type === "monthly-report:refresh") {
        invalidateMonthlyReports(projectId);
        setRetry((value) => value + 1);
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [projectId, monthKeys]);
  return (
    <section role="tabpanel" aria-label="月次報告書" className="min-w-0 space-y-2">
      {(!available || state.loading || state.error) && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
        <h2 className="mr-1 text-sm font-semibold">月次報告書</h2>
        <MonthlyReportSelectors months={months} ym={selectedYm} template={template} onChange={(ym, kind) => { setSelectedYm(ym); setTemplate(kind); }} />
        <Button variant="ghost" className="ml-auto h-9 max-sm:h-11" onClick={() => { invalidateMonthlyReports(projectId); setRetry((value) => value + 1); }}>更新</Button>
      </div>}
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {!current || state.loading ? <p role="status" className="p-8 text-center text-sm text-muted-foreground">月次報告書を読み込み中…</p>
          : state.error ? <p role="alert" className="p-8 text-sm text-destructive">{state.error}</p>
          : available ? <iframe ref={frameRef} key={`${href}:${retry}`} src={`${href}&embedded=1`} title={`${monthLabel(selectedYm)} ${template === "internal" ? "社内版" : "提出版"} 月次報告書`} className="h-[80vh] min-h-[480px] w-full border-0" />
          : <div className="p-8 text-center"><p className="text-sm font-medium">{monthLabel(selectedYm)}の{template === "internal" ? "社内版" : "提出版"}は未生成です。</p><p className="mt-2 text-xs text-muted-foreground">保存が完了すると、このタブに表示されます。</p></div>}
      </div>
    </section>
  );
}
