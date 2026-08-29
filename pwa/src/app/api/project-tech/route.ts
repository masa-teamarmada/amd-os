import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// PJコックピット「技術」タブの API (project_tech_topics / project_tech_entries)。
// 4形式 (成立条件 / 解説 / 星取り表 / 到達実績) を同じ2テーブルで持ち、PJごとに実装を分けない。
// read = ログイン済みメンバー、write = admin。
// migration: scripts/migrations/339_project_tech_ledger.sql / 設計: pwa/spec/3-20-project-technology-current-spec.md
//
// 参照系なので Cache-Control を明示し、クライアントは src/lib/project-tech-client.ts のキャッシュ層だけを通す
// (guard: scripts/check_reference_data_cache_contract.mjs)。

type Entity = "topic" | "entry";

const TABLE: Record<Entity, string> = {
  topic: "project_tech_topics",
  entry: "project_tech_entries",
};
const PK: Record<Entity, string> = {
  topic: "tech_topic_id",
  entry: "tech_entry_id",
};
const ID_PREFIX: Record<Entity, string> = {
  topic: "ptt",
  entry: "pte",
};

/** 技術タブ下段に出す、まだ構造化していない断片。project_knowledge のうち技術に関わる3分類だけ。 */
const FRAGMENT_CATEGORIES = ["tech", "term", "competitor"];
const FRAGMENT_LIMIT = 300;

const CACHE_HEADERS = { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" };

function parseEntity(v: string | null | undefined): Entity | null {
  return v === "topic" || v === "entry" ? v : null;
}

/**
 * GET /api/project-tech?projectId=p21
 * → { ok, canEdit, topics, entries, fragments }
 * トピックと中身を1往復で返す (タブが開いた瞬間に全ブロックを描くため)。
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

  const [topicsRes, entriesRes, fragmentsRes] = await Promise.all([
    auth.supabase
      .from("project_tech_topics")
      .select("*")
      .eq("project_id", projectId)
      .neq("status", "archived")
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false }),
    auth.supabase
      .from("project_tech_entries")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("row_label", { ascending: true }),
    auth.supabase
      .from("project_knowledge")
      .select("id, category, entity_name, fact_text, confidence, source, updated_at")
      .eq("project_id", projectId)
      .eq("status", "active")
      .in("category", FRAGMENT_CATEGORIES)
      .order("updated_at", { ascending: false })
      .limit(FRAGMENT_LIMIT),
  ]);

  const err = topicsRes.error || entriesRes.error || fragmentsRes.error;
  if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 500 });

  return NextResponse.json(
    {
      ok: true,
      canEdit: Boolean(member?.is_admin),
      topics: topicsRes.data ?? [],
      entries: entriesRes.data ?? [],
      fragments: fragmentsRes.data ?? [],
    },
    { headers: CACHE_HEADERS }
  );
}

/** POST /api/project-tech  body: { entity, row } → 新規作成 (admin) */
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
  if (!row.project_id) return NextResponse.json({ ok: false, error: "row.project_id required" }, { status: 400 });
  if (entity === "topic" && !row.title) {
    return NextResponse.json({ ok: false, error: "row.title required" }, { status: 400 });
  }
  if (entity === "entry") {
    if (!row.tech_topic_id) return NextResponse.json({ ok: false, error: "row.tech_topic_id required" }, { status: 400 });
    if (!row.row_label) return NextResponse.json({ ok: false, error: "row.row_label required" }, { status: 400 });
  }
  row.updated_by = auth.user.email;
  row.created_by = row.created_by || auth.user.email;

  const admin = createAdminClient();
  const { data, error } = await admin.from(TABLE[entity]).insert(row).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

/** PATCH /api/project-tech  body: { entity, id, patch } → 更新 (admin) */
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
  patch.updated_at = new Date().toISOString();
  patch.updated_by = auth.user.email;

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

/** DELETE /api/project-tech?entity=topic&id=ptt_xxx → 削除 (admin)。トピックを消すと中身も消える。 */
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
