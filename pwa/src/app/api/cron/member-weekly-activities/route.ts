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
};

type Evidence = {
  evidenceId: string;
  sourceKind: "gmail" | "calendar" | "source_cache";
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

function requiresCalendarLogin(member: MemberRow) {
  const email = member.email?.trim().toLowerCase() || "";
  const codeName = member.code_name || "";
  if (!email.endsWith("@team-armada.jp")) return false;
  if (["info", "つくよみ"].includes(codeName)) return false;
  return true;
}

async function fetchSourceCacheEvidence(
  supabase: SupabaseClient,
  bounds: ReturnType<typeof activityWindowBoundsJST>,
  matchProject: ReturnType<typeof buildProjectMatcher>,
  matchMembers: ReturnType<typeof buildMemberMatcher>
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
      if (shouldSkipEmailLike({
        from: typeof meta.from === "string" ? meta.from : "",
        subject: title,
        snippet,
      })) return null;
      const projectIds = matchProject({
        text: `${title}\n${snippet}\n${JSON.stringify(meta)}`,
        emails,
        fallbackProjectId: typeof row.project_id === "string" ? row.project_id : null,
      });
      const memberIds = matchMembers(emails);
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
    const projectIds = matchProject({ text: `${subject}\n${snippet}`, emails });
    const memberIds = matchMembers(emails);
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
      const projectIds = matchProject({ text: `${title}\n${snippet}`, emails });
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

function buildActivityRows(evidence: Evidence[], windowKey: string, memberIdFilter?: string | null, projectIdFilter?: string | null) {
  const rows = [];
  for (const item of evidence) {
    for (const projectId of item.projectIds) {
      if (projectIdFilter && projectId !== projectIdFilter) continue;
      for (const memberId of item.memberIds) {
        if (memberIdFilter && memberId !== memberIdFilter) continue;
        const sourceItemId = `${windowKey}:${createHash("sha1")
          .update(`${item.evidenceId}:${projectId}:${memberId}`)
          .digest("hex")
          .slice(0, 20)}`;
        const kindLabel = item.sourceKind === "calendar"
          ? "予定"
          : item.sourceKind === "gmail"
            ? "メール"
            : item.sourceSubkind || "source";
        rows.push({
          member_id: memberId,
          project_id: projectId,
          ym: ymFromIsoJST(item.itemDate),
          source: SOURCE,
          source_item_id: sourceItemId,
          title: `${kindLabel}: ${item.title}`.slice(0, 120),
          content_preview: item.snippet || `${kindLabel}から検出した今週の活動`,
          item_date: item.itemDate,
          initiative_origin: "unknown",
          impact: null,
          depth: null,
          raw_metadata: {
            weekly_activity: true,
            window_key: windowKey,
            evidence_id: item.evidenceId,
            source_kind: item.sourceKind,
            source_subkind: item.sourceSubkind || null,
            source_url: item.sourceUrl || null,
            participant_emails: item.participantEmails,
          },
        });
      }
    }
  }
  return rows;
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

  try {
    const supabase = getServiceClient();
    const bounds = activityWindowBoundsJST(req.nextUrl.searchParams.get("windowEnd") || req.nextUrl.searchParams.get("weekStart"));
    const save = req.nextUrl.searchParams.get("save") !== "0";
    const memberId = req.nextUrl.searchParams.get("memberId");
    const projectId = req.nextUrl.searchParams.get("projectId");
    const maxMessages = Number(req.nextUrl.searchParams.get("maxMessages") || 120);

    const [membersRes, memberEmailsRes, projectsRes] = await Promise.all([
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
    ]);
    if (membersRes.error) throw membersRes.error;
    if (memberEmailsRes.error) throw memberEmailsRes.error;
    if (projectsRes.error) throw projectsRes.error;

    const members = (membersRes.data ?? []) as MemberRow[];
    const projects = (projectsRes.data ?? []) as ProjectRow[];
    const pendingCalendarLogin = members
      .filter((member) => requiresCalendarLogin(member) && member.google_calendar_status !== "connected")
      .map((member) => ({
        memberId: member.member_id,
        codeName: member.code_name,
        email: member.email,
        calendarStatus: member.google_calendar_status || "missing",
      }));
    const eligibleMembers = members
      .filter((member) => requiresCalendarLogin(member))
      .filter((member) => member.google_calendar_status === "connected")
      .filter((member) => !memberId || member.member_id === memberId);
    const internalEmails = new Set(
      (memberEmailsRes.data ?? [])
        .map((row) => String(row.email || "").trim().toLowerCase())
        .filter((email): email is string => !!email)
    );
    const matchProject = buildProjectMatcher(projects, internalEmails);
    const matchMembers = buildMemberMatcher(eligibleMembers);
    const requiredCalendarEmails = new Set(
      eligibleMembers
        .map((member) => member.email?.trim().toLowerCase())
        .filter((email): email is string => !!email)
    );
    const calendarAccess = await resolveReadableMemberCalendars(requiredCalendarEmails);

    const [sourceCache, gmail, calendar] = await Promise.all([
      fetchSourceCacheEvidence(supabase, bounds, matchProject, matchMembers),
      fetchGmailEvidence(bounds, matchProject, matchMembers, maxMessages).catch((error) => {
        console.warn("[member-weekly-activities] gmail skipped:", error);
        return [] as Evidence[];
      }),
      fetchCalendarEvidence(bounds, matchProject, matchMembers, calendarAccess.cal, calendarAccess.calendars).catch((error) => {
        console.warn("[member-weekly-activities] calendar skipped:", error);
        return [] as Evidence[];
      }),
    ]);

    const evidence = dedupeEvidence([...sourceCache, ...gmail, ...calendar]);
    const rows = buildActivityRows(evidence, bounds.windowKey, memberId, projectId);

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
      calendarReadableMembers: calendarAccess.readableMemberEmails.length,
      calendarMissingMembers: calendarAccess.missingMemberEmails.length,
      eligibleMembers: eligibleMembers.length,
      pendingCalendarLogin,
      note: pendingCalendarLogin.length > 0 ? "calendar login consent required for pending members" : null,
      evidenceCount: evidence.length,
      saved: save ? rows.length : 0,
      preview: rows.slice(0, 20),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/member-weekly-activities]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
