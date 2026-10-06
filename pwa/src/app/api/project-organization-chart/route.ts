import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { hasSharedWorkspaceProjectReadAccess } from "@/lib/shared-workspace-project-read-access";
import { loadProjectOrganizationChart } from "@/lib/project-organization-chart-server";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });
  const auth = await requireMember();
  const sharedRead = !auth.ok && await hasSharedWorkspaceProjectReadAccess(projectId);
  if (!auth.ok && !sharedRead) return auth.errorResponse;
  try {
    return NextResponse.json({ ok: true, chart: await loadProjectOrganizationChart(createAdminClient(), projectId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "組織図を読み込めなかった" }, { status: 500 });
  }
}
