import { canEditProjectSurface, requireProjectContentEditor } from "@/lib/project-surface-access";
import { NextRequest, NextResponse } from "next/server";
import { loadProjectTechData } from "@/lib/project-tech-server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { hasSharedWorkspaceProjectReadAccess } from "@/lib/shared-workspace-project-read-access";
import { amiePrepareTechDisclosure } from "@/lib/amie-tech-disclosure-server";
import { amieIsEffluentTopic, amieValidateEffluentEntry } from "@/lib/amie-effluent-experiments";

export const runtime = "nodejs";

// PJコックピット「技術」タブの API (project_tech_topics / project_tech_entries)。
// 4形式 (成立条件 / 解説 / 星取り表 / 到達実績) を同じ2テーブルで持ち、PJごとに実装を分けない。
// read = ログイン済みAMDメンバー、または当該PJの共有ワークスペースメンバー。write = admin。
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
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  // 読み取りは AMD メンバー、または当該PJのワークスペース権限（DB再確認）がある外部アカウントだけ。
  // Supabase にログインしているだけの利用者（メンバー登録の無いアカウント）は通さない（2026-09-30）。
  const auth = await requireMember();
  const sharedWorkspaceRead = !auth.ok && await hasSharedWorkspaceProjectReadAccess(projectId);
  if (!auth.ok && !sharedWorkspaceRead) return auth.errorResponse;

  const member = auth.ok
    ? await auth.supabase
      .from("members")
      .select("is_admin")
      .eq("email", auth.user.email.toLowerCase())
      .maybeSingle()
    : { data: null };
  const db = auth.ok ? auth.supabase : createAdminClient();

  try {
    const data = await loadProjectTechData(db, projectId, auth.ok && (Boolean(member.data?.is_admin) || await canEditProjectSurface(projectId, "cockpit") || await canEditProjectSurface(projectId, "workspace")), auth.ok ? "internal" : "shared");
    return NextResponse.json({ ok: true, ...data }, { headers: auth.ok ? CACHE_HEADERS : { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "読み込みに失敗" }, { status: 500 });
  }
}

/** POST /api/project-tech  body: { entity, row } → 新規作成 (admin) */
export async function POST(req: NextRequest) {
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
  const auth = await requireProjectContentEditor(req, String(row.project_id));
  if (!auth.ok) return auth.errorResponse;
  if (row.disclosure !== undefined) {
    try { row.disclosure = amiePrepareTechDisclosure(row, entity, row.disclosure); }
    catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "開示区分の保存に失敗" }, { status: 400 }); }
  }
  if (entity === "entry") {
    const {data: parent} = await createAdminClient().from("project_tech_topics").select("project_id,presentation").eq("tech_topic_id",row.tech_topic_id).maybeSingle();
    if (!parent || parent.project_id !== row.project_id) return NextResponse.json({error:"invalid_parent"},{status:400});
    if (amieIsEffluentTopic(parent) || row.experiment != null) {
      if (!amieIsEffluentTopic(parent)) return NextResponse.json({error:"廃液実験は廃液台帳へ登録して"},{status:400});
      try { row.experiment = amieValidateEffluentEntry(row); }
      catch (error) { return NextResponse.json({ok:false,error:error instanceof Error ? error.message : "廃液実験の登録形式が不正"},{status:400}); }
    }
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
  const body = await req.json().catch(() => null);
  const entity = parseEntity(body?.entity);
  if (!entity || !body?.id || !body?.patch) {
    return NextResponse.json({ ok: false, error: "entity / id / patch required" }, { status: 400 });
  }
  const { data: stored, error: lookupError } = await createAdminClient().from(TABLE[entity]).select("*").eq(PK[entity], body.id).maybeSingle();
  if (lookupError || !stored) return NextResponse.json({error:"Not found"},{status:404});
  const auth = await requireProjectContentEditor(req, stored.project_id);
  if (!auth.ok) return auth.errorResponse;
  const patch = { ...body.patch } as Record<string, unknown>;
  const expectedUpdatedAt = patch.expected_updated_at;
  delete patch.expected_updated_at;
  delete patch.project_id;
  delete patch.tech_topic_id;
  delete patch[PK[entity]];
  delete patch.disclosure_status;
  if (entity === "entry" && (stored.experiment != null || patch.experiment !== undefined)) {
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== stored.updated_at) return NextResponse.json({ok:false,error:"別の更新が入った。最新の行を開いて保存して"},{status:409});
    try { patch.experiment = amieValidateEffluentEntry({ ...stored, ...patch }); }
    catch (error) { return NextResponse.json({ok:false,error:error instanceof Error ? error.message : "廃液実験の登録形式が不正"},{status:400}); }
  }
  if (patch.disclosure !== undefined) {
    try { patch.disclosure = amiePrepareTechDisclosure({ ...stored, ...patch }, entity, patch.disclosure); }
    catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "開示区分の保存に失敗" }, { status: 400 }); }
  }
  patch.updated_at = new Date().toISOString();
  patch.updated_by = auth.user.email;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(TABLE[entity])
    .update(patch)
    .eq(PK[entity], body.id)
    .eq("updated_at",stored.updated_at)
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

/** DELETE /api/project-tech?entity=topic&id=ptt_xxx → 削除 (admin)。トピックを消すと中身も消える。 */
export async function DELETE(req: NextRequest) {

  const entity = parseEntity(req.nextUrl.searchParams.get("entity"));
  const id = req.nextUrl.searchParams.get("id");
  if (!entity || !id) return NextResponse.json({ ok: false, error: "entity / id required" }, { status: 400 });

  const {data: stored} = await createAdminClient().from(TABLE[entity]).select("project_id").eq(PK[entity], id).maybeSingle();
  if (!stored) return NextResponse.json({error:"Not found"},{status:404});
  const auth = await requireProjectContentEditor(req,stored.project_id);
  if (!auth.ok) return auth.errorResponse;
  const admin = createAdminClient();
  const { error } = await admin.from(TABLE[entity]).delete().eq(PK[entity], id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
