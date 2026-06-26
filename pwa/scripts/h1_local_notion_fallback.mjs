#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const DEFAULT_NOTION_DB = "/Users/masa/Library/Application Support/Notion/notion.db";
const NOTION_PAGE_URL_BASE = "https://app.notion.com/p/";
const DEFAULT_MAX_SOURCE_CHARS = 12000;
const DEFAULT_MAX_TRANSCRIPT_CHARS = 8000;
const DEFAULT_THRESHOLD = 48;

const STOPWORDS = new Set([
  "mtg",
  "meeting",
  "meet",
  "google",
  "gemini",
  "notes",
  "note",
  "notion",
  "議事録",
  "会議",
  "打合せ",
  "打ち合わせ",
  "定例",
  "株式会社",
  "大学",
  "さん",
  "先生",
]);

function main() {
  const args = parseArgs(process.argv.slice(2));
  const query = {
    title: pickString(args.title, args.summary),
    date: normalizeDate(pickString(args.date, args.meetingDate, args.meeting_date)),
    eventId: pickString(args.eventId, args.event_id, args.calendarEventId, args.calendar_event_id),
  };
  if (!query.title && !query.date && !query.eventId) {
    console.error("Usage: npm run h1:local-notion-fallback -- --title <title> --date <YYYY-MM-DD> [--event-id <calendar_event_id>]");
    process.exit(2);
  }

  const dbPath = pickString(args.db, args.dbPath) || process.env.H1_LOCAL_NOTION_DB || DEFAULT_NOTION_DB;
  const options = {
    limit: Number(args.limit || 5),
    maxSourceChars: Number(args.maxSourceChars || DEFAULT_MAX_SOURCE_CHARS),
    maxTranscriptChars: Number(args.maxTranscriptChars || DEFAULT_MAX_TRANSCRIPT_CHARS),
    threshold: Number(args.threshold || DEFAULT_THRESHOLD),
  };

  if (!existsSync(dbPath)) {
    console.log(JSON.stringify({
      status: "unavailable",
      reason: "notion_local_db_missing",
      db_path: dbPath,
      query,
      matches: [],
    }, null, 2));
    return;
  }

  const pageRows = loadCandidatePageRows(dbPath, query);
  const allRows = loadRowsForSubtrees(dbPath, pageRows);
  const matches = findMatchesFromRows(allRows, query, options).slice(0, options.limit);

  console.log(JSON.stringify({
    status: matches.length > 0 ? "hit" : "miss",
    db_path: dbPath,
    query,
    matches,
  }, null, 2));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "1";
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function loadCandidatePageRows(dbPath, query) {
  const terms = unique([
    query.eventId,
    query.date,
    query.date ? query.date.replaceAll("-", "") : "",
    ...tokenize(query.title).slice(0, 5),
  ]).filter((term) => String(term).length >= 2);

  const likeClause = terms.length > 0
    ? `and (${terms.map((term) => `lower(coalesce(properties,'')) like ${sqlLiteral(`%${String(term).toLowerCase()}%`)}`).join(" or ")})`
    : "";

  const sql = `
select id, type, parent_id, properties, content, created_time, last_edited_time, alive
from block
where type = 'page'
  and alive = 1
  ${likeClause}
order by last_edited_time desc
limit 300;
`;
  return runSqliteJson(dbPath, sql);
}

function loadRowsForSubtrees(dbPath, pageRows) {
  const rowsById = new Map();
  for (const row of pageRows) rowsById.set(row.id, normalizeRow(row));

  let frontier = unique(pageRows.map((row) => row.id));
  for (let depth = 0; depth < 10 && frontier.length > 0 && rowsById.size < 2500; depth += 1) {
    const knownBefore = rowsById.size;
    const parentRows = loadChildrenByParentIds(dbPath, frontier);
    for (const row of parentRows) rowsById.set(row.id, normalizeRow(row));

    const contentChildIds = unique(
      [...rowsById.values()]
        .flatMap((row) => childIdsFromContent(row.content))
        .filter((id) => !rowsById.has(id)),
    );
    const contentRows = loadRowsByIds(dbPath, contentChildIds);
    for (const row of contentRows) rowsById.set(row.id, normalizeRow(row));

    const newChildIds = unique([
      ...parentRows.map((row) => row.id),
      ...contentRows.map((row) => row.id),
    ]).filter((id) => id && id !== "");
    frontier = newChildIds.filter((id) => rowsById.has(id));
    if (rowsById.size === knownBefore) break;
  }

  return [...rowsById.values()];
}

function loadChildrenByParentIds(dbPath, parentIds) {
  const ids = unique(parentIds).filter(isNotionId);
  if (ids.length === 0) return [];
  const sql = `
select id, type, parent_id, properties, content, created_time, last_edited_time, alive
from block
where alive = 1 and parent_id in (${ids.map(sqlLiteral).join(",")});
`;
  return runSqliteJson(dbPath, sql);
}

function loadRowsByIds(dbPath, ids) {
  const safeIds = unique(ids).filter(isNotionId);
  if (safeIds.length === 0) return [];
  const sql = `
select id, type, parent_id, properties, content, created_time, last_edited_time, alive
from block
where alive = 1 and id in (${safeIds.map(sqlLiteral).join(",")});
`;
  return runSqliteJson(dbPath, sql);
}

function runSqliteJson(dbPath, sql) {
  const raw = execFileSync("sqlite3", [dbPath, "-json", sql], {
    maxBuffer: 120 * 1024 * 1024,
  }).toString();
  return raw.trim() ? JSON.parse(raw) : [];
}

function findMatchesFromRows(rows, query, options = {}) {
  const normalizedRows = rows.map(normalizeRow);
  const byId = new Map(normalizedRows.map((row) => [row.id, row]));
  const childrenByParent = groupChildrenByParent(normalizedRows);
  const threshold = Number(options.threshold || DEFAULT_THRESHOLD);

  return normalizedRows
    .filter((row) => row.type === "page")
    .map((page) => buildMatch(page, byId, childrenByParent, query, options))
    .filter((match) => match.score >= threshold && match.source_text.length >= 80)
    .sort((a, b) => b.score - a.score);
}

function buildMatch(page, byId, childrenByParent, query, options = {}) {
  const pageTitle = extractTextFromProperties(page.properties);
  const pageDate = extractDateFromProperties(page.properties) || dateFromUnixMs(page.created_time) || dateFromUnixMs(page.last_edited_time);
  const pageRawJson = [page.properties, page.content].filter(Boolean).join("\n");
  const pageUrl = notionPageUrl(page.id);
  const texts = collectSubtreeTexts(page.id, byId, childrenByParent);
  const summaryText = compactLines(texts.summary).slice(0, Number(options.maxSourceChars || DEFAULT_MAX_SOURCE_CHARS));
  const transcriptText = compactLines(texts.transcript).slice(0, Number(options.maxTranscriptChars || DEFAULT_MAX_TRANSCRIPT_CHARS));
  const sourceText = buildSourceText(summaryText, transcriptText, Number(options.maxSourceChars || DEFAULT_MAX_SOURCE_CHARS));
  const scoreDetail = scorePage({
    pageTitle,
    pageDate,
    pageRawJson,
    sourceText,
  }, query);

  return {
    page_id: page.id,
    title: pageTitle || "(untitled)",
    date: pageDate || null,
    url: pageUrl,
    score: scoreDetail.score,
    confidence: scoreDetail.confidence,
    match_reasons: scoreDetail.reasons,
    source_kind: "notion-local",
    source_hash: `h1-local-notion:${sha256([page.id, sourceText].join("\n"))}`,
    summary_text: summaryText,
    transcript_excerpt: transcriptText,
    source_text: sourceText,
    stats: {
      summary_chars: summaryText.length,
      transcript_chars: transcriptText.length,
      source_chars: sourceText.length,
      block_count: texts.blockCount,
    },
  };
}

function collectSubtreeTexts(rootId, byId, childrenByParent) {
  const visited = new Set();
  const summary = [];
  const transcript = [];
  let blockCount = 0;

  function visit(id, depth) {
    if (!id || visited.has(id) || depth > 12) return;
    visited.add(id);
    const row = byId.get(id);
    if (!row) return;
    blockCount += 1;

    const text = extractTextFromProperties(row.properties);
    if (text && row.type !== "page") {
      if (isLikelyTranscriptText(row.type, text)) {
        transcript.push(text);
      } else {
        summary.push(text);
      }
    }

    const orderedChildren = unique([
      ...childIdsFromContent(row.content),
      ...(childrenByParent.get(id) || []).map((child) => child.id),
    ]);
    for (const childId of orderedChildren) visit(childId, depth + 1);
  }

  visit(rootId, 0);
  return { summary, transcript, blockCount };
}

function scorePage(page, query) {
  let score = 0;
  const reasons = [];
  const eventId = pickString(query.eventId);
  const queryDate = normalizeDate(query.date);
  const queryTitle = pickString(query.title);
  const titleHaystack = normalizeText(page.pageTitle);
  const sourceHaystack = normalizeText([page.pageTitle, page.sourceText].join(" "));

  if (eventId && page.pageRawJson.includes(eventId)) {
    score += 120;
    reasons.push("event_id_exact");
  }

  if (queryDate && page.pageDate === queryDate) {
    score += 30;
    reasons.push("date_exact");
  } else if (queryDate && page.pageDate && dayDistance(queryDate, page.pageDate) <= 1) {
    score += 18;
    reasons.push("date_near");
  } else if (queryDate && page.pageRawJson.includes(queryDate)) {
    score += 24;
    reasons.push("date_in_properties");
  }

  const normalizedQueryTitle = normalizeText(queryTitle);
  if (normalizedQueryTitle && titleHaystack.includes(normalizedQueryTitle)) {
    score += 32;
    reasons.push("title_exact_contains");
  }

  const titleTokens = tokenize(queryTitle);
  const hitTokens = titleTokens.filter((token) => sourceHaystack.includes(token));
  if (hitTokens.length > 0) {
    score += Math.min(hitTokens.length, 5) * 13;
    reasons.push(`title_token_hits:${hitTokens.slice(0, 5).join(",")}`);
  }

  if (/議事録|アクションアイテム|決定事項|next action|action item/i.test(page.sourceText)) {
    score += 10;
    reasons.push("meeting_summary_blocks");
  }

  const confidence = score >= 78 ? "high" : score >= 56 ? "medium" : score >= DEFAULT_THRESHOLD ? "low" : "none";
  return { score, confidence, reasons };
}

function buildSourceText(summaryText, transcriptText, maxSourceChars) {
  const sections = [];
  if (summaryText) sections.push(`## Notion AI summary / structured blocks\n${summaryText}`);
  if (transcriptText) sections.push(`## Transcript excerpt\n${transcriptText}`);
  return sections.join("\n\n").slice(0, maxSourceChars);
}

function compactLines(lines) {
  return unique(lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean)).join("\n");
}

function normalizeRow(row) {
  return {
    id: String(row.id || ""),
    type: String(row.type || ""),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    properties: row.properties ?? null,
    content: row.content ?? null,
    created_time: row.created_time ?? null,
    last_edited_time: row.last_edited_time ?? null,
    alive: row.alive,
  };
}

function groupChildrenByParent(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row.parent_id) continue;
    if (!map.has(row.parent_id)) map.set(row.parent_id, []);
    map.get(row.parent_id).push(row);
  }
  return map;
}

function childIdsFromContent(rawContent) {
  if (!rawContent) return [];
  try {
    const parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    if (!Array.isArray(parsed)) return [];
    return parsed.flat(Infinity).filter((value) => typeof value === "string" && isNotionId(value));
  } catch {
    return [];
  }
}

function extractTextFromProperties(rawProperties) {
  if (!rawProperties) return "";
  try {
    const properties = typeof rawProperties === "string" ? JSON.parse(rawProperties) : rawProperties;
    const titleValue = properties?.title ?? properties?.Name ?? properties?.name ?? properties;
    return textFromNotionValue(titleValue)
      .replace(/\s+/g, " ")
      .replace(/\s*‣\s*/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function extractDateFromProperties(rawProperties) {
  const raw = String(rawProperties || "");
  return raw.match(/"start_date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1]
    || raw.match(/"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1]
    || null;
}

function textFromNotionValue(value) {
  const parts = [];
  function walk(node) {
    if (node == null) return;
    if (typeof node === "string") {
      if (/^https?:\/\//.test(node)) return;
      if (isNotionId(node)) return;
      if (node !== "‣" && node !== "p" && node !== "d" && node !== "b" && node !== "ci") parts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === "object") {
      if (
        "href" in node ||
        "blockId" in node ||
        "spaceId" in node ||
        "citationNumber" in node ||
        "start_date" in node ||
        "time_zone" in node
      ) {
        return;
      }
      for (const item of Object.values(node)) walk(item);
    }
  }
  walk(value);
  return parts.join("");
}

function isLikelyTranscriptText(type, text) {
  if (type !== "text") return false;
  if (text.length >= 260) return true;
  return /ありがとうございます|ということですね|思いました|でしょうか|ですけれども/.test(text) && text.length >= 120;
}

function tokenize(value) {
  return unique(normalizeText(value)
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,4}\b/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token)));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[()[\]{}<>【】「」『』、。・:：/\\|_\-+~!?,，.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value) {
  const raw = pickString(value);
  if (!raw) return "";
  const direct = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dateFromUnixMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return normalizeDate(new Date(number).toISOString());
}

function dayDistance(a, b) {
  const ad = Date.parse(`${a}T00:00:00+09:00`);
  const bd = Date.parse(`${b}T00:00:00+09:00`);
  if (!Number.isFinite(ad) || !Number.isFinite(bd)) return Infinity;
  return Math.abs(Math.round((ad - bd) / 86400000));
}

function notionPageUrl(pageId) {
  return `${NOTION_PAGE_URL_BASE}${String(pageId).replace(/-/g, "")}`;
}

function isNotionId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

if (import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  main();
}

export {
  buildMatch,
  childIdsFromContent,
  collectSubtreeTexts,
  extractTextFromProperties,
  findMatchesFromRows,
  normalizeDate,
  scorePage,
  tokenize,
};
