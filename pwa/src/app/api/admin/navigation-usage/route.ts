import { NextResponse } from "next/server";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_SURFACE_GROUPS, getSurfaceById } from "@/lib/surface-catalog";
import { ADMIN_NAVIGATION_PATH_ALIASES, summarizeAdminVisits, type AdminVisitAggregate } from "@/lib/admin-navigation-usage";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const member = await getCurrentMemberAccess();
  if (!member) return reply({ error: "Unauthorized" }, 401);
  if (!member.isAdmin || member.scope !== "portfolio") return reply({ error: "Forbidden" }, 403);
  const paths = [...new Set(ADMIN_SURFACE_GROUPS.flatMap((group) => group.surfaceIds.map((id) => getSurfaceById(id)?.primaryPath))
    .filter((path): path is string => Boolean(path)))];
  const { data, error } = await createAdminClient().rpc("amie_admin_page_visit_counts", {
    p_actor_key: `member:${member.memberId}`,
    p_paths: [...paths, ...Object.entries(ADMIN_NAVIGATION_PATH_ALIASES).filter(([, target]) => paths.includes(target)).map(([from]) => from)],
  });
  if (error) return reply({ error: "閲覧回数の取得に失敗" }, 503);
  return reply({ usage: summarizeAdminVisits((data ?? []) as AdminVisitAggregate[], paths), scope: "self" });
}
