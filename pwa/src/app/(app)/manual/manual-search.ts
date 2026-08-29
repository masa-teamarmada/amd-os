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

/**
 * 日本語の質問文は空白で区切られないため、ひらがな (助詞・語尾) を区切りにして
 * 漢字・カタカナ・英数のかたまりを取り出す。「支払フローってどこにある？」なら
 * 「支払フロー」「支払」「フロー」が検索語になる。これが無いと質問文がまるごと
 * 1語になり、本文へ部分一致せず全章 0 ヒットになる (2026-08-29 に実測で確認)。
 */
function contentWordTerms(value: string) {
  const terms: string[] = [];

  for (const chunk of value.match(/[\p{Script=Han}\p{Script=Katakana}ーa-z0-9]{2,}/gu) ?? []) {
    terms.push(chunk);
    for (const sub of chunk.match(/[\p{Script=Han}]{2,}|[\p{Script=Katakana}ー]{2,}|[a-z0-9]{2,}/gu) ?? []) {
      if (sub !== chunk) terms.push(sub);
    }
  }

  return terms;
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

  return Array.from(
    new Set([
      normalized,
      spaced,
      ...parts,
      ...significantTerms(japaneseParts.join(" ")),
      ...contentWordTerms(spaced),
    ]),
  );
}

/**
 * 章タイトル・見出し・画面名・テーブル名を辞書にして、質問文へそのまま現れる語を
 * 検索語に足す。「つくよみ」のようにひらがなだけの固有名は、ひらがなを区切りに
 * する contentWordTerms では取り出せないため、辞書側から逆に引き当てる。
 */
function dictionaryTerms(docs: ManualSearchDocument[], normalizedQuery: string) {
  const terms = new Set<string>();

  for (const doc of docs) {
    const sources = [doc.title, ...doc.headings, ...doc.topics, ...doc.screens, ...doc.tables];

    for (const source of sources) {
      for (const word of normalizeSearchText(source).split(/[\s\/・>-]+/)) {
        if (word.length < 2 || word.length > 20) continue;
        // ひらがなだけの 2 文字は「その」「この」のような一般語が混じるので除く。
        if (word.length === 2 && /^[\p{Script=Hiragana}]+$/u.test(word)) continue;
        if (normalizedQuery.includes(word)) terms.add(word);
      }
    }
  }

  return Array.from(terms);
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
  const terms = Array.from(
    new Set([...queryTerms(query), ...dictionaryTerms(docs, normalizeSearchText(query))]),
  );
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
