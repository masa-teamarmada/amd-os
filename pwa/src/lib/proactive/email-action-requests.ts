import { google, type gmail_v1 } from "googleapis";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";

export const EMAIL_ACTION_REQUEST_TRIGGER = "email_action_request";

type AdminDb = ReturnType<typeof createAdminClient>;

type EmailProjectRow = {
  project_id: string;
  project_name: string | null;
  client_name: string | null;
  report_emails: string | null;
};

export type EmailActionSweepStats = {
  enabled: boolean;
  scanned_projects: number;
  gmail_threads: number;
  upserted: number;
  skipped_no_auth: number;
  skipped_no_report_emails: number;
  skipped_internal_sender: number;
  skipped_attachment_notice: number;
  skipped_no_action: number;
  skipped_no_due: number;
  errors: string[];
};

const INTERNAL_EMAIL_DOMAINS = ["team-armada.jp"];

const EMAIL_ACTION_KEYWORDS = [
  "までに",
  "期限",
  "締切",
  "ご返送",
  "ご回答",
  "ご教示",
  "ご確認",
  "ご対応",
  "お願いいたします",
  "お願いします",
  "ご都合",
  "候補日時",
  "候補日",
  "日程調整",
  "修正案",
  "フロー図",
  "チェックリスト",
  "内規",
  "規程",
  "エフォート",
  "eAPRIN",
  "履修状況",
];

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

function splitEmails(value: string | null | undefined): string[] {
  return String(value || "")
    .split(/[,\s;]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function searchTerm(emailOrDomain: string): string {
  const raw = emailOrDomain.trim();
  return raw.startsWith("@") ? raw.slice(1) : raw;
}

function compact(value: string | null | undefined, max = 700): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeGmailBody(data: string | null | undefined): string {
  if (!data) return "";
  try {
    return Buffer.from(String(data).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function textFromPayload(payload: gmail_v1.Schema$MessagePart | undefined | null): string {
  const plainParts: string[] = [];
  const htmlParts: string[] = [];
  const walk = (part: gmail_v1.Schema$MessagePart | undefined | null) => {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) {
      plainParts.push(decodeGmailBody(part.body.data));
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      htmlParts.push(htmlToText(decodeGmailBody(part.body.data)));
    }
    for (const child of part.parts || []) walk(child);
  };
  walk(payload);
  return (plainParts.length ? plainParts : htmlParts).filter(Boolean).join("\n\n").trim();
}

function formatGmailDate(date: Date): string {
  return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
}

function jstParts(reference: Date): { year: number; month: number; day: number; weekday: number } {
  const jst = new Date(reference.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
    weekday: jst.getUTCDay(),
  };
}

function formatJstDateTime(reference: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(reference);
}

function jstDayEndIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return new Date(`${year}-${mm}-${dd}T18:00:00+09:00`).toISOString();
}

function fridayOfWeekJst(reference: Date, weeksAhead: number): string {
  const parts = jstParts(reference);
  const daysUntilFriday = (5 - parts.weekday + 7) % 7;
  const jstCursor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  jstCursor.setUTCDate(jstCursor.getUTCDate() + daysUntilFriday + weeksAhead * 7);
  return jstDayEndIso(jstCursor.getUTCFullYear(), jstCursor.getUTCMonth() + 1, jstCursor.getUTCDate());
}

function monthEndJst(reference: Date): string {
  const parts = jstParts(reference);
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return jstDayEndIso(parts.year, parts.month, lastDay);
}

function extractEmailDueAt(text: string, reference: Date): string | null {
  const normalized = compact(text, 4000);
  const full = normalized.match(/(20\d{2})\s*[\/年.-]\s*(\d{1,2})\s*[\/月.-]\s*(\d{1,2})\s*(?:日)?[\s（）()A-Za-zぁ-んァ-ヶー一-龥]{0,16}(?:まで|迄|期限|締切|ご返送|ご回答|提出|回答)/);
  if (full) {
    return jstDayEndIso(Number(full[1]), Number(full[2]), Number(full[3]));
  }

  const monthDay = normalized.match(/(?<!\d)(\d{1,2})\s*(?:月|\/)\s*(\d{1,2})\s*(?:日)?[\s（）()A-Za-zぁ-んァ-ヶー一-龥]{0,16}(?:まで|迄|期限|締切|ご返送|ご回答|提出|回答)/);
  if (monthDay) {
    const current = jstParts(reference);
    let year = current.year;
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    const candidate = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T18:00:00+09:00`);
    if (candidate.getTime() < reference.getTime() - 30 * 86400_000) year++;
    return jstDayEndIso(year, month, day);
  }

  if (/今週中|週内/.test(normalized)) return fridayOfWeekJst(reference, 0);
  if (/来週中|来週末/.test(normalized)) return fridayOfWeekJst(reference, 1);
  if (/月末|今月末/.test(normalized)) return monthEndJst(reference);
  return null;
}

function stripQuotedBody(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const markers = [
    "\n-----Original Message-----",
    "\n----- Original Message -----",
    "\nFrom:",
    "\n差出人:",
  ];
  const regexMarkers = [
    /\nOn .{1,160}wrote:/i,
    /\n\d{4}年\d{1,2}月\d{1,2}日.{0,160}<[^>]+>:/,
  ];

  let cutAt = normalized.length;
  for (const marker of markers) {
    const idx = normalized.indexOf(marker);
    if (idx > 0) cutAt = Math.min(cutAt, idx);
  }
  for (const re of regexMarkers) {
    const match = re.exec(normalized);
    if (match?.index && match.index > 0) cutAt = Math.min(cutAt, match.index);
  }
  return normalized.slice(0, cutAt).trim();
}

function sanitizeEmailText(value: string, max = 500): string {
  return compact(value, max)
    .replace(/https?:\/\/\S+/gi, "[URL省略]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[メール省略]")
    .replace(/(?:パスワード|パスコード|暗証番号|password|passcode)[^。\n]{0,100}/gi, "[認証情報省略]")
    .replace(/\b\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}\b/g, "[電話番号省略]")
    .slice(0, max);
}

function senderDisplay(from: string): string {
  const noAddress = from.replace(/<[^>]+>/g, "").replace(/["']/g, "").trim();
  return sanitizeEmailText(noAddress || "外部送信者", 80);
}

function messageDate(message: gmail_v1.Schema$Message | undefined | null, fallback: Date): Date {
  return message?.internalDate ? new Date(Number(message.internalDate)) : fallback;
}

function isInternalSender(headers: gmail_v1.Schema$MessagePartHeader[] | undefined): boolean {
  const from = headerValue(headers, "From").toLowerCase();
  return INTERNAL_EMAIL_DOMAINS.some((domain) => from.includes(domain));
}

function isAttachmentNoticeMessage(subject: string, text: string): boolean {
  if (/パスワード通知|password notification/i.test(subject)) return true;
  const head = `${subject}\n${text.slice(0, 900)}`;
  const looksLikeAttachmentNotice = /添付ファイル分離のお知らせ|ダウンロードセンター|download center/i.test(head);
  const hasBusinessRequest = /【\s*[１２12]|今後のスケジュール|内規|規程|チェックリスト|フロー図|ご返送|ご教示|エフォート|eAPRIN|履修状況/i.test(text);
  return looksLikeAttachmentNotice && !hasBusinessRequest;
}

function hasEmailActionRequest(text: string): boolean {
  const normalized = compact(text, 4000);
  const request = /までに|まで|期限|締切|ご返送|ご回答|ご教示|ご確認|ご対応|お願いいたします|お願いします|頂けます|いただけます|ご都合|候補日時|候補日|日程調整/i;
  const object = /内規|規程|チェックリスト|フロー図|修正案|エフォート|eAPRIN|履修状況|ご都合|候補日時|候補日|資料|確認|回答|返送|提出|日程/i;
  return request.test(normalized) && object.test(normalized);
}

function titleFromEmailAction(text: string, projectId: string): string {
  const normalized = compact(text, 2000);
  if (/内規|規程/.test(normalized) && /チェックリスト/.test(normalized) && /フロー図/.test(normalized)) {
    return `${projectId} メール依頼: 内規・チェックリスト再修正案・フロー図を返送する`;
  }
  if (/エフォート/.test(normalized) && /eAPRIN|履修状況/i.test(normalized)) {
    return `${projectId} メール依頼: エフォートとeAPRIN履修状況を回答する`;
  }
  if (/ご都合|候補日時|候補日|日程調整/.test(normalized)) {
    return `${projectId} メール依頼: 次回MTGの日程希望を回答する`;
  }
  const line = normalized
    .split(/[。\n]/)
    .map((s) => s.trim())
    .find((s) => /まで|期限|締切|ご返送|ご回答|ご教示|ご確認|お願いします|お願いいたします/.test(s));
  return `${projectId} メール依頼: ${(line || normalized).slice(0, 70)}`;
}

function buildEmailActionQuery(project: EmailProjectRow, daysBack: number): string {
  const senders = splitEmails(project.report_emails)
    .map(searchTerm)
    .filter(Boolean)
    .map((term) => `from:${term}`);
  if (senders.length === 0) return "";

  const start = new Date(Date.now() - daysBack * 86400_000);
  const end = new Date(Date.now() + 2 * 86400_000);
  const keywordExpr = `(${EMAIL_ACTION_KEYWORDS.map((k) => `"${k}"`).join(" OR ")})`;
  return [
    `after:${formatGmailDate(start)}`,
    `before:${formatGmailDate(end)}`,
    `(${senders.join(" OR ")})`,
    keywordExpr,
    "-in:chats",
    "-in:spam",
    "-in:trash",
  ].join(" ");
}

function isPastIso(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export async function sweepEmailActionRequests(db: AdminDb): Promise<EmailActionSweepStats> {
  const stats: EmailActionSweepStats = {
    enabled: true,
    scanned_projects: 0,
    gmail_threads: 0,
    upserted: 0,
    skipped_no_auth: 0,
    skipped_no_report_emails: 0,
    skipped_internal_sender: 0,
    skipped_attachment_notice: 0,
    skipped_no_action: 0,
    skipped_no_due: 0,
    errors: [],
  };

  const auth = await getGoogleAuthAsync();
  if (!auth) {
    stats.enabled = false;
    stats.skipped_no_auth = 1;
    return stats;
  }

  const maxProjects = envInt("PROACTIVE_TODO_EMAIL_MAX_PROJECTS", 50, 1, 120);
  const maxThreadsPerProject = envInt("PROACTIVE_TODO_EMAIL_MAX_THREADS_PER_PROJECT", 4, 1, 20);
  const lookbackDays = envInt("PROACTIVE_TODO_EMAIL_LOOKBACK_DAYS", 14, 1, 45);

  const { data: projects, error: projectErr } = await db
    .from("projects")
    .select("project_id, project_name, client_name, report_emails")
    .eq("status", "active")
    .not("report_emails", "is", null)
    .order("project_id", { ascending: true })
    .limit(maxProjects);
  if (projectErr) {
    stats.errors.push(`projects:${projectErr.message}`);
    return stats;
  }

  const gmail = google.gmail({ version: "v1", auth });

  for (const project of (projects ?? []) as EmailProjectRow[]) {
    stats.scanned_projects++;
    const query = buildEmailActionQuery(project, lookbackDays);
    if (!query) {
      stats.skipped_no_report_emails++;
      continue;
    }

    const list = await gmail.users.threads.list({
      userId: "me",
      q: query,
      maxResults: maxThreadsPerProject,
    }).catch((e) => {
      stats.errors.push(`${project.project_id}:list:${String(e?.message ?? e).slice(0, 160)}`);
      return null;
    });
    if (!list?.data?.threads?.length) continue;

    for (const threadRef of list.data.threads) {
      if (!threadRef.id) continue;
      stats.gmail_threads++;
      const detail = await gmail.users.threads.get({
        userId: "me",
        id: threadRef.id,
        format: "full",
      }).catch((e) => {
        stats.errors.push(`${project.project_id}:get:${String(e?.message ?? e).slice(0, 160)}`);
        return null;
      });
      const messages = detail?.data?.messages ?? [];
      if (messages.length === 0) continue;

      const externalCandidates = messages
        .slice()
        .reverse()
        .filter((message) => !isInternalSender(message.payload?.headers));
      const latest = externalCandidates.find((message) => {
        const subject = headerValue(message.payload?.headers, "Subject");
        const body = stripQuotedBody(textFromPayload(message.payload) || message.snippet || "");
        return !isAttachmentNoticeMessage(subject, body);
      }) ?? externalCandidates[0] ?? null;

      if (!latest) {
        stats.skipped_internal_sender++;
        continue;
      }

      const headers = latest.payload?.headers;
      const subject = headerValue(headers, "Subject");
      const body = stripQuotedBody(textFromPayload(latest.payload) || latest.snippet || "");
      if (isAttachmentNoticeMessage(subject, body)) {
        stats.skipped_attachment_notice++;
        continue;
      }

      const combined = `${subject}\n${body}`;
      if (!hasEmailActionRequest(combined)) {
        stats.skipped_no_action++;
        continue;
      }

      const receivedAt = messageDate(latest, new Date());
      const dueAt = extractEmailDueAt(combined, receivedAt);
      if (!dueAt) {
        stats.skipped_no_due++;
        continue;
      }

      const sourceEventId = `gmail:${detail?.data?.id || threadRef.id}`;
      const title = titleFromEmailAction(combined, project.project_id);
      const detailText = [
        `Gmailから検知: ${sanitizeEmailText(subject, 160)}`,
        `送信者: ${senderDisplay(headerValue(headers, "From"))}`,
        `受信日時: ${formatJstDateTime(receivedAt)}`,
        `期限: ${formatJstDateTime(new Date(dueAt))}`,
        `要点: ${sanitizeEmailText(body, 420)}`,
        "本文全文・URL・パスワードは保存しない。",
      ].join("\n");

      const { error: upsertErr } = await db.from("proactive_todos").upsert(
        {
          project_id: project.project_id,
          trigger_kind: EMAIL_ACTION_REQUEST_TRIGGER,
          source_meeting_id: "",
          source_event_id: sourceEventId,
          title,
          detail: detailText,
          ball_owner: "amd",
          due_at: dueAt,
          due_basis: "explicit",
          priority: isPastIso(dueAt) ? "red" : "normal",
        },
        { onConflict: "project_id,trigger_kind,source_meeting_id,source_event_id,title", ignoreDuplicates: false },
      );
      if (upsertErr) {
        stats.errors.push(`${project.project_id}:upsert:${upsertErr.message}`);
      } else {
        stats.upserted++;
      }
    }
  }

  return stats;
}
