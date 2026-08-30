/**
 * POST /api/meeting-assets/adopt-drive-folder
 *
 * すでに Drive の `PJフォルダ / YYMMDD_…` に置かれている会議資料を、
 * アップロードし直さずに `meeting_assets` へ取り込む (adopt) route。
 *
 * 既存の `POST /api/meeting-assets` は「ブラウザから選んだファイルを Drive へ上げて行を作る」だけなので、
 * 人が直接 Drive へ入れた資料 / 先方から届いた取締役会資料は永久に OS へ出てこなかった。
 * L2H-1 (`amd-os-l6-meeting-flow`) は Phase B-4 で同じフォルダを list しているので、
 * 開催済みMTGを保存したあとにこの route を呼べば、cron 内 self-healing として資料が揃う。
 *
 * 認証は `POST /api/meeting-prep/calendar-sync` と同じ形 (workflow secret または admin session)。
 * 追加専用で、既存行の上書き・削除はしない。
 */

import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const DRIVE_BACKED_BUCKET = "google-drive";
const MAX_FILES = 100;
/** `_prep/` は W-Prep worker の下書き置き場なので、本カードの添付にはしない (spec 3-3) */
const PREP_FOLDER_SUFFIX = "_prep";

type AdoptCandidate = {
  driveFileId: string;
  fileName: string;
  mediaType: string;
  fileSizeBytes: number;
  webViewLink: string | null;
};

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function driveQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** `2026-07-29` -> `260729`。Drive のMTGフォルダ名の先頭に付く日付 token。 */
function yyMMdd(meetingDate: string): string {
  const m = meetingDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1].slice(2)}${m[2]}${m[3]}` : "";
}

async function authorize(req: NextRequest): Promise<{ ok: true; createdBy: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const workflowSecret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (workflowSecret && auth === `Bearer ${workflowSecret}`) return { ok: true, createdBy: "workflow" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  }
  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, createdBy: member.code_name || user.email };
}

/**
 * PJフォルダ直下から、会議日の `YYMMDD` で始まるフォルダを探す。
 * 会議タイトルとフォルダ名は一致しないことのほうが多い (例: title=`CLG 取締役会` / folder=`260729_取締役会`)
 * ので、日付 token だけで引き当てて `_prep` を落とす。
 */
async function findMeetingFolders(projectDriveFolderId: string, datePrefix: string) {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("Google Drive credential が未設定だよ");
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    q: `'${driveQueryLiteral(projectDriveFolderId)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name,webViewLink)",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (res.data.files ?? [])
    .filter((f) => typeof f.name === "string" && f.name.startsWith(datePrefix))
    .filter((f) => !String(f.name).endsWith(PREP_FOLDER_SUFFIX))
    .map((f) => ({ id: String(f.id), name: String(f.name), webViewLink: f.webViewLink ?? null }));
}

async function listFolderFiles(folderId: string): Promise<AdoptCandidate[]> {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("Google Drive credential が未設定だよ");
  const drive = google.drive({ version: "v3", auth });

  const out: AdoptCandidate[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${driveQueryLiteral(folderId)}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields: "nextPageToken, files(id,name,mimeType,size,webViewLink)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name) continue;
      out.push({
        driveFileId: f.id,
        fileName: f.name,
        mediaType: f.mimeType || "application/octet-stream",
        fileSizeBytes: Number(f.size || 0) || 0,
        webViewLink: f.webViewLink ?? null,
      });
      if (out.length >= MAX_FILES) return out;
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const meetingId = text(body.meeting_id, 300);
  const explicitFolderId = text(body.drive_folder_id, 220);
  // 既定は dry-run。`dry_run: false` を明示したときだけ実際に行を作る。
  const dryRun = body.dry_run !== false;

  if (!meetingId) {
    return NextResponse.json({ ok: false, error: "meeting_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: meeting, error: meetingError } = await admin
    .from("project_meeting_summaries")
    .select("meeting_id,project_id,meeting_date,title")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (meetingError) {
    return NextResponse.json({ ok: false, error: meetingError.message }, { status: 500 });
  }
  if (!meeting) {
    return NextResponse.json({ ok: false, error: "meeting not found" }, { status: 404 });
  }

  const projectId = String(meeting.project_id);
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("project_id,drive_folder_id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
  }
  const projectDriveFolderId = text(project?.drive_folder_id, 220);
  if (!projectDriveFolderId) {
    return NextResponse.json({ ok: false, error: "このPJに Drive folder id が未設定だよ" }, { status: 400 });
  }

  const datePrefix = yyMMdd(String(meeting.meeting_date || ""));
  if (!datePrefix && !explicitFolderId) {
    return NextResponse.json({ ok: false, error: "会議日が未確定なのでDriveフォルダを特定できないよ" }, { status: 400 });
  }

  let folders: Array<{ id: string; name: string; webViewLink: string | null }>;
  try {
    if (explicitFolderId) {
      const auth = await getGoogleAuthAsync();
      if (!auth) throw new Error("Google Drive credential が未設定だよ");
      const drive = google.drive({ version: "v3", auth });
      const got = await drive.files.get({
        fileId: explicitFolderId,
        fields: "id,name,webViewLink,mimeType",
        supportsAllDrives: true,
      });
      if (got.data.mimeType !== "application/vnd.google-apps.folder") {
        return NextResponse.json({ ok: false, error: "drive_folder_id がフォルダじゃないよ" }, { status: 400 });
      }
      folders = [{ id: String(got.data.id), name: String(got.data.name || ""), webViewLink: got.data.webViewLink ?? null }];
    } else {
      folders = await findMeetingFolders(projectDriveFolderId, datePrefix);
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "drive folder lookup failed" },
      { status: 502 }
    );
  }

  if (folders.length === 0) {
    return NextResponse.json({
      ok: true,
      meetingId,
      projectId,
      dryRun,
      driveFolders: [],
      adopted: [],
      skipped: [],
      note: `PJフォルダ配下に ${datePrefix} で始まるMTGフォルダが無かった`,
    });
  }

  // storage_path は table 全体で UNIQUE、値は drive_file_id の mirror。
  // 同じファイルを別MTGへ二重登録しないよう、まず既存を全部引く。
  const candidatesByFolder: Array<{ folder: typeof folders[number]; files: AdoptCandidate[] }> = [];
  try {
    for (const folder of folders) {
      candidatesByFolder.push({ folder, files: await listFolderFiles(folder.id) });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "drive list failed" },
      { status: 502 }
    );
  }

  const allDriveFileIds = candidatesByFolder.flatMap((entry) => entry.files.map((f) => f.driveFileId));
  const { data: existingRows } = allDriveFileIds.length
    ? await admin.from("meeting_assets").select("drive_file_id,meeting_id").in("drive_file_id", allDriveFileIds)
    : { data: [] as Array<{ drive_file_id: string | null; meeting_id: string }> };
  const existing = new Map((existingRows ?? []).map((r) => [String(r.drive_file_id), r.meeting_id]));

  const { data: lastAsset } = await admin
    .from("meeting_assets")
    .select("sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let sortOrder = typeof lastAsset?.sort_order === "number" ? lastAsset.sort_order + 10 : 10;

  const rows: Array<Record<string, unknown>> = [];
  const skipped: Array<{ fileName: string; reason: string }> = [];

  for (const { folder, files } of candidatesByFolder) {
    for (const file of files) {
      const owner = existing.get(file.driveFileId);
      if (owner) {
        skipped.push({ fileName: file.fileName, reason: owner === meetingId ? "already_adopted" : `owned_by:${owner}` });
        continue;
      }
      rows.push({
        meeting_id: meetingId,
        project_id: projectId,
        storage_bucket: DRIVE_BACKED_BUCKET,
        storage_path: file.driveFileId,
        drive_file_id: file.driveFileId,
        project_drive_folder_id: projectDriveFolderId,
        drive_folder_id: folder.id,
        drive_folder_name: folder.name,
        drive_folder_web_view_link: folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`,
        web_view_link: file.webViewLink,
        folder_display_path: `PJフォルダ / ${folder.name}`,
        file_name: file.fileName,
        media_type: file.mediaType,
        file_size_bytes: file.fileSizeBytes,
        asset_kind: "upload",
        source_url: file.webViewLink,
        sort_order: sortOrder,
        created_by: authz.createdBy,
      });
      sortOrder += 10;
    }
  }

  if (!dryRun && rows.length > 0) {
    const { error: insertError } = await admin.from("meeting_assets").insert(rows);
    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    meetingId,
    projectId,
    dryRun,
    driveFolders: folders.map((f) => ({ id: f.id, name: f.name })),
    adopted: rows.map((r) => ({
      fileName: r.file_name,
      driveFileId: r.drive_file_id,
      mediaType: r.media_type,
      sortOrder: r.sort_order,
    })),
    skipped,
  });
}
