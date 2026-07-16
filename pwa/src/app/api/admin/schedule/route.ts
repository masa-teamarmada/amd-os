import { NextRequest, NextResponse } from "next/server";
import { annualRange, isIsoDate, todayJst } from "@/lib/admin-schedule/date";
import { loadScheduleView } from "@/lib/admin-schedule/read";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";

function dateRange(request: NextRequest): { from: string; to: string } {
  const year = Number(todayJst().slice(0, 4));
  const fallback = annualRange(year);
  const from = request.nextUrl.searchParams.get("from") ?? fallback.from;
  const to = request.nextUrl.searchParams.get("to") ?? fallback.to;
  return { from: isIsoDate(from) ? from : fallback.from, to: isIsoDate(to) ? to : fallback.to };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const range = dateRange(request);
  const data = await loadScheduleView(auth.supabase, range);
  return NextResponse.json(data, { status: data.meta.schemaReady ? 200 : 503 });
}
