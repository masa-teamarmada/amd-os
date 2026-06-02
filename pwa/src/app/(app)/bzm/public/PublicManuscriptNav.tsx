"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PublicManuscriptPart } from "./public-manuscript";

export function PublicManuscriptNav({
  parts,
  activeSlug,
}: {
  parts: PublicManuscriptPart[];
  activeSlug: string;
}) {
  const initialOpen = useMemo(() => Object.fromEntries(parts.map((part) => [part.key, true])), [parts]);
  const [openById, setOpenById] = useState<Record<string, boolean>>(initialOpen);

  function toggle(key: string) {
    setOpenById((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 border-b border-slate-200 pb-2">
        <Link href="/bzm/public" className="text-sm font-black text-slate-950 hover:underline">
          Before Zero 公開原稿 — 目次
        </Link>
      </div>
      <div className="space-y-2">
        {parts.map((part) => {
          const isOpen = Boolean(openById[part.key]);
          const isToolkit = part.key === "toolkit";
          return (
            <div
              key={part.key}
              className={`border-b pb-2 last:border-b-0 last:pb-0 ${
                isToolkit ? "mt-3 rounded-md border-amber-200 bg-amber-50/60 px-1.5 pt-1.5" : "border-slate-100"
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggle(part.key)}
                  className="grid size-5 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  aria-label={isOpen ? `${part.label} を閉じる` : `${part.label} を開く`}
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggle(part.key)}
                  className={`min-w-0 flex-1 rounded-md px-1.5 py-1 text-left leading-snug transition-colors ${
                    isToolkit ? "text-amber-950 hover:bg-amber-100/70" : "text-slate-950 hover:bg-slate-50"
                  }`}
                >
                  <span className="min-w-0 truncate text-[12px] font-black">{part.label}</span>
                </button>
              </div>
              {isOpen && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {part.chapters.map((chapter) => {
                    const isActive = chapter.slug === activeSlug;
                    return (
                      <Link
                        key={chapter.slug}
                        href={`/bzm/public/${encodeURIComponent(chapter.slug)}`}
                        className={`grid grid-cols-[2.4rem_minmax(0,1fr)] gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] leading-snug transition-colors ${
                          isActive
                            ? isToolkit
                              ? "bg-amber-100 font-black text-amber-950 ring-1 ring-amber-300"
                              : "bg-cyan-50 font-black text-cyan-950 ring-1 ring-cyan-200"
                            : isToolkit
                              ? "font-semibold text-amber-900 hover:bg-amber-100/70 hover:text-amber-950"
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
