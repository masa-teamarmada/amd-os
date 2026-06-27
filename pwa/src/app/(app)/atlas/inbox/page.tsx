"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  fetchAtlasSignals,
  reviewAtlasSignal,
  acceptAllInboxSignals,
  type AtlasSignal,
} from "@/lib/supabase-data";
import { tagColorClass } from "@/lib/atlas-tags";

const importanceBadge: Record<string, string> = {
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  medium: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  low: "bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500",
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type SourceFilter = "all" | "news" | "policy";

export default function AtlasInboxPage() {
  const [signals, setSignals] = useState<AtlasSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  useEffect(() => {
    fetchAtlasSignals("inbox").then((sigs) => {
      setSignals(sigs);
      setLoading(false);
    });
  }, []);

  const visibleSignals = signals.filter((s) => {
    if (sourceFilter === "all") return true;
    if (sourceFilter === "policy") return s.source_type === "policy";
    if (sourceFilter === "news") return s.source_type !== "policy";
    return true;
  });

  const [bulkProcessing, setBulkProcessing] = useState(false);

  const review = async (signal: AtlasSignal, action: "accepted" | "held" | "rejected") => {
    setProcessingId(signal.id);
    await reviewAtlasSignal(signal.id, action);
    setSignals((prev) => prev.filter((s) => s.id !== signal.id));
    setProcessingId(null);
  };

  const acceptAll = async () => {
    if (signals.length === 0) return;
    if (!confirm(`Inbox の ${signals.length} 件すべてを Accept する？`)) return;
    setBulkProcessing(true);
    const r = await acceptAllInboxSignals();
    if (r.ok) {
      setSignals([]);
    } else {
      alert("一括Accept に失敗。ログインしてるか確認して。");
    }
    setBulkProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2.75rem)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/atlas" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Atlas
          </Link>
          <h1 className="text-lg font-bold mt-1">Atlas Inbox</h1>
          <p className="text-xs text-muted-foreground">
            {signals.length > 0
              ? `${visibleSignals.length}/${signals.length} 件表示中`
              : "キューは空です"}
          </p>
          {signals.length > 0 && (
            <div className="flex gap-1 mt-2">
              {(["all", "news", "policy"] as SourceFilter[]).map((f) => {
                const count =
                  f === "all"
                    ? signals.length
                    : f === "policy"
                      ? signals.filter((s) => s.source_type === "policy").length
                      : signals.filter((s) => s.source_type !== "policy").length;
                return (
                  <button
                    key={f}
                    onClick={() => setSourceFilter(f)}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                      sourceFilter === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:bg-accent"
                    )}
                  >
                    {f === "all" ? "全部" : f === "news" ? "ニュース" : "政策"} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {signals.length > 0 && (
            <button
              onClick={acceptAll}
              disabled={bulkProcessing}
              className="text-xs px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors font-medium"
            >
              {bulkProcessing ? "処理中…" : `✓ 全件 Accept (${signals.length})`}
            </button>
          )}
          <Link
            href="/atlas/inbox/submit"
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            + 投入
          </Link>
        </div>
      </div>

      {/* Signal cards */}
      {signals.length === 0 ? (
        <div className="text-center py-20 space-y-2">
          <p className="text-2xl">✓</p>
          <p className="text-sm text-muted-foreground">全件審査完了</p>
          <p className="text-xs text-muted-foreground/60">新しいシグナルはえいみが投入します</p>
        </div>
      ) : visibleSignals.length === 0 ? (
        <div className="text-center py-20 space-y-2">
          <p className="text-sm text-muted-foreground">該当するシグナルなし</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSignals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              isProcessing={processingId === signal.id}
              onAccept={() => review(signal, "accepted")}
              onHold={() => review(signal, "held")}
              onReject={() => review(signal, "rejected")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalCard({
  signal,
  isProcessing,
  onAccept,
  onHold,
  onReject,
}: {
  signal: AtlasSignal;
  isProcessing: boolean;
  onAccept: () => void;
  onHold: () => void;
  onReject: () => void;
}) {
  return (
    <div className={cn(
      "p-4 rounded-xl border bg-card space-y-3 transition-opacity",
      isProcessing && "opacity-40 pointer-events-none"
    )}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <span className={cn(
          "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5",
          importanceBadge[signal.importance]
        )}>
          {signal.importance.toUpperCase()}
        </span>
        {signal.source_type === "policy" && (
          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            📋 {signal.metadata?.ministry || "政策"}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">{signal.title}</p>
          {signal.domain && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{signal.domain}</p>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          {formatDate(signal.submitted_at)}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-muted-foreground leading-relaxed">{signal.content}</p>

      {/* Source URL */}
      {signal.source_url && (
        <a
          href={signal.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors truncate max-w-full"
        >
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="truncate">{signal.source_url}</span>
        </a>
      )}

      {/* Tags */}
      {signal.suggested_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {signal.suggested_tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "text-sm font-medium px-2 py-0.5 rounded-full",
                tagColorClass(tag)
              )}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onAccept}
          className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
        >
          ✓ Accept
        </button>
        <button
          onClick={onHold}
          className="flex-1 py-2 rounded-lg border border-border hover:bg-accent text-xs font-medium transition-colors text-muted-foreground"
        >
          ⏸ Hold
        </button>
        <button
          onClick={onReject}
          className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-900/20 text-xs font-medium transition-colors text-muted-foreground"
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
}
