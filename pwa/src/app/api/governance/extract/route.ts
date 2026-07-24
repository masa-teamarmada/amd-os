import { createHash } from "crypto";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Gmail/Drive/Calendar 等から抽出した「総会・取締役会・書面決議」候補の入口。
// 既定は review 候補として l2_coverage_gaps に積む。apply=true のときだけ
// project_shareholder_meetings に canonical insert する。

type Resolution = { title?: string | null; type?: string | null; result?: string | null };
type Attachment = {
  name?: string | null;
  url?: string | null;
  webViewLink?: string | null;
  web_view_link?: string | null;
  kind?: string | null;
  mime_type?: string | null;
  mimeType?: string | null;
  size_bytes?: number | string | null;
  source_ref?: string | null;
  content_base64?: string | null;
  base64?: string | null;
  data_url?: string | null;
};

type GovernanceMeetingCandidate = {
  project_id?: string | null;
  meeting_type?: string | null;
  meeting_name?: string | null;
  folder_name?: string | null;
  meeting_date?: string | null;
  location?: string | null;
  agenda_summary?: string | null;
  resolutions_json?: unknown;
  resolutions?: Resolution[] | null;
  amd_response?: string | null;
  amd_response_at?: string | null;
  related_action_id?: string | null;
  attachments_json?: unknown;
  attachments?: Attachment[] | null;
  source?: string | null;
  source_ref?: string | null;
  source_hash?: string | null;
  notes?: string | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const DRIVE_STORAGE = "google-drive";

async function authorize(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { data: member } = await supabase.from("members").select("is_admin").eq("email", user.email.toLowerCase()).maybeSingle();
  return !!member?.is_admin;
}

function text(value: unknown, max = 1000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function requiredText(value: unknown, max = 1000) {
  return text(value, max) || "";
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function meetingYm(date: string | null) {
  return date && /^\d{4}-\d{2}/.test(date) ? date.replace(/-/g, "").slice(0, 6) : null;
}

function stableHash(item: GovernanceMeetingCandidate) {
  const provided = String(item.source_hash || "").trim();
  if (provided) return provided;
  const payload = JSON.stringify({
    project_id: item.project_id ?? null,
    meeting_type: item.meeting_type ?? null,
    meeting_date: item.meeting_date ?? null,
    source_ref: item.source_ref ?? null,
    agenda_summary: item.agenda_summary ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function normalizeMeetingType(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "board";
  if (["agm", "annual", "annual_general_meeting", "定時株主総会"].includes(raw)) return "agm";
  if (["egm", "extraordinary", "extraordinary_general_meeting", "臨時株主総会"].includes(raw)) return "egm";
  if (["board", "board_meeting", "取締役会"].includes(raw)) return "board";
  if (["board_written", "board_written_resolution", "取締役書面決議", "取締役会書面決議"].includes(raw)) return "board_written_resolution";
  if (["shareholder_written", "shareholder_written_resolution", "株主総会書面決議", "株主書面決議"].includes(raw)) return "shareholder_written_resolution";
  return raw.slice(0, 80);
}

function asJsonArray(value: unknown, fallback: unknown) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(fallback)) return fallback;
  return [];
}

function driveQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function safeDriveNamePart(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#%{}~[\]^`]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/_+/g, "_")
    .trim()
    .replace(/[. ]+$/g, "");
  return normalized.slice(0, 120) || "会議";
}

function yyMMdd(value: string | null) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

function meetingTypeLabel(value: string | null | undefined) {
  const type = normalizeMeetingType(value);
  if (type === "agm") return "定時株主総会";
  if (type === "egm") return "臨時株主総会";
  if (type === "board_written_resolution") return "取締役会書面決議";
  if (type === "shareholder_written_resolution") return "株主総会書面決議";
  if (type === "board") return "取締役会";
  return type || "会議";
}

function governanceFolderName(item: GovernanceMeetingCandidate, row: ReturnType<typeof buildMeetingRow>) {
  const datePart = yyMMdd(row.meeting_date);
  if (!datePart) throw new Error("会議日が未確定なのでDrive保存先フォルダを作れないよ");
  const provided = requiredText(item.folder_name, 160);
  if (provided) {
    const safeProvided = safeDriveNamePart(provided);
    return safeProvided.startsWith(`${datePart}_`) ? safeProvided : `${datePart}_${safeProvided}`;
  }
  const meetingName = requiredText(item.meeting_name, 160) || meetingTypeLabel(row.meeting_type);
  return `${datePart}_${safeDriveNamePart(meetingName)}`;
}

function contentTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

function extractAttachmentBytes(attachment: Attachment) {
  const name = requiredText(attachment.name, 240) || "governance-attachment";
  let mimeType = requiredText(attachment.mime_type ?? attachment.mimeType, 160) || contentTypeFromName(name);
  const dataUrl = requiredText(attachment.data_url, MAX_ATTACHMENT_BYTES * 2);
  if (dataUrl) {
    const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]+)$/);
    if (!match) throw new Error(`${name}: data_url の形式が不正だよ`);
    if (match[1]) mimeType = match[1];
    const raw = match[3];
    const buffer = match[2]
      ? Buffer.from(raw.replace(/\s/g, ""), "base64")
      : Buffer.from(decodeURIComponent(raw), "utf8");
    if (buffer.length > MAX_ATTACHMENT_BYTES) throw new Error(`${name}: 50MB 以内にしてね`);
    return { buffer, mimeType };
  }

  const base64 = requiredText(attachment.content_base64 ?? attachment.base64, MAX_ATTACHMENT_BYTES * 2);
  if (!base64) return null;
  const buffer = Buffer.from(base64.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, ""), "base64");
  if (buffer.length > MAX_ATTACHMENT_BYTES) throw new Error(`${name}: 50MB 以内にしてね`);
  return { buffer, mimeType };
}

function sanitizeAttachment(attachment: unknown): Record<string, unknown> | null {
  if (!attachment || typeof attachment !== "object") return null;
  const a = attachment as Attachment & Record<string, unknown>;
  const name = requiredText(a.name, 240);
  const url = requiredText(a.url ?? a.webViewLink ?? a.web_view_link, 2000);
  const out: Record<string, unknown> = {};
  if (name) out.name = name;
  if (url) {
    out.url = url;
    out.webViewLink = url;
    out.web_view_link = url;
  }
  const kind = requiredText(a.kind, 80);
  if (kind) out.kind = kind;
  const mimeType = requiredText(a.mime_type ?? a.mimeType, 160);
  if (mimeType) out.mime_type = mimeType;
  const size = Number(a.size_bytes);
  if (Number.isFinite(size) && size >= 0) out.size_bytes = Math.round(size);
  const sourceRef = requiredText(a.source_ref, 400);
  if (sourceRef) out.source_ref = sourceRef;
  for (const key of ["drive_file_id", "project_drive_folder_id", "drive_folder_id", "drive_folder_name", "drive_folder_web_view_link", "folder_display_path", "storage"] as const) {
    const value = requiredText(a[key], 2000);
    if (value) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

function normalizeAttachments(value: unknown, fallback: unknown) {
  return asJsonArray(value, fallback)
    .map(sanitizeAttachment)
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  if (typeof error === "object" && error !== null) {
    const detail = error as {
      code?: number | string;
      response?: { status?: number; data?: { error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> } } };
    };
    const googleMessage = detail.response?.data?.error?.message;
    if (googleMessage) return googleMessage;
    const firstReason = detail.response?.data?.error?.errors?.find((item) => item.message || item.reason);
    if (firstReason?.message) return firstReason.message;
    if (firstReason?.reason) return firstReason.reason;
  }
  return message;
}

function googleDriveWriteError(error: unknown) {
  const message = errorMessage(error);
  const status = typeof error === "object" && error !== null
    ? (error as { code?: number | string; response?: { status?: number } }).response?.status ?? (error as { code?: number | string }).code
    : null;

  if (/File not found|not found|404/i.test(message) || status === 404) {
    return "Google Drive のPJフォルダが見つからないよ。projects.drive_folder_id が正しいか、そのGoogle credentialにフォルダが共有されているか確認が必要";
  }
  if (/insufficient authentication scopes|insufficientPermissions|insufficient/i.test(message)) {
    return "Google OAuth refresh token に Drive write scope が足りないよ。`https://www.googleapis.com/auth/drive` でrefresh tokenを再発行してVercel production envへ入れ直す必要がある";
  }
  if (/forbidden|permission|PERMISSION_DENIED|403/i.test(message) || status === 403) {
    return "Google Drive のPJフォルダへの書き込み権限が足りないよ。OAuthユーザーまたはService Accountを当該PJフォルダに編集者として共有してね";
  }
  if (/credential|auth|token/i.test(message)) return `Google Drive credential を確認してね: ${message}`;
  return message;
}

async function getProjectDriveFolder(admin: AdminClient, projectId: string) {
  const { data, error } = await admin
    .from("projects")
    .select("project_id,drive_folder_id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false as const, status: 404, error: "project not found" };
  const folderId = requiredText(data.drive_folder_id, 220);
  if (!folderId) return { ok: false as const, status: 400, error: "このPJに Drive folder id が未設定だよ" };
  return { ok: true as const, folderId };
}

async function ensureGovernanceFolder(projectDriveFolderId: string, folderName: string) {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("Google Drive credential が未設定だよ");

  const drive = google.drive({ version: "v3", auth });
  const escapedName = driveQueryLiteral(folderName);
  const escapedParent = driveQueryLiteral(projectDriveFolderId);
  const existing = await drive.files.list({
    q: `'${escapedParent}' in parents and name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name,webViewLink)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const folder = existing.data.files?.[0];
  if (folder?.id) return { id: folder.id, webViewLink: folder.webViewLink ?? null };

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [projectDriveFolderId],
    },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error("Driveガバナンス資料フォルダの作成に失敗したよ");
  return { id: created.data.id, webViewLink: created.data.webViewLink ?? null };
}

async function uploadDriveAttachment(params: {
  folderId: string;
  name: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("Google Drive credential が未設定だよ");

  const drive = google.drive({ version: "v3", auth });
  const escapedName = driveQueryLiteral(params.name || "governance-attachment");
  const escapedParent = driveQueryLiteral(params.folderId);
  const existing = await drive.files.list({
    q: `'${escapedParent}' in parents and name='${escapedName}' and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name,mimeType,size,webViewLink)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existingFile = existing.data.files?.[0];
  if (existingFile?.id && existingFile.webViewLink) return existingFile;

  const created = await drive.files.create({
    requestBody: {
      name: params.name || "governance-attachment",
      parents: [params.folderId],
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(params.buffer),
    },
    fields: "id,name,mimeType,size,webViewLink",
    supportsAllDrives: true,
  });
  if (!created.data.id || !created.data.webViewLink) {
    throw new Error(`${params.name}: Drive upload response が不完全だよ`);
  }
  return created.data;
}

async function prepareAttachments(params: {
  admin: AdminClient;
  item: GovernanceMeetingCandidate;
  row: ReturnType<typeof buildMeetingRow>;
  storeAttachments: boolean;
}) {
  const raw = asJsonArray(params.item.attachments_json, params.item.attachments) as Attachment[];
  if (!raw.length) return [];
  if (!params.storeAttachments) return normalizeAttachments(params.item.attachments_json, params.item.attachments);

  const hasUploadContent = raw.some((a) => Boolean(extractAttachmentBytes(a)));
  if (!hasUploadContent) return normalizeAttachments(params.item.attachments_json, params.item.attachments);

  if (!params.row.project_id) throw new Error("project_id が無いので添付資料をDrive保存できないよ");
  const projectFolder = await getProjectDriveFolder(params.admin, params.row.project_id);
  if (!projectFolder.ok) {
    const err = new Error(projectFolder.error) as Error & { code?: number };
    err.code = projectFolder.status;
    throw err;
  }

  const folderName = governanceFolderName(params.item, params.row);
  const folder = await ensureGovernanceFolder(projectFolder.folderId, folderName);
  const normalized: Record<string, unknown>[] = [];

  for (const attachment of raw) {
    const sanitized = sanitizeAttachment(attachment) ?? {};
    const content = extractAttachmentBytes(attachment);
    if (!content) {
      normalized.push(sanitized);
      continue;
    }

    const name = requiredText(attachment.name, 240) || "governance-attachment";
    const uploaded = await uploadDriveAttachment({
      folderId: folder.id,
      name,
      mimeType: content.mimeType,
      buffer: content.buffer,
    });
    const link = String(uploaded.webViewLink);
    normalized.push({
      ...sanitized,
      name: uploaded.name || name,
      url: link,
      webViewLink: link,
      web_view_link: link,
      kind: requiredText(attachment.kind, 80) || "governance_attachment",
      mime_type: uploaded.mimeType || content.mimeType,
      size_bytes: Number(uploaded.size || content.buffer.length) || content.buffer.length,
      source_ref: requiredText(attachment.source_ref, 400) || null,
      storage: DRIVE_STORAGE,
      drive_file_id: uploaded.id,
      project_drive_folder_id: projectFolder.folderId,
      drive_folder_id: folder.id,
      drive_folder_name: folderName,
      drive_folder_web_view_link: folder.webViewLink,
      folder_display_path: `PJフォルダ / ${folderName}`,
    });
  }

  return normalized;
}

function buildMeetingRow(item: GovernanceMeetingCandidate, sourceHash: string) {
  const meetingDate = text(item.meeting_date, 20);
  const source = text(item.source, 40) || "gmail";
  const sourceRef = text(item.source_ref, 300) || `hash:${sourceHash}`;
  const sourceNote = `source=${source}; source_hash=${sourceHash}`;
  const notes = [text(item.notes, 2000), sourceNote].filter(Boolean).join("\n");

  return {
    project_id: text(item.project_id, 40),
    meeting_type: normalizeMeetingType(item.meeting_type),
    meeting_date: meetingDate,
    meeting_ym: meetingYm(meetingDate),
    location: text(item.location, 200),
    agenda_summary: text(item.agenda_summary, 3000),
    resolutions_json: asJsonArray(item.resolutions_json, item.resolutions),
    amd_response: text(item.amd_response, 80),
    amd_response_at: text(item.amd_response_at, 80),
    related_action_id: text(item.related_action_id, 140),
    attachments_json: normalizeAttachments(item.attachments_json, item.attachments),
    source_ref: sourceRef,
    notes,
  };
}

async function findCanonicalId(db: ReturnType<typeof createAdminClient>, row: ReturnType<typeof buildMeetingRow>) {
  if (!row.project_id) return null;
  if (row.source_ref) {
    const { data, error } = await db
      .from("project_shareholder_meetings")
      .select("id")
      .eq("project_id", row.project_id)
      .eq("source_ref", row.source_ref)
      .limit(1);
    if (!error && data && data.length > 0) return String(data[0].id);
  }

  let q = db
    .from("project_shareholder_meetings")
    .select("id")
    .eq("project_id", row.project_id)
    .eq("meeting_type", row.meeting_type);
  q = row.meeting_date ? q.eq("meeting_date", row.meeting_date) : q.is("meeting_date", null);
  if (row.agenda_summary) q = q.eq("agenda_summary", row.agenda_summary);
  const { data } = await q.limit(1);
  return data?.[0]?.id ? String(data[0].id) : null;
}

function notificationFor(kind: "coverage_gap" | "shareholder_meeting", targetId: string, scopeKey: string, item: GovernanceMeetingCandidate) {
  const meetingType = normalizeMeetingType(item.meeting_type);
  const meetingTypeLabelStr = meetingTypeLabel(meetingType);
  const headline = text(item.meeting_name, 120) || text(item.agenda_summary, 120) || "総会・取締役会";
  const meetingDate = text(item.meeting_date, 20);
  const agenda = text(item.agenda_summary, 240) || "記載なし";
  const resolutions = asJsonArray(item.resolutions_json, item.resolutions);
  const attachments = asJsonArray(item.attachments_json, item.attachments);
  const attachmentNames = attachments
    .map((attachment) => text(objectValue(attachment).name, 120))
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
  const changes = [
    `会議種別: ${meetingTypeLabelStr}`,
    `開催日: ${meetingDate || "未確認"}`,
    `議題: ${agenda}`,
    `決議: ${resolutions.length > 0 ? `${resolutions.length}件` : "記載なし"}`,
    `添付: ${attachmentNames.length > 0 ? attachmentNames.join("、") : "記載なし"}`,
  ];
  const summaryParts = [
    meetingTypeLabelStr,
    meetingDate ? `日付 ${meetingDate}` : null,
  ].filter(Boolean);
  const summary = summaryParts.length ? summaryParts.join(" / ") : `${meetingTypeLabelStr}の開催履歴を確認する`;
  const actionContract = {
    version: 1,
    destination_label: "会社概要 → 総会・取締役会",
    destination_href: `/project/${targetId}/cockpit?tab=company`,
    changes,
    approval_label: "この開催履歴を追加する",
    rejection_label: "追加しない",
    approval_effect: "会社概要の「総会・取締役会」に開催履歴を1件追加する。メール送信、資料アップロード、元メールや元資料の編集はしない。",
    rejection_effect: "この候補を見送る。会社概要の開催履歴は追加しない。",
  };
  return {
    l2_kind: kind,
    target_id: targetId,
    scope_key: scopeKey,
    title: kind === "coverage_gap" ? `開催履歴を追加する？: ${headline}` : `開催履歴を追加: ${headline}`,
    summary,
    // candidate は正本へ未保存。採用後に project_shareholder_meetings の1行になる。
    saved_count: kind === "coverage_gap" ? 0 : 1,
    total_count: 1,
    importance: /written|書面|board/.test(meetingType) ? 8 : 6,
    notified_at: new Date().toISOString(),
    metadata_json: {
      proposed_target_l2: "shareholder_meeting",
      meeting_type: meetingType,
      meeting_date: item.meeting_date ?? null,
      meeting_name: text(item.meeting_name, 180),
      agenda_summary: agenda,
      resolution_count: resolutions.length,
      attachment_names: attachmentNames,
      action_contract: actionContract,
    },
  };
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items: GovernanceMeetingCandidate[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ ok: false, error: "items[] required" }, { status: 400 });

  const apply = body?.apply === true || body?.mode === "apply";
  const dryRun = body?.dry_run === true || body?.dryRun === true;
  const storeAttachments = body?.store_attachments === true || body?.storeAttachments === true || apply;
  const updateExisting = body?.update_existing === true || body?.updateExisting === true;
  const db = createAdminClient();
  const nowIso = new Date().toISOString();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let notified = 0;
  const previews: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];

  for (const item of items) {
    const projectId = text(item.project_id, 40);
    const agenda = text(item.agenda_summary, 3000);
    if (!projectId || !agenda) {
      skipped++;
      continue;
    }

    const sourceHash = stableHash(item);
    const row = buildMeetingRow(item, sourceHash);
    if (dryRun) {
      previews.push({
        ...row,
        attachment_storage: storeAttachments ? "would_upload_drive_links" : "metadata_only",
      });
      continue;
    }

    if (apply) {
      const existingId = await findCanonicalId(db, row);
      if (existingId) {
        if (updateExisting && storeAttachments) {
          try {
            row.attachments_json = await prepareAttachments({ admin: db, item, row, storeAttachments });
          } catch (error) {
            return NextResponse.json({ ok: false, error: googleDriveWriteError(error) }, { status: 502 });
          }
          const { error } = await db
            .from("project_shareholder_meetings")
            .update({
              attachments_json: row.attachments_json,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingId);
          if (error) {
            skipped++;
            continue;
          }
          updated++;
          previews.push({ ...row, id: existingId, updated_existing: true });
          continue;
        }
        skipped++;
        continue;
      }
      try {
        row.attachments_json = await prepareAttachments({ admin: db, item, row, storeAttachments });
      } catch (error) {
        return NextResponse.json({ ok: false, error: googleDriveWriteError(error) }, { status: 502 });
      }
      previews.push(row);
      const { data, error } = await db.from("project_shareholder_meetings").insert(row).select("id").single();
      if (error) {
        skipped++;
        continue;
      }
      inserted++;
      notifications.push(notificationFor("shareholder_meeting", projectId, data.id as string, item));
      continue;
    }

    const gapId = `cg:${sourceHash}`.slice(0, 120);
    const { data: existing } = await db.from("l2_coverage_gaps").select("gap_id").eq("source_hash", sourceHash).limit(1);
    if (existing?.length) {
      skipped++;
      continue;
    }

    try {
      row.attachments_json = await prepareAttachments({ admin: db, item, row, storeAttachments });
    } catch (error) {
      return NextResponse.json({ ok: false, error: googleDriveWriteError(error) }, { status: 502 });
    }
    previews.push(row);
    // title = 件名 (= meeting_name)、summary = 議案要約の先頭 (= agenda_summary)、
    // 運用 notes (= matched_via 等の audit 文字列) は matched_patterns に逃がす。
    // 旧実装は title に agenda 全文ダンプ、summary に notes を入れていて UI がカオスになっていた (2026-06-22 まさ指摘)。
    const coverageTitle = (text(item.meeting_name, 200) || text(item.agenda_summary, 200) || "総会・取締役会候補").slice(0, 200);
    const coverageSummary = text(item.agenda_summary, 600) || text(item.notes, 200) || null;
    const { error } = await db.from("l2_coverage_gaps").insert({
      gap_id: gapId,
      source: text(item.source, 40) || "gmail",
      source_ref: row.source_ref,
      source_hash: sourceHash,
      title: coverageTitle,
      summary: coverageSummary,
      salience_score: 0.9,
      matched_patterns: {
        kind: "governance_meeting",
        meeting_type: row.meeting_type,
        written_resolution: /written|書面/.test(`${row.meeting_type}\n${row.location}`),
        audit_notes: text(item.notes, 1500),
      },
      proposed_target_l2: "shareholder_meeting",
      gap_class: "extractor_miss",
      project_id: projectId,
      scope: "project",
      due_at: null,
      evidence_refs_json: { governance_meeting: row },
      review_status: "candidate",
      created_by: "governance_extract",
      detected_at: nowIso,
    });
    if (error) {
      skipped++;
      continue;
    }
    inserted++;
    notifications.push(notificationFor("coverage_gap", projectId, gapId, item));
  }

  if (!dryRun && notifications.length > 0) {
    const { error } = await db.from("l2_notifications").insert(notifications);
    if (!error) notified = notifications.length;
  }

  return NextResponse.json({ ok: true, mode: apply ? "apply" : "candidate", dryRun, inserted, updated, skipped, notified, previews });
}
