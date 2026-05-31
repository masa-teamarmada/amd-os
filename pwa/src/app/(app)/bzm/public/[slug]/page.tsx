import Link from "next/link";
import { notFound } from "next/navigation";
import { BzmMarkdown } from "@/components/bzm/BzmMarkdown";
import { PublicManuscriptNav } from "../PublicManuscriptNav";
import {
  getPublicManuscriptChapter,
  getPublicManuscriptMarkdown,
  PUBLIC_MANUSCRIPT_CHAPTERS,
  PUBLIC_MANUSCRIPT_PARTS,
} from "../public-manuscript";

export function generateStaticParams() {
  return PUBLIC_MANUSCRIPT_CHAPTERS.map((chapter) => ({ slug: chapter.slug }));
}

export default async function PublicManuscriptChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const chapter = getPublicManuscriptChapter(decoded);
  const source = getPublicManuscriptMarkdown(decoded);
  if (!chapter || source == null) {
    notFound();
  }

  const idx = PUBLIC_MANUSCRIPT_CHAPTERS.findIndex((item) => item.slug === decoded);
  const prev = idx > 0 ? PUBLIC_MANUSCRIPT_CHAPTERS[idx - 1] : null;
  const next = idx >= 0 && idx < PUBLIC_MANUSCRIPT_CHAPTERS.length - 1 ? PUBLIC_MANUSCRIPT_CHAPTERS[idx + 1] : null;

  return (
    <section className="grid gap-6 px-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <PublicManuscriptNav parts={PUBLIC_MANUSCRIPT_PARTS} activeSlug={decoded} />
      </aside>

      <div className="min-w-0">
        <div className="mx-auto mb-5 max-w-3xl rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs leading-relaxed text-cyan-950">
          公開本ドラフト。本文の主語は Before Zero の現場と読者に置き、会社紹介・内部運用語は出さない方針で作成中。
        </div>

        <article className="mx-auto max-w-3xl">
          <BzmMarkdown source={source} />

          <nav className="mt-10 flex justify-between gap-4 border-t border-border pt-4 text-xs">
            {prev ? (
              <Link href={`/bzm/public/${encodeURIComponent(prev.slug)}`} className="text-muted-foreground hover:text-foreground">
                ← {prev.number} {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/bzm/public/${encodeURIComponent(next.slug)}`} className="text-right text-muted-foreground hover:text-foreground">
                {next.number} {next.title} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>
      </div>
    </section>
  );
}
