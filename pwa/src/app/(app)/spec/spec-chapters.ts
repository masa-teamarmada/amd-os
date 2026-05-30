/**
 * 設計書 (/spec) の目次メタデータ。
 *
 * manual-chapters.ts / bzm-chapters.ts と同じ思想:
 *  - **slug 自体が section-chapter 番号を含む** (例: `2-3-cockpit` → section 2 の 3 章 → 番号 "2-3")。
 *  - 表示番号は `applySpecBookNumbering()` が SPEC_SECTIONS の順に振る (1 始まり)。
 *
 * 内容正本は `pwa/spec/{slug}.md` (= git 管理かつ OS 画面表示)。
 * 設計書は AMD OS の「確定した実装仕様」の正本。数式・理論は /bzm、使い方は /manual。
 * `pwa/design/*.md` は廃止し、確定仕様はここへ集約する (2026-05-30 まさ確定)。
 */

export interface SpecSectionConfig {
  key: string;
  label: string;
  description: string;
  slugs: string[];
}

export interface SpecChapterConfig {
  slug: string;
  title: string;
  summary: string;
}

export interface SpecNumberedChapter extends SpecChapterConfig {
  number: string;
}

/**
 * section 構成。フェーズ B で旧 design/ の S ファイルと manual の -spec 章を
 * ここへ集約する。現状は overview のみ (= 箱を作った段階)。
 */
export const SPEC_SECTIONS: SpecSectionConfig[] = [
  {
    key: "overview",
    label: "はじめに",
    description: "設計書セクションの目的、3 層ドキュメント体系、OS 画面で正本管理する理由。",
    slugs: ["1-1-overview"],
  },
];

export const SPEC_CHAPTERS: SpecChapterConfig[] = [
  { slug: "1-1-overview", title: "設計書について", summary: "確定仕様の正本。manual / spec / bzm の 3 層体系と、OS 画面で正本管理する理由。" },
];

const sectionOrder = new Map(
  SPEC_SECTIONS.flatMap((section, sectionIdx) =>
    section.slugs.map((slug, slugIdx) => [slug, sectionIdx * 100 + slugIdx] as const),
  ),
);

const chapterBySlug = new Map(SPEC_CHAPTERS.map((chapter) => [chapter.slug, chapter]));

export function sortSpecSlugs(slugs: string[]) {
  return [...slugs].sort((a, b) => {
    const aOrder = sectionOrder.get(a);
    const bOrder = sectionOrder.get(b);
    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;
    return a.localeCompare(b);
  });
}

/**
 * 章番号を section-chapter 形式 (= "2-3" など) で振る。section は 1 始まり。
 */
export function applySpecBookNumbering(chapters: SpecChapterConfig[]): SpecNumberedChapter[] {
  const numberBySlug = new Map<string, string>();
  SPEC_SECTIONS.forEach((section, sectionIdx) => {
    section.slugs.forEach((slug, chapterIdx) => {
      numberBySlug.set(slug, `${sectionIdx + 1}-${chapterIdx + 1}`);
    });
  });
  return chapters.map((chapter) => ({
    ...chapter,
    number: numberBySlug.get(chapter.slug) ?? "--",
  }));
}

export function getSpecChapter(slug: string) {
  return chapterBySlug.get(slug) ?? null;
}
