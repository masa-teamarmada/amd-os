/**
 * GET /api/progress/reimbursement?projectId=...&ym=...
 * 立替精算一覧を取得する（GAS reimburseForMonth プロキシ）
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
    return NextResponse.json({ ok: true, items: [] });
  }

  try {
    const url = new URL(GAS_BASE_URL);
    url.searchParams.set("mode", "pwaApi");
    url.searchParams.set("key", GAS_API_KEY);
    url.searchParams.set("action", "reimburseForMonth");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("ym", ym);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: true, items: [] });

    const json = await res.json();
    const items = json?.data?.items ?? json?.items ?? [];
    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: true, items: [] });
  }
}
