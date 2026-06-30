#!/usr/bin/env node

const fs = require("fs");
const crypto = require("crypto");

function stableText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stableText).join("\n");
  if (typeof value === "object") {
    return Object.values(value).map(stableText).join("\n");
  }
  return String(value);
}

function normalizeText(value) {
  return stableText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dateKey(value) {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function meetingId(meeting) {
  return meeting.meeting_id || meeting.id || meeting.calendar_event_id || "unknown-meeting";
}

function contextMarker(meeting, contextMd) {
  const digest = crypto.createHash("sha256").update(stableText(contextMd)).digest("hex").slice(0, 12);
  return `amd-os:notion-ai-context:${meetingId(meeting)}:${digest}`;
}

function markerPrefix(meeting) {
  return `amd-os:notion-ai-context:${meetingId(meeting)}:`;
}

function hasMeetingNotesShape(page) {
  const haystack = normalizeText([
    page.kind,
    page.type,
    page.database_name,
    page.template,
    page.title,
    page.content_md,
    page.body,
    page.text,
  ]);
  return Boolean(
    page.has_meeting_notes ||
      page.is_meeting_notes ||
      haystack.includes("<meeting-notes") ||
      haystack.includes("ai meeting notes") ||
      haystack.includes("meeting notes")
  );
}

function pageEventId(page) {
  return stableText(page.eventId || page.event_id || page.calendar_event_id || page.properties?.eventId || page.properties?.event_id).trim();
}

function pageDate(page) {
  return dateKey(page.date || page.meeting_date || page.start || page.created_time || page.last_edited_time || page.properties?.date);
}

function pageTitle(page) {
  return stableText(page.title || page.name || page.properties?.title || page.properties?.Name);
}

function attendeeHits(meeting, page) {
  const attendees = meeting.attendees || meeting.attendee_emails || [];
  const haystack = normalizeText([page.attendees, page.participants, page.content_md, page.body, page.text]);
  return attendees.filter((attendee) => haystack.includes(normalizeText(attendee))).length;
}

function titleHits(meeting, page) {
  const meetingTitle = normalizeText(meeting.title || meeting.summary);
  const target = normalizeText(pageTitle(page));
  if (!meetingTitle || !target) return 0;
  if (target.includes(meetingTitle) || meetingTitle.includes(target)) return 3;
  const tokens = meetingTitle.split(/[^a-z0-9ぁ-んァ-ヶ一-龠ー]+/).filter((token) => token.length >= 2);
  return tokens.filter((token) => target.includes(token)).length;
}

function scorePage(meeting, page) {
  if (!hasMeetingNotesShape(page)) {
    return { page, score: -1, reasons: ["not_meeting_notes"] };
  }

  const reasons = [];
  let score = 0;

  const eventId = pageEventId(page);
  if (eventId && eventId === stableText(meeting.calendar_event_id || meeting.event_id).trim()) {
    score += 100;
    reasons.push("event_id_exact");
  }

  const meetingDate = dateKey(meeting.meeting_start_at || meeting.start);
  const targetDate = pageDate(page);
  if (meetingDate && targetDate && meetingDate === targetDate) {
    score += 30;
    reasons.push("date_exact");
  } else if (meetingDate && targetDate) {
    reasons.push("date_mismatch");
  }

  const titleScore = titleHits(meeting, page);
  if (titleScore > 0) {
    score += Math.min(20, titleScore * 5);
    reasons.push(`title_hits:${titleScore}`);
  }

  const attendeeScore = attendeeHits(meeting, page);
  if (attendeeScore > 0) {
    score += Math.min(15, attendeeScore * 5);
    reasons.push(`attendee_hits:${attendeeScore}`);
  }

  return { page, score, reasons };
}

function pageHasMarker(page, marker, prefix) {
  const text = stableText([page.content_md, page.body, page.text, page.blocks, page.children]);
  return {
    exact: text.includes(marker),
    prefix: text.includes(prefix),
  };
}

function isAfterMeeting(input) {
  const now = input.now ? new Date(input.now) : new Date();
  const start = input.meeting?.meeting_start_at || input.meeting?.start;
  if (!start) return false;
  const meetingStart = new Date(start);
  if (Number.isNaN(now.getTime()) || Number.isNaN(meetingStart.getTime())) return false;
  return now.getTime() >= meetingStart.getTime();
}

function hasPostMeetingContent(meeting) {
  return Boolean(
    meeting.narrative_md ||
      meeting.summary_short ||
      (Array.isArray(meeting.decided) && meeting.decided.length > 0) ||
      (Array.isArray(meeting.next_actions) && meeting.next_actions.length > 0)
  );
}

function buildPrepNotionContextGate(input) {
  const meeting = input.meeting || {};
  const contextMd = input.context_md || input.contextMd || "";
  const marker = contextMarker(meeting, contextMd);
  const prefix = markerPrefix(meeting);
  const pages = Array.isArray(input.notionPages) ? input.notionPages : Array.isArray(input.notion_pages) ? input.notion_pages : [];
  const writeAttempted = Boolean(input.write_attempted || input.writeAttempted);

  if (isAfterMeeting(input) || hasPostMeetingContent(meeting)) {
    return {
      ok: true,
      status: "skipped_after_meeting",
      ready_gate: "complete_with_manual_context",
      marker,
      reason: "meeting_already_started_or_summary_exists",
    };
  }

  const scored = pages
    .map((page) => scorePage(meeting, page))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score);

  const existingId = input.existing_prep_notion_page_id || meeting.prep_notion_page_id;
  if (existingId) {
    const existing = scored.find((candidate) => candidate.page.id === existingId);
    if (!existing || existing.score < 30 || existing.reasons.includes("date_mismatch")) {
      return {
        ok: true,
        status: "wrong_page",
        ready_gate: "complete_with_manual_context",
        marker,
        existing_prep_notion_page_id: existingId,
        reason: "existing_prep_notion_page_id_does_not_match_target_meeting",
      };
    }
  }

  if (scored.length === 0 || scored[0].score < 30) {
    return {
      ok: true,
      status: "not_found",
      ready_gate: "complete_with_manual_context",
      marker,
      reason: "target_ai_meeting_notes_page_not_found",
    };
  }

  const top = scored[0];
  const second = scored[1];
  if (second && top.score - second.score < 10) {
    return {
      ok: true,
      status: "ambiguous",
      ready_gate: "complete_with_manual_context",
      marker,
      candidates: scored.slice(0, 3).map((candidate) => ({
        id: candidate.page.id,
        score: candidate.score,
        reasons: candidate.reasons,
        title: pageTitle(candidate.page),
      })),
      reason: "multiple_candidate_pages_too_close",
    };
  }

  const markerState = pageHasMarker(top.page, marker, prefix);
  if (markerState.exact) {
    return {
      ok: true,
      status: writeAttempted ? "injected" : "already_present",
      ready_gate: "complete",
      marker,
      target_page_id: top.page.id,
      target_page_url: top.page.url || null,
      target_score: top.score,
      target_reasons: top.reasons,
    };
  }

  if (writeAttempted) {
    return {
      ok: true,
      status: "write_failed",
      ready_gate: "complete_with_manual_context",
      marker,
      target_page_id: top.page.id,
      target_page_url: top.page.url || null,
      target_score: top.score,
      target_reasons: top.reasons,
      reason: markerState.prefix ? "older_marker_present_but_current_digest_missing" : "marker_missing_after_write_attempt",
    };
  }

  return {
    ok: false,
    status: "needs_insert",
    ready_gate: "blocked_until_insert",
    marker,
    target_page_id: top.page.id,
    target_page_url: top.page.url || null,
    target_score: top.score,
    target_reasons: top.reasons,
    insert_plan: {
      operation: "insert_content",
      page_id: top.page.id,
      mode: "append_only",
      marker,
      context_md: contextMd,
    },
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--fixture") {
      args.fixture = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--json") {
      args.json = true;
    }
  }
  return args;
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.fixture) {
    console.error("Usage: node scripts/l6_prep_notion_context_gate.cjs --fixture <payload.json> [--json]");
    process.exit(2);
  }
  const input = JSON.parse(fs.readFileSync(args.fixture, "utf8"));
  const result = buildPrepNotionContextGate(input);
  const expected = input.expected || {};
  if (expected.status && result.status !== expected.status) {
    console.error(`Expected status=${expected.status} but got ${result.status}`);
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (expected.ready_gate && result.ready_gate !== expected.ready_gate) {
    console.error(`Expected ready_gate=${expected.ready_gate} but got ${result.ready_gate}`);
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (args.json || input.print_json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`OK L6 prep Notion context gate: status=${result.status}, ready_gate=${result.ready_gate}`);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  buildPrepNotionContextGate,
  contextMarker,
  markerPrefix,
  scorePage,
};
