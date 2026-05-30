"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface SpecSideNavGroup {
  key: string;
  label: string;
  chapters: { slug: string; number: string; title: string }[];
}

/**
 * 設計書 (/spec) の左サイドバー目次 (= bzm の BzmSideNav 相当)。
 * SPEC_SECTIONS でグループ化し、現在表示中の章をハイライトする。
 */
export function SpecSideNav({
  groups,
  activeSlug,
}: {
  groups: SpecSideNavGroup[];
  activeSlug?: string;
}) {
  const initialOpen = useMemo(
    () => Object.fromEntries(groups.map((group) => [group.key, true])),
    [groups],
  );
  const [openById, setOpenById] = useState<Record<string, boolean>>(initialOpen);

  useEffect(() => {
    setOpenById(initialOpen);
  }, [initialOpen]);

  if (groups.length === 0) return null;

  function toggle(key: string) {
    setOpenById((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 border-b border-slate-200 pb-2">
        <Link href="/spec" className="text-sm font-black text-slate-950 hover:underline">
          設計書 — 目次
        </Link>
      </div>
      <div className="space-y-2">
        {groups.map(({ key, label, chapters }) => {
          const isOpen = Boolean(openById[key]);
          return (
            <div key={key} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="grid size-5 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  aria-label={isOpen ? `${label} を閉じる` : `${label} を開く`}
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left leading-snug text-slate-950 transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate text-[12px] font-black">{label}</span>
                </button>
              </div>
              {isOpen && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {chapters.map((chapter) => {
                    const isActive = chapter.slug === activeSlug;
                    return (
                      <Link
                        key={chapter.slug}
                        href={`/spec/${encodeURIComponent(chapter.slug)}`}
                        className={`grid grid-cols-[2.4rem_minmax(0,1fr)] gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] leading-snug transition-colors ${
                          isActive
                            ? "bg-indigo-50 font-black text-indigo-950 ring-1 ring-indigo-200"
                            : "font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                        }`}
                      >
                        <span className="tabular-nums text-slate-500">{chapter.number}</span>
                        <span className="min-w-0">{chapter.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
