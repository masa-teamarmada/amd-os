"use client";

/**
 * CockpitStrategySignals — PJ cockpit の col2 (経営ハイライト) セクション。
 *
 * まさ #14 (2026-05-24) 確定:
 *  - 旧 3 分類 (外部環境 / 経営判断 / 事業進捗) は分類自体がズレていた。
 *    (例: 「リアクター特許出願完了」が「外部環境変化」に入ってた)
 *  - 新 4 分類:
 *      🏛 経営全般   = management_decision / strategic_pivot / funding / next_move (violet)
 *      🚀 事業開発   = business_progress / commercial_progress / partnership (emerald)
 *      🔬 技術開発   = tech_progress (自社特許・技術スタック進捗) (sky)
 *      🌐 外部環境   = ip_regulatory (他国規制動向) / risk (amber)
 *  - セクション分けは廃止。時間軸 (signal_date desc) で混ぜて表示し、
 *    各カードの左ボーダー色で分類を一目で判別できるようにする。
 *
 * まさ #14-4th (2026-05-24 復活): 外部環境カテゴリも cockpit に表示する。
 *  - 当初「Atlas に誘導、cockpit には出さない」設計で external を除外したが、
 *    `中国レアアース → SX 追い風` のような PJ にとって重要な外部シグナルが消えた。
 *  - 4 分類すべて cockpit カードに表示。Atlas リンクは header に残す
 *    (= 「外部マクロシグナル一覧の正本は Atlas」誘導は引き続き有効)。
 *
 * まさ #11 (2026-05-24) 継続:
 *  - 各カードに「⚠️ つくよみに修正依頼」ボタン → /api/notifications/feedback。
 */

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import type { ProjectStrategySignal } from "@/lib/supabase-data";
import { Hint } from "@/components/ui/Hint";

// まさ #34 短期 2026-05-25: 経営ハイライト各カード下に「過去のつくよみ修正依頼」を表示する。
// 親 component で 1 回 fetch して signal_id ごとに scope_key 前方一致で filter する設計。
type FeedbackItem = {
  feedback_id: string;
  l2_kind: string;
  target_id: string;
  scope_key: string;
  feedback_text: string;
  status: string;
  created_by: string | null;
  created_at: string;
  applied_count: number;
  last_applied_at: string | null;
};

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

const POLARITY_META: Record<string, { emoji: string; label: string; className: string }> = {
  breakthrough: {
    emoji: "🎉",
    label: "大進捗",
    className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  },
  forward: {
    emoji: "✨",
    label: "前進",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  pivot: {
    emoji: "🔄",
    label: "方針転換",
    className: "border-violet-200 bg-violet-50 text-violet-800",
  },
  risk: {
    emoji: "⚠️",
    label: "リスク",
    className: "border-red-200 bg-red-50 text-red-800",
  },
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
  // 🌐 外部環境 (= 他国規制動向 / 競合動向 / マクロ要因。Atlas が一覧正本、cockpit にも表示)
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
  // 4 分類すべて表示 (まさ #14-4th 2026-05-24)。rejected / archived のみ除外。
  const visibleSignals = signals.filter((signal) => {
    if (signal.status === "rejected" || signal.status === "archived") return false;
    return true;
  });
  // 時間軸 (signal_date desc) で並べる — 分類セクションには分けない
  const sorted = [...visibleSignals].sort((a, b) =>
    (b.signalDate || "").localeCompare(a.signalDate || "")
  );

  // まさ #34 短期 2026-05-25: 過去のつくよみ修正依頼を 1 回 fetch
  // #34 対話型 2026-05-25 #71: confirm 後にも refetch するため tick state を増やす
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackTick, setFeedbackTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notifications/feedback?l2_kind=project_strategy_signal&target_id=${encodeURIComponent(projectId)}&limit=300`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok || !j.ok) {
          setFeedbackError(j.error || `HTTP ${r.status}`);
          return;
        }
        setFeedbacks(j.feedbacks || []);
      })
      .catch((e) => { if (!cancelled) setFeedbackError(e instanceof Error ? e.message : "fetch error"); });
    return () => { cancelled = true; };
  }, [projectId, feedbackTick]);

  // signal 1 件あたりの scope_key 前方一致パターン:
  //   signal の scope_key は POST 側で `${signal.ym}:strategy:${(signal.sourceHash || "").slice(0, 12) || signal.signalId.slice(0, 12)}` と書かれる
  //   → 各 signal の対応する hash prefix で filter する
  // ym がない signal (= global) は scope_key='global' か空文字想定
  const feedbacksBySignalId = useMemo(() => {
    const map: Record<string, FeedbackItem[]> = {};
    for (const signal of sorted) {
      const hashKey = (signal.sourceHash || "").slice(0, 12) || signal.signalId.slice(0, 12);
      const prefix = signal.ym ? `${signal.ym}:strategy:${hashKey}` : "global";
      map[signal.signalId] = feedbacks.filter((f) => f.scope_key === prefix || f.scope_key.startsWith(prefix));
    }
    return map;
  }, [sorted, feedbacks]);

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">経営ハイライト</h2>
        <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {sorted.length}件
        </span>
      </div>

      {/* 4 色凡例 + Atlas リンク (= 外部マクロシグナル一覧の正本誘導) */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5 bg-muted/30">
        {(["management", "business", "tech", "external"] as CategoryKey[]).map((k) => {
          const meta = CATEGORY_META[k];
          return (
            <span key={k} className={`text-[10px] rounded px-1.5 py-0.5 ${meta.legendClass}`}>
              {meta.emoji} {meta.label}
            </span>
          );
        })}
        <Link
          href={`/atlas?projectId=${encodeURIComponent(projectId)}`}
          className="ml-auto text-[10px] rounded px-1.5 py-0.5 border border-border bg-background text-muted-foreground hover:bg-muted hover:underline"
          title="外部マクロシグナル一覧の正本は Atlas"
        >
          Atlas で全マクロ ↗
        </Link>
      </div>

      {feedbackError && (
        <div className="px-3 py-1.5 text-[10px] text-amber-700 border-b border-border bg-amber-50/40">
          ⚠️ 修正依頼履歴の取得に失敗: {feedbackError}
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="px-3 py-4 text-[12px] text-muted-foreground">
          まだシグナルなし。
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
                pastFeedbacks={feedbacksBySignalId[signal.signalId] || []}
                onConfirmed={() => setFeedbackTick((t) => t + 1)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

type ProposedSignal = {
  title: string;
  summary: string;
  impact_level: string;
  signal_type: string;
  polarity: string | null;
  score_impact_summary: string | null;
};

type DialogMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; proposed: ProposedSignal; reasoning: string; applied_feedback_summary: string };

type DialogStep = "input" | "loading" | "preview" | "addComment";

function StrategySignalRow({
  signal,
  projectId,
  categoryBorder,
  categoryEmoji,
  pastFeedbacks,
  onConfirmed,
}: {
  signal: ProjectStrategySignal;
  projectId: string;
  categoryBorder: string;
  categoryEmoji: string;
  pastFeedbacks: FeedbackItem[];
  onConfirmed?: () => void;
}) {
  const refs = sourceSummary(signal.sourceRefs);
  const impactClass = IMPACT_CLASS[signal.impactLevel] ?? IMPACT_CLASS.medium;
  const polarity = signal.polarity ? POLARITY_META[signal.polarity] : null;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [dialogStep, setDialogStep] = useState<DialogStep>("input");
  const [conversation, setConversation] = useState<DialogMessage[]>([]);
  const [proposed, setProposed] = useState<ProposedSignal | null>(null);
  const [current, setCurrent] = useState<ProposedSignal | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [appliedSummary, setAppliedSummary] = useState("");
  const [additionalText, setAdditionalText] = useState("");
  const [errorNote, setErrorNote] = useState<string | null>(null);

  const scopeKey = signal.ym
    ? `${signal.ym}:strategy:${(signal.sourceHash || "").slice(0, 12) || signal.signalId.slice(0, 12)}`
    : "global";

  function resetDialog() {
    setFeedbackOpen(false);
    setFeedbackText("");
    setDialogStep("input");
    setConversation([]);
    setProposed(null);
    setCurrent(null);
    setReasoning("");
    setAppliedSummary("");
    setAdditionalText("");
    setErrorNote(null);
  }

  async function startDialog() {
    const text = feedbackText.trim();
    if (!text) return;
    setDialogStep("loading");
    setErrorNote(null);
    try {
      const res = await fetch("/api/notifications/feedback/dialog/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          l2_kind: "project_strategy_signal",
          target_id: projectId,
          scope_key: scopeKey,
          initial_feedback: text,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setErrorNote(`✕ 提案生成失敗: ${j.error || res.status}`);
        setDialogStep("input");
        return;
      }
      setProposed(j.proposed as ProposedSignal);
      setCurrent(j.current as ProposedSignal);
      setReasoning(String(j.reasoning || ""));
      setAppliedSummary(String(j.applied_feedback_summary || ""));
      setConversation(j.conversation as DialogMessage[]);
      setDialogStep("preview");
    } catch (e) {
      setErrorNote(`✕ 提案生成失敗: ${e instanceof Error ? e.message : "unknown"}`);
      setDialogStep("input");
    }
  }

  async function refineDialog(opts: { additionalHint?: string; additionalFeedback?: string }) {
    setDialogStep("loading");
    setErrorNote(null);
    try {
      const res = await fetch("/api/notifications/feedback/dialog/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          l2_kind: "project_strategy_signal",
          target_id: projectId,
          scope_key: scopeKey,
          conversation,
          additional_hint: opts.additionalHint ?? "",
          additional_feedback: opts.additionalFeedback ?? "",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setErrorNote(`✕ やり直し失敗: ${j.error || res.status}`);
        setDialogStep("preview");
        return;
      }
      setProposed(j.proposed as ProposedSignal);
      setReasoning(String(j.reasoning || ""));
      setAppliedSummary(String(j.applied_feedback_summary || ""));
      setConversation(j.conversation as DialogMessage[]);
      setAdditionalText("");
      setDialogStep("preview");
    } catch (e) {
      setErrorNote(`✕ やり直し失敗: ${e instanceof Error ? e.message : "unknown"}`);
      setDialogStep("preview");
    }
  }

  async function confirmDialog() {
    if (!proposed) return;
    setDialogStep("loading");
    setErrorNote(null);
    try {
      const res = await fetch("/api/notifications/feedback/dialog/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          l2_kind: "project_strategy_signal",
          target_id: projectId,
          scope_key: scopeKey,
          conversation,
          proposed,
          applied_feedback_summary: appliedSummary,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setErrorNote(`✕ 確定失敗: ${j.error || res.status}`);
        setDialogStep("preview");
        return;
      }
      onConfirmed?.();
      resetDialog();
    } catch (e) {
      setErrorNote(`✕ 確定失敗: ${e instanceof Error ? e.message : "unknown"}`);
      setDialogStep("preview");
    }
  }

  return (
    <article className={`pl-3 pr-3 py-2.5 ${categoryBorder}`}>
      <div className="flex flex-wrap items-start gap-2">
        <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {formatDate(signal.signalDate)}
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] ${polarity?.className ?? "border-border bg-muted/40 text-muted-foreground"}`}
          title={polarity ? `polarity: ${polarity.label}` : "カテゴリ"}
        >
          {polarity ? `${polarity.emoji} ${polarity.label}` : categoryEmoji}
        </span>
        <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px]">
          {TYPE_LABEL[signal.signalType] ?? signal.signalType}
        </span>
        <span className="inline-flex items-center gap-0.5">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] ${impactClass}`}>
            {signal.impactLevel}
          </span>
          <Hint id="cockpit.strategy-signals.impact-chip" />
        </span>
        {signal.status === "candidate" && (
          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
            未確認
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setFeedbackOpen((v) => !v)}
            className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
            title="つくよみ (LLM) にこの抽出への修正依頼を送る"
          >
            ⚠️ つくよみに修正依頼
          </button>
          <Hint id="cockpit.strategy-signals.tsukuyomi-feedback" />
        </span>
      </div>
      <div className="mt-1 text-[12px] font-semibold leading-snug">{signal.title}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {signal.summary}
      </p>
      {signal.scoreImpactSummary && (
        <p className="mt-1 rounded border border-sky-100 bg-sky-50/70 px-2 py-1 text-[10px] leading-relaxed text-sky-800">
          📊 影響: {signal.scoreImpactSummary}
        </p>
      )}
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
      {pastFeedbacks.length > 0 && (
        <details className="mt-1.5 text-[10px]">
          <summary className="cursor-pointer select-none text-amber-700 hover:text-amber-900">
            🌙 つくよみへの過去の修正依頼 {pastFeedbacks.length}件
            {pastFeedbacks.some((f) => f.applied_count > 0) && (
              <span className="ml-1 text-[9px] text-emerald-700">(✓ {pastFeedbacks.reduce((sum, f) => sum + f.applied_count, 0)}回反映済)</span>
            )}
          </summary>
          <div className="mt-1 space-y-1">
            {pastFeedbacks.map((fb) => (
              <div key={fb.feedback_id} className="rounded border border-amber-200 bg-amber-50/60 px-2 py-1.5">
                <div className="flex items-center gap-2 text-[9px] text-amber-800">
                  <span className="font-mono">{new Date(fb.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  {fb.created_by && <span>by {fb.created_by}</span>}
                  {fb.applied_count > 0 ? (
                    <span className="ml-auto text-emerald-700">✓ {fb.applied_count}回反映</span>
                  ) : (
                    <span className="ml-auto text-zinc-500">⏳ 次回抽出待ち</span>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-amber-900 whitespace-pre-wrap leading-snug">
                  {fb.feedback_text}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {feedbackOpen && (
        <div className="mt-2 rounded border border-amber-200 bg-amber-50/60 p-2">
          {dialogStep === "input" && (
            <>
              <div className="text-[10px] text-amber-900 mb-1">
                つくよみ (LLM 抽出) への修正依頼。送信するとつくよみが改訂案を提示するので、まさが「適用 / やり直し / 追加コメント」で対話的に固める。
              </div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="例: このシグナルは「外部環境変化」じゃなくて「技術開発」 (= 自社特許出願) に分類すべき"
                className="w-full rounded border border-amber-300 bg-white p-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                rows={3}
              />
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={startDialog}
                  disabled={!feedbackText.trim()}
                  className="rounded bg-amber-600 px-2 py-0.5 text-[10px] text-white disabled:opacity-40"
                >
                  送信 (= つくよみに提案を依頼)
                </button>
                <button
                  type="button"
                  onClick={resetDialog}
                  className="rounded border border-amber-300 px-2 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100"
                >
                  キャンセル
                </button>
                {errorNote && <span className="text-[10px] text-rose-700">{errorNote}</span>}
              </div>
            </>
          )}

          {dialogStep === "loading" && (
            <div className="py-3 text-center text-[11px] text-amber-900">
              🌙 つくよみが提案を考えてる…
            </div>
          )}

          {dialogStep === "preview" && proposed && current && (
            <>
              <div className="text-[10px] text-amber-900 mb-1.5 font-semibold">
                🌙 つくよみ提案: {reasoning || "改訂案を作りました。これでいい?"}
              </div>
              {appliedSummary && (
                <div className="mb-1.5 text-[10px] text-amber-700">
                  反映内容: {appliedSummary}
                </div>
              )}
              <div className="space-y-1.5 rounded border border-amber-300 bg-white/80 p-2">
                <DiffRow label="title" before={current.title} after={proposed.title} />
                <DiffRow label="summary" before={current.summary} after={proposed.summary} />
                <DiffRow label="signal_type" before={current.signal_type} after={proposed.signal_type} compact />
                <DiffRow label="impact" before={current.impact_level} after={proposed.impact_level} compact />
                <DiffRow label="polarity" before={current.polarity ?? "(未設定)"} after={proposed.polarity ?? "(未設定)"} compact />
                <DiffRow label="score" before={current.score_impact_summary ?? "(未設定)"} after={proposed.score_impact_summary ?? "(未設定)"} compact />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={confirmDialog}
                  className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] text-white hover:bg-emerald-700"
                >
                  ✓ 適用 (= signal を更新)
                </button>
                <button
                  type="button"
                  onClick={() => refineDialog({ additionalHint: "別案を見せて" })}
                  className="rounded border border-amber-400 px-2 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100"
                >
                  🔁 やり直し (= 別案)
                </button>
                <button
                  type="button"
                  onClick={() => setDialogStep("addComment")}
                  className="rounded border border-amber-400 px-2 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100"
                >
                  💬 追加コメント
                </button>
                <button
                  type="button"
                  onClick={resetDialog}
                  className="ml-auto rounded border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-700 hover:bg-zinc-100"
                >
                  キャンセル
                </button>
                {errorNote && <span className="text-[10px] text-rose-700">{errorNote}</span>}
              </div>
              <details className="mt-1.5 text-[10px] text-amber-800">
                <summary className="cursor-pointer select-none">対話履歴 ({conversation.length}件)</summary>
                <div className="mt-1 space-y-1">
                  {conversation.map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="rounded bg-white/60 px-2 py-1">
                        <span className="font-mono text-[9px] text-amber-700">[まさ]</span> {m.content}
                      </div>
                    ) : (
                      <div key={i} className="rounded bg-amber-100/60 px-2 py-1">
                        <span className="font-mono text-[9px] text-amber-700">[つくよみ]</span> {m.reasoning}
                      </div>
                    )
                  )}
                </div>
              </details>
            </>
          )}

          {dialogStep === "addComment" && (
            <>
              <div className="text-[10px] text-amber-900 mb-1">
                追加コメントを書いてつくよみに再提案を依頼する。
              </div>
              <textarea
                value={additionalText}
                onChange={(e) => setAdditionalText(e.target.value)}
                placeholder="例: ここの「DD」は実は「面談」止まりなので、もっと弱めの impact_level にして"
                className="w-full rounded border border-amber-300 bg-white p-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                rows={3}
              />
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refineDialog({ additionalFeedback: additionalText.trim() })}
                  disabled={!additionalText.trim()}
                  className="rounded bg-amber-600 px-2 py-0.5 text-[10px] text-white disabled:opacity-40"
                >
                  送信 (= 追加コメント反映で再提案)
                </button>
                <button
                  type="button"
                  onClick={() => { setAdditionalText(""); setDialogStep("preview"); }}
                  className="rounded border border-amber-300 px-2 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100"
                >
                  戻る
                </button>
                {errorNote && <span className="text-[10px] text-rose-700">{errorNote}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function DiffRow({ label, before, after, compact }: { label: string; before: string; after: string; compact?: boolean }) {
  const same = before === after;
  return (
    <div className={`grid grid-cols-[60px_1fr] gap-1.5 text-[10px] ${compact ? "items-center" : "items-start"}`}>
      <span className="font-mono text-zinc-600">{label}</span>
      <div className="space-y-0.5">
        {same ? (
          <div className="text-zinc-700">{after || "(空)"}</div>
        ) : (
          <>
            <div className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-800 line-through decoration-rose-400 decoration-2">
              {before || "(空)"}
            </div>
            <div className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 font-semibold">
              {after || "(空)"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
