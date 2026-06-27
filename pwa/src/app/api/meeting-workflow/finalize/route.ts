/**
 * POST /api/meeting-workflow/finalize
 *
 * Held meeting -> readable minutes -> next meeting prep -> action items -> Slack/App nudges.
 *
 * Event-driven endpoint. It is intentionally conservative:
 * - It never edits the original source transcript.
 * - If a next meeting time is not provided, it creates a draft for the same weekday/time next week.
 * - Calendar creation goes through GAS pwaApi so the existing Google Calendar authority is reused.
 * - Future nudges are scheduled at creation time; no polling job is required.
 */

import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://amd-os-pwa.vercel.app";
type AdminClient = ReturnType<typeof createAdminClient>;

type MeetingRow = {
  meeting_id: string;
  project_id: string;
  ym: string;
  meeting_date: string;
  meeting_start_at: string | null;
  title: string;
  summary_short: string;
  decided: unknown;
  progress: unknown;
  next_actions: unknown;
  risks: unknown;
  narrative_md: string | null;
  calendar_event_id: string | null;
  source_url: string | null;
  source_kinds: string | null;
};

type MemberRow = {
  member_id: string;
  code_name: string | null;
  email: string | null;
  slack_id: string | null;
};

type NextMeetingInput = {
  title?: string;
  meeting_start_at?: string;
  meeting_end_at?: string;
  attendee_emails?: string[];
  facilitator_member_id?: string;
  create_calendar?: boolean;
};

type PrepMeetingCandidate = {
  title: string;
  meetingStartAt: string;
  meetingEndAt: string;
  meetingDate: string;
  sourceText: string;
  source: "input" | "extracted";
  attendeeEmails: string[];
  facilitatorMemberId: string | null;
  createCalendar: boolean;
};

type OsContext = {
  text: string;
  milestoneTitles: string[];
};

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).map((s) => s.trim()).filter(Boolean);
}

function addDaysIso(base: string | null, days: number) {
  const d = base ? new Date(base) : new Date();
  if (Number.isNaN(d.getTime())) return new Date(Date.now() + days * 86400000).toISOString();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function oneHourAfter(iso: string) {
  const d = new Date(iso);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

async function authorize(req: NextRequest): Promise<{ ok: true; createdBy: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const workflowSecret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (workflowSecret && auth === `Bearer ${workflowSecret}`) return { ok: true, createdBy: "workflow" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { ok: true, createdBy: member.code_name || user.email };
}

function truncateText(value: unknown, maxLen: number) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

function markdownList(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- なし";
}

async function loadOsContext(admin: AdminClient, meeting: MeetingRow): Promise<OsContext> {
  const ym = meeting.ym || meeting.meeting_date.slice(0, 7).replace("-", "");
  const [projectRes, prevRes, upcomingRes, cycleRes] = await Promise.all([
    admin
      .from("projects")
      .select("project_id,project_name,status,project_category,start_ym,end_ym")
      .eq("project_id", meeting.project_id)
      .maybeSingle(),
    admin
      .from("project_meeting_summaries")
      .select("meeting_id,meeting_date,title,summary_short,next_actions,risks,narrative_md")
      .eq("project_id", meeting.project_id)
      .lt("meeting_date", meeting.meeting_date)
      .neq("source_kinds", "upcoming")
      .order("meeting_date", { ascending: false })
      .limit(3),
    admin
      .from("project_meeting_summaries")
      .select("meeting_id,meeting_date,title,summary_short,next_actions,prep_status,narrative_md")
      .eq("project_id", meeting.project_id)
      .gte("meeting_date", meeting.meeting_date)
      .eq("source_kinds", "upcoming")
      .order("meeting_date", { ascending: true })
      .limit(2),
    admin
      .from("value_plan_cycles")
      .select("plan_cycle_id,status,total_points,period_start_ym,period_end_ym")
      .eq("project_id", meeting.project_id)
      .in("status", ["active", "confirmed", "fixed", "draft"])
      .lte("period_start_ym", ym)
      .gte("period_end_ym", ym)
      .order("period_start_ym", { ascending: false })
      .limit(1),
  ]);

  const planCycle = (cycleRes.data ?? [])[0] ?? null;
  let milestoneRows: Array<Record<string, unknown>> = [];
  let progressRows: Array<Record<string, unknown>> = [];
  if (planCycle?.plan_cycle_id) {
    const msRes = await admin
      .from("value_milestones")
      .select("milestone_id,title,points,goal_level,success_criteria,period_start_ym,target_ym,sort_order")
      .eq("plan_cycle_id", planCycle.plan_cycle_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(8);
    milestoneRows = (msRes.data ?? []) as Array<Record<string, unknown>>;
    const milestoneIds = milestoneRows.map((m) => String(m.milestone_id || "")).filter(Boolean);
    if (milestoneIds.length > 0) {
      const progRes = await admin
        .from("milestone_monthly_progress")
        .select("milestone_key,progress_pct,source,note,confirmed_at")
        .in("milestone_key", milestoneIds)
        .eq("ym", ym);
      progressRows = (progRes.data ?? []) as Array<Record<string, unknown>>;
    }
  }

  const progressByKey = new Map(progressRows.map((p) => [String(p.milestone_key), p]));
  const project = projectRes.data as Record<string, unknown> | null;
  const prevMeetings = (prevRes.data ?? []) as Array<Record<string, unknown>>;
  const upcomingMeetings = (upcomingRes.data ?? []) as Array<Record<string, unknown>>;
  const milestoneTitles = milestoneRows.map((m) => String(m.title || "")).filter(Boolean);

  const text = [
    "## OSが見ている文脈",
    "",
    "### PJ",
    project
      ? `- ${String(project.project_name || meeting.project_id)} / status=${String(project.status || "")} / category=${String(project.project_category || "")}`
      : `- ${meeting.project_id}`,
    "",
    "### 前回までの流れ",
    prevMeetings.length
      ? prevMeetings.map((m) => `- ${String(m.meeting_date || "")} ${String(m.title || "MTG")}: ${truncateText(m.summary_short || m.narrative_md || "", 180)}`).join("\n")
      : "- 直近の過去MTGなし",
    "",
    "### 関連MS",
    milestoneRows.length
      ? milestoneRows.map((m) => {
          const p = progressByKey.get(String(m.milestone_id));
          const pct = p?.progress_pct == null ? "進捗未確認" : `進捗${String(p.progress_pct)}%`;
          return `- ${String(m.title || "")} (${String(m.points || "")}pt / ${pct}): ${truncateText(m.success_criteria || m.goal_level || "", 160)}`;
        }).join("\n")
      : "- 現行MSなし",
    "",
    "### 既に見えている次MTG準備",
    upcomingMeetings.length
      ? upcomingMeetings.map((m) => `- ${String(m.meeting_date || "")} ${String(m.title || "MTG")}: ${truncateText(m.summary_short || m.narrative_md || "", 180)}`).join("\n")
      : "- 既存の次MTG準備カードなし",
  ].join("\n");

  return { text, milestoneTitles };
}

function buildWorkflowMinutes(meeting: MeetingRow, osContext: OsContext) {
  const existing = meeting.narrative_md?.trim();
  if (existing) {
    return { minutes: existing, source: "routine_narrative" as const };
  }

  const decided = asStringArray(meeting.decided);
  const progress = asStringArray(meeting.progress);
  const nextActions = asStringArray(meeting.next_actions);
  const risks = asStringArray(meeting.risks);
  const base = existing || [
    `# ${meeting.title}`,
    "",
    "## サマリ",
    meeting.summary_short || "サマリ未作成",
    "",
    "## 進んだこと",
    markdownList(progress),
    "",
    "## 決まったこと",
    markdownList(decided),
    "",
    "## 次やること",
    markdownList(nextActions),
    "",
    "## 残課題・リスク",
    markdownList(risks),
  ].join("\n");

  return { minutes: [base.trim(), "", osContext.text].join("\n"), source: "deterministic_fallback" as const };
}

async function loadProjectMembers(projectId: string): Promise<MemberRow[]> {
  const admin = createAdminClient();
  const { data: links } = await admin
    .from("project_members")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("is_active", true);
  const ids = [...new Set((links ?? []).map((r) => r.member_id).filter(Boolean))];
  if (ids.length === 0) return [];
  const { data } = await admin
    .from("members")
    .select("member_id, code_name, email, slack_id")
    .in("member_id", ids);
  return (data ?? []) as MemberRow[];
}

function resolveOwner(action: string, members: MemberRow[]) {
  const lower = action.toLowerCase();
  return members.find((m) => {
    const code = (m.code_name || "").toLowerCase();
    return code && lower.includes(code);
  }) ?? null;
}

async function callGasCalendarCreate(payload: Record<string, unknown>) {
  const baseUrl = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
  const apiKey = process.env.NEXT_PUBLIC_GAS_API_KEY || process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (!baseUrl) return { ok: false, skipped: true, message: "NEXT_PUBLIC_GAS_WEBAPP_URL missing" };
  const url = new URL(baseUrl);
  url.searchParams.set("mode", "pwaApi");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("action", "runFunc");
  url.searchParams.set("fn", "nav_meeting_createCalendarEventForPrep_");
  url.searchParams.set("args", JSON.stringify([payload]));
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, message: JSON.stringify(json).slice(0, 300) };
  return json?.data?.result ?? json;
}

async function sendSlackNudges(args: {
  membersById: Map<string, MemberRow>;
  actionRows: Array<{ action_id: string; owner_member_id: string | null; title: string; detail: string | null; due_at: string | null }>;
  prepMeetingId: string;
  projectId: string;
}) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { sent: 0, scheduled: 0, updates: [] as Array<Record<string, string>>, skipped: "SLACK_BOT_TOKEN missing", errors: [] as string[] };
  const client = new WebClient(token);
  let sent = 0;
  let scheduled = 0;
  const updates: Array<Record<string, string>> = [];
  const errors: string[] = [];
  const link = `${APP_BASE_URL}/project/${args.projectId}/cockpit?meeting=${encodeURIComponent(args.prepMeetingId)}`;

  for (const action of args.actionRows) {
    const member = action.owner_member_id ? args.membersById.get(action.owner_member_id) : null;
    if (!member?.slack_id) continue;
    try {
      const open = await client.conversations.open({ users: member.slack_id });
      const channel = open.channel?.id || member.slack_id;
      const text = [
        `*次MTGまでのTODO*`,
        `• ${action.title}`,
        action.detail ? `• ${action.detail}` : "",
        action.due_at ? `• 期限: ${new Date(action.due_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}` : "",
        `<${link}|MTGカードを開く>`,
      ].filter(Boolean).join("\n");
      const postAt = action.due_at ? Math.floor(new Date(action.due_at).getTime() / 1000) - 24 * 60 * 60 : 0;
      if (postAt > Math.floor(Date.now() / 1000) + 60) {
        const res = await client.chat.scheduleMessage({
          channel,
          text,
          post_at: postAt,
        });
        scheduled++;
        updates.push({
          action_id: action.action_id,
          status: "nudged",
          scheduled_nudge_at: new Date(postAt * 1000).toISOString(),
          slack_scheduled_message_id: String(res.scheduled_message_id || ""),
        });
      } else {
        const res = await client.chat.postMessage({
          channel,
          text,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text },
            },
            { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "MTGカードを開く" }, url: link }] },
          ],
        });
        sent++;
        updates.push({
          action_id: action.action_id,
          status: "nudged",
          last_nudged_at: new Date().toISOString(),
          slack_message_ts: String(res.ts || ""),
        });
      }
    } catch (e) {
      errors.push(`${member.code_name || member.member_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { sent, scheduled, updates, errors };
}

async function sendFacilitatorNudge(args: {
  facilitator: MemberRow | null;
  nextStart: string;
  prepMeetingId: string;
  projectId: string;
  title: string;
}) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !args.facilitator?.slack_id) return null;
  const client = new WebClient(token);
  const link = `${APP_BASE_URL}/project/${args.projectId}/cockpit?meeting=${encodeURIComponent(args.prepMeetingId)}`;
  try {
    const open = await client.conversations.open({ users: args.facilitator.slack_id });
    const channel = open.channel?.id || args.facilitator.slack_id;
    const text = [
      `*明日のMTG資料チェック*`,
      `${args.title}`,
      `未完了の準備が残ってたら、MTGカードで資料を仕上げてね。`,
      `<${link}|MTGカードを開く>`,
    ].join("\n");
    const postAt = Math.floor(new Date(args.nextStart).getTime() / 1000) - 24 * 60 * 60;
    if (postAt > Math.floor(Date.now() / 1000) + 60) {
      const res = await client.chat.scheduleMessage({ channel, text, post_at: postAt });
      return {
        facilitator_nudge_scheduled_at: new Date(postAt * 1000).toISOString(),
        facilitator_slack_scheduled_message_id: String(res.scheduled_message_id || ""),
      };
    }
    await client.chat.postMessage({
      channel,
      text,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text },
        },
        { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "MTGカードを開く" }, url: link }] },
      ],
    });
    return {
      facilitator_nudge_scheduled_at: new Date().toISOString(),
      facilitator_slack_scheduled_message_id: "",
    };
  } catch {
    return null;
  }
}

function dateInJst(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value || "1970";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const d = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${d}`;
}

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function cleanMeetingText(value: string) {
  return normalizeDigits(value)
    .replace(/\*\*/g, "")
    .replace(/^[\s\-・*]+/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function baseProjectLabel(title: string) {
  const cleaned = cleanMeetingText(title)
    .replace(/\s*MTG\s*$/i, "")
    .replace(/\s*ミーティング\s*$/i, "")
    .trim();
  return cleaned || "次回";
}

function inferMeetingTitle(sourceText: string, fallbackTitle: string) {
  const text = cleanMeetingText(sourceText);
  const project = baseProjectLabel(fallbackTitle);
  if (/キックオフ/i.test(text)) return `${project} キックオフMTG`;
  const kohri = text.match(/桑折(?:先生|氏)?/);
  if (kohri) return `${project} 桑折先生 初回MTG`;
  const bracket = text.match(/【([^】]{2,40})】/);
  if (bracket?.[1]) return `${project} ${bracket[1]}`;
  return text.slice(0, 80) || `${project} 次回MTG`;
}

function yearForMonth(baseDate: string, month: number) {
  const baseYear = Number(baseDate.slice(0, 4));
  const baseMonth = Number(baseDate.slice(5, 7));
  return month + 1 < baseMonth ? baseYear + 1 : baseYear;
}

function parseExactMeetingStart(sourceText: string, baseDate: string): string | null {
  const text = normalizeDigits(sourceText);
  const time = text.match(/(\d{1,2})[:：](\d{2})/);
  if (!time) return null;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return null;

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  const ymd = text.match(/(20\d{2})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})日?/);
  if (ymd) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else {
    const md = text.match(/(?:^|[^\d])(\d{1,2})(?:\/|月)(\d{1,2})日?/);
    if (!md) return null;
    month = Number(md[1]);
    day = Number(md[2]);
    year = yearForMonth(baseDate, month);
  }
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const start = new Date(`${y}-${m}-${d}T${hh}:${mm}:00+09:00`);
  return Number.isNaN(start.getTime()) ? null : start.toISOString();
}

function looksLikeFutureMeeting(sourceText: string) {
  return /(MTG|ミーティング|打ち合わせ|打合せ|面談|キックオフ|初回打ち合わせ|報告会)/i.test(sourceText);
}

function extractMeetingCandidates(row: MeetingRow, nextInput: NextMeetingInput): PrepMeetingCandidate[] {
  const candidates: PrepMeetingCandidate[] = [];
  if (nextInput.meeting_start_at) {
    const start = new Date(nextInput.meeting_start_at);
    if (!Number.isNaN(start.getTime())) {
      const startIso = start.toISOString();
      candidates.push({
        title: nextInput.title?.trim() || `${baseProjectLabel(row.title)} 次回MTG`,
        meetingStartAt: startIso,
        meetingEndAt: nextInput.meeting_end_at || oneHourAfter(startIso),
        meetingDate: dateInJst(startIso),
        sourceText: "明示指定された次回MTG",
        source: "input",
        attendeeEmails: nextInput.attendee_emails ?? [],
        facilitatorMemberId: nextInput.facilitator_member_id || null,
        createCalendar: nextInput.create_calendar !== false,
      });
    }
  }

  const evidenceBlocks = [
    ...asStringArray(row.decided),
    ...asStringArray(row.next_actions),
    row.summary_short || "",
    row.narrative_md || "",
  ];
  for (const block of evidenceBlocks) {
    if (!looksLikeFutureMeeting(block)) continue;
    const startIso = parseExactMeetingStart(block, row.meeting_date);
    if (!startIso) continue;
    const meetingDate = dateInJst(startIso);
    if (meetingDate < row.meeting_date) continue;
    const sourceText = cleanMeetingText(block).slice(0, 700);
    candidates.push({
      title: inferMeetingTitle(block, row.title),
      meetingStartAt: startIso,
      meetingEndAt: oneHourAfter(startIso),
      meetingDate,
      sourceText,
      source: "extracted",
      attendeeEmails: [],
      facilitatorMemberId: null,
      createCalendar: false,
    });
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.meetingStartAt}|${candidate.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const meetingId = typeof body.meeting_id === "string" ? body.meeting_id.trim() : "";
  if (!meetingId) return NextResponse.json({ error: "meeting_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: meeting, error } = await admin
    .from("project_meeting_summaries")
    .select("meeting_id,project_id,ym,meeting_date,meeting_start_at,title,summary_short,decided,progress,next_actions,risks,narrative_md,calendar_event_id,source_url,source_kinds")
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!meeting) return NextResponse.json({ error: `meeting not found: ${meetingId}` }, { status: 404 });
  const row = meeting as MeetingRow;
  if (row.source_kinds === "upcoming" || row.meeting_id.startsWith("upcoming:")) {
    return NextResponse.json({ error: "cannot finalize an upcoming prep row" }, { status: 400 });
  }

  const osContext = await loadOsContext(admin, row);
  const minutes = buildWorkflowMinutes(row, osContext);

  const nextInput = (typeof body.next_meeting === "object" && body.next_meeting ? body.next_meeting : {}) as NextMeetingInput;
  const nextCandidates = extractMeetingCandidates(row, nextInput);

  const projectMembers = await loadProjectMembers(row.project_id);
  const projectMemberEmails = projectMembers.map((m) => m.email).filter((v): v is string => !!v);

  const actions = asStringArray(row.next_actions);

  const calendarDescription = [
    `# 前回議事録\n${minutes.minutes}`,
    actions.length > 0 ? `# 次MTGまでのTODO\n${actions.map((a) => `- [ ] ${a}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

  // ended / frozen PJ は「次回MTG prep」を自動生成しない (2026-06-03 まさ確定原則)。
  // 開催済みMTGの finalize 自体 (= 実進捗) は許すが、終了/凍結後の未来 prep は無意味なので作らない。
  // frozen 判定は status='frozen' または freeze_from_ym <= 次回MTGの ym。
  const { data: prepProj } = await admin
    .from("projects")
    .select("status, freeze_from_ym")
    .eq("project_id", row.project_id)
    .maybeSingle();
  const prepProjStatus = (prepProj as { status: string | null } | null)?.status ?? null;
  const prepFreezeFrom = (prepProj as { freeze_from_ym: string | null } | null)?.freeze_from_ym ?? null;
  const skipFuturePrep = (ym: string): boolean => {
    if (prepProjStatus === "ended") return true;
    if (prepProjStatus === "frozen") return true;
    if (prepFreezeFrom && ym >= prepFreezeFrom) return true;
    return false;
  };

  const prepResults: Array<{ meeting_id: string; title: string; meeting_start_at: string; source: string; calendar: Record<string, unknown> }> = [];
  const prepRows: Array<Record<string, unknown>> = [];
  for (const candidate of nextCandidates) {
    const candidateYm = candidate.meetingDate.slice(0, 4) + candidate.meetingDate.slice(5, 7);
    if (skipFuturePrep(candidateYm)) continue; // 終了/凍結PJの未来 prep はスキップ
    const attendeeEmails = [
      ...candidate.attendeeEmails,
      ...projectMemberEmails,
    ].map((s) => s.toLowerCase().trim()).filter(Boolean);
    const calendar = candidate.createCalendar
      ? await callGasCalendarCreate({
          projectId: row.project_id,
          title: candidate.title,
          startISO: candidate.meetingStartAt,
          endISO: candidate.meetingEndAt,
          attendeeEmails,
          description: calendarDescription,
          sourceMeetingId: row.meeting_id,
        })
      : { ok: false, skipped: true, message: "extracted candidate; calendar not auto-created" };

    const calendarResult = calendar as Record<string, unknown>;
    const calendarEventId = calendarResult?.ok === true && calendarResult.eventId ? String(calendarResult.eventId) : null;
    const prepMeetingId = calendarEventId
      ? `upcoming:${calendarEventId}`
      : `upcoming:${row.project_id}:${candidate.meetingDate.replace(/-/g, "")}:${sha256(row.meeting_id + candidate.title + candidate.meetingStartAt).slice(0, 12)}`;
    const prepNarrative = [
      "## 前回からの流れ",
      minutes.minutes,
      "",
      osContext.text,
      "",
      "## 次MTGの焦点",
      candidate.sourceText,
      "",
      actions.length > 0 ? "## 次MTGまでに揃えるもの" : "",
      actions.length > 0 ? actions.map((a) => `- [ ] ${a}`).join("\n") : "",
    ].filter(Boolean).join("\n");

    prepRows.push({
      meeting_id: prepMeetingId,
      project_id: row.project_id,
      ym: candidate.meetingDate.slice(0, 4) + candidate.meetingDate.slice(5, 7),
      meeting_date: candidate.meetingDate,
      meeting_start_at: candidate.meetingStartAt,
      title: candidate.title,
      notion_url: null,
      notion_page_id: null,
      calendar_event_id: calendarEventId,
      source_url: calendarResult?.ok === true && calendarResult.htmlLink ? String(calendarResult.htmlLink) : null,
      summary_short: candidate.sourceText || "前回議事録から抽出された次回MTG。",
      decided: [candidate.sourceText || "次回MTGの目的を確認する。"],
      progress: [row.summary_short || row.title],
      next_actions: actions,
      risks: asStringArray(row.risks),
      narrative_md: prepNarrative,
      gmail_thread_ids: [],
      source_kinds: "upcoming",
      source_hash: sha256(prepNarrative),
      generated_by_model: "workflow-no-llm",
      prep_source_meeting_id: row.meeting_id,
      prep_status: actions.length > 0 ? "nudging" : "draft",
      facilitator_member_id: candidate.facilitatorMemberId,
      updated_at: new Date().toISOString(),
    });
    prepResults.push({
      meeting_id: prepMeetingId,
      title: candidate.title,
      meeting_start_at: candidate.meetingStartAt,
      source: candidate.source,
      calendar: calendar as Record<string, unknown>,
    });
  }

  if (prepRows.length > 0) {
    const { error: prepError } = await admin.from("project_meeting_summaries").upsert(prepRows, { onConflict: "meeting_id" });
    if (prepError) return NextResponse.json({ error: prepError.message }, { status: 500 });
  }

  const primaryPrep = prepRows[0] ?? null;
  const primaryPrepMeetingId = typeof primaryPrep?.meeting_id === "string" ? primaryPrep.meeting_id : null;
  const primaryNextStart = typeof primaryPrep?.meeting_start_at === "string" ? primaryPrep.meeting_start_at : null;
  const primaryTitle = typeof primaryPrep?.title === "string" ? primaryPrep.title : null;

  const actionDrafts = primaryNextStart ? actions.map((title) => {
    const owner = resolveOwner(title, projectMembers);
    return {
      project_id: row.project_id,
      source_meeting_id: row.meeting_id,
      owner_member_id: owner?.member_id ?? null,
      owner_code_name: owner?.code_name ?? null,
      title: title.slice(0, 500),
      detail: null,
      due_at: primaryNextStart,
      status: "todo",
      source_hash: sha256(`${row.meeting_id}|${title}`),
    };
  }) : [];

  let insertedActions: Array<{ action_id: string; owner_member_id: string | null; title: string; detail: string | null; due_at: string | null }> = [];
  if (primaryPrepMeetingId && actionDrafts.length > 0) {
    const hashes = actionDrafts.map((a) => a.source_hash);
    const { data: existingActions, error: existingActionError } = await admin
      .from("meeting_action_items")
      .select("source_hash")
      .eq("prep_meeting_id", primaryPrepMeetingId)
      .in("source_hash", hashes);
    if (existingActionError) return NextResponse.json({ error: existingActionError.message }, { status: 500 });
    const existingHashes = new Set((existingActions ?? []).map((a) => String(a.source_hash || "")));
    const newActionDrafts = actionDrafts.filter((a) => !existingHashes.has(a.source_hash));
    if (newActionDrafts.length > 0) {
      const { data: actionRows, error: actionError } = await admin
        .from("meeting_action_items")
        .insert(newActionDrafts.map((a) => ({ ...a, prep_meeting_id: primaryPrepMeetingId })))
        .select("action_id, owner_member_id, title, detail, due_at");
      if (actionError) return NextResponse.json({ error: actionError.message }, { status: 500 });
      insertedActions = (actionRows ?? []) as typeof insertedActions;
    }
  }

  if (primaryPrepMeetingId && insertedActions.length > 0) {
    const link = `/project/${row.project_id}/cockpit?meeting=${encodeURIComponent(primaryPrepMeetingId)}`;
    await admin.from("app_notifications").insert(insertedActions.map((a) => ({
      kind: "meeting_action",
      title: `次MTGまで: ${a.title}`.slice(0, 180),
      body: a.detail,
      link,
      source: "meeting_workflow",
      meta: { meeting_id: row.meeting_id, prep_meeting_id: primaryPrepMeetingId, action_id: a.action_id },
    })));
  }

  const membersById = new Map(projectMembers.map((m) => [m.member_id, m]));
  const slack = primaryPrepMeetingId
    ? await sendSlackNudges({
        membersById,
        actionRows: insertedActions,
        prepMeetingId: primaryPrepMeetingId,
        projectId: row.project_id,
      })
    : { sent: 0, scheduled: 0, updates: [], skipped: "no exact next meeting", errors: [] };
  for (const update of slack.updates ?? []) {
    const { action_id, ...patch } = update;
    await admin.from("meeting_action_items").update(patch).eq("action_id", action_id);
  }

  const facilitatorId = typeof primaryPrep?.facilitator_member_id === "string" ? primaryPrep.facilitator_member_id : null;
  const facilitator = facilitatorId
    ? projectMembers.find((m) => m.member_id === facilitatorId) ?? null
    : null;
  const facilitatorNudge = facilitator && primaryNextStart && primaryPrepMeetingId && primaryTitle
    ? await sendFacilitatorNudge({
        facilitator,
        nextStart: primaryNextStart,
        prepMeetingId: primaryPrepMeetingId,
        projectId: row.project_id,
        title: primaryTitle,
      })
    : null;
  if (facilitatorNudge) {
    await admin
      .from("project_meeting_summaries")
      .update(facilitatorNudge)
      .eq("meeting_id", primaryPrepMeetingId);
  }

  return NextResponse.json({
    ok: true,
    meeting_id: row.meeting_id,
    narrative: { source: minutes.source, llm_called: false },
    next_meetings: prepResults,
    actions: { created: insertedActions.length, slack },
    facilitator_nudge: facilitatorNudge,
    created_by: authz.createdBy,
  });
}
