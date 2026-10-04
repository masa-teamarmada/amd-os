"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { bookProgressFraction } from "@/lib/bzm-reader/progress";
import { loadReaderPosition } from "@/lib/bzm-reader/storage";
import {
  READING_CHARS_PER_MINUTE,
  readerChapterHref,
  type ReaderBookInfo,
  type ReaderBookKind,
  type ReaderPosition,
} from "@/lib/bzm-reader/types";

const KIND_LABEL: Record<ReaderBookKind, string> = {
  textbook: "教科書",
  book: "本",
  paper: "論文",
  course: "講座",
};

/** 文字数を「約2.7万字」「約8,400字」の形にする */
function formatChars(n: number): string {
  if (n >= 10000) return `約${(Math.round(n / 1000) / 10).toString()}万字`;
  return `約${(Math.round(n / 100) * 100).toLocaleString("ja-JP")}字`;
}

/** 通読の目安。5分刻みに丸め、1時間を超えたら「時間」を足す */
function formatMinutes(chars: number, lang: ReaderBookInfo["lang"]): string {
  const minutes = Math.max(1, Math.round(chars / READING_CHARS_PER_MINUTE[lang]));
  if (minutes < 60) return `約${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = Math.round((minutes % 60) / 5) * 5;
  return m === 0 || m === 60 ? `約${m === 60 ? h + 1 : h}時間` : `約${h}時間${m}分`;
}

const subscribeNever = () => () => {};

/** サーバ描画と最初のクライアント描画では false、ハイドレーション後に true */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

export function LibraryShelf({ books }: { books: ReaderBookInfo[] }) {
  // localStorage はハイドレーション後に読む。サーバ描画と食い違わないよう、初回は位置を出さない。
  const hydrated = useHydrated();
  const positions = useMemo<Record<string, ReaderPosition | null> | null>(() => {
    if (!hydrated) return null;
    const next: Record<string, ReaderPosition | null> = {};
    for (const book of books) next[book.id] = loadReaderPosition(book.id);
    return next;
  }, [hydrated, books]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {books.map((book) => (
        <BookCard key={book.id} book={book} position={positions?.[book.id] ?? null} />
      ))}
    </div>
  );
}

function BookCard({ book, position }: { book: ReaderBookInfo; position: ReaderPosition | null }) {
  const router = useRouter();
  const firstWritten = book.chapters.find((c) => c.exists);
  const hasWritten = book.writtenCount > 0 && firstWritten !== undefined;

  const lastChapter = position
    ? book.chapters.find((c) => c.slug === position.chapterSlug && c.exists)
    : undefined;
  // 主ボタンの行き先は章への直接リンク。入口の頁（/bzm/read/<本>）を挟まないので、先読みも読む章に効く。
  // 端末に位置があれば続きの章、無ければ最初の書けている章。
  const primaryHref = firstWritten
    ? readerChapterHref(book.id, (lastChapter ?? firstWritten).slug)
    : null;
  // 続きがあるときだけ、2つ目のボタン「最初から読む」を出す。最初の書けている章を、保存位置ではなく先頭のページから開く。
  // 章を選ぶ一覧は置かない（読書画面の左の目次で章を選べる）
  const restartHref = lastChapter && firstWritten ? readerChapterHref(book.id, firstWritten.slug, "start") : null;
  const progress =
    position && lastChapter ? bookProgressFraction(book, position.chapterSlug, position.fraction) : null;

  const prefetch = (href: string) => {
    try {
      router.prefetch(href);
    } catch {
      // 先読みの失敗は表示に関係しない
    }
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10">
      {/* 表紙代わりの帯。画像は使わず色と題だけで本の見分けを付ける */}
      <div
        className="flex min-h-24 flex-col justify-between gap-2 px-4 py-3 text-white"
        style={{ backgroundColor: book.accent }}
      >
        <span className="self-start rounded-full bg-black/25 px-2 py-0.5 text-xs font-medium">
          {KIND_LABEL[book.kind]}
        </span>
        <h2 className="text-base font-bold leading-snug" lang={book.lang}>
          {book.title}
        </h2>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <p className="leading-relaxed text-muted-foreground">{book.description}</p>

        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>
            {book.totalCount}章中{book.writtenCount}章を執筆済み
          </p>
          <p>
            {formatChars(book.totalChars)}・通読の目安 {formatMinutes(book.totalChars, book.lang)}
          </p>
        </div>

        {lastChapter && progress !== null ? (
          <div className="space-y-1.5">
            <p className="text-xs text-foreground">
              前回: {lastChapter.title}・本全体 {Math.round(progress * 100)}%
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: book.accent }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {hasWritten && primaryHref ? (
            <Link
              href={primaryHref}
              onPointerEnter={() => prefetch(primaryHref)}
              onFocus={() => prefetch(primaryHref)}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {lastChapter ? "続きから読む" : "最初から読む"}
            </Link>
          ) : (
            <span className="inline-flex h-11 items-center rounded-lg bg-muted px-4 text-sm text-muted-foreground">
              執筆前
            </span>
          )}
          {restartHref ? (
            <Link
              href={restartHref}
              onPointerEnter={() => prefetch(restartHref)}
              onFocus={() => prefetch(restartHref)}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              最初から読む
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
