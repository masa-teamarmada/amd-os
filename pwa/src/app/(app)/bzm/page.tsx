import Link from "next/link";
import { BZM_PARTS } from "./bzm-chapters";
import { getBzmBookChapters, getBzmChapters } from "./bzm-data";

/**
 * /bzm — Before Zero Model 教科書 index
 *
 * 内容正本は `pwa/bzm/*.md` (= git 管理)。理論依存順 (序章 → 第 1 部 … 第 8 部) に
 * 部ごとの目次を並べる。各章は `/bzm/{slug}` へ。
 */
export default async function BzmIndexPage() {
  const chapters = getBzmBookChapters(getBzmChapters());
  const bySlug = new Map(chapters.map((c) => [c.slug, c]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Before Zero Model（BZM）— 教科書</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          ディープテック・スタートアップが「ゼロ（＝法人設立・事業開始）になる前」をモデル化・スコアリングする
          Before Zero Model の正本テキスト。マクロ環境 σ_SU・XRL・FRL・AMD Score・ERS を、理論の依存関係に沿って
          通読できる順序でまとめています。
        </p>
      </div>

      <div className="space-y-6">
        {BZM_PARTS.map((part) => (
          <section key={part.key}>
            <div className="mb-2">
              <h2 className="text-base font-bold text-foreground">{part.label}</h2>
              <p className="text-xs text-muted-foreground">{part.description}</p>
            </div>
            <ul className="space-y-1.5">
              {part.slugs.map((slug) => {
                const chapter = bySlug.get(slug);
                if (!chapter) return null;
                return (
                  <li key={slug}>
                    <Link
                      href={`/bzm/${encodeURIComponent(slug)}`}
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
        内容正本: <code className="rounded bg-muted px-1">pwa/bzm/*.md</code>（= git 管理）。
        理論正本: <code className="rounded bg-muted px-1">before-zero/theory/*.md</code> /{" "}
        <code className="rounded bg-muted px-1">pwa/design/amd_score.md</code> /{" "}
        <code className="rounded bg-muted px-1">pwa/design/institution_readiness.md</code>。
      </p>
    </div>
  );
}
