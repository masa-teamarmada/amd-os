import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

type RequestBody = {
  projectName?: unknown;
  commercializationRoute?: unknown;
  targetMarket?: unknown;
};

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/seeds/[seedId]/commercialization
 *
 * Explicitly activates a provisional commercialization project. contacted / discussing
 * alone never calls this endpoint, so a seed does not silently become a PJ.
 *
 * The database RPC locks the seed row and creates projects + seed_projects + project_members
 * in one transaction. The API remains the only client-facing write boundary.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seedId: string }> },
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const { seedId } = await params;
  if (!UUID_RE.test(seedId || "")) {
    return NextResponse.json({ ok: false, error: "seedId is invalid" }, { status: 400 });
  }

  let body: RequestBody = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: seed, error: seedError } = await db
    .from("seeds")
    .select("id,title,org_name,industry_target")
    .eq("id", seedId)
    .maybeSingle();
  if (seedError) {
    console.error("[seed-commercialization] seed lookup failed:", seedError.message);
    return NextResponse.json({ ok: false, error: "シーズを確認できなかったよ" }, { status: 500 });
  }
  if (!seed) return NextResponse.json({ ok: false, error: "seed not found" }, { status: 404 });

  const projectName = text(body.projectName, 160) || `事業化検討｜${text(seed.title, 120)}`;
  const commercializationRoute = text(body.commercializationRoute, 80) || null;
  const targetMarket = text(body.targetMarket, 240) ||
    (Array.isArray(seed.industry_target) ? seed.industry_target.filter((v): v is string => typeof v === "string").join(" / ") : null);

  // The creator is granted the existing project workspace access boundary. No external
  // access is inferred from the seed's institution or contact status.
  const { data: member, error: memberError } = await db
    .from("members")
    .select("member_id,status")
    .ilike("email", auth.user.email.toLowerCase())
    .maybeSingle();
  if (memberError) {
    console.error("[seed-commercialization] member lookup failed:", memberError.message);
    return NextResponse.json({ ok: false, error: "実行メンバーを確認できなかったよ" }, { status: 500 });
  }
  if (!member?.member_id || member.status !== "active") {
    return NextResponse.json({ ok: false, error: "member not found" }, { status: 403 });
  }

  const { data: rows, error: activationError } = await db.rpc("activate_seed_commercialization", {
    p_seed_id: seedId,
    p_member_id: member.member_id,
    p_project_name: projectName,
    p_commercialization_route: commercializationRoute,
    p_target_market: targetMarket,
  });
  if (activationError || !rows?.[0]) {
    console.error("[seed-commercialization] activation failed:", activationError?.message ?? "empty rpc result");
    return NextResponse.json({ ok: false, error: "事業化検討PJを作成できなかったよ" }, { status: 500 });
  }
  const row = rows[0] as { project_id: string; project_name: string; project_status: string; already_linked: boolean };

  return NextResponse.json({
    ok: true,
    alreadyLinked: row.already_linked,
    project: { projectId: row.project_id, projectName: row.project_name, status: row.project_status },
  }, { status: row.already_linked ? 200 : 201 });
}
