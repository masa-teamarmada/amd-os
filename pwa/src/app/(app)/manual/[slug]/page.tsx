import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownView } from "@/components/cockpit/MarkdownView";
import { ManualMapClient } from "../ManualMapClient";
import { ManualTsukuyomiFloat } from "../ManualTsukuyomiFloat";
import {
  applyManualBookNumbering,
  getManualChapter,
  MANUAL_CHAPTERS,
  MANUAL_TOPIC_NODES,
  sortManualSlugs,
} from "../manual-chapters";
import { getManualBookChapters, getManualChapters, getManualSearchDocuments, normalizeManualMarkdownSource } from "../manual-data";

/**
 * /manual/[slug] — AMD OS マニュアル各章
 *
 * pwa/manual/{slug}.md を fs で読んで MarkdownView でレンダリング。
 * h1 / h2 prefix は md ファイルから外しておき (= 2026-05-26 まさ #87)、
 * 表示時に `normalizeManualMarkdownSource()` で section-chapter 形式 (= "4-5" など) の
 * 動的番号を注入する。 audience 切替は廃止 (= まさ #88) → 全章単一マニュアル。
 */

export async function generateStaticParams() {
  const dir = path.join(process.cwd(), "manual");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  return files.map((f) => ({ slug: f.replace(/\.md$/, "") }));
}

export default async function ManualChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const filePath = path.join(process.cwd(), "manual", `${decoded}.md`);
  if (!fs.existsSync(filePath)) {
    notFound();
  }
  const rawSource = fs.readFileSync(filePath, "utf8");

  // 章番号動的注入 (= 全章一括 numbering、 section-chapter 形式)
  let displaySource = rawSource;
  const chapter = getManualChapter(decoded);
  if (chapter) {
    const numbered = applyManualBookNumbering(MANUAL_CHAPTERS).find((c) => c.slug === decoded);
    if (numbered) {
      displaySource = normalizeManualMarkdownSource(rawSource, numbered);
    }
  }

  // 章一覧 (= prev/next ナビ用)
  const allFiles = fs
    .readdirSync(path.join(process.cwd(), "manual"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
  const sortedFiles = sortManualSlugs(allFiles);
  const idx = sortedFiles.indexOf(decoded);
  const prev = idx > 0 ? sortedFiles[idx - 1] : null;
  const next = idx >= 0 && idx < sortedFiles.length - 1 ? sortedFiles[idx + 1] : null;
  const chapters = getManualBookChapters(getManualChapters());
  const searchDocuments = getManualSearchDocuments();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <ManualMapClient chapters={chapters} topics={MANUAL_TOPIC_NODES} searchDocuments={searchDocuments} activeChapterSlug={decoded} showDirectory={false}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center gap-3 text-xs">
            <Link href="/manual" className="text-muted-foreground hover:text-foreground">
              ← マニュアル目次
            </Link>
          </div>
          <article className="prose prose-sm max-w-none">
            <MarkdownView source={displaySource} tone="light" linkMode="manual" />
          </article>
          <nav className="mt-10 flex justify-between border-t border-border pt-4 text-xs">
            {prev ? (
              <Link href={`/manual/${encodeURIComponent(prev)}`} className="text-muted-foreground hover:text-foreground">
                ← {prev}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/manual/${encodeURIComponent(next)}`} className="text-muted-foreground hover:text-foreground">
                {next} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
      </ManualMapClient>
      <ManualTsukuyomiFloat currentSlug={decoded} />
    </div>
  );
}
