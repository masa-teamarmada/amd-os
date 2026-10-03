import Link from "next/link";
import { notFound } from "next/navigation";
import { getFirstWrittenChapterSlug, getReaderBook } from "@/lib/bzm-reader/load";
import { requireReaderAdmin } from "@/lib/bzm-reader/require-reader-admin";
import { ResumeRedirect } from "./ResumeRedirect";

/**
 * /bzm/read/[book] — 続きから開く入口。
 * 読書位置は端末の localStorage にあり、サーバは知らない。章の一覧だけ渡して、
 * 行き先の決定（位置の章か、最初の書けている章か）は ResumeRedirect に任せる。
 */
export default async function BzmReaderBookPage({ params }: { params: Promise<{ book: string }> }) {
  await requireReaderAdmin();
  const { book: rawBook } = await params;
  const book = getReaderBook(decodeURIComponent(rawBook));
  if (!book) notFound();

  const firstSlug = getFirstWrittenChapterSlug(book);
  if (!firstSlug) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="mb-2 text-lg font-bold">{book.title}</h1>
        <p className="mb-6 text-sm text-muted-foreground">執筆済みの章なし</p>
        <Link
          href="/bzm/read"
          className="inline-flex h-11 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          書斎へ戻る
        </Link>
      </div>
    );
  }

  return (
    <ResumeRedirect
      bookId={book.id}
      chapters={book.chapters.map((c) => ({ slug: c.slug, exists: c.exists }))}
      firstSlug={firstSlug}
    />
  );
}
