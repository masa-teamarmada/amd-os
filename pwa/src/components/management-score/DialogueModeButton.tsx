"use client";

import { useState } from "react";

/**
 * まさえいMTG モード (= L2 ⑨ dialogue) の入口 + Modal
 *
 * /management-score ヘッダから起動。 p00 (= 会社全体) の project_strategy_signals
 * status='candidate' を 1 件ずつ提示し、 まさが「進める / 不採用 / 保留 / 編集」 を判断。
 * 完了時に POST /api/dialogue-meeting で議論ログを保存。
 *
 * 詳細仕様: pwa/manual/4-x まさえいMTG (= 28 章 / 39 章接続)
 */

export type DialogueCandidate = {
  signal_id: string;
  project_id: string;
  ym: string;
  signal_type: string;
  impact_level: string;
  decision_state: string;
  title: string;
  summary: string;
  signal_date: string | null;
  confidence: number | null;
  status: string;
  created_by: string | null;
};

type DecisionLog = {
  signal_id: string;
  action: "confirm" | "reject" | "update" | "skip";
  title: string;
  note?: string;
  timestamp: string;
};

export function DialogueModeButton({ candidates }: { candidates: DialogueCandidate[] }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState<DecisionLog[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const current = candidates[idx];
  const remaining = candidates.length - idx;
  const isDone = idx >= candidates.length;

  async function applyDecision(action: "confirm" | "reject" | "skip", currentSignal: DialogueCandidate) {
    setSubmitting(true);
    setError(null);
    try {
      if (action !== "skip") {
        const body: Record<string, unknown> = {
          action: action === "confirm" ? "confirm" : "reject",
          signal_id: currentSignal.signal_id,
        };
        if (action === "confirm") body.decision_state = "decided";
        const res = await fetch("/api/strategy-signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      }
      setLog((cur) => [
        ...cur,
        {
          signal_id: currentSignal.signal_id,
          action,
          title: currentSignal.title,
          timestamp: new Date().toISOString(),
        },
      ]);
      setIdx((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveDialogueLog() {
    if (log.length === 0) {
      setSaveResult("議論ログ無し、 保存スキップ");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const confirmedIds = log.filter((l) => l.action === "confirm").map((l) => l.signal_id);
      const rejectedIds = log.filter((l) => l.action === "reject").map((l) => l.signal_id);
      const decided = log
        .filter((l) => l.action === "confirm")
        .map((l) => `${l.title} (= 提案)`);
      const rejected = log
        .filter((l) => l.action === "reject")
        .map((l) => l.title);
      const summaryShort =
        `まさえいMTG セッション: ${confirmedIds.length} 件 confirm / ${rejectedIds.length} 件 reject。 ` +
        (notes ? `補足: ${notes}` : "");
      const res = await fetch("/api/dialogue-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: "p00",
          summary_short: summaryShort,
          decided,
          progress: [],
          next_actions: [],
          risks: rejected.length > 0 ? rejected.map((r) => `不採用: ${r}`) : [],
          related_signal_ids: [...confirmedIds, ...rejectedIds],
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const data = await res.json();
      setSaveResult(`保存完了 (meeting_id: ${data?.meeting_id ?? "unknown"})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20"
        title={`p00 (会社全体) candidate ${candidates.length} 件`}
      >
        まさえいMTG モード ▸ {candidates.length > 0 && <span className="rounded bg-primary/20 px-1 text-[10px]">{candidates.length}</span>}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">まさえいMTG モード (= p00 経営シグナル)</h2>
            <p className="text-[11px] text-muted-foreground">
              {isDone ? `全 ${candidates.length} 件レビュー完了` : `${idx + 1} / ${candidates.length} 件目 (残 ${remaining})`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ✕ 閉じる
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {candidates.length === 0 && (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              p00 (= 会社全体) の status=&apos;candidate&apos; signals が無い。
              <br />
              先に <code className="rounded bg-muted px-1">/api/cron/graduation-detection</code> や Codex automation で candidate を生成する。
            </div>
          )}

          {current && !isDone && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-5 items-center rounded-full border bg-violet-50 px-2 text-[11px] font-medium text-violet-700">
                  {current.signal_type}
                </span>
                <span className="inline-flex h-5 items-center rounded-full border bg-amber-50 px-2 text-[11px] font-medium text-amber-700">
                  impact: {current.impact_level}
                </span>
                <span className="inline-flex h-5 items-center rounded-full border bg-slate-50 px-2 text-[11px] font-medium text-slate-700">
                  {current.decision_state}
                </span>
                {current.signal_date && (
                  <span className="text-[11px] text-muted-foreground">{current.signal_date}</span>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  confidence {current.confidence != null ? `${Math.round(Number(current.confidence) * 100)}%` : "-"}
                </span>
              </div>
              <h3 className="text-sm font-semibold leading-snug">{current.title}</h3>
              <p className="text-sm leading-relaxed text-foreground/90">{current.summary}</p>
              {current.created_by && (
                <p className="text-[11px] text-muted-foreground">
                  作成者: <code className="rounded bg-muted px-1">{current.created_by}</code>
                </p>
              )}
            </div>
          )}

          {isDone && (
            <div className="space-y-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <p className="font-semibold text-emerald-900">全 {candidates.length} 件レビュー完了。</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-emerald-800">
                  <li>confirm: {log.filter((l) => l.action === "confirm").length} 件</li>
                  <li>reject: {log.filter((l) => l.action === "reject").length} 件</li>
                  <li>skip: {log.filter((l) => l.action === "skip").length} 件</li>
                </ul>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">議論ログ summary 補足 (任意)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="議論の背景 / 何を話したか / 次の一手 など"
                />
              </div>
              <button
                type="button"
                onClick={saveDialogueLog}
                disabled={submitting || saveResult != null}
                className="w-full rounded-md border border-primary bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "保存中..." : saveResult || "議論ログを保存 (= /api/dialogue-meeting)"}
              </button>
              {saveResult && (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{saveResult}</p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              エラー: {error}
            </p>
          )}
        </div>

        {current && !isDone && (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => current && applyDecision("confirm", current)}
              disabled={submitting}
              className="flex-1 rounded-md border border-emerald-400 bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              進める (confirm)
            </button>
            <button
              type="button"
              onClick={() => current && applyDecision("reject", current)}
              disabled={submitting}
              className="flex-1 rounded-md border border-red-400 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              不採用 (reject)
            </button>
            <button
              type="button"
              onClick={() => current && applyDecision("skip", current)}
              disabled={submitting}
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              保留 (skip)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
