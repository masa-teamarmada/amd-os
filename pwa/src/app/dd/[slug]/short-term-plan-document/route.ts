import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadShortTermPlanHtml } from "@/lib/project-short-term-plan-server";
import { recordDdAccessEvent } from "@/lib/dd-package-server";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveDdPackageAccess(slug);
  if (!access) notFound();
  try {
    const html = await loadShortTermPlanHtml(createAdminClient(), access.projectId);
    if (!html) return new NextResponse("短期計画は未登録", { status: 404 });
    await recordDdAccessEvent(access, "dd_package_viewed");
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; img-src data:; style-src 'unsafe-inline'; font-src data:; sandbox", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("短期計画を読み込めなかった", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
