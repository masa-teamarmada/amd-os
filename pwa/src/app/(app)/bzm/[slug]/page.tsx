import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BzmMarkdown } from "@/components/bzm/BzmMarkdown";
import { BzmSideNav, type BzmSideNavGroup } from "@/components/bzm/BzmSideNav";
import {
  applyBzmBookNumbering,
  BZM_CHAPTERS,
  BZM_PARTS,
  BZM_SLUG_ALIASES,
  getBzmChapter,
  getBzmChapterStatus,
  sortBzmSlugs,
} from "../bzm-chapters";
import { isBzmChapterFile, normalizeBzmMarkdownSource } from "../bzm-data";
import { bzmContentDir } from "@/lib/bzm-content-dir";

/**
 * /bzm/[slug] — 教科書の各章
 *
 * bzm/{slug}.md を fs で読み、BzmMarkdown (= 数式対応 renderer) で描画。
 * h1 に part-chapter 番号 (= "5-1" 等) を動的注入する。
 * md が存在しない slug (= 未着手章) は entry のメタ情報 (title/summary/status) を
 * 「執筆待機中」stub として表示する。
 */

export async function generateStaticParams() {
  const dir = bzmContentDir();
  const fileSlug = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(isBzmChapterFile).map((f) => f.replace(/\.md$/, ""))
    : [];
  const entrySlug = BZM_CHAPTERS.map((c) => c.slug);
  const all = Array.from(new Set([...fileSlug, ...entrySlug]));
  return all.map((slug) => ({ slug }));
}

export default async function BzmChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const aliasTarget = BZM_SLUG_ALIASES[decoded];
  if (aliasTarget) {
    redirect(`/bzm/${aliasTarget}`);
  }

  const filePath = path.join(bzmContentDir(), `${decoded}.md`);
  const fileExists = fs.existsSync(filePath);
  const chapterEntry = getBzmChapter(decoded);
  const chapterStatus = getBzmChapterStatus(decoded);

  if (!fileExists && !chapterEntry) {
    notFound();
  }

  const numbered = applyBzmBookNumbering(BZM_CHAPTERS);
  const numberedForSlug = numbered.find((c) => c.slug === decoded);

  let displaySource: string;
  if (fileExists) {
    const rawSource = fs.readFileSync(filePath, "utf8");
    displaySource = numberedForSlug
      ? normalizeBzmMarkdownSource(rawSource, numberedForSlug)
      : rawSource;
  } else {
    // 未着手 stub: entry のメタ情報を執筆待機中として表示
    const title = chapterEntry?.title ?? decoded;
    const summary = chapterEntry?.summary ?? "";
    displaySource = [
      `# ${title}`,
      "",
      "> **このセクションは執筆待機中です。**",
      ">",
      "> 完成済セクションから順次本文 draft が追加されます。執筆順序は D-007 (Book II 中核 → Book III → Book 0 → I → IV → V → VI → 付録)。",
      "",
      "## セクション概要",
      "",
      summary,
      "",
      "## 参照",
      "",
      "- L1 (不変項): [`bzm/BOOK_MASTER_PLAN.md`](/bzm) — 中核命題 / Tier 階層分離 / 確定モデル / 章構成 / 書き順 / ケース割当て / 章間 dependency / page budget / publishing path",
      "- L2 (判決台帳): `bzm/BOOK_DECISIONS.md` — D-001..D-055 active + R-1..R-5 + P-001..P-011 pending",
      "- L3 (章単位): `bzm/CHAPTER_<n>_PROGRESS.md` (該当章の skeleton / 段落 outline / draft / 査読履歴)",
      "",
    ].join("\n");
  }

  // すべての BZM_CHAPTERS slug から sort (= md なしの未着手 entry も nav に含める)
  const allEntrySlugs = BZM_CHAPTERS.map((c) => c.slug);
  const fileSlugs = fs.readdirSync(bzmContentDir()).filter(isBzmChapterFile).map((f) => f.replace(/\.md$/, ""));
  const all = Array.from(new Set([...allEntrySlugs, ...fileSlugs]));
  const sorted = sortBzmSlugs(all);
  const idx = sorted.indexOf(decoded);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const prevChapter = prev ? numbered.find((c) => c.slug === prev) : null;
  const nextChapter = next ? numbered.find((c) => c.slug === next) : null;

  const numberBySlug = new Map(numbered.map((c) => [c.slug, c]));
  const chapterBySlug = new Map(BZM_CHAPTERS.map((c) => [c.slug, c]));
  const navGroups: BzmSideNavGroup[] = BZM_PARTS.map((part) => ({
    key: part.key,
    label: part.label,
    chapters: part.slugs
      .map((s) => {
        const num = numberBySlug.get(s);
        if (!num) return null;
        const ch = chapterBySlug.get(s);
        return {
          slug: num.slug,
          number: num.number,
          title: num.title,
          status: ch?.status,
          level: ch?.level,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c != null),
  })).filter((group) => group.chapters.length > 0);

  return (
    <section className="grid gap-6 px-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <BzmSideNav groups={navGroups} activeSlug={decoded} />
      </aside>

      <div className="min-w-0">
        <article className="mx-auto max-w-3xl">
          {!fileExists && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <span className="font-black">執筆待機中</span> — このセクションはまだ本文 draft が作成されていません。サイドナビの緑チェック印 (完成) または黄色半円印 (進行中) のセクションから本文が読めます。
            </div>
          )}
          {fileExists && chapterStatus === "legacy" && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span className="font-black">旧版アーカイブ</span> — このセクションは Book A 完成前の旧稿です。最新の正本は「Book A 教科書 — ディープテック起業の経営学」(サイドナビ最上段、序章から読めます) を参照してください。
            </div>
          )}
          <BzmMarkdown source={displaySource} />

          <nav className="mt-10 flex justify-between gap-4 border-t border-border pt-4 text-xs">
            {prev ? (
              <Link href={`/bzm/${encodeURIComponent(prev)}`} className="text-muted-foreground hover:text-foreground">
                ← {prevChapter ? prevChapter.title : prev}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/bzm/${encodeURIComponent(next)}`} className="text-right text-muted-foreground hover:text-foreground">
                {nextChapter ? nextChapter.title : next} →
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
