import fs from "node:fs";
import path from "node:path";
import {
  applySpecBookNumbering,
  getSpecChapter,
  SPEC_SECTIONS,
  sortSpecSlugs,
  type SpecChapterConfig,
  type SpecNumberedChapter,
} from "./spec-chapters";

/**
 * 設計書の内容正本は `pwa/spec/{slug}.md` に置く (= manual / bzm と同じ思想)。
 * このローダーが fs で読み、章番号を動的注入する。
 */

function specDir() {
  return path.join(process.cwd(), "spec");
}

export function getSpecMarkdownSlugs() {
  const dir = specDir();
  if (!fs.existsSync(dir)) return [];
  return sortSpecSlugs(fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")));
}

export function getSpecMarkdownSource(slug: string) {
  const filePath = path.join(specDir(), `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

export function getSpecChapters(): SpecChapterConfig[] {
  const configuredSlugs = SPEC_SECTIONS.flatMap((section) => section.slugs);
  const slugs = sortSpecSlugs([...new Set([...getSpecMarkdownSlugs(), ...configuredSlugs])]);
  return slugs.map((slug) => {
    const text = getSpecMarkdownSource(slug) ?? "";
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
    return getSpecChapter(slug) ?? { slug, title: h1, summary };
  });
}

export function getSpecBookChapters(chapters: SpecChapterConfig[]) {
  return applySpecBookNumbering(chapters);
}

/**
 * h1 の冒頭に章番号を注入する (= bzm と同じ。h2 には振らない)。
 */
export function normalizeSpecMarkdownSource(source: string, chapter: SpecNumberedChapter) {
  return source
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) {
        const title = line.replace(/^#\s+/, "").trim();
        return `# ${chapter.number}　${title}`;
      }
      return line;
    })
    .join("\n");
}
