"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  fetchAtlasSignals,
  fetchAtlasStories,
  mergeStoriesByApi,
  moveSignal,
  type AtlasSignal,
  type AtlasStory,
} from "@/lib/supabase-data";
import { cn } from "@/lib/utils";
import { domainColor, domainLabel, domainKey } from "@/lib/atlas-domains";

const importanceBadge: Record<string, string> = {
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  medium: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  low: "bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500",
};

const sourceTypeLabel: Record<string, string> = {
  news: "NEWS",
  report: "REPORT",
  data: "DATA",
  manual: "MEMO",
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function formatYmd(ts: string) {
  return new Date(ts).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

const TAG_STYLE_PALETTE = [
  { bg: "#ffe4e6", fg: "#9f1239", border: "#fecdd3" },
  { bg: "#ffedd5", fg: "#9a3412", border: "#fed7aa" },
  { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
  { bg: "#fef9c3", fg: "#854d0e", border: "#fef08a" },
  { bg: "#ecfccb", fg: "#3f6212", border: "#d9f99d" },
  { bg: "#d1fae5", fg: "#065f46", border: "#a7f3d0" },
  { bg: "#ccfbf1", fg: "#115e59", border: "#99f6e4" },
  { bg: "#cffafe", fg: "#155e75", border: "#a5f3fc" },
  { bg: "#e0f2fe", fg: "#075985", border: "#bae6fd" },
  { bg: "#dbeafe", fg: "#1e40af", border: "#bfdbfe" },
  { bg: "#e0e7ff", fg: "#3730a3", border: "#c7d2fe" },
  { bg: "#ede9fe", fg: "#5b21b6", border: "#ddd6fe" },
  { bg: "#fae8ff", fg: "#86198f", border: "#f5d0fe" },
  { bg: "#fce7f3", fg: "#9d174d", border: "#fbcfe8" },
];

function tagStyle(tag: string, active = false): CSSProperties {
  if (active) {
    return {
      backgroundColor: "hsl(var(--primary))",
      borderColor: "hsl(var(--primary))",
      color: "hsl(var(--primary-foreground))",
    };
  }
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  const tone = TAG_STYLE_PALETTE[h % TAG_STYLE_PALETTE.length];
  return {
    backgroundColor: tone.bg,
    borderColor: tone.border,
    color: tone.fg,
  };
}

interface StoryWithSignals extends AtlasStory {
  signals: AtlasSignal[];
}

export default function AtlasPage() {
  const [stories, setStories] = useState<StoryWithSignals[]>([]);
  const [orphanSignals, setOrphanSignals] = useState<AtlasSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [domainFilterKey, setDomainFilterKey] = useState<string | null>(null);
  const [importanceFilter, setImportanceFilter] = useState<"high" | null>(null);
  const [search, setSearch] = useState("");
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [showOrphans, setShowOrphans] = useState(false);
  const [mergeFrom, setMergeFrom] = useState<StoryWithSignals | null>(null);
  const [moveSignalTarget, setMoveSignalTarget] = useState<{
    signal: AtlasSignal;
    fromStoryTitle: string;
  } | null>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([
      fetchAtlasStories({ limit: 500 }),
      fetchAtlasSignals("accepted"),
    ]).then(([sts, sigs]) => {
      const byStory = new Map<string, AtlasSignal[]>();
      const orphans: AtlasSignal[] = [];
      sigs.forEach((s) => {
        if (s.story_id) {
          const arr = byStory.get(s.story_id) || [];
          arr.push(s);
          byStory.set(s.story_id, arr);
        } else {
          orphans.push(s);
        }
      });
      byStory.forEach((arr) =>
        arr.sort(
          (a, b) =>
            new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
        )
      );
      const enriched: StoryWithSignals[] = sts.map((st) => ({
        ...st,
        signals: byStory.get(st.id) || [],
      }));
      enriched.sort((a, b) => {
        if (b.signals.length !== a.signals.length) {
          return b.signals.length - a.signals.length;
        }
        return (
          new Date(b.last_updated_at).getTime() -
          new Date(a.last_updated_at).getTime()
        );
      });
      setStories(enriched);
      setOrphanSignals(orphans);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  // タグ・ドメイン集計はストーリー内のシグナルから
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    stories.forEach((st) =>
      st.signals.forEach((s) =>
        s.suggested_tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1))
      )
    );
    orphanSignals.forEach((s) =>
      s.suggested_tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1))
    );
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [stories, orphanSignals]);

  const domainCounts = useMemo(() => {
    const counts = new Map<string, number>();
    stories.forEach((st) => {
      const k = domainKey(st.primary_domain);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [stories]);

  // フィルタ
  const matchesFilter = (st: StoryWithSignals): boolean => {
    if (importanceFilter && st.importance !== importanceFilter) return false;
    if (domainFilterKey && domainKey(st.primary_domain) !== domainFilterKey) return false;
    if (tagFilter) {
      const has =
        (st.tags && st.tags.includes(tagFilter)) ||
        st.signals.some((s) => s.suggested_tags.includes(tagFilter));
      if (!has) return false;
    }
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = [
        st.title,
        st.summary || "",
        st.tags.join(" "),
        ...st.signals.map((s) => `${s.title} ${s.content} ${s.suggested_tags.join(" ")}`),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const filteredStories = useMemo(
    () => stories.filter(matchesFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories, tagFilter, domainFilterKey, importanceFilter, search]
  );

  const totalSignals = useMemo(
    () =>
      stories.reduce((sum, st) => sum + st.signals.length, 0) +
      orphanSignals.length,
    [stories, orphanSignals]
  );

  const clearFilters = () => {
    setTagFilter(null);
    setDomainFilterKey(null);
    setImportanceFilter(null);
    setSearch("");
  };
  const hasFilter =
    tagFilter || domainFilterKey || importanceFilter || search.trim();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2.75rem)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">AMD Atlas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stories.length} stories · {totalSignals} signals
            {hasFilter ? ` (${filteredStories.length} stories 絞込)` : ""}
          </p>
        </div>
        <div className="flex gap-2 text-xs flex-wrap">
          <Link
            href="/atlas/map"
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            🗺 Map
          </Link>
          <Link
            href="/atlas/divergence"
            className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white transition-colors font-medium"
          >
            📊 トレンド
          </Link>
          <Link
            href="/atlas/decisions"
            className="px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            判断ログ
          </Link>
          <Link
            href="/atlas/inbox"
            className="px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            Inbox
          </Link>
          <Link
            href="/atlas/admin/themes"
            className="px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            テーマ管理
          </Link>
        </div>
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 タイトル・本文・タグ検索"
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      {/* Filters */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setImportanceFilter(importanceFilter === "high" ? null : "high")}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full font-medium transition-colors",
              importanceFilter === "high"
                ? "bg-amber-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            🔴 HIGH のみ
          </button>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="text-xs px-2.5 py-1 rounded-full text-muted-foreground hover:bg-accent transition-colors"
            >
              ✕ 全フィルタ解除
            </button>
          )}
        </div>

        {domainCounts.length > 0 && (
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1.5 shrink-0">
              分野
            </span>
            <div className="flex flex-wrap gap-1.5">
              {domainCounts.map(([k, c]) => (
                <button
                  key={k}
                  onClick={() => setDomainFilterKey(domainFilterKey === k ? null : k)}
                  className={cn(
                    "text-sm font-medium px-2.5 py-0.5 rounded-full transition-colors",
                    domainFilterKey === k
                      ? "ring-2 ring-offset-1 ring-offset-background"
                      : ""
                  )}
                  style={{ background: domainColor(k), color: "white" }}
                >
                  {domainLabel(k)} <span className="text-xs opacity-80 ml-0.5">{c}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tagCounts.length > 0 && (
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1.5 shrink-0">
              タグ
            </span>
            <div className="flex flex-wrap gap-1.5">
              {tagCounts.slice(0, 40).map(([t, c]) => (
                <button
                  key={t}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                  className={cn(
                    "text-sm px-2.5 py-1 rounded-full border font-medium transition-colors hover:brightness-95"
                  )}
                  style={tagStyle(t, tagFilter === t)}
                >
                  #{t} <span className="ml-0.5 opacity-60 text-xs">{c}</span>
                </button>
              ))}
              {tagCounts.length > 40 && (
                <span className="text-xs text-muted-foreground/60 self-center">
                  +{tagCounts.length - 40} more
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Story list */}
      {filteredStories.length === 0 && orphanSignals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm space-y-1">
          <p>該当するストーリーはありません</p>
        </div>
      ) : (
        <section className="space-y-2">
          {filteredStories.map((st) => (
            <StoryCard
              key={st.id}
              story={st}
              expanded={expandedStoryId === st.id}
              onToggle={() =>
                setExpandedStoryId(expandedStoryId === st.id ? null : st.id)
              }
              onTagClick={(t) => setTagFilter(tagFilter === t ? null : t)}
              activeTag={tagFilter}
              onStartMerge={() => setMergeFrom(st)}
              onMoveSignal={(signal) =>
                setMoveSignalTarget({ signal, fromStoryTitle: st.title })
              }
              onReload={reload}
            />
          ))}
        </section>
      )}

      {/* Merge modal */}
      {mergeFrom && (
        <MergeStoryModal
          from={mergeFrom}
          allStories={stories}
          onClose={() => setMergeFrom(null)}
          onMerged={() => {
            setMergeFrom(null);
            setExpandedStoryId(null);
            reload();
          }}
        />
      )}

      {/* Move signal modal */}
      {moveSignalTarget && (
        <MoveSignalModal
          signal={moveSignalTarget.signal}
          fromStoryTitle={moveSignalTarget.fromStoryTitle}
          allStories={stories}
          onClose={() => setMoveSignalTarget(null)}
          onMoved={() => {
            setMoveSignalTarget(null);
            reload();
          }}
        />
      )}

      {/* Orphan signals (story_id null) */}
      {orphanSignals.length > 0 && !hasFilter && (
        <section className="space-y-2">
          <button
            onClick={() => setShowOrphans(!showOrphans)}
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors flex items-center gap-1"
          >
            未紐付けシグナル ({orphanSignals.length}) <span>{showOrphans ? "▲" : "▼"}</span>
          </button>
          {showOrphans && (
            <div className="space-y-1.5">
              {orphanSignals.map((s) => (
                <OrphanSignalRow
                  key={s.id}
                  signal={s}
                  onTagClick={(t) => setTagFilter(tagFilter === t ? null : t)}
                  activeTag={tagFilter}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StoryCard({
  story,
  expanded,
  onToggle,
  onTagClick,
  activeTag,
  onStartMerge,
  onMoveSignal,
  onReload,
}: {
  story: StoryWithSignals;
  expanded: boolean;
  onToggle: () => void;
  onTagClick: (t: string) => void;
  activeTag: string | null;
  onStartMerge: () => void;
  onMoveSignal: (signal: AtlasSignal) => void;
  onReload: () => void;
}) {
  const [pendingSignalId, setPendingSignalId] = useState<string | null>(null);

  const handleDetach = async (signal: AtlasSignal) => {
    if (!confirm(`「${signal.title}」をこのストーリーから外して未紐付けに戻す？`)) return;
    setPendingSignalId(signal.id);
    const r = await moveSignal(signal.id, "detach");
    setPendingSignalId(null);
    if (!r.ok) {
      alert("失敗: " + r.error);
      return;
    }
    onReload();
  };

  const handleCreateNew = async (signal: AtlasSignal) => {
    if (!confirm(`「${signal.title}」を新規ストーリーとして切り出す？\nタイトルは AI が提案します。`))
      return;
    setPendingSignalId(signal.id);
    const r = await moveSignal(signal.id, "createNew", { useLlmProposal: true });
    setPendingSignalId(null);
    if (!r.ok) {
      alert("失敗: " + r.error);
      return;
    }
    onReload();
  };
  const dKey = domainKey(story.primary_domain);
  const dColor = dKey ? domainColor(dKey) : "#94a3b8";
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full text-left p-3.5 hover:bg-accent/30 transition-colors cursor-pointer"
      >
        <div className="flex items-start gap-2">
          {/* Sidebar: signal count */}
          <div className="shrink-0 w-10 text-center">
            <div className="text-xl font-bold leading-none">{story.signals.length}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
              signals
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {dKey && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                  style={{ background: dColor }}
                >
                  {domainLabel(dKey)}
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  importanceBadge[story.importance]
                )}
              >
                {story.importance.toUpperCase()}
              </span>
              {story.status !== "ongoing" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {story.status === "concluded" ? "終結" : "休眠"}
                </span>
              )}
            </div>

            <p
              className="text-sm font-semibold leading-snug select-text cursor-text"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {story.title}
            </p>
            {story.summary && !expanded && (
              <p
                className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed select-text cursor-text"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {story.summary}
              </p>
            )}

            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/60">
              <span>更新: {formatDate(story.last_updated_at)}</span>
              <span>·</span>
              <span>初出: {formatDate(story.started_at)}</span>
            </div>
          </div>

          <span className="text-muted-foreground/60 text-xs shrink-0 mt-1">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Expanded body: timeline */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/10">
          {story.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {story.summary}
            </p>
          )}

          {/* Timeline of signals */}
          {story.signals.length > 0 && (
            <ol className="space-y-2.5 relative ml-2 pl-3 border-l border-border">
              {story.signals.map((s) => (
                <li key={s.id} className="relative">
                  <span
                    className="absolute -left-[15px] top-1.5 w-2 h-2 rounded-full"
                    style={{ background: dColor }}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {formatYmd(s.submitted_at)}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-bold px-1 py-0.5 rounded",
                          importanceBadge[s.importance]
                        )}
                      >
                        {s.importance.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-snug">{s.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {s.content}
                    </p>
                    {s.source_url && (
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors truncate max-w-full"
                      >
                        <span className="text-[9px] font-mono px-1 py-0 rounded bg-muted text-muted-foreground/80">
                          {s.source_type ? sourceTypeLabel[s.source_type] : "MEMO"}
                        </span>
                        <span className="truncate">{s.source_url}</span>
                      </a>
                    )}
                    {s.suggested_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.suggested_tags.slice(0, 8).map((t) => (
                          <button
                            key={t}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTagClick(t);
                            }}
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full border transition-colors hover:brightness-95"
                            )}
                            style={tagStyle(t, activeTag === t)}
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* シグナル整理アクション */}
                    <div
                      className={cn(
                        "flex gap-1 pt-1 transition-opacity",
                        pendingSignalId === s.id && "opacity-40 pointer-events-none"
                      )}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDetach(s);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="このシグナルをストーリーから外して未紐付けに戻す"
                      >
                        ✕ 外す
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveSignal(s);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="別の既存ストーリーに移植"
                      >
                        → 他のストーリーに移植
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateNew(s);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="この1件で新規ストーリーを立ち上げ"
                      >
                        ✦ 新規ストーリー化
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Story tags */}
          {story.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
              {story.tags.map((t) => (
                <button
                  key={t}
                  onClick={() => onTagClick(t)}
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full border transition-colors hover:brightness-95"
                  )}
                  style={tagStyle(t, activeTag === t)}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartMerge();
              }}
              className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              ⇄ 他のストーリーと統合
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MergeStoryModal({
  from,
  allStories,
  onClose,
  onMerged,
}: {
  from: StoryWithSignals;
  allStories: StoryWithSignals[];
  onClose: () => void;
  onMerged: () => void;
}) {
  const [selectedTo, setSelectedTo] = useState<string>("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // 候補ソート: 同じ primary_domain → タグの重複度 → signal_count
  const candidates = useMemo(() => {
    const fromDomain = domainKey(from.primary_domain);
    const fromTagSet = new Set(from.tags || []);
    const others = allStories.filter((s) => s.id !== from.id);
    const scored = others.map((s) => {
      const sameDomain = domainKey(s.primary_domain) === fromDomain ? 1 : 0;
      const tagOverlap = (s.tags || []).filter((t) => fromTagSet.has(t)).length;
      return { story: s, score: sameDomain * 100 + tagOverlap * 10 + s.signals.length };
    });
    scored.sort((a, b) => b.score - a.score);
    const filtered = search.trim()
      ? scored.filter((x) => {
          const q = search.toLowerCase();
          return (
            x.story.title.toLowerCase().includes(q) ||
            (x.story.summary || "").toLowerCase().includes(q) ||
            (x.story.tags || []).some((t) => t.toLowerCase().includes(q))
          );
        })
      : scored;
    return filtered.slice(0, 50);
  }, [from, allStories, search]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = async () => {
    if (!selectedTo) return;
    setSubmitting(true);
    setError("");
    const r = await mergeStoriesByApi(from.id, selectedTo, reason.trim() || undefined);
    if (r.ok) {
      onMerged();
    } else {
      setError(r.error || "統合に失敗");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h3 className="text-base font-bold">ストーリー統合</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            このストーリーを他のストーリーに合流させる（このストーリーは削除され、シグナルは合流先に移動）
          </p>
        </div>

        {/* From */}
        <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-900/10 dark:border-rose-900/40">
          <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider mb-1">
            合流元（削除される）
          </p>
          <p className="text-sm font-medium leading-snug">{from.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{from.signals.length} signals</p>
        </div>

        {/* Search */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 合流先を絞り込み"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        {/* Candidates */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {candidates.map(({ story }) => {
            const dKey = domainKey(story.primary_domain);
            return (
              <button
                key={story.id}
                onClick={() => setSelectedTo(story.id)}
                className={cn(
                  "w-full text-left p-2.5 rounded-lg border text-sm transition-colors",
                  selectedTo === story.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  {dKey && (
                    <span
                      className="text-[10px] font-bold px-1 py-0 rounded text-white"
                      style={{ background: domainColor(dKey) }}
                    >
                      {domainLabel(dKey)}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">
                    {story.signals.length} signals
                  </span>
                </div>
                <p className="font-medium leading-snug">{story.title}</p>
              </button>
            );
          })}
        </div>

        {/* Reason (学習用ヒント) */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
            理由（次回以降のえいみの学習に使う・任意）
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例: どちらもホルムズ海峡封鎖の連鎖事象"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTo || submitting}
            className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
          >
            {submitting ? "統合中…" : "統合する"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoveSignalModal({
  signal,
  fromStoryTitle,
  allStories,
  onClose,
  onMoved,
}: {
  signal: AtlasSignal;
  fromStoryTitle: string;
  allStories: StoryWithSignals[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [selectedTo, setSelectedTo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // 候補ソート: 同じ primary_domain → タグの重複度 → signal_count
  const candidates = useMemo(() => {
    const sigDomain = domainKey(signal.domain);
    const sigTagSet = new Set(signal.suggested_tags || []);
    const others = allStories.filter((s) => s.id !== signal.story_id);
    const scored = others.map((s) => {
      const sameDomain = domainKey(s.primary_domain) === sigDomain ? 1 : 0;
      const tagOverlap = (s.tags || []).filter((t) => sigTagSet.has(t)).length;
      return {
        story: s,
        score: sameDomain * 100 + tagOverlap * 10 + s.signals.length,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    const filtered = search.trim()
      ? scored.filter((x) => {
          const q = search.toLowerCase();
          return (
            x.story.title.toLowerCase().includes(q) ||
            (x.story.summary || "").toLowerCase().includes(q) ||
            (x.story.tags || []).some((t) => t.toLowerCase().includes(q))
          );
        })
      : scored;
    return filtered.slice(0, 50);
  }, [signal, allStories, search]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = async () => {
    if (!selectedTo) return;
    setSubmitting(true);
    setError("");
    const r = await moveSignal(signal.id, "moveToExisting", { targetStoryId: selectedTo });
    if (r.ok) {
      onMoved();
    } else {
      setError(r.error || "移植に失敗");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h3 className="text-base font-bold">シグナルを別のストーリーへ移植</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            このシグナルを現在のストーリーから外し、選んだ既存ストーリーに付け替える
          </p>
        </div>

        {/* Signal */}
        <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900/40">
          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
            移植するシグナル（元: {fromStoryTitle}）
          </p>
          <p className="text-sm font-medium leading-snug">{signal.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
            {signal.content}
          </p>
        </div>

        {/* Search */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 移植先を絞り込み"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        {/* Candidates */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {candidates.map(({ story }) => {
            const dKey = domainKey(story.primary_domain);
            return (
              <button
                key={story.id}
                onClick={() => setSelectedTo(story.id)}
                className={cn(
                  "w-full text-left p-2.5 rounded-lg border text-sm transition-colors",
                  selectedTo === story.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  {dKey && (
                    <span
                      className="text-[10px] font-bold px-1 py-0 rounded text-white"
                      style={{ background: domainColor(dKey) }}
                    >
                      {domainLabel(dKey)}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">
                    {story.signals.length} signals
                  </span>
                </div>
                <p className="font-medium leading-snug">{story.title}</p>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTo || submitting}
            className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
          >
            {submitting ? "移植中…" : "ここに移植"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrphanSignalRow({
  signal,
  onTagClick,
  activeTag,
}: {
  signal: AtlasSignal;
  onTagClick: (t: string) => void;
  activeTag: string | null;
}) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded",
            importanceBadge[signal.importance]
          )}
        >
          {signal.importance.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{signal.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {signal.content}
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          {formatDate(signal.submitted_at)}
        </span>
      </div>
      {signal.suggested_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {signal.suggested_tags.slice(0, 6).map((t) => (
            <button
              key={t}
              onClick={() => onTagClick(t)}
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full border transition-colors hover:brightness-95"
              )}
              style={tagStyle(t, activeTag === t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
