import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { hasSharedWorkspaceProjectReadAccess } from "@/lib/shared-workspace-project-read-access";
import { normalizeBusinessPlanPhases, type ProjectBusinessPlan } from "@/lib/project-business-plan";

export const runtime = "nodejs";

// PJコックピット / PJワークスペース「事業計画」タブ（フェーズマトリクス）の API。全PJ同じ形（spec 3-23）。
// read = ログイン済みAMDメンバー、または当該PJの共有ワークスペースメンバー。
// 正本: project_business_plans（scripts/migrations/464_project_format_business_plans.sql）。

/** 参照系。フェーズの計画は資金計画の改定のときにしか変わらないので、プロセス内で少し持つ（spec 5-10）。 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { storedAt: number; plan: ProjectBusinessPlan | null }>();
const HEADERS = { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" };

function nowMs(): number {
  return new Date().getTime();
}

async function loadProjectBusinessPlan(projectId: string): Promise<ProjectBusinessPlan | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("project_business_plans")
    .select("project_id, matrix_note, source_note, phases_json, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    projectId: data.project_id as string,
    matrixNote: (data.matrix_note as string | null) ?? null,
    sourceNote: (data.source_note as string | null) ?? null,
    phases: normalizeBusinessPlanPhases(data.phases_json),
    updatedAt: (data.updated_at as string | null) ?? null,
  };
}

/** GET /api/project-business-plan?projectId=p21 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  const auth = await requireMember();
  const sharedWorkspaceRead = !auth.ok && await hasSharedWorkspaceProjectReadAccess(projectId);
  if (!auth.ok && !sharedWorkspaceRead) return auth.errorResponse;

  const cached = cache.get(projectId);
  if (cached && nowMs() - cached.storedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, plan: cached.plan }, { headers: HEADERS });
  }
  try {
    const plan = await loadProjectBusinessPlan(projectId);
    cache.set(projectId, { storedAt: nowMs(), plan });
    return NextResponse.json({ ok: true, plan }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "事業計画を読み込めない" }, { status: 500 });
  }
}
