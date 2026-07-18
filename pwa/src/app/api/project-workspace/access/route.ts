import { NextResponse } from "next/server";
import { getCurrentMemberAccess } from "@/lib/project-workspace";

export const runtime = "nodejs";

// Shared workspace access DTO. Browser sessions and native Bearer sessions
// both pass through the same `getCurrentMemberAccess` membership boundary.
export async function GET() {
  try {
    const access = await getCurrentMemberAccess();
    if (!access) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, access });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "workspace access failed" },
      { status: 500 },
    );
  }
}
