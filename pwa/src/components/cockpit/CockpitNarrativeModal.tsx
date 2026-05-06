"use client";

/**
 * 沿革モーダル: 一般的な「会社沿革」スタイルの年月+一行リスト。
 * 各項目をタップで詳細展開。
 *
 * 沿革本体の生成は 午前 3 時 cron (/api/cron/venture-narrative-refresh) が担当。
 * このモーダルは保存済みのキャッシュ (project_ventures.narrative_text、JSON 配列文字列) を表示するだけ。
 */

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CockpitNarrativeFeedbackModal } from "./CockpitNarrativeFeedbackModal";

interface NarrativeItem {
  date: string;     // 'YYYY-MM' or 'YYYY-MM-DD'
  title: string;    // 一行サマリ
  detail: string;   // タップで展開される詳細
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
);

interface Props {
  projectId: string;
  displayName: string;
  onClose: () => void;
}

function safeParse(text: string | null): NarrativeItem[] | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (it): it is NarrativeItem =>
          typeof it === "object" &&
          it !== null &&
          typeof (it as NarrativeItem).date === "string" &&
          typeof (it as NarrativeItem).title === "string"
      );
    }
  } catch {
    // 旧形式 (markdown 文字列) はリスト形式に解釈不可
  }
  return null;
}

export function CockpitNarrativeModal({ projectId, displayName, onClose }: Props) {
  const [items, setItems] = useState<NarrativeItem[] | null>(null);
  const [legacyText, setLegacyText] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [invalidatedAt, setInvalidatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [feedbackTarget, setFeedbackTarget] = useState<{
    item_date: string | null;
    item_title: string | null;
  } | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("project_ventures")
      .select("narrative_text, narrative_generated_at, narrative_invalidated_at")
      .eq("project_id", projectId)
      .maybeSingle();
    const text = (data?.narrative_text as string | null) ?? null;
    const parsed = safeParse(text);
    if (parsed) {
      setItems(parsed);
      setLegacyText(null);
    } else {
      setItems(null);
      setLegacyText(text);
    }
    setGeneratedAt((data?.narrative_generated_at as string | null) ?? null);
    setInvalidatedAt((data?.narrative_invalidated_at as string | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const isStale =
    !!generatedAt &&
    !!invalidatedAt &&
    new Date(invalidatedAt) > new Date(generatedAt);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[640px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">{displayName} の沿革</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFeedbackTarget({ item_date: null, item_title: null })}
              className="text-[11px] text-purple-600 hover:underline"
              title="沿革全体に対する修正依頼"
            >
              ✏ 全体に修正依頼
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
              ✕
            </button>
          </div>
        </div>
        <div className="px-4 py-4">
          {loading ? (
            <p className="text-[12px] text-muted-foreground">読み込み中…</p>
          ) : items && items.length > 0 ? (
            <ol className="text-[12.5px] leading-relaxed text-slate-800 divide-y divide-[#f1f5f9]">
              {items.map((it, i) => {
                const open = expanded.has(i);
                return (
                  <li key={i} className="py-2 group">
                    <button
                      onClick={() => toggle(i)}
                      className="w-full flex items-start gap-3 text-left hover:bg-[#fafafa] rounded px-1 py-0.5"
                    >
                      <span className="text-[10px] font-mono text-muted-foreground w-[68px] shrink-0 mt-0.5">
                        {it.date}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{open ? "▼" : "▶"}</span>
                      <span className="flex-1">{it.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFeedbackTarget({ item_date: it.date, item_title: it.title });
                        }}
                        className="text-[10px] text-purple-500 hover:text-purple-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="この項目に修正依頼を送る"
                      >
                        ✏
                      </button>
                    </button>
                    {open && it.detail && (
                      <p className="ml-[88px] mt-1 mr-1 text-[12px] text-slate-600 whitespace-pre-wrap">
                        {it.detail}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : legacyText ? (
            <div className="text-[12px] whitespace-pre-wrap text-slate-700">{legacyText}</div>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              沿革はまだ生成されていません。<br />
              毎朝 03:00 (JST) の cron で events / XRL / メタの差分があれば自動生成されます。
            </p>
          )}

          <div className="mt-4 text-[10px] text-muted-foreground">
            {generatedAt ? (
              <>
                最終生成: {generatedAt.replace("T", " ").slice(0, 16)}
                {(isStale || feedbackSubmitted) && (
                  <span className="ml-2 text-amber-600">
                    (差分あり、次の 03:45 で再生成予定)
                  </span>
                )}
              </>
            ) : (
              "未生成 (次の 03:45 で生成予定)"
            )}
            <div className="mt-1 text-[10px]">
              項目右の <span className="text-purple-500">✏</span> でつくよみに修正依頼を送れます。フィードバックは学習されます。
            </div>
          </div>
        </div>
      </div>

      {feedbackTarget && (
        <CockpitNarrativeFeedbackModal
          projectId={projectId}
          itemDate={feedbackTarget.item_date}
          itemTitle={feedbackTarget.item_title}
          onClose={() => setFeedbackTarget(null)}
          onSubmitted={async () => {
            setFeedbackSubmitted(true);
            // 即時再生成された沿革を再フェッチ。Modal は閉じない (まさが結果サマリ確認できる)
            await reload();
          }}
        />
      )}
    </div>
  );
}
