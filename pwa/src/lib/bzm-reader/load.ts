/**
 * 書斎の原稿読み込み（サーバ専用）。設計正本 `pwa/design/bzm_reader.md` §3・§4。
 *
 * 原稿は参照系データ（更新は日単位、読む側は書かない）。readModelCanonFile が 5 分持つのに合わせ、
 * その上の計算（前処理・見出し抽出・文字数）も本ごとに同じ TTL でプロセス内に持つ。
 * 本全体の進み具合に全章の文字数が要るため、章を 1 つ開くだけでも本ごと一度に組む。
 */
import { readModelCanonFile } from "@/lib/model-canon-source";
import { headingAnchorId } from "@/lib/heading-anchor";
import { READER_LIBRARY } from "./library.ts";
import {
  countReaderChars,
  ensureLeadingH1,
  extractReaderHeadings,
  extractReferenceTexts,
  firstHeadingText,
  isReferencesTitle,
  preprocessReaderMarkdown,
  rewriteReferenceCitations,
  splitByH1,
} from "./preprocess.ts";
import type {
  ReaderBookInfo,
  ReaderBookManifest,
  ReaderChapterContent,
  ReaderChapterInfo,
  ReaderHeading,
} from "./types.ts";

const TTL_MS = 5 * 60 * 1000;

interface LoadedChapterBody {
  markdown: string;
  notes: string[];
  headings: ReaderHeading[];
}

interface LoadedBook {
  info: ReaderBookInfo;
  bodies: Map<string, LoadedChapterBody>;
  /** 書けている章の見出しを、章の slug で引けるようにまとめたもの（目次が全章分を持つため。本ごとに一度だけ組む） */
  headingsBySlug: Record<string, ReaderHeading[]>;
}

const cache = new Map<string, { value: LoadedBook; storedAt: number }>();

/** 原稿の h1 に付いた版名の接頭辞（「BZM 3.0教科書 第1章 — …」）は、棚の本の題と重なるので外す */
function cleanChapterTitle(title: string): string {
  return title.replace(/^BZM\s*\d+(?:\.\d+)*教科書\s*/, "").trim();
}

function buildBody(markdown: string, notes: string[]): LoadedChapterBody {
  return {
    markdown,
    notes,
    headings: extractReaderHeadings(markdown, headingAnchorId),
  };
}

function loadBook(manifest: ReaderBookManifest): LoadedBook {
  const hit = cache.get(manifest.id);
  if (hit && Date.now() - hit.storedAt < TTL_MS) return hit.value;

  const bookChapterSlugs = manifest.chapters.map((chapter) => chapter.slug);
  const chapters: ReaderChapterInfo[] = [];
  const bodies = new Map<string, LoadedChapterBody>();

  for (const chapter of manifest.chapters) {
    const source = readModelCanonFile("bzm", chapter.file);
    if (source === null) {
      chapters.push({
        slug: chapter.slug,
        title: chapter.title ?? chapter.plannedTitle ?? chapter.slug,
        exists: false,
        charCount: 0,
      });
      continue;
    }

    const prepared = preprocessReaderMarkdown(source, {
      file: chapter.file,
      bookId: manifest.id,
      bookChapterSlugs,
    });

    if (chapter.split === "h1") {
      // 論文は 1 ファイルを `# ` 見出しごとに章へ割る。執筆メモは最初の章に付ける
      const split = splitByH1(prepared.markdown);
      // 引用番号の飛び先（`id="ref-N"`）は文献一覧の章にしか無いので、他の章の引用を文献一覧の章へのリンクに直す
      const referencesSection = split.find((section) => isReferencesTitle(section.title));
      const referenceTexts = referencesSection ? extractReferenceTexts(referencesSection.markdown) : null;
      const sections = split.map((section) =>
        referencesSection && referenceTexts && section !== referencesSection
          ? {
              ...section,
              markdown: rewriteReferenceCitations(section.markdown, {
                bookId: manifest.id,
                referencesSlug: referencesSection.slug,
                texts: referenceTexts,
              }),
            }
          : section,
      );
      sections.forEach((section, index) => {
        const title =
          section.title || (index === 0 ? cleanChapterTitle(prepared.frontMatterTitle ?? "") : "") || section.slug;
        chapters.push({
          slug: section.slug,
          title,
          exists: true,
          charCount: countReaderChars(section.markdown),
        });
        bodies.set(section.slug, buildBody(section.markdown, index === 0 ? prepared.notes : []));
      });
      continue;
    }

    const markdown = ensureLeadingH1(prepared.markdown);
    const title =
      chapter.title ||
      cleanChapterTitle(firstHeadingText(markdown, 1) ?? "") ||
      cleanChapterTitle(firstHeadingText(markdown) ?? "") ||
      chapter.plannedTitle ||
      chapter.slug;
    chapters.push({ slug: chapter.slug, title, exists: true, charCount: countReaderChars(markdown) });
    bodies.set(chapter.slug, buildBody(markdown, prepared.notes));
  }

  const info: ReaderBookInfo = {
    id: manifest.id,
    title: manifest.title,
    description: manifest.description,
    kind: manifest.kind,
    lang: manifest.lang,
    accent: manifest.accent,
    chapters,
    writtenCount: chapters.filter((chapter) => chapter.exists).length,
    totalCount: chapters.length,
    totalChars: chapters.reduce((sum, chapter) => sum + chapter.charCount, 0),
  };

  const headingsBySlug: Record<string, ReaderHeading[]> = {};
  for (const [slug, body] of bodies) headingsBySlug[slug] = body.headings;

  const value: LoadedBook = { info, bodies, headingsBySlug };
  cache.set(manifest.id, { value, storedAt: Date.now() });
  return value;
}

/** 棚に並べる全冊（棚の順） */
export function getReaderLibrary(): ReaderBookInfo[] {
  return READER_LIBRARY.map((manifest) => loadBook(manifest).info);
}

export function getReaderBook(bookId: string): ReaderBookInfo | null {
  const manifest = READER_LIBRARY.find((book) => book.id === bookId);
  return manifest ? loadBook(manifest).info : null;
}

/**
 * 前処理済みの章。本か章が manifest に無いときだけ null。
 * 章が manifest にあり原稿が無い（未執筆）ときは、exists=false、markdown=""、headings=[]、notes=[] で返す。
 * bookHeadings は本の全章の見出し（書けている章だけ）。どの章でも同じ内容で、未執筆の章を返すときも付く。
 */
export function getReaderChapterContent(bookId: string, chapterSlug: string): ReaderChapterContent | null {
  const manifest = READER_LIBRARY.find((book) => book.id === bookId);
  if (!manifest) return null;
  const loaded = loadBook(manifest);
  const chapterIndex = loaded.info.chapters.findIndex((chapter) => chapter.slug === chapterSlug);
  if (chapterIndex < 0) return null;
  const chapter = loaded.info.chapters[chapterIndex];
  const body = chapter.exists ? loaded.bodies.get(chapterSlug) : undefined;
  return {
    book: loaded.info,
    chapterIndex,
    chapter,
    markdown: body?.markdown ?? "",
    headings: body?.headings ?? [],
    bookHeadings: loaded.headingsBySlug,
    notes: body?.notes ?? [],
  };
}

/** 続きから開くときの既定。最初の書けている章 */
export function getFirstWrittenChapterSlug(book: ReaderBookInfo): string | null {
  return book.chapters.find((chapter) => chapter.exists)?.slug ?? null;
}
