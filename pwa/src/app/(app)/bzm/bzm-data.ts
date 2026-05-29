import fs from "node:fs";
import path from "node:path";
import {
  applyBzmBookNumbering,
  getBzmChapter,
  sortBzmSlugs,
  type BzmChapterConfig,
  type BzmNumberedChapter,
} from "./bzm-chapters";

/**
 * BZM 教科書の内容正本は `pwa/bzm/{slug}.md` に置く (= manual と同じ思想)。
 * このローダーが fs で読み、章番号を動的注入する。
 */

function bzmDir() {
  return path.join(process.cwd(), "bzm");
}

export function getBzmMarkdownSlugs() {
  const dir = bzmDir();
  if (!fs.existsSync(dir)) return [];
  return sortBzmSlugs(fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")));
}

export function getBzmMarkdownSource(slug: string) {
  const filePath = path.join(bzmDir(), `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

export function getBzmChapters(): BzmChapterConfig[] {
  return getBzmMarkdownSlugs().map((slug) => {
    const text = getBzmMarkdownSource(slug) ?? "";
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
    return getBzmChapter(slug) ?? { slug, title: h1, summary };
  });
}

export function getBzmBookChapters(chapters: BzmChapterConfig[]) {
  return applyBzmBookNumbering(chapters);
}

/**
 * h1 の冒頭に章番号を注入する。
 * manual と違い、h2 には「§ 番号」を振らない (= 各 md が独自の節番号 "1." "2." を持つため)。
 */
export function normalizeBzmMarkdownSource(source: string, chapter: BzmNumberedChapter) {
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
