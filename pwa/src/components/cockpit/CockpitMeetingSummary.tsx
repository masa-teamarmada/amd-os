"use client";

import { useEffect, useState } from "react";
import { fetchSourceCache, type SourceCacheItem } from "@/lib/supabase-data";

interface Props {
  projectId: string;
}

export function CockpitMeetingSummary({ projectId }: Props) {
  const [items, setItems] = useState<SourceCacheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchSourceCache(projectId, "calendar", undefined, 20)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [projectId]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <section className="bg-white rounded-xl border border-[#e5e5e7] px-4 py-3.5">
      <h3 className="text-[13px] font-medium mb-2">MTGサマリ</h3>

      {loading ? (
        <p className="text-[12px] text-[#86868b]">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-[12px] text-[#86868b]">議事録データなし</p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[340px] overflow-y-auto">
          {items.map((item) => {
            const isOpen = expanded === item.cacheId;
            const excerpt = item.contentText.length > 120
              ? item.contentText.slice(0, 120) + "..."
              : item.contentText;

            return (
              <div
                key={item.cacheId}
                className="border border-[#f0f0f2] rounded-lg px-3 py-2 cursor-pointer hover:bg-[#fafafa] transition-colors"
                onClick={() => setExpanded(isOpen ? null : item.cacheId)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#86868b] shrink-0 tabular-nums">
                    {formatDate(item.itemDate)}
                  </span>
                  <span className="text-[11px] text-[#86868b] shrink-0 tabular-nums">
                    {formatTime(item.itemDate)}
                  </span>
                  <span className="text-[12px] font-medium truncate">{item.title}</span>
                </div>

                {isOpen && (
                  <div className="mt-2 text-[12px] text-[#1d1d1f] whitespace-pre-wrap leading-relaxed border-t border-[#f0f0f2] pt-2">
                    {item.contentText}
                  </div>
                )}

                {!isOpen && item.contentText && (
                  <p className="mt-1 text-[11px] text-[#86868b] line-clamp-2">
                    {excerpt}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
