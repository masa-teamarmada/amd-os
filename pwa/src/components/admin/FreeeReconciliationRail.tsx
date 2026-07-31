"use client";

import { useState } from "react";
import { Loader2, PlayCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { ReconciliationFindingRow, ReconciliationOverview, ReconciliationRunSummary } from "@/lib/finance/freee-reconciliation-client";

interface Props {
  initialOverview: ReconciliationOverview;
}

function yen(value: number | null | undefined) {
  if (value == null) return "-";
  return `¥${Number(value).toLocaleString("ja-JP")}`;
}

function dt(value: string | null | undefined) {
  if (!value) return "-";
  return value.slice(0, 16).replace("T", " ");
}

/** severity/review_statusの色規約: 黄=要確認, 赤=停止, 緑=再照合済み。白/slate基調。 */
function severityTone(severity: string) {
  if (severity === "blocker") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "info") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function reviewStatusTone(status: string) {
  if (status === "auto_applied" || status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "rejected") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function runStatusTone(status: string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

const SECTION_ORDER: Array<{ key: string; label: string }> = [
  { key: "balance_delta", label: "未解決差額（口座残高）" },
  { key: "sync_stale", label: "口座同期状態" },
  { key: "officer_compensation_unreconciled", label: "役員報酬の未消込" },
  { key: "internal_transfer_candidate", label: "内部振替候補" },
  { key: "anomalous_journal", label: "変な仕訳" },
  { key: "unprocessed_entry", label: "未処理明細" },
];

function FindingTable({
  rows,
  onReview,
  busyId,
}: {
  rows: ReconciliationFindingRow[];
  onReview: (row: ReconciliationFindingRow, decision: "approved" | "rejected", confirmWrite?: boolean) => void;
  busyId: string | null;
}) {
  if (rows.length === 0) {
    return <div className="py-4 text-center text-[12px] text-muted-foreground">該当なし</div>;
  }
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left font-medium">状態</th>
            <th className="px-3 py-2 text-left font-medium">内容</th>
            <th className="px-3 py-2 text-right font-medium">金額</th>
            <th className="px-3 py-2 text-left font-medium">確度</th>
            <th className="px-3 py-2 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="align-top hover:bg-muted/20">
              <td className="px-3 py-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${severityTone(row.severity)}`}>{row.severity}</span>
                <div className="mt-1">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${reviewStatusTone(row.reviewStatus)}`}>{row.reviewStatus}</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="font-medium">{row.title}</div>
                <div className="mt-0.5 max-w-xl text-[11px] text-muted-foreground">{row.summaryJa}</div>
                <div className="mt-0.5 max-w-xl text-[11px] text-muted-foreground/80">{row.decisionReasonJa}</div>
                {row.reviewNote && <div className="mt-0.5 text-[11px] text-muted-foreground">メモ: {row.reviewNote}</div>}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {yen(row.amountYen)}
                {row.deltaYen != null && row.deltaYen !== 0 && (
                  <div className="text-[11px] text-muted-foreground">差額 {yen(row.deltaYen)}</div>
                )}
              </td>
              <td className="px-3 py-2">{row.matchConfidence}</td>
              <td className="px-3 py-2">
                {row.reviewStatus === "pending" || row.reviewStatus === "blocked" ? (
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onReview(row, "approved", row.eligibleForAutoApply && row.matchConfidence === "exact")}
                      disabled={busyId === row.id}
                      className="inline-flex items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                    >
                      {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      承認
                    </button>
                    <button
                      onClick={() => onReview(row, "rejected")}
                      disabled={busyId === row.id}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/40 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      却下
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground">{dt(row.lastSeenAt)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunHistoryTable({ runs }: { runs: ReconciliationRunSummary[] }) {
  if (runs.length === 0) return <div className="py-4 text-center text-[12px] text-muted-foreground">run履歴なし</div>;
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left font-medium">週</th>
            <th className="px-3 py-2 text-left font-medium">状態</th>
            <th className="px-3 py-2 text-left font-medium">phase / seq</th>
            <th className="px-3 py-2 text-right font-medium">finding</th>
            <th className="px-3 py-2 text-right font-medium">自動反映</th>
            <th className="px-3 py-2 text-right font-medium">stop</th>
            <th className="px-3 py-2 text-left font-medium">開始</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="px-3 py-2 font-mono">
                {run.weekStartDate}〜{run.weekEndDate}
              </td>
              <td className="px-3 py-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${runStatusTone(run.status)}`}>{run.status}</span>
                {run.dryRun && <span className="ml-1 text-[10px] text-muted-foreground">dry-run</span>}
                {run.errorMessage && <div className="mt-0.5 max-w-xs truncate text-[11px] text-red-700">{run.errorMessage}</div>}
              </td>
              <td className="px-3 py-2 text-[11px] text-muted-foreground">
                {run.phase} / #{run.runSequence ?? "-"}
              </td>
              <td className="px-3 py-2 text-right font-mono">{run.findingCount}</td>
              <td className="px-3 py-2 text-right font-mono">{run.autoAppliedCount}</td>
              <td className="px-3 py-2 text-right font-mono">{run.blockedCount}</td>
              <td className="px-3 py-2 text-[11px] text-muted-foreground">{dt(run.startedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FreeeReconciliationRail({ initialOverview }: Props) {
  const [overview, setOverview] = useState<ReconciliationOverview>(initialOverview);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  const refresh = async () => {
    const res = await fetch("/api/admin/finance/reconciliation");
    const json = await res.json();
    if (json.ok) setOverview(json.overview);
  };

  const triggerDryRun = async () => {
    setRunning(true);
    setHint("");
    const res = await fetch("/api/admin/finance/reconciliation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "run", dryRun: true }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setHint(`実行エラー: ${json.error ?? res.statusText}`);
    } else if (json.skipped) {
      setHint(`スキップ: ${json.reason}`);
    } else {
      setHint(`dry-run完了: finding ${json.findingCount}件（phase ${json.phase} / #${json.runSequence}）`);
      await refresh();
    }
    setRunning(false);
  };

  const onReview = async (row: ReconciliationFindingRow, decision: "approved" | "rejected", confirmWrite = false) => {
    if (decision === "approved" && confirmWrite) {
      const ok = window.confirm(
        `この承認は freee 側の対象明細を役員報酬として分類する即時書き込みを伴います（金額${yen(row.amountYen)}）。よろしいですか？`
      );
      if (!ok) return;
    }
    setBusyId(row.id);
    setHint("");
    const res = await fetch("/api/admin/finance/reconciliation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "review", findingId: row.id, decision, confirmWrite }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      if (json.requiresConfirmation) {
        await onReview(row, decision, true);
        setBusyId(null);
        return;
      }
      setHint(`レビューエラー: ${json.error ?? res.statusText}`);
    } else {
      setHint(json.write?.attempted ? (json.write.ok ? "freeeへの書き込みに成功した" : `freee書き込み失敗: ${json.write.error}`) : "レビューを保存した");
      await refresh();
    }
    setBusyId(null);
  };

  const latestRun = overview.latestRun;

  return (
    <div className="space-y-4 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[13px] font-semibold">会計照合レール</h2>
        {latestRun && (
          <span className={`rounded border px-1.5 py-0.5 text-[10px] ${runStatusTone(latestRun.status)}`}>
            直近run: {latestRun.weekStartDate}〜{latestRun.weekEndDate} ({latestRun.status}, phase {latestRun.phase} #{latestRun.runSequence})
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[12px] hover:bg-muted/40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            再読込
          </button>
          <button
            onClick={triggerDryRun}
            disabled={running}
            className="inline-flex items-center gap-1 rounded bg-foreground px-3 py-1.5 text-[12px] text-background disabled:opacity-60"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            dry-runプレビュー実行
          </button>
        </div>
      </div>
      {hint && <div className="text-[12px] text-muted-foreground">{hint}</div>}
      <p className="text-[11px] text-muted-foreground">
        最初の4回の成功run（木曜cron）はreview-only。5回目以降も自動反映されるのは、役員報酬の完全一致消込・同額同日/許容日差の内部振替のみ。
        内部振替はfreee APIに安全な公式書込み手段が無いため、承認しても自動書込みは行われない（blockedのまま人が判断する）。
      </p>

      {SECTION_ORDER.map(({ key, label }) => {
        const rows = overview.findingsByType[key] ?? [];
        if (rows.length === 0 && key !== "balance_delta" && key !== "officer_compensation_unreconciled") return null;
        return (
          <div key={key}>
            <h3 className="mb-1.5 text-[12px] font-semibold text-muted-foreground">
              {label} <span className="font-normal">({rows.length})</span>
            </h3>
            <FindingTable rows={rows} onReview={onReview} busyId={busyId} />
          </div>
        );
      })}

      <div>
        <h3 className="mb-1.5 text-[12px] font-semibold text-muted-foreground">run履歴</h3>
        <RunHistoryTable runs={overview.runHistory} />
      </div>
    </div>
  );
}
