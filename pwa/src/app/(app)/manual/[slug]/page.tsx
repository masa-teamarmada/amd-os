import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownView } from "@/components/cockpit/MarkdownView";
import { ManualMapClient } from "../ManualMapClient";
import {
  MANUAL_TOPIC_NODES,
  getManualChapter,
  isChapterVisibleForAudience,
  isTopicVisibleForAudience,
  sortManualSlugs,
  type ManualAudience,
} from "../manual-chapters";
import {
  getManualBookChapters,
  getManualChapters,
  getManualMarkdownSlugs,
  getManualMarkdownSource,
  normalizeManualMarkdownSource,
} from "../manual-data";

/**
 * /manual/[slug] — AMD OS マニュアル各章
 *
 * 左固定メニューを維持しながら、pwa/manual/{slug}.md を MarkdownView でレンダリング。
 */

export async function generateStaticParams() {
  return getManualMarkdownSlugs().map((slug) => ({ slug }));
}

export default async function ManualChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const source = getManualMarkdownSource(decoded);
  if (!source) {
    notFound();
  }

  const chapter = getManualChapter(decoded);
  const audience: ManualAudience = chapter?.audience === "developer" ? "developer" : "user";
  const manualHref = audience === "developer" ? "/manual?audience=developer" : "/manual";

  const allChapters = getManualChapters();
  const chapters = getManualBookChapters(allChapters.filter((navChapter) => isChapterVisibleForAudience(navChapter, audience)));
  const numberedChapter = chapters.find((navChapter) => navChapter.slug === decoded);
  const renderedSource = numberedChapter ? normalizeManualMarkdownSource(source, numberedChapter) : source;
  const topicsForMenu = MANUAL_TOPIC_NODES.filter((topic) => isTopicVisibleForAudience(topic, audience));
  const sortedFiles = sortManualSlugs(chapters.map((navChapter) => navChapter.slug));
  const idx = sortedFiles.indexOf(decoded);
  const prev = idx > 0 ? sortedFiles[idx - 1] : null;
  const next = idx >= 0 && idx < sortedFiles.length - 1 ? sortedFiles[idx + 1] : null;
  const prevChapter = prev ? chapters.find((navChapter) => navChapter.slug === prev) : null;
  const nextChapter = next ? chapters.find((navChapter) => navChapter.slug === next) : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <ManualMapClient
        audience={audience}
        chapters={chapters}
        topics={topicsForMenu}
        activeChapterSlug={decoded}
        showDirectory={false}
      >
        <div className="max-w-3xl">
          <div className="mb-4 flex items-center gap-3 text-xs">
            <Link href={manualHref} className="text-muted-foreground hover:text-foreground">
              ← マニュアル目次
            </Link>
            {audience === "developer" && (
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-900">
                開発者向け
              </span>
            )}
          </div>
          <article className="prose prose-sm max-w-none">
            <MarkdownView source={renderedSource} tone="light" linkMode="manual" />
          </article>
          <nav className="mt-10 flex justify-between border-t border-border pt-4 text-xs">
            {prev ? (
              <Link href={`/manual/${encodeURIComponent(prev)}`} className="text-muted-foreground hover:text-foreground">
                ← {prevChapter ? `${prevChapter.number}. ${prevChapter.title}` : prev}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/manual/${encodeURIComponent(next)}`} className="text-muted-foreground hover:text-foreground">
                {nextChapter ? `${nextChapter.number}. ${nextChapter.title}` : next} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
      </ManualMapClient>
    </div>
  );
}
