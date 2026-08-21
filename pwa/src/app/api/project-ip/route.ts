import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// PJコックピット「知財」タブの API (project_ip_assets / _deadlines / _rights / _events)。
// スコープは AMD 自社知財だけでなく、その技術領域の IP 全体マップ (before zero の定石):
//   own(自社) / university(大学基本特許) / joint(共同出願) / blocking(他社の障害特許) / watch(監視対象)
// read = ログイン済みメンバー、write = admin。
// migration: scripts/migrations/308_project_ip_ledger.sql / 設計: pwa/spec/3-19-project-ip-current-spec.md

type Entity = "asset" | "deadline" | "right" | "event";

const TABLE: Record<Entity, string> = {
  asset: "project_ip_assets",
  deadline: "project_ip_deadlines",
  right: "project_ip_rights",
  event: "project_ip_events",
};
const PK: Record<Entity, string> = {
  asset: "ip_asset_id",
  deadline: "ip_deadline_id",
  right: "ip_right_id",
  event: "ip_event_id",
};
const ID_PREFIX: Record<Entity, string> = {
  asset: "ipa",
  deadline: "ipd",
  right: "ipr",
  event: "ipe",
};

function parseEntity(v: string | null | undefined): Entity | null {
  return v === "asset" || v === "deadline" || v === "right" || v === "event" ? v : null;
}

/**
 * GET /api/project-ip?projectId=p07
 * → { ok, canEdit, assets, deadlines, rights, events }
 * 4 テーブルを 1 往復で返す (タブ表示 + 特許マップが同じデータを使うため)。
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  const { data: member } = await auth.supabase
    .from("members")
    .select("is_admin")
    .eq("email", auth.user.email.toLowerCase())
    .maybeSingle();

  const [assetsRes, deadlinesRes, eventsRes] = await Promise.all([
    auth.supabase
      .from("project_ip_assets")
      .select("*")
      .eq("project_id", projectId)
      .order("importance", { ascending: false })
      .order("application_date", { ascending: false, nullsFirst: false }),
    auth.supabase
      .from("project_ip_deadlines")
      .select("*")
      .eq("project_id", projectId)
      .order("due_on", { ascending: true }),
    auth.supabase
      .from("project_ip_events")
      .select("*")
      .eq("project_id", projectId)
      .order("event_date", { ascending: false }),
  ]);

  const err = assetsRes.error || deadlinesRes.error || eventsRes.error;
  if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 500 });

  const assetIds = (assetsRes.data ?? []).map((a: { ip_asset_id: string }) => a.ip_asset_id);
  let rights: unknown[] = [];
  if (assetIds.length > 0) {
    const rightsRes = await auth.supabase
      .from("project_ip_rights")
      .select("*")
      .in("ip_asset_id", assetIds);
    if (rightsRes.error) return NextResponse.json({ ok: false, error: rightsRes.error.message }, { status: 500 });
    rights = rightsRes.data ?? [];
  }

  return NextResponse.json({
    ok: true,
    canEdit: Boolean(member?.is_admin),
    assets: assetsRes.data ?? [],
    deadlines: deadlinesRes.data ?? [],
    events: eventsRes.data ?? [],
    rights,
  });
}

/** POST /api/project-ip  body: { entity, row } → 新規作成 (admin) */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const entity = parseEntity(body?.entity);
  if (!entity || !body?.row) {
    return NextResponse.json({ ok: false, error: "entity / row required" }, { status: 400 });
  }
  const row = { ...body.row } as Record<string, unknown>;
  row[PK[entity]] = row[PK[entity]] || `${ID_PREFIX[entity]}_${randomUUID().slice(0, 12)}`;
  if (entity === "asset" || entity === "deadline" || entity === "event") {
    if (!row.project_id) return NextResponse.json({ ok: false, error: "row.project_id required" }, { status: 400 });
  }
  if (entity === "asset") {
    if (!row.title) return NextResponse.json({ ok: false, error: "row.title required" }, { status: 400 });
    row.updated_by = auth.user.email;
    row.created_by = row.created_by || auth.user.email;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from(TABLE[entity]).insert(row).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

/** PATCH /api/project-ip  body: { entity, id, patch } → 更新 (admin) */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const entity = parseEntity(body?.entity);
  if (!entity || !body?.id || !body?.patch) {
    return NextResponse.json({ ok: false, error: "entity / id / patch required" }, { status: 400 });
  }
  const patch = { ...body.patch } as Record<string, unknown>;
  delete patch[PK[entity]];
  if (entity !== "event") patch.updated_at = new Date().toISOString();
  if (entity === "asset") patch.updated_by = auth.user.email;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(TABLE[entity])
    .update(patch)
    .eq(PK[entity], body.id)
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

/** DELETE /api/project-ip?entity=asset&id=ipa_xxx → 削除 (admin) */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const entity = parseEntity(req.nextUrl.searchParams.get("entity"));
  const id = req.nextUrl.searchParams.get("id");
  if (!entity || !id) return NextResponse.json({ ok: false, error: "entity / id required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from(TABLE[entity]).delete().eq(PK[entity], id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
