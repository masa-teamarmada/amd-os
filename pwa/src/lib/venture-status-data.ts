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
  outcome_pattern: OutcomePattern;
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  short_description: string | null;
  is_public: boolean;
  narrative_text: string | null;
  narrative_generated_at: string | null;
  narrative_invalidated_at: string | null;
}

export interface ProjectXrlRow {
  id: string;
  project_id: string;
  observed_at: string;
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  bottleneck: string | null;
  milestone_label: string | null;
  source: string;
}

export type ProjectEventKind =
  | "hire"
  | "funding"
  | "deal"
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

export async function fetchVentureStatus(projectId: string): Promise<VentureStatusBundle> {
  const [ventureRes, xrlRes, eventRes] = await Promise.all([
    supabase
      .from("project_ventures")
      .select(
        "project_id, display_name, short_label, lane, founded_at, outcome_pattern, origin_org, origin_pi, amd_role, short_description, is_public, narrative_text, narrative_generated_at, narrative_invalidated_at"
      )
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("project_xrl_log")
      .select("id, project_id, observed_at, trl, brl, hrl, bottleneck, milestone_label, source")
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
// AMD スコアのダミー計算
//
// ⚠️ 正本の AMD スコア式は Before Zero Theory v3.x で別セッションで定義中。
//    確定したらここを差し替える。現状はダミー (まさ承認済み 2026-05-06)。
//
// ダミーロジック:
//   - 設立日前: 線形に -100 → 0 (5 年前を -100、設立日で 0)
//   - 設立日以降: ((TRL+BRL+HRL)/27) * 100 を基底に、
//                 各 event を kind ごとの bonus で加算 (上限 +100)
// ============================================================

export interface AmdScorePoint {
  date: string;       // YYYY-MM-DD
  score: number;      // -100 〜 +100
}

const EVENT_BONUS: Record<ProjectEventKind, number> = {
  hire: 3,
  funding: 8,
  deal: 5,
  governance: 2,
  note: 0,
  xrl_obs: 0,
  amd_score_override: 0,
};

export function computeAmdScoreSeries(
  bundle: VentureStatusBundle,
  opts?: { dummyVersion?: string }
): AmdScorePoint[] {
  const venture = bundle.venture;
  if (!venture) return [];

  // 観測時点を集める: founded_at, xrl observations, events の occurred_on
  const dates = new Set<string>();
  if (venture.founded_at) dates.add(venture.founded_at);
  for (const r of bundle.xrlLog) dates.add(r.observed_at);
  for (const e of bundle.events) dates.add(e.occurred_on);

  // 5 年前を最古点として初期 -100 を打つ
  if (venture.founded_at) {
    const f = new Date(venture.founded_at);
    const start = new Date(f.getFullYear() - 5, f.getMonth(), 1);
    dates.add(start.toISOString().slice(0, 10));
  }

  const sortedDates = [...dates].sort();
  const founded = venture.founded_at ? new Date(venture.founded_at).getTime() : null;

  return sortedDates.map((d) => {
    const t = new Date(d).getTime();
    if (founded != null && t < founded) {
      // Before zero: 線形 -100 → 0 (5 年前 = -100)
      const earliest = new Date(sortedDates[0]).getTime();
      const range = founded - earliest;
      if (range <= 0) return { date: d, score: 0 };
      const ratio = (t - earliest) / range;
      return { date: d, score: -100 + ratio * 100 };
    }

    // After zero: XRL 累積 + event bonus 累積
    const xrlAtDate = bundle.xrlLog.filter((r) => r.observed_at <= d);
    const latestXrl = xrlAtDate[xrlAtDate.length - 1];
    const xrlSum =
      (latestXrl?.trl ?? 0) + (latestXrl?.brl ?? 0) + (latestXrl?.hrl ?? 0);
    const xrlScore = (xrlSum / 27) * 60; // XRL 部分を最大 60 点

    const eventBonus = bundle.events
      .filter((e) => e.occurred_on <= d)
      .reduce((sum, e) => sum + (EVENT_BONUS[e.kind] ?? 0), 0);

    const score = Math.min(100, xrlScore + eventBonus);
    return { date: d, score };
  });
}
