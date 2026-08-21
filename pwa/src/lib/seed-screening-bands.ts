// 一次選別スクリーニング帯 (Tier 0) の service_role 読み取り層。
// テーブル seed_screening_bands / 参照する seed_projects・seed_contact_log・seeds は
// db_schema.md から列名をコピーする。design/seeds.md の「seed_screening_bands」節と
// pwa/bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md §6 確定13 が正本。
//
// seed_screening_bands は RLS ポリシーが一切無いテーブル (service_role 専用)。
// このファイルは "server-only" とし、API route (/api/seeds/screening-bands) からのみ呼ぶ。
// クライアントコンポーネントは types/seeds.ts の DTO 型だけを import し、この lib を直接 import しない。
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_SPS_MODEL, type CurrentSpsProjectAssessment } from "@/lib/current-sps-model";
import type {
  SeedEvidenceLevel,
  SeedScreeningBandDetail,
  SeedScreeningBandSummary,
  SeedScreeningQEvidenceItem,
} from "@/types/seeds";

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type ServiceClient = ReturnType<typeof createAdminClient>;

/**
 * 根拠Lv (スコア成熟度) を機械導出する。上位が勝つ。
 * Lv3: 現行データでは自動付与しない。verified actualと計画値を区別できる正規化証跡が必要。
 * Lv2: seed_projects に紐付け行がある
 * Lv1: seed_contact_log に1件以上、または seeds.status が contacted/discussing
 * Lv0: それ以外
 *
 * seedIds を渡すとその範囲だけ、省略すると全シーズ分を計算する。
 */
async function computeSeedEvidenceLevels(
  service: ServiceClient,
  seedIds?: string[],
): Promise<Map<string, SeedEvidenceLevel>> {
  const result = new Map<string, SeedEvidenceLevel>();
  if (seedIds && seedIds.length === 0) return result;

  let statusQuery = service.from("seeds").select("id, status");
  if (seedIds) statusQuery = statusQuery.in("id", seedIds);
  const { data: statusRows, error: statusError } = await statusQuery;
  if (statusError) throw new Error(`seeds status lookup failed: ${statusError.message}`);
  for (const row of (statusRows ?? []) as { id: string; status: string }[]) {
    const base: SeedEvidenceLevel = row.status === "contacted" || row.status === "discussing" ? 1 : 0;
    result.set(row.id, base);
  }

  let contactQuery = service.from("seed_contact_log").select("seed_id");
  if (seedIds) contactQuery = contactQuery.in("seed_id", seedIds);
  const { data: contactRows, error: contactError } = await contactQuery;
  if (contactError) throw new Error(`seed_contact_log lookup failed: ${contactError.message}`);
  for (const row of (contactRows ?? []) as { seed_id: string }[]) {
    if ((result.get(row.seed_id) ?? 0) < 1) result.set(row.seed_id, 1);
  }

  let projectLinkQuery = service.from("seed_projects").select("seed_id, project_id");
  if (seedIds) projectLinkQuery = projectLinkQuery.in("seed_id", seedIds);
  const { data: linkRows, error: linkError } = await projectLinkQuery;
  if (linkError) throw new Error(`seed_projects lookup failed: ${linkError.message}`);
  const links = (linkRows ?? []) as { seed_id: string; project_id: string }[];
  for (const row of links) {
    if ((result.get(row.seed_id) ?? 0) < 2) result.set(row.seed_id, 2);
  }

  return result;
}

/** /seeds 一覧向け: 全シーズの最新スクリーニング帯サマリ + 根拠Lv。帯が無いシーズもLvは持つため全件返す。 */
export async function fetchSeedScreeningBandSummaries(
  seedIds?: string[],
): Promise<Map<string, SeedScreeningBandSummary>> {
  const service = createAdminClient();

  if (seedIds && seedIds.length === 0) return new Map();

  let bandsQuery = service
    .from("seed_screening_bands")
    .select("id, seed_id, measure_version, sps_lower_yen, sps_upper_yen, assessed_at, ruleset_version, frozen")
    .eq("measure_version", CURRENT_SPS_MODEL.measureVersion)
    .eq("ruleset_version", CURRENT_SPS_MODEL.assessmentRulesetVersion)
    .eq("frozen", true)
    .order("assessed_at", { ascending: false })
    .order("id", { ascending: false });
  if (seedIds) bandsQuery = bandsQuery.in("seed_id", seedIds);

  const [bandsResult, evidenceLevels] = await Promise.all([
    bandsQuery,
    computeSeedEvidenceLevels(service, seedIds),
  ]);
  if (bandsResult.error) {
    throw new Error(`seed_screening_bands lookup failed: ${bandsResult.error.message}`);
  }

  const rows = (bandsResult.data ?? []) as {
    id: string;
    seed_id: string;
    measure_version: "sps-ind-v1";
    sps_lower_yen: number | string | null;
    sps_upper_yen: number | string | null;
    assessed_at: string;
    ruleset_version: string | null;
    frozen: boolean;
  }[];

  // append-only なテーブルなので assessed_at desc の先頭が最新行
  const latestBandBySeed = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestBandBySeed.has(row.seed_id)) latestBandBySeed.set(row.seed_id, row);
  }

  const result = new Map<string, SeedScreeningBandSummary>();
  for (const [seedId, evidenceLevel] of evidenceLevels) {
    const band = latestBandBySeed.get(seedId);
    result.set(seedId, {
      assessment_id: band?.id ?? null,
      seed_id: seedId,
      measure_version: band?.measure_version ?? null,
      sps_lower_yen: band ? toNullableNumber(band.sps_lower_yen) : null,
      sps_upper_yen: band ? toNullableNumber(band.sps_upper_yen) : null,
      assessed_at: band?.assessed_at ?? null,
      ruleset_version: band?.ruleset_version ?? null,
      frozen: band?.frozen ?? false,
      evidence_level: evidenceLevel,
    });
  }
  return result;
}

/** シーズ詳細モーダル向け: 対象シーズの最新スクリーニング帯 (全項目) + 根拠Lv。帯が無ければ null。 */
export async function fetchSeedScreeningBandDetail(seedId: string): Promise<SeedScreeningBandDetail | null> {
  const service = createAdminClient();

  const [bandResult, evidenceLevels] = await Promise.all([
    service
      .from("seed_screening_bands")
      // measure_version='sps-ind-v1' 限定 (上の fetchSeedScreeningBandSummaries と同じ理由)。
      .select(
        "id, seed_id, ruleset_version, evaluator, assessed_at, measure_version, frozen, stage_lower, stage_upper, stage_tag, q_lower_pct, q_upper_pct, q_main_factor, q_evidence, p_class, p_lower_yen, p_upper_yen, p_rationale, p_external_demand, p_basis_doc, sps_lower_yen, sps_upper_yen, notes",
      )
      .eq("seed_id", seedId)
      .eq("measure_version", CURRENT_SPS_MODEL.measureVersion)
      .eq("ruleset_version", CURRENT_SPS_MODEL.assessmentRulesetVersion)
      .eq("frozen", true)
      .order("assessed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    computeSeedEvidenceLevels(service, [seedId]),
  ]);
  if (bandResult.error) {
    throw new Error(`seed_screening_bands lookup failed: ${bandResult.error.message}`);
  }

  const evidenceLevel = evidenceLevels.get(seedId) ?? 0;
  if (!bandResult.data) return null;

  const row = bandResult.data as {
    id: string;
    seed_id: string;
    ruleset_version: string;
    evaluator: string;
    assessed_at: string;
    measure_version: "sps-ind-v1";
    frozen: boolean;
    stage_lower: string | null;
    stage_upper: string | null;
    stage_tag: string | null;
    q_lower_pct: number | string | null;
    q_upper_pct: number | string | null;
    q_main_factor: string | null;
    q_evidence: SeedScreeningQEvidenceItem[] | null;
    p_class: string | null;
    p_lower_yen: number | string | null;
    p_upper_yen: number | string | null;
    p_rationale: string | null;
    p_external_demand: string | null;
    p_basis_doc: string | null;
    sps_lower_yen: number | string | null;
    sps_upper_yen: number | string | null;
    notes: string | null;
  };

  return {
    assessment_id: row.id,
    seed_id: row.seed_id,
    evaluator: row.evaluator,
    ruleset_version: row.ruleset_version,
    assessed_at: row.assessed_at,
    measure_version: row.measure_version,
    frozen: row.frozen,
    stage_lower: row.stage_lower,
    stage_upper: row.stage_upper,
    stage_tag: row.stage_tag,
    q_lower_pct: toNullableNumber(row.q_lower_pct),
    q_upper_pct: toNullableNumber(row.q_upper_pct),
    q_main_factor: row.q_main_factor,
    q_evidence: row.q_evidence ?? null,
    p_class: row.p_class,
    p_lower_yen: toNullableNumber(row.p_lower_yen),
    p_upper_yen: toNullableNumber(row.p_upper_yen),
    p_rationale: row.p_rationale,
    p_external_demand: row.p_external_demand,
    p_basis_doc: row.p_basis_doc,
    sps_lower_yen: toNullableNumber(row.sps_lower_yen),
    sps_upper_yen: toNullableNumber(row.sps_upper_yen),
    notes: row.notes,
    evidence_level: evidenceLevel,
  };
}

/**
 * PJ画面向けの現行SPS読み取り。
 * project_id -> seed_projects -> 現行版完全一致の凍結評価、の一本道だけを使う。
 * 旧評価しか無い場合は値をfallbackせず status=unassessed を返す。
 */
export async function fetchCurrentSpsProjectAssessments(
  projectIds?: string[],
): Promise<Map<string, CurrentSpsProjectAssessment>> {
  const service = createAdminClient();
  if (projectIds && projectIds.length === 0) return new Map();

  let resolvedProjectIds = projectIds;
  if (!resolvedProjectIds) {
    const { data: projectRows, error: projectError } = await service
      .from("projects")
      .select("project_id")
      .eq("status", "active");
    if (projectError) throw new Error(`active projects lookup failed: ${projectError.message}`);
    resolvedProjectIds = ((projectRows ?? []) as { project_id: string }[]).map((row) => row.project_id);
  }
  if (resolvedProjectIds.length === 0) return new Map();

  const linksQuery = service
    .from("seed_projects")
    .select("project_id, seed_id")
    .in("project_id", resolvedProjectIds);
  const { data: linkData, error: linkError } = await linksQuery;
  if (linkError) throw new Error(`seed_projects lookup failed: ${linkError.message}`);

  const links = (linkData ?? []) as { project_id: string; seed_id: string }[];
  const seedIds = Array.from(new Set(links.map((row) => row.seed_id)));
  const [bands, seedResult] = await Promise.all([
    fetchSeedScreeningBandSummaries(seedIds),
    seedIds.length > 0
      ? service.from("seeds").select("id, title").in("id", seedIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (seedResult.error) throw new Error(`seeds title lookup failed: ${seedResult.error.message}`);
  const titles = new Map(
    ((seedResult.data ?? []) as { id: string; title: string }[]).map((row) => [row.id, row.title]),
  );

  const result = new Map<string, CurrentSpsProjectAssessment>();
  for (const link of links) {
    const band = bands.get(link.seed_id);
    const assessed = Boolean(band?.assessment_id && band.frozen);
    result.set(link.project_id, {
      project_id: link.project_id,
      seed_id: link.seed_id,
      seed_title: titles.get(link.seed_id) ?? null,
      status: assessed ? "assessed" : "unassessed",
      assessment_id: assessed ? band?.assessment_id ?? null : null,
      sps_lower_yen: assessed ? band?.sps_lower_yen ?? null : null,
      sps_upper_yen: assessed ? band?.sps_upper_yen ?? null : null,
      assessed_at: assessed ? band?.assessed_at ?? null : null,
      evidence_level: band?.evidence_level ?? 0,
      model: CURRENT_SPS_MODEL,
    });
  }

  for (const projectId of resolvedProjectIds) {
    if (result.has(projectId)) continue;
    result.set(projectId, {
      project_id: projectId,
      seed_id: null,
      seed_title: null,
      status: "unassessed",
      assessment_id: null,
      sps_lower_yen: null,
      sps_upper_yen: null,
      assessed_at: null,
      evidence_level: 0,
      model: CURRENT_SPS_MODEL,
    });
  }

  return result;
}
