/**
 * /institutions「支援プログラム比較」のサーバ側データ層。
 *
 * 制度比較マトリクス (`institution_policy_items` / `institution_policy_assessments`) のうち、
 * 比較表に出す列 (compare_sort を持つ項目) と、その全機関ぶんのセルをまとめて読む。
 * どちらも日〜週単位でしか変わらない参照系なので、プロセス内に5分持ち、同時アクセスは1本へ束ねる。
 * 規範: pwa/spec/5-10-reference-data-caching-current-spec.md
 *
 * このファイルは server-only。API route (/api/institutions/support-programs) からだけ呼ぶ。
 * 画面は src/lib/institution-support-programs-client.ts (reference-data-cache 経由) を通す。
 * 書き込み経路 (/api/institutions/policies) は保存後に invalidateInstitutionSupportProgramsCache() を呼ぶ。
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InstitutionPolicySourceType,
  InstitutionPolicyStatus,
} from "@/lib/institution-policy";
import type {
  RecommendationStance,
  SupportProgramCell,
  SupportProgramColumn,
  SupportProgramExtraCell,
  SupportProgramItem,
  SupportProgramRecommendation,
} from "@/types/institution-support-programs";

const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 1000;

export type SupportProgramSnapshot = {
  columns: SupportProgramColumn[];
  cells: SupportProgramCell[];
  items: SupportProgramItem[];
  extraCells: SupportProgramExtraCell[];
  recommendations: SupportProgramRecommendation[];
  generatedAt: string;
};

let snapshot: { value: SupportProgramSnapshot; storedAt: number } | null = null;
let inflight: Promise<SupportProgramSnapshot> | null = null;

/** TTL 内はメモリから返し、同時アクセスは1回のロードへ束ねる (single-flight)。 */
export async function getSupportProgramSnapshot(
  client: SupabaseClient,
  options?: { force?: boolean },
): Promise<SupportProgramSnapshot> {
  if (!options?.force && snapshot && Date.now() - snapshot.storedAt < SNAPSHOT_TTL_MS) {
    return snapshot.value;
  }
  if (!options?.force && inflight) return inflight;

  const request = loadSupportProgramSnapshot(client)
    .then((value) => {
      snapshot = { value, storedAt: Date.now() };
      return value;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });
  inflight = request;
  return request;
}

/** 制度比較セル・推奨の保存直後に呼ぶ。次の読み取りで最新へ戻る。 */
export function invalidateInstitutionSupportProgramsCache(): void {
  snapshot = null;
}

export function supportProgramCacheAgeMs(): number | null {
  return snapshot ? Date.now() - snapshot.storedAt : null;
}

type ItemRow = {
  policy_item_id: string;
  key: string;
  label: string;
  category: string;
  compare_label: string | null;
  description: string | null;
  item_kind: string | null;
  compare_group: string | null;
  compare_sort: number | null;
  sort_order: number | null;
};

type CellRow = {
  institution_id: string;
  policy_item_id: string;
  status: string | null;
  attribute_value: string | null;
  evidence_note: string | null;
  source_type: string | null;
  source_url: string | null;
  confirmed_at: string | null;
};

type RecommendationRow = {
  recommendation_id: string;
  policy_item_id: string | null;
  topic: string;
  stance: string | null;
  recommendation: string;
  conditions: string | null;
  rationale: string | null;
  evidence_note: string | null;
  stat_note: string | null;
  sort_order: number | null;
  updated_at: string;
};

const STANCES: RecommendationStance[] = ["recommend", "conditional", "not_recommend", "open"];
const STATUSES: InstitutionPolicyStatus[] = ["unknown", "not_started", "drafting", "established"];
const SOURCE_TYPES: InstitutionPolicySourceType[] = [
  "unknown",
  "official",
  "internal_doc",
  "hearing",
  "db",
  "inferred",
];

async function loadSupportProgramSnapshot(client: SupabaseClient): Promise<SupportProgramSnapshot> {
  // 列定義と推奨は互いに独立なので並列に読む
  const [itemsResult, recommendationsResult] = await Promise.all([
    client
      .from("institution_policy_items")
      .select("policy_item_id,key,label,category,compare_label,description,item_kind,compare_group,compare_sort,sort_order")
      .order("sort_order", { ascending: true }),
    client
      .from("institution_policy_recommendations")
      .select(
        "recommendation_id,policy_item_id,topic,stance,recommendation,conditions,rationale,evidence_note,stat_note,sort_order,updated_at",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (recommendationsResult.error) throw new Error(recommendationsResult.error.message);

  const recommendations: SupportProgramRecommendation[] = (
    (recommendationsResult.data ?? []) as RecommendationRow[]
  ).map((row) => ({
    recommendationId: row.recommendation_id,
    policyItemId: row.policy_item_id ?? null,
    topic: row.topic,
    stance: STANCES.includes(row.stance as RecommendationStance)
      ? (row.stance as RecommendationStance)
      : "open",
    recommendation: row.recommendation,
    conditions: row.conditions ?? null,
    rationale: row.rationale ?? null,
    evidenceNote: row.evidence_note ?? null,
    statNote: row.stat_note ?? null,
    sortOrder: Number(row.sort_order ?? 100),
    updatedAt: row.updated_at,
  }));

  const allRows = (itemsResult.data ?? []) as ItemRow[];
  const items: SupportProgramItem[] = allRows.map((row) => ({
    policyItemId: row.policy_item_id,
    key: row.key,
    label: row.label,
    category: row.category,
    itemKind: row.item_kind === "attribute" ? "attribute" : "status",
    compareSort: row.compare_sort == null ? null : Number(row.compare_sort),
  }));
  const columns: SupportProgramColumn[] = allRows
    .filter((row) => row.compare_sort != null)
    .sort((a, b) => Number(a.compare_sort) - Number(b.compare_sort))
    .map((row) => ({
      policyItemId: row.policy_item_id,
      key: row.key,
      label: row.compare_label || row.label,
      fullLabel: row.label,
      description: row.description ?? null,
      group: row.compare_group || "その他",
      compareSort: Number(row.compare_sort ?? 0),
      itemKind: row.item_kind === "attribute" ? "attribute" : "status",
    }));
  const compareIds = new Set(columns.map((column) => column.policyItemId));
  const itemIds = items.map((item) => item.policyItemId);

  // PostgREST の1レスポンス上限 (1000行) を跨いでも落とさないよう、ページで読む。
  const cells: SupportProgramCell[] = [];
  const extraCells: SupportProgramExtraCell[] = [];
  if (itemIds.length) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const page = await client
        .from("institution_policy_assessments")
        .select(
          "institution_id,policy_item_id,status,attribute_value,evidence_note,source_type,source_url,confirmed_at",
        )
        .in("policy_item_id", itemIds)
        .order("institution_id", { ascending: true })
        .order("policy_item_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (page.error) throw new Error(page.error.message);
      const rows = (page.data ?? []) as CellRow[];
      for (const row of rows) {
        if (!compareIds.has(row.policy_item_id)) {
          extraCells.push({
            institutionId: row.institution_id,
            policyItemId: row.policy_item_id,
            status: STATUSES.includes(row.status as InstitutionPolicyStatus)
              ? (row.status as InstitutionPolicyStatus)
              : "unknown",
            value: row.attribute_value ? row.attribute_value.slice(0, 120) : null,
          });
          continue;
        }
        cells.push({
          institutionId: row.institution_id,
          policyItemId: row.policy_item_id,
          status: STATUSES.includes(row.status as InstitutionPolicyStatus)
            ? (row.status as InstitutionPolicyStatus)
            : "unknown",
          value: row.attribute_value ?? null,
          note: row.evidence_note ?? null,
          sourceUrl: row.source_url ?? null,
          sourceType: SOURCE_TYPES.includes(row.source_type as InstitutionPolicySourceType)
            ? (row.source_type as InstitutionPolicySourceType)
            : "unknown",
          confirmedAt: row.confirmed_at ?? null,
        });
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }

  return { columns, cells, items, extraCells, recommendations, generatedAt: new Date().toISOString() };
}
