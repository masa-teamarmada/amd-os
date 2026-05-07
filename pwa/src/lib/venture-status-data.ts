/**
 * Cockpit の PJ Status セクション用データアクセス層 (client-side)。
 *
 * - `project_ventures`: PJ の SU メタ (lane / founded_at / outcome_pattern / display_name 等)
 * - `project_xrl_log`: TRL/BRL/HRL 時系列
 * - `project_events`: AMD スコア / 沿革を駆動する汎用イベント (採用 / 調達 / 契約 / etc)
 *
 * 単位ルール: SU は「PJ」と数える。「ventures」「社」表記は禁止。
 *           詳細は AGENTS.common.md「単位ルール: SU は『PJ』と数える」
 */

import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type { LaneId, OutcomePattern } from "@/lib/venture-map-data";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
);

function getAuthClient() {
  return createBrowserSupabase();
}

// ============================================================
// 型定義
// ============================================================

export interface ProjectVentureRow {
  project_id: string;
  display_name: string;
  short_label: string | null;
  lane: LaneId;
  founded_at: string | null;
  outcome_pattern: OutcomePattern | "tbd" | "planning" | "stalled";
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  short_description: string | null;
  long_description: string | null;
  amd_support_started_at: string | null;
  amd_support_ended_at: string | null;
  is_public: boolean;
  narrative_text: string | null;
  narrative_generated_at: string | null;
  narrative_invalidated_at: string | null;
}

export type MemberKind = "amd_internal" | "su_internal" | "support_org";

export interface ProjectVentureMember {
  id: string;
  project_id: string;
  full_name: string;
  role: string;
  member_kind: MemberKind;
  amd_member_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  note: string | null;
}

export interface AmdMemberLite {
  member_id: string;        // 'ID001' (内部 ID、DB 保存用)
  code_name: string;        // 'まさ' / 'きよ' 等 (表示用コードネーム)
}

/** その PJ にアサインされている AMD 社員のコードネームを取得 (project_members → members JOIN) */
export async function fetchAssignedAmdMembers(projectId: string): Promise<AmdMemberLite[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select("member_id, is_active, members(code_name)")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("member_id", { ascending: true });
  if (error) {
    console.error("[fetchAssignedAmdMembers]", error);
    return [];
  }
  return ((data as Array<{ member_id: string; members: { code_name: string | null } | { code_name: string | null }[] | null }> | null) ?? [])
    .map((r) => {
      const m = Array.isArray(r.members) ? r.members[0] : r.members;
      return { member_id: r.member_id, code_name: m?.code_name ?? r.member_id };
    });
}

/** 全 AMD 社員のコードネーム lookup (member_id → code_name 表示用)。アサインに関係なく既存メンバー row を表示するときに使う。 */
export async function fetchAllAmdCodeNames(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("members").select("member_id, code_name");
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const r of data as { member_id: string; code_name: string | null }[]) {
    map[r.member_id] = r.code_name ?? r.member_id;
  }
  return map;
}

export type PartnerType = "collab" | "customer";

export interface ProjectPartner {
  id: string;
  project_id: string;
  partner_name: string;
  partner_type: PartnerType;
  partner_role: string | null;             // collab 用
  sales_target_date: string | null;        // customer 用
  remaining_conditions: string | null;     // customer 用
  is_sold: boolean;                        // customer 用
  sales_actuals: Record<string, unknown>;  // customer 用
  notes: string | null;
}

export interface ProjectPlMonthly {
  id: string;
  project_id: string;
  ym: string;
  revenue_yen: number;
  cogs_yen: number;
  personnel_yen: number;
  rd_yen: number;
  marketing_yen: number;
  other_opex_yen: number;
  notes: string | null;
}

export interface ProjectXrlRow {
  id: string;
  project_id: string;
  observed_at: string;
  trl: number | null;
  brl: number | null;
  grl: number | null;       // Governance Readiness Level (014 migration)
  srl: number | null;       // Social Readiness Level (014 migration)
  hrl: number | null;
  bottleneck: string | null;
  milestone_label: string | null;
  source_note: string | null;
  source: string;
}

export type ProjectEventKind =
  | "hire"
  | "funding"
  | "deal"
  | "tech_progress"
  | "governance"
  | "note"
  | "xrl_obs"
  | "amd_score_override";

export interface ProjectEventRow {
  id: string;
  project_id: string;
  occurred_on: string;
  kind: ProjectEventKind;
  label: string;
  meta: Record<string, unknown>;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VentureStatusBundle {
  venture: ProjectVentureRow | null;
  xrlLog: ProjectXrlRow[];
  events: ProjectEventRow[];
}

// ============================================================
// 取得
// ============================================================

const VENTURE_COLUMNS =
  "project_id, display_name, short_label, lane, founded_at, outcome_pattern, origin_org, origin_pi, amd_role, short_description, long_description, amd_support_started_at, amd_support_ended_at, is_public, narrative_text, narrative_generated_at, narrative_invalidated_at";

export async function fetchVentureStatus(projectId: string): Promise<VentureStatusBundle> {
  const [ventureRes, xrlRes, eventRes] = await Promise.all([
    supabase.from("project_ventures").select(VENTURE_COLUMNS).eq("project_id", projectId).maybeSingle(),
    supabase
      .from("project_xrl_log")
      .select("id, project_id, observed_at, trl, brl, grl, srl, hrl, bottleneck, milestone_label, source_note, source")
      .eq("project_id", projectId)
      .order("observed_at", { ascending: true }),
    supabase
      .from("project_events")
      .select("id, project_id, occurred_on, kind, label, meta, source, created_by, created_at, updated_at")
      .eq("project_id", projectId)
      .order("occurred_on", { ascending: true }),
  ]);

  if (ventureRes.error) console.error("[fetchVentureStatus] venture", ventureRes.error);
  if (xrlRes.error) console.error("[fetchVentureStatus] xrl", xrlRes.error);
  if (eventRes.error) console.error("[fetchVentureStatus] events", eventRes.error);

  return {
    venture: (ventureRes.data as ProjectVentureRow | null) ?? null,
    xrlLog: (xrlRes.data as ProjectXrlRow[] | null) ?? [],
    events: (eventRes.data as ProjectEventRow[] | null) ?? [],
  };
}

// ---- members --------------------------------------------------

const MEMBER_COLUMNS = "id, project_id, full_name, role, member_kind, amd_member_id, started_at, ended_at, note";

export async function fetchVentureMembers(projectId: string): Promise<ProjectVentureMember[]> {
  const { data, error } = await supabase
    .from("project_venture_members")
    .select(MEMBER_COLUMNS)
    .eq("project_id", projectId)
    .order("started_at", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("[fetchVentureMembers]", error);
    return [];
  }
  return (data as ProjectVentureMember[]) ?? [];
}

export async function upsertVentureMember(
  projectId: string,
  input: Omit<ProjectVentureMember, "id" | "project_id"> & { id?: string }
): Promise<ProjectVentureMember | null> {
  const auth = getAuthClient();
  const payload = {
    project_id: projectId,
    full_name: input.full_name,
    role: input.role,
    member_kind: input.member_kind,
    amd_member_id: input.amd_member_id,
    started_at: input.started_at,
    ended_at: input.ended_at,
    note: input.note,
    updated_at: new Date().toISOString(),
  };
  const q = input.id
    ? auth.from("project_venture_members").update(payload).eq("id", input.id).select(MEMBER_COLUMNS).single()
    : auth.from("project_venture_members").insert(payload).select(MEMBER_COLUMNS).single();
  const { data, error } = await q;
  if (error) {
    console.error("[upsertVentureMember]", error);
    return null;
  }
  await invalidateNarrative(projectId);
  return data as ProjectVentureMember;
}

export async function deleteVentureMember(projectId: string, id: string): Promise<boolean> {
  const auth = getAuthClient();
  const { error } = await auth.from("project_venture_members").delete().eq("id", id);
  if (!error) await invalidateNarrative(projectId);
  return !error;
}

// ---- partners --------------------------------------------------

export async function fetchPartners(projectId: string): Promise<ProjectPartner[]> {
  const { data, error } = await supabase
    .from("project_partners")
    .select("id, project_id, partner_name, partner_type, partner_role, sales_target_date, remaining_conditions, is_sold, sales_actuals, notes")
    .eq("project_id", projectId)
    .order("partner_type", { ascending: true });
  if (error) {
    console.error("[fetchPartners]", error);
    return [];
  }
  return (data as ProjectPartner[]) ?? [];
}

export async function upsertPartner(
  projectId: string,
  input: Omit<ProjectPartner, "id" | "project_id"> & { id?: string }
): Promise<ProjectPartner | null> {
  const auth = getAuthClient();
  const payload = {
    project_id: projectId,
    partner_name: input.partner_name,
    partner_type: input.partner_type,
    partner_role: input.partner_role,
    sales_target_date: input.sales_target_date,
    remaining_conditions: input.remaining_conditions,
    is_sold: input.is_sold,
    sales_actuals: input.sales_actuals ?? {},
    notes: input.notes,
    updated_at: new Date().toISOString(),
  };
  const q = input.id
    ? auth.from("project_partners").update(payload).eq("id", input.id).select().single()
    : auth.from("project_partners").insert(payload).select().single();
  const { data, error } = await q;
  if (error) {
    console.error("[upsertPartner]", error);
    return null;
  }
  await invalidateNarrative(projectId);
  return data as ProjectPartner;
}

export async function deletePartner(projectId: string, id: string): Promise<boolean> {
  const auth = getAuthClient();
  const { error } = await auth.from("project_partners").delete().eq("id", id);
  if (!error) await invalidateNarrative(projectId);
  return !error;
}

// ---- monthly P&L --------------------------------------------------

export async function fetchPlMonthly(projectId: string): Promise<ProjectPlMonthly[]> {
  const { data, error } = await supabase
    .from("project_pl_monthly")
    .select("id, project_id, ym, revenue_yen, cogs_yen, personnel_yen, rd_yen, marketing_yen, other_opex_yen, notes")
    .eq("project_id", projectId)
    .order("ym", { ascending: true });
  if (error) {
    console.error("[fetchPlMonthly]", error);
    return [];
  }
  return (data as ProjectPlMonthly[]) ?? [];
}

export async function upsertPlMonthly(
  projectId: string,
  input: Omit<ProjectPlMonthly, "id" | "project_id"> & { id?: string }
): Promise<ProjectPlMonthly | null> {
  const auth = getAuthClient();
  const payload = {
    project_id: projectId,
    ym: input.ym,
    revenue_yen: input.revenue_yen,
    cogs_yen: input.cogs_yen,
    personnel_yen: input.personnel_yen,
    rd_yen: input.rd_yen,
    marketing_yen: input.marketing_yen,
    other_opex_yen: input.other_opex_yen,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  };
  // ym で UNIQUE 制約あり → onConflict 指定の upsert
  const { data, error } = await auth
    .from("project_pl_monthly")
    .upsert(payload, { onConflict: "project_id,ym" })
    .select()
    .single();
  if (error) {
    console.error("[upsertPlMonthly]", error);
    return null;
  }
  return data as ProjectPlMonthly;
}

export async function deletePlMonthly(projectId: string, id: string): Promise<boolean> {
  const auth = getAuthClient();
  const { error } = await auth.from("project_pl_monthly").delete().eq("id", id);
  if (error) console.error("[deletePlMonthly]", error);
  return !error;
}

// ---- helpers --------------------------------------------------

async function invalidateNarrative(projectId: string) {
  const auth = getAuthClient();
  await auth
    .from("project_ventures")
    .update({ narrative_invalidated_at: new Date().toISOString() })
    .eq("project_id", projectId);
}

// ---- description merge (つくよみ) -----------------------------

export async function mergeDescriptionWithLLM(input: {
  projectId: string;
  addition: string;
}): Promise<{ long_description: string; short_description: string } | null> {
  try {
    const res = await fetch(`/api/project-ventures/${input.projectId}/description-merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addition: input.addition }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("[mergeDescriptionWithLLM]", e);
    return null;
  }
}

// ---- narrative feedback ---------------------------------------

export interface NarrativeFeedback {
  id: string;
  project_id: string;
  item_date: string | null;
  item_title: string | null;
  feedback: string;
  status: "open" | "applied";
  applied_note: string | null;
  created_at: string;
  applied_at: string | null;
}

export async function submitNarrativeFeedback(
  projectId: string,
  input: { item_date: string | null; item_title: string | null; feedback: string }
): Promise<NarrativeFeedback | null> {
  const auth = getAuthClient();
  const { data, error } = await auth
    .from("narrative_feedbacks")
    .insert({
      project_id: projectId,
      item_date: input.item_date,
      item_title: input.item_title,
      feedback: input.feedback,
    })
    .select()
    .single();
  if (error) {
    console.error("[submitNarrativeFeedback]", error);
    return null;
  }
  await invalidateNarrative(projectId);
  return data as NarrativeFeedback;
}

/** XRL 観測ドットへの修正依頼を投げる */
export async function submitXrlFeedback(
  projectId: string,
  input: { xrl_log_id: string; axis?: "TRL" | "BRL" | "HRL" | null; feedback: string }
): Promise<{ id: string } | null> {
  const auth = getAuthClient();
  const { data, error } = await auth
    .from("xrl_feedbacks")
    .insert({
      project_id: projectId,
      xrl_log_id: input.xrl_log_id,
      axis: input.axis ?? null,
      feedback: input.feedback,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[submitXrlFeedback]", error);
    return null;
  }
  await invalidateNarrative(projectId);
  return data as { id: string };
}

/** その PJ の沿革を即時再生成 (修正依頼の反映用)。フォアグラウンドで叩く。 */
export async function regenerateNarrativeNow(
  projectId: string
): Promise<{ ok: boolean; count: number; lessons: number } | null> {
  try {
    const res = await fetch(`/api/project-ventures/${projectId}/narrative-regen`, {
      method: "POST",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return { ok: !!json.ok, count: json.count ?? 0, lessons: json.lessons ?? 0 };
  } catch (e) {
    console.error("[regenerateNarrativeNow]", e);
    return null;
  }
}

// ---- PL hearing (試算表ヒアリング) -----------------------------

export interface PlHearingTurnResponse {
  done: boolean;
  question?: string;             // 次の質問 (done=false)
  monthly?: Array<{
    ym: string;
    revenue_yen: number;
    cogs_yen: number;
    personnel_yen: number;
    rd_yen: number;
    marketing_yen: number;
    other_opex_yen: number;
    notes: string;
  }>;                           // 完了時 (done=true) に生成された月次 PL
  summary?: string;
}

export async function plHearingTurn(
  projectId: string,
  history: { q: string; a: string }[],
  newAnswer?: string
): Promise<PlHearingTurnResponse | null> {
  try {
    const res = await fetch(`/api/project-ventures/${projectId}/pl-hearing/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history, new_answer: newAnswer }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("[plHearingTurn]", e);
    return null;
  }
}

// ============================================================
// 書き込み (event の add / update / delete)
// ============================================================

export interface EventInput {
  occurred_on: string; // YYYY-MM-DD
  kind: ProjectEventKind;
  label: string;
  meta?: Record<string, unknown>;
}

export async function insertProjectEvent(
  projectId: string,
  input: EventInput
): Promise<ProjectEventRow | null> {
  const auth = getAuthClient();
  const { data, error } = await auth
    .from("project_events")
    .insert({
      project_id: projectId,
      occurred_on: input.occurred_on,
      kind: input.kind,
      label: input.label,
      meta: input.meta ?? {},
      source: "manual",
    })
    .select()
    .single();
  if (error) {
    console.error("[insertProjectEvent]", error);
    return null;
  }
  return data as ProjectEventRow;
}

export async function updateProjectEvent(
  eventId: string,
  patch: Partial<EventInput>
): Promise<ProjectEventRow | null> {
  const auth = getAuthClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.occurred_on !== undefined) update.occurred_on = patch.occurred_on;
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.meta !== undefined) update.meta = patch.meta;
  const { data, error } = await auth
    .from("project_events")
    .update(update)
    .eq("id", eventId)
    .select()
    .single();
  if (error) {
    console.error("[updateProjectEvent]", error);
    return null;
  }
  return data as ProjectEventRow;
}

export async function deleteProjectEvent(eventId: string): Promise<boolean> {
  const auth = getAuthClient();
  const { error } = await auth.from("project_events").delete().eq("id", eventId);
  if (error) {
    console.error("[deleteProjectEvent]", error);
    return false;
  }
  return true;
}

// ============================================================
// project_ventures メタ更新 (lane / founded_at / outcome / origin 等)
// ============================================================

export interface VentureMetaPatch {
  display_name?: string;
  short_label?: string | null;
  lane?: LaneId;
  founded_at?: string | null;
  outcome_pattern?: OutcomePattern | "tbd" | "planning" | "stalled";
  origin_org?: string | null;
  origin_pi?: string | null;
  amd_role?: string | null;
  amd_support_started_at?: string | null;
  amd_support_ended_at?: string | null;
  short_description?: string | null;
  long_description?: string | null;
}

export async function updateProjectVenture(
  projectId: string,
  patch: VentureMetaPatch
): Promise<ProjectVentureRow | null> {
  const auth = getAuthClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of Object.keys(patch) as (keyof VentureMetaPatch)[]) {
    update[k] = patch[k] as unknown;
  }
  const { data, error } = await auth
    .from("project_ventures")
    .update(update)
    .eq("project_id", projectId)
    .select()
    .single();
  if (error) {
    console.error("[updateProjectVenture]", error);
    return null;
  }
  // メタ更新で沿革も古くなる
  await auth
    .from("project_ventures")
    .update({ narrative_invalidated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  return data as ProjectVentureRow;
}

// ============================================================
// LLM 呼び出し API ラッパ (server side で Gemini 走らせる)
// ============================================================

export async function parseEventTextWithLLM(input: {
  kind: ProjectEventKind;
  label: string;
  raw_text: string;
}): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("/api/project-events/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.meta ?? null;
  } catch (e) {
    console.error("[parseEventTextWithLLM]", e);
    return null;
  }
}

export async function confirmXrlObservation(
  observationId: string,
  action: "confirm" | "reject"
): Promise<boolean> {
  const auth = getAuthClient();
  if (action === "reject") {
    const { error } = await auth.from("project_xrl_log").delete().eq("id", observationId);
    return !error;
  }
  const { error } = await auth
    .from("project_xrl_log")
    .update({ source: "pm_confirmed" })
    .eq("id", observationId);
  return !error;
}

// ============================================================
// AMD スコアは Before Zero Theory v3.2 (7 軸 Cobb-Douglas) に移行済。
//
// 新ロジックは:
//   - 軸定義 / 計算: src/lib/amd-score.ts
//   - データアクセス: src/lib/amd-score-data.ts (amd_score_inputs / amd_score_alpha)
//   - cockpit 用時系列ヘルパー: computeCockpitAmdScoreSeries() 以下
// ============================================================

export interface AmdScorePoint {
  date: string;     // YYYY-MM-DD
  score: number;    // log scale (1 - 100,000)
}

import { calculateAmdScore, type AlphaWeights } from "@/lib/amd-score";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";

/** amd_score_inputs (古い順) と alpha から、cockpit チャート用の時系列を作る */
export function computeCockpitAmdScoreSeries(
  inputs: AmdScoreInputRow[],
  alpha: AlphaWeights
): AmdScorePoint[] {
  return inputs
    .filter((r) => r.mu_A != null && r.mu_I != null && r.mu_G != null)
    .map((r) => {
      const result = calculateAmdScore(
        {
          mu_A: r.mu_A ?? 0,
          mu_I: r.mu_I ?? 0,
          mu_G: r.mu_G ?? 0,
          TRL: r.shallow_tech_mode ? null : r.trl ?? 0,
          BRL: r.brl ?? 0,
          GRL: r.grl ?? 0,
          SRL: r.srl ?? 0,
          HRL: r.hrl ?? 0,
          FRL: r.frl ?? 0,
        },
        alpha
      );
      return { date: r.evaluated_at.slice(0, 10), score: result.score };
    });
}
