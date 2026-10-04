import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireMember } from "@/lib/supabase/api-auth";
import {
  normalizeRevenueStreams,
  textOrNull,
  type ProjectOverviewPayload,
  type ProjectOverviewResponse,
} from "@/lib/project-overview";

export const runtime = "nodejs";

// PJコックピット「PJ管理 > PJ概要」の API（spec 3-23 §9）。2026-10-04 まさ確定「1で進めて」。
// GET   = ログイン済みAMDメンバー。PJの定義と、今の状態のうちPJ・Venture Map・会社概要・シーズ・重要な動きから出す分を返す
//         （ゴールツリー・契約・収支は、それぞれのタブと同じ読み込み層から画面が読む）。
// PATCH = 管理者だけ。PJの定義（関わり方の補足・報酬形態・先方の窓口）を書く。正本は project_definitions（migration 468）。
// PJ概要はAMDの中だけで読む。共有ワークスペースとDDには出さない。

/** 参照系。PJの定義はめったに変わらない。重要な動きを早めに追うため、TTLは短めの60秒（spec 5-10）。 */
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { storedAt: number; overview: ProjectOverviewPayload }>();
const HEADERS = { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" };

function nowMs(): number {
  return new Date().getTime();
}

type Db = ReturnType<typeof createAdminClient>;

async function viewerIsAdmin(db: Db, email: string): Promise<boolean> {
  const { data } = await db.from("members").select("is_admin").ilike("email", email).maybeSingle();
  return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
}

async function loadOverview(db: Db, projectId: string): Promise<ProjectOverviewPayload | null> {
  const [projectRes, ventureRes, companyRes, definitionRes, membersRes, seedLinksRes, signalsRes] = await Promise.all([
    db
      .from("projects")
      .select("project_id, project_name, display_name, client_name, status, project_category, start_ym, end_ym")
      .eq("project_id", projectId)
      .maybeSingle(),
    db
      .from("project_ventures")
      .select("lane, outcome_pattern, founded_at, origin_org, origin_pi, amd_role, amd_support_started_at, amd_support_ended_at")
      .eq("project_id", projectId)
      .maybeSingle(),
    db
      .from("project_company_profiles")
      .select("legal_status, legal_name, incorporated_on")
      .eq("project_id", projectId)
      .maybeSingle(),
    db
      .from("project_definitions")
      .select("involvement_note, revenue_streams, counterpart_contacts, updated_at, updated_by_email")
      .eq("project_id", projectId)
      .maybeSingle(),
    db
      .from("project_members")
      .select("member_id, is_pl, is_pm, is_closer, role_label")
      .eq("project_id", projectId)
      .eq("is_active", true),
    db.from("seed_projects").select("seed_id").eq("project_id", projectId),
    db
      .from("project_strategy_signals")
      .select("signal_id, signal_date, title, summary")
      .eq("project_id", projectId)
      .eq("status", "confirmed")
      .order("signal_date", { ascending: false, nullsFirst: false })
      .limit(3),
  ]);
  for (const res of [projectRes, ventureRes, companyRes, definitionRes, membersRes, seedLinksRes, signalsRes]) {
    if (res.error) throw new Error(res.error.message);
  }
  const project = projectRes.data as Record<string, unknown> | null;
  if (!project) return null;

  const memberRows = (membersRes.data ?? []) as Array<{ member_id: string; is_pl: boolean | null; is_pm: boolean | null; is_closer: boolean | null; role_label: string | null }>;
  const seedIds = ((seedLinksRes.data ?? []) as Array<{ seed_id: string }>).map((row) => String(row.seed_id));
  const [namesRes, seedsRes] = await Promise.all([
    memberRows.length > 0
      ? db.from("members").select("member_id, code_name").in("member_id", memberRows.map((row) => row.member_id))
      : Promise.resolve({ data: [], error: null }),
    seedIds.length > 0
      ? db.from("seeds").select("id, title, org_name, researcher_name").in("id", seedIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (namesRes.error) throw new Error(namesRes.error.message);
  if (seedsRes.error) throw new Error(seedsRes.error.message);
  const nameOf = new Map(
    ((namesRes.data ?? []) as Array<{ member_id: string; code_name: string | null }>).map((row) => [row.member_id, row.code_name || row.member_id]),
  );

  const venture = ventureRes.data as Record<string, string | null> | null;
  const company = companyRes.data as Record<string, string | null> | null;
  const definition = definitionRes.data as Record<string, unknown> | null;
  const str = (value: unknown) => (typeof value === "string" && value ? value : null);

  return {
    projectId,
    identity: {
      projectName: String(project.project_name ?? projectId),
      displayName: str(project.display_name),
      clientName: str(project.client_name),
      status: String(project.status ?? ""),
      projectCategory: str(project.project_category),
      startYm: str(project.start_ym),
      endYm: str(project.end_ym),
    },
    venture: venture
      ? {
          lane: str(venture.lane),
          outcomePattern: str(venture.outcome_pattern),
          foundedAt: str(venture.founded_at),
          originOrg: str(venture.origin_org),
          originPi: str(venture.origin_pi),
          amdRole: str(venture.amd_role),
          supportStartedAt: str(venture.amd_support_started_at),
          supportEndedAt: str(venture.amd_support_ended_at),
        }
      : null,
    company: company
      ? { legalStatus: str(company.legal_status), legalName: str(company.legal_name), incorporatedOn: str(company.incorporated_on) }
      : null,
    definition: definition
      ? {
          involvementNote: str(definition.involvement_note),
          revenueStreams: normalizeRevenueStreams(definition.revenue_streams),
          counterpartContacts: str(definition.counterpart_contacts),
          updatedAt: str(definition.updated_at),
          updatedBy: str(definition.updated_by_email),
        }
      : null,
    members: memberRows.map((row) => ({
      name: nameOf.get(row.member_id) ?? row.member_id,
      isPl: Boolean(row.is_pl),
      isPm: Boolean(row.is_pm),
      isCloser: Boolean(row.is_closer),
      roleLabel: row.role_label ?? null,
    })),
    seeds: ((seedsRes.data ?? []) as Array<{ id: string; title: string | null; org_name: string | null; researcher_name: string | null }>).map((seed) => ({
      id: String(seed.id),
      title: seed.title ?? "（題名なし）",
      orgName: seed.org_name ?? null,
      researcherName: seed.researcher_name ?? null,
    })),
    signals: ((signalsRes.data ?? []) as Array<{ signal_id: string; signal_date: string | null; title: string | null; summary: string | null }>).map((signal) => ({
      id: String(signal.signal_id),
      date: signal.signal_date ?? null,
      title: signal.title ?? "（題名なし）",
      summary: signal.summary ?? null,
    })),
  };
}

/** 同じPJへ同時に来た読み込みは1本へ束ねる（single-flight、spec 5-10）。 */
const inflight = new Map<string, Promise<ProjectOverviewPayload | null>>();

async function cachedOverview(db: Db, projectId: string, force = false): Promise<ProjectOverviewPayload | null> {
  const cached = cache.get(projectId);
  if (!force && cached && nowMs() - cached.storedAt < CACHE_TTL_MS) return cached.overview;
  const pending = !force ? inflight.get(projectId) : undefined;
  if (pending) return pending;
  const request = loadOverview(db, projectId)
    .then((overview) => {
      if (overview) cache.set(projectId, { storedAt: nowMs(), overview });
      else cache.delete(projectId);
      return overview;
    })
    .finally(() => {
      if (inflight.get(projectId) === request) inflight.delete(projectId);
    });
  inflight.set(projectId, request);
  return request;
}

/** GET /api/project/{projectId}/overview */
export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const db = createAdminClient();
  try {
    const [overview, canEdit] = await Promise.all([cachedOverview(db, projectId), viewerIsAdmin(db, auth.user.email)]);
    if (!overview) return NextResponse.json({ ok: false, error: "PJが見つからない" }, { status: 404 });
    const body: ProjectOverviewResponse = { ok: true, overview, viewer: { canEdit } };
    return NextResponse.json(body, { headers: HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "PJ概要を読み込めない" }, { status: 500 });
  }
}

/** PATCH /api/project/{projectId}/overview  body: { definition: { involvementNote, revenueStreams, counterpartContacts } } */
export async function PATCH(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = (await req.json().catch(() => null)) as { definition?: Record<string, unknown> } | null;
  const input = body?.definition;
  if (!input || typeof input !== "object") {
    return NextResponse.json({ ok: false, error: "definition required" }, { status: 400 });
  }
  const row = {
    involvement_note: textOrNull(input.involvementNote, 600),
    revenue_streams: normalizeRevenueStreams(input.revenueStreams)
      .map((stream) => ({ kind: stream.kind, note: stream.note.slice(0, 300) }))
      .slice(0, 12),
    counterpart_contacts: textOrNull(input.counterpartContacts, 600),
    updated_by_email: auth.user.email,
    updated_at: new Date().toISOString(),
  };

  const db = createAdminClient();
  const { data: existing, error: readError } = await db
    .from("project_definitions")
    .select("project_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (readError) return NextResponse.json({ ok: false, error: "PJの定義を保存できない" }, { status: 500 });
  const { error } = existing
    ? await db.from("project_definitions").update(row).eq("project_id", projectId)
    : await db.from("project_definitions").insert({ project_id: projectId, created_by_email: auth.user.email, ...row });
  if (error) return NextResponse.json({ ok: false, error: `PJの定義を保存できない: ${error.message}` }, { status: 500 });

  try {
    const overview = await cachedOverview(db, projectId, true);
    if (!overview) return NextResponse.json({ ok: false, error: "PJが見つからない" }, { status: 404 });
    const response: ProjectOverviewResponse = { ok: true, overview, viewer: { canEdit: true } };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ok: false, error: "保存したが、読み直せない" }, { status: 500 });
  }
}
