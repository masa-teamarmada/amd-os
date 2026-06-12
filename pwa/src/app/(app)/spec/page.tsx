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

      <div className="mb-8">
        <Link
          href="/spec/3-0-l2-data-list-current-spec"
          className="block rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 transition-colors hover:bg-indigo-100"
        >
          <span className="block text-sm font-bold text-indigo-950">L2データリスト</span>
          <span className="mt-1 block text-xs leading-relaxed text-indigo-900">
            AMD OS の中核データを M / W / D / H の cadence 体系でまとめた正本リスト。
          </span>
        </Link>
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
                      </span>
                    </Link>
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
