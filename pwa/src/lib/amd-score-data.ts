/**
 * AMD Score データアクセス層 (client-side)。
 *
 * - amd_score_inputs: PJ × 評価時点の 7 軸入力
 * - amd_score_alpha:  弾力性 α_i のバージョン管理
 *
 * 読みは anon (DEV_MODE)、書きは getAuthClient() (is_admin RLS)。
 * 仕様: pwa/scripts/migrations/013_amd_score.sql
 */

import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type { AlphaWeights } from "@/lib/amd-score";
import { ALPHA_DEFAULT, normalizeAlpha } from "@/lib/amd-score";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
);

function getAuthClient() {
  return createBrowserSupabase();
}

export interface AmdScoreInputRow {
  id: string;
  project_id: string;
  evaluated_at: string;          // ISO timestamp
  mu_A: number | null;
  mu_I: number | null;
  mu_G: number | null;
  trl: number | null;
  brl: number | null;
  grl: number | null;
  srl: number | null;
  hrl: number | null;
  frl: number | null;
  // FRL 内訳 (ALQ — Walumbwa et al. 2008)
  alq_self_awareness: number | null;
  alq_relational_transparency: number | null;
  alq_balanced_processing: number | null;
  alq_internalized_moral: number | null;
  frl_notes: string | null;
  shallow_tech_mode: boolean;
  evaluator: string | null;
  notes: string | null;
}

export interface AmdScoreAlphaRow {
  id: string;
  alpha: AlphaWeights;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

const INPUT_COLUMNS =
  "id, project_id, evaluated_at, mu_a, mu_i, mu_g, trl, brl, grl, srl, hrl, frl, alq_self_awareness, alq_relational_transparency, alq_balanced_processing, alq_internalized_moral, frl_notes, shallow_tech_mode, evaluator, notes";

type RawInputRow = {
  id: string;
  project_id: string;
  evaluated_at: string;
  mu_a: number | null;
  mu_i: number | null;
  mu_g: number | null;
  trl: number | null;
  brl: number | null;
  grl: number | null;
  srl: number | null;
  hrl: number | null;
  frl: number | null;
  alq_self_awareness: number | null;
  alq_relational_transparency: number | null;
  alq_balanced_processing: number | null;
  alq_internalized_moral: number | null;
  frl_notes: string | null;
  shallow_tech_mode: boolean;
  evaluator: string | null;
  notes: string | null;
};

function flattenInput(r: RawInputRow): AmdScoreInputRow {
  return {
    id: r.id,
    project_id: r.project_id,
    evaluated_at: r.evaluated_at,
    mu_A: r.mu_a,
    mu_I: r.mu_i,
    mu_G: r.mu_g,
    trl: r.trl,
    brl: r.brl,
    grl: r.grl,
    srl: r.srl,
    hrl: r.hrl,
    frl: r.frl,
    alq_self_awareness: r.alq_self_awareness,
    alq_relational_transparency: r.alq_relational_transparency,
    alq_balanced_processing: r.alq_balanced_processing,
    alq_internalized_moral: r.alq_internalized_moral,
    frl_notes: r.frl_notes,
    shallow_tech_mode: r.shallow_tech_mode,
    evaluator: r.evaluator,
    notes: r.notes,
  };
}

/** 全 PJ の amd_score_inputs を時系列で取得 */
export async function fetchAllAmdScoreInputs(): Promise<AmdScoreInputRow[]> {
  const { data, error } = await supabase
    .from("amd_score_inputs")
    .select(INPUT_COLUMNS)
    .order("project_id", { ascending: true })
    .order("evaluated_at", { ascending: true });
  if (error) {
    console.error("[fetchAllAmdScoreInputs]", error);
    return [];
  }
  return (data as RawInputRow[] | null ?? []).map(flattenInput);
}

/** 1 PJ の入力時系列を取得 (古い順) */
export async function fetchAmdScoreInputs(projectId: string): Promise<AmdScoreInputRow[]> {
  const { data, error } = await supabase
    .from("amd_score_inputs")
    .select(INPUT_COLUMNS)
    .eq("project_id", projectId)
    .order("evaluated_at", { ascending: true });
  if (error) {
    console.error("[fetchAmdScoreInputs]", projectId, error);
    return [];
  }
  return (data as RawInputRow[] | null ?? []).map(flattenInput);
}

export interface AmdScoreInputUpsert {
  id?: string;
  project_id: string;
  evaluated_at: string;
  mu_A: number | null;
  mu_I: number | null;
  mu_G: number | null;
  trl: number | null;
  brl: number | null;
  grl: number | null;
  srl: number | null;
  hrl: number | null;
  frl: number | null;
  alq_self_awareness?: number | null;
  alq_relational_transparency?: number | null;
  alq_balanced_processing?: number | null;
  alq_internalized_moral?: number | null;
  frl_notes?: string | null;
  shallow_tech_mode: boolean;
  evaluator?: string | null;
  notes?: string | null;
}

/** 評価時点を 1 行 upsert (UNIQUE(project_id, evaluated_at) で衝突したら update) */
export async function upsertAmdScoreInput(
  input: AmdScoreInputUpsert
): Promise<AmdScoreInputRow | null> {
  const auth = getAuthClient();
  const payload = {
    project_id: input.project_id,
    evaluated_at: input.evaluated_at,
    mu_a: input.mu_A,
    mu_i: input.mu_I,
    mu_g: input.mu_G,
    trl: input.trl,
    brl: input.brl,
    grl: input.grl,
    srl: input.srl,
    hrl: input.hrl,
    frl: input.frl,
    alq_self_awareness: input.alq_self_awareness ?? null,
    alq_relational_transparency: input.alq_relational_transparency ?? null,
    alq_balanced_processing: input.alq_balanced_processing ?? null,
    alq_internalized_moral: input.alq_internalized_moral ?? null,
    frl_notes: input.frl_notes ?? null,
    shallow_tech_mode: input.shallow_tech_mode,
    evaluator: input.evaluator ?? null,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await auth
    .from("amd_score_inputs")
    .upsert(payload, { onConflict: "project_id,evaluated_at" })
    .select(INPUT_COLUMNS)
    .single();
  if (error) {
    console.error("[upsertAmdScoreInput]", error);
    return null;
  }
  return flattenInput(data as RawInputRow);
}

export async function deleteAmdScoreInput(id: string): Promise<boolean> {
  const auth = getAuthClient();
  const { error } = await auth.from("amd_score_inputs").delete().eq("id", id);
  if (error) {
    console.error("[deleteAmdScoreInput]", error);
    return false;
  }
  return true;
}

// ============================================================
// alpha (弾力性 α_i) のバージョン管理
// ============================================================

const ALPHA_COLUMNS = "id, alpha, effective_from, effective_to, notes";

/** 現役 (effective_to IS NULL) の alpha を取得。なければ ALPHA_DEFAULT */
export async function fetchActiveAlpha(): Promise<{ alpha: AlphaWeights; row: AmdScoreAlphaRow | null }> {
  const { data, error } = await supabase
    .from("amd_score_alpha")
    .select(ALPHA_COLUMNS)
    .is("effective_to", null)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[fetchActiveAlpha]", error);
    return { alpha: ALPHA_DEFAULT, row: null };
  }
  if (!data) return { alpha: ALPHA_DEFAULT, row: null };
  const raw = data as { id: string; alpha: unknown; effective_from: string; effective_to: string | null; notes: string | null };
  const alpha = normalizeAlpha(raw.alpha);
  return {
    alpha,
    row: { id: raw.id, alpha, effective_from: raw.effective_from, effective_to: raw.effective_to, notes: raw.notes },
  };
}

export async function fetchAlphaHistory(): Promise<AmdScoreAlphaRow[]> {
  const { data, error } = await supabase
    .from("amd_score_alpha")
    .select(ALPHA_COLUMNS)
    .order("effective_from", { ascending: false });
  if (error) {
    console.error("[fetchAlphaHistory]", error);
    return [];
  }
  return (data as Array<{ id: string; alpha: unknown; effective_from: string; effective_to: string | null; notes: string | null }> | null ?? []).map((r) => ({
    id: r.id,
    alpha: normalizeAlpha(r.alpha),
    effective_from: r.effective_from,
    effective_to: r.effective_to,
    notes: r.notes,
  }));
}

/** 新しい alpha を保存。前版の effective_to を now で閉じ、新版を effective_to=null で挿入。 */
export async function saveNewAlpha(alpha: AlphaWeights, notes?: string): Promise<AmdScoreAlphaRow | null> {
  const auth = getAuthClient();
  const now = new Date().toISOString();

  const { error: closeErr } = await auth
    .from("amd_score_alpha")
    .update({ effective_to: now })
    .is("effective_to", null);
  if (closeErr) {
    console.error("[saveNewAlpha:close prev]", closeErr);
    return null;
  }

  const { data, error } = await auth
    .from("amd_score_alpha")
    .insert({ alpha, effective_from: now, effective_to: null, notes: notes ?? null })
    .select(ALPHA_COLUMNS)
    .single();
  if (error) {
    console.error("[saveNewAlpha:insert]", error);
    return null;
  }
  const raw = data as { id: string; alpha: unknown; effective_from: string; effective_to: string | null; notes: string | null };
  return {
    id: raw.id,
    alpha: normalizeAlpha(raw.alpha),
    effective_from: raw.effective_from,
    effective_to: raw.effective_to,
    notes: raw.notes,
  };
}
