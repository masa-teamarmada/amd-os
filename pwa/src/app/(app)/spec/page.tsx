import Link from "next/link";
import { SPEC_SECTIONS } from "./spec-chapters";
import { getSpecBookChapters, getSpecChapters } from "./spec-data";

/**
 * /spec — 設計書 index
 *
 * 内容正本は `pwa/spec/*.md` (= git 管理かつ OS 画面表示)。section ごとの目次を並べる。
 * 移行中のため、未移行領域は既存 `pwa/design/*.md` / manual 章を参照する。
 * 各章は `/spec/{slug}` へ。admin 限定 (= spec/layout.tsx で保護)。
 */
export default async function SpecIndexPage() {
  const chapters = getSpecBookChapters(getSpecChapters());
  const bySlug = new Map(chapters.map((c) => [c.slug, c]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">AMD OS — 設計書</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          AMD OS の確定した実装仕様の正本。画面 / route / API / cron / DB / 状態遷移 / 判断ロジックが
          どう動き・どう作られているかを集約します。数式・理論は{" "}
          <Link href="/bzm" className="text-indigo-600 underline hover:opacity-80">テキストブック</Link>、
          使い方は{" "}
          <Link href="/manual" className="text-indigo-600 underline hover:opacity-80">マニュアル</Link>
          へ。admin 限定。
        </p>
      </div>

      <div className="space-y-6">
        {SPEC_SECTIONS.map((section) => (
          <section key={section.key}>
            <div className="mb-2">
              <h2 className="text-base font-bold text-foreground">{section.label}</h2>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </div>
            <ul className="space-y-1.5">
              {section.slugs.map((slug) => {
                const chapter = bySlug.get(slug);
                if (!chapter) return null;
                return (
                  <li key={slug}>
                    <Link
                      href={`/spec/${encodeURIComponent(slug)}`}
                      className="flex items-baseline gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
                    >
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{chapter.number}</span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-foreground">{chapter.title}</span>
                        <span className="block text-xs text-muted-foreground">{chapter.summary}</span>
                        {chapter.aliases?.map((alias) => (
                          <span key={alias.slug} className="mt-1 block text-xs text-indigo-700">
                            旧リンク: {alias.title}
                          </span>
                        ))}
                      </span>
                    </Link>
                    {chapter.aliases?.map((alias) => (
                      <Link
                        key={alias.slug}
                        href={`/spec/${encodeURIComponent(alias.slug)}`}
                        className="ml-10 mt-1 block rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {alias.title}
                        <span className="ml-2 text-[11px] text-muted-foreground">{alias.summary}</span>
                      </Link>
                    ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        内容正本: <code className="rounded bg-muted px-1">pwa/spec/*.md</code>（= git 管理かつ OS 画面表示）。
        既存 <code className="rounded bg-muted px-1">pwa/design/*.md</code> は章単位で移行中。
      </p>
    </div>
  );
}
