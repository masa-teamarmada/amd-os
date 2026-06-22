import { createHash } from "crypto";
import { google, type gmail_v1 } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type ProjectRow = {
  project_id: string;
  project_name: string | null;
  client_name: string | null;
  report_emails: string | null;
  news_search_query: string | null;
  governance_watch_shareholder_meetings: boolean | null;
  governance_watch_board_meetings: boolean | null;
};

type GovernanceCandidate = {
  project_id: string;
  meeting_type: string;
  meeting_name: string;
  meeting_date: string | null;
  agenda_summary: string;
  attachments?: Array<Record<string, unknown>>;
  source: "gmail";
  source_ref: string;
  source_hash: string;
  notes: string;
};

const SHAREHOLDER_KEYWORDS = [
  "株主総会",
  "定時株主総会",
  "臨時株主総会",
  "招集通知",
  "議決権",
  "委任状",
  "株主書面決議",
  "みなし決議",
  "事前承諾",
];

const BOARD_KEYWORDS = [
  "取締役会",
  "役会",
  "取締役書面決議",
  "取締役会書面決議",
  "書面決議",
  "提案書兼同意書",
];

// ガバナンス系 SaaS / 公的機関の送信元 allowlist。
// PJ の report_emails に当該 alias が無くてもこの送信元 + governance keyword で拾える。
// 起点: BWE p11 (2026-06-22) みなし第1回定時株主総会 同意書の取りこぼし対応。
// 設計: pwa/design/governance_action_items.md §3.1 (allowlist は DB 化予定、現状は hardcode)。
const VENDOR_SENDERS = [
  "smartround.com",
  "everidays.com",
  "cloudsign.jp",
  "docusign.net",
  "docusign.com",
  "freee.co.jp",
  "shareholder.jp",
  "kabushiki-meibo.jp",
  "stockmate.jp",
];

async function authorize(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  return !!member?.is_admin;
}

function splitEmails(value: string | null | undefined) {
  return String(value || "")
    .split(/[,\s;]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function searchTerm(emailOrDomain: string) {
  const raw = emailOrDomain.trim();
  if (raw.startsWith("@")) return raw.slice(1);
  return raw;
}

function compact(value: string | null | undefined, max = 700) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeBody(data: string | null | undefined) {
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

function textFromPayload(payload: gmail_v1.Schema$MessagePart | undefined | null) {
  const plainParts: string[] = [];
  const htmlParts: string[] = [];
  const walk = (part: gmail_v1.Schema$MessagePart | undefined | null) => {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) plainParts.push(decodeBody(part.body.data));
    if (part.mimeType === "text/html" && part.body?.data) htmlParts.push(htmlToText(decodeBody(part.body.data)));
    for (const child of part.parts || []) walk(child);
  };
  walk(payload);
  return (plainParts.length ? plainParts : htmlParts).filter(Boolean).join("\n\n").trim();
}

function messageDate(message: gmail_v1.Schema$Message | undefined | null, fallback: Date) {
  return message?.internalDate ? new Date(Number(message.internalDate)) : fallback;
}

function ymFromDate(date: Date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatGmailDate(date: Date) {
  return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
}

function activeKeywords(project: ProjectRow) {
  return [
    ...(project.governance_watch_shareholder_meetings ? SHAREHOLDER_KEYWORDS : []),
    ...(project.governance_watch_board_meetings ? BOARD_KEYWORDS : []),
  ];
}

// query 構造: AND じゃなくて OR の対象を 2 つ持つ。
//   (report_emails の from/to/cc) AND (keywords)   ← PJ 関係者間の連絡
//   OR
//   (vendor_senders の from)       AND (keywords)  ← smartround 等 SaaS からの招集通知
// 旧構造 (report_emails AND keywords) だと smartround→個人 alias のメールが
// 永遠に取れず、BWE/JOYCLE 取りこぼし事故の根本原因になっていた。
function buildQuery(project: ProjectRow, daysBack: number, daysForward: number) {
  const reportEmails = splitEmails(project.report_emails);
  const reportClauses = reportEmails.map((email) => {
    const term = searchTerm(email);
    return `(from:${term} OR to:${term} OR cc:${term})`;
  });
  const vendorClauses = VENDOR_SENDERS.map((domain) => `from:${domain}`);
  const keywords = Array.from(new Set(activeKeywords(project)));
  const keywordExpr = keywords.length ? `(${keywords.map((k) => `"${k}"`).join(" OR ")})` : "";
  const start = new Date(Date.now() - daysBack * 86400000);
  const end = new Date(Date.now() + daysForward * 86400000);

  const reportBranch = reportClauses.length && keywordExpr
    ? `((${reportClauses.join(" OR ")}) ${keywordExpr})`
    : "";
  const vendorBranch = vendorClauses.length && keywordExpr
    ? `((${vendorClauses.join(" OR ")}) ${keywordExpr})`
    : "";
  const branches = [reportBranch, vendorBranch].filter(Boolean);
  const branchExpr = branches.length === 0
    ? ""
    : branches.length === 1
      ? branches[0]
      : `(${branches.join(" OR ")})`;

  return [
    `after:${formatGmailDate(start)}`,
    `before:${formatGmailDate(end)}`,
    branchExpr,
    "-in:chats",
  ].filter(Boolean).join(" ");
}

// メッセージがどの経路で網に上がったかの audit 用 (notes / source_cache に残す)。
// report_emails マッチ: PJ 関係者間の連絡。vendor: SaaS 通知メール。
function classifyMatchSource(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  reportEmails: string[],
): "report_emails" | "vendor_sender" | "unknown" {
  const from = headerValue(headers, "From").toLowerCase();
  const to = headerValue(headers, "To").toLowerCase();
  const cc = headerValue(headers, "Cc").toLowerCase();
  for (const email of reportEmails) {
    const term = searchTerm(email).toLowerCase();
    if (term && (from.includes(term) || to.includes(term) || cc.includes(term))) return "report_emails";
  }
  for (const domain of VENDOR_SENDERS) {
    if (from.includes(domain.toLowerCase())) return "vendor_sender";
  }
  return "unknown";
}

// vendor_sender 経由で拾ったメールが、本当に当該 PJ のものか確認するための token プール。
// `project_name`、`client_name`、`news_search_query` の引用文字列 (= "Blue Water Energy" 等)、
// `report_emails` の domain ローカル部 (= "bluewaterenergy" 等) を抜き、
// 本文/件名にどれか 1 個でも含まれていれば「PJ 言及あり」と判定する。
//
// 起点: BWE p11 sweep に LiSTie 株主総会の委任状通知が混入した事故 (2026-06-22)。
// smartround は同一個人 alias の他社株主総会通知も流すので、vendor 経路は PJ 言及で
// 二重判定しないと取り違える。
//
// 3 文字以下の短い alias (= 内部コード "BWE" / "SX" 等) は false positive が高いので除外する。
// 代わりに news_search_query の引用文字列を主シグナルにする (= 検索意図と一致する PJ 別名)。
function projectMentionTokens(project: ProjectRow): string[] {
  const tokens = new Set<string>();
  const push = (raw: string | null | undefined, minLen = 4) => {
    if (!raw) return;
    const value = raw.trim();
    if (value.length >= minLen) tokens.add(value.toLowerCase());
  };
  push(project.project_name);
  push(project.client_name);
  // news_search_query は `"Blue Water Energy" OR "ブルーウォーターエナジー"` 形式が多い。
  // ダブルクォート内の文字列を全部 token として抜く。引用無しなら全体を1 token として扱う。
  if (project.news_search_query) {
    const quoted = Array.from(project.news_search_query.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
    if (quoted.length) {
      for (const q of quoted) push(q);
    } else {
      push(project.news_search_query);
    }
  }
  for (const email of splitEmails(project.report_emails)) {
    const term = searchTerm(email);
    if (!term) continue;
    // alias@domain.tld or @domain.tld → domain の組織識別子 ("bluewaterenergy" 等)
    const atIdx = term.indexOf("@");
    const domain = atIdx >= 0 ? term.slice(atIdx + 1) : term;
    const orgLabel = domain.split(".")[0];
    if (orgLabel && orgLabel.length >= 4) tokens.add(orgLabel.toLowerCase());
  }
  return Array.from(tokens);
}

function bodyMentionsProject(text: string, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const lower = text.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

function matchedKeywords(text: string, keywords: string[]) {
  return keywords.filter((keyword) => text.includes(keyword));
}

function inferMeetingType(text: string, project: ProjectRow) {
  if (/取締役会書面決議|取締役書面決議/.test(text)) return "board_written_resolution";
  if (/株主(総会)?書面決議|みなし決議/.test(text)) return "shareholder_written_resolution";
  if (/取締役会|役会/.test(text)) return "board";
  if (/定時株主総会/.test(text)) return "agm";
  if (/臨時株主総会/.test(text)) return "egm";
  if (/株主総会|招集通知|議決権|委任状/.test(text)) return "agm";
  if (project.governance_watch_board_meetings && !project.governance_watch_shareholder_meetings) return "board";
  return "agm";
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractMeetingDate(text: string, reference: Date) {
  const ymd = text.match(/(20\d{2})[年./-]\s*(\d{1,2})[月./-]\s*(\d{1,2})日?/);
  if (ymd) return isoDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  const md = text.match(/(?:開催日時|開催日|日時|日程|総会日|決議日|提出日)?[^\n。]{0,16}?(\d{1,2})月\s*(\d{1,2})日/);
  if (!md) return null;
  let year = reference.getUTCFullYear();
  const month = Number(md[1]);
  const day = Number(md[2]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getTime() < reference.getTime() - 180 * 86400000) year += 1;
  return isoDate(year, month, day);
}

function collectAttachmentParts(payload: gmail_v1.Schema$MessagePart | undefined | null, out: gmail_v1.Schema$MessagePart[] = []) {
  if (!payload) return out;
  const filename = String(payload.filename || "").trim();
  if (filename && (payload.body?.attachmentId || payload.body?.data)) out.push(payload);
  for (const child of payload.parts || []) collectAttachmentParts(child, out);
  return out;
}

async function attachmentsForMessage(params: {
  gmail: gmail_v1.Gmail;
  message: gmail_v1.Schema$Message;
  includeContent: boolean;
  sourceRef: string;
  maxAttachments: number;
}) {
  if (!params.message.id) return [];
  const parts = collectAttachmentParts(params.message.payload).slice(0, params.maxAttachments);
  const attachments: Array<Record<string, unknown>> = [];
  for (const part of parts) {
    const name = String(part.filename || "").trim();
    if (!name) continue;
    const row: Record<string, unknown> = {
      name,
      kind: "gmail_attachment",
      mime_type: part.mimeType || "application/octet-stream",
      size_bytes: part.body?.size ?? null,
      source_ref: `${params.sourceRef}#message:${params.message.id}`,
    };
    if (params.includeContent) {
      if (part.body?.data) {
        row.content_base64 = part.body.data;
      } else if (part.body?.attachmentId) {
        const fetched = await params.gmail.users.messages.attachments.get({
          userId: "me",
          messageId: params.message.id,
          id: part.body.attachmentId,
        });
        if (fetched.data.data) row.content_base64 = fetched.data.data;
      }
    }
    attachments.push(row);
  }
  return attachments;
}

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1" || req.nextUrl.searchParams.get("dryRun") === "1";
  const apply = req.nextUrl.searchParams.get("apply") === "1" || req.nextUrl.searchParams.get("mode") === "apply";
  const storeAttachments = apply && req.nextUrl.searchParams.get("storeAttachments") !== "0";
  const updateExisting = req.nextUrl.searchParams.get("updateExisting") === "1";
  const saveSourceCache = req.nextUrl.searchParams.get("saveSourceCache") !== "0";
  const projectId = req.nextUrl.searchParams.get("projectId")?.trim() || "";
  const daysBack = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("daysBack") || 30)));
  const daysForward = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get("daysForward") || 2)));
  const maxProjects = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("maxProjects") || 20)));
  const maxThreadsPerProject = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get("maxThreadsPerProject") || 10)));
  const maxAttachmentsPerMessage = Math.min(20, Math.max(0, Number(req.nextUrl.searchParams.get("maxAttachmentsPerMessage") || 10)));

  const auth = await getGoogleAuthAsync();
  if (!auth) return NextResponse.json({ ok: false, error: "Google Gmail credential が未設定だよ" }, { status: 500 });

  const db = createAdminClient();
  let projectsQuery = db
    .from("projects")
    .select("project_id,project_name,client_name,report_emails,news_search_query,governance_watch_shareholder_meetings,governance_watch_board_meetings");

  if (projectId) {
    projectsQuery = projectsQuery.eq("project_id", projectId);
  } else {
    projectsQuery = projectsQuery.or("governance_watch_shareholder_meetings.eq.true,governance_watch_board_meetings.eq.true");
  }

  const { data: projectRows, error: projectError } = await projectsQuery.order("project_id").limit(maxProjects);
  if (projectError) return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });

  const gmail = google.gmail({ version: "v1", auth });
  const candidates: GovernanceCandidate[] = [];
  const sourceRows: Record<string, unknown>[] = [];
  const projectSummaries: Record<string, unknown>[] = [];

  for (const project of (projectRows ?? []) as ProjectRow[]) {
    const reportEmails = splitEmails(project.report_emails);
    const keywords = Array.from(new Set(activeKeywords(project)));
    // keywords が空 (= フラグ両方 OFF) なら skip。
    // report_emails が空でも vendor_senders で拾える可能性があるので skip しない
    // (= BWE/JOYCLE のように個人 alias 宛 smartround メールを拾うため)。
    if (!keywords.length) {
      projectSummaries.push({
        project_id: project.project_id,
        project_name: project.project_name,
        skipped: true,
        reason: "governance watch keywords empty",
      });
      continue;
    }

    const query = buildQuery(project, daysBack, daysForward);
    const listed = await gmail.users.threads.list({ userId: "me", q: query, maxResults: maxThreadsPerProject });
    const threadRefs = listed.data.threads || [];
    let matchedThreadCount = 0;

    for (const ref of threadRefs) {
      if (!ref.id) continue;
      const sourceRef = `gmail:thread:${ref.id}`;
      const detail = await gmail.users.threads.get({ userId: "me", id: ref.id, format: "full" });
      const messages = detail.data.messages || [];
      const first = messages[0];
      const last = messages[messages.length - 1] || first;
      const firstHeaders = first?.payload?.headers || [];
      const subject = headerValue(firstHeaders, "Subject") || "(no subject)";
      const messageTexts = messages.map((message) => textFromPayload(message.payload) || message.snippet || "");
      // combined は keyword 検索 / meeting_type / meeting_date 推定だけに使う (本文全部)。
      // candidate に出す agenda_summary は **件名 + 1 通目の snippet** だけにする
      // (= /notifications の通知カードに巨大ダンプを出さない、2026-06-22 まさ指摘対応)。
      const combined = compact([subject, ...messages.map((m) => m.snippet || ""), ...messageTexts].join("\n"), 12000);
      const hits = matchedKeywords(combined, keywords);
      if (!hits.length) continue;

      matchedThreadCount++;
      const lastDate = messageDate(last, new Date());
      const meetingType = inferMeetingType(combined, project);
      const meetingDate = extractMeetingDate(combined, lastDate);
      const firstSnippet = compact(first?.snippet || messageTexts[0] || "", 400);
      const summary = firstSnippet || compact(subject, 200);
      const sourceHash = stableHash(`${project.project_id}|${ref.id}|${subject}|${meetingType}`);
      const attachments = storeAttachments
        ? (await Promise.all(messages.map((message) => attachmentsForMessage({
            gmail,
            message,
            includeContent: true,
            sourceRef,
            maxAttachments: maxAttachmentsPerMessage,
          })))).flat()
        : messages.flatMap((message) => collectAttachmentParts(message.payload).slice(0, maxAttachmentsPerMessage).map((part) => ({
            name: String(part.filename || "").trim(),
            kind: "gmail_attachment",
            mime_type: part.mimeType || "application/octet-stream",
            size_bytes: part.body?.size ?? null,
            source_ref: `${sourceRef}#message:${message.id || ""}`,
          })).filter((a) => a.name));

      const matchedVia = classifyMatchSource(firstHeaders, reportEmails);
      // vendor_sender 経由は、本文/件名に当該 PJ への言及が無いと拾わない。
      // smartround 等は同一個人 alias の他社株主総会通知も流すため (BWE sweep に LiSTie 委任状が
      // 紛れ込む事故 2026-06-22 への対応)。report_emails マッチは PJ 関係者間連絡なので素通し。
      if (matchedVia === "vendor_sender") {
        const tokens = projectMentionTokens(project);
        if (!bodyMentionsProject(`${subject}\n${combined}`, tokens)) {
          projectSummaries.push({
            project_id: project.project_id,
            project_name: project.project_name,
            skipped_thread: ref.id,
            reason: "vendor_sender match without project mention",
            subject,
          });
          continue;
        }
      }
      candidates.push({
        project_id: project.project_id,
        meeting_type: meetingType,
        meeting_name: subject,
        meeting_date: meetingDate,
        agenda_summary: summary || subject,
        attachments,
        source: "gmail",
        source_ref: sourceRef,
        source_hash: sourceHash,
        notes: [
          "D-14G governance email sweep",
          `project=${project.project_id}`,
          `matched_via=${matchedVia}`,
          `matched_keywords=${hits.join(", ")}`,
          `query=${query}`,
        ].join("\n"),
      });

      const contentText = [
        `件名: ${subject}`,
        `最後: ${lastDate.toISOString()}`,
        headerValue(firstHeaders, "From") ? `From: ${headerValue(firstHeaders, "From")}` : "",
        headerValue(firstHeaders, "To") ? `To: ${headerValue(firstHeaders, "To")}` : "",
        headerValue(firstHeaders, "Cc") ? `Cc: ${headerValue(firstHeaders, "Cc")}` : "",
        `Matched: ${hits.join(", ")}`,
        `Matched via: ${matchedVia}`,
        "",
        compact(summary, 1000),
        "",
        "本文全文はOSへ保存しない。必要な正本情報はD-14G抽出結果へ保存する。",
      ].filter(Boolean).join("\n");

      sourceRows.push({
        cache_id: `gmail-governance-${project.project_id}-${ref.id}`,
        project_id: project.project_id,
        ym: ymFromDate(lastDate),
        source: "gmail_governance",
        item_id: ref.id,
        title: subject,
        item_date: lastDate.toISOString(),
        content_text: contentText,
        char_count: contentText.length,
        metadata_json: {
          query,
          thread_id: ref.id,
          source_ref: sourceRef,
          matched_keywords: hits,
          matched_via: matchedVia,
          meeting_type: meetingType,
          meeting_date: meetingDate,
          attachment_count: attachments.length,
        },
        collected_at: new Date().toISOString(),
      });
    }

    projectSummaries.push({
      project_id: project.project_id,
      project_name: project.project_name,
      query,
      listed_threads: threadRefs.length,
      matched_threads: matchedThreadCount,
    });
  }

  let savedSourceCount = 0;
  if (!dryRun && saveSourceCache && sourceRows.length) {
    const { error } = await db.from("source_cache").upsert(sourceRows, { onConflict: "project_id,source,item_id" });
    if (error) return NextResponse.json({ ok: false, error: `source_cache: ${error.message}` }, { status: 500 });
    savedSourceCount = sourceRows.length;
  }

  let extractResult: unknown = null;
  if (!dryRun && candidates.length) {
    const cronSecret = process.env.CRON_SECRET || "";
    if (!cronSecret) return NextResponse.json({ ok: false, error: "CRON_SECRET missing for governance/extract handoff" }, { status: 500 });
    const extractRes = await fetch(new URL("/api/governance/extract", req.nextUrl.origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        apply,
        store_attachments: storeAttachments,
        update_existing: updateExisting,
        items: candidates,
      }),
    });
    extractResult = await extractRes.json().catch(() => ({ ok: false, error: `extract status ${extractRes.status}` }));
    if (!extractRes.ok) return NextResponse.json({ ok: false, error: "governance/extract failed", extractResult }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    mode: apply ? "apply" : "candidate",
    dryRun,
    projects: projectSummaries,
    candidateCount: candidates.length,
    savedSourceCount,
    extractResult,
    candidates: dryRun ? candidates : candidates.map((candidate) => ({
      project_id: candidate.project_id,
      meeting_type: candidate.meeting_type,
      meeting_date: candidate.meeting_date,
      source_ref: candidate.source_ref,
      source_hash: candidate.source_hash,
      attachment_count: candidate.attachments?.length ?? 0,
      agenda_summary: compact(candidate.agenda_summary, 180),
    })),
  });
}
