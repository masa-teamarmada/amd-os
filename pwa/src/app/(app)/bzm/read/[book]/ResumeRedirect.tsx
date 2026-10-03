"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { loadReaderPosition } from "@/lib/bzm-reader/storage";
import { readerChapterHref } from "@/lib/bzm-reader/types";

/**
 * 端末に残った読書位置の章へ移る。位置の章が未執筆・不明なら最初の書けている章へ。
 * history を汚さないよう replace で移る（戻るで入口に戻って再び飛ばされるのを防ぐ）。
 */
export function ResumeRedirect({
  bookId,
  chapters,
  firstSlug,
}: {
  bookId: string;
  chapters: { slug: string; exists: boolean }[];
  firstSlug: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const position = loadReaderPosition(bookId);
    const target =
      position && chapters.some((c) => c.slug === position.chapterSlug && c.exists)
        ? position.chapterSlug
        : firstSlug;
    router.replace(readerChapterHref(bookId, target));
  }, [bookId, chapters, firstSlug, router]);

  // 移るまでの骨組み。何も出さないと、遅いのか壊れたのか区別できない
  return (
    <div className="flex min-h-dvh items-center justify-center px-4" role="status" aria-live="polite">
      <div className="w-full max-w-md space-y-3">
        <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <p className="pt-2 text-center text-xs text-muted-foreground">読み込み中</p>
      </div>
    </div>
  );
}
