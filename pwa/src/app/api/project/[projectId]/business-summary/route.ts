import { canEditProjectSurface, requireProjectContentEditor } from "@/lib/project-surface-access";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { hasSharedWorkspaceProjectReadAccess } from "@/lib/shared-workspace-project-read-access";
import { textOrNull, type BusinessSummary, type BusinessSummaryResponse } from "@/lib/project-overview";

export const runtime = "nodejs";

// 会社情報 > 会社概要「事業の概要」（事業の一言と詳しい説明）の API（spec 3-23 §9）。2026-10-04 まさ確定。
// GET   = ログイン済みAMDメンバー、または当該PJの共有ワークスペースメンバー（会社概要はワークスペースでも読む）。
// PATCH = 管理者、または対象PJのコックピット/ワークスペースを明示的に編集付与された内部メンバー。正本は project_business_summaries（migration 468）。Venture Map などが読む
//         project_ventures.short_description / long_description へは DB のトリガーが写す。ほかの入口からは書けない。

/** 参照系。事業の概要はPJを作るときに書いて、めったに変えない（spec 5-10）。 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { storedAt: number; business: BusinessSummary | null }>();
const HEADERS = { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" };

function nowMs(): number {
  return new Date().getTime();
}

type Db = ReturnType<typeof createAdminClient>;

async function loadBusinessSummary(db: Db, projectId: string): Promise<BusinessSummary | null> {
  const { data, error } = await db
    .from("project_business_summaries")
    .select("summary, detail, updated_at, updated_by_email")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    summary: (data.summary as string | null) ?? null,
    detail: (data.detail as string | null) ?? null,
    updatedAt: (data.updated_at as string | null) ?? null,
    updatedBy: (data.updated_by_email as string | null) ?? null,
  };
}

/** 同じPJへ同時に来た読み込みは1本へ束ねる（single-flight、spec 5-10）。 */
const inflight = new Map<string, Promise<BusinessSummary | null>>();

async function cachedBusinessSummary(db: Db, projectId: string): Promise<BusinessSummary | null> {
  const cached = cache.get(projectId);
  if (cached && nowMs() - cached.storedAt < CACHE_TTL_MS) return cached.business;
  const pending = inflight.get(projectId);
  if (pending) return pending;
  const request = loadBusinessSummary(db, projectId)
    .then((business) => {
      cache.set(projectId, { storedAt: nowMs(), business });
      return business;
    })
    .finally(() => {
      if (inflight.get(projectId) === request) inflight.delete(projectId);
    });
  inflight.set(projectId, request);
  return request;
}

/** GET /api/project/{projectId}/business-summary */
export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  const auth = await requireMember();
  const sharedWorkspaceRead = !auth.ok && (await hasSharedWorkspaceProjectReadAccess(projectId));
  if (!auth.ok && !sharedWorkspaceRead) return auth.errorResponse;

  const db = createAdminClient();
  try {
    const business = await cachedBusinessSummary(db, projectId);
    let canEdit = false;
    if (auth.ok) {
      const { data } = await db.from("members").select("is_admin").ilike("email", auth.user.email).maybeSingle();
      canEdit = Boolean((data as { is_admin?: boolean } | null)?.is_admin);
    }
    canEdit ||= await canEditProjectSurface(projectId, "workspace") || await canEditProjectSurface(projectId, "cockpit");
    const body: BusinessSummaryResponse = { ok: true, business, viewer: { canEdit } };
    return NextResponse.json(body, { headers: HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "事業の概要を読み込めない" }, { status: 500 });
  }
}

/** PATCH /api/project/{projectId}/business-summary  body: { summary, detail } */
export async function PATCH(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });
  const auth = await requireProjectContentEditor(req,projectId);
  if (!auth.ok) return auth.errorResponse;

  const body = (await req.json().catch(() => null)) as { summary?: unknown; detail?: unknown } | null;
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });
  const row = {
    summary: textOrNull(body.summary, 300),
    detail: textOrNull(body.detail, 4000),
    updated_by_email: auth.user.email,
    updated_at: new Date().toISOString(),
  };

  const db = createAdminClient();
  const { data: existing, error: readError } = await db
    .from("project_business_summaries")
    .select("project_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (readError) return NextResponse.json({ ok: false, error: "事業の概要を保存できない" }, { status: 500 });
  const { error } = existing
    ? await db.from("project_business_summaries").update(row).eq("project_id", projectId)
    : await db.from("project_business_summaries").insert({ project_id: projectId, created_by_email: auth.user.email, ...row });
  if (error) return NextResponse.json({ ok: false, error: `事業の概要を保存できない: ${error.message}` }, { status: 500 });

  try {
    const business = await loadBusinessSummary(db, projectId);
    cache.set(projectId, { storedAt: nowMs(), business });
    const response: BusinessSummaryResponse = { ok: true, business, viewer: { canEdit: true } };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ok: false, error: "保存したが、読み直せない" }, { status: 500 });
  }
}
