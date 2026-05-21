import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { getGoogleAuthAsync } from "@/lib/sources/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder"
  );
}

function checkCronAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

function ymBounds(ym: string) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
  return { start, end, startQuery: fmt(start), endQuery: fmt(end) };
}

function splitEmails(value: string | null | undefined) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function searchTerm(emailOrDomain: string) {
  const raw = emailOrDomain.trim();
  if (raw.startsWith("@")) return raw.slice(1);
  return raw;
}

function buildQuery(reportEmails: string[], ym: string) {
  const { startQuery, endQuery } = ymBounds(ym);
  const clauses = reportEmails.map((email) => {
    const term = searchTerm(email);
    return `(from:${term} OR to:${term} OR cc:${term})`;
  });
  return [`after:${startQuery}`, `before:${endQuery}`, clauses.length ? `(${clauses.join(" OR ")})` : ""]
    .filter(Boolean)
    .join(" ");
}

function headerValue(headers: Array<{ name?: string | null; value?: string | null }> | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function shouldSkipMessage(headers: Array<{ name?: string | null; value?: string | null }> | undefined) {
  const subject = headerValue(headers, "Subject").toLowerCase();
  return [
    "パスワード通知",
    "password notification",
    "password notice",
    "パスワードのお知らせ",
  ].some((pattern) => subject.includes(pattern.toLowerCase()));
}

interface GmailPayloadPart {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPayloadPart[] | null;
}

function decodeBody(data: string | null | undefined): string {
  if (!data) return "";
  try {
    return Buffer.from(String(data).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function htmlToText(html: string) {
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

function textFromPayload(payload: GmailPayloadPart | null | undefined): string {
  const plainParts: string[] = [];
  const htmlParts: string[] = [];
  const walk = (part: GmailPayloadPart | null | undefined) => {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) plainParts.push(decodeBody(part.body.data));
    if (part.mimeType === "text/html" && part.body?.data) htmlParts.push(htmlToText(decodeBody(part.body.data)));
    for (const child of part.parts || []) walk(child);
  };
  walk(payload);
  return (plainParts.length ? plainParts : htmlParts)
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function messageDate(message: { internalDate?: string | null } | null | undefined, fallback: Date) {
  return message?.internalDate ? new Date(Number(message.internalDate)) : fallback;
}

function isWithin(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}

function compactSnippet(value: string | null | undefined, max = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function GET(req: NextRequest) {
  try {
    if (!checkCronAuth(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get("projectId")?.trim() || "";
    const ym = req.nextUrl.searchParams.get("ym")?.trim() || "";
    const save = req.nextUrl.searchParams.get("save") !== "0";
    const maxThreads = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("maxThreads") || 20)));
    if (!projectId || !/^\d{6}$/.test(ym)) {
      return NextResponse.json({ ok: false, error: "projectId and ym=YYYYMM required" }, { status: 400 });
    }

  const supabase = getServiceClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("project_id, project_name, report_emails")
    .eq("project_id", projectId)
    .maybeSingle();
  if (projectError) return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ ok: false, error: `project not found: ${projectId}` }, { status: 404 });

  const reportEmails = splitEmails(project.report_emails);
  if (!reportEmails.length) {
    return NextResponse.json({ ok: true, project, ym, threads: [], savedCount: 0, note: "report_emails empty" });
  }

  const googleAuth = await getGoogleAuthAsync();
  if (!googleAuth) {
    return NextResponse.json({ ok: false, error: "GOOGLE_OAUTH_* env is missing" }, { status: 500 });
  }

  const gmail = google.gmail({ version: "v1", auth: googleAuth });
  const query = buildQuery(reportEmails, ym);
  const listed = await gmail.users.threads.list({ userId: "me", q: query, maxResults: maxThreads });
  const threadRefs = listed.data.threads || [];
  const threads = [];
  const messageRows = [];
  const { start, end } = ymBounds(ym);

  for (const ref of threadRefs) {
    if (!ref.id) continue;
    const detail = await gmail.users.threads.get({ userId: "me", id: ref.id, format: "full" });
    const messages = detail.data.messages || [];
    const targetMonthMessages = messages.filter((m) => isWithin(messageDate(m, start), start, end));
    const matchedMessages = targetMonthMessages.filter((m) => !shouldSkipMessage(m.payload?.headers || []));
    const scopedMessages = matchedMessages.length ? matchedMessages : targetMonthMessages;
    const first = scopedMessages[0];
    const last = scopedMessages[scopedMessages.length - 1] || first;
    const firstHeaders = first?.payload?.headers || [];
    const lastHeaders = last?.payload?.headers || [];
    const lastDate = messageDate(last, start);
    const preview = scopedMessages
      .map((m) => compactSnippet(m.snippet || textFromPayload(m.payload), 280))
      .filter(Boolean)
      .join("\n---\n")
      .slice(0, 4000);

    const thread = {
      thread_id: ref.id,
      subject: headerValue(firstHeaders, "Subject") || "(no subject)",
      message_count: messages.length,
      matched_message_count: matchedMessages.length,
      target_month_message_count: targetMonthMessages.length,
      first_message_jst: first?.internalDate ? new Date(Number(first.internalDate)).toISOString() : null,
      last_message_jst: lastDate.toISOString(),
      from: headerValue(firstHeaders, "From"),
      to: headerValue(firstHeaders, "To"),
      cc: headerValue(firstHeaders, "Cc") || headerValue(lastHeaders, "Cc"),
      preview,
    };

    threads.push(thread);

    for (const message of matchedMessages) {
      if (!message.id) continue;
      const headers = message.payload?.headers || [];
      const date = messageDate(message, start);
      const subject = headerValue(headers, "Subject") || thread.subject;
      const bodyText = textFromPayload(message.payload) || message.snippet || "";
      const snippet = compactSnippet(message.snippet || bodyText, 500);
      const content = [
        `件名: ${subject}`,
        `日時: ${date.toISOString()}`,
        headerValue(headers, "From") ? `From: ${headerValue(headers, "From")}` : "",
        headerValue(headers, "To") ? `To: ${headerValue(headers, "To")}` : "",
        headerValue(headers, "Cc") ? `Cc: ${headerValue(headers, "Cc")}` : "",
        `Snippet: ${snippet}`,
        "",
        "本文全文はOSへ保存しない。必要な正本情報はL2抽出結果へ保存する。",
      ].filter(Boolean).join("\n");
      messageRows.push({
        cache_id: `gmail-api-${projectId}-${ref.id}-${message.id}`,
        project_id: projectId,
        ym,
        source: "gmail_message",
        item_id: `${ref.id}:${message.id}`,
        title: subject,
        item_date: date.toISOString(),
        content_text: content,
        char_count: content.length,
        metadata_json: {
          thread_id: ref.id,
          message_id: message.id,
          history_id: message.historyId || null,
          labels: message.labelIds || [],
          snippet,
          body_sha256: bodyText ? createHash("sha256").update(bodyText).digest("hex") : "",
          subject,
          from: headerValue(headers, "From"),
          to: headerValue(headers, "To"),
          cc: headerValue(headers, "Cc"),
          date: headerValue(headers, "Date"),
        },
        collected_at: new Date().toISOString(),
      });
    }
  }

  const threadRows = threads.map((thread) => {
    const content = [
      `件名: ${thread.subject}`,
      thread.first_message_jst ? `最初: ${thread.first_message_jst}` : "",
      thread.last_message_jst ? `最後: ${thread.last_message_jst}` : "",
      `対象月メッセージ数: ${thread.matched_message_count}`,
      `スレッド総メッセージ数: ${thread.message_count}`,
      thread.from ? `From: ${thread.from}` : "",
      thread.to ? `To: ${thread.to}` : "",
      thread.cc ? `Cc: ${thread.cc}` : "",
      "",
      thread.preview,
    ].filter(Boolean).join("\n");
    return {
      cache_id: `gmail-api-${projectId}-${thread.thread_id}`,
      project_id: projectId,
      ym,
      source: "gmail",
      item_id: thread.thread_id,
      title: thread.subject,
      item_date: thread.last_message_jst || `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01T00:00:00.000Z`,
      content_text: content,
      char_count: content.length,
      metadata_json: thread,
      collected_at: new Date().toISOString(),
    };
  });

  const rows = [...threadRows, ...messageRows];

  let savedCount = 0;
  if (save && rows.length) {
    const { error } = await supabase
      .from("source_cache")
      .upsert(rows, { onConflict: "project_id,source,item_id" });
    if (error) return NextResponse.json({ ok: false, error: error.message, query, threadCount: threads.length }, { status: 500 });
    savedCount = rows.length;

    const latestThread = threads
      .slice()
      .sort((a, b) => String(b.last_message_jst || "").localeCompare(String(a.last_message_jst || "")))[0];
    const notificationSummary = [
      `${project.project_name || projectId} ${ym} のGmailをOSへ取り込み済み。`,
      `スレッド ${threadRows.length}件 / 対象月メール ${messageRows.length}件を source_cache に保存した。`,
      latestThread?.last_message_jst ? `最新メール: ${latestThread.last_message_jst}` : "",
      messageRows.length ? "通知を開くとメール単位の根拠を確認できる。" : "",
    ].filter(Boolean).join(" ");
    await supabase
      .from("l2_notifications")
      .upsert(
        {
          l2_kind: "raw_data_ingested",
          target_id: projectId,
          scope_key: `${ym}:gmail:source-cache`,
          title: `📥 ${project.project_name || projectId}: Gmail生データ取り込み (${messageRows.length}件)`,
          summary: notificationSummary.slice(0, 500),
          saved_count: rows.length,
          total_count: rows.length,
          importance: messageRows.length ? 2 : 1,
        },
        { onConflict: "l2_kind,target_id,scope_key" }
      );
  }

    return NextResponse.json({
      ok: true,
      project: { project_id: project.project_id, project_name: project.project_name },
      ym,
      query,
      threadCount: threads.length,
      messageCount: messageRows.length,
      savedThreadCount: save ? threadRows.length : 0,
      savedMessageCount: save ? messageRows.length : 0,
      savedCount,
      threads,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sources/gmail/collect]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
