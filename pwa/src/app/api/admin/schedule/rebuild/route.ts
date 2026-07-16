import { NextRequest, NextResponse } from "next/server";
import { annualRange, isIsoDate, todayJst } from "@/lib/admin-schedule/date";
import { generateSchedule } from "@/lib/admin-schedule/generator";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";

function safeRange(value: unknown): string | null {
  return typeof value === "string" && isIsoDate(value) ? value : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!reason) return NextResponse.json({ error: "再生成理由が必要" }, { status: 400 });
  const fallback = annualRange(Number(todayJst().slice(0, 4)));
  const from = safeRange(body.from) ?? fallback.from;
  const to = safeRange(body.to) ?? fallback.to;
  const result = await generateSchedule(createAdminClient(), { from, to });
  return NextResponse.json({ ...result, reason }, { status: result.ok ? 200 : 500 });
}
