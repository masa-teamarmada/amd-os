import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReaderMarkdown } from "@/components/bzm-reader/ReaderMarkdown";
import { ReaderView } from "@/components/bzm-reader/ReaderView";
import { getFirstWrittenChapterSlug, getReaderChapterContent } from "@/lib/bzm-reader/load";
import { requireReaderAdmin } from "@/lib/bzm-reader/require-reader-admin";
import { readerChapterHref, type ReaderTheme } from "@/lib/bzm-reader/types";

/**
 * /bzm/read/[book]/[chapter] — 読書画面。
 * 外枠（左ナビ・常駐 UI）は AppShell が usePathname で外す（isBzmReaderRoute）。
 * Markdown はサーバで HTML にし、ReaderView（ブラウザ部品）には children で渡す。
 * 背景色は Cookie（storage.ts が設定の保存時に書く）をサーバで読み、最初の描画から正しい色で出す。
 */

type Params = Promise<{ book: string; chapter: string }>;

/** storage.ts の saveReaderSettings が書く Cookie の名前 */
const THEME_COOKIE = "amd-os.bzm-reader.theme";

function parseTheme(value: string | undefined): ReaderTheme | undefined {
  return value === "white" || value === "sepia" || value === "black" ? value : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await requireReaderAdmin();
  const { book, chapter } = await params;
  const content = getReaderChapterContent(decodeURIComponent(book), decodeURIComponent(chapter));
  if (!content) return { title: "書斎 - AMD OS" };
  return { title: `${content.chapter.title} - ${content.book.title} - AMD OS` };
}

export default async function BzmReaderChapterPage({ params }: { params: Params }) {
  await requireReaderAdmin();
  const { book: rawBook, chapter: rawChapter } = await params;
  const content = getReaderChapterContent(decodeURIComponent(rawBook), decodeURIComponent(rawChapter));
  if (!content) notFound();

  const { book, chapterIndex, chapter, headings, notes, markdown } = content;

  if (!chapter.exists) {
    const firstSlug = getFirstWrittenChapterSlug(book);
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="mb-1 text-xs text-muted-foreground">{book.title}</p>
        <h1 className="mb-2 text-lg font-bold" lang={book.lang}>
          {chapter.title}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">この章は未執筆</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {firstSlug ? (
            <Link
              href={readerChapterHref(book.id, firstSlug)}
              className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              最初の書けている章へ
            </Link>
          ) : null}
          <Link
            href="/bzm/read"
            className="inline-flex h-11 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            書斎へ戻る
          </Link>
        </div>
      </div>
    );
  }

  const initialTheme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <ReaderView content={{ book, chapterIndex, chapter, headings, notes }} initialTheme={initialTheme}>
      <ReaderMarkdown markdown={markdown} lang={book.lang} />
    </ReaderView>
  );
}
