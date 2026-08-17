/**
 * OSが「現行SPS」として採用する版の完全な組。
 * 日時順の最新行やDB defaultではなく、この組への完全一致だけを現行として扱う。
 */
export const CURRENT_SPS_MODEL = Object.freeze({
  modelVersion: "sps-ind-tier0-v1",
  formula: "SPS = Σ q_o P^ind_o",
  measureVersion: "sps-ind-v1",
  qModelVersion: "q-eval-v2",
  qRulesetVersion: "rubric-v1.1",
  pModelVersion: "p-ind-v1",
  assessmentRulesetVersion: "rubric-v1.1+ind-v1",
} as const);

export type CurrentSpsAssessmentStatus = "assessed" | "unassessed";

export interface CurrentSpsProjectAssessment {
  project_id: string;
  seed_id: string | null;
  seed_title: string | null;
  status: CurrentSpsAssessmentStatus;
  assessment_id: string | null;
  sps_lower_yen: number | null;
  sps_upper_yen: number | null;
  assessed_at: string | null;
  evidence_level: 0 | 1 | 2 | 3;
  model: typeof CURRENT_SPS_MODEL;
}
