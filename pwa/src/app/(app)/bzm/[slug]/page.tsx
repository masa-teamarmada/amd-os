import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BzmMarkdown } from "@/components/bzm/BzmMarkdown";
import { BzmSideNav, type BzmSideNavGroup } from "@/components/bzm/BzmSideNav";
import { applyBzmBookNumbering, BZM_CHAPTERS, BZM_PARTS, getBzmChapter, sortBzmSlugs } from "../bzm-chapters";
import { normalizeBzmMarkdownSource } from "../bzm-data";

/**
 * /bzm/[slug] — 教科書の各章
 *
 * pwa/bzm/{slug}.md を fs で読み、BzmMarkdown (= 数式対応 renderer) で描画。
 * h1 に part-chapter 番号 (= "5-1" 等) を動的注入する。
 */

function bzmDir() {
  return path.join(process.cwd(), "bzm");
}

export async function generateStaticParams() {
  const dir = bzmDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ slug: f.replace(/\.md$/, "") }));
}

export default async function BzmChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const filePath = path.join(bzmDir(), `${decoded}.md`);
  if (!fs.existsSync(filePath)) {
    notFound();
  }
  const rawSource = fs.readFileSync(filePath, "utf8");

  let displaySource = rawSource;
  const chapter = getBzmChapter(decoded);
  if (chapter) {
    const numbered = applyBzmBookNumbering(BZM_CHAPTERS).find((c) => c.slug === decoded);
    if (numbered) {
      displaySource = normalizeBzmMarkdownSource(rawSource, numbered);
    }
  }

  const allFiles = fs
    .readdirSync(bzmDir())
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
  const sorted = sortBzmSlugs(allFiles);
  const idx = sorted.indexOf(decoded);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const numbered = applyBzmBookNumbering(BZM_CHAPTERS);
  const prevChapter = prev ? numbered.find((c) => c.slug === prev) : null;
  const nextChapter = next ? numbered.find((c) => c.slug === next) : null;

  const numberBySlug = new Map(numbered.map((c) => [c.slug, c]));
  const navGroups: BzmSideNavGroup[] = BZM_PARTS.map((part) => ({
    key: part.key,
    label: part.label,
    chapters: part.slugs
      .map((s) => numberBySlug.get(s))
      .filter((c): c is (typeof numbered)[number] => c != null)
      .map((c) => ({ slug: c.slug, number: c.number, title: c.title })),
  })).filter((group) => group.chapters.length > 0);

  return (
    <section className="grid gap-6 px-6 py-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <BzmSideNav groups={navGroups} activeSlug={decoded} />
      </aside>

      <div className="min-w-0">
        <article className="mx-auto max-w-3xl">
          <BzmMarkdown source={displaySource} />

          <nav className="mt-10 flex justify-between gap-4 border-t border-border pt-4 text-xs">
            {prev ? (
              <Link href={`/bzm/${encodeURIComponent(prev)}`} className="text-muted-foreground hover:text-foreground">
                ← {prevChapter ? `${prevChapter.number} ${prevChapter.title}` : prev}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/bzm/${encodeURIComponent(next)}`} className="text-right text-muted-foreground hover:text-foreground">
                {nextChapter ? `${nextChapter.number} ${nextChapter.title}` : next} →
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
