/**
 * /institutions「支援プログラム比較」の表示用データ契約。
 * サーバ層 (lib/institution-support-programs.ts) とクライアント層 (lib/institution-support-programs-client.ts) が共有する。
 */
import type {
  InstitutionPolicySourceType,
  InstitutionPolicyStatus,
} from "@/lib/institution-policy";

/** 比較表の1列。`institution_policy_items` のうち compare_sort を持つ項目。 */
export interface SupportProgramColumn {
  policyItemId: string;
  key: string;
  /** 比較表の短い見出し (compare_label)。無ければ label。 */
  label: string;
  /** /institutions/assess と同じ正式な項目名。 */
  fullLabel: string;
  description: string | null;
  group: string;
  compareSort: number;
  itemKind: "status" | "attribute";
}

/** 研究機関 × 列 のセル。内部資料パスと入力者は会員向けには返さない。 */
export interface SupportProgramCell {
  institutionId: string;
  policyItemId: string;
  status: InstitutionPolicyStatus;
  value: string | null;
  note: string | null;
  sourceUrl: string | null;
  sourceType: InstitutionPolicySourceType;
  confirmedAt: string | null;
}

export type RecommendationStance = "recommend" | "conditional" | "not_recommend" | "open";

export const RECOMMENDATION_STANCE_LABEL: Record<RecommendationStance, string> = {
  recommend: "推奨",
  conditional: "条件付き推奨",
  not_recommend: "推奨しない",
  open: "要検討",
};

export const RECOMMENDATION_STANCES: RecommendationStance[] = [
  "recommend",
  "conditional",
  "not_recommend",
  "open",
];

/**
 * AMDが規程類へ盛り込むべき論点と推奨 (`institution_policy_recommendations`)。
 * 統計 (整備済み機関数など) は持たず、画面が cells から算出する。
 */
export interface SupportProgramRecommendation {
  recommendationId: string;
  /** 比較表の列に紐づく論点なら policy_item_id。列に無い論点は null。 */
  policyItemId: string | null;
  topic: string;
  stance: RecommendationStance;
  recommendation: string;
  conditions: string | null;
  rationale: string | null;
  evidenceNote: string | null;
  statNote: string | null;
  sortOrder: number;
  updatedAt: string;
}

export interface SupportProgramBundle {
  columns: SupportProgramColumn[];
  cells: SupportProgramCell[];
  recommendations: SupportProgramRecommendation[];
  generatedAt: string;
  canEdit: boolean;
}
