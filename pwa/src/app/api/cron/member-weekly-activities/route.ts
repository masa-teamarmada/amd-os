/**
 * GET /api/cron/member-weekly-activities
 *
 * Gmail / Calendar / source_cache の短い根拠から、メンバー別の「今週やったこと」を
 * member_activities(source='member_weekly') に保存する。
 *
 * ここに入った行は /mypage の週次表示に使い、既存の member_knowledge など
 * member_activities を入力にする L2 からも参照できるようにする。
 */
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

type MemberRow = {
  member_id: string;
  code_name: string | null;
  email: string | null;
  status: string | null;
  google_calendar_status?: string | null;
};

type ProjectRow = {
  project_id: string;
  project_name: string;
  client_name: string | null;
  report_emails: string | null;
  status: string | null;
  project_category?: string | null;
  aliases?: string[];
};

type Evidence = {
  evidenceId: string;
  sourceKind: "gmail" | "calendar" | "source_cache" | "meeting_summary";
  sourceSubkind?: string;
  title: string;
  snippet: string;
  itemDate: string;
  sourceUrl?: string | null;
  participantEmails: string[];
  projectIds: string[];
  memberIds: string[];
  raw?: Record<string, unknown>;
};

type ActivityGroup = {
  groupId: string;
  memberId: string;
  projectId: string;
  itemDate: string;
  evidence: Evidence[];
};

type SynthesizedActivity = {
  groupId: string;
  title: string;
  contentPreview: string;
  confidence: number | null;
  method: "llm" | "fallback";
};

type ReadableCalendar = {
  calendarId: string;
  ownerEmail: string;
};

type CalendarAccess = {
  cal: ReturnType<typeof google.calendar> | null;
  calendars: ReadableCalendar[];
  readableMemberEmails: string[];
  missingMemberEmails: string[];
};

type MeetingSummaryRow = {
  meeting_id: string | null;
  project_id: string | null;
  ym: string | null;
  meeting_date: string | null;
  meeting_start_at: string | null;
  title: string | null;
  summary_short: string | null;
  decided: unknown;
  progress: unknown;
  next_actions: unknown;
  notion_url: string | null;
  notion_page_id: string | null;
  source_url: string | null;
  calendar_event_id: string | null;
};

const SOURCE = "member_weekly";
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder"
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateKeyJST(date: Date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${pad2(jst.getUTCMonth() + 1)}-${pad2(jst.getUTCDate())}`;
}

function dateTimeFromMeetingSummary(row: Pick<MeetingSummaryRow, "meeting_start_at" | "meeting_date" | "title">) {
  if (row.meeting_start_at) {
    const date = new Date(row.meeting_start_at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const dateKey = row.meeting_date && /^\d{4}-\d{2}-\d{2}$/.test(row.meeting_date) ? row.meeting_date : null;
  if (!dateKey) return null;
  const titleTime = String(row.title || "").match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/);
  const hour = titleTime ? Number(titleTime[1]) : 12;
  const minute = titleTime ? Number(titleTime[2]) : 0;
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute, 0) - 9 * 60 * 60 * 1000);
}

function normalizedKey(value: string) {
  return cleanText(value, 240)
    .toLowerCase()
    .replace(/[（）()[\]【】「」『』"'`]/g, " ")
    .replace(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/g, " ")
    .replace(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, 240)).filter(Boolean)
    : [];
}

function meetingEvidenceText(row: MeetingSummaryRow) {
  const progress = stringList(row.progress);
  const decided = stringList(row.decided);
  const next = stringList(row.next_actions);
  return [
    row.summary_short ? `要約: ${row.summary_short}` : "",
    progress.length ? `進捗: ${progress.join(" / ")}` : "",
    decided.length ? `決定: ${decided.join(" / ")}` : "",
    next.length ? `次アクション: ${next.join(" / ")}` : "",
  ].filter(Boolean).join("\n");
}

function dateTimeKeyJST(date: Date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${pad2(jst.getUTCMonth() + 1)}-${pad2(jst.getUTCDate())}T${pad2(jst.getUTCHours())}:${pad2(jst.getUTCMinutes())}+09:00`;
}

function activityWindowBoundsJST(input?: string | null) {
  let endUtcMs: number;
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    endUtcMs = Date.UTC(y, m - 1, d, 18, 0, 0) - 9 * 60 * 60 * 1000;
  } else {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    endUtcMs = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 18, 0, 0) - 9 * 60 * 60 * 1000;
    if (now.getTime() < endUtcMs) endUtcMs -= 86400000;
  }
  const end = new Date(endUtcMs);
  const start = new Date(end.getTime() - 86400000);
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startKey: dateTimeKeyJST(start),
    endKey: dateTimeKeyJST(end),
    windowKey: `${dateKeyJST(start)}-18_to_${dateKeyJST(end)}-18`,
  };
}

function ymFromIsoJST(iso: string) {
  const date = new Date(iso);
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${pad2(jst.getUTCMonth() + 1)}`;
}

function cleanText(value: unknown, max = 700) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function extractEmails(...values: unknown[]) {
  const set = new Set<string>();
  for (const value of values) {
    const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
    for (const match of text.match(EMAIL_RE) ?? []) set.add(match.toLowerCase());
  }
  return [...set];
}

function splitEmails(value: string | null | undefined) {
  return extractEmails(value || "");
}

function headerValue(headers: Array<{ name?: string | null; value?: string | null }> | undefined, name: string) {
  return headers?.find((h) => (h.name || "").toLowerCase() === name.toLowerCase())?.value || "";
}

function messageDate(message: { internalDate?: string | null }, fallback: Date) {
  const n = Number(message.internalDate || 0);
  return Number.isFinite(n) && n > 0 ? new Date(n) : fallback;
}

function canonicalTokens(project: ProjectRow) {
  return [
    project.project_id,
    project.project_name,
    project.client_name || "",
    project.project_name.replace(/[株式会社合同会社大学]/g, ""),
    ...(project.aliases || []),
  ]
    .map((s) => cleanText(s, 80).toLowerCase())
    .filter((s) => s.length >= 2);
}

function buildProjectMatcher(projects: ProjectRow[], excludedEmails: Set<string>) {
  const emailToProjectIds = new Map<string, string[]>();
  const projectTokens = new Map<string, string[]>();
  for (const project of projects) {
    projectTokens.set(project.project_id, canonicalTokens(project));
    for (const email of splitEmails(project.report_emails)) {
      if (excludedEmails.has(email) || email.endsWith("@team-armada.jp")) continue;
      const list = emailToProjectIds.get(email) || [];
      list.push(project.project_id);
      emailToProjectIds.set(email, list);
    }
  }

  return (input: { text: string; emails: string[]; fallbackProjectId?: string | null }) => {
    const found = new Set<string>();
    if (input.fallbackProjectId) found.add(input.fallbackProjectId);
    for (const email of input.emails) {
      for (const pid of emailToProjectIds.get(email.toLowerCase()) || []) found.add(pid);
    }
    const haystack = input.text.toLowerCase();
    for (const project of projects) {
      for (const token of projectTokens.get(project.project_id) || []) {
        if (tokenMatches(haystack, token)) found.add(project.project_id);
      }
    }
    return [...found];
  };
}

function tokenMatches(haystack: string, token: string) {
  if (token.length <= 2 && /^[a-z0-9]+$/.test(token)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}([^a-z0-9]|$)`, "i").test(haystack);
  }
  return haystack.includes(token);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMemberMatcher(members: MemberRow[]) {
  const emailToMemberId = new Map<string, string>();
  for (const member of members) {
    if (member.email) emailToMemberId.set(member.email.toLowerCase(), member.member_id);
  }
  return (emails: string[]) => {
    const found = new Set<string>();
    for (const email of emails) {
      const memberId = emailToMemberId.get(email.toLowerCase());
      if (memberId) found.add(memberId);
    }
    return [...found];
  };
}

function shouldSkipEmailLike(input: { from?: string; subject?: string; snippet?: string }) {
  const text = `${input.from || ""}\n${input.subject || ""}\n${input.snippet || ""}`.toLowerCase();
  return /noreply|no-reply|notification@|alert@|mailer-daemon|donotreply/.test(text) ||
    /security vulnerabilit|invoice|請求書|パスワード通知|password notification|system generated|unattended email/.test(text);
}

function labelsFromMeta(meta: Record<string, unknown>): string[] {
  const raw = Array.isArray(meta.labels) ? meta.labels : Array.isArray(meta.labelIds) ? meta.labelIds : [];
  return raw.map((label) => String(label || "").toLowerCase());
}

function isActionableEmailMeta(meta: Record<string, unknown>, internalEmails: Set<string>) {
  const labels = labelsFromMeta(meta);
  if (labels.some((label) => label === "sent" || label === "draft")) return true;
  const fromEmails = extractEmails(meta.from, meta.sender);
  return fromEmails.some((email) => internalEmails.has(email));
}

function isInternalEmail(email: string) {
  return email.toLowerCase().endsWith("@team-armada.jp");
}

function internalCollaborationFallbackProjectId(input: { text: string; emails: string[] }) {
  const internalCount = new Set(input.emails.filter(isInternalEmail)).size;
  if (internalCount < 2) return null;
  const text = input.text.toLowerCase();
  if (/okudoor|oku\s*door|zema/.test(text)) return "p19";
  if (/okudoor|oku\s*door|システム|開発|実装|作業|レビュー|打ち合わせ|mtg|meeting|相談|オンライン/.test(text)) {
    return "p00";
  }
  return null;
}

function stripSubject(value: string) {
  return cleanText(
    value
      .replace(/^(メール|予定|gmail|calendar):\s*/i, "")
      .replace(/^(予定を主催|予定に参加|メールを送信|返信ドラフトを作成):\s*/i, "")
      .replace(/^Re:\s*/i, ""),
    140
  );
}

function actionPreview(item: Evidence) {
  const title = stripSubject(item.title || "活動");
  if (item.sourceKind === "gmail") {
    return item.sourceSubkind === "draft"
      ? `返信ドラフトを作成: ${title}`
      : `メールを送信: ${title}`;
  }
  if (item.sourceKind === "calendar") {
    return item.sourceSubkind === "organizer"
      ? `予定を主催: ${title}`
      : `予定に参加: ${title}`;
  }
  if (item.sourceKind === "meeting_summary") return title;
  if ((item.sourceSubkind || "").startsWith("gmail")) return `メール対応: ${title}`;
  return `${item.sourceSubkind || item.sourceKind}: ${title}`;
}

function clampConfidence(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function sourceAnchor(item: Evidence) {
  const raw = item.raw || {};
  const eventId =
    typeof raw.calendar_event_id === "string" ? raw.calendar_event_id :
    typeof raw.event_id === "string" ? raw.event_id :
    typeof raw.meeting_id === "string" ? raw.meeting_id :
    "";
  if (eventId) return `event:${eventId}`;
  const threadId = typeof raw.thread_id === "string" ? raw.thread_id : "";
  if (threadId) return `thread:${threadId}`;
  return `title:${dateKeyJST(new Date(item.itemDate))}:${normalizedKey(item.title)}`;
}

function groupEvidence(evidence: Evidence[], memberIdFilter?: string | null, projectIdFilter?: string | null) {
  const map = new Map<string, ActivityGroup>();
  for (const item of evidence) {
    for (const projectId of item.projectIds) {
      if (projectIdFilter && projectId !== projectIdFilter) continue;
      for (const memberId of item.memberIds) {
        if (memberIdFilter && memberId !== memberIdFilter) continue;
        const groupId = `${projectId}:${memberId}:${sourceAnchor(item)}`;
        const existing = map.get(groupId);
        if (existing) {
          existing.evidence.push(item);
          if (new Date(item.itemDate) < new Date(existing.itemDate)) existing.itemDate = item.itemDate;
        } else {
          map.set(groupId, { groupId, memberId, projectId, itemDate: item.itemDate, evidence: [item] });
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => a.itemDate.localeCompare(b.itemDate));
}

function evidenceForPrompt(item: Evidence) {
  return {
    sourceKind: item.sourceKind,
    sourceSubkind: item.sourceSubkind || null,
    title: stripSubject(item.title),
    snippet: cleanText(item.snippet, 900),
    itemDate: item.itemDate,
    participantEmails: item.participantEmails.slice(0, 12),
    sourceUrl: item.sourceUrl || null,
    raw: {
      event_id: item.raw?.event_id || null,
      calendar_event_id: item.raw?.calendar_event_id || null,
      meeting_id: item.raw?.meeting_id || null,
      thread_id: item.raw?.thread_id || null,
    },
  };
}

function fallbackSynthesis(group: ActivityGroup): SynthesizedActivity {
  const best = group.evidence.find((item) => item.sourceKind === "meeting_summary") || group.evidence[0];
  const sourceText = cleanText(best.snippet, 220);
  const preview = sourceText || actionPreview(best);
  const title = sourceText
    ? sourceText.replace(/^(要約|進捗|決定|次アクション):\s*/, "").slice(0, 120)
    : actionPreview(best).slice(0, 120);
  return {
    groupId: group.groupId,
    title: title || actionPreview(best).slice(0, 120),
    contentPreview: preview,
    confidence: null,
    method: "fallback",
  };
}

function cleanActivityTitle(value: string, fallback: string) {
  const cleaned = cleanText(value || fallback, 160)
    .replace(/^(予定を主催|予定に参加):\s*/i, "")
    .replace(/^主催した[:：]?\s*/i, "")
    .trim();
  return (cleaned || fallback).slice(0, 120);
}

async function synthesizeActivityGroups(groups: ActivityGroup[]): Promise<Map<string, SynthesizedActivity>> {
  const result = new Map<string, SynthesizedActivity>();
  groups.forEach((group) => result.set(group.groupId, fallbackSynthesis(group)));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || groups.length === 0) return result;

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.MEMBER_WEEKLY_ACTIVITY_MODEL || "claude-sonnet-4-6";
  const groupsForPrompt = groups.slice(0, Number(process.env.MEMBER_WEEKLY_ACTIVITY_MAX_GROUPS || 40));
  const payload = groupsForPrompt.map((group) => ({
    groupId: group.groupId,
    projectId: group.projectId,
    memberId: group.memberId,
    itemDate: group.itemDate,
    evidence: group.evidence.map(evidenceForPrompt),
  }));

  const system =
    "あなたはAMD OSの週次活動抽出器。Calendar/Gmail/source_cache/議事録を上下関係なく根拠として読み、" +
    "そのメンバーが実務として何を進めたかを短い日本語で書く。カレンダーのタイトルだけ、議事録だけ、メールだけに飛びつかず、" +
    "複数ソースが同じ活動を指すなら統合して成果・前進・作業内容を優先する。単に「予定を主催」「予定に参加」とは書かない。";
  const user =
    "次の evidence group ごとに、member_activities に保存する活動文をJSONで返して。\n" +
    "制約:\n" +
    "- title は40字前後、最大80字。実務の内容を書く。\n" +
    "- contentPreview は根拠を含む1文、最大180字。\n" +
    "- 根拠にないことは断定しない。推測が必要なら弱い表現にする。\n" +
    "- Calendarのdescription/TODOも有効な根拠。Notion議事録だけを優先しない。\n" +
    "- 出力は {\"activities\":[{\"groupId\":\"...\",\"title\":\"...\",\"contentPreview\":\"...\",\"confidence\":0.0-1.0}]} のみ。\n\n" +
    JSON.stringify({ groups: payload }, null, 2);

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = response.content
      .map((part) => part.type === "text" ? part.text : "")
      .join("\n")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text);
    const activities = Array.isArray(parsed.activities) ? parsed.activities : [];
    for (const activity of activities as Array<Record<string, unknown>>) {
      const groupId = String(activity.groupId || "");
      const fallback = result.get(groupId);
      if (!groupId || !fallback) continue;
      const title = cleanActivityTitle(String(activity.title || ""), fallback.title);
      const contentPreview = cleanText(activity.contentPreview || title, 220);
      result.set(groupId, {
        groupId,
        title,
        contentPreview,
        confidence: clampConfidence(activity.confidence),
        method: "llm",
      });
    }
  } catch (error) {
    console.warn("[member-weekly-activities] activity fusion LLM skipped:", error);
  }

  return result;
}

function requiresCalendarLogin(member: MemberRow) {
  const email = member.email?.trim().toLowerCase() || "";
  const codeName = member.code_name || "";
  if (!email.endsWith("@team-armada.jp")) return false;
  if (["info", "つくよみ"].includes(codeName)) return false;
  return true;
}

function isWeeklyActivityTarget(member: MemberRow) {
  return requiresCalendarLogin(member);
}

async function fetchSourceCacheEvidence(
  supabase: SupabaseClient,
  bounds: ReturnType<typeof activityWindowBoundsJST>,
  matchProject: ReturnType<typeof buildProjectMatcher>,
  matchMembers: ReturnType<typeof buildMemberMatcher>,
  internalEmails: Set<string>
): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from("source_cache")
    .select("project_id, source, item_id, title, item_date, content_text, metadata_json")
    .in("source", ["gmail", "gmail_message", "calendar", "gmeet"])
    .gte("item_date", bounds.startIso)
    .lt("item_date", bounds.endIso)
    .order("item_date", { ascending: true })
    .limit(300);
  if (error) throw error;

  return (data ?? [])
    .map((row: Record<string, unknown>): Evidence | null => {
      const meta = typeof row.metadata_json === "object" && row.metadata_json !== null
        ? (row.metadata_json as Record<string, unknown>)
        : {};
      const title = cleanText(row.title || "(no title)", 160);
      const snippet = cleanText(row.content_text || meta.snippet || meta.text_preview || "", 700);
      const emails = extractEmails(meta, row.content_text);
      const source = String(row.source || "");
      if ((source === "gmail" || source === "gmail_message") && !isActionableEmailMeta(meta, internalEmails)) return null;
      const actorEmails = source === "gmail" || source === "gmail_message"
        ? extractEmails(meta.from, meta.sender)
        : emails;
      if (shouldSkipEmailLike({
        from: typeof meta.from === "string" ? meta.from : "",
        subject: title,
        snippet,
      })) return null;
      let projectIds = matchProject({
        text: `${title}\n${snippet}\n${JSON.stringify(meta)}`,
        emails,
        fallbackProjectId: typeof row.project_id === "string" ? row.project_id : null,
      });
      if (projectIds.length === 0) {
        const fallbackProjectId = internalCollaborationFallbackProjectId({ text: `${title}\n${snippet}`, emails });
        if (fallbackProjectId) projectIds = [fallbackProjectId];
      }
      const memberIds = matchMembers(actorEmails);
      if (!row.item_date || projectIds.length === 0 || memberIds.length === 0) return null;
      return {
        evidenceId: `${row.source}:${row.item_id}`,
        sourceKind: "source_cache",
        sourceSubkind: String(row.source || ""),
        title,
        snippet,
        itemDate: String(row.item_date),
        sourceUrl: typeof meta.source_url === "string" ? meta.source_url : typeof meta.permalink === "string" ? meta.permalink : null,
        participantEmails: emails,
        projectIds,
        memberIds,
        raw: { item_id: row.item_id, source: row.source },
      };
    })
    .filter((row): row is Evidence => !!row);
}

async function fetchGmailEvidence(
  bounds: ReturnType<typeof activityWindowBoundsJST>,
  matchProject: ReturnType<typeof buildProjectMatcher>,
  matchMembers: ReturnType<typeof buildMemberMatcher>,
  maxMessages: number
): Promise<Evidence[]> {
  const auth = await getGoogleAuthAsync();
  if (!auth) return [];
  const gmail = google.gmail({ version: "v1", auth });
  const after = dateKeyJST(bounds.start).replace(/-/g, "/");
  const before = dateKeyJST(new Date(bounds.end.getTime() + 86400000)).replace(/-/g, "/");
  // まさ判断 (2026-05-22 #3): 「ただ受信したメール」を活動として扱わない。
  // - in:sent (自分が送ったメール = 自分のアクションの証跡)
  // - in:drafts (返信ドラフトを書いた = 着手しているアクション) も含める
  // 受信のみ (label:inbox かつ自分が送信者でない) は活動として拾わない。
  const listed = await gmail.users.messages.list({
    userId: "me",
    q: `(in:sent OR in:drafts) after:${after} before:${before}`,
    maxResults: Math.min(200, Math.max(1, maxMessages)),
  });

  const rows: Evidence[] = [];
  for (const ref of listed.data.messages ?? []) {
    if (!ref.id) continue;
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: ref.id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Cc", "Date", "Subject"],
    });
    const labelIds = new Set(msg.data.labelIds ?? []);
    // 念のため: SENT / DRAFT ラベルを持つメールのみ通す
    if (!labelIds.has("SENT") && !labelIds.has("DRAFT")) continue;
    const headers = msg.data.payload?.headers ?? [];
    const subject = headerValue(headers, "Subject") || "(no subject)";
    const from = headerValue(headers, "From");
    const to = headerValue(headers, "To");
    const cc = headerValue(headers, "Cc");
    const emails = extractEmails(from, to, cc);
    const snippet = cleanText(msg.data.snippet || "", 700);
    if (shouldSkipEmailLike({ from, subject, snippet })) continue;
    let projectIds = matchProject({ text: `${subject}\n${snippet}`, emails });
    if (projectIds.length === 0) {
      const fallbackProjectId = internalCollaborationFallbackProjectId({ text: `${subject}\n${snippet}`, emails });
      if (fallbackProjectId) projectIds = [fallbackProjectId];
    }
    const memberIds = matchMembers(extractEmails(from));
    if (projectIds.length === 0 || memberIds.length === 0) continue;
    const itemDate = messageDate(msg.data, bounds.start);
    if (itemDate < bounds.start || itemDate >= bounds.end) continue;
    rows.push({
      evidenceId: `gmail:${msg.data.threadId || ref.id}:${ref.id}`,
      sourceKind: "gmail",
      sourceSubkind: labelIds.has("SENT") ? "sent" : "draft",
      title: subject,
      snippet,
      itemDate: itemDate.toISOString(),
      participantEmails: emails,
      projectIds,
      memberIds,
      raw: { message_id: ref.id, thread_id: msg.data.threadId || null, from, to, cc },
    });
  }
  return rows;
}

async function fetchCalendarEvidence(
  bounds: ReturnType<typeof activityWindowBoundsJST>,
  matchProject: ReturnType<typeof buildProjectMatcher>,
  matchMembers: ReturnType<typeof buildMemberMatcher>,
  cal: ReturnType<typeof google.calendar> | null,
  calendars: ReadableCalendar[]
): Promise<Evidence[]> {
  if (!cal) return [];
  const rows: Evidence[] = [];

  for (const calendar of calendars) {
    let listed;
    try {
      listed = await cal.events.list({
        calendarId: calendar.calendarId,
        timeMin: bounds.startIso,
        timeMax: bounds.endIso,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      });
    } catch (error) {
      console.warn("[member-weekly-activities] calendar events skipped:", calendar.calendarId, error);
      continue;
    }

    for (const event of listed.data.items ?? []) {
      // まさ判断 (2026-05-22 #3): 「招待されたが行ってない」予定を活動扱いにしない。
      // - organizer.self=true (= 自分が主催) なら必ず通す
      // - そうでなければ attendees の self が responseStatus='accepted' か 'tentative' に限る
      // - declined / needsAction だけの招待は除外
      const ownerEmail = (calendar.ownerEmail || "").toLowerCase();
      const isOrganizer = event.organizer?.self === true ||
        (!!event.organizer?.email && event.organizer.email.toLowerCase() === ownerEmail);
      const selfAttendee = (event.attendees ?? []).find(
        (a) => a.self === true || (a.email || "").toLowerCase() === ownerEmail
      );
      const attended = !!selfAttendee && (selfAttendee.responseStatus === "accepted" || selfAttendee.responseStatus === "tentative");
      // 招待されてもいない event は organizer 判定で fallback (= 1on1 で attendees 空のケースを救う)
      if (!isOrganizer && !attended && (event.attendees?.length ?? 0) > 0) continue;

      const title = cleanText(event.summary || "(無題)", 160);
      const snippet = cleanText(event.description || event.location || "", 700);
      const emails = extractEmails(
        event.creator?.email,
        event.organizer?.email,
        event.attendees?.map((a) => a.email).join(" "),
        calendar.ownerEmail || ""
      );
      let projectIds = matchProject({ text: `${title}\n${snippet}`, emails });
      if (projectIds.length === 0) {
        const fallbackProjectId = internalCollaborationFallbackProjectId({ text: `${title}\n${snippet}`, emails });
        if (fallbackProjectId) projectIds = [fallbackProjectId];
      }
      const memberIds = matchMembers(emails);
      const itemDate = event.start?.dateTime || event.start?.date || null;
      if (!event.id || !itemDate || projectIds.length === 0 || memberIds.length === 0) continue;
      rows.push({
        evidenceId: `calendar:${calendar.calendarId}:${event.id}`,
        sourceKind: "calendar",
        sourceSubkind: isOrganizer ? "organizer" : "attended",
        title,
        snippet,
        itemDate: new Date(itemDate).toISOString(),
        sourceUrl: event.htmlLink || null,
        participantEmails: emails,
        projectIds,
        memberIds,
        raw: { event_id: event.id, calendar_id: calendar.calendarId, html_link: event.htmlLink || null, response_status: selfAttendee?.responseStatus || null },
      });
    }
  }
  return rows;
}

async function fetchMeetingSummaryEvidence(
  supabase: SupabaseClient,
  bounds: ReturnType<typeof activityWindowBoundsJST>,
  matchProject: ReturnType<typeof buildProjectMatcher>,
  calendarEvidence: Evidence[]
): Promise<Evidence[]> {
  const startDate = dateKeyJST(bounds.start);
  const endDate = dateKeyJST(bounds.end);
  const { data, error } = await supabase
    .from("project_meeting_summaries")
    .select("meeting_id, project_id, ym, meeting_date, meeting_start_at, title, summary_short, decided, progress, next_actions, notion_url, notion_page_id, source_url, calendar_event_id")
    .gte("meeting_date", startDate)
    .lte("meeting_date", endDate)
    .order("meeting_date", { ascending: true })
    .limit(120);
  if (error) throw error;

  const calendarByEventId = new Map<string, Evidence>();
  const calendarByTitleDate = new Map<string, Evidence>();
  for (const item of calendarEvidence) {
    const eventId = typeof item.raw?.event_id === "string" ? item.raw.event_id : "";
    if (eventId) calendarByEventId.set(eventId, item);
    calendarByTitleDate.set(`${dateKeyJST(new Date(item.itemDate))}:${normalizedKey(item.title)}`, item);
  }

  const rows: Evidence[] = [];
  for (const row of (data ?? []) as MeetingSummaryRow[]) {
    const itemDate = dateTimeFromMeetingSummary(row);
    if (!itemDate || itemDate < bounds.start || itemDate >= bounds.end) continue;
    const title = cleanText(row.title || "議事録", 160);
    const calendarHit =
      (row.calendar_event_id ? calendarByEventId.get(row.calendar_event_id) : null) ||
      calendarByTitleDate.get(`${dateKeyJST(itemDate)}:${normalizedKey(title)}`);
    if (!calendarHit || calendarHit.memberIds.length === 0) continue;

    let projectIds = row.project_id ? [row.project_id] : [];
    if (projectIds.length === 0) {
      projectIds = matchProject({
        text: `${title}\n${row.summary_short || ""}\n${stringList(row.progress).join("\n")}\n${stringList(row.decided).join("\n")}`,
        emails: calendarHit.participantEmails,
      });
    }
    if (projectIds.length === 0) continue;
    const primaryProjectId = projectIds[0];
    const meetingText = meetingEvidenceText(row);
    rows.push({
      evidenceId: `meeting_summary:${row.meeting_id || row.notion_page_id || `${primaryProjectId}:${itemDate.toISOString()}`}`,
      sourceKind: "meeting_summary",
      sourceSubkind: "notion",
      title,
      snippet: cleanText(meetingText || row.summary_short || "", 1200),
      itemDate: itemDate.toISOString(),
      sourceUrl: row.notion_url || row.source_url || calendarHit.sourceUrl || null,
      participantEmails: calendarHit.participantEmails,
      projectIds,
      memberIds: calendarHit.memberIds,
      raw: {
        meeting_id: row.meeting_id,
        notion_page_id: row.notion_page_id,
        calendar_event_id: row.calendar_event_id || null,
        summary_short: row.summary_short || "",
        progress: stringList(row.progress),
        decided: stringList(row.decided),
        next_actions: stringList(row.next_actions),
      },
    });
  }
  return rows;
}

async function resolveReadableMemberCalendars(
  memberEmails: Set<string>
): Promise<CalendarAccess> {
  const requiredEmails = [...memberEmails].sort();
  if (requiredEmails.length === 0) {
    return {
      cal: null,
      calendars: [],
      readableMemberEmails: [],
      missingMemberEmails: [],
    };
  }
  const auth = await getGoogleAuthAsync();
  if (!auth) {
    return {
      cal: null,
      calendars: [],
      readableMemberEmails: [],
      missingMemberEmails: requiredEmails,
    };
  }
  const cal = google.calendar({ version: "v3", auth });
  const calendars = new Map<string, ReadableCalendar>();
  const readableMemberEmails = new Set<string>();
  try {
    const listed = await cal.calendarList.list({ maxResults: 250 });
    for (const entry of listed.data.items ?? []) {
      if (!entry.id) continue;
      const matchedEmails = extractEmails(
        entry.id,
        entry.summary || "",
        entry.summaryOverride || "",
        entry.description || ""
      ).filter((email) => memberEmails.has(email));
      const ownerEmail = matchedEmails[0] || null;
      if (!ownerEmail) continue;
      matchedEmails.forEach((email) => readableMemberEmails.add(email));
      calendars.set(entry.id, { calendarId: entry.id, ownerEmail });
    }
  } catch (error) {
    console.warn("[member-weekly-activities] calendar list skipped:", error);
  }
  const readable = [...readableMemberEmails].sort();
  return {
    cal,
    calendars: [...calendars.values()],
    readableMemberEmails: readable,
    missingMemberEmails: requiredEmails.filter((email) => !readableMemberEmails.has(email)),
  };
}

function dedupeEvidence(items: Evidence[]) {
  const map = new Map<string, Evidence>();
  for (const item of items) {
    const key = `${item.sourceKind}:${item.evidenceId}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function removeCalendarRowsCoveredByMeetings(calendar: Evidence[], meetings: Evidence[]) {
  const coveredEventIds = new Set(
    meetings
      .map((item) => typeof item.raw?.calendar_event_id === "string" ? item.raw.calendar_event_id : "")
      .filter(Boolean)
  );
  return calendar.filter((item) => {
    const eventId = typeof item.raw?.event_id === "string" ? item.raw.event_id : "";
    return !eventId || !coveredEventIds.has(eventId);
  });
}

async function buildActivityRows(evidence: Evidence[], windowKey: string, memberIdFilter?: string | null, projectIdFilter?: string | null) {
  const groups = groupEvidence(evidence, memberIdFilter, projectIdFilter);
  const synthesized = await synthesizeActivityGroups(groups);
  const rows = [];
  for (const group of groups) {
    const activity = synthesized.get(group.groupId) || fallbackSynthesis(group);
    const sourceItemId = `${windowKey}:${createHash("sha1")
      .update(group.groupId)
      .digest("hex")
      .slice(0, 20)}`;
    const sourceKinds = [...new Set(group.evidence.map((item) => item.sourceKind))];
    const sourceUrls = group.evidence.map((item) => item.sourceUrl).filter(Boolean);
    rows.push({
      member_id: group.memberId,
      project_id: group.projectId,
      ym: ymFromIsoJST(group.itemDate),
      source: SOURCE,
      source_item_id: sourceItemId,
      title: activity.title.slice(0, 120),
      content_preview: activity.contentPreview || activity.title,
      item_date: group.itemDate,
      initiative_origin: "unknown",
      impact: null,
      depth: null,
      raw_metadata: {
        weekly_activity: true,
        window_key: windowKey,
        source_kind: "source_fusion",
        source_kinds: sourceKinds,
        synthesis_method: activity.method,
        synthesis_confidence: activity.confidence,
        source_url: sourceUrls[0] || null,
        evidence_refs: group.evidence.map((item) => ({
          evidence_id: item.evidenceId,
          source_kind: item.sourceKind,
          source_subkind: item.sourceSubkind || null,
          title: item.title,
          source_url: item.sourceUrl || null,
        })),
        participant_emails: [...new Set(group.evidence.flatMap((item) => item.participantEmails))],
      },
    });
  }
  return { rows, groups };
}

async function deleteExistingWeeklyRows(
  supabase: SupabaseClient,
  bounds: ReturnType<typeof activityWindowBoundsJST>,
  memberId?: string | null,
  projectId?: string | null
) {
  let del = supabase
    .from("member_activities")
    .delete()
    .eq("source", SOURCE)
    .gte("item_date", bounds.startIso)
    .lt("item_date", bounds.endIso);
  if (memberId) del = del.eq("member_id", memberId);
  if (projectId) del = del.eq("project_id", projectId);
  const { error } = await del;
  if (error) throw error;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const interactiveManualRun = req.nextUrl.searchParams.get("interactive") === "1";
  if (process.env.ALLOW_PWA_LLM_CRONS !== "1" && !interactiveManualRun) {
    return NextResponse.json({
      ok: true,
      disabled: true,
      reason: "LLM-backed PWA background cron is disabled; member activity extraction should run via subscription automation.",
      saved: 0,
    });
  }

  try {
    const supabase = getServiceClient();
    const bounds = activityWindowBoundsJST(req.nextUrl.searchParams.get("windowEnd") || req.nextUrl.searchParams.get("weekStart"));
    const save = req.nextUrl.searchParams.get("save") !== "0";
    const memberId = req.nextUrl.searchParams.get("memberId");
    const projectId = req.nextUrl.searchParams.get("projectId");
    const maxMessages = Number(req.nextUrl.searchParams.get("maxMessages") || 120);

    const [membersRes, memberEmailsRes, projectsRes, aliasesRes] = await Promise.all([
      supabase
        .from("members")
        .select("member_id, code_name, email, status, google_calendar_status")
        .eq("status", "active"),
      supabase
        .from("members")
        .select("email")
        .not("email", "is", null),
      supabase
        .from("projects")
        .select("project_id, project_name, client_name, report_emails, status, project_category")
        .or("status.eq.active,project_category.eq.advisor"),
      supabase
        .from("project_knowledge")
        .select("project_id, entity_name, fact_text")
        .eq("category", "alias")
        .eq("status", "active"),
    ]);
    if (membersRes.error) throw membersRes.error;
    if (memberEmailsRes.error) throw memberEmailsRes.error;
    if (projectsRes.error) throw projectsRes.error;
    if (aliasesRes.error) throw aliasesRes.error;

    const members = (membersRes.data ?? []) as MemberRow[];
    const aliasesByProject = new Map<string, string[]>();
    for (const alias of aliasesRes.data ?? []) {
      const projectId = String(alias.project_id || "");
      const values = [alias.entity_name, alias.fact_text].map((v) => cleanText(v, 80)).filter(Boolean);
      if (!projectId || values.length === 0) continue;
      aliasesByProject.set(projectId, [...(aliasesByProject.get(projectId) || []), ...values]);
    }
    const projects = ((projectsRes.data ?? []) as ProjectRow[]).map((project) => ({
      ...project,
      aliases: aliasesByProject.get(project.project_id) || [],
    }));
    const pendingCalendarLogin = members
      .filter((member) => requiresCalendarLogin(member) && member.google_calendar_status !== "connected")
      .map((member) => ({
        memberId: member.member_id,
        codeName: member.code_name,
        email: member.email,
        calendarStatus: member.google_calendar_status || "missing",
      }));
    const targetMembers = members
      .filter((member) => isWeeklyActivityTarget(member))
      .filter((member) => !memberId || member.member_id === memberId);
    const calendarSourceMembers = members
      .filter((member) => requiresCalendarLogin(member))
      .filter((member) => member.google_calendar_status === "connected");
    const internalEmails = new Set(
      (memberEmailsRes.data ?? [])
        .map((row) => String(row.email || "").trim().toLowerCase())
        .filter((email): email is string => !!email)
    );
    const matchProject = buildProjectMatcher(projects, internalEmails);
    const matchMembers = buildMemberMatcher(targetMembers);
    const requiredCalendarEmails = new Set(
      calendarSourceMembers
        .map((member) => member.email?.trim().toLowerCase())
        .filter((email): email is string => !!email)
    );
    const calendarAccess = await resolveReadableMemberCalendars(requiredCalendarEmails);

    const [sourceCache, gmail, calendar] = await Promise.all([
      fetchSourceCacheEvidence(supabase, bounds, matchProject, matchMembers, internalEmails),
      fetchGmailEvidence(bounds, matchProject, matchMembers, maxMessages).catch((error) => {
        console.warn("[member-weekly-activities] gmail skipped:", error);
        return [] as Evidence[];
      }),
      fetchCalendarEvidence(bounds, matchProject, matchMembers, calendarAccess.cal, calendarAccess.calendars).catch((error) => {
        console.warn("[member-weekly-activities] calendar skipped:", error);
        return [] as Evidence[];
      }),
    ]);

    const meetingSummaries = await fetchMeetingSummaryEvidence(supabase, bounds, matchProject, calendar);
    const evidence = dedupeEvidence([
      ...sourceCache,
      ...gmail,
      ...meetingSummaries,
      ...removeCalendarRowsCoveredByMeetings(calendar, meetingSummaries),
    ]);
    const { rows, groups: fusionGroups } = await buildActivityRows(evidence, bounds.windowKey, memberId, projectId);

    if (save) {
      await deleteExistingWeeklyRows(supabase, bounds, memberId, projectId);

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("member_activities")
          .upsert(rows, { onConflict: "member_id,project_id,source,source_item_id" });
        if (insertError) throw insertError;
      }
    }

    return NextResponse.json({
      ok: true,
      windowKey: bounds.windowKey,
      windowStart: bounds.startKey,
      windowEnd: bounds.endKey,
      sourceCacheEvidence: sourceCache.length,
      gmailEvidence: gmail.length,
      calendarEvidence: calendar.length,
      meetingSummaryEvidence: meetingSummaries.length,
      calendarReadableMembers: calendarAccess.readableMemberEmails.length,
      calendarMissingMembers: calendarAccess.missingMemberEmails.length,
      targetMembers: targetMembers.length,
      calendarSourceMembers: calendarSourceMembers.length,
      pendingCalendarLogin,
      note: pendingCalendarLogin.length > 0 ? "calendar login consent required for pending members" : null,
      evidenceCount: evidence.length,
      fusionGroups: fusionGroups.length,
      saved: save ? rows.length : 0,
      preview: rows.slice(0, 20),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/member-weekly-activities]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
