import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { IP_REPORT_MD, IP_REPORT_UPDATED } from "@/app/(app)/admin/ip/ip-report";

/**
 * Native admin IP screen bridge. The report stays owned by the same source
 * module as the PWA; this endpoint only applies the existing admin boundary.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  return NextResponse.json({
    ok: true,
    markdown: IP_REPORT_MD,
    updated: IP_REPORT_UPDATED,
  });
}
