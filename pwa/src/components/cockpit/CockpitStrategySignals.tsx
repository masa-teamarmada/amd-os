"use client";

import type { ProjectStrategySignal } from "@/lib/supabase-data";

const TYPE_LABEL: Record<string, string> = {
  management_decision: "方針決定",
  business_progress: "事業進捗",
  strategic_pivot: "戦略転換",
  commercial_progress: "商談/売上",
  partnership: "提携",
  funding: "資金",
  ip_regulatory: "知財/規制",
  risk: "リスク",
  next_move: "次の一手",
};

const IMPACT_CLASS: Record<string, string> = {
  low: "border-zinc-200 bg-zinc-50 text-zinc-600",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  high: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-red-200 bg-red-50 text-red-800",
};

const STATE_LABEL: Record<string, string> = {
  observed: "観測",
  proposed: "提案",
  decided: "決定",
  executing: "実行中",
  revised: "修正",
};

function formatDate(value: string | null) {
  if (!value) return "日付未設定";
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date);
}

function sourceSummary(refs: unknown[]) {
  return refs
    .slice(0, 3)
    .map((item) => {
      const ref = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return [
        ref.source || ref.type || "source",
        ref.date || ref.item_date || "",
        ref.title || ref.snippet || ref.summary || "",
      ].filter(Boolean).join(" / ");
    })
    .filter(Boolean);
}

export function CockpitStrategySignals({ signals }: { signals: ProjectStrategySignal[] }) {
  const activeSignals = signals.filter((signal) => signal.status !== "rejected" && signal.status !== "archived");

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">経営・事業シグナル</h2>
        <span className="text-[11px] text-muted-foreground">
          重要方針・事業進捗・リスク
        </span>
        <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {activeSignals.length}件
        </span>
      </div>

      {activeSignals.length === 0 ? (
        <div className="px-3 py-4 text-[12px] text-muted-foreground">
          まだ重要シグナルはない
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activeSignals.map((signal) => {
            const refs = sourceSummary(signal.sourceRefs);
            const impactClass = IMPACT_CLASS[signal.impactLevel] ?? IMPACT_CLASS.medium;
            return (
              <article key={signal.signalId} className="px-3 py-2.5">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {formatDate(signal.signalDate)}
                  </span>
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px]">
                    {TYPE_LABEL[signal.signalType] ?? signal.signalType}
                  </span>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${impactClass}`}>
                    {signal.impactLevel}
                  </span>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {STATE_LABEL[signal.decisionState] ?? signal.decisionState}
                  </span>
                  {signal.status === "candidate" && (
                    <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                      候補
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[12px] font-semibold leading-snug">{signal.title}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {signal.summary}
                </p>
                {refs.length > 0 && (
                  <details className="mt-1.5 text-[10px] text-muted-foreground">
                    <summary className="cursor-pointer select-none">根拠 {signal.sourceRefs.length}件</summary>
                    <div className="mt-1 space-y-1">
                      {refs.map((ref, index) => (
                        <div key={`${signal.signalId}:ref:${index}`} className="rounded bg-muted/40 px-2 py-1">
                          {ref}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
