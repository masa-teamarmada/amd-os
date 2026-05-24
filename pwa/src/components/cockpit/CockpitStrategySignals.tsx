"use client";

/**
 * CockpitStrategySignals — PJ cockpit の col2 (経営・事業シグナル) セクション。
 *
 * まさ #14 (2026-05-24) 確定:
 *  - 旧 3 分類 (外部環境 / 経営判断 / 事業進捗) は分類自体がズレていた。
 *    (例: 「リアクター特許出願完了」が「外部環境変化」に入ってた)
 *  - 新 4 分類:
 *      🏛 経営全般   = management_decision / strategic_pivot / funding / next_move (violet)
 *      🚀 事業開発   = business_progress / commercial_progress / partnership (emerald)
 *      🔬 技術開発   = ip_regulatory (自社特許・規制対応 = 技術側) (sky)
 *      🌐 外部環境   = risk その他 (Atlas へ誘導、cockpit には表示しない)
 *  - セクション分けは廃止。時間軸 (signal_date desc) で混ぜて表示し、
 *    各カードの左ボーダー色で分類を一目で判別できるようにする。
 *  - 「外部環境の変化」シグナルは Atlas (= 外部マクロシグナル正本) を見るべきなので、
 *    header に「🌐 外部環境変化は Atlas → 」リンクで誘導する。
 *
 * まさ #11 (2026-05-24) 継続:
 *  - 各カードに「⚠️ つくよみに修正依頼」ボタン → /api/notifications/feedback。
 */

import Link from "next/link";
import { useState } from "react";
import type { ProjectStrategySignal } from "@/lib/supabase-data";

const TYPE_LABEL: Record<string, string> = {
  management_decision: "方針決定",
  business_progress: "事業進捗",
  strategic_pivot: "戦略転換",
  commercial_progress: "商談/売上",
  partnership: "提携",
  funding: "資金",
  ip_regulatory: "外部規制",     // = 他国規制動向 / 競合の知財動向 (= 外部環境)
  tech_progress: "自社知財/技術", // = 自社特許出願 / 技術スタック進捗 (= 技術開発)
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

// 4 分類 (まさ #14 2026-05-24 確定)
type CategoryKey = "management" | "business" | "tech" | "external";
const CATEGORY_OF_TYPE: Record<string, CategoryKey> = {
  // 🏛 経営全般
  management_decision: "management",
  strategic_pivot: "management",
  funding: "management",
  next_move: "management",
  // 🚀 事業開発
  business_progress: "business",
  commercial_progress: "business",
  partnership: "business",
  // 🔬 技術開発 (= 自社特許 / 技術スタック進捗)
  tech_progress: "tech",
  // 🌐 外部環境 (Atlas へ誘導、cockpit には表示しない)
  // ip_regulatory = 他国規制動向 / 競合の知財動向。risk も外部要因。
  ip_regulatory: "external",
  risk: "external",
};

const CATEGORY_META: Record<CategoryKey, {
  label: string;
  emoji: string;
  // カード左ボーダー色 (= 一目で分類を判別)
  cardBorderClass: string;
  // 凡例 chip 用 色
  legendClass: string;
}> = {
  management: {
    label: "経営全般",
    emoji: "🏛",
    cardBorderClass: "border-l-4 border-l-violet-400",
    legendClass: "bg-violet-100 text-violet-900 border border-violet-300",
  },
  business: {
    label: "事業開発",
    emoji: "🚀",
    cardBorderClass: "border-l-4 border-l-emerald-400",
    legendClass: "bg-emerald-100 text-emerald-900 border border-emerald-300",
  },
  tech: {
    label: "技術開発",
    emoji: "🔬",
    cardBorderClass: "border-l-4 border-l-sky-400",
    legendClass: "bg-sky-100 text-sky-900 border border-sky-300",
  },
  external: {
    label: "外部環境",
    emoji: "🌐",
    cardBorderClass: "border-l-4 border-l-amber-400",
    legendClass: "bg-amber-100 text-amber-900 border border-amber-300",
  },
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

export function CockpitStrategySignals({ signals, projectId }: { signals: ProjectStrategySignal[]; projectId: string }) {
  // 外部環境 (risk = Atlas へ誘導) は cockpit カードでは表示しない
  const visibleSignals = signals.filter((signal) => {
    if (signal.status === "rejected" || signal.status === "archived") return false;
    const cat = CATEGORY_OF_TYPE[signal.signalType] ?? "business";
    return cat !== "external";
  });
  const externalCount = signals.filter((s) =>
    (CATEGORY_OF_TYPE[s.signalType] ?? "business") === "external" &&
    s.status !== "rejected" && s.status !== "archived"
  ).length;
  // 時間軸 (signal_date desc) で並べる — 分類セクションには分けない
  const sorted = [...visibleSignals].sort((a, b) =>
    (b.signalDate || "").localeCompare(a.signalDate || "")
  );

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">経営・事業シグナル</h2>
        <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {sorted.length}件
        </span>
      </div>

      {/* 4 色凡例 + Atlas リンク */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5 bg-muted/30">
        {(["management", "business", "tech"] as CategoryKey[]).map((k) => {
          const meta = CATEGORY_META[k];
          return (
            <span key={k} className={`text-[10px] rounded px-1.5 py-0.5 ${meta.legendClass}`}>
              {meta.emoji} {meta.label}
            </span>
          );
        })}
        <Link
          href={`/atlas?projectId=${encodeURIComponent(projectId)}`}
          className={`text-[10px] rounded px-1.5 py-0.5 hover:underline ${CATEGORY_META.external.legendClass}`}
          title="外部環境の変化 (規制・競合・マクロ等) は Atlas が正本"
        >
          🌐 外部環境変化は Atlas → {externalCount > 0 ? `(${externalCount}件 archived)` : ""}
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="px-3 py-4 text-[12px] text-muted-foreground">
          まだシグナルなし。外部環境変化は Atlas へ。
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map((signal) => {
            const cat = CATEGORY_OF_TYPE[signal.signalType] ?? "business";
            const meta = CATEGORY_META[cat];
            return (
              <StrategySignalRow
                key={signal.signalId}
                signal={signal}
                projectId={projectId}
                categoryBorder={meta.cardBorderClass}
                categoryEmoji={meta.emoji}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function StrategySignalRow({ signal, projectId, categoryBorder, categoryEmoji }: { signal: ProjectStrategySignal; projectId: string; categoryBorder: string; categoryEmoji: string }) {
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
        <span className="text-[12px]" title="カテゴリ">{categoryEmoji}</span>
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
            placeholder="例: このシグナルは「外部環境変化」じゃなくて「技術開発」 (= 自社特許出願) に分類すべき"
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
