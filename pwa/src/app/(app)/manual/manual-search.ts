export interface ManualSearchDocument {
  slug: string;
  number: string;
  title: string;
  summary: string;
  topics: string[];
  screens: string[];
  tables: string[];
  headings: string[];
  text: string;
}

export interface ManualSearchResult {
  doc: ManualSearchDocument;
  score: number;
  snippet: string;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[*_`>#\[\](){}|:;,.、。・「」『』"'\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function separateJoinedTerms(value: string) {
  return value
    .replace(/([a-z]+[0-9]*)(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, "$1 ")
    .replace(/(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])([a-z]+[0-9]*)/gu, " $1")
    .replace(/([0-9]+)(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, "$1 ")
    .replace(/(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])([0-9]+)/gu, " $1");
}

function significantTerms(value: string) {
  const stopwords = new Set([
    "ある",
    "いる",
    "する",
    "できる",
    "ください",
    "どこ",
    "どの",
    "どれ",
    "なに",
    "なん",
    "よう",
    "もの",
    "こと",
    "これ",
    "それ",
    "あれ",
    "には",
    "とは",
  ]);

  return value
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && !stopwords.has(part));
}

function queryTerms(query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const spaced = normalizeSearchText(separateJoinedTerms(normalized));
  const parts = significantTerms(spaced);
  const japaneseParts = spaced
    .replace(/[?？!！]/g, " ")
    .replace(/[はがをにでとへもやのか]/g, " ")
    .split(" ");

  return Array.from(new Set([normalized, spaced, ...parts, ...significantTerms(japaneseParts.join(" "))]));
}

function countMatches(haystack: string, needle: string) {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx >= 0) {
    count += 1;
    idx = haystack.indexOf(needle, idx + Math.max(needle.length, 1));
  }
  return count;
}

function makeSnippet(source: string, terms: string[]) {
  const compact = source.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const normalized = normalizeSearchText(compact);
  const firstHit = terms
    .map((term) => normalized.indexOf(term))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];

  if (firstHit == null) return compact.slice(0, 120);
  const start = Math.max(0, firstHit - 42);
  const end = Math.min(compact.length, firstHit + 118);
  return `${start > 0 ? "..." : ""}${compact.slice(start, end)}${end < compact.length ? "..." : ""}`;
}

export function searchManualDocuments(
  docs: ManualSearchDocument[],
  query: string,
  limit = 10,
): ManualSearchResult[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  return docs
    .map((doc) => {
      const title = normalizeSearchText(`${doc.number} ${doc.title}`);
      const summary = normalizeSearchText(doc.summary);
      const headings = normalizeSearchText(doc.headings.join(" "));
      const keywords = normalizeSearchText([...doc.topics, ...doc.screens, ...doc.tables].join(" "));
      const body = normalizeSearchText(doc.text);

      let score = 0;
      for (const term of terms) {
        if (title.includes(term)) score += 80 + countMatches(title, term) * 8;
        if (summary.includes(term)) score += 45 + countMatches(summary, term) * 5;
        if (headings.includes(term)) score += 35 + countMatches(headings, term) * 4;
        if (keywords.includes(term)) score += 28 + countMatches(keywords, term) * 4;
        if (body.includes(term)) score += Math.min(35, countMatches(body, term) * 5);
      }

      return {
        doc,
        score,
        snippet: makeSnippet(`${doc.summary}\n${doc.headings.join(" / ")}\n${doc.text}`, terms),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.number.localeCompare(b.doc.number))
    .slice(0, limit);
}
