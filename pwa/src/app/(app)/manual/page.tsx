import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ManualMapClient } from "./ManualMapClient";
import {
  MANUAL_CHAPTERS,
  MANUAL_SECTIONS,
  MANUAL_TOPIC_NODES,
  getManualChapter,
  sortManualSlugs,
  type ManualChapterConfig,
} from "./manual-chapters";

/**
 * /manual — AMD OS マニュアル index
 *
 * テーマ別クリックマップを主役にし、目次を全章リンクの保険として残す。
 */

function getChapters(): ManualChapterConfig[] {
  const dir = path.join(process.cwd(), "manual");
  const files = sortManualSlugs(fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")));

  return files.map((file) => {
    const slug = file;
    const text = fs.readFileSync(path.join(dir, `${file}.md`), "utf8");
    const lines = text.split("\n");
    const h1 = lines.find((line) => line.startsWith("# "))?.replace(/^# /, "").trim() || slug;
    let summary = "";
    const h1Idx = lines.findIndex((line) => line.startsWith("# "));

    if (h1Idx >= 0) {
      for (let i = h1Idx + 1; i < lines.length && i < h1Idx + 20; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith("#")) break;
        if (line.startsWith("> ")) continue;
        summary = line.replace(/[*_`]/g, "").slice(0, 120);
        break;
      }
    }

    return getManualChapter(slug) ?? {
      slug,
      number: "--",
      title: h1,
      summary,
      audience: "both",
      topics: [],
    };
  });
}

export default function ManualIndexPage() {
  const chapters = getChapters();
  const bySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]));
  const groupedSlugs = new Set(MANUAL_SECTIONS.flatMap((section) => section.slugs));
  const configuredSlugs = new Set(MANUAL_CHAPTERS.map((chapter) => chapter.slug));
  const uncategorized = chapters.filter((chapter) => !groupedSlugs.has(chapter.slug));
  const missingMetadata = chapters.filter((chapter) => !configuredSlugs.has(chapter.slug));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold">AMD OS マニュアル</h1>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        AMD OS の使い方・データの裏側・過去判断・開発手順の正本。テーマから入り、気になる章へ横移動できる地図として使う。
      </p>

      <ManualMapClient chapters={chapters} topics={MANUAL_TOPIC_NODES} />

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="text-base font-semibold text-foreground">目次</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            全章へのリンク一覧。クリックマップに出ていない章があっても、ここから必ず辿れる。
          </p>
        </section>

        {MANUAL_SECTIONS.map((section) => {
          const sectionChapters = section.slugs.map((slug) => bySlug.get(slug)).filter(Boolean) as ManualChapterConfig[];
          if (sectionChapters.length === 0) return null;

          return (
            <section key={section.key}>
              <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {sectionChapters.map((chapter) => (
                  <li key={chapter.slug}>
                    <Link
                      href={`/manual/${encodeURIComponent(chapter.slug)}`}
                      className="block rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-foreground">
                          {chapter.number}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{chapter.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{chapter.summary}</span>
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {missingMetadata.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-foreground">メタデータ未設定</h3>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {missingMetadata.map((chapter) => (
                <li key={chapter.slug}>
                  <Link
                    href={`/manual/${encodeURIComponent(chapter.slug)}`}
                    className="block rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="text-sm font-semibold text-foreground">{chapter.title}</div>
                    {chapter.summary && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{chapter.summary}</div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {uncategorized.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-foreground">未分類</h3>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {uncategorized.map((chapter) => (
                <li key={chapter.slug}>
                  <Link
                    href={`/manual/${encodeURIComponent(chapter.slug)}`}
                    className="block rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="text-sm font-semibold text-foreground">{chapter.title}</div>
                    {chapter.summary && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{chapter.summary}</div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold text-foreground">全章一覧</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {chapters.map((chapter) => (
              <Link
                key={chapter.slug}
                href={`/manual/${encodeURIComponent(chapter.slug)}`}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {chapter.number}. {chapter.title}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        正本: <code className="rounded bg-muted px-1">pwa/manual/*.md</code> (= git 管理)。
        新規セッション開始時 / 「なぜそうなってるか」を知りたい時に開く。
      </p>
    </div>
  );
}
