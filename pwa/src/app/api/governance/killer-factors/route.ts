import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

type CreateFactorBody = {
  action?: "create_factor";
  factorType?: unknown;
  eventDescription?: unknown;
  observationClues?: unknown;
};

type MarkOccurredBody = {
  action?: "mark_occurred";
  projectId?: unknown;
  killerFactorId?: unknown;
  occurredOn?: unknown;
  evidenceNote?: unknown;
};

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function textValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

async function memberForEmail(db: ReturnType<typeof createAdminClient>, email: string) {
  const { data, error } = await db
    .from("members")
    .select("member_id,code_name")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("AMDメンバー情報を確認できなかったよ");
  return data as { member_id: string; code_name: string };
}

/** GET /api/governance/killer-factors?projectId=p21 */
export async function GET(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const projectId = textValue(req.nextUrl.searchParams.get("projectId"), 64);
  if (!projectId) return badRequest("projectId required");

  const db = createAdminClient();
  const [projectRes, factorsRes, statesRes] = await Promise.all([
    db.from("projects").select("project_id").eq("project_id", projectId).maybeSingle(),
    db
      .from("killer_factor_catalog")
      .select("killer_factor_id,factor_type,event_description,observation_clues,sort_order,created_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("project_killer_factor_states")
      .select("state_id,killer_factor_id,status,occurred_on,evidence_note,recorded_by_member_id,recorded_at,updated_at")
      .eq("project_id", projectId),
  ]);

  const firstError = [projectRes, factorsRes, statesRes].map((result) => result.error).find(Boolean);
  if (firstError) return NextResponse.json({ ok: false, error: firstError.message }, { status: 500 });
  if (!projectRes.data) return NextResponse.json({ ok: false, error: "PJが見つからなかったよ" }, { status: 404 });

  const actorIds = [...new Set((statesRes.data ?? [])
    .map((state) => state.recorded_by_member_id)
    .filter((value): value is string => Boolean(value)))];
  const actorsRes = actorIds.length
    ? await db.from("members").select("member_id,code_name").in("member_id", actorIds)
    : { data: [], error: null };
  if (actorsRes.error) return NextResponse.json({ ok: false, error: actorsRes.error.message }, { status: 500 });

  const actorLabels = new Map((actorsRes.data ?? []).map((member) => [member.member_id, member.code_name]));
  const stateByFactor = new Map((statesRes.data ?? []).map((state) => [state.killer_factor_id, state]));
  const items = (factorsRes.data ?? []).map((factor) => {
    const state = stateByFactor.get(factor.killer_factor_id);
    return {
      killerFactorId: factor.killer_factor_id,
      factorType: factor.factor_type,
      eventDescription: factor.event_description,
      observationClues: factor.observation_clues,
      status: state?.status === "occurred" ? "occurred" : "not_occurred",
      occurredOn: state?.occurred_on ?? null,
      evidenceNote: state?.evidence_note ?? null,
      recordedByMemberId: state?.recorded_by_member_id ?? null,
      recordedByLabel: state?.recorded_by_member_id
        ? actorLabels.get(state.recorded_by_member_id) ?? state.recorded_by_member_id
        : null,
      recordedAt: state?.recorded_at ?? null,
    };
  });

  return NextResponse.json({ ok: true, projectId, items });
}

/** POST: 共通要素の追加 / この PJ での発生記録 */
export async function POST(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null) as (CreateFactorBody | MarkOccurredBody) | null;
  if (!body?.action) return badRequest("action required");

  const db = createAdminClient();
  let actor: { member_id: string; code_name: string };
  try {
    actor = await memberForEmail(db, auth.user.email);
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : "記録者を確認できなかったよ" }, { status: 500 });
  }

  if (body.action === "create_factor") {
    const factorType = textValue(body.factorType, 80);
    const eventDescription = textValue(body.eventDescription, 300);
    const observationClues = textValue(body.observationClues, 1200);
    if (!factorType || !eventDescription || !observationClues) {
      return badRequest("型 / 事象 / 観測の手がかり required");
    }

    const { data: lastFactor, error: orderError } = await db
      .from("killer_factor_catalog")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) return NextResponse.json({ ok: false, error: orderError.message }, { status: 500 });

    const { data, error } = await db
      .from("killer_factor_catalog")
      .insert({
        factor_type: factorType,
        event_description: eventDescription,
        observation_clues: observationClues,
        sort_order: Number(lastFactor?.sort_order ?? 0) + 10,
        created_by_member_id: actor.member_id,
      })
      .select("killer_factor_id")
      .single();
    if (error) {
      const message = error.code === "23505" ? "同じ型と事象の要素がすでにあるよ" : error.message;
      return badRequest(message);
    }
    return NextResponse.json({ ok: true, killerFactorId: data.killer_factor_id }, { status: 201 });
  }

  if (body.action === "mark_occurred") {
    const projectId = textValue(body.projectId, 64);
    const killerFactorId = textValue(body.killerFactorId, 64);
    const occurredOn = textValue(body.occurredOn, 10);
    const evidenceNote = textValue(body.evidenceNote, 2000);
    if (!projectId || !killerFactorId || !isIsoDate(occurredOn) || !evidenceNote) {
      return badRequest("projectId / killerFactorId / occurredOn / evidenceNote required");
    }

    const now = new Date().toISOString();
    const { data, error } = await db
      .from("project_killer_factor_states")
      .upsert({
        project_id: projectId,
        killer_factor_id: killerFactorId,
        status: "occurred",
        occurred_on: occurredOn,
        evidence_note: evidenceNote,
        recorded_by_member_id: actor.member_id,
        recorded_at: now,
        updated_at: now,
      }, { onConflict: "project_id,killer_factor_id" })
      .select("state_id")
      .single();
    if (error) return badRequest(error.message);
    return NextResponse.json({ ok: true, stateId: data.state_id });
  }

  return badRequest("unknown action");
}
