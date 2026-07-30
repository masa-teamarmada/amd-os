"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, CheckCircle2, CircleDot, Circle, Network } from "lucide-react";
import type { BzmChapterLevel, BzmChapterStatus } from "@/app/(app)/bzm/bzm-chapters";

export interface BzmSideNavGroup {
  key: string;
  label: string;
  chapters: {
    slug: string;
    number: string;
    title: string;
    status?: BzmChapterStatus;
    level?: BzmChapterLevel;
  }[];
}

/**
 * 教科書の左サイドバー目次 (= manual の ManualGlobalToc 相当)。
 * BZM_PARTS でグループ化し、現在表示中の章をハイライトする。
 * 各 chapter に status (completed / in-progress / not-started / legacy) を持たせ、
 * 完成済セクションは緑チェック、進行中は黄半円、未着手はグレー丸でアイコン + 色を変える。
 */
export function BzmSideNav({
  groups,
  activeSlug,
}: {
  groups: BzmSideNavGroup[];
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
        <Link href="/bzm" className="text-sm font-black text-slate-950 hover:underline">
          教科書 — 目次
        </Link>
        <Link
          href="/bzm/map"
          className="mt-2 flex items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1.5 text-[11px] font-bold text-cyan-900 transition-colors hover:bg-cyan-100"
        >
          <Network className="size-3.5" aria-hidden="true" />
          理論マップ (論証台帳)
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-0.5">
            <CheckCircle2 className="size-3 text-emerald-600" />
            完成
          </span>
          <span className="inline-flex items-center gap-0.5">
            <CircleDot className="size-3 text-amber-500" />
            進行中
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Circle className="size-3 text-slate-300" />
            未着手
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Circle className="size-3 text-slate-400" />
            旧版アーカイブ
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {groups.map(({ key, label, chapters }) => {
          const isOpen = Boolean(openById[key]);
          const completedCount = chapters.filter((c) => c.status === "completed").length;
          const inProgressCount = chapters.filter((c) => c.status === "in-progress").length;
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
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate text-[12px] font-black">{label}</span>
                    {(completedCount > 0 || inProgressCount > 0) && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-600">
                        {completedCount > 0 && <span className="text-emerald-700">{completedCount}</span>}
                        {completedCount > 0 && inProgressCount > 0 && <span>/</span>}
                        {inProgressCount > 0 && <span className="text-amber-700">{inProgressCount}</span>}
                        {(completedCount > 0 || inProgressCount > 0) && <span>/{chapters.length}</span>}
                      </span>
                    )}
                  </span>
                </button>
              </div>
              {isOpen && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {chapters.map((chapter) => {
                    const isActive = chapter.slug === activeSlug;
                    const status: BzmChapterStatus = chapter.status ?? "not-started";
                    const level: BzmChapterLevel = chapter.level ?? 1;
                    const statusIcon =
                      status === "completed" ? (
                        <CheckCircle2 className="size-3 text-emerald-600" aria-label="完成" />
                      ) : status === "in-progress" ? (
                        <CircleDot className="size-3 text-amber-500" aria-label="進行中" />
                      ) : status === "legacy" ? (
                        <Circle className="size-3 text-slate-400" aria-label="旧版アーカイブ" />
                      ) : (
                        <Circle className="size-3 text-slate-300" aria-label="未着手" />
                      );
                    // level 別 indent (章 = 0, 節 = ml-3, サブセクション = ml-6) と文字サイズ・太さ
                    const levelClass =
                      level === 1
                        ? "ml-0 text-[11px]"
                        : level === 2
                          ? "ml-3 text-[10.5px]"
                          : "ml-6 text-[10px]";
                    // level 別 font weight (章 = bold/black, 節 = semibold, サブセクション = medium)
                    const levelWeight =
                      level === 1
                        ? status === "completed"
                          ? "font-black"
                          : "font-bold"
                        : level === 2
                          ? "font-semibold"
                          : "font-medium";
                    const textTone =
                      status === "completed"
                        ? "text-emerald-950"
                        : status === "in-progress"
                          ? "text-amber-950"
                          : status === "legacy"
                            ? "text-slate-600"
                            : "text-slate-400";
                    const bgTone = isActive
                      ? "bg-cyan-50 ring-1 ring-cyan-200"
                      : status === "completed"
                        ? "hover:bg-emerald-50"
                        : status === "in-progress"
                          ? "hover:bg-amber-50"
                          : "hover:bg-slate-50";
                    return (
                      <Link
                        key={chapter.slug}
                        href={`/bzm/${encodeURIComponent(chapter.slug)}`}
                        className={`grid grid-cols-[1rem_minmax(0,1fr)] gap-1.5 rounded-md px-1.5 py-1.5 leading-snug transition-colors ${levelClass} ${bgTone} ${
                          isActive ? "font-black text-cyan-950" : `${textTone} ${levelWeight}`
                        }`}
                      >
                        <span className="grid place-items-center">{statusIcon}</span>
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
