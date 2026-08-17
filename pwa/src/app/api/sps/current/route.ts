import { NextResponse } from "next/server";
import { fetchCurrentSpsProjectAssessments } from "@/lib/seed-screening-bands";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;
  try {
    const assessments = await fetchCurrentSpsProjectAssessments();
    return NextResponse.json({ ok: true, assessments: Array.from(assessments.values()) }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[current-sps-list]", error);
    return NextResponse.json({ ok: false, error: "現行SPS一覧の取得に失敗" }, { status: 500 });
  }
}
