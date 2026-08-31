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
    // Includes the theme work hub (profiles/meetings/documents/deliverables/links) — mutable,
    // edited-in-place content, not a low-frequency reference table. Always re-fetched fresh so a
    // client refresh after a save (POST/PATCH under .../theme/[trackKey]) reflects the write.
    return NextResponse.json({ ok: true, access, bundle }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "workspace bundle failed" },
      { status: 500 },
    );
  }
}
