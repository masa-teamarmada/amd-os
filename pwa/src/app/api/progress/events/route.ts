/**
 * GET /api/progress/events?projectId=...&ym=...
 * 進捗イベント一覧を取得する（GAS rewardDashboard プロキシ）
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

const GAS_BASE_URL = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
const GAS_API_KEY = process.env.NEXT_PUBLIC_GAS_API_KEY || "";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const ym = searchParams.get("ym");

  if (!projectId || !ym) {
    return NextResponse.json({ error: "projectId and ym required" }, { status: 400 });
  }

  if (!GAS_BASE_URL) {
    return NextResponse.json({ ok: true, events: [] });
  }

  try {
    const url = new URL(GAS_BASE_URL);
    url.searchParams.set("mode", "pwaApi");
    url.searchParams.set("key", GAS_API_KEY);
    url.searchParams.set("action", "rewardDashboard");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("ym", ym);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: true, events: [] });

    const json = await res.json();
    const events = json?.data?.events ?? json?.events ?? [];
    return NextResponse.json({ ok: true, events });
  } catch {
    return NextResponse.json({ ok: true, events: [] });
  }
}
