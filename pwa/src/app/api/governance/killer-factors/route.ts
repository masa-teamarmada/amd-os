import { NextRequest, NextResponse } from "next/server";
import {
  isKillerFactorOperatingMode,
  isKillerFactorStatus,
  isKillerFactorStatusAllowed,
  summarizeKillerFactorRisk,
  type KillerFactorOperatingMode,
  type KillerFactorStatus,
} from "@/lib/killer-factor-risk";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

type CreateFactorBody = {
  action: "create_factor";
  operatingMode?: unknown;
  factorType?: unknown;
  eventDescription?: unknown;
  observationClues?: unknown;
  preventiveAction?: unknown;
  timingGuidance?: unknown;
};

type UpdateStateBody = {
  action: "update_state";
  projectId?: unknown;
  killerFactorId?: unknown;
  status?: unknown;
  statusOn?: unknown;
  targetOn?: unknown;
  evidenceNote?: unknown;
};

type MarkOccurredBody = {
  action: "mark_occurred";
  projectId?: unknown;
  killerFactorId?: unknown;
  occurredOn?: unknown;
  evidenceNote?: unknown;
};

type RequestBody = CreateFactorBody | UpdateStateBody | MarkOccurredBody;

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
      .select("killer_factor_id,operating_mode,factor_type,event_description,observation_clues,preventive_action,timing_guidance,sort_order,created_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("project_killer_factor_states")
      .select("state_id,killer_factor_id,status,status_on,target_on,occurred_on,evidence_note,recorded_by_member_id,recorded_at,updated_at")
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
    const operatingMode = isKillerFactorOperatingMode(factor.operating_mode)
      ? factor.operating_mode
      : "monitoring";
    const state = stateByFactor.get(factor.killer_factor_id);
    const rawStatus = typeof state?.status === "string" ? state.status : "unchecked";
    const status = isKillerFactorStatus(rawStatus) && isKillerFactorStatusAllowed(operatingMode, rawStatus)
      ? rawStatus
      : "unchecked";
    return {
      killerFactorId: factor.killer_factor_id,
      operatingMode,
      factorType: factor.factor_type,
      eventDescription: factor.event_description,
      observationClues: factor.observation_clues,
      preventiveAction: factor.preventive_action ?? null,
      timingGuidance: factor.timing_guidance ?? null,
      status,
      statusOn: state?.status_on ?? state?.occurred_on ?? null,
      targetOn: state?.target_on ?? null,
      evidenceNote: state?.evidence_note ?? null,
      recordedByMemberId: state?.recorded_by_member_id ?? null,
      recordedByLabel: state?.recorded_by_member_id
        ? actorLabels.get(state.recorded_by_member_id) ?? state.recorded_by_member_id
        : null,
      recordedAt: state?.recorded_at ?? null,
    };
  });

  const summary = summarizeKillerFactorRisk(items);
  return NextResponse.json({ ok: true, projectId, summary, items });
}

/** POST: 共通要素の追加 / PJ別の監視・予防統制状態の更新 */
export async function POST(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null) as RequestBody | null;
  if (!body?.action) return badRequest("action required");

  const db = createAdminClient();
  let actor: { member_id: string; code_name: string };
  try {
    actor = await memberForEmail(db, auth.user.email);
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : "記録者を確認できなかったよ" }, { status: 500 });
  }

  if (body.action === "create_factor") {
    const operatingMode = textValue(body.operatingMode, 32);
    const factorType = textValue(body.factorType, 80);
    const eventDescription = textValue(body.eventDescription, 300);
    const observationClues = textValue(body.observationClues, 1200);
    const preventiveAction = textValue(body.preventiveAction, 1200);
    const timingGuidance = textValue(body.timingGuidance, 300);
    if (!isKillerFactorOperatingMode(operatingMode) || !factorType || !eventDescription || !observationClues) {
      return badRequest("方式 / 型 / 事象 / 確認根拠 required");
    }
    if (operatingMode === "prevention" && (!preventiveAction || !timingGuidance)) {
      return badRequest("予防統制は AMDの打ち手 / 完了時機 required");
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
        operating_mode: operatingMode,
        factor_type: factorType,
        event_description: eventDescription,
        observation_clues: observationClues,
        preventive_action: operatingMode === "prevention" ? preventiveAction : null,
        timing_guidance: operatingMode === "prevention" ? timingGuidance : null,
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

  if (body.action === "update_state" || body.action === "mark_occurred") {
    const projectId = textValue(body.projectId, 64);
    const killerFactorId = textValue(body.killerFactorId, 64);
    if (!projectId || !killerFactorId) return badRequest("projectId / killerFactorId required");

    const { data: factor, error: factorError } = await db
      .from("killer_factor_catalog")
      .select("operating_mode")
      .eq("killer_factor_id", killerFactorId)
      .eq("is_active", true)
      .maybeSingle();
    if (factorError) return badRequest(factorError.message);
    if (!factor || !isKillerFactorOperatingMode(factor.operating_mode)) return badRequest("キラー要素が見つからなかったよ");
    const operatingMode: KillerFactorOperatingMode = factor.operating_mode;

    let status: KillerFactorStatus;
    let statusOn: string;
    let targetOn: string | null;
    let evidenceNote: string;

    if (body.action === "mark_occurred") {
      status = operatingMode === "prevention" ? "breached" : "occurred";
      statusOn = textValue(body.occurredOn, 10);
      targetOn = null;
      evidenceNote = textValue(body.evidenceNote, 2000);
    } else {
      const rawStatus = textValue(body.status, 32);
      if (!isKillerFactorStatus(rawStatus) || rawStatus === "unchecked") return badRequest("status required");
      status = rawStatus;
      statusOn = textValue(body.statusOn, 10);
      const rawTargetOn = textValue(body.targetOn, 10);
      targetOn = rawTargetOn || null;
      evidenceNote = textValue(body.evidenceNote, 2000);
    }

    if (!isKillerFactorStatusAllowed(operatingMode, status)) {
      return badRequest("この方式では選べない状態だよ");
    }
    if (!isIsoDate(statusOn) || !evidenceNote || (targetOn && !isIsoDate(targetOn))) {
      return badRequest("状態日 / 根拠メモ / 目標日を確認してね");
    }

    const now = new Date().toISOString();
    const occurredOn = status === "occurred" || status === "breached" ? statusOn : null;
    const { data, error } = await db
      .from("project_killer_factor_states")
      .upsert({
        project_id: projectId,
        killer_factor_id: killerFactorId,
        status,
        status_on: statusOn,
        target_on: operatingMode === "prevention" ? targetOn : null,
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
