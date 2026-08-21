/**
 * PATCH /api/admin/projects/[id]
 *
 * Admin の PJ リスト (AdminProjectsTable) から projects / project_ventures への
 * 1 セル単位 update を service_role 経由で受ける。
 *
 * 経緯: 旧実装は browser auth client 直接 supabase.from("projects").update() してたが、
 *   - RLS で UPDATE が anon / authenticated を弾く回帰が再発 (2026-05-08 / 2026-05-11)
 *   - 「変更されない」「エラーも出ない」症状が出る → service_role 経由に統一
 *
 * Body 形式:
 *   { projectsPatch?: Record<string, unknown>, venturesPatch?: Record<string, unknown> }
 *
 * id は projects.id (UUID)。project_ventures は projects.project_id 経由で update する
 * (projectsPatch を先に走らせて、その結果から project_id を取り出して使う)。
 * project_ventures が無い PJ では 0 件 update を成功扱いにせず 409 を返す。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

interface PatchBody {
  projectsPatch?: Record<string, unknown>;
  venturesPatch?: Record<string, unknown>;
}

function normalizeDriveSourceFolderIds(value: unknown, canonicalFolderId: string | null) {
  if (!Array.isArray(value)) return { ok: false as const, error: "drive_source_folder_ids must be an array" };
  if (value.length > 20) return { ok: false as const, error: "drive_source_folder_ids accepts at most 20 roots" };

  const ids = Array.from(new Set(value.map((item) => typeof item === "string" ? item.trim() : "")))
    .filter(Boolean);
  if (ids.some((id) => id.length > 220 || !/^[A-Za-z0-9_-]+$/.test(id))) {
    return { ok: false as const, error: "drive_source_folder_ids contains an invalid Drive ID" };
  }
  return { ok: true as const, ids: ids.filter((id) => id !== canonicalFolderId) };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const db = createAdminClient();
  const updatedAt = new Date().toISOString();
  const hasProjectsPatch = !!body.projectsPatch && Object.keys(body.projectsPatch).length > 0;
  const hasVenturesPatch = !!body.venturesPatch && Object.keys(body.venturesPatch).length > 0;
  if (!hasProjectsPatch && !hasVenturesPatch) {
    return NextResponse.json(
      { ok: false, error: "projectsPatch or venturesPatch required" },
      { status: 400 }
    );
  }

  // projects.id → project_id 解決 (= venturesPatch を使う場合に必要)
  const { data: pRow, error: pSelErr } = await db
    .from("projects")
    .select("project_id,drive_folder_id")
    .eq("id", id)
    .maybeSingle();
  if (pSelErr) {
    return NextResponse.json({ ok: false, error: `select err: ${pSelErr.message}` }, { status: 500 });
  }
  if (!pRow) {
    return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });
  }
  const project = pRow as { project_id: string; drive_folder_id: string | null };
  const projectId = project.project_id;

  const result: Record<string, unknown> = {};

  if (hasProjectsPatch) {
    const projectsPatch = { ...body.projectsPatch };
    if (Object.prototype.hasOwnProperty.call(projectsPatch, "drive_source_folder_ids")) {
      const normalized = normalizeDriveSourceFolderIds(projectsPatch.drive_source_folder_ids, project.drive_folder_id);
      if (!normalized.ok) return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
      projectsPatch.drive_source_folder_ids = normalized.ids;
    }
    const { error } = await db
      .from("projects")
      .update({ ...projectsPatch, updated_at: updatedAt })
      .eq("id", id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: `projects update: ${error.message}` },
        { status: 500 }
      );
    }
    result.projects_updated = true;
  }

  if (hasVenturesPatch) {
    const { data: ventureRows, error } = await db
      .from("project_ventures")
      .update({ ...body.venturesPatch, updated_at: updatedAt })
      .eq("project_id", projectId)
      .select("project_id");
    if (error) {
      return NextResponse.json(
        { ok: false, error: `project_ventures update: ${error.message}` },
        { status: 500 }
      );
    }
    if (!ventureRows || ventureRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "project_ventures row not found for this project" },
        { status: 409 }
      );
    }
    result.ventures_updated = ventureRows.length;
  }

  return NextResponse.json({ ok: true, project_id: projectId, ...result });
}
