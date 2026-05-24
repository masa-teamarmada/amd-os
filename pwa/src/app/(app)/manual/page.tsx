import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { MANUAL_SECTIONS, sortManualSlugs } from "./manual-chapters";

/**
 * /manual — AMD OS マニュアル index
 *
 * pwa/manual/ 配下の章 md ファイル一覧 + 各章 1 行 description を表示。
 * (まさ #23 確定 2026-05-24)
 */

interface ChapterMeta {
  slug: string;
  title: string;
  description: string;
}

function getChapters(): ChapterMeta[] {
  const dir = path.join(process.cwd(), "manual");
  const files = sortManualSlugs(fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")));
  return files.map((f) => {
    const slug = f;
    const text = fs.readFileSync(path.join(dir, `${f}.md`), "utf8");
    const lines = text.split("\n");
    const h1 = lines.find((l) => l.startsWith("# "))?.replace(/^# /, "").trim() || slug;
    // 最初の h1 直後の non-empty 段落を description として拾う
    let description = "";
    const h1Idx = lines.findIndex((l) => l.startsWith("# "));
    if (h1Idx >= 0) {
      for (let i = h1Idx + 1; i < lines.length && i < h1Idx + 20; i++) {
        const l = lines[i].trim();
        if (!l) continue;
        if (l.startsWith("#")) break;
        if (l.startsWith("> ")) continue;
        description = l.replace(/[*_`]/g, "").slice(0, 120);
        break;
      }
    }
    return { slug, title: h1, description };
  });
}

export default function ManualIndexPage() {
  const chapters = getChapters();
  const bySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]));
  const groupedSlugs = new Set(MANUAL_SECTIONS.flatMap((section) => section.slugs));
  const uncategorized = chapters.filter((chapter) => !groupedSlugs.has(chapter.slug));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold mb-1">📖 AMD OS マニュアル</h1>
      <p className="text-sm text-muted-foreground mb-6">
        AMD OS の使い方・データの裏側・過去判断・開発手順の正本。まず「使う人向け」、必要に応じて「全体設計・細かい仕様」を読む。
      </p>

      <div className="space-y-6">
        {MANUAL_SECTIONS.map((section) => {
          const sectionChapters = section.slugs.map((slug) => bySlug.get(slug)).filter(Boolean) as ChapterMeta[];
          if (sectionChapters.length === 0) return null;
          return (
            <section key={section.key}>
              <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
                {sectionChapters.map((c) => (
                  <li key={c.slug} className="px-4 py-3 transition-colors hover:bg-muted/30">
                    <Link href={`/manual/${encodeURIComponent(c.slug)}`} className="block">
                      <div className="text-sm font-semibold text-foreground">{c.title}</div>
                      {c.description && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {uncategorized.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-foreground">未分類</h2>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {uncategorized.map((c) => (
                <li key={c.slug} className="px-4 py-3 transition-colors hover:bg-muted/30">
                  <Link href={`/manual/${encodeURIComponent(c.slug)}`} className="block">
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                    {c.description && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-6">
        正本: <code className="rounded bg-muted px-1">pwa/manual/*.md</code> (= git 管理)。
        新規セッション開始時 / 「なぜそうなってるか」を知りたい時に開く。
      </p>
    </div>
  );
}
