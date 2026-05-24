import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownView } from "@/components/cockpit/MarkdownView";

/**
 * /manual/[slug] — AMD OS マニュアル各章
 *
 * pwa/manual/{slug}.md を fs で読んで MarkdownView でレンダリング。
 * (まさ #23 確定 2026-05-24)
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
  const source = fs.readFileSync(filePath, "utf8");

  // 章一覧 (= prev/next ナビ用)
  const allFiles = fs
    .readdirSync(path.join(process.cwd(), "manual"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
  const idx = allFiles.indexOf(decoded);
  const prev = idx > 0 ? allFiles[idx - 1] : null;
  const next = idx >= 0 && idx < allFiles.length - 1 ? allFiles[idx + 1] : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center gap-3 text-xs">
        <Link href="/manual" className="text-muted-foreground hover:text-foreground">
          ← マニュアル目次
        </Link>
      </div>
      <article className="prose prose-sm max-w-none">
        <MarkdownView source={source} tone="light" />
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
  );
}
