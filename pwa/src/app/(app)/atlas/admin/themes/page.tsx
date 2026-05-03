"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { domainColor, domainKey, domainLabel } from "@/lib/atlas-domains";

interface ProposedTheme {
  id?: string;
  name: string;
  description: string;
  primary_domain: string;
  tag_keywords: string[];
  story_ids: string[];
}

interface ExistingTheme {
  id: string;
  name: string;
  description: string | null;
  primary_domain: string | null;
  tag_keywords: string[];
  story_count: number;
}

export default function AtlasThemesAdminPage() {
  const [existingThemes, setExistingThemes] = useState<ExistingTheme[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposals, setProposals] = useState<ProposedTheme[]>([]);
  const [totalStories, setTotalStories] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);

  const reloadExisting = async () => {
    setLoadingExisting(true);
    try {
      const res = await fetch("/api/atlas/themes/list");
      const json = await res.json();
      if (json.ok) {
        setExistingThemes(json.themes || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingExisting(false);
  };

  useEffect(() => {
    reloadExisting();
  }, []);

  const runClustering = async () => {
    setClustering(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/atlas/themes/cluster", { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || `HTTP ${res.status}`);
        setClustering(false);
        return;
      }
      setProposals(json.themes || []);
      setTotalStories(json.total_stories || 0);
      setMessage(
        `${json.themes?.length || 0} 件のテーマ候補を生成（${json.total_stories} ストーリー対象）`
      );
    } catch (e) {
      setError(String(e));
    }
    setClustering(false);
  };

  const updateProposal = (idx: number, patch: Partial<ProposedTheme>) => {
    setProposals((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removeProposal = (idx: number) => {
    setProposals((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyAll = async () => {
    if (proposals.length === 0) return;
    if (
      !confirm(
        `${proposals.length} 個のテーマを保存し、合計 ${proposals.reduce((sum, p) => sum + p.story_ids.length, 0)} 件の紐付けを作る。${replaceMode ? "対象ストーリーの既存紐付けは置き換える。" : "既存紐付けは保持する（追記）。"} 進める？`
      )
    )
      return;
    setApplying(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/atlas/themes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes: proposals,
          replace: replaceMode,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || `HTTP ${res.status}`);
        setApplying(false);
        return;
      }
      setMessage(
        `保存OK: created=${json.created} updated=${json.updated} links=${json.links_inserted}${json.errors?.length ? ` errors=${json.errors.length}` : ""}`
      );
      setProposals([]);
      reloadExisting();
    } catch (e) {
      setError(String(e));
    }
    setApplying(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          href="/atlas"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Atlas
        </Link>
        <h1 className="text-lg font-bold mt-1">Atlas テーマ管理</h1>
        <p className="text-xs text-muted-foreground mt-1">
          ストーリーよりも粗い「テーマ」単位を定義する。世界×日本ズレマップで使う軸。
        </p>
      </div>

      {/* 既存テーマ */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold">
          既存テーマ ({existingThemes.length})
        </h2>
        {loadingExisting ? (
          <p className="text-xs text-muted-foreground">読み込み中…</p>
        ) : existingThemes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            まだテーマが定義されていない。下の「クラスタリング実行」から始める。
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {existingThemes.map((t) => {
              const dKey = domainKey(t.primary_domain);
              return (
                <div
                  key={t.id}
                  className="p-2.5 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {dKey && (
                      <span
                        className="text-[10px] font-bold px-1 py-0 rounded text-white"
                        style={{ background: domainColor(dKey) }}
                      >
                        {domainLabel(dKey)}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {t.story_count} stories
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {t.description}
                    </p>
                  )}
                  {t.tag_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.tag_keywords.slice(0, 8).map((k) => (
                        <span
                          key={k}
                          className="text-[10px] px-1.5 py-0 rounded bg-muted text-muted-foreground"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* クラスタリング実行 */}
      <section className="space-y-3 border-t border-border pt-5">
        <div>
          <h2 className="text-sm font-bold">クラスタリング実行</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            既存ストーリーを Sonnet 4.6 で分析して 30-50個のテーマ候補を生成する。
            生成後に編集して「テーマ確定」を押すまでDBには保存されない。
          </p>
        </div>
        <button
          onClick={runClustering}
          disabled={clustering}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {clustering ? "解析中…（最大3分）" : "🤖 クラスタリング実行"}
        </button>

        {message && (
          <p className="text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-3 py-2 rounded-md">
            {message}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-3 py-2 rounded-md">
            {error}
          </p>
        )}
      </section>

      {/* 提案リスト */}
      {proposals.length > 0 && (
        <section className="space-y-3 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-bold">
              提案テーマ ({proposals.length})
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                対象ストーリー {totalStories}件 / 紐付け{" "}
                {proposals.reduce((sum, p) => sum + p.story_ids.length, 0)}件
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceMode}
                  onChange={(e) => setReplaceMode(e.target.checked)}
                />
                既存紐付けを置き換える
              </label>
              <button
                onClick={applyAll}
                disabled={applying}
                className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors text-sm font-medium text-white"
              >
                {applying ? "保存中…" : "✓ これでテーマ確定"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {proposals.map((p, idx) => {
              const dKey = domainKey(p.primary_domain);
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-border bg-card space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => updateProposal(idx, { name: e.target.value })}
                      className="flex-1 text-sm font-semibold px-2 py-1 rounded border border-border bg-background"
                      placeholder="テーマ名"
                    />
                    <select
                      value={p.primary_domain}
                      onChange={(e) =>
                        updateProposal(idx, { primary_domain: e.target.value })
                      }
                      className="text-xs px-2 py-1 rounded border border-border bg-background"
                    >
                      <option value="">分野</option>
                      {[
                        "A.地政学・マクロ経済",
                        "B.規制・政策",
                        "C.素材・原料",
                        "D.エネルギー",
                        "E.製造・プロセス技術",
                        "F.バイオ・医療",
                        "G.モビリティ・ロボティクス",
                        "H.建築・インフラ",
                        "I.ICT・AI",
                        "J.宇宙・防衛",
                        "K.食・農・水産",
                        "L.金融・資本市場",
                        "M.社会構造・社会課題",
                        "N.海洋・水資源",
                        "O.サーキュラーエコノミー",
                      ].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded",
                        p.story_ids.length === 0
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}
                    >
                      {p.story_ids.length} stories
                    </span>
                    <button
                      onClick={() => removeProposal(idx)}
                      className="text-xs px-2 py-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    value={p.description}
                    onChange={(e) =>
                      updateProposal(idx, { description: e.target.value })
                    }
                    rows={2}
                    className="w-full text-xs px-2 py-1 rounded border border-border bg-background resize-none"
                    placeholder="説明（このテーマで何を見たいか）"
                  />
                  <input
                    type="text"
                    value={p.tag_keywords.join(", ")}
                    onChange={(e) =>
                      updateProposal(idx, {
                        tag_keywords: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full text-xs px-2 py-1 rounded border border-border bg-background"
                    placeholder="タグキーワード（カンマ区切り）"
                  />
                  {dKey && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0 rounded text-white"
                        style={{ background: domainColor(dKey) }}
                      >
                        {domainLabel(dKey)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
