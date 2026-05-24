"use client";

/**
 * CockpitStrategySignals — PJ cockpit の col2 (経営・事業シグナル) セクション。
 *
 * まさ #12 (2026-05-24) 確定:
 *  9 種類の signal_type を 3 カテゴリにグルーピングして、ぱっと見で
 *  「外部環境変化 / 経営判断 / 事業進捗」が分かるようにする。
 *
 * まさ #11 (2026-05-24) 確定:
 *  各 signal に「⚠️ つくよみに修正依頼」ボタンを置き、
 *  既存 `/api/notifications/feedback` (l2_kind='project_strategy_signal') 経由で
 *  feedback を保存 + tsukuyomi_learnings に学習させる。
 */

import { useState } from "react";
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

// signal_type の 3 分類 (まさ #12 2026-05-24)
type CategoryKey = "external" | "management" | "business";
const CATEGORY_OF_TYPE: Record<string, CategoryKey> = {
  ip_regulatory: "external",
  risk: "external",
  management_decision: "management",
  strategic_pivot: "management",
  next_move: "management",
  business_progress: "business",
  commercial_progress: "business",
  partnership: "business",
  funding: "business",
};
const CATEGORY_META: Record<CategoryKey, {
  label: string;
  emoji: string;
  // 段落 header の色
  headerClass: string;
  // signal card の左ボーダー色 (= 視認用アクセント)
  cardBorderClass: string;
  hint: string;
}> = {
  external: {
    label: "外部環境の変化",
    emoji: "🌐",
    headerClass: "bg-sky-50 border-sky-300 text-sky-900",
    cardBorderClass: "border-l-4 border-l-sky-400",
    hint: "規制/知財/競合/マクロなど、外から飛び込んできた変化やリスク",
  },
  management: {
    label: "経営判断",
    emoji: "🧭",
    headerClass: "bg-violet-50 border-violet-300 text-violet-900",
    cardBorderClass: "border-l-4 border-l-violet-400",
    hint: "PJの進路を決める方針・戦略転換・次の一手 (= まさえいMTGで議論する候補)",
  },
  business: {
    label: "事業進捗",
    emoji: "📈",
    headerClass: "bg-emerald-50 border-emerald-300 text-emerald-900",
    cardBorderClass: "border-l-4 border-l-emerald-400",
    hint: "提携/商談/資金/PJ実装などの実進捗",
  },
};
const CATEGORY_ORDER: CategoryKey[] = ["external", "management", "business"];

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

export function CockpitStrategySignals({ signals, projectId }: { signals: ProjectStrategySignal[]; projectId: string }) {
  const activeSignals = signals.filter((signal) => signal.status !== "rejected" && signal.status !== "archived");

  // 3 カテゴリにグルーピング
  const grouped: Record<CategoryKey, ProjectStrategySignal[]> = { external: [], management: [], business: [] };
  for (const s of activeSignals) {
    const cat = CATEGORY_OF_TYPE[s.signalType] ?? "business";
    grouped[cat].push(s);
  }
  // 各カテゴリ内は signal_date desc
  for (const k of CATEGORY_ORDER) {
    grouped[k].sort((a, b) => (b.signalDate || "").localeCompare(a.signalDate || ""));
  }

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">経営・事業シグナル</h2>
        <span className="text-[11px] text-muted-foreground">
          外部環境 / 経営判断 / 事業進捗
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
        <div className="flex flex-col">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat];
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="border-b border-border last:border-b-0">
                <header className={`flex flex-wrap items-baseline gap-2 border-b px-3 py-1.5 ${meta.headerClass}`}>
                  <span className="text-[13px] font-bold">{meta.emoji} {meta.label}</span>
                  <span className="text-[10px] opacity-80">{meta.hint}</span>
                  <span className="ml-auto text-[10px] font-mono tabular-nums">{items.length}件</span>
                </header>
                <div className="divide-y divide-border">
                  {items.map((signal) => (
                    <StrategySignalRow
                      key={signal.signalId}
                      signal={signal}
                      projectId={projectId}
                      categoryBorder={meta.cardBorderClass}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StrategySignalRow({ signal, projectId, categoryBorder }: { signal: ProjectStrategySignal; projectId: string; categoryBorder: string }) {
  const refs = sourceSummary(signal.sourceRefs);
  const impactClass = IMPACT_CLASS[signal.impactLevel] ?? IMPACT_CLASS.medium;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentNote, setSentNote] = useState<string | null>(null);

  async function submitFeedback() {
    const text = feedbackText.trim();
    if (!text) return;
    setSending(true);
    setSentNote(null);
    try {
      const res = await fetch("/api/notifications/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          l2_kind: "project_strategy_signal",
          target_id: projectId,
          scope_key: signal.ym ? `${signal.ym}:strategy:${(signal.sourceHash || "").slice(0, 12) || signal.signalId.slice(0, 12)}` : "global",
          feedback_text: text,
          action: "comment",
        }),
      });
      if (res.ok) {
        setSentNote("✓ 修正依頼を保存しました (tsukuyomi 学習リストへ追加)");
        setFeedbackText("");
        setTimeout(() => { setFeedbackOpen(false); setSentNote(null); }, 1800);
      } else {
        const j = await res.json().catch(() => ({}));
        setSentNote(`✕ 送信失敗: ${j.error || res.status}`);
      }
    } catch (e) {
      setSentNote(`✕ 送信失敗: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <article className={`pl-3 pr-3 py-2.5 ${categoryBorder}`}>
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
        <button
          type="button"
          onClick={() => setFeedbackOpen((v) => !v)}
          className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          title="つくよみ (LLM) にこの抽出への修正依頼を送る"
        >
          ⚠️ つくよみに修正依頼
        </button>
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
      {feedbackOpen && (
        <div className="mt-2 rounded border border-amber-200 bg-amber-50/60 p-2">
          <div className="text-[10px] text-amber-900 mb-1">
            つくよみ (LLM 抽出) への修正依頼。次回以降の抽出に反映され、`tsukuyomi_learnings` に蓄積されます。
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="例: 「大阪ガスケミカル」じゃなくて「ダイキアクシス」が正解。誤抽出を直して。"
            className="w-full rounded border border-amber-300 bg-white p-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-400"
            rows={3}
            disabled={sending}
          />
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={submitFeedback}
              disabled={sending || !feedbackText.trim()}
              className="rounded bg-amber-600 px-2 py-0.5 text-[10px] text-white disabled:opacity-40"
            >
              {sending ? "送信中..." : "送信"}
            </button>
            <button
              type="button"
              onClick={() => { setFeedbackOpen(false); setFeedbackText(""); setSentNote(null); }}
              className="rounded border border-amber-300 px-2 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100"
            >
              キャンセル
            </button>
            {sentNote && <span className="text-[10px] text-amber-900">{sentNote}</span>}
          </div>
        </div>
      )}
    </article>
  );
}
