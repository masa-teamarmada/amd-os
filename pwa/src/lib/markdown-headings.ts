export type MarkdownHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface MarkdownHeading {
  level: MarkdownHeadingLevel;
  title: string;
  id: string;
}

export function cleanMarkdownHeadingTitle(title: string) {
  return title
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

export function markdownHeadingId(text: string) {
  const compact = cleanMarkdownHeadingTitle(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return compact || "section";
}

export function extractMarkdownHeadings(source: string) {
  const headings: MarkdownHeading[] = [];
  const idCounts = new Map<string, number>();
  let fence: "```" | "~~~" | null = null;

  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```|~~~)/);
    if (fenceMatch) {
      const marker = fenceMatch[1] as "```" | "~~~";
      if (fence === marker) {
        fence = null;
      } else if (!fence) {
        fence = marker;
      }
      continue;
    }
    if (fence) continue;

    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const level = match[1].length as MarkdownHeadingLevel;
    const title = cleanMarkdownHeadingTitle(match[2]);
    if (!title) continue;

    const baseId = markdownHeadingId(title);
    const count = (idCounts.get(baseId) ?? 0) + 1;
    idCounts.set(baseId, count);

    headings.push({
      level,
      title,
      id: count === 1 ? baseId : `${baseId}-${count}`,
    });
  }

  return headings;
}
