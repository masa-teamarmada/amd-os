import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { monthlyReportDriveFolderPath } from "@/lib/monthly-report-drive";
import { WORKSPACE_DOCUMENTS_BUCKET } from "@/lib/workspace-documents-core";
import { renderMonthlyReportPdf } from "@/lib/monthly-report-pdf-render";

export type MonthlyReportPdfInput = { projectId: string; ym: string; kind: "internal" | "external"; version?: "draft" | "final"; expectedContent: string };
export type MonthlyReportPdfResult = { ok: boolean; message: string; documentId?: string; driveFileId?: string };
const digest = (content: string | Buffer) => createHash("sha256").update(content).digest("hex");

/** Only existing administrator-authorized save routes call this. Sharing permissions are never changed. */
export async function saveMonthlyReportPdf(request: Request, input: MonthlyReportPdfInput): Promise<MonthlyReportPdfResult> {
  const db = createAdminClient();
  const external = input.kind === "external";
  const table = external ? "monthly_reports_external" : "monthly_reports";
  const month = external ? `${input.ym.slice(0, 4)}-${input.ym.slice(4)}` : input.ym;
  const column = external ? "body_md" : input.version === "draft" ? "draft_content" : "final_content";
  async function assertCurrent() {
    const { data, error } = await db.from(table).select(column).eq("project_id", input.projectId).eq("ym", month).single();
    if (error || (data as unknown as Record<string, string>)[column] !== input.expectedContent) throw new Error("本文が更新されました。最新の内容で保存してください。");
  }
  try {
    await assertCurrent();
    const auth = await getGoogleAuthAsync();
    if (!auth) throw new Error("共有ドライブの認証を確認してください。");
    const { data: project, error: projectError } = await db.from("projects").select("drive_folder_id,report_local_alias,project_name").eq("project_id", input.projectId).single();
    if (projectError || !project?.drive_folder_id) throw new Error("PJの共有ドライブ保存先を設定してください。");
    const origin = new URL(request.url).origin;
    const url = `${origin}/project/${encodeURIComponent(input.projectId)}/report/${input.ym}/print?template=${external ? "submission" : "internal"}${input.version === "draft" ? "&version=draft" : ""}`;
    const response = await fetch(url, { headers: { cookie: request.headers.get("cookie") || "", ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization")! } : {}) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("保存済み報告書の表示を取得できなかった");
    const pdf = await renderMonthlyReportPdf(await response.text(), process.env.MONTHLY_REPORT_CHROME_PATH);
    if (pdf.length > 20 * 1024 * 1024) throw new Error("PDFのサイズが大きすぎるため保存できなかった");
    await assertCurrent();
    const sourceRef = `${input.projectId}:${input.ym}:${input.kind}`;
    const sourceKind = "monthly_report_pdf";
    const { data: existing, error: existingError } = await db.from("workspace_documents").select("document_id,visibility").eq("source_kind", sourceKind).eq("source_ref", sourceRef).maybeSingle();
    if (existingError) throw new Error("OSドライブの保存先を確認できなかった");
    if (existing && existing.visibility !== "amd_internal") throw new Error("PDFの公開範囲を確認してください。");
    const documentId = existing?.document_id || randomUUID();
    const sha = digest(pdf);
    const storagePath = `project/${input.projectId}/monthly-reports/${input.ym}/${input.kind}/${sha}.pdf`;
    const uploaded = await db.storage.from(WORKSPACE_DOCUMENTS_BUCKET).upload(storagePath, pdf, { upsert: true, contentType: "application/pdf" });
    if (uploaded.error) throw new Error("OSドライブへPDFを保存できなかった");
    const downloaded = await db.storage.from(WORKSPACE_DOCUMENTS_BUCKET).download(storagePath);
    if (downloaded.error || !downloaded.data || digest(Buffer.from(await downloaded.data.arrayBuffer())) !== sha) throw new Error("OSドライブのPDFを確認できなかった");
    const drive = google.drive({ version: "v3", auth });
    const label = external ? "提出版" : "社内版";
    const fileName = `${project.report_local_alias || project.project_name}_月次報告書_${input.ym}_${label}.pdf`;
    // Preserve the existing submitted PDF's ID and location when one is already registered.
    const { data: report } = await db.from(table).select(external ? "pdf_drive_url" : "pdf_file_id").eq("project_id", input.projectId).eq("ym", month).single();
    const ref = report as unknown as { pdf_drive_url?: string; pdf_file_id?: string };
    let driveFileId = external ? /\/d\/([^/]+)/.exec(ref.pdf_drive_url || "")?.[1] : ref.pdf_file_id || undefined;
    if (driveFileId && !/^[\w-]+$/.test(driveFileId)) throw new Error("既存PDFの保存先を確認してください。");
    let targetFolder: string | undefined;
    if (!driveFileId) {
      const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "").slice(2);
      const folderName = `${date}_月次報告書`;
      const escape = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
      const folders = await drive.files.list({ q: `'${escape(project.drive_folder_id)}' in parents and name='${escape(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: "files(id)", supportsAllDrives: true, includeItemsFromAllDrives: true });
      targetFolder = folders.data.files?.[0]?.id || (await drive.files.create({ requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [project.drive_folder_id] }, fields: "id", supportsAllDrives: true })).data.id || undefined;
      if (!targetFolder) throw new Error("共有ドライブのフォルダを準備できなかった");
      const candidates = await drive.files.list({ q: `'${targetFolder}' in parents and name='${escape(fileName)}' and trashed=false`, fields: "files(id)", supportsAllDrives: true, includeItemsFromAllDrives: true });
      driveFileId = candidates.data.files?.[0]?.id || undefined;
    }
    await assertCurrent();
    const shared = driveFileId
      ? await drive.files.update({ fileId: driveFileId, media: { mimeType: "application/pdf", body: Readable.from(pdf) }, fields: "id", supportsAllDrives: true })
      : await drive.files.create({ requestBody: { name: fileName, parents: [targetFolder!] }, media: { mimeType: "application/pdf", body: Readable.from(pdf) }, fields: "id", supportsAllDrives: true });
    driveFileId = shared.data.id || undefined;
    if (!driveFileId) throw new Error("共有ドライブのPDF保存先を取得できなかった");
    const readback = await drive.files.get({ fileId: driveFileId, fields: "size,md5Checksum,mimeType,trashed", supportsAllDrives: true });
    if (readback.data.trashed || readback.data.mimeType !== "application/pdf" || Number(readback.data.size) !== pdf.length || readback.data.md5Checksum !== createHash("md5").update(pdf).digest("hex")) throw new Error("共有ドライブのPDFを確認できなかった");
    await assertCurrent();
    const row = { document_id: documentId, scope_kind: "project", project_id: input.projectId, institution_workspace_id: null, entry_kind: "file", visibility: "amd_internal", folder_path: monthlyReportDriveFolderPath(input.ym), display_name: `${label}.pdf`, storage_bucket: WORKSPACE_DOCUMENTS_BUCKET, storage_path: storagePath, mime_type: "application/pdf", file_size_bytes: pdf.length, upload_status: "active", source_kind: sourceKind, source_ref: sourceRef, content_sha256: sha, source_updated_at: new Date().toISOString() };
    const registered = existing
      ? await db.from("workspace_documents").update(row).eq("document_id", documentId)
      : await db.from("workspace_documents").insert(row);
    if (registered.error) throw new Error("OSドライブのPDF登録を完了できなかった");
    // Keep the full content comparison in SQL. PostgREST URL filters exceed
    // proxy limits for long Japanese reports; RPC sends parameters in its body.
    const updated = await db.rpc("monthly_report_pdf_record", {
      p_project_id: input.projectId, p_ym: input.ym, p_report_kind: input.kind,
      p_expected_content: input.expectedContent, p_pdf_file_id: driveFileId,
      p_version: input.version === "draft" ? "draft" : "final",
    });
    if (updated.error || updated.data !== true) throw new Error("PDFの保存記録を完了できなかった");
    return { ok: true, message: "PDFをOSドライブと共有ドライブへ保存した。", documentId, driveFileId };
  } catch (error) {
    console.error("[monthly-report-pdf]", error instanceof Error ? error.message : "PDF save failed");
    return { ok: false, message: `本文は保存済みです。PDFの保存を完了できませんでした。${error instanceof Error ? error.message : "もう一度保存してください。"}` };
  }
}
