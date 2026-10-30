"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, FileText, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportState = "ready" | "draft" | "missing" | "not_applicable" | "not_recorded";
export type MonthlyReportOverviewRow = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  internalState: ReportState;
  submissionState: ReportState;
  internalUpdatedAt: string | null;
  submissionUpdatedAt: string | null;
};

type ReportKind = "internal" | "submission";
type Selection = { projectId: string; kind: ReportKind };

const STATE_LABEL: Record<ReportState, string> = {
  ready: "保存済み",
  draft: "下書き",
  missing: "未作成",
  not_applicable: "対象外",
  not_recorded: "記録なし",
};
const STATE_TONE: Record<ReportState, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  draft: "border-amber-200 bg-amber-50 text-amber-800",
  missing: "border-rose-200 bg-rose-50 text-rose-800",
  not_applicable: "border-border bg-muted/50 text-muted-foreground",
  not_recorded: "border-border bg-muted/50 text-muted-foreground",
};

function monthLabel(ym: string) {
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}
function dateLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function stateFor(row: MonthlyReportOverviewRow, kind: ReportKind) {
  return kind === "internal" ? row.internalState : row.submissionState;
}
function reportHref(projectId: string, ym: string, kind: ReportKind) {
  return `/project/${encodeURIComponent(projectId)}/report/${ym}/print?template=${kind}`;
}

export function AdminMonthlyReportsClient({ ym, currentMonth, monthOptions, rows }: {
  ym: string;
  currentMonth: boolean;
  monthOptions: string[];
  rows: MonthlyReportOverviewRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const firstReady = rows.flatMap((row) => (["submission", "internal"] as const).filter((kind) => stateFor(row, kind) === "ready").map((kind) => ({ projectId: row.projectId, kind })))[0];
  const [selection, setSelection] = useState<Selection | null>(firstReady ?? null);
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP");
  const visibleRows = rows.filter((row) => {
    if (missingOnly && row.internalState !== "missing" && row.submissionState !== "missing" && row.internalState !== "draft") return false;
    return !normalizedQuery || `${row.projectId} ${row.projectName} ${row.clientName ?? ""}`.toLocaleLowerCase("ja-JP").includes(normalizedQuery);
  });
  const fallbackRow = visibleRows[0] ?? null;
  const visibleSelection = selection && visibleRows.some((row) => row.projectId === selection.projectId)
    ? selection
    : fallbackRow
      ? { projectId: fallbackRow.projectId, kind: fallbackRow.submissionState === "missing" ? "submission" as const : "internal" as const }
      : null;
  const selectedRow = visibleRows.find((row) => row.projectId === visibleSelection?.projectId) ?? null;
  const selectedState = selectedRow && visibleSelection ? stateFor(selectedRow, visibleSelection.kind) : null;
  const selectedReady = selectedState === "ready" || selectedState === "draft";
  const selectedHref = visibleSelection ? reportHref(visibleSelection.projectId, ym, visibleSelection.kind) : null;
  const summary = {
    internalReady: rows.filter((row) => row.internalState === "ready").length,
    internalTarget: rows.filter((row) => row.internalState === "ready" || row.internalState === "draft" || row.internalState === "missing").length,
    submissionReady: rows.filter((row) => row.submissionState === "ready").length,
    submissionTarget: rows.filter((row) => row.submissionState === "ready" || row.submissionState === "missing").length,
    missing: rows.filter((row) => row.internalState === "missing" || row.internalState === "draft" || row.submissionState === "missing").length,
  };

  return <main className="mx-auto max-w-[1600px] space-y-5" aria-busy={isPending}>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold tracking-[0.12em] text-muted-foreground">ADMIN / PJ・実行</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">月次報告書</h1>
        <p className="mt-1 text-sm text-muted-foreground">全PJの保存状況と本文を、ここで確認できる。</p>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="admin-monthly-report-ym" className="text-sm font-medium text-foreground">対象月</label>
        <select id="admin-monthly-report-ym" value={ym} onChange={(event) => startTransition(() => router.push(`/admin/monthly-reports?ym=${event.target.value}`))} className="h-10 min-w-36 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {monthOptions.map((option) => <option key={option} value={option}>{monthLabel(option)}</option>)}
        </select>
        <button type="button" onClick={() => startTransition(() => router.refresh())} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="月次報告書を更新">
          <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} aria-hidden="true" /><span>更新</span>
        </button>
      </div>
    </header>

    <div className="flex flex-wrap items-center gap-2 border-y border-border py-3 text-sm">
      <span className="font-medium text-foreground">{monthLabel(ym)}</span>
      <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">社内版 <strong className="font-semibold text-foreground">{summary.internalReady}{currentMonth ? ` / ${summary.internalTarget}` : "件"}</strong></span>
      <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">提出版 <strong className="font-semibold text-foreground">{summary.submissionReady}{currentMonth ? ` / ${summary.submissionTarget}` : "件"}</strong></span>
      {currentMonth && summary.missing > 0 && <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-medium text-rose-800">確認が必要なPJ {summary.missing}件</span>}
      {!currentMonth && <span className="text-xs text-muted-foreground">過去月は保存済みの記録を表示</span>}
    </div>

    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
      <section aria-label="PJ別の月次報告書" className="min-w-0 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="PJ名・提出先で探す" aria-label="PJ名・提出先で探す" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          {currentMonth && <label className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-input px-2.5 text-xs text-foreground"><input type="checkbox" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} className="accent-primary" />要確認のみ</label>}
        </div>
        <p className="text-xs text-muted-foreground">{visibleRows.length} PJを表示。版を押すと右側に本文が開く。</p>
        {visibleRows.length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">該当するPJはありません。</p> : <div className="space-y-2">
          {visibleRows.map((row) => <article key={row.projectId} className={cn("rounded-xl border bg-background p-3 transition-colors", visibleSelection?.projectId === row.projectId ? "border-primary/50 shadow-sm" : "border-border")}>
            <div className="mb-3 flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{row.projectId}</span>
              <h2 className="min-w-0 truncate text-sm font-semibold text-foreground" title={row.projectName}>{row.projectName}</h2>
            </div>
            {row.clientName && <p className="-mt-2 mb-3 truncate text-xs text-muted-foreground" title={row.clientName}>{row.clientName}</p>}
            <div className="grid grid-cols-2 gap-2">
              {(["internal", "submission"] as const).map((kind) => {
                const state = stateFor(row, kind);
                const active = visibleSelection?.projectId === row.projectId && visibleSelection.kind === kind;
                const updated = dateLabel(kind === "internal" ? row.internalUpdatedAt : row.submissionUpdatedAt);
                return <button key={kind} type="button" onClick={() => setSelection({ projectId: row.projectId, kind })} aria-pressed={active} className={cn("min-w-0 rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-primary bg-primary/5" : "border-border bg-muted/20")}>
                  <span className="block text-xs font-medium text-muted-foreground">{kind === "internal" ? "社内版" : "提出版"}</span>
                  <span className={cn("mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium", STATE_TONE[state])}>{STATE_LABEL[state]}</span>
                  {updated && (state === "ready" || state === "draft") && <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">{updated} 更新</span>}
                </button>;
              })}
            </div>
          </article>)}
        </div>}
      </section>

      <section aria-label="報告書の本文" className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{monthLabel(ym)}の報告書</p>
              <h2 className="truncate text-base font-semibold text-foreground">{selectedRow ? `${selectedRow.projectName} · ${visibleSelection?.kind === "internal" ? "社内版" : "提出版"}` : "報告書を選択"}</h2>
            </div>
            {selectedReady && selectedHref && <a href={selectedHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1 rounded-md border border-input px-3 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">別画面で開く<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></a>}
          </div>
          {selectedReady && selectedHref
            ? <iframe key={selectedHref} src={`${selectedHref}&embedded=1`} title={`${selectedRow?.projectName ?? ""} ${visibleSelection?.kind === "internal" ? "社内版" : "提出版"} 月次報告書`} className="h-[76vh] min-h-[580px] w-full border-0 bg-white" />
            : <div className="flex min-h-[580px] flex-col items-center justify-center gap-3 px-6 text-center"><FileText className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" /><p className="text-sm font-medium text-foreground">{selectedState === "missing" ? "この版は未作成です。" : selectedState === "not_applicable" ? "この月は対象外です。" : selectedState === "not_recorded" ? "この月の記録はありません。" : "左の一覧から報告書を選択してください。"}</p></div>}
        </div>
      </section>
    </div>
  </main>;
}
