import fs from "node:fs";
import path from "node:path";
import {
  applyBzmBookNumbering,
  getBzmChapter,
  sortBzmSlugs,
  type BzmChapterConfig,
  type BzmNumberedChapter,
} from "./bzm-chapters";
import { bzmContentDir } from "@/lib/bzm-content-dir";

/**
 * 教科書の内容正本は `bzm/{slug}.md` に置く (= manual と同じ思想)。
 * このローダーが fs で読み、章番号を動的注入する。
 */

/** 台帳・運用md (大文字始まり、例: COMMANDER_TASKS.md) は章として扱わない */
export function isBzmChapterFile(name: string) {
  return name.endsWith(".md") && !/^[A-Z]/.test(name);
}

export function getBzmMarkdownSlugs() {
  const dir = bzmContentDir();
  if (!fs.existsSync(dir)) return [];
  return sortBzmSlugs(fs.readdirSync(dir).filter(isBzmChapterFile).map((f) => f.replace(/\.md$/, "")));
}

export function getBzmMarkdownSource(slug: string) {
  const filePath = path.join(bzmContentDir(), `${slug}.md`);
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
 * h1 への章番号注入はまさ確定 2026-06-28 で廃止 (= 番号と title 内 "Ch 1" 等の重複ミスリーディングを回避)。
 * h1 はそのまま、各 md の `# §X.Y.Z タイトル` を尊重する。
 */
export function normalizeBzmMarkdownSource(source: string, _chapter: BzmNumberedChapter) {
  return stripHtmlComments(source);
}

/**
 * 原稿の HTML コメント（執筆メモなど、著者向けの注記）を画面に出さない。
 * BzmMarkdown は生の HTML を描かないため、コメントがそのまま文字として本文に出ていた（2026-10-03）。
 * コードブロックの中は原稿の文字としてそのまま残す。
 */
export function stripHtmlComments(source: string) {
  const parts = source.split(/(^```[^\n]*\n[\s\S]*?^```[ \t]*$)/m);
  return parts
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/<!--[\s\S]*?-->\n?/g, "")))
    .join("");
}
