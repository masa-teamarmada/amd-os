import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentMemberAccess,
  getProjectWorkspaceBundle,
} from "@/lib/project-workspace";

export const runtime = "nodejs";

// A read-only DTO used by every client. It deliberately exposes only the
// already-scoped workspace bundle rather than granting a client table access.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const access = await getCurrentMemberAccess();
    if (!access) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    const bundle = await getProjectWorkspaceBundle(projectId, access);
    if (!bundle) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, access, bundle });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "workspace bundle failed" },
      { status: 500 },
    );
  }
}
