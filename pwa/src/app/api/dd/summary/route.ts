import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { getDdPackageSummary } from "@/lib/dd-package-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dd/summary?projectId=p21[&fresh=1]
// そのPJにDDパッケージがあるか（コックピットとワークスペースの「DDパッケージ」タブを出すか）。AMD admin 限定。
// 参照系（spec 5-10）: サーバのスナップショット5分 + HTTP キャッシュ + クライアント層 src/lib/dd-client.ts。
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() ?? "";
  if (!projectId || projectId.length > 160) {
    return NextResponse.json({ ok: false, error: "invalid_project" }, { status: 400 });
  }
  const fresh = url.searchParams.get("fresh") === "1";
  const row = await getDdPackageSummary(projectId, { fresh });
  return NextResponse.json(
    { ok: true, package: row ? { slug: row.slug, title: row.title, status: row.status } : null },
    { headers: { "Cache-Control": fresh ? "no-store" : "private, max-age=60, stale-while-revalidate=600" } },
  );
}
