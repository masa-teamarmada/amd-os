import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  return NextResponse.json(
    {
      ok: false,
      message: "Tsukuyomi post bridge is not implemented in PWA yet.",
      next: "Implement Slack/GAS bridge with admin gate and mention safety before enabling the UI.",
    },
    { status: 501 }
  );
}
