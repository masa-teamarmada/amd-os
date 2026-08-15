// 一次選別スクリーニング帯 (Tier 0) の service_role 読み取り層。
// テーブル seed_screening_bands / 参照する seed_projects・seed_contact_log・project_pl_monthly・seeds は
// db_schema.md から列名をコピーする。design/seeds.md の「seed_screening_bands」節と
// pwa/bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md §6 確定13 が正本。
//
// seed_screening_bands は RLS ポリシーが一切無いテーブル (service_role 専用)。
// このファイルは "server-only" とし、API route (/api/seeds/screening-bands) からのみ呼ぶ。
// クライアントコンポーネントは types/seeds.ts の DTO 型だけを import し、この lib を直接 import しない。
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  SeedEvidenceLevel,
  SeedScreeningBandDetail,
  SeedScreeningBandSummary,
  SeedScreeningQEvidenceItem,
} from "@/types/seeds";

/** Lv3 判定の月次試算表しきい値 (§6 確定13: project_pl_monthly が6ヶ月分以上) */
const PROJECT_PL_MONTHLY_LV3_THRESHOLD_MONTHS = 6;

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type ServiceClient = ReturnType<typeof createAdminClient>;

/**
 * 根拠Lv (スコア成熟度) を機械導出する。上位が勝つ。
 * Lv3: 紐付くPJの project_pl_monthly が6ヶ月分以上
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

  const projectIds = Array.from(new Set(links.map((row) => row.project_id)));
  if (projectIds.length > 0) {
    const { data: plRows, error: plError } = await service
      .from("project_pl_monthly")
      .select("project_id, ym")
      .in("project_id", projectIds);
    if (plError) throw new Error(`project_pl_monthly lookup failed: ${plError.message}`);
    const monthCountByProject = new Map<string, number>();
    for (const row of (plRows ?? []) as { project_id: string; ym: string }[]) {
      monthCountByProject.set(row.project_id, (monthCountByProject.get(row.project_id) ?? 0) + 1);
    }
    const matureProjectIds = new Set(
      Array.from(monthCountByProject.entries())
        .filter(([, months]) => months >= PROJECT_PL_MONTHLY_LV3_THRESHOLD_MONTHS)
        .map(([projectId]) => projectId),
    );
    for (const row of links) {
      if (matureProjectIds.has(row.project_id)) result.set(row.seed_id, 3);
    }
  }

  return result;
}

/** /seeds 一覧向け: 全シーズの最新スクリーニング帯サマリ + 根拠Lv。帯が無いシーズもLvは持つため全件返す。 */
export async function fetchSeedScreeningBandSummaries(): Promise<Map<string, SeedScreeningBandSummary>> {
  const service = createAdminClient();

  const [bandsResult, evidenceLevels] = await Promise.all([
    service
      .from("seed_screening_bands")
      .select("seed_id, sps_lower_yen, sps_upper_yen, assessed_at, ruleset_version")
      .order("assessed_at", { ascending: false }),
    computeSeedEvidenceLevels(service),
  ]);
  if (bandsResult.error) {
    throw new Error(`seed_screening_bands lookup failed: ${bandsResult.error.message}`);
  }

  const rows = (bandsResult.data ?? []) as {
    seed_id: string;
    sps_lower_yen: number | string | null;
    sps_upper_yen: number | string | null;
    assessed_at: string;
    ruleset_version: string | null;
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
      seed_id: seedId,
      sps_lower_yen: band ? toNullableNumber(band.sps_lower_yen) : null,
      sps_upper_yen: band ? toNullableNumber(band.sps_upper_yen) : null,
      assessed_at: band?.assessed_at ?? null,
      ruleset_version: band?.ruleset_version ?? null,
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
      .select(
        "seed_id, ruleset_version, evaluator, assessed_at, stage_lower, stage_upper, stage_tag, q_lower_pct, q_upper_pct, q_main_factor, q_evidence, p_class, p_lower_yen, p_upper_yen, sps_lower_yen, sps_upper_yen, notes",
      )
      .eq("seed_id", seedId)
      .order("assessed_at", { ascending: false })
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
    seed_id: string;
    ruleset_version: string;
    evaluator: string;
    assessed_at: string;
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
    sps_lower_yen: number | string | null;
    sps_upper_yen: number | string | null;
    notes: string | null;
  };

  return {
    seed_id: row.seed_id,
    evaluator: row.evaluator,
    ruleset_version: row.ruleset_version,
    assessed_at: row.assessed_at,
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
    sps_lower_yen: toNullableNumber(row.sps_lower_yen),
    sps_upper_yen: toNullableNumber(row.sps_upper_yen),
    notes: row.notes,
    evidence_level: evidenceLevel,
  };
}
