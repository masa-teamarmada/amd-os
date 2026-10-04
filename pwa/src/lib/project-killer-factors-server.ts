import type { KillerFactorItem } from "./project-killer-factor-types";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isKillerFactorOperatingMode, isKillerFactorStatus, isKillerFactorStatusAllowed } from "./killer-factor-risk";
export async function loadProjectKillerFactors(db: SupabaseClient, projectId: string): Promise<KillerFactorItem[]> {
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
  if (firstError) throw new Error(firstError.message);
  if (!projectRes.data) throw new Error("PJが見つからなかったよ");

  const actorIds = [...new Set((statesRes.data ?? [])
    .map((state) => state.recorded_by_member_id)
    .filter((value): value is string => Boolean(value)))];
  const actorsRes = actorIds.length
    ? await db.from("members").select("member_id,code_name").in("member_id", actorIds)
    : { data: [], error: null };
  if (actorsRes.error) throw new Error(actorsRes.error.message);

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

  return items;
}
