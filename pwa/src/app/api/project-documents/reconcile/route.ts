/**
 * POST /api/project-documents/reconcile
 *
 * 全PJ (または project_ids 指定分) の資料室 Drive folder を一括で
 * project_documents へ additive-only 同期する。GET /api/project-documents の
 * スロットル付き自動同期とは別に、CLI からの一括検証・強制同期に使う。
 *
 * 認証: Authorization: Bearer CRON_SECRET (WORKFLOW_SECRET でも可)、
 * もしくは admin ログイン中の Supabase session。meeting-prep cron と同じパターン。
 *
 * body (任意): { "project_ids": ["p00", "p21"] }  未指定なら drive_folder_id が
 * 設定済みの全PJが対象。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { reconcileProjectDocuments } from "@/lib/project-documents/reconcile";

type ProjectRow = {
  project_id: string;
  drive_folder_id: string | null;
};

async function authorize(req: NextRequest): Promise<{ ok: true; actor: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const workflowSecret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (workflowSecret && auth === `Bearer ${workflowSecret}`) return { ok: true, actor: "workflow" };

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
  return { ok: true, actor: member.code_name || user.email };
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const projectIds = Array.isArray(body.project_ids)
    ? body.project_ids.map((v) => String(v).trim()).filter(Boolean)
    : [];

  const admin = createAdminClient();
  let query = admin.from("projects").select("project_id,drive_folder_id");
  if (projectIds.length > 0) query = query.in("project_id", projectIds);
  const { data: projectsData, error: projectsError } = await query;
  if (projectsError) return NextResponse.json({ ok: false, error: projectsError.message }, { status: 500 });

  const projects = ((projectsData ?? []) as ProjectRow[]).filter((p) => (p.drive_folder_id || "").trim().length > 0);

  const results: Array<Record<string, unknown>> = [];
  let totalAdded = 0;
  let failed = 0;

  for (const project of projects) {
    try {
      const result = await reconcileProjectDocuments(admin, project.project_id, project.drive_folder_id as string);
      totalAdded += result.added;
      results.push({
        ok: true,
        projectId: project.project_id,
        documentsFolderId: result.documentsFolderId,
        scanned: result.scanned,
        added: result.added,
      });
    } catch (error) {
      failed += 1;
      results.push({
        ok: false,
        projectId: project.project_id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    actor: authz.actor,
    projectsScanned: projects.length,
    totalAdded,
    failed,
    results,
  });
}
