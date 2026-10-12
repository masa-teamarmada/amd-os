import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  amieCardAccess,
  amieCardCanEdit,
} from "@/lib/project-card-designs-server";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";
export async function POST(request: Request) {
  if (!isSameOriginWorkspaceMutation(request))
    return NextResponse.json(
      { error: "この画面から操作してください" },
      { status: 403 },
    );
  const member = await amieCardAccess();
  const p = await request.json().catch(() => null);
  if (!member || !p?.project_id || !amieCardCanEdit(member, p.project_id))
    return NextResponse.json({ error: "更新権限がありません" }, { status: 403 });
  const { data: project } = await createAdminClient()
    .from("projects")
    .select("drive_folder_id")
    .eq("project_id", p.project_id)
    .maybeSingle();
  if (!project?.drive_folder_id)
    return NextResponse.json(
      { error: "PJのDriveルートを設定してください" },
      { status: 400 },
    );
  try {
    const auth = await getGoogleAuthAsync();
    if (!auth) throw new Error();
    const drive = google.drive({ version: "v3", auth });
    const root = project.drive_folder_id.replace(/'/g, "\\'");
    const { data } = await drive.files.list({
      q: `'${root}' in parents and name='0_名刺' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if ((data.files?.length || 0) > 1)
      return NextResponse.json(
        { error: "0_名刺が複数あるので保存先を整理してください" },
        { status: 409 },
      );
    const id =
      data.files?.[0]?.id ||
      (
        await drive.files.create({
          requestBody: {
            name: "0_名刺",
            mimeType: "application/vnd.google-apps.folder",
            parents: [project.drive_folder_id],
          },
          fields: "id",
          supportsAllDrives: true,
        })
      ).data.id;
    const again = await drive.files.list({
      q: `'${root}' in parents and name='0_名刺' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (again.data.files?.length !== 1 || again.data.files[0].id !== id)
      return NextResponse.json(
        { error: "保存先が重複したので整理してください" },
        { status: 409 },
      );
    return NextResponse.json({
      ok: true,
      url: `https://drive.google.com/drive/folders/${id}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Driveの保存先を準備に失敗しました" },
      { status: 503 },
    );
  }
}
