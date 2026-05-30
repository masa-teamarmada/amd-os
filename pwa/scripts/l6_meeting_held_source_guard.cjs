#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Guard: L2⑥ MTGサマリ抽出で、開催後ソースがある Calendar event を
// upcoming 準備カードだけで終わらせないための deterministic preflight。
//
// この script は外部 connector や DB へ接続しない。MMO automation が
// Calendar / Notion / Gmail / Drive から取得済みの短い metadata を渡すと、
// held meeting candidate と source refs を組み立て、fixture で再発防止を検査する。

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const STOPWORDS = new Set([
  "mtg",
  "meeting",
  "meet",
  "google",
  "gemini",
  "notes",
  "note",
  "による",
  "メモ",
  "議事録",
  "打合せ",
  "打ち合わせ",
  "定例",
  "さん",
  "先生",
  "株式会社",
  "大学",
]);

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function tokenize(value) {
  const normalized = normalizeText(value)
    .replace(/\b\d{4}\b|\b\d{1,2}\b/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function ymdFromIso(value) {
  const raw = pickString(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function ymFromDate(ymd) {
  return ymd ? ymd.slice(0, 4) + ymd.slice(5, 7) : "";
}

function dayDistance(a, b) {
  const ad = Date.parse(`${a}T00:00:00+09:00`);
  const bd = Date.parse(`${b}T00:00:00+09:00`);
  if (!Number.isFinite(ad) || !Number.isFinite(bd)) return Infinity;
  return Math.abs(Math.round((ad - bd) / 86400000));
}

function projectAliases(project) {
  return unique([
    project.project_id,
    project.project_name,
    project.client_name,
    ...(Array.isArray(project.aliases) ? project.aliases : []),
  ].map((v) => String(v || "").trim()));
}

function matchProject(event, projects) {
  if (event.project_id) {
    const forced = projects.find((p) => p.project_id === event.project_id);
    if (forced) return { project: forced, reason: "forced_project_id", confidence: "high" };
  }

  const haystack = normalizeText([
    event.title,
    event.summary,
    event.description,
    event.location,
    asArray(event.attendees).map((a) => [a.email, a.displayName, a.name].filter(Boolean).join(" ")).join(" "),
  ].join(" "));

  let best = null;
  for (const project of projects) {
    for (const alias of projectAliases(project)) {
      const needle = normalizeText(alias);
      if (!needle || needle.length < 2) continue;
      if (!haystack.includes(needle)) continue;
      const score = alias === project.project_id ? 80 : alias === project.project_name ? 100 : 92;
      if (!best || score > best.score) best = { project, score, alias };
    }
  }

  if (!best) return { project: null, reason: "no_project_match", confidence: "none" };
  return { project: best.project, reason: `matched:${best.alias}`, confidence: best.score >= 92 ? "high" : "medium" };
}

function calendarAttachmentEvidence(event) {
  const attachments = [
    ...asArray(event.attachments),
    ...asArray(event.calendar_attachments),
    ...asArray(event.conference_notes),
  ];
  const description = pickString(event.description);
  const refs = [];

  for (const raw of attachments) {
    if (!raw || typeof raw !== "object") continue;
    const title = pickString(raw.title, raw.name, raw.fileName);
    const url = pickString(raw.url, raw.fileUrl, raw.file_url, raw.htmlLink, raw.alternateLink);
    const fileId = pickString(raw.fileId, raw.file_id, raw.id);
    const mimeType = pickString(raw.mimeType, raw.mime_type);
    const haystack = normalizeText([title, url, mimeType].join(" "));
    const isDoc = /docs\.google\.com\/document/.test(url) || /google-apps\.document/.test(mimeType);
    const isGemini = haystack.includes("gemini") || haystack.includes("meeting notes") || haystack.includes("による メモ");
    if (!isDoc && !isGemini) continue;
    refs.push({
      kind: "drive",
      item_id: fileId || url,
      title: title || "Calendar attached meeting notes",
      url: url || null,
      reason: isGemini ? "calendar_attached_gemini_notes_doc" : "calendar_attached_google_doc",
    });
  }

  const docLinks = description.match(/https:\/\/docs\.google\.com\/document\/d\/[A-Za-z0-9_-]+[^\s)>\]]*/g) || [];
  for (const url of docLinks) {
    refs.push({
      kind: "drive",
      item_id: url,
      title: "Calendar description Google Docs link",
      url,
      reason: "calendar_description_google_doc_link",
    });
  }

  return refs;
}

function eventParticipants(event) {
  return unique(asArray(event.attendees).flatMap((a) => [
    pickString(a.email),
    pickString(a.displayName, a.name),
  ]).map(normalizeText));
}

function scoreNotionPage(event, project, page) {
  const eventId = pickString(event.id, event.event_id, event.calendar_event_id);
  const pageEventId = pickString(page.eventId, page.event_id, page.calendar_event_id);
  if (eventId && pageEventId && eventId === pageEventId) {
    return { score: 120, reason: "event_id_exact", confidence: "high", needs_review: false };
  }

  const eventDate = ymdFromIso(pickString(event.start, event.start_at, event.start_time));
  const pageDate = ymdFromIso(pickString(page.date, page.created_time, page.last_edited_time));
  if (!eventDate || !pageDate || dayDistance(eventDate, pageDate) > 1) {
    return { score: 0, reason: "date_mismatch", confidence: "none", needs_review: true };
  }

  const eventTokens = tokenize([event.title, event.summary].join(" "));
  const pageTokens = new Set(tokenize([page.title, page.name].join(" ")));
  const sharedTitleTokens = eventTokens.filter((token) => pageTokens.has(token));
  const projectContext = projectAliases(project).some((alias) => normalizeText([page.title, page.text, page.url].join(" ")).includes(normalizeText(alias)));
  const eventPeople = eventParticipants(event);
  const pageText = normalizeText([
    page.title,
    page.text,
    asArray(page.participants).join(" "),
    asArray(page.attendees).join(" "),
  ].join(" "));
  const sharedPeople = eventPeople.filter((person) => person && pageText.includes(person)).length;
  const hasGeminiOrDriveUrl = /docs\.google\.com|gemini|meeting notes|による メモ/.test(pageText);

  let score = 20;
  score += Math.min(sharedTitleTokens.length, 4) * 18;
  if (projectContext) score += 18;
  if (sharedPeople > 0) score += Math.min(sharedPeople, 3) * 10;
  if (hasGeminiOrDriveUrl) score += 10;

  const confidence = score >= 70 ? "high" : score >= 48 ? "medium" : "low";
  return {
    score,
    reason: "title_date_participant_fallback",
    confidence,
    needs_review: true,
  };
}

function matchNotionPage(event, project, pages) {
  const scored = pages
    .map((page) => ({ page, ...scoreNotionPage(event, project, page) }))
    .filter((item) => item.score >= 48)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  const top = scored[0];
  if (scored[1] && top.score - scored[1].score < 12) {
    return { ...top, confidence: "medium", needs_review: true, reason: `${top.reason}:ambiguous_second_candidate` };
  }
  return top;
}

function relevantGmailThreads(event, project, threads) {
  const eventDate = ymdFromIso(pickString(event.start, event.start_at, event.start_time));
  const titleTokens = tokenize([event.title, event.summary].join(" "));
  const projectTokens = projectAliases(project).flatMap(tokenize);
  const eventPeople = eventParticipants(event);
  const allTokens = unique([...titleTokens, ...projectTokens]);
  const matches = [];

  for (const thread of threads) {
    const threadDate = ymdFromIso(pickString(thread.date, thread.last_message_at, thread.created_at));
    if (eventDate && threadDate && dayDistance(eventDate, threadDate) > 2) continue;
    const haystack = normalizeText([
      thread.subject,
      thread.snippet,
      thread.text,
      thread.from,
      thread.to,
      asArray(thread.messages).map((m) => [m.subject, m.text, m.from, m.to].join(" ")).join(" "),
    ].join(" "));
    const tokenHits = allTokens.filter((token) => haystack.includes(token)).length;
    const personHits = eventPeople.filter((person) => person && haystack.includes(person)).length;
    const geminiHit = /gemini|meeting notes|google meet|による メモ/.test(haystack);
    const followupHit = /follow|フォロー|宿題|次回|議事録/.test(haystack);
    if (tokenHits === 0 && personHits === 0 && !geminiHit) continue;
    if (!geminiHit && !followupHit && tokenHits < 2 && personHits === 0) continue;
    matches.push({
      kind: "gmail",
      item_id: pickString(thread.id, thread.thread_id),
      title: pickString(thread.subject) || "Gmail meeting source",
      reason: geminiHit ? "gmail_gemini_notes_fallback" : "gmail_project_context_fallback",
      date: pickString(thread.date, thread.last_message_at, thread.created_at) || null,
    });
  }

  return matches;
}

function buildHeldCandidates(input) {
  const projects = asArray(input.projects);
  const upcomingRows = asArray(input.upcomingRows || input.upcoming_rows);
  const notionPages = asArray(input.notionPages || input.notion_pages);
  const gmailThreads = asArray(input.gmailThreads || input.gmail_threads);
  const candidates = [];
  const configGaps = [];

  for (const event of asArray(input.events)) {
    const eventId = pickString(event.id, event.event_id, event.calendar_event_id);
    const title = pickString(event.title, event.summary);
    const start = pickString(event.start, event.start_at, event.start_time);
    const meetingDate = ymdFromIso(start);
    if (!eventId || !title || !meetingDate) continue;
    if (title.startsWith("+") || title.startsWith("＋")) continue;

    const match = matchProject(event, projects);
    if (!match.project) continue;

    const project = match.project;
    const sourceRefs = [];
    const calendarRefs = calendarAttachmentEvidence(event);
    sourceRefs.push(...calendarRefs);

    const notionMatch = matchNotionPage(event, project, notionPages);
    if (notionMatch) {
      sourceRefs.push({
        kind: "notion",
        item_id: pickString(notionMatch.page.id, notionMatch.page.page_id),
        title: pickString(notionMatch.page.title, notionMatch.page.name),
        url: pickString(notionMatch.page.url) || null,
        reason: notionMatch.reason,
        confidence: notionMatch.confidence,
        needs_review: notionMatch.needs_review,
      });
    }

    const gmailMatches = relevantGmailThreads(event, project, gmailThreads);
    sourceRefs.push(...gmailMatches);

    const description = pickString(event.description);
    if (description.replace(/\s+/g, "").length >= 30) {
      sourceRefs.push({
        kind: "calendar",
        item_id: eventId,
        title,
        url: pickString(event.htmlLink, event.url, event.source_url) || null,
        reason: "calendar_description",
      });
    }

    const sourceKinds = unique(sourceRefs.map((ref) => ref.kind)).sort();
    if (sourceKinds.length === 0) continue;

    const upcoming = upcomingRows.find((row) => {
      const rowMeetingId = pickString(row.meeting_id);
      const rowEventId = pickString(row.calendar_event_id, row.event_id);
      return rowMeetingId === `upcoming:${eventId}` || rowEventId === eventId;
    });

    const reportEmails = pickString(project.report_emails);
    const reportEmailsMissingFallbackUsed = !reportEmails && gmailMatches.length > 0;
    if (reportEmailsMissingFallbackUsed) {
      configGaps.push({
        project_id: project.project_id,
        kind: "projects.report_emails_missing_but_gmail_fallback_used",
        calendar_event_id: eventId,
        evidence_thread_ids: gmailMatches.map((m) => m.item_id).filter(Boolean),
        recommendation: "通知/outboxでreport_emails設定候補を出す。自動DB更新はしない。",
      });
    }

    candidates.push({
      meeting_id: eventId,
      project_id: project.project_id,
      ym: ymFromDate(meetingDate),
      meeting_date: meetingDate,
      meeting_start_at: start,
      title,
      calendar_event_id: eventId,
      prep_source_meeting_id: upcoming ? pickString(upcoming.meeting_id) : null,
      source_kinds: sourceKinds.join("+"),
      source_refs: sourceRefs,
      notion_page_id: notionMatch ? pickString(notionMatch.page.id, notionMatch.page.page_id) : null,
      gmail_thread_ids: gmailMatches.map((m) => m.item_id).filter(Boolean),
      confidence: notionMatch?.confidence || (calendarRefs.length > 0 ? "high" : "medium"),
      needs_review: Boolean(notionMatch?.needs_review || reportEmailsMissingFallbackUsed),
      guard_flags: {
        calendar_attached_gemini_doc: calendarRefs.some((ref) => ref.reason.includes("gemini")),
        notion_event_id_missing_fallback: Boolean(notionMatch?.needs_review),
        report_emails_missing_but_gmail_fallback_used: reportEmailsMissingFallbackUsed,
      },
    });
  }

  return { heldCandidates: candidates, configGaps };
}

function runFixture(fixturePath) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const result = buildHeldCandidates(fixture);
  const expected = fixture.expected || {};
  if (expected.heldCandidates != null) assert.strictEqual(result.heldCandidates.length, expected.heldCandidates);
  const candidate = result.heldCandidates.find((item) => item.meeting_id === expected.meetingId) || result.heldCandidates[0];
  assert(candidate, "held candidate was not emitted");
  if (expected.meetingId) assert.strictEqual(candidate.meeting_id, expected.meetingId);
  if (expected.projectId) assert.strictEqual(candidate.project_id, expected.projectId);
  if (expected.prepSourceMeetingId) assert.strictEqual(candidate.prep_source_meeting_id, expected.prepSourceMeetingId);
  for (const kind of asArray(expected.sourceKindsContains)) {
    assert(candidate.source_kinds.split("+").includes(kind), `missing source kind: ${kind}`);
  }
  for (const [key, value] of Object.entries(expected.guardFlags || {})) {
    assert.strictEqual(candidate.guard_flags[key], value, `guard flag mismatch: ${key}`);
  }
  if (expected.configGaps != null) assert.strictEqual(result.configGaps.length, expected.configGaps);
  return result;
}

function main() {
  const args = process.argv.slice(2);
  const fixtureIndex = args.indexOf("--fixture");
  const fixturePath = fixtureIndex >= 0 ? args[fixtureIndex + 1] : "";
  if (!fixturePath) {
    console.error("Usage: node scripts/l6_meeting_held_source_guard.cjs --fixture <fixture.json>");
    process.exit(2);
  }
  const resolved = path.resolve(process.cwd(), fixturePath);
  const result = runFixture(resolved);
  console.log(`✅ L6 held-source guard OK: heldCandidates=${result.heldCandidates.length}, configGaps=${result.configGaps.length}`);
  for (const candidate of result.heldCandidates) {
    console.log(`  - ${candidate.project_id} ${candidate.meeting_id} source_kinds=${candidate.source_kinds} prep=${candidate.prep_source_meeting_id || "-"}`);
  }
}

if (require.main === module) main();

module.exports = {
  buildHeldCandidates,
  calendarAttachmentEvidence,
  matchNotionPage,
  relevantGmailThreads,
};
