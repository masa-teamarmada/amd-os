import { NextRequest, NextResponse } from "next/server";
import { syncCompanyOperatingFacts } from "@/lib/admin-schedule/generator";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await syncCompanyOperatingFacts(createAdminClient());
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
