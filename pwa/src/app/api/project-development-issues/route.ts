import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSharedWorkspaceProjectReadAccess } from "@/lib/shared-workspace-project-read-access";
import { loadProjectDevelopmentIssues } from "@/lib/project-development-issues-server";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });
  const auth = await requireMember();
  const sharedRead = !auth.ok && await hasSharedWorkspaceProjectReadAccess(projectId);
  if (!auth.ok && !sharedRead) return auth.errorResponse;
  try {
    return NextResponse.json({ ok: true, issues: await loadProjectDevelopmentIssues(createAdminClient(), projectId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "開発課題を読み込めなかった" }, { status: 500 });
  }
}
