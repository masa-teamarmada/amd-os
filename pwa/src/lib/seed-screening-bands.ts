// 一次選別スクリーニング帯 (Tier 0) の service_role 読み取り層。
// テーブル seed_screening_bands / 参照する seed_projects・seed_contact_log・seeds は
// db_schema.md から列名をコピーする。design/seeds.md の「seed_screening_bands」節と
// bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md §6 確定13 が正本。
//
// seed_screening_bands は RLS ポリシーが一切無いテーブル (service_role 専用)。
// このファイルは "server-only" とし、API route (/api/seeds/screening-bands) からのみ呼ぶ。
// クライアントコンポーネントは types/seeds.ts の DTO 型だけを import し、この lib を直接 import しない。
//
// 【参照系キャッシュ】seed_screening_bands は append-only で、書き込みは評価ツール
// (scripts/sps_initial_assessment_tool.mjs / sps_reassessment_tool.mjs) からしか起きない。
// 直す前は1リクエストごとに4本のクエリを直列でSupabaseへ往復していた (実測 中央値138ms)。
// 現在は2段構えでプロセス内に持ち、TTL 内はメモリから返す (BAND_CACHE_TTL_MS)。
//   - サマリ帯 + 根拠Lv: テーブル全体を並列3本でまとめて読む (実測 サマリ全件184ms / 根拠Lv40ms)
//   - 詳細行 (q_evidence 込み): シーズ単位で引いて貯める (実測 1件39ms)
// 詳細を全件先読みしないのは、約3MB・1.3秒かかり最初の1人が必ずその待ちを食うため。
// 全PJ共通の規範は /Users/masa/projects/AGENTS.common.reference.md「参照系データの体感速度」節。
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

/** PostgREST の1レスポンス上限 (既定1000行) を跨いでも取りこぼさないためのページ読み。 */
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  label: string,
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} lookup failed: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

type BandDetailRow = {
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

const BAND_SUMMARY_COLUMNS =
  "id, seed_id, measure_version, sps_lower_yen, sps_upper_yen, assessed_at, ruleset_version, frozen";

type BandSummaryRow = Pick<
  BandDetailRow,
  "id" | "seed_id" | "measure_version" | "sps_lower_yen" | "sps_upper_yen" | "assessed_at" | "ruleset_version" | "frozen"
>;

const BAND_DETAIL_COLUMNS =
  "id, seed_id, ruleset_version, evaluator, assessed_at, measure_version, frozen, stage_lower, stage_upper, stage_tag, q_lower_pct, q_upper_pct, q_main_factor, q_evidence, p_class, p_lower_yen, p_upper_yen, p_rationale, p_external_demand, p_basis_doc, sps_lower_yen, sps_upper_yen, notes";

/**
 * 根拠Lv (スコア成熟度) を機械導出する。上位が勝つ。
 * Lv3: 現行データでは自動付与しない。verified actualと計画値を区別できる正規化証跡が必要。
 * Lv2: seed_projects に紐付け行がある
 * Lv1: seed_contact_log に1件以上、または seeds.status が contacted/discussing
 * Lv0: それ以外
 *
 * スナップショット構築時に全シーズ分をまとめて計算する (シーズ単位の追加クエリは張らない)。
 */
function buildEvidenceLevels(
  statusRows: { id: string; status: string }[],
  contactRows: { seed_id: string }[],
  linkRows: { seed_id: string }[],
): Map<string, SeedEvidenceLevel> {
  const result = new Map<string, SeedEvidenceLevel>();
  for (const row of statusRows) {
    result.set(row.id, row.status === "contacted" || row.status === "discussing" ? 1 : 0);
  }
  for (const row of contactRows) {
    if ((result.get(row.seed_id) ?? 0) < 1) result.set(row.seed_id, 1);
  }
  for (const row of linkRows) {
    if ((result.get(row.seed_id) ?? 0) < 2) result.set(row.seed_id, 2);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 参照系スナップショット (プロセス内キャッシュ)
// ---------------------------------------------------------------------------

type BandSnapshot = {
  storedAt: number;
  summaries: Map<string, SeedScreeningBandSummary>;
};

/** 既定5分。評価ツールで書いた直後に確認したいときは環境変数で短縮する。 */
export const BAND_CACHE_TTL_MS = Number(process.env.SEED_SCREENING_BAND_CACHE_TTL_MS ?? 5 * 60 * 1000);

let bandSnapshot: BandSnapshot | null = null;
let bandSnapshotInflight: Promise<BandSnapshot> | null = null;
/** 詳細行はシーズ単位のキャッシュ。全件先読みすると約3MB・1.3秒かかるため一括では持たない。 */
const bandDetails = new Map<string, { value: SeedScreeningBandDetail | null; storedAt: number }>();
const bandDetailInflight = new Map<string, Promise<SeedScreeningBandDetail | null>>();

function toDetail(row: BandDetailRow, evidenceLevel: SeedEvidenceLevel): SeedScreeningBandDetail {
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
 * 一覧が必ず使う「サマリ帯 + 根拠Lv」だけをテーブル全体まとめて読む。3本のクエリは並列。
 *
 * 詳細行 (q_evidence 込み) はここに含めない。実測で全件だと約3MB・1.3秒かかり、
 * 最初にアクセスした人がその1.3秒を必ず食う。詳細はシーズ単位で引いて貯める
 * (loadBandDetail: 1件39ms)。サマリ全件は184ms、根拠Lv3本は40ms。
 */
async function loadBandSnapshot(): Promise<BandSnapshot> {
  const service: ServiceClient = createAdminClient();

  const [bandRows, statusRows, contactRows, linkRows] = await Promise.all([
    fetchAllRows<BandSummaryRow>("seed_screening_bands", (from, to) =>
      service
        .from("seed_screening_bands")
        // measure_version / ruleset_version が現行版と完全一致する凍結行だけ。旧版へfallbackしない。
        .select(BAND_SUMMARY_COLUMNS)
        .eq("measure_version", CURRENT_SPS_MODEL.measureVersion)
        .eq("ruleset_version", CURRENT_SPS_MODEL.assessmentRulesetVersion)
        .eq("frozen", true)
        .order("assessed_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)),
    fetchAllRows<{ id: string; status: string }>("seeds status", (from, to) =>
      service.from("seeds").select("id, status").order("id").range(from, to)),
    fetchAllRows<{ seed_id: string }>("seed_contact_log", (from, to) =>
      service.from("seed_contact_log").select("seed_id").order("seed_id").range(from, to)),
    fetchAllRows<{ seed_id: string }>("seed_projects", (from, to) =>
      service.from("seed_projects").select("seed_id").order("seed_id").range(from, to)),
  ]);

  const evidenceLevels = buildEvidenceLevels(statusRows, contactRows, linkRows);

  // append-only なテーブルなので assessed_at desc の先頭がそのシーズの最新行
  const latestBandBySeed = new Map<string, BandSummaryRow>();
  for (const row of bandRows) {
    if (!latestBandBySeed.has(row.seed_id)) latestBandBySeed.set(row.seed_id, row);
  }

  const summaries = new Map<string, SeedScreeningBandSummary>();
  // 帯が無いシーズも根拠Lvは持つため、サマリは全シーズ分を作る。
  const seedIds = new Set<string>([...evidenceLevels.keys(), ...latestBandBySeed.keys()]);
  for (const seedId of seedIds) {
    const band = latestBandBySeed.get(seedId);
    summaries.set(seedId, {
      assessment_id: band?.id ?? null,
      seed_id: seedId,
      measure_version: band?.measure_version ?? null,
      sps_lower_yen: band ? toNullableNumber(band.sps_lower_yen) : null,
      sps_upper_yen: band ? toNullableNumber(band.sps_upper_yen) : null,
      assessed_at: band?.assessed_at ?? null,
      ruleset_version: band?.ruleset_version ?? null,
      frozen: band?.frozen ?? false,
      evidence_level: evidenceLevels.get(seedId) ?? 0,
    });
  }

  return { storedAt: Date.now(), summaries };
}

/** TTL 内はメモリから返し、同時アクセスは1回のロードに束ねる (single-flight)。 */
async function getBandSnapshot(force = false): Promise<BandSnapshot> {
  if (!force && bandSnapshot && Date.now() - bandSnapshot.storedAt < BAND_CACHE_TTL_MS) {
    return bandSnapshot;
  }
  if (force) bandSnapshotInflight = null;
  if (!bandSnapshotInflight) {
    bandSnapshotInflight = loadBandSnapshot()
      .then((snapshot) => {
        bandSnapshot = snapshot;
        return snapshot;
      })
      .finally(() => {
        bandSnapshotInflight = null;
      });
  }
  return bandSnapshotInflight;
}

/** 詳細行はシーズ単位で引き、プロセス内に貯める。同じシーズへの同時アクセスは1本に束ねる。 */
async function loadBandDetail(seedId: string): Promise<SeedScreeningBandDetail | null> {
  const service: ServiceClient = createAdminClient();
  const [bandResult, snapshot] = await Promise.all([
    service
      .from("seed_screening_bands")
      .select(BAND_DETAIL_COLUMNS)
      .eq("seed_id", seedId)
      .eq("measure_version", CURRENT_SPS_MODEL.measureVersion)
      .eq("ruleset_version", CURRENT_SPS_MODEL.assessmentRulesetVersion)
      .eq("frozen", true)
      .order("assessed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getBandSnapshot(),
  ]);
  if (bandResult.error) {
    throw new Error(`seed_screening_bands lookup failed: ${bandResult.error.message}`);
  }
  if (!bandResult.data) return null;
  const evidenceLevel = snapshot.summaries.get(seedId)?.evidence_level ?? 0;
  return toDetail(bandResult.data as BandDetailRow, evidenceLevel);
}

/** 評価ツールが帯を書いた直後など、TTLを待たずに読み直したいときに呼ぶ。 */
export function invalidateSeedScreeningBandCache(): void {
  bandSnapshot = null;
  bandSnapshotInflight = null;
  bandDetails.clear();
  bandDetailInflight.clear();
}

/** 監視・デバッグ用。API route が x-band-cache-age-ms ヘッダに載せる。 */
export function seedScreeningBandCacheAgeMs(): number | null {
  return bandSnapshot ? Date.now() - bandSnapshot.storedAt : null;
}

/** /seeds 一覧向け: 全シーズの最新スクリーニング帯サマリ + 根拠Lv。帯が無いシーズもLvは持つため全件返す。 */
export async function fetchSeedScreeningBandSummaries(
  seedIds?: string[],
  options?: { force?: boolean },
): Promise<Map<string, SeedScreeningBandSummary>> {
  if (seedIds && seedIds.length === 0) return new Map();
  const snapshot = await getBandSnapshot(options?.force);
  if (!seedIds) return new Map(snapshot.summaries);

  const result = new Map<string, SeedScreeningBandSummary>();
  for (const seedId of seedIds) {
    const summary = snapshot.summaries.get(seedId);
    if (summary) result.set(seedId, summary);
  }
  return result;
}

/** シーズ詳細モーダル向け: 対象シーズの最新スクリーニング帯 (全項目) + 根拠Lv。帯が無ければ null。 */
export async function fetchSeedScreeningBandDetail(
  seedId: string,
  options?: { force?: boolean },
): Promise<SeedScreeningBandDetail | null> {
  if (options?.force) {
    bandDetails.delete(seedId);
    bandDetailInflight.delete(seedId);
  } else {
    const cached = bandDetails.get(seedId);
    if (cached && Date.now() - cached.storedAt < BAND_CACHE_TTL_MS) return cached.value;
    const pending = bandDetailInflight.get(seedId);
    if (pending) return pending;
  }

  const request = loadBandDetail(seedId)
    .then((value) => {
      bandDetails.set(seedId, { value, storedAt: Date.now() });
      return value;
    })
    .finally(() => {
      if (bandDetailInflight.get(seedId) === request) bandDetailInflight.delete(seedId);
    });
  bandDetailInflight.set(seedId, request);
  return request;
}

/**
 * PJ画面向けの現行SPS読み取り。
 * project_id -> seed_projects -> 現行版完全一致の凍結評価、の一本道だけを使う。
 * 旧評価しか無い場合は値をfallbackせず status=unassessed を返す。
 */
export async function fetchCurrentSpsProjectAssessments(
  projectIds?: string[],
  options?: { force?: boolean },
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
    fetchSeedScreeningBandSummaries(seedIds, options),
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
