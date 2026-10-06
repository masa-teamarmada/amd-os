import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchErsBundle } from "@/lib/ers-data";
import { CURRENT_SPS_MODEL } from "@/lib/current-sps-model";
import type { SeedProjectLink } from "@/types/seeds";
import type { PortfolioPulseBand, PortfolioPulseSeed, PortfolioPulseResponse } from "@/lib/portfolio-pulse";

export const PORTFOLIO_PULSE_TTL_MS = 60_000;
let snapshot: { value: PortfolioPulseResponse; storedAt: number } | null = null;
let pending: Promise<PortfolioPulseResponse> | null = null;
let generation = 0;

async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return rows;
  }
}

/** Only the fields used by the home queues. Read links alongside seeds, without UUID .in() batches. */
async function loadSeeds(db: SupabaseClient): Promise<PortfolioPulseSeed[]> {
  const [seeds, links] = await Promise.all([
    allRows((from, to) => db.from("seeds").select("id,title,org_name,researcher_name,status").order("id").range(from, to)),
    allRows((from, to) => db.from("seed_projects").select("seed_id,project_id,projects(project_name,status,client_name)").order("seed_id").order("project_id").range(from, to)),
  ]);
  const bySeed = new Map<string, SeedProjectLink[]>();
  for (const row of links) {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    const link: SeedProjectLink = {
      project_id: row.project_id,
      project_name: project?.project_name || row.project_id,
      project_status: project?.status || "unknown",
      client_name: project?.client_name ?? null,
      commercialization_stage: null, commercialization_route: null, venture_name: null, target_market: null,
    };
    (bySeed.get(row.seed_id) ?? bySeed.set(row.seed_id, []).get(row.seed_id)!).push(link);
  }
  return seeds.map((row) => ({ ...row, project_links: bySeed.get(row.id) ?? [] }));
}

/** Preserve exact current/frozen/latest SPS semantics; evidence/detail fields aren't used here. */
async function loadBands(db: SupabaseClient): Promise<PortfolioPulseBand[]> {
  const rows = await allRows((from, to) => db.from("seed_screening_bands")
    .select("id,seed_id,sps_lower_yen,sps_upper_yen")
    .eq("measure_version", CURRENT_SPS_MODEL.measureVersion)
    .eq("ruleset_version", CURRENT_SPS_MODEL.assessmentRulesetVersion).eq("frozen", true)
    .order("assessed_at", { ascending: false }).order("id", { ascending: false }).range(from, to));
  const latest = new Map<string, PortfolioPulseBand>();
  for (const row of rows) {
    if (!latest.has(row.seed_id)) latest.set(row.seed_id, {
      seed_id: row.seed_id, assessment_id: row.id,
      sps_lower_yen: row.sps_lower_yen == null ? null : Number(row.sps_lower_yen),
      sps_upper_yen: row.sps_upper_yen == null ? null : Number(row.sps_upper_yen),
    });
  }
  return [...latest.values()];
}

async function readPulse(db: SupabaseClient): Promise<PortfolioPulseResponse> {
  const [institutions, seeds, bands] = await Promise.allSettled([fetchErsBundle(db), loadSeeds(db), loadBands(db)]);
  let institutionBundle: PortfolioPulseResponse["institutionBundle"] = null;
  if (institutions.status === "fulfilled") {
    const bundle = institutions.value;
    institutionBundle = {
      axes: bundle.axes,
      institutionProjectsByInstitution: bundle.institutionProjectsByInstitution,
      seedCountByInstitution: bundle.seedCountByInstitution,
      institutionProjectIds: bundle.institutionProjectIds,
      institutions: bundle.institutions.map((row) => ({ ...row, description: null })),
      criteria: bundle.criteria.map((row) => ({ ...row, rubric: {} })),
      assessmentsByInstitution: Object.fromEntries(Object.entries(bundle.assessmentsByInstitution)
        .map(([id, rows]) => [id, rows.map((row) => ({ ...row, note: null }))])),
    };
  }
  for (const [label, result] of [["institutions", institutions], ["seeds", seeds], ["bands", bands]] as const) {
    if (result.status === "rejected") console.error(`[portfolio-pulse] ${label} lookup failed`);
  }
  return {
    ok: true, institutionBundle, institutionError: institutions.status === "rejected",
    seeds: seeds.status === "fulfilled" ? seeds.value : null, seedsError: seeds.status === "rejected",
    screeningBands: bands.status === "fulfilled" ? bands.value : null, screeningBandsError: bands.status === "rejected",
  };
}

/** Called only after the route's portfolio authorization. Partial failures never become a cached empty catalog. */
export function loadPortfolioPulse(options?: { fresh?: boolean; db?: SupabaseClient }): Promise<PortfolioPulseResponse> {
  if (!options?.fresh && snapshot && Date.now() - snapshot.storedAt < PORTFOLIO_PULSE_TTL_MS) return Promise.resolve(snapshot.value);
  if (!options?.fresh && pending) return pending;
  const requestGeneration = ++generation;
  const request = readPulse(options?.db ?? createAdminClient()).then((value) => {
    if (requestGeneration === generation && !value.institutionError && !value.seedsError && !value.screeningBandsError) snapshot = { value, storedAt: Date.now() };
    return value;
  }).finally(() => { if (pending === request) pending = null; });
  pending = request;
  return request;
}

export function invalidatePortfolioPulseCache(): void { generation++; snapshot = null; pending = null; }
