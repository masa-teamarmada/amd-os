import fs from "node:fs";
import path from "node:path";
import {
  applyManualBookNumbering,
  getManualChapter,
  sortManualSlugs,
  type ManualAudience,
  type ManualChapterConfig,
} from "./manual-chapters";

export function getManualAudience(params: { audience?: string | string[] | undefined }): ManualAudience {
  const value = Array.isArray(params.audience) ? params.audience[0] : params.audience;
  return value === "developer" ? "developer" : "user";
}

export function getManualMarkdownSlugs() {
  const dir = path.join(process.cwd(), "manual");
  if (!fs.existsSync(dir)) return [];
  return sortManualSlugs(fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")));
}

export function getManualMarkdownSource(slug: string) {
  const filePath = path.join(process.cwd(), "manual", `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

export function getManualChapters(): ManualChapterConfig[] {
  return getManualMarkdownSlugs().map((slug) => {
    const text = getManualMarkdownSource(slug) ?? "";
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
      audience: "developer",
      topics: [],
    };
  });
}

export function getManualBookChapters(chapters: ManualChapterConfig[]) {
  return applyManualBookNumbering(chapters);
}

export function normalizeManualMarkdownSource(source: string, chapter: ManualChapterConfig) {
  let h2Index = 0;

  return source
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) {
        return `# ${chapter.number}. ${chapter.title}`;
      }

      if (line.startsWith("## ")) {
        h2Index += 1;
        const title = line
          .replace(/^##\s+/, "")
          .replace(/^\d+(?:[.-]\d+)+(?:[.)])?\s+/, "")
          .trim();
        return `## ${chapter.number}-${h2Index} ${title}`;
      }

      return line;
    })
    .join("\n");
}
