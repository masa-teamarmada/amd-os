"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addAtlasSignal, type AtlasSignal } from "@/lib/supabase-data";

const DOMAINS = [
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
  "P.量子・量子計算",
  "Q.センシング・計測",
  "R.先端通信",
];

const SOURCE_TYPES: { value: AtlasSignal["source_type"]; label: string }[] = [
  { value: "news", label: "ニュース・記事" },
  { value: "report", label: "レポート・論文" },
  { value: "data", label: "データ・統計" },
  { value: "manual", label: "メモ・手動" },
];

export default function AtlasSubmitPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    content: "",
    source_url: "",
    source_type: "news" as AtlasSignal["source_type"],
    domain: "",
    tags: "",
    importance: "medium" as AtlasSignal["importance"],
  });
  const [submitting, setSubmitting] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const parseTags = (raw: string) =>
    raw.split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean);

  const fetchAutoTags = async (): Promise<{ tags: string[]; importance: string | null }> => {
    try {
      const res = await fetch("/api/atlas/auto-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          domain: form.domain,
        }),
      });
      const json = await res.json();
      return { tags: json.tags || [], importance: json.importance || null };
    } catch {
      return { tags: [], importance: null };
    }
  };

  const handleAutoTag = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError("タイトルと内容を先に入れてね");
      return;
    }
    setError("");
    setAutoTagging(true);
    const { tags, importance } = await fetchAutoTags();
    if (tags.length > 0) {
      // 既存タグとマージ（重複除去）
      const existing = parseTags(form.tags);
      const merged = Array.from(new Set([...existing, ...tags]));
      setForm((prev) => ({
        ...prev,
        tags: merged.join(", "),
        importance: (importance as AtlasSignal["importance"]) || prev.importance,
      }));
    } else {
      setError("自動タグ生成に失敗。手動で入れて");
    }
    setAutoTagging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError("タイトルと内容は必須");
      return;
    }
    if (!form.source_url.trim()) {
      setError("ソースURLは必須（全方位アンテナの原則）");
      return;
    }
    setSubmitting(true);
    setError("");

    let tags = parseTags(form.tags);
    let importance = form.importance;
    // タグが空なら投入時にも自動生成（フォールバック）
    if (tags.length === 0) {
      const { tags: aiTags, importance: aiImportance } = await fetchAutoTags();
      tags = aiTags;
      if (aiImportance) importance = aiImportance as AtlasSignal["importance"];
    }

    const ok = await addAtlasSignal({
      title: form.title.trim(),
      content: form.content.trim(),
      source_url: form.source_url.trim(),
      source_type: form.source_type,
      domain: form.domain || undefined,
      suggested_tags: tags,
      importance,
    });
    setSubmitting(false);
    if (ok) {
      router.push("/atlas/inbox");
    } else {
      setError("投入に失敗。ログインしてるか確認して");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <Link href="/atlas/inbox" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Inbox
        </Link>
        <h1 className="text-lg font-bold mt-1">シグナル投入</h1>
        <p className="text-xs text-muted-foreground">えいみが収集したマクロトレンド情報をInboxに追加する</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="例: 中国がガリウム輸出規制を拡大、半導体・冷却材料に影響"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Source URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            ソースURL <span className="text-red-500">*</span>
            <span className="text-muted-foreground font-normal ml-1">（全方位アンテナ原則：必須）</span>
          </label>
          <input
            type="url"
            value={form.source_url}
            onChange={(e) => set("source_url", e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Source type + Importance (横並び) */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-foreground">ソース種別</label>
            <select
              value={form.source_type ?? "news"}
              onChange={(e) => set("source_type", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s.value} value={s.value ?? "news"}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-foreground">重要度</label>
            <select
              value={form.importance}
              onChange={(e) => set("importance", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="high">HIGH — 即時Push候補</option>
              <option value="medium">MEDIUM — 通常</option>
              <option value="low">LOW — 参考情報</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            内容サマリ <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            rows={4}
            placeholder="何が起きているか、なぜ重要か、AMDへの示唆を簡潔に書く"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        {/* Domain */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">分野（ドメイン）</label>
          <select
            value={form.domain}
            onChange={(e) => set("domain", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">— 選択しない —</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              タグ <span className="text-muted-foreground font-normal ml-1">（空欄でもOK・投入時に自動付与）</span>
            </label>
            <button
              type="button"
              onClick={handleAutoTag}
              disabled={autoTagging}
              className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-50 transition-colors font-medium"
            >
              {autoTagging ? "生成中..." : "✨ 自動でタグ付け"}
            </button>
          </div>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="未入力ならAIが自動でタグを付ける"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "投入中..." : "Inboxに投入する"}
        </button>
      </form>
    </div>
  );
}
